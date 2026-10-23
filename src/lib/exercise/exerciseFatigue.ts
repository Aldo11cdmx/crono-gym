/**
 * exercise/exerciseFatigue.ts — what the training is costing, and what it is buying.
 *
 * Two quantities, deliberately kept apart:
 *
 *   - **Volume**, `sum(weight * reps)`. The mechanical work. It is a number the athlete
 *     already understands from the app and it is the thing most programs prescribe on.
 *   - **Intensity**, the estimated 1RM relative to the athlete's own best. Not a
 *     percentage of a formula, because the only defensible denominator is the athlete's
 *     own current max, and an intensity computed against a formula's assumed max is a
 *     number that goes up and down as the formula is revised.
 *
 * Volume and intensity are the two axes of the same trade, and the useful output is the
 * pair rather than either alone: a session can be high-volume and low-intensity (a long
 * pump session) or the reverse (three heavy singles), and a hub that showed only one of
 * them would describe half of what happened.
 *
 * Nothing here claims to be a readiness score or predicts injury. It describes what was
 * logged. Anything stronger would need data this app does not have -- sleep, soreness, a
 * resting heart rate -- and a confident number built from three of five inputs is worse
 * than no number, because the athlete acts on it.
 */

import type { ExerciseSetRecord } from "./exerciseHistory";
import {
  EXERCISE_METRICS,
  estimateOneRepMax,
} from "./exerciseMetrics";

export const FATIGUE_RULES = {
  /**
   * Intensity bands, as a fraction of the athlete's own best estimated 1RM.
   *
   * The thresholds are the conventional ones and are named rather than inlined because a
   * screen will show the band name, so the number and the word have to move together.
   */
  BANDS: {
    /** At or above 90% of best. Three to five reps in reserve. */
    heavy: 0.9,
    /** 75% to 90%. Roughly eight to twelve. */
    moderate: 0.75,
  },

  /**
   * The rolling window, in sessions, that `fatigueTrend` compares.
   *
   * Four. Long enough that one hard session does not move it, short enough that a genuine
   * change is visible before a training block ends.
   */
  WINDOW: 4,

  /**
   * Percentage change in weekly volume that counts as a real change.
   *
   * Ten. Below that, day-to-day variation in how many sets someone finishes is larger than
   * the change being measured.
   */
  DEAD_BAND_PERCENT: 10,
} as const;

export type IntensityBand = "heavy" | "moderate" | "light";

/** One session's volume and intensity. */
export interface SessionLoad {
  logId: string;
  startedAt: string;
  /** `sum(weight * reps)` over the session's sets, in kg·reps. */
  volumeKgReps: number;
  /** Best estimated 1RM in the session, kg. Null when nothing was estimable. */
  bestEstimateKg: number | null;
  /** That best as a fraction of the athlete's all-time best for this exercise. */
  intensity: number | null;
  band: IntensityBand | null;
}

/**
 * One session's load, against the athlete's best.
 *
 * `bestEverKg` is passed in rather than recomputed, because the caller has the whole
 * history and this module is a pure function of what it is handed. Recomputing it here
 * would mean walking the entire history once per session -- quadratic, and for a reason
 * that is already available.
 */
export function sessionLoad(
  logId: string,
  startedAt: string,
  sets: readonly ExerciseSetRecord[],
  bestEverKg: number | null,
): SessionLoad {
  // A set with no weight is bodyweight. Its volume is not zero -- it is work done -- but it
  // is not expressible in kg·reps without an assumption about bodyweight, and inventing
  // one here would put a fabricated number in the volume total. Counted in `setCount` and
  // excluded from `volumeKgReps`, and the caller can show the count.
  const volumeKgReps = sets.reduce((total, set) => {
    if (set.weight === null || set.weight <= 0) return total;
    return total + set.weight * (set.reps ?? 0);
  }, 0);

  const estimates = sets
    .map((set) => estimateOneRepMax(set.weight ?? 0, set.reps ?? 0))
    .filter((estimate): estimate is number => estimate !== null);
  const bestEstimateKg = estimates.length > 0 ? Math.max(...estimates) : null;

  const intensity =
    bestEstimateKg !== null && bestEverKg !== null && bestEverKg > 0
      ? bestEstimateKg / bestEverKg
      : null;

  return {
    logId,
    startedAt,
    volumeKgReps,
    bestEstimateKg,
    intensity,
    band: intensity === null ? null : intensityBand(intensity),
  };
}

/**
 * Which band a fraction of best falls in.
 *
 * Thresholds descend from `heavy`, so the first match wins and the bands tile the range
 * without a gap: anything at or above `moderate` that is not `heavy` is `moderate`, and
 * everything below is `light`. Written as descending comparisons rather than
 * if/else-if/else so that adding a fourth band later means adding a threshold and nothing
 * else.
 */
export function intensityBand(intensity: number): IntensityBand {
  if (intensity >= FATIGUE_RULES.BANDS.heavy) return "heavy";
  if (intensity >= FATIGUE_RULES.BANDS.moderate) return "moderate";
  return "light";
}

