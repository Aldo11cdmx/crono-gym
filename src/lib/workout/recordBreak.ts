/**
 * recordBreak.ts — is this set a new all-time record?
 *
 * One question, answered honestly, and the honest answer is narrower than it looks.
 *
 * The measure is the estimated 1RM, not the raw weight. `personalRecord` in
 * `exerciseMetrics` ranks a exercise's history the same way, so a badge that
 * used a different rule would disagree with the Records tab about what the
 * record is -- and the athlete would have no way to tell which one to believe.
 * Estimating also credits the case a weight-only comparison gets exactly wrong:
 * the same load for one more rep.
 *
 * What is deliberately not a record
 * ------------------------------------
 * **A first set is not a record.** With no `best` there is nothing beaten, and
 * "nuevo récord" on an athlete's first ever working set is a claim about a
 * competition that has not happened. `ActiveWorkout` holds the all-time best
 * from previous sessions, so this only sees a comparison that exists.
 *
 * **An unestimable set is not a record.** Epley is undefined past
 * `MAX_ESTIMATABLE_REPS`, so a 100 kg × 15 set has no 1RM to compare. Falling
 * back to "the weight is higher" would be a different rule from the one the
 * Records tab uses, and would crown records on sets the estimator refuses to
 * rank. The one exception is the reverse case -- a best it cannot estimate but a
 * new set it can -- where a strictly heavier load is a record whatever the reps,
 * because weight alone is a lower bound on the 1RM.
 *
 * Strictly greater, never greater-or-equal. A set that matches the record is the
 * record being *held*, not broken, and a badge for holding it would fire on every
 * warm-up-adjacent repeat.
 */

import { estimateOneRepMax } from "../exercise/exerciseMetrics";

/** The all-time best set for one exercise, in kg and reps. */
export interface RecordBest {
  weightKg: number;
  /** Null when the set was logged without a rep count. */
  reps: number | null;
}

/**
 * Whether a just-completed working set beats the all-time best for its exercise.
 *
 * `best` is the pre-session best, not a best computed from this session's sets:
 * the point is to notice the moment the ceiling moves, and a ceiling computed
 * from the sets already done would move on the first set and never again.
 */
export function isRecordBreak(
  weightKg: number,
  reps: number,
  best: RecordBest | null,
): boolean {
  if (best === null) return false;

  const estimate = estimateOneRepMax(weightKg, reps);
  // A best with no reps logged is a best the estimator cannot rank, which
  // `?? 0` maps to "unestimable" -- `estimateOneRepMax` returns null for any
  // non-positive rep count.
  const bestEstimate = estimateOneRepMax(best.weightKg, best.reps ?? 0);

  // Both estimable: the 1RM decides, which is the rule the Records tab uses.
  if (estimate !== null && bestEstimate !== null) {
    return estimate > bestEstimate;
  }

  // The new set is unestimable (high reps, or none logged): there is no 1RM to
  // claim a record with, and a raw-weight comparison would be a second rule.
  if (estimate === null) return false;

  // The best is unestimable but the new set is not. A strictly heavier load is a
  // record whatever the reps -- weight alone is a lower bound on the 1RM -- but
  // an equal one is not, because the best may have had reps this set does not.
  return weightKg > best.weightKg;
}