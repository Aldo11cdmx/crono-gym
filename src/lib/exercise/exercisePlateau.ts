/**
 * exercise/exercisePlateau.ts — telling a plateau from a bad week.
 *
 * The hard part of this feature is not the arithmetic. It is that "you have not progressed
 * in three weeks" and "you have not progressed in three *sessions*" have to be different
 * answers, because they call for different responses from the athlete and only one of them
 * is true.
 *
 * The distinction this module draws
 * --------------------------------
 * Three sessions can be a plateau or a holiday weekend. Three *weeks* is a plateau by any
 * reasonable reading, because a serious athlete trains more often than three times in a
 * fortnight and the calendar is the only clock that cannot be argued with.
 *
 * So a verdict needs both: enough sessions to mean something, and enough elapsed time that
 * the sessions cannot all be from one bad week. {@link PlateauVerdict} reports
 * `insufficient_data` until both hold, and a screen showing that must say "log a few more
 * sessions" rather than rendering a verdict -- the alternative is an athlete told they
 * have stalled on their third ever session, which is both wrong and discouraging enough to
 * be the reason they quit.
 *
 * What it will not call a plateau
 * ------------------------------
 * A set of reps climbing at a fixed weight is progress. The weight staying still is not
 * the question; the estimated max is. An athlete adding a rep at the same load every week
 * is getting stronger and a weight-only plateau detector will tell them to stop.
 * {@link PLATEAU_RULES.repsAreProgress} exists to make that case explicit and tested.
 */

import type { ExerciseSetRecord } from "./exerciseHistory";
import { sessionMetrics } from "./exerciseMetrics";

/**
 * The thresholds, as a group so a screen can show "why" and a test can pin them.
 *
 * Every number here is a judgement about when to interrupt an athlete, so none of them is
 * a bare literal at a call site.
 */
export const PLATEAU_RULES = {
  /**
   * Sessions that must pass without progress before anything is said.
   *
   * Three. Two sessions is a comparison, not a trend: the second session differs from the
   * first because the athlete is new to the movement, and calling that a plateau on their
   * second ever session would be both wrong and the fastest way to lose them.
   */
  MIN_SESSIONS: 3,

  /**
   * Calendar days that must pass as well.
   *
   * Fourteen. Chosen so that a plateau verdict cannot be reached entirely inside one week,
   * whatever the session count says -- three sessions on Monday, Tuesday and Wednesday is
   * a novice, not a plateau.
   */
  MIN_DAYS: 14,

  /**
   * Estimated 1RM gain per session, in kg, that counts as progress.
   *
   * Under {@link EXERCISE_METRICS.TREND_WINDOW}'s dead band by design: this is the same
   * 1kg figure, and for the same reason. An estimate computed from one set varies by more
   * than that on its own, so anything smaller is measuring the estimator.
   */
  MIN_GAIN_KG: 1,

  /**
   * The most recent sessions the verdict looks at.
   *
   * Four, which is {@link EXERCISE_METRICS.TREND_WINDOW} plus one. One extra session past
   * the comparison window, because the question is "has anything moved *recently*" and a
   * verdict computed only over the older window can be true while the athlete has in fact
   * just broken the plateau.
   */
  LOOKBACK: 4,
} as const;

export type PlateauVerdict =
  | {
      status: "insufficient_data";
      /** What is still missing, so the screen can say which. */
      reason: "too_few_sessions" | "too_little_time";
      sessionsSeen: number;
      daysSinceFirst: number;
    }
  | {
      status: "plateau";
      /** kg of estimated 1RM the athlete would need to gain to look like they are moving. */
      shortfallKg: number;
      sessionsSinceProgress: number;
      daysSinceProgress: number;
    }
  | {
      status: "progressing";
      /** kg per session, over the lookback window. */
      gainKg: number;
    };

/**
 * Reads a plateau verdict out of the sessions, newest first.
 *
 * `sessions` must be the order `groupBySession` returns -- newest session first -- because
 * "recently" is decided by position. Sorting here as well would be defensive but would
 * also hide a caller passing them the wrong way, and a verdict computed over
 * oldest-first sessions would confidently report the opposite of the truth.
 *
 * `now` is a parameter rather than a `Date.now()` inside because this verdict is a function
 * of elapsed time as much as of the numbers, and a module that reaches for the wall clock
 * cannot be tested: the same three sessions answer "too little time" in March and
 * "plateau" in June, so a test written in one month fails in another. The default keeps the
 * app call unchanged.
 */
