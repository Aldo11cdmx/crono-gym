/**
 * AthleteCRM.tsx — everything a coach knows about one athlete, on one screen.
 *
 * The panel the portal's selection drives, and the first place in the app where one
 * authenticated user reads another user's training data. That changes what each read has to
 * prove.
 *
 * **Every read here is filtered by `user_id` and relies on the coach SELECT policies from
 * `20261003030000_coach_portal.sql` to qualify it.** The client filter and the policy are
 * not belt-and-braces: the policy is what makes the row visible, and the client filter is
 * what makes the query cheap and honest about intent. Neither is a security control on its
 * own, and the code is written so that neither is *mistaken* for one -- which is why every
 * read below takes the `athleteId` from the selection rather than from anything the athlete
 * sent.
 *
 * **The qualification is `status = 'active'`, not "this coach is in the row".** A pending
 * request shows the athlete's notes and nothing else. So a coach who has not accepted yet
 * sees a panel whose sections are empty rather than one full of an athlete's records, and
 * the emptiness is correct: the database refuses those rows, and the component must not
 * pretend otherwise by showing a cheerful "no data" where the truth is "not yours yet".
 *
 * **Volume comes out of the rank map, not out of a second query.** `buildRankMap` already
 * computes `setsPerWeek` per muscle as part of the volume score; reading it again from
 * `completed_sets` would mean paging two years of sets a second time to produce a number
 * that already exists in memory. The cost of that choice is stated rather than hidden: the
 * volume shown is the same window the ranks were computed over, not "last seven days".
 *
 * **Routine history is two explicit queries.** `routine_exercises` and `exercises` are read
 * after `routines`, and joined in memory, for the reason `RequestQueue` reads `profiles`
 * twice: PostgREST's embedding needs the relationship to be declared and the shape to be
 * flat, and a routine rendered with unnamed exercises is a routine nobody can follow.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ACCENT, TEXT, TYPE } from "@/design/tokens";
import { GlassCard, Skeleton } from "@/components/ui";
import { AnatomicalRanksView } from "@/components/AnatomicalRanksView";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { useAthletePRs } from "@/hooks/useAthletePRs";
import { useMuscleRanks } from "@/hooks/useMuscleRanks";
import { supabase } from "@lib/supabase";
import type { Exercise, Routine, RoutineExercise } from "@/types/supabase";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { CoachAthleteNotes } from "./CoachAthleteNotes";
import { AthletePhaseSelector } from "./AthletePhaseSelector";

/** How many routines the history section shows. */
const HISTORY_LIMIT = 10;

export interface AthleteCRMProps {
  /** The athlete being read. Null renders the prompt instead. */
  athleteId: string | null;
}

