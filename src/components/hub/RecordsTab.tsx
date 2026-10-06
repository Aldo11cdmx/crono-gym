/**
 * RecordsTab.tsx — the four numbers this movement is judged by.
 *
 * Four tiles, then the strength standard. Not a chart: the progression tab has the shape of
 * the thing over time, and a second chart beside it would answer a question the athlete
 * just answered. These four are endpoints — what is the ceiling, and when did I get here.
 *
 * The records come from the history already in memory
 * ---------------------------------------------------
 * `ExerciseHub` has loaded every session for this exercise; four maxima over that array are
 * free, and deriving them here means this tab cannot disagree with the progression tab about
 * what the best set was. The `prs` row is used for exactly one thing — the date — because
 * `AthletePR` is the table that knows when a record was set, and `HISTORY_LIMIT` means the
 * loaded history is not guaranteed to contain it.
 *
 * `noRecord`, never zero
 * ----------------------
 * An athlete who has never done this exercise gets four "Sin marca" tiles, not four zeros.
 * A zero would be a false record: it says they lifted nothing, when the truth is they have
 * not lifted it at all, and the second one is fixable in ten minutes while the first one
 * follows them around forever.
 */

import { useMemo, type CSSProperties } from "react";
import { ExerciseRankBadge } from "./ExerciseRankBadge";
import { sessionLoad } from "@/lib/exercise/exerciseFatigue";
import type { ExerciseSession } from "@/lib/exercise/exerciseHistory";
import type { SessionMetrics } from "@/lib/exercise/exerciseMetrics";
import type { AthletePR } from "@/hooks/useAthletePRs";
import { useProfile } from "@/hooks/useProfile";
import { HUB_PROGRESS_LABELS, HUB_RECORDS_LABELS } from "@/lib/i18n";
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import type { SexKey } from "@/lib/ranks/rankConfig";
import type { Exercise } from "@/types/supabase";

export interface RecordsTabProps {
  exercise: Exercise;
  userId: string | null;
  sessions: readonly ExerciseSession[];
  metrics: readonly SessionMetrics[];
  pr: AthletePR | null;
  loading: boolean;
  unit: "kg" | "lb";
  convert: (kg: number) => number;
}

export function RecordsTab({
  exercise,
  userId,
  sessions,
  metrics,
  pr,
  loading,
  unit,
  convert,
}: RecordsTabProps) {
  const { profile } = useProfile(userId);

  const records = useMemo(() => findRecords(sessions, metrics, pr, convert), [
    sessions,
    metrics,
    pr,
    convert,
  ]);

  /*
   * Sex and bodyweight come from the profile the athlete filled in themselves, not from
   * `useMuscleRanks`.
   *
   * The ranks hook would also supply both, but reaching for it here would trigger a full
   * rank recomputation -- hundreds of logged sets -- to read two columns out of `profiles`.
   * A null sex resolves to `other`, which `standardRatioFor` maps to the midpoint table and
   * the badge then flags as uncalibrated; defaulting to `male` would rate every athlete
   * without a declared sex as under-strength, which is the outcome the midpoint exists to
   * prevent.
   */
  const sex: SexKey = profile?.sex ?? "other";
  const bodyweightKg = profile?.weight_kg ?? null;

  return (
    <div style={column}>
      <div
        role="group"
        aria-label={HUB_RECORDS_LABELS.gridAriaLabel(exercise.name)}
        style={grid}
      >
        <Tile
          label={HUB_RECORDS_LABELS.maxWeight}
          value={records.maxWeight}
          unit={unit}
          hint={records.maxWeightAt}
        />
        <Tile
          label={HUB_RECORDS_LABELS.estimate}
          value={records.bestEstimate}
          unit={unit}
        />
        <Tile label={HUB_RECORDS_LABELS.maxReps} value={records.maxReps} unit={null} />
        <Tile
          label={HUB_RECORDS_LABELS.sessionVolume}
          value={records.bestSessionVolume}
          unit={HUB_PROGRESS_LABELS.unitVolume}
        />
      </div>

      {loading ? null : (
        <ExerciseRankBadge
          target={exercise.target}
          estimateKg={records.bestEstimateKg}
          bodyweightKg={bodyweightKg}
          sex={sex}
        />
      )}
    </div>
  );
}

/** One tile's value, already in the display unit, or null when never reached. */
interface FoundRecord {
  maxWeight: string | null;
  bestEstimate: string | null;
  maxReps: string | null;
  bestSessionVolume: string | null;
  /** The same best estimate in kg, for the standard's denominator. */
  bestEstimateKg: number | null;
  /** ISO date of the heaviest set, for the caption under it. */
  maxWeightAt: string | null;
}