export function detectPlateau(
  sessions: readonly { logId: string; startedAt: string; sets: readonly ExerciseSetRecord[] }[],
  now: number = Date.now(),
): PlateauVerdict {
  // Sessions with nothing estimable in them cannot show progress or the absence of it --
  // a bodyweight-only or reps-only session has no 1RM to compare. They are skipped rather
  // than counted, so an athlete who logs some sets without weight is not told they have
  // stopped progressing because their usable sessions are too few.
  const usable = sessions
    .map((session) => {
      const best = bestEstimate(session.sets);
      return best === null
        ? null
        : { logId: session.logId, startedAt: session.startedAt, bestKg: best };
    })
    .filter((entry): entry is { logId: string; startedAt: string; bestKg: number } =>
      entry !== null,
    );

  const sessionsSeen = usable.length;
  const daysSinceFirst = spanInDays(usable, now);

  if (sessionsSeen < PLATEAU_RULES.MIN_SESSIONS) {
    return {
      status: "insufficient_data",
      reason: "too_few_sessions",
      sessionsSeen,
      daysSinceFirst,
    };
  }

  if (daysSinceFirst < PLATEAU_RULES.MIN_DAYS) {
    // The calendar check runs second but reads as the same "not yet", and the reason is
    // what the screen shows: three sessions this week is a novice, not a stall.
    return {
      status: "insufficient_data",
      reason: "too_little_time",
      sessionsSeen,
      daysSinceFirst,
    };
  }

  const window = usable.slice(0, PLATEAU_RULES.LOOKBACK);
  if (window.length < 2) {
    return {
      status: "insufficient_data",
      reason: "too_few_sessions",
      sessionsSeen,
      daysSinceFirst,
    };
  }

  // Newest minus oldest across the window. The middle sessions are what
  // {@link PLATEAU_RULES.LOOKBACK} exists to absorb: one bad day inside a good fortnight
  // should not decide the verdict.
  const newest = window[0].bestKg;
  const oldest = window[window.length - 1].bestKg;
  const gainKg = (newest - oldest) / (window.length - 1);

  if (gainKg >= PLATEAU_RULES.MIN_GAIN_KG) {
    return { status: "progressing", gainKg };
  }

  return {
    status: "plateau",
    shortfallKg: PLATEAU_RULES.MIN_GAIN_KG - gainKg,
    sessionsSinceProgress: window.length,
    daysSinceProgress: daysSinceFirst,
  };
}

/** The best estimated 1RM in one session's sets, or null if none is estimable. */
function bestEstimate(sets: readonly ExerciseSetRecord[]): number | null {
  return sessionMetrics("", "", sets).bestEstimateKg;
}

/**
 * Whether a session still moved, judged on reps as well as weight.
 *
 * The case that a weight-only comparison gets wrong: same weight, one more rep than last
 * week. The estimated max does move -- Epley is a function of both -- so this is really a
 * reminder that any comparison which only looks at `weight` will miss it. Exposed and
 * tested rather than inlined, because the temptation to write the weight-only version is
 * the whole reason this function exists.
 */
export function repsAreProgress(
  previous: readonly ExerciseSetRecord[],
  current: readonly ExerciseSetRecord[],
): boolean {
  const previousTop = heaviest(previous);
  const currentTop = heaviest(current);
  if (previousTop === null || currentTop === null) return false;

  // More weight at the same or fewer reps is unambiguously progress.
  if (currentTop.weightKg > previousTop.weightKg) return true;
  if (currentTop.weightKg < previousTop.weightKg) return false;

  // Same top weight: did the athlete get more reps out of it?
  return (currentTop.reps ?? 0) > (previousTop.reps ?? 0);
}

/** The heaviest set in a session, by weight then reps. */
function heaviest(
  sets: readonly ExerciseSetRecord[],
): { weightKg: number; reps: number | null } | null {
  let best: { weightKg: number; reps: number | null } | null = null;

  for (const set of sets) {
    if (set.weight === null || set.weight <= 0) continue;
    if (
      best === null ||
      set.weight > best.weightKg ||
      (set.weight === best.weightKg && (set.reps ?? 0) > (best.reps ?? 0))
    ) {
      best = { weightKg: set.weight, reps: set.reps };
    }
  }

  return best;
}

/**
 * Days spanned by the usable sessions, as of now.
 *
 * From the *oldest* session to today, not oldest to newest, because the question is how
 * long this history has been going. A history whose three sessions are all last Tuesday
 * spans zero days, which is exactly the "too little time" case.
 *
 * `Math.max(0, ...)` because the rows can arrive in any order and a future-dated
 * timestamp -- a clock wrong on the phone that logged it -- must not produce a negative
 * span and read as "this is a plateau, take 4 days".
 */
export function spanInDays(
  entries: readonly { startedAt: string }[],
  now: number = Date.now(),
): number {
  if (entries.length === 0) return 0;

  const oldest = Math.min(...entries.map((entry) => Date.parse(entry.startedAt)));
  if (!Number.isFinite(oldest)) return 0;

  return Math.max(0, Math.floor((now - oldest) / 86_400_000));
}
