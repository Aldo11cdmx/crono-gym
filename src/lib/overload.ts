/**
 * overload.ts — Progressive Overload Engine ("El Cerebro").
 *
 * Pure functions, no React and no Supabase, so they can be unit-tested and
 * reused from any view. The caller supplies the user's previous performance
 * for an exercise and receives a suggested target for the next one.
 *
 * Comparison uses an estimated 1RM (Epley) rather than raw load, so adding a
 * rep at a lighter weight is correctly recognised as progress even though the
 * bar weight went down.
 */

export interface LoggedSet {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
}

export interface PreviousPerformance {
  /** Best set from the previous session, by estimated 1RM (or reps if bodyweight). */
  bestSet: LoggedSet | null;
  /** Best set ever recorded for this exercise. */
  allTimeBest: LoggedSet | null;
  /** How many working sets were completed last time. */
  lastSetCount: number;
  /** ISO date of the last session, if known. */
  lastPerformedAt: string | null;
}

export type OverloadDecision =
  | "increase"
  | "double_progression"
  | "hold"
  | "deload"
  | "first_time";

export interface OverloadTarget {
  decision: OverloadDecision;
  /** Suggested load in kg. `null` means bodyweight / leave blank. */
  weight: number | null;
  reps: number;
  /** Human-readable delta, e.g. "+2.5 kg" or "+1 rep". */
  delta: string;
  /** Short Spanish rationale for the UI chip. */
  reason: string;
}

export interface OverloadOptions {
  /** Reps we aim to hit before adding load. */
  targetReps?: number;
  /** Smallest plate increment the gym's machines accept. */
  increment?: number;
}

/** Epley estimated one-rep max. Returns 0 when the set is unusable. */
export function estimateOneRepMax(weight: number | null, reps: number | null): number {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

/** Total tonnage for a set; the practical driver of hypertrophy progress. */
export function tonnage(weight: number | null, reps: number | null): number {
  if (!weight || !reps) return 0;
  return weight * reps;
}

/** True when a set carries no external load (push-ups, dips, planks). */
export function isBodyweight(set: LoggedSet | null): boolean {
  return !!set && set.reps !== null && set.reps > 0 && !set.weight;
}

/**
 * Picks the strongest working set.
 *
 * Loaded sets are ranked by estimated 1RM. Bodyweight sets cannot use 1RM, so
 * when a session contains no loaded work we rank purely on reps.
 */
export function bestWorkingSet(sets: LoggedSet[]): LoggedSet | null {
  const working = sets.filter(
    (s) => !s.is_warmup && s.reps !== null && s.reps > 0,
  );
  if (working.length === 0) return null;

  const loaded = working.filter((s) => s.weight !== null && s.weight > 0);
  if (loaded.length === 0) {
    return working.reduce((best, set) =>
      (set.reps as number) > (best.reps as number) ? set : best,
    );
  }
  return loaded.reduce((best, set) =>
    estimateOneRepMax(set.weight, set.reps) >=
    estimateOneRepMax(best.weight, best.reps)
      ? set
      : best,
  );
}

function roundTo(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

/**
 * Suggest the next target for an exercise given how the user performed last.
 *
 * Rules, in priority order:
 *  - never trained before -> first_time, leave the load blank
 *  - bodyweight (no load)  -> add a rep; drop a rep if the RPE was maxed
 *  - RPE >= 9.5            -> deload 10% to protect the joint/tissue
 *  - reps cleared the target -> add one plate increment
 *  - reps one short of the target -> add a rep (double progression)
 *  - otherwise -> hold the load and add a rep
 */
export function suggestNextTarget(
  previous: PreviousPerformance,
  options: OverloadOptions = {},
): OverloadTarget {
  const { targetReps = 8, increment = 2.5 } = options;
  const set = previous.bestSet;

  if (!set || !set.reps) {
    return {
      decision: "first_time",
      weight: null,
      reps: targetReps,
      delta: "Primer registro",
      reason: "Sin historial: registra tu primera serie de referencia.",
    };
  }

  const rpe = set.rpe;
  const lastReps = set.reps;

  // Bodyweight: there is no load to add, so progress by reps.
  if (!set.weight) {
    if (rpe !== null && rpe >= 9.5) {
      return {
        decision: "deload",
        weight: null,
        reps: Math.max(1, lastReps - 1),
        delta: "-1 rep",
        reason: `RPE ${rpe} el último: baja una rep para recuperar.`,
      };
    }
    return {
      decision: "double_progression",
      weight: null,
      reps: lastReps + 1,
      delta: "+1 rep",
      reason: "Peso corporal: suma una rep para progresar.",
    };
  }

  const lastWeight = set.weight;

  if (rpe !== null && rpe >= 9.5) {
    const reduced = roundTo(lastWeight * 0.9, increment);
    return {
      decision: "deload",
      weight: reduced,
      reps: lastReps,
      delta: `${deltaText(reduced, lastWeight)} kg`,
      reason: `RPE ${rpe} el último: reduce la carga para recuperar.`,
    };
  }

  if (lastReps >= targetReps) {
    const nextWeight = roundTo(lastWeight + increment, increment);
    return {
      decision: "increase",
      weight: nextWeight,
      reps: lastReps,
      delta: `+${increment} kg`,
      reason: `Superaste ${targetReps} reps: sube carga de forma progresiva.`,
    };
  }

  if (lastReps >= targetReps - 1) {
    return {
      decision: "double_progression",
      weight: lastWeight,
      reps: lastReps + 1,
      delta: "+1 rep",
      reason: "Casi en el objetivo: una rep más antes de subir carga.",
    };
  }

  return {
    decision: "hold",
    weight: lastWeight,
    reps: lastReps + 1,
    delta: "Mismo peso",
    reason: "Repite el peso y suma una rep para consolidar.",
  };
}

function deltaText(next: number, previous: number): string {
  const diff = Math.round((next - previous) * 10) / 10;
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/** Compact "Última vez" label, e.g. "80 kg x 8 @8". */
export function formatPrevious(set: LoggedSet | null): string {
  if (!set || set.reps === null || set.reps <= 0) return "Sin registro previo";
  const rpe = set.rpe === null ? "" : ` @${set.rpe}`;
  if (!set.weight) return `${set.reps} reps${rpe} · peso corporal`;
  const weight = Number.isInteger(set.weight) ? set.weight : set.weight.toFixed(1);
  return `${weight} kg x ${set.reps}${rpe}`;
}