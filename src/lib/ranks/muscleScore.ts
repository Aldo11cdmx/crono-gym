/**
 * muscleScore.ts — turns logged history into a 0-100 score for one muscle.
 *
 * Pure functions, no React and no Supabase. The hook in 2.2 supplies plain
 * arrays of rows; everything about *what a score means* lives here so it can be
 * unit-tested without a database.
 *
 * The shape of the score
 * ----------------------
 *   score = 0.70 * strength + 0.30 * volume
 *
 * Strength dominates because it is the slower-moving, harder-to-fake signal.
 * Volume is real but cheap to inflate: a beginner can add sets faster than they
 * can add kilos, so a volume-heavy score would rank enthusiasm rather than
 * capability.
 *
 * Strength itself is a weighted average over the muscle's best exercises, using
 * each exercise's *ratio of bodyweight* measured against a standard for that
 * movement. Comparing raw kilos across two exercises would be meaningless (a
 * 100 kg squat and a 30 kg dumbbell curl are not commensurable); comparing each
 * to bodyweight, and then each to what that movement demands, is.
 */

import {
  CONTRIBUTION_WEIGHTS,
  ELIGIBILITY,
  SCORE_WEIGHTS,
  STRENGTH_RULES,
  TARGET_STANDARD,
  VOLUME_RULES,
  standardRatioFor,
  hasCalibratedStandard,
  type ConfidenceLevel,
  type ExerciseKey,
  type SexKey,
} from "./rankConfig";

/** One logged set, as stored in `completed_sets`. */
export interface SetRow {
  exerciseId: string;
  weight: number | null;
  reps: number | null;
  isWarmup: boolean;
  /** ISO timestamp of the owning session. */
  performedAt: string;
}

/** Catalog metadata needed to interpret a set. */
export interface ExerciseRow {
  id: string;
  name: string;
  target: string;
  body_part: string;
  equipment: string;
}

/** Everything the scorer needs about the user, all already in canonical kg. */
export interface ScorerContext {
  bodyweightKg: number | null;
  sex: SexKey;
  /** Injectable so decay and windows are testable. */
  now: Date;
}

/** One exercise's contribution to the muscle's score. */
export interface ExerciseContribution {
  exerciseId: string;
  name: string;
  /** Best trustworthy estimated 1RM across all sessions, in kg. */
  estimatedOneRepMax: number;
  /** That 1RM divided by bodyweight. */
  ratio: number;
  /**
   * Strength component as a 0-100 percentage, capped at 100.
   *
   * `ratio / standardRatio` is the fraction of Gold for that movement; 1.0 maps
   * to Gold's 46 points within the ladder. Values above Gold extrapolate.
   */
  strengthPercent: number;
  /** Which standard ratio was used, for the explanation panel. */
  standardKey: ExerciseKey;
  standardRatio: number;
  /** 1.0 for primary work, 0.4 for a synergist. */
  contributionWeight: number;
  /** Whether this exercise made the top-N cut. */
  counted: boolean;
  /** Sessions and working sets backing this number. */
  sessions: number;
  workingSets: number;
  /** Best single set, for the "best lift" row in the detail panel. */
  bestSet: { weight: number; reps: number } | null;
}

/** The volume and consistency half of the score. */
export interface VolumeSummary {
  /** Working sets inside the lookback window. */
  effectiveSets: number;
  /** Distinct ISO weeks with at least one working set. */
  activeWeeks: number;
  /** Sets per week across the window. */
  setsPerWeek: number;
  /** 0-1 multiplier from inactivity, 1 when fresh. */
  decayFactor: number;
  /** Whole days since the last working set. */
  daysSinceLastSet: number | null;
  /** Combined 0-100 volume percentage. */
  volumePercent: number;
}

