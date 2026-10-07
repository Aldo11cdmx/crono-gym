/**
 * workout/fatigue.ts — "did this set fall short, and does it matter?"
 *
 * One question, answered conservatively, because fatigue is a claim about
 * the athlete's body and a false claim is worse than no claim: a badge
 * that cries wolf on every set is a badge nobody reads, and one that
 * fires on a warm-up or a personal record is simply wrong.
 *
 * The rule
 * -----------
 * A set is fatigued when it came up short of the planned reps -- the
 * overload target the engine already computed for this exercise. Short by
 * one rep is *mild*. Short by two, or by a quarter of the target, is
 * *high* -- but only at a heavy load, because falling short at a light
 * load is a bad set, not a tired muscle. "Heavy" means the bar was at
 * least 85% of the athlete's estimated 1RM for the movement; when there
 * is no history to weigh the load against, the shortfall alone decides,
 * because a target missed by that much is worth saying either way.
 *
 * What is deliberately never fatigued
 * ------------------------------------
 * **Warm-ups.** Preparation, not work; the target does not apply to them.
 * **Record-breakers.** A set that beat the all-time best did not fall
 * short by any useful definition -- it is the best set ever, and calling
 * it tired would tell the athlete to go easier after their greatest
 * session.
 * **Sets that met or beat the target.** Extra reps are progress, not
 * fatigue.
 * **Sets with nothing countable.** No target, no reps, a half-typed
 * `"8."`: there is no comparison to make, and a badge on a guess is a
 * badge on noise.
 *
 * Pure on purpose: no clock, no storage, no React. The caller supplies
 * the plan and the history; this module supplies the verdict.
 */

import { estimateOneRepMax } from "../exercise/exerciseMetrics";
import type { SetKind } from "./setKind";

/** The rule's thresholds, exported so they are reviewable in one place. */
export const FATIGUE = {
  /** Reps short of the target that counts as mild fatigue. */
  MILD_SHORTFALL: 1,
  /** Reps short of the target that counts as high fatigue on its own. */
  HIGH_SHORTFALL: 2,
  /** Share of the target that counts as high fatigue on its own. */
  HIGH_SHORTFALL_RATIO: 0.25,
  /**
   * Share of the historical estimated 1RM at which a load counts as
   * heavy enough for a shortfall to mean fatigue rather than a bad set.
   */
  HEAVY_LOAD_RATIO: 0.85,
  /** How many fatigued sets one exercise needs before it is worth a summary. */
  SUMMARY_MIN_SETS: 2,
} as const;

/** How far a set fell short, in reps -- or `null` when there is no shortfall to report. */
export type FatigueLevel = "none" | "mild" | "high";

/** The set under judgment, as the logger holds it. */
export interface FatigueSet {
  /** Planned-rep comparison input; parsed, never coerced. */
  reps: string;
  weight: string;
  kind: SetKind;
}

/** The all-time best working set, for the heavy-load test. */
export interface FatigueBest {
  weightKg: number | null;
  reps: number | null;
}

/** Everything the rule needs that the set itself does not carry. */
export interface FatigueContext {
  /**
   * The reps this exercise planned for its working sets, from the
   * overload target. `null` when there is no target to compare against.
   */
  plannedReps: number | null;
  /** The pre-session best, or `null` when the exercise has no history. */
  allTimeBest: FatigueBest | null;
  /** Whether this set just broke the all-time record. */
  isRecord: boolean;
}

/**
 * The reps a set came up short by.
 *
 * `null` -- never `0` -- when there is nothing to report: no target, no
 * countable reps, or a set that met or beat the plan. A caller that
 * renders "−0 reps" off a zero would be inventing a fatigue that did not
 * happen, so the absence is a distinct value.
 */
export function fatigueShortfall(
  set: { reps: string },
  plannedReps: number | null,
): number | null {
  if (plannedReps === null || !Number.isFinite(plannedReps) || plannedReps <= 0) {
    return null;
  }
  const actual = Number.parseInt(set.reps, 10);
  if (!Number.isFinite(actual) || actual <= 0) return null;

  const shortfall = plannedReps - actual;
  return shortfall > 0 ? shortfall : null;
}

/**
 * Whether one completed set shows fatigue, and how much.
 *
 * Warm-ups, records, met targets and uncountable sets are `none` -- see
 * the module comment for why each is excluded. A mild shortfall is `mild`
 * on its own; a severe one is `high` only at a heavy load, or on its own
 * when there is no history to weigh the load against.
 */
export function getSetFatigue(set: FatigueSet, context: FatigueContext): FatigueLevel {
  if (set.kind === "warmup") return "none";
  // A record is the best set ever, not a tired one.
  if (context.isRecord) return "none";

  const shortfall = fatigueShortfall(set, context.plannedReps);
  if (shortfall === null || shortfall < FATIGUE.MILD_SHORTFALL) return "none";

  const severe =
    shortfall >= FATIGUE.HIGH_SHORTFALL ||
    shortfall >= context.plannedReps! * FATIGUE.HIGH_SHORTFALL_RATIO;
  if (!severe) return "mild";

  // A severe shortfall is fatigue only at a heavy load. Without history
  // there is nothing to weigh the load against, so the shortfall decides.
  const best = context.allTimeBest;
  const historicalOneRepMax = best
    ? estimateOneRepMax(best.weightKg ?? 0, best.reps ?? 0)
    : null;
  if (historicalOneRepMax === null) return "high";

  const setWeight = Number.parseFloat(set.weight);
  // A set with no load on the bar cannot be "heavy", however short it fell.
  if (!Number.isFinite(setWeight) || setWeight <= 0) return "mild";

  return setWeight >= FATIGUE.HEAVY_LOAD_RATIO * historicalOneRepMax
    ? "high"
    : "mild";
}

/**
 * The exercise-level rollup: how many sets fell short, out of how many.
 *
 * The summary reads "N de M series con fatiga", and the N only counts
 * sets that showed fatigue -- a count of every set would make the
 * sentence a lie on any exercise with one clean set.
 */
export function summarizeFatigue(
  levels: readonly FatigueLevel[],
): { fatigued: number; total: number } {
  return {
    fatigued: levels.filter((level) => level !== "none").length,
    total: levels.length,
  };
}
