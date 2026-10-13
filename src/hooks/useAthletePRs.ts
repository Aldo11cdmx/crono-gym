/**
 * useAthletePRs.ts — the athlete's best set per exercise, and when they set it.
 *
 * The only new read in the portal, and deliberately a plain `select` plus a reduction in
 * JavaScript rather than an aggregate in SQL. The shape wanted -- "the heaviest set per
 * exercise, with the date it was achieved" -- is a `group by` over a join, which in
 * Postgres means either a view or an RPC, and both of those are schema objects this repo
 * would then have to migrate, grant and keep in step with the app's types. A few thousand
 * rows reduced in memory costs one round trip and no new database surface.
 *
 * **It does not reuse `AssistantContext.recentPRs`, and that is the point.**
 * `src/lib/ai/types.ts:223-236` builds that list from `muscle.topExercises[].bestSet`, which
 * only looks at the three strongest exercises per muscle and is gated on
 * `ELIGIBILITY.minSessions` and on a known bodyweight. A coach would therefore not see a
 * genuine record because the athlete has not entered their weight, or because the lift is
 * their fourth-strongest in its muscle. A PR section that is silently incomplete is worse
 * than no section: the coach reads the absence as "nothing to show here".
 *
 * **Warm-up sets are excluded.** A 60 kg bar-speed warm-up on a 100 kg day is not a record,
 * and including warm-ups would let the heaviest row per exercise be the one the athlete
 * never counted.
 *
 * **The date is the *first* time the current maximum was reached**, not the most recent.
 * "Logrado" means when the record was set; a coach reading "logrado en marzo" next to an
 * athlete who has since matched it in September is being told the truth about when it
 * happened. The alternative -- reporting the latest repetition of the same weight -- reads
 * as progress that was never made.
 *
 * **The window is bounded and the bound is stated.** Rows are ordered newest-first and cut
 * at {@link MAX_SETS}. A record older than the athlete's most recent
 * {@link MAX_SETS} sets is not shown. That is a real limit rather than a theoretical one,
 * so it is a named constant with a comment instead of a `.limit(2000)` nobody reconsiders.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@lib/supabase";
import { sanitizeIds } from "@lib/supabaseUtils";
import type { Exercise } from "@/types/supabase";

/**
 * How many completed sets are reduced.
 *
 * 2,000 covers an athlete training four days a week for roughly two months of working
 * sets. Past that the oldest records start falling off the bottom, which for a PR list means
 * the records stop being complete rather than getting less accurate -- so the number is
 * generous on purpose.
 */
export const MAX_SETS = 2000;

export interface AthletePR {
  exerciseId: string;
  /** Resolved from the catalog; falls back to {@link AthletePR.exerciseId} when unknown. */
  exerciseName: string;
  weightKg: number;
  /** Reps on the set that set the record. Null when the athlete logged none. */
  reps: number | null;
  /** ISO date of the earliest set that reached {@link AthletePR.weightKg}. */
  achievedAt: string;
}

export interface AthletePRsState {
  prs: AthletePR[];
  loading: boolean;
  error: string | null;
}

/** One row of the joined read, before the reduction. Exported for {@link reduceToRecords}'s tests. */
export interface SetRow {
  exercise_id: string;
  weight: number | null;
  reps: number | null;
  workout_logs: { started_at: string } | { started_at: string }[] | null;
}

/**
 * The heaviest set per exercise for one athlete.
 *
 * Takes a `userId` and not an athlete id of its own: the reads below are qualified by
 * `workout_logs.user_id`, which is the same column the coach SELECT policies from
 * `20261003030000_coach_portal.sql` check. Passing anything else -- a client's own notion of
 * which athlete is selected -- would make the filter and the policy disagree, and the
 * policy is the one that has to win.
 */
