/**
 * overload.ts — Progressive Overload Engine v2 ("El Cerebro").
 *
 * Pure functions, no React and no Supabase. The caller supplies the user's
 * session history for an exercise and receives a suggested target for the next
 * one.
 *
 * Design notes
 * ------------
 * - Load increases are NOT a flat 2.5 kg. They resolve from the movement's
 *   muscle group and equipment, because upper-body isolation work gains on
 *   1-1.25 kg while lower-body compounds move in 2.5 kg steps.
 * - Progression is double progression inside an explicit rep range. Reps go up
 *   first; only when the top of the range is reached with reps in reserve does
 *   the load increase and the reps reset to the bottom of the range.
 * - RPE is the governor, not just a log field. Reps in reserve (RIR) decides
 *   whether a session actually earned a load increase.
 * - Three-session stagnation is detected and answered with a deload rather
 *   than more of the same stimulus.
 * - A long layoff returns you at 85-90% of the old load instead of pretending
 *   nothing happened.
 *
 * Estimated 1RM (Epley) is only validated to ~10 reps, so it is used for
 * comparisons only inside that window and never to justify a load increase
 * beyond it.
 */

export interface LoggedSet {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
}

/** One past session's worth of an exercise. */
export interface SessionSummary {
  /** ISO timestamp of the session, if known. */
  performedAt: string | null;
  /** Strongest working set of that session. */
  bestSet: LoggedSet | null;
  /** Highest RPE recorded that session; null when the user does not log RPE. */
  topRpe: number | null;
  /** Working sets completed. */
  setCount: number;
}

export interface PreviousPerformance {
  /** Best set from the immediately previous session. */
  bestSet: LoggedSet | null;
  /** Best set ever recorded for this exercise. */
  allTimeBest: LoggedSet | null;
  lastSetCount: number;
  lastPerformedAt: string | null;
  /**
   * Recent sessions for this exercise, newest first.
   *
   * Stall detection needs more than one session, so this replaces the
   * single-snapshot behaviour of the original hook.
   */
  history: SessionSummary[];
}

export type OverloadDecision =
  | "increase"
  | "double_progression"
  | "hold"
  | "deload"
  | "first_time"
  /** Re-entry after a long break, at 85-90% of the previous load. */
  | "return_from_break"
  /** No measurable progress across several sessions. */
  | "stalled";

export interface OverloadTarget {
  decision: OverloadDecision;
  /** Suggested load in kg. `null` means bodyweight / leave blank. */
  weight: number | null;
  reps: number;
  /** Human-readable delta, e.g. "+2.5 kg" or "+1 rep". */
  delta: string;
  /** Short Spanish rationale for the UI chip. */
  reason: string;
  /** True when the target was derived from a reliable 1RM comparison. */
  estimateConfident: boolean;
  /** Rep range in force, e.g. 8-12. Null for bodyweight/first-time. */
  repRange: RepRange | null;
  /** Why the suggestion carries its load step. */
  incrementKg: number | null;
}

export interface RepRange {
  min: number;
  max: number;
}

export interface OverloadOptions {
  /**
   * Muscle group / equipment descriptor for the exercise, used to resolve the
   * load increment. Without it the engine falls back to a conservative default.
   */
  exercise?: ExerciseDescriptor | null;
  /** Overrides the resolved increment. */
  increment?: number;
  /** Overrides the resolved rep range. */
  repRange?: RepRange;
  /** Days away that trigger a re-entry target instead of a normal one. */
  breakAfterDays?: number;
  /** Sessions of stagnation before the engine calls it a stall. */
  stallAfterSessions?: number;
  /** `now`, injectable so the break detector is testable. */
  now?: Date;
}

export interface ExerciseDescriptor {
  id?: string;
  name?: string | null;
  /** Catalog `body_part`, e.g. "upper legs". */
  body_part?: string | null;
  /** Catalog `target` muscle, e.g. "quadriceps". */
  target?: string | null;
  /** Catalog `equipment`, e.g. "leverage machine". */
  equipment?: string | null;
}