export interface MuscleScoreResult {
  /** Final 0-100 score. Zero when there is not enough data to rank. */
  score: number;
  /** `unranked` when below the session minimum or bodyweight is unknown. */
  classified: boolean;
  /** Why the muscle is unranked, in a form the UI can show. */
  unrankedReason: UnrankedReason | null;
  confidence: ConfidenceLevel;
  strength: VolumeSummary | null;
  volume: VolumeSummary;
  /** Exercises that drove the score, ordered by contribution. */
  contributions: ExerciseContribution[];
  /** Distinct sessions of this muscle. */
  sessions: number;
  /** Distinct sessions that fell inside the lookback window. */
  recentSessions: number;
}

export type UnrankedReason =
  | "no_data"
  | "insufficient_sessions"
  | "unknown_bodyweight"
  | "no_strength_signal";

const WEEK_MS = 7 * 86_400_000;

/**
 * Epley estimated 1RM.
 *
 * Duplicated here rather than imported from `overload.ts` only to keep the
 * weights explicit; the formula and its validation window are asserted against
 * `overload.ts`'s constant in the test suite, so the two cannot drift apart
 * unnoticed.
 */
function estimateOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** Whether a set contributes to a strength estimate. */
function isStrengthSet(set: SetRow): boolean {
  if (STRENGTH_RULES.ignoreWarmups && set.isWarmup) return false;
  if (set.reps === null || set.reps <= 0) return false;
  if (set.reps > STRENGTH_RULES.maxRepsForEstimate) return false;
  if (set.weight !== null && set.weight >= STRENGTH_RULES.minLoadKg) return true;
  // Bodyweight and band work: no external load, but still a strength signal if
  // it is a loaded variation. Pure bodyweight movements are scored separately
  // because their load depends on the user's own mass.
  return set.weight === null;
}

/**
 * Converts a set's raw weight into the load used for the estimate.
 *
 * Bodyweight and band work carries no `weight`, so the conversion depends on the
 * user's mass and cannot live in a pure maths helper. Injecting it keeps the
 * policy (reps * `bodyweightRepsAsKg`) explicit and testable without duplicating
 * it per call site.
 */
export type LoadResolver = (set: SetRow, bodyweightKg: number) => number;

const defaultLoadResolver: LoadResolver = (set, bodyweightKg) =>
  set.weight === null || set.weight === 0
    ? (set.reps ?? 0) * STRENGTH_RULES.bodyweightRepsAsKg * bodyweightKg * 0.01
    : set.weight;

/**
 * Best trustworthy 1RM for one exercise, in kg.
 *
 * The best estimate is taken across every session, not just the latest: a
 * personal best is a fact about what the user has done, and discarding it the
 * moment they take a deload week would make ranks collapse for the wrong reason.
 */
function bestEstimateFor(
  sets: SetRow[],
  bodyweightKg: number,
  resolveLoad: LoadResolver,
): { oneRepMax: number; bestSet: { weight: number; reps: number } | null; count: number } {
  let best = 0;
  let bestSet: { weight: number; reps: number } | null = null;
  let count = 0;

  for (const set of sets) {
    if (!isStrengthSet(set)) continue;
    const reps = set.reps as number;
    count += 1;
    const effective = resolveLoad(set, bodyweightKg);
    if (effective <= 0) continue;
    const estimate = estimateOneRepMax(effective, reps);
    if (estimate > best) {
      best = estimate;
      bestSet = { weight: Math.round(effective * 10) / 10, reps };
    }
  }

  return { oneRepMax: best, bestSet, count };
}

/**
 * Maps a strength percentage onto the rank ladder.
 *
 * Gold sits at 46 points and Obsidian at 95, with Bronze at 12. The ratios are
 * calibrated so `ratio == standardRatio` lands on Gold, which is the intent of
 * the standards table: "Gold" means "this movement at the Gold ratio".
 */
