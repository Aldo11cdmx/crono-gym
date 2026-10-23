/**
 * exercise/exerciseMetrics.ts — the numbers the hub shows, as pure functions.
 *
 * Nothing here reads Supabase, the clock or `localStorage`. Everything is a function of
 * the rows `exerciseHistory` fetched, which is what makes the four modules in this
 * directory testable by feeding them a literal array and asserting a number -- and what
 * makes them safe to reuse from a future screen that has the data for some other reason.
 *
 * The unit problem, and why it runs through the whole module
 * ---------------------------------------------------------
 * The app speaks two unit systems: `GymSettingsContext` carries one, and an athlete can
 * switch between kg and lb without their history changing meaning. So no metric is
 * expressed in "the weight the athlete typed".
 *
 * `estimateOneRepMax` returns kg regardless of what the rows carry, because the
 * coefficient it uses (the Epley form) is defined against kilograms. Running it on pounds
 * produces a number that is wrong by a factor of 2.2 while looking perfectly plausible,
 * and the caller has no way to tell. `EXERCISE_METRICS.LB_PER_KG` is the single conversion
 * point; converting anywhere else is how two panels on the same screen end up disagreeing.
 */

import type { ExerciseSetRecord } from "./exerciseHistory";

/**
 * Constants the hub needs, with the reasoning attached.
 *
 * A named group rather than exported literals, because a bare `1.1` in a screen is
 * unreviewable: nobody can tell by looking whether it is a coefficient, a threshold or a
 * rounding rule.
 */
export const EXERCISE_METRICS = {
  /**
   * Pounds per kilogram, `exact`: 2.2046226218.
   *
   * The extra digits are not decoration. `2.2` accumulates a visible error across a year
   * of bodyweight readings -- roughly 0.9 kg of drift by 100 kg -- and the value is used
   * for both directions, so the error does not cancel.
   */
  LB_PER_KG: 2.2046226218,

  /**
   * The Epley one-rep-max estimate: `weight * (1 + reps / 30)`.
   *
   * Epley rather than Brzycki (`weight * 36 / (37 - reps)`) because Brzycki diverges as
   * `reps` approaches 37 and returns a *negative* estimate past it. A set of 40 reps --
   * entirely possible for a bodyweight move or a banded one -- would produce a negative
   * max, which then renders as a progress bar going backwards. Epley stays positive and
   * monotonic for every input.
   *
   * It is an estimate and is labelled as one everywhere it is shown. It is only valid
   * below about ten reps; `estimateOneRepMax` refuses beyond that rather than reporting a
   * number that cannot mean anything.
   */
  EPLEY_DIVISOR: 30,

  /**
   * The heaviest rep Epley is trusted at.
   *
   * Ten. Past it the relationship between reps and max is dominated by how many sets the
   * athlete did rather than by their strength, so the estimate stops being about the
   * athlete and starts being about the set. Refusing is the honest answer, and it keeps
   * the PR list from listing a 25-rep set as a personal best.
   */
  MAX_ESTIMATABLE_REPS: 10,

  /**
   * Sets a PR is "earned" over.
   *
   * The best set of the most recent session is not a trend. Three sessions is the smallest
   * window where "did this go up" is a question with an answer rather than noise, and it
   * is the number `exercisePlateau` also reasons from.
   */
  TREND_WINDOW: 3,
} as const;

/**
 * The estimated one-rep max for one set, in kilograms.
 *
 * Returns `null` rather than a number when the estimate would be meaningless: no weight,
 * no reps, a non-positive weight, or more reps than {@link EXERCISE_METRICS.MAX_ESTIMATABLE_REPS}.
 *
 * `null` rather than `0` because zero is a claim -- it would win a comparison against a
 * real estimate and render as progress going to nothing. "No estimate" and "estimated
 * nothing" have to be the same value here, and they are: there is no estimate.
 */
export function estimateOneRepMax(
  weightKg: number,
  reps: number,
): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isFinite(reps) || reps <= 0) return null;
  if (reps > EXERCISE_METRICS.MAX_ESTIMATABLE_REPS) return null;

  return weightKg * (1 + reps / EXERCISE_METRICS.EPLEY_DIVISOR);
}

/**
 * Converts one weight between the two systems this app supports.
 *
 * One conversion point for the reason above: an Epley coefficient is defined against kg,
 * so anything derived from a max has to be in kg before it is converted, never after.
 */
export function toDisplayWeight(
  weightKg: number,
  unit: "kg" | "lb",
): number {
  return unit === "lb"
    ? weightKg * EXERCISE_METRICS.LB_PER_KG
    : weightKg;
}

/** Converts a display weight back to kg. Used when a limit is written in the athlete's unit. */
export function toKilograms(weight: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? weight / EXERCISE_METRICS.LB_PER_KG : weight;
}

/** One session's worth of derived numbers. */
export interface SessionMetrics {
  logId: string;
  startedAt: string;
  /** Sets in this session. */
  setCount: number;
  /** Heaviest working set in the session, in kg. */
  topWeightKg: number | null;
  /** Total reps across the session. Sets with no reps contribute nothing. */
  totalReps: number;
  /** Best estimated 1RM in the session, in kg. `null` if nothing was estimable. */
  bestEstimateKg: number | null;
  /** Mean estimated 1RM, in kg. Null when nothing was estimable. */
  averageEstimateKg: number | null;
  /** Mean RPE, or null when no set recorded one. */
  averageRpe: number | null;
}