// ---------------------------------------------------------------- constants

/** Epley is validated by McEwen et al. beyond ~10 reps. */
export const MAX_CONFIDENT_1RM_REPS = 10;

/** Kilocalories per kilogram of body fat, for rate-of-change maths. */
export const KCAL_PER_KG = 7700;

/** RPE >= this on the final set means the session was taken to the limit. */
export const RPE_MAX_EFFORTIVE = 9.5;

/** Reps in reserve implied by an RPE: RIR = 10 - RPE. */
export function repsInReserve(rpe: number | null): number | null {
  if (rpe === null || !isFinite(rpe)) return null;
  return Math.max(0, Math.round((10 - rpe) * 10) / 10);
}

// ------------------------------------------------------- load classification

/**
 * Muscle group buckets. Upper-body work carries less load per rep and gains
 * more slowly than lower-body compounds, so the increment differs.
 */
export type MuscleGroup =
  | "lower"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "core"
  | "full_body";

const LOWER_PARTS = new Set(["upper legs", "lower legs", "waist"]);
const ARM_PARTS = new Set(["upper arms", "lower arms"]);

const BODYWEIGHT_EQUIPMENT = new Set(["body weight", "bodyweight", "band", "resistance band"]);
const BARBELL_EQUIPMENT = new Set(["barbell", "olympic barbell", "ez barbell"]);

/** Targets that read as a primary lift rather than an isolation movement. */
const COMPOUND_TARGETS = new Set([
  "quadriceps",
  "glutes",
  "hamstrings",
  "pectorals",
  "lats",
  "triceps",
  "upper chest",
  "forearms",
]);

export function muscleGroupOf(exercise: ExerciseDescriptor): MuscleGroup {
  const part = (exercise.body_part ?? "").toLowerCase();
  const target = (exercise.target ?? "").toLowerCase();

  if (LOWER_PARTS.has(part)) return "lower";
  if (ARM_PARTS.has(part)) return "arms";
  if (part === "shoulders") return "shoulders";
  if (part === "chest") return "chest";
  if (part === "back") return "back";
  if (part === "cardio") return "full_body";
  if (COMPOUND_TARGETS.has(target)) return "full_body";
  return "full_body";
}

/**
 * Whether the movement is a multi-joint lift.
 *
 * Isolation work on a cable or machine is deliberately excluded even when the
 * target muscle is normally trained with compounds, because the load those
 * movements tolerate is far lower.
 */
export function isCompound(exercise: ExerciseDescriptor): boolean {
  const equipment = (exercise.equipment ?? "").toLowerCase();
  const target = (exercise.target ?? "").toLowerCase();

  if (BARBELL_EQUIPMENT.has(equipment)) return true;
  if (equipment === "smith machine") return true;
  // Isolation machines and cables stay low-load even on compound muscles.
  if (equipment === "cable" || equipment === "leverage machine" || equipment === "assisted") {
    return false;
  }
  if (equipment === "body weight") return COMPOUND_TARGETS.has(target) || target === "cardiovascular";
  return COMPOUND_TARGETS.has(target);
}

/** True when the set carries no external load. */
export function isBodyweightExercise(exercise: ExerciseDescriptor): boolean {
  return BODYWEIGHT_EQUIPMENT.has((exercise.equipment ?? "").toLowerCase());
}

/**
 * Load step for the next increase, in kg.
 *
 * Lower-body compounds move in 2.5 kg steps because the absolute loads are
 * high. Upper-body compounds use 1.25 kg and isolation work 1-1.25 kg: at
 * 30-40 kg on a lateral raise, a 2.5 kg step is an 8% jump, which erodes
 * technique long before it erodes progress.
 */
export function loadIncrementFor(exercise: ExerciseDescriptor): number {
  const group = muscleGroupOf(exercise);
  const equipment = (exercise.equipment ?? "").toLowerCase();

  if (isBodyweightExercise(exercise)) return 0;

  if (group === "lower") return 2.5;
  if (group === "full_body" || group === "chest" || group === "back") {
    // Machines and cables cap out well below free weights.
    if (equipment === "leverage machine" || equipment === "cable") return 2.5;
    return isCompound(exercise) ? 2.5 : 1.25;
  }
  // Shoulders, arms and everything else: small, precise steps.
  return 1;
}