function findRecords(
  sessions: readonly ExerciseSession[],
  metrics: readonly SessionMetrics[],
  pr: AthletePR | null,
  convert: (kg: number) => number,
): FoundRecord {
  let maxWeightKg: number | null = null;
  let maxWeightAt: string | null = null;
  let maxReps: number | null = null;
  let bestSessionVolume = 0;

  for (const [index, session] of sessions.entries()) {
    // Zip by index rather than re-deriving: `useExerciseHubData` already aligned these two
    // arrays, and a second zip is a second chance to put one session's number on another's
    // date.
    const top = metrics[index]?.topWeightKg ?? null;
    if (top !== null && (maxWeightKg === null || top > maxWeightKg)) {
      maxWeightKg = top;
      maxWeightAt = session.startedAt;
    }

    for (const set of session.sets) {
      // Single-set reps, not `totalReps`. `totalReps` sums the session, so it grows with
      // the number of sets and would report "máx. repeticiones: 45" for three sets of 15,
      // which is not a repetition record in any sense a lifter would recognise.
      if (set.reps !== null && (maxReps === null || set.reps > maxReps)) maxReps = set.reps;
    }

    bestSessionVolume = Math.max(
      bestSessionVolume,
      sessionLoad(session.logId, session.startedAt, session.sets, 0).volumeKgReps,
    );
  }

  /*
   * `prs` wins over the scan, and this is not a formality.
   *
   * `loadExerciseHistory` is capped at `HISTORY_LIMIT` sessions, so the set that set the
   * record can be outside the window entirely. Taking the max of the two is the only way
   * the tile is right for an athlete with a long history, and `pr.achievedAt` is the only
   * place the date of a record the scan never saw is recorded.
   */
  if (pr && (maxWeightKg === null || pr.weightKg > maxWeightKg)) {
    maxWeightKg = pr.weightKg;
    maxWeightAt = pr.achievedAt;
  }

  const bestEstimateKg = maxNumber(metrics.map((row) => row.bestEstimateKg));

  return {
    maxWeight: maxWeightKg === null ? null : String(round(convert(maxWeightKg))),
    bestEstimate: bestEstimateKg === null ? null : String(round(convert(bestEstimateKg))),
    maxReps: maxReps === null ? null : String(maxReps),
    // Volume is a load, so it converts like one. The raw figure would be kg on a screen
    // that says lb everywhere else, which is worse than not converting at all.
    bestSessionVolume: bestSessionVolume > 0 ? String(round(convert(bestSessionVolume))) : null,
    bestEstimateKg,
    maxWeightAt: maxWeightAt ? maxWeightAt.slice(0, 10) : null,
  };
}

function Tile({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string | null;
  unit: string | null;
  hint?: string | null;
}) {
  return (
    <div style={tile}>
      <span style={tileLabel}>{label}</span>
      {value === null ? (
        // Kept as its own span rather than a dimmed zero so the difference between "no
        // record" and "a record of nothing" survives into the accessibility tree.
        <span style={tileEmpty}>{HUB_RECORDS_LABELS.noRecord}</span>
      ) : (
        <span style={tileValue}>
          {value}
          {unit ? <span style={tileUnit}> {unit}</span> : null}
        </span>
      )}
      {value !== null && hint ? <span style={tileHint}>{hint}</span> : null}
    </div>
  );
}

function maxNumber(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? Math.max(...present) : null;
}

/** One decimal at most, and never a trailing `.0` -- `80.0 kg` reads as a measurement. */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

const column: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
};

const grid: CSSProperties = {
  display: "grid",
  // Two columns at any width: four tiles in one row at 360px would leave each one 80px
  // wide, which is narrower than "Peso máximo" can be set at a readable size.
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: SPACE.sm,
};

const tile: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: SPACE.md,
  borderRadius: RADIUS.card,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
};

const tileLabel: CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.disabled,
};

const tileValue: CSSProperties = {
  fontFamily: TYPE.mono.font,
  fontSize: TYPE.title2.size,
  fontWeight: TYPE.mono.weight,
  lineHeight: 1.15,
  color: TEXT.primary,
};

const tileUnit: CSSProperties = {
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.body.weight,
  color: TEXT.tertiary,
};

const tileEmpty: CSSProperties = {
  fontSize: TYPE.subhead.size,
  color: TEXT.disabled,
  fontStyle: "italic",
};

const tileHint: CSSProperties = {
  fontSize: TYPE.label.size,
  color: TEXT.disabled,
};