/**
 * Reduces one session's sets to the numbers a session row shows.
 *
 * Averages are over the sets that *have* the value, not over all of them. Averaging RPE
 * across a session where two of five sets recorded it must be the mean of those two, not
 * that mean diluted by three nulls -- an athlete who logs RPE on their hard sets would
 * otherwise see their effort read as lower than they reported, every time.
 */
export function sessionMetrics(
  logId: string,
  startedAt: string,
  sets: readonly ExerciseSetRecord[],
): SessionMetrics {
  const weights = sets
    .map((set) => set.weight)
    .filter((weight): weight is number => weight !== null && weight > 0);

  const estimates = sets
    .map((set) => estimateOneRepMax(set.weight ?? 0, set.reps ?? 0))
    .filter((estimate): estimate is number => estimate !== null);

  const rpes = sets
    .map((set) => set.rpe)
    .filter((rpe): rpe is number => rpe !== null && rpe > 0);

  return {
    logId,
    startedAt,
    setCount: sets.length,
    topWeightKg: weights.length > 0 ? Math.max(...weights) : null,
    totalReps: sets.reduce((total, set) => total + (set.reps ?? 0), 0),
    bestEstimateKg: estimates.length > 0 ? Math.max(...estimates) : null,
    averageEstimateKg: mean(estimates),
    averageRpe: mean(rpes),
  };
}

/** Mean over the values present, or null when there are none. */
function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

/**
 * The heaviest estimated 1RM across the whole history, and the session it came from.
 *
 * Grouped by session before taking the max, rather than taking the max over every set:
 * the max over every set *is* the max over sessions, so this is not about correctness so
 * much as about the answer being reportable. "Your best squat was 140kg on 7 March" is a
 * sentence an athlete can act on; "your best squat was the fourth set of your third
 * session" is not.
 */
export interface PersonalRecord {
  estimateKg: number;
  weightKg: number;
  reps: number;
  logId: string;
  startedAt: string;
  setId: string;
}

export function personalRecord(
  sessions: readonly { logId: string; startedAt: string; sets: readonly ExerciseSetRecord[] }[],
): PersonalRecord | null {
  let best: PersonalRecord | null = null;

  for (const session of sessions) {
    for (const set of session.sets) {
      const estimateKg = estimateOneRepMax(set.weight ?? 0, set.reps ?? 0);
      if (estimateKg === null) continue;

      /*
       * Ties go to the *earlier* session, compared by date rather than by iteration order.
       *
       * Repeating a session exactly is common, and then the useful sentence is "you have
       * held this since March" rather than "since March, if you happen to sort by a
       * timestamp with millisecond precision". The comparison is written as an explicit
       * date check instead of `>=` because `>=` would only produce that answer by accident:
       * it would depend on the caller having sorted newest-first, and would silently start
       * reporting the opposite the day someone sorted the other way.
       */
      const isEarlierTie =
        best !== null && estimateKg === best.estimateKg
          && Date.parse(session.startedAt) < Date.parse(best.startedAt);

      if (best === null || estimateKg > best.estimateKg || isEarlierTie) {
        best = {
          estimateKg,
          weightKg: set.weight as number,
          reps: set.reps as number,
          logId: session.logId,
          startedAt: session.startedAt,
          setId: set.id,
        };
      }
    }
  }

  return best;
}

/**
 * Whether the recent sessions are going up, and by how much.
 *
 * Compares the mean of the most recent {@link EXERCISE_METRICS.TREND_WINDOW} sessions
 * against the mean of the three before them, both of estimated 1RM. Two windows rather
 * than "last session vs the one before", because a single session is dominated by how the
 * day went -- sleep, the meal before, whether it was a good day -- and reporting that as a
 * trend is how a progress bar ends up going backwards every other week.
 *
 * `null` when there are not enough sessions to compare, which is a different answer from
 * zero and must not be collapsed into it: "not enough data" and "not going up" are what
 * the screen says, in different words.
 */
export interface Trend {
  /** kg of estimated 1RM per session, across the two windows. */
  kgPerSession: number;
  direction: "up" | "down" | "flat";
  /** Sessions that went into the comparison. */
  sampleSize: number;
}

/**
 * The dead band, in kg of estimated 1RM.
 *
 * Below this a change is noise, not progress. 1kg is roughly a 1% change on a working
 * weight, which is under what a day-to-day estimate of the same lift varies by. Without
 * it the trend label flickers on rounding alone.
 */
export const TREND_DEAD_BAND_KG = 1;

export function estimateTrend(
  sessions: readonly { startedAt: string; sets: readonly ExerciseSetRecord[] }[],
): Trend | null {
  const window = EXERCISE_METRICS.TREND_WINDOW;
  // Newest first, as `groupBySession` returns them.
  const perSession = sessions
    .map((session) => ({
      startedAt: session.startedAt,
      estimate: sessionMetrics("", session.startedAt, session.sets).averageEstimateKg,
    }))
    .filter((entry): entry is { startedAt: string; estimate: number } => entry.estimate !== null);

  if (perSession.length < window * 2) return null;

  const recent = perSession.slice(0, window);
  const previous = perSession.slice(window, window * 2);

  const recentMean = mean(recent.map((entry) => entry.estimate)) as number;
  const previousMean = mean(previous.map((entry) => entry.estimate)) as number;
  const kgPerSession = (recentMean - previousMean) / window;

  return {
    kgPerSession,
    direction:
      Math.abs(kgPerSession) < TREND_DEAD_BAND_KG
        ? "flat"
        : kgPerSession > 0
          ? "up"
          : "down",
    sampleSize: perSession.length,
  };
}