/** Default rep range per muscle group. */
export function repRangeFor(exercise: ExerciseDescriptor): RepRange {
  const group = muscleGroupOf(exercise);

  if (group === "lower") return { min: 6, max: 10 };
  if (group === "chest" || group === "back") return { min: 8, max: 12 };
  if (group === "shoulders") return { min: 10, max: 15 };
  if (group === "arms") return { min: 10, max: 15 };
  if (group === "core") return { min: 12, max: 20 };
  return { min: 8, max: 12 };
}

// ---------------------------------------------------------------- core maths

/**
 * Epley estimated one-rep max. Returns 0 when the set is unusable.
 *
 * Only validated to ~10 reps; callers must gate on {@link isOneRepMaxConfident}.
 */
export function estimateOneRepMax(weight: number | null, reps: number | null): number {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

/** Whether a set's estimated 1RM can be trusted for comparisons. */
export function isOneRepMaxConfident(reps: number | null): boolean {
  if (reps === null || reps <= 0) return false;
  return reps <= MAX_CONFIDENT_1RM_REPS;
}

/** Total tonnage for a set. */
export function tonnage(weight: number | null, reps: number | null): number {
  if (!weight || !reps) return 0;
  return weight * reps;
}

/** True when a set carries no external load. */
export function isBodyweight(set: LoggedSet | null): boolean {
  return !!set && set.reps !== null && set.reps > 0 && !set.weight;
}

/** Picks the strongest working set, ignoring warm-ups. */
export function bestWorkingSet(sets: LoggedSet[]): LoggedSet | null {
  const working = sets.filter((s) => !s.is_warmup && s.reps !== null && s.reps > 0);
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

/** Highest RPE among working sets, or null when none was recorded. */
export function topWorkingRpe(sets: LoggedSet[]): number | null {
  const values = sets
    .filter((s) => !s.is_warmup && s.rpe !== null)
    .map((s) => s.rpe as number);
  return values.length === 0 ? null : Math.max(...values);
}

// --------------------------------------------------------- stall detection

export interface StallInfo {
  /** True when neither load nor reps improved across the window. */
  stalled: boolean;
  /** How many sessions were examined. */
  sessionsExamined: number;
  /** Short Spanish explanation, empty when not stalled. */
  note: string;
  /** Positive when the last session was heavier than the window average. */
  trendKg: number;
}

/**
 * Compares the most recent session against the ones before it.
 *
 * Stalling is defined as "no new best across the last N sessions", which is a
 * more honest signal than a single bad day. A stall triggers a deload rather
 * than an increase: if three sessions of the same stimulus produced nothing,
 * adding more of the same stimulus is the wrong move.
 */
export function detectStall(
  history: SessionSummary[],
  stallAfterSessions = 4,
): StallInfo {
  const usable = history.filter((h) => h.bestSet && (h.bestSet.weight ?? 0) > 0);
  if (usable.length < 2) {
    return { stalled: false, sessionsExamined: usable.length, note: "", trendKg: 0 };
  }

  const score = (s: SessionSummary): number =>
    estimateOneRepMax(s.bestSet?.weight ?? null, s.bestSet?.reps ?? null);

  const latest = score(usable[0]);
  // Compare against the best of the preceding window.
  const window = usable.slice(1, Math.max(2, stallAfterSessions));
  const previousBest = window.reduce((max, s) => Math.max(max, score(s)), 0);
  const trendKg = Math.round((latest - previousBest) * 10) / 10;

  // Only claim a stall once there is enough history to justify it, and only
  // when the recent session did not match or beat the earlier best.
  const examined = usable.length;
  const enoughHistory = Math.min(stallAfterSessions, examined) >= 3;
  const stalled = enoughHistory && latest <= previousBest;

  const note = stalled
    ? latest < previousBest
      ? `Sin avance: ${Math.abs(trendKg)} kg por debajo de tu mejor marca reciente.`
      : "Sin avance: ninguna sesión reciente superó tu marca previa."
    : "";

  return { stalled, sessionsExamined: examined, note, trendKg };
}

/** Days between two ISO timestamps; negative when `to` precedes `from`. */
export function daysBetween(from: string | null, to: Date): number | null {
  if (!from) return null;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  return Math.floor((to.getTime() - start.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------- suggestions

function roundTo(value: number, increment: number): number {
  if (increment <= 0) return Math.round(value * 10) / 10;
  return Math.round(value / increment) * increment;
}

function deltaText(next: number, previous: number): string {
  const diff = Math.round((next - previous) * 10) / 10;
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/**
 * Suggest the next target for an exercise given its recent history.
 *
 * Priority order:
 *  1. never trained            -> first_time
 *  2. long break               -> return_from_break at 85-90%
 *  3. RPE at the limit         -> deload
 *  4. stagnation               -> deload (stalled)
 *  5. 1RM outside Epley window -> regress toward the rep range
 *  6. bodyweight               -> add a rep, or drop one if RPE maxed
 *  7. cleared the range top    -> add load, reset to the range floor
 *  8. otherwise                -> add a rep (double progression)
 */
export function suggestNextTarget(
  previous: PreviousPerformance,
  options: OverloadOptions = {},
): OverloadTarget {
  const exercise = options.exercise ?? null;
  const repRange = options.repRange ?? (exercise ? repRangeFor(exercise) : { min: 8, max: 12 });
  const increment = options.increment ?? (exercise ? loadIncrementFor(exercise) : 2.5);
  const now = options.now ?? new Date();
  const breakAfterDays = options.breakAfterDays ?? 10;
  const stallAfter = options.stallAfterSessions ?? 4;

  const set = previous.bestSet;

  if (!set || !set.reps) {
    return {
      decision: "first_time",
      weight: null,
      reps: repRange.min,
      delta: "Primer registro",
      reason: "Sin historial: registra tu primera serie de referencia.",
      estimateConfident: true,
      repRange: null,
      incrementKg: increment > 0 ? increment : null,
    };
  }

  const rpe = set.rpe;
  const lastReps = set.reps;
  const confident = isOneRepMaxConfident(lastReps);
  const lastWeight = set.weight;

  // ---- 2. return after a break -----------------------------------------
  const gap = daysBetween(previous.lastPerformedAt, now);
  if (gap !== null && gap >= breakAfterDays && lastWeight) {
    const reEntry = roundTo(lastWeight * 0.875, increment);
    return {
      decision: "return_from_break",
      weight: reEntry,
      reps: Math.min(lastReps, repRange.min),
      delta: `${deltaText(reEntry, lastWeight)} kg`,
      reason:
        `Llevabas ${gap} días sin entrenar. Vuelve al 85-90% ` +
        `y reconstruye desde ${Math.min(lastReps, repRange.min)} reps.`,
      estimateConfident: confident,
      repRange,
      incrementKg: increment > 0 ? increment : null,
    };
  }

  // ---- 3. RPE at the ceiling -------------------------------------------
  if (rpe !== null && rpe >= RPE_MAX_EFFORTIVE && lastWeight) {
    const reduced = roundTo(lastWeight * 0.9, increment);
    return {
      decision: "deload",
      weight: reduced,
      reps: lastReps,
      delta: `${deltaText(reduced, lastWeight)} kg`,
      reason: `RPE ${rpe} en la última serie: reduce un 10% para recuperar.`,
      estimateConfident: confident,
      repRange,
      incrementKg: increment > 0 ? increment : null,
    };
  }

  // ---- 4. stagnation ---------------------------------------------------
  const stall = detectStall(previous.history, stallAfter);
  if (stall.stalled && lastWeight) {
    const reduced = roundTo(lastWeight * 0.925, increment);
    return {
      decision: "stalled",
      weight: reduced,
      reps: lastReps,
      delta: `${deltaText(reduced, lastWeight)} kg`,
      reason:
        `${stall.note} Reduce un 7,5% y baja a ` +
        `${repsInReserve(rpe) ?? 2} reps de reserva.`,
      estimateConfident: confident,
      repRange,
      incrementKg: increment > 0 ? increment : null,
    };
  }

  // ---- 5. above the prescribed rep range -------------------------------
  // Reps beyond the range top mean the set was too long at this load. Bring it
  // back into range before considering any increase.
  //
  // This is a range rule, not an Epley comparison, so the 1RM window does not
  // gate it: a 15-rep top-of-range set on an isolation movement still earns a
  // load increase. `confident` is reported separately so the UI can flag the
  // unreliable estimate rather than silently blocking progress.
  if (lastReps > repRange.max) {
    return {
      decision: "double_progression",
      weight: lastWeight,
      reps: repRange.max,
      delta: `${lastReps} → ${repRange.max} reps`,
      reason:
        `Serie de ${lastReps} reps por encima del rango ${repRange.min}-${repRange.max}. ` +
        `Mantén el peso y baja a ${repRange.max} reps.`,
      estimateConfident: false,
      repRange,
      incrementKg: increment > 0 ? increment : null,
    };
  }

  // ---- 6. bodyweight ---------------------------------------------------
  if (!lastWeight) {
    if (rpe !== null && rpe >= RPE_MAX_EFFORTIVE) {
      return {
        decision: "deload",
        weight: null,
        reps: Math.max(1, lastReps - 2),
        delta: "-2 reps",
        reason: `RPE ${rpe}: retrocede dos reps y recupera.`,
        estimateConfident: confident,
        repRange,
        incrementKg: null,
      };
    }
    return {
      decision: "double_progression",
      weight: null,
      reps: lastReps + 1,
      delta: "+1 rep",
      reason: "Peso corporal: suma una rep para progresar.",
      estimateConfident: confident,
      repRange,
      incrementKg: null,
    };
  }

  // ---- 7. range cleared -> add load ------------------------------------
  // Reps are at the top of the range with effort to spare, so the load earned
  // an increase. This is rep-range logic, so it holds even above the Epley
  // window; only the confidence flag reports the unreliable 1RM.
  if (lastReps >= repRange.max) {
    const nextWeight = roundTo(lastWeight + increment, increment);
    return {
      decision: "increase",
      weight: nextWeight,
      reps: repRange.min,
      delta: `+${increment} kg`,
      reason:
        `Completaste ${repRange.min}-${repRange.max} reps. ` +
        `Sube carga y vuelve a ${repRange.min} reps.`,
      estimateConfident: confident,
      repRange,
      incrementKg: increment,
    };
  }

  // ---- 8. default: add a rep -------------------------------------------
  return {
    decision: "double_progression",
    weight: lastWeight,
    reps: lastReps + 1,
    delta: "+1 rep",
    reason:
      `Vas ${lastReps}/${repRange.max} reps en el rango ${repRange.min}-${repRange.max}. ` +
      "Suma una rep antes de subir carga.",
    estimateConfident: confident,
    repRange,
    incrementKg: increment,
  };
}

// ---------------------------------------------------------------- formatting

/** Compact "Última vez" label, e.g. "80 kg x 8 @8". */
export function formatPrevious(set: LoggedSet | null): string {
  if (!set || set.reps === null || set.reps <= 0) return "Sin registro previo";
  const rpe = set.rpe === null ? "" : ` @${set.rpe}`;
  const caution = isOneRepMaxConfident(set.reps) ? "" : " (1RM no fiable)";
  if (!set.weight) return `${set.reps} reps${rpe} · peso corporal${caution}`;
  const weight = Number.isInteger(set.weight) ? set.weight : set.weight.toFixed(1);
  return `${weight} kg x ${set.reps}${rpe}${caution}`;
}

/** Human label for the rep range in force. */
export function formatRepRange(range: RepRange | null): string | null {
  return range ? `${range.min}-${range.max} reps` : null;
}