/** The best estimated 1RM across every session, or null if nothing was estimable. */
export function bestEver(sessions: readonly { sets: readonly ExerciseSetRecord[] }[]): number | null {
  let best: number | null = null;

  for (const session of sessions) {
    for (const set of session.sets) {
      const estimate = estimateOneRepMax(set.weight ?? 0, set.reps ?? 0);
      if (estimate !== null && (best === null || estimate > best)) best = estimate;
    }
  }

  return best;
}

/**
 * Whether recent volume is climbing, falling or steady.
 *
 * Compares the mean volume of the most recent {@link FATIGUE_RULES.WINDOW} sessions
 * against the {@link FATIGUE_RULES.WINDOW} before them, as a percentage of the earlier
 * window. Percentage rather than absolute kg because the question is asked of a body that
 * scales: 10kg more per week is a lot for a 60kg lifter and nothing for a 120kg one.
 *
 * Window-over-window, *not* divided by the window size the way `estimateTrend` in
 * `exerciseMetrics` divides its slope. That module is measuring a slope across sessions
 * that genuinely vary; this one is comparing two blocks, and dividing the difference by
 * four made a 25% jump in volume read as "flat" against a 10% dead band -- the threshold
 * silently became an effective 40%. The dead band here is on the number reported, so it has
 * to be the number a reader would compute from the two windows themselves.
 *
 * `null` when there are not enough sessions, for the reason every module here uses the
 * same answer for a different reason: `flat` and `unknown` are different sentences.
 */
export interface VolumeTrend {
  direction: "up" | "down" | "flat";
  /** Percent change of the recent window against the one before it. */
  percentChange: number;
  sampleSize: number;
}

export function volumeTrend(
  sessionsNewestFirst: readonly SessionLoad[],
): VolumeTrend | null {
  const window = FATIGUE_RULES.WINDOW;
  if (sessionsNewestFirst.length < window * 2) return null;

  const recent = sessionsNewestFirst.slice(0, window);
  const previous = sessionsNewestFirst.slice(window, window * 2);

  const recentMean = average(recent.map((session) => session.volumeKgReps));
  const previousMean = average(previous.map((session) => session.volumeKgReps));

  // Percentage change against zero is undefined. A history that starts at zero volume and
  // climbs is real -- an athlete adding their first weighted exercise -- and reporting
  // Infinity, or falling through to a division by zero, is how that becomes a broken
  // screen. Zero to zero is genuinely flat; zero to something is unbounded, so the direction
  // is reported and the percentage is pinned at the threshold: the direction is the answer,
  // and the magnitude is not yet meaningful.
  if (previousMean === 0) {
    if (recentMean === 0) {
      return { direction: "flat", percentChange: 0, sampleSize: recent.length };
    }
    return {
      direction: "up",
      percentChange: FATIGUE_RULES.DEAD_BAND_PERCENT,
      sampleSize: recent.length,
    };
  }

  const percentChange = ((recentMean - previousMean) / previousMean) * 100;
  const dead = FATIGUE_RULES.DEAD_BAND_PERCENT;

  return {
    direction:
      Math.abs(percentChange) < dead
        ? "flat"
        : percentChange > 0
          ? "up"
          : "down",
    percentChange,
    sampleSize: recent.length,
  };
}

/**
 * How far the recent sessions have drifted from the athlete's own best.
 *
 * This is the question "am I detraining?", and it is asked against the *all-time* best
 * rather than against last week. The distinction matters after an injury or a holiday:
 * compared to last week the numbers look fine, and the athlete resumes a load they can no
 * longer do.
 */
export function detrainingGap(
  sessionsNewestFirst: readonly SessionLoad[],
  bestEverKg: number | null,
): number | null {
  if (bestEverKg === null || bestEverKg <= 0) return null;
  if (sessionsNewestFirst.length === 0) return null;

  const recent = sessionsNewestFirst
    .slice(0, FATIGUE_RULES.WINDOW)
    .map((session) => session.bestEstimateKg)
    .filter((estimate): estimate is number => estimate !== null);
  if (recent.length === 0) return null;

  const recentBest = Math.max(...recent);
  // Positive means the recent window is below the all-time best: a gap to close.
  return bestEverKg - recentBest;
}

/** Fraction of the athlete's best the recent window is achieving, 0..1. */
export function currentIntensity(
  sessionsNewestFirst: readonly SessionLoad[],
): number | null {
  const recent = sessionsNewestFirst
    .slice(0, FATIGUE_RULES.WINDOW)
    .map((session) => session.intensity)
    .filter((intensity): intensity is number => intensity !== null);
  if (recent.length === 0) return null;
  return Math.max(...recent);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Re-exported so a screen reading the hub's numbers does not have to know that the
 * one-rep-max coefficient lives in another module. The two are the same number and
 * `tokens`-style drift between them would be invisible.
 */
export { EXERCISE_METRICS };