function strengthRatioToPercent(ratio: number, standardRatio: number): number {
  if (standardRatio <= 0) return 0;
  const fraction = ratio / standardRatio;
  // Bronze at 0.4x the standard, Gold at 1.0x, Obsidian at ~2.1x.
  const PERCENT_AT = { bronze: 0.4, gold: 1.0, obsidian: 2.1 } as const;
  const span = PERCENT_AT.obsidian - PERCENT_AT.bronze;
  const earned = fraction - PERCENT_AT.bronze;
  const percent = (earned / span) * 100;
  return Math.max(0, Math.min(100, percent));
}

/**
 * Volume percentage: sets and weeks, both saturating.
 *
 * Each half is capped independently so that doing 200 sets a week for two weeks
 * does not outrank two years of consistent training. Weeks is weighted higher
 * because consistency is the harder half to fake and the better predictor of
 * progress.
 */
function volumePercent(setsPerWeek: number, activeWeeks: number): number {
  const setScore = Math.min(1, setsPerWeek / VOLUME_RULES.targetSetsPerWeek);
  const weekScore = Math.min(1, activeWeeks / VOLUME_RULES.targetWeeks);
  return Math.round((setScore * 0.4 + weekScore * 0.6) * 1000) / 10;
}

/** ISO week key, e.g. "2026-W41", used to count distinct training weeks. */
function weekKey(date: Date): string {
  // Thursday of the current week determines the ISO year, per ISO 8601.
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / WEEK_MS);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * Inactivity decay multiplier for the volume component.
 *
 * Piecewise linear: flat at 1.0 until `decayAfterDays`, then ramps down to
 * `decayFloor` over `decayRampDays`. Strength is deliberately not touched --
 * muscle memory is real, and the brief asks that historical strength survive a
 * layoff.
 */
export function decayFactorFor(daysSinceLastSet: number | null): number {
  if (daysSinceLastSet === null) return 0;
  if (daysSinceLastSet <= VOLUME_RULES.decayAfterDays) return 1;
  const over = daysSinceLastSet - VOLUME_RULES.decayAfterDays;
  const progress = Math.min(1, over / VOLUME_RULES.decayRampDays);
  const drop = 1 - VOLUME_RULES.decayFloor;
  return Math.max(VOLUME_RULES.decayFloor, 1 - drop * progress);
}

/**
 * Confidence from how much data backs the score.
 *
 * Two independent inputs: session count (is there enough?) and recency (is it
 * current?). A muscle with 50 sessions from last year is not more understood
 * than one with 8 from this month, so recency caps the level.
 */
export function confidenceFor(
  sessions: number,
  daysSinceLastSet: number | null,
  sex: SexKey,
): ConfidenceLevel {
  let level: ConfidenceLevel = "low";
  if (sessions >= ELIGIBILITY.highConfidenceSessions) level = "high";
  else if (sessions >= ELIGIBILITY.mediumConfidenceSessions) level = "medium";

  // Stale data cannot claim high confidence however many sessions produced it.
  if (
    level === "high" &&
    daysSinceLastSet !== null &&
    daysSinceLastSet > ELIGIBILITY.stalenessDays
  ) {
    level = "medium";
  }
  // The midpoint standard table is the least calibrated, so never let it read
  // as high confidence.
  if (level === "high" && !hasCalibratedStandard(sex)) return "medium";
  return level;
}

/**
 * Scores a single muscle.
 *
 * `matcher` decides whether an exercise works this muscle, and with what weight.
 * It is injected rather than imported so this module has no opinion about the
 * anatomy map; the caller passes `muscleMatchLevel`'s result.
 */