export function AthleteCRM({ athleteId }: AthleteCRMProps) {
  const { map } = useMuscleRanks(athleteId, { readOnly: true });
  const { prs, loading: prsLoading, error: prsError } = useAthletePRs(athleteId);

  const [history, setHistory] = useState<RoutineHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  /** The history read is the only one that spans two queries, and both can land late. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadHistory = useCallback(async () => {
    if (!athleteId) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    const { data, error: readError } = await supabase
      .from("routines")
      .select("id,title,source,authored_by_coach,created_at")
      .eq("user_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    if (!mounted.current) return;

    if (readError) {
      setHistory([]);
      setHistoryError(readError.message);
      setHistoryLoading(false);
      return;
    }

    const routines = (data ?? []) as Routine[];

    if (routines.length === 0) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    const [rows, catalog] = await Promise.all([
      supabase
        .from("routine_exercises")
        .select("routine_id,exercise_id,day_index,order_index")
        .in(
          "routine_id",
          routines.map((routine) => routine.id),
        )
        .order("order_index", { ascending: true }),
      supabase.from("exercises").select("id,name"),
    ]);

    if (!mounted.current) return;

    /*
     * A failed exercise read still renders the routines, with no exercise names.
     *
     * The two reads are independent, so letting one failure blank the other would throw
     * away a title and a date over a missing label.
     */
    const names = new Map<string, string>();
    for (const exercise of (catalog.data ?? []) as Pick<Exercise, "id" | "name">[]) {
      if (exercise.name) names.set(exercise.id, getExerciseDisplayName(exercise));
    }

    const byRoutine = new Map<string, RoutineExercise[]>();
    for (const row of (rows.data ?? []) as RoutineExercise[]) {
      const list = byRoutine.get(row.routine_id) ?? [];
      list.push(row);
      byRoutine.set(row.routine_id, list);
    }

    setHistory(
      routines.map((routine) => ({
        id: routine.id,
        title: routine.title,
        source: routine.source,
        createdAt: routine.created_at,
        // Grouped by day so the history reads like the routine the athlete will open,
        // rather than as one undifferentiated list of movements.
        days: groupByDay(byRoutine.get(routine.id) ?? [], names),
      })),
    );
    setHistoryLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (athleteId === null) {
    return (
      <GlassCard>
        <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>{T.crmSelectPrompt}</p>
      </GlassCard>
    );
  }

  return (
    <section aria-labelledby="crm-heading" className="flex min-w-0 flex-col gap-3">
      <h3 id="crm-heading" style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary }}>
        {T.crmTitle}
      </h3>

      <GlassCard>
        <Section title={T.crmRanksSection}>
          {/*
           * `readOnly` and no `onBrowseMuscle`.
           *
           * Read-only because the rank store is keyed by muscle alone and shared across
           * every account on the origin, so a coach browsing an athlete's map would write
           * hysteresis into that athlete's next evaluation. No browse callback because
           * "see the exercises for this muscle" is a trip into the athlete's own catalog --
           * a screen that filters on the *signed-in* user's data and would show the coach
           * their own exercises under an athlete's muscle.
           */}
          <AnatomicalRanksView userId={athleteId} readOnly />
        </Section>
      </GlassCard>

      <GlassCard>
        <Section title={T.crmVolumeSection}>
          <WeeklyVolume map={map} />
        </Section>
      </GlassCard>

      <GlassCard>
        <Section title={T.crmPrsSection}>
          {prsError ? (
            <ErrorLine>{T.crmLoadError}</ErrorLine>
          ) : prsLoading ? (
            <Skeleton />
          ) : prs.length === 0 ? (
            <p style={bodyStyle}>{T.prsNone}</p>
          ) : (
            <ul className="flex flex-col gap-2" style={listStyle}>
              {prs.map((pr) => (
                <li key={pr.exerciseId} className="flex items-baseline justify-between gap-3">
                  <span style={{ fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                    {getExerciseDisplayName({ name: pr.exerciseName })}
                  </span>
                  <span style={{ fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
                    {formatKg(pr.weightKg)}
                    {pr.reps !== null ? ` × ${pr.reps}` : ""}
                    {pr.achievedAt !== "" && (
                      <span style={{ marginLeft: 8, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                        {T.prsAchievedOn(formatWhen(pr.achievedAt))}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </GlassCard>

      <GlassCard>
        <Section title={T.crmHistorySection}>
          {historyError ? (
            <ErrorLine>{T.crmLoadError}</ErrorLine>
          ) : historyLoading ? (
            <Skeleton />
          ) : history.length === 0 ? (
            <p style={bodyStyle}>{T.historyEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3" style={listStyle}>
              {history.map((routine) => (
                <li key={routine.id} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
                      {routine.title}
                    </span>
                    <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                      {sourceLabel(routine.source)}
                    </span>
                  </div>
                  {routine.days.map((day) => (
                    <p key={day.label} style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                      <strong style={{ color: TEXT.secondary }}>{day.label}</strong>
                      {day.exercises.length > 0 ? ` · ${day.exercises.join(", ")}` : ""}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </GlassCard>

      <GlassCard>
        {/*
         * The check-in section, empty on purpose.
         *
         * `session_checkins` is typed and read by `useProfile`, but it has no DDL anywhere in
         * this repository and no RLS -- so reading it here would be a runtime error, not an
         * empty list. The copy says so rather than showing a bare "no data", because "no
         * data" and "not built yet" are different answers to a coach's question. Recorded as
         * the first Block 5 item.
         */}
        <Section title={T.crmCheckinsSection}>
          <p style={bodyStyle}>{T.checkinsPending}</p>
        </Section>

        <CoachAthleteNotes athleteId={athleteId} />

        <AthletePhaseSelector athleteId={athleteId} />
      </GlassCard>
    </section>
  );
}

// ------------------------------------------------------------------- pieces

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.secondary }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
      {children}
    </p>
  );
}

/**
 * Sets per week per muscle, read off the rank map.
 *
 * Only classified muscles: an unranked muscle has no volume figure the engine is willing to
 * stand behind, and printing `0` for a muscle the athlete simply has not trained would read
 * as "they stopped" rather than "we do not know".
 */
function WeeklyVolume({ map }: { map: ReturnType<typeof useMuscleRanks>["map"] }) {
  if (map === null || map.classifiedCount === 0) {
    return <p style={bodyStyle}>{T.prsRecentOnly}</p>;
  }

  const rows = [...map.muscles.values()]
    .filter((muscle) => muscle.classified)
    .map((muscle) => ({
      label: muscle.label,
      sets: muscle.detail.volume.setsPerWeek,
    }))
    .sort((a, b) => b.sets - a.sets);

  return (
    <ul className="flex flex-col gap-1" style={listStyle}>
      {rows.map((row) => (
        <li key={row.label} className="flex items-baseline justify-between gap-3">
          <span style={{ fontSize: TYPE.subhead.size, color: TEXT.secondary }}>{row.label}</span>
          <span style={{ fontSize: TYPE.subhead.size, color: TEXT.primary }}>{row.sets}</span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------- shapes

interface HistoryDay {
  label: string;
  exercises: string[];
}

export interface RoutineHistoryRow {
  id: string;
  title: string;
  source: Routine["source"];
  createdAt: string;
  days: HistoryDay[];
}

/**
 * The routine's rows, grouped by `day_index`.
 *
 * Rows written before `20261003030000_coach_portal.sql` have `day_index = 0` and carry no
 * `day_label`, which is the column's default. Those all land in one group under a neutral
 * heading rather than being hidden: an old routine the athlete still trains must not
 * disappear from their coach's history because it predates a column.
 */
function groupByDay(
  rows: RoutineExercise[],
  names: Map<string, string>,
): HistoryDay[] {
  const byIndex = new Map<number, string[]>();

  for (const row of rows) {
    const list = byIndex.get(row.day_index) ?? [];
    const name = names.get(row.exercise_id);
    if (name) list.push(name);
    byIndex.set(row.day_index, list);
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, exercises]) => ({
      label: `Día ${index + 1}`,
      exercises,
    }));
}

// ------------------------------------------------------------------ format

/**
 * A routine's author, in the athlete's language.
 *
 * `human_coach` is checked before the fallback because it is the only one of the three that
 * changes what the coach is looking at: it means *this* coach wrote it. `coalesce` rather
 * than a `=== "user"` test, because the column is nullable and null means "not attributed",
 * not "written by the athlete".
 */
function sourceLabel(source: Routine["source"]): string {
  if (source === "human_coach") return T.historyAuthoredByCoach;
  if (source === "ai") return T.historyAuthoredByAi;
  return T.historyAuthoredByAthlete;
}

function formatKg(weight: number): string {
  return `${weight} kg`;
}

/**
 * A PR date, short and local.
 *
 * Local because the coach is reading somebody else's training and "2026-10-01" is a fact
 * about the athlete's calendar, not the coach's. Falls back to the raw string rather than
 * printing "Invalid Date", which is what `toLocaleString` does with a bad input.
 */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const bodyStyle = { margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary } as const;
const listStyle = { margin: 0, padding: 0, listStyle: "none" } as const;