export function useAthletePRs(userId: string | null): AthletePRsState {
  const [prs, setPrs] = useState<AthletePR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Guards a state write after unmount.
   *
   * Reachable in normal use: the CRM follows a selection the coach can change mid-request,
   * and one athlete's records resolving after another was picked would be written into the
   * wrong panel.
   */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setPrs([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: readError } = await supabase
      .from("completed_sets")
      // `!inner` so the join filters rather than embeds: without it the `.eq` below would
      // be a post-join predicate and could not remove the parent rows it does not match.
      .select("exercise_id,weight,reps,workout_logs!inner(started_at)")
      .eq("workout_logs.user_id", userId)
      .eq("is_warmup", false)
      .not("weight", "is", null)
      .order("started_at", { referencedTable: "workout_logs", ascending: false })
      .limit(MAX_SETS);

    if (!mounted.current) return;

    if (readError) {
      setPrs([]);
      setError(readError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as SetRow[];

    /*
     * Names in a second read, for the same reason `RequestQueue` reads `profiles` twice:
     * `completed_sets` carries only the exercise id, and a list of uuids is a PR list a
     * coach cannot read.
     *
     * Not a separate query per exercise, and not a PostgREST embed through
     * `exercises` either: one `in()` over the distinct ids keeps it to two round trips
     * whatever the athlete's catalog coverage looks like.
     */
    const exerciseIds = sanitizeIds([...new Set(rows.map((row) => row.exercise_id))]);
    const names = new Map<string, string>();

    if (exerciseIds.length > 0) {
      try {
        const { data: catalog } = await supabase
          .from("exercises")
          .select("id,name")
          .in("id", exerciseIds);

        if (!mounted.current) return;

        for (const exercise of (catalog ?? []) as Pick<Exercise, "id" | "name">[]) {
          if (exercise.name) names.set(exercise.id, exercise.name);
        }
      } catch {
        if (!mounted.current) return;
      }
    }

    if (!mounted.current) return;

    setPrs(reduceToRecords(rows, names));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { prs, loading, error };
}

/**
 * The heaviest set per exercise, with the earliest date it was reached.
 *
 * Exported for its own tests rather than reached through the hook: the reduction is where
 * the two judgement calls live -- tie-breaking on equal weight, and which date survives -- and
 * testing them through a hook would mean a database mock standing in for arithmetic.
 */
export function reduceToRecords(
  rows: SetRow[],
  names: Map<string, string>,
): AthletePR[] {
  const best = new Map<string, AthletePR>();

  for (const row of rows) {
    const weight = row.weight;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) continue;

    const startedAt = readStartedAt(row);
    // A set with no resolvable date still counts as a record; it just cannot be dated.
    const achievedAt = startedAt ?? "";

    const current = best.get(row.exercise_id);
    if (!current) {
      best.set(row.exercise_id, {
        exerciseId: row.exercise_id,
        exerciseName: names.get(row.exercise_id) ?? row.exercise_id,
        weightKg: weight,
        reps: typeof row.reps === "number" ? row.reps : null,
        achievedAt,
      });
      continue;
    }

    if (weight > current.weightKg) {
      // A new maximum resets the date: the old one belonged to the old record.
      current.weightKg = weight;
      current.reps = typeof row.reps === "number" ? row.reps : null;
      current.achievedAt = achievedAt;
      continue;
    }

    if (weight === current.weightKg && current.achievedAt !== "" && achievedAt < current.achievedAt) {
      // Same weight, earlier date: the record was set earlier than we thought. Rows arrive
      // newest-first, so without this the first one seen would always win.
      current.achievedAt = achievedAt;
      if (typeof row.reps === "number") current.reps = row.reps;
    }
  }

  /*
   * Newest record first.
   *
   * By date rather than by weight because the section is headed "Logrado": a coach opening
   * an athlete wants what they have been lifting lately, and can sort a list of weights by
   * eye. Undated records sort last rather than first, so an empty date never outranks a real
   * one.
   */
  return [...best.values()].sort((a, b) => {
    if (a.achievedAt === "") return 1;
    if (b.achievedAt === "") return -1;
    return b.achievedAt.localeCompare(a.achievedAt);
  });
}

/**
 * `workout_logs.started_at` from an embedded relation.
 *
 * Typed as a union because PostgREST returns a single object for a `!inner` embed but the
 * generated type cannot know that, and an array here would be silently iterated into
 * `undefined`. Both shapes are accepted; anything else yields null rather than throwing.
 */
function readStartedAt(row: SetRow): string | null {
  const embedded = row.workout_logs;
  if (Array.isArray(embedded)) return embedded[0]?.started_at ?? null;
  return embedded?.started_at ?? null;
}