export function calculateMuscleScore(input: {
  sets: SetRow[];
  exercises: ExerciseRow[];
  context: ScorerContext;
/** Returns the contribution weight, or null when the exercise is irrelevant. */
  weightFor: (exercise: ExerciseRow) => number | null;
  /**
   * Overrides how a set's raw weight becomes the load used for the estimate.
   * Mainly for tests; the default handles bodyweight sets.
   */
  resolveLoad?: LoadResolver;
}) {
  const { sets, exercises, context, weightFor } = input;
  const resolveLoad = input.resolveLoad ?? defaultLoadResolver;
  const { bodyweightKg, sex, now } = context;

  const catalog = new Map(exercises.map((e) => [e.id, e]));

  /**
   * Drops sets of exercises this muscle does not train, before anything is
   * counted.
   *
   * This has to happen up front rather than at the contribution stage. Counting
   * first would inflate the session and volume totals of every muscle with every
   * session the user logged anywhere: a chest-only lifter would show up as having
   * trained glutes three times a week, and the "sin clasificar" reason would
   * become `no_strength_signal` instead of `no_data`, telling the user their legs
   * are untrainable rather than untouched.
   */
  const relevantSets: SetRow[] = [];
  for (const set of sets) {
    if (STRENGTH_RULES.ignoreWarmups && set.isWarmup) continue;
    const exercise = catalog.get(set.exerciseId);
    if (!exercise) continue;
    if (weightFor(exercise) === null) continue;
    relevantSets.push(set);
  }
  const workingSets = relevantSets;

  const nowMs = now.getTime();

  const sessions = new Set<string>();
  const sessionsForExercise = new Map<string, Set<string>>();
  const lastSetMs = new Map<string, number>();
  const recentWeeks = new Set<string>();
  let recentWorkingSets = 0;
  const windowStartMs = nowMs - VOLUME_RULES.windowDays * 86_400_000;

  for (const set of workingSets) {
    const at = new Date(set.performedAt);
    if (Number.isNaN(at.getTime())) continue;
    const ts = at.getTime();
    sessions.add(set.performedAt);

    const key = String(set.exerciseId);
    const perExercise = sessionsForExercise.get(key) ?? new Set<string>();
    perExercise.add(set.performedAt);
    sessionsForExercise.set(key, perExercise);

    lastSetMs.set(key, Math.max(lastSetMs.get(key) ?? 0, ts));

    if (ts >= windowStartMs) {
      recentWorkingSets += 1;
      recentWeeks.add(weekKey(at));
    }
  }

  const allLast = [...lastSetMs.values()];
  const daysSinceLastSet =
    allLast.length === 0 ? null : Math.floor((nowMs - Math.max(...allLast)) / 86_400_000);

  // Volume: counted inside the window, then decayed for inactivity.
  const windowSpanWeeks = VOLUME_RULES.windowDays / 7;
  const setsPerWeek = recentWorkingSets / windowSpanWeeks;
  const rawVolumePercent = volumePercent(setsPerWeek, recentWeeks.size);
  const decay = decayFactorFor(daysSinceLastSet);
  const decayedVolumePercent = Math.round(rawVolumePercent * decay * 10) / 10;

  const volume: VolumeSummary = {
    effectiveSets: recentWorkingSets,
    activeWeeks: recentWeeks.size,
    setsPerWeek: Math.round(setsPerWeek * 10) / 10,
    decayFactor: Math.round(decay * 1000) / 1000,
    daysSinceLastSet,
    volumePercent: decayedVolumePercent,
  };

  const sessionCount = sessions.size;
  const recentSessionCount = recentWeeks.size;
  const emptyResult = (
    reason: UnrankedReason,
    contributions: ExerciseContribution[] = [],
  ): MuscleScoreResult => ({
    score: 0,
    classified: false,
    unrankedReason: reason,
    confidence: "low",
    strength: null,
    volume,
    contributions,
    sessions: sessionCount,
    recentSessions: recentSessionCount,
  });

  if (workingSets.length === 0) return emptyResult("no_data");
  if (sessionCount < ELIGIBILITY.minSessions) return emptyResult("insufficient_sessions");
  if (bodyweightKg === null || bodyweightKg <= 0) return emptyResult("unknown_bodyweight");

  // --- per-exercise strength ------------------------------------------------
  const contributions: ExerciseContribution[] = [];
  for (const [exerciseId, exerciseSessions] of sessionsForExercise) {
    const exercise = catalog.get(exerciseId);
    if (!exercise) continue;
    const weight = weightFor(exercise);
    if (weight === null) continue;

    const exerciseSets = workingSets.filter((s) => s.exerciseId === exerciseId);
    const { oneRepMax, bestSet, count } = bestEstimateFor(
      exerciseSets,
      bodyweightKg,
      resolveLoad,
    );
    if (oneRepMax <= 0) continue;

    const standardKey = TARGET_STANDARD[exercise.target];
    if (!standardKey) continue;

    const standardRatio = standardRatioFor(standardKey, sex);
    const ratio = oneRepMax / bodyweightKg;

    contributions.push({
      exerciseId,
      name: exercise.name,
      estimatedOneRepMax: Math.round(oneRepMax * 10) / 10,
      ratio: Math.round(ratio * 100) / 100,
      strengthPercent: Math.round(strengthRatioToPercent(ratio, standardRatio) * 10) / 10,
      standardKey,
      standardRatio,
      contributionWeight: weight,
      counted: false,
      sessions: exerciseSessions.size,
      workingSets: count,
      bestSet,
    });
  }

  if (contributions.length === 0) return emptyResult("no_strength_signal");

  // Keep the strongest few, then weight by contribution role. Top-N is computed
  // on strength so a lifter with one great lift and twelve mediocre variations is
  // ranked on the great lift, which is what the score means.
  contributions.sort((a, b) => b.strengthPercent - a.strengthPercent);
  const kept = contributions.slice(0, CONTRIBUTION_WEIGHTS.maxContributingExercises);
  for (const contribution of contributions) {
    contribution.counted = kept.includes(contribution);
  }

  const totalWeight = kept.reduce((sum, c) => sum + c.contributionWeight, 0);
  const strengthPercent =
    totalWeight > 0
      ? kept.reduce((sum, c) => sum + c.strengthPercent * c.contributionWeight, 0) /
        totalWeight
      : 0;

  const score = Math.round(
    (strengthPercent * SCORE_WEIGHTS.strength + decayedVolumePercent * SCORE_WEIGHTS.volume) *
      10,
  ) / 10;

  return {
    score,
    classified: true,
    unrankedReason: null,
    confidence: confidenceFor(sessionCount, daysSinceLastSet, sex),
    // Reuses the VolumeSummary shape for the strength half; the UI reads the
    // percent field and the contribution list for the detail.
    strength: {
      effectiveSets: kept.reduce((sum, c) => sum + c.workingSets, 0),
      activeWeeks: recentSessionCount,
      setsPerWeek: Math.round(
        (kept.reduce((sum, c) => sum + c.workingSets, 0) / windowSpanWeeks) * 10,
      ) / 10,
      decayFactor: 1,
      daysSinceLastSet,
      volumePercent: Math.round(strengthPercent * 10) / 10,
    },
    volume,
    contributions,
    sessions: sessionCount,
    recentSessions: recentSessionCount,
  };
}

/** Sessions counted for a muscle, ignoring warm-up sets. */
export function countSessions(sets: SetRow[]): number {
  return new Set(
    sets.filter((s) => !(STRENGTH_RULES.ignoreWarmups && s.isWarmup)).map((s) => s.performedAt),
  ).size;
}

/**
 * Confidence is reported even for unranked muscles, so the detail panel can say
 * "two sessions logged, three needed" instead of an unexplained grey.
 */
export function sessionsNeededMessage(sessions: number): {
  needed: number;
  missing: number;
} {
  const missing = Math.max(0, ELIGIBILITY.minSessions - sessions);
  return { needed: ELIGIBILITY.minSessions, missing };
}

export { ELIGIBILITY, VOLUME_RULES, SCORE_WEIGHTS };
export type { ConfidenceLevel, ExerciseKey, SexKey };