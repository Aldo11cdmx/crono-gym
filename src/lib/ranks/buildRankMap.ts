/**
 * buildRankMap.ts — scores every muscle and assembles the body map.
 *
 * Pure functions over plain data. `useMuscleRanks` (2.2) supplies the rows and
 * persists the result; everything about *what the map says* is here.
 *
 * The global rank is a weighted average rather than a median, because a lifter
 * with four outstanding muscles and twelve neglected ones has an honest overall
 * level that a median would hide. Unranked muscles are excluded from the average
 * instead of counting as zero: "we do not know" is not the same as "nothing".
 */

import type { Slug } from "react-muscle-highlighter";
import { enabledSlugs, muscleDefinition, muscleMatchLevel } from "../muscleMap";
import {
  calculateMuscleScore,
  type ExerciseRow,
  type MuscleScoreResult,
  type SetRow,
  type ScorerContext,
} from "./muscleScore";
import {
  getNextRankProgress,
  isPromotion,
  rankDelta,
  scoreToRankId,
  scoreToRankWithHysteresis,
  type RankProgress,
} from "./scoreToRank";
import {
  ELIGIBILITY,
  rankById,
  type ConfidenceLevel,
  type RankDefinition,
  type RankId,
} from "./rankConfig";

/** One muscle's entry in the map. */
export interface MuscleRank {
  slug: Slug;
  /** Spanish name, from the anatomy map. */
  label: string;
  /** 0-100, or 0 when unranked. */
  score: number;
  rank: RankDefinition;
  progress: RankProgress;
  confidence: ConfidenceLevel;
  /** False when there is not enough data to rank this muscle. */
  classified: boolean;
  unrankedReason: MuscleScoreResult["unrankedReason"];
  /** Rank steps gained since the previous computation; 0 when unchanged. */
  delta: number;
  /** True when the muscle gained ranks, which is what the map animates. */
  promoted: boolean;
  /** Underlying score detail, kept for the modal. */
  detail: MuscleScoreResult;
}

/** One row of the rank timeline. */
export interface RankHistoryEntry {
  slug: Slug;
  rank: RankId;
  score: number;
  /** ISO date of the record. */
  recordedAt: string;
}

export interface RankMap {
  /** Entry per enabled muscle, in anatomy-map order. */
  muscles: Map<Slug, MuscleRank>;
  /** Weighted average of classified muscles. Null when none are classified. */
  globalRank: RankDefinition | null;
  globalScore: number | null;
  /** Strongest classified muscle, the one worth showing off. */
  strongest: MuscleRank | null;
  /** Weakest classified muscle, the one worth recommending. */
  weakest: MuscleRank | null;
  /** Classified muscle count, and how many are still waiting for data. */
  classifiedCount: number;
  pendingCount: number;
}

/** What the hook already knows about each muscle's last computed rank. */
export type PreviousRanks = Partial<Record<Slug, RankId>>;

export interface BuildRankMapInput {
  sets: SetRow[];
  exercises: ExerciseRow[];
  context: ScorerContext;
  /** Last known rank per muscle, for hysteresis and promotion detection. */
  previous?: PreviousRanks;
}

/**
 * Scores every enabled muscle and assembles the map.
 *
 * `sets` may contain every logged set for the user; each muscle takes the subset
 * that matches it. Sets whose exercise is missing from `exercises` (a custom
 * exercise with no catalog row, or a deleted one) are skipped per muscle, so a
 * single unclassifiable row cannot break the whole map.
 */
export function buildRankMap(input: BuildRankMapInput): RankMap {
  const { sets, exercises, context, previous } = input;
  const previousRanks: PreviousRanks = previous ?? {};

  const muscles = new Map<Slug, MuscleRank>();

  for (const slug of enabledSlugs()) {
    const definition = muscleDefinition(slug);
    if (!definition) continue;

    // Weight is injected from the anatomy map, which owns primary/secondary.
    const weightFor = (exercise: ExerciseRow): number | null => {
      const level = muscleMatchLevel(exercise, slug);
      if (level === null) return null;
      return level === "primary" ? 1.0 : 0.4;
    };

    const detail = calculateMuscleScore({
      sets,
      exercises,
      context,
      weightFor,
    });

    const previousRank = previousRanks[slug] ?? null;
    // An unranked muscle keeps its stored rank so hysteresis does not consume
    // the promotion the user is about to earn on their first three sessions.
    const rank = detail.classified
      ? scoreToRankWithHysteresis(detail.score, previousRank)
      : rankById("unranked");

    muscles.set(slug, {
      slug,
      label: definition.label,
      score: detail.score,
      rank,
      progress: getNextRankProgress(detail.classified ? detail.score : 0),
      confidence: detail.confidence,
      classified: detail.classified,
      unrankedReason: detail.unrankedReason,
      delta: detail.classified ? rankDelta(previousRank, rank.id) : 0,
      promoted: detail.classified && isPromotion(previousRank, rank.id),
      detail,
    });
  }

  const classified = [...muscles.values()].filter((m) => m.classified);

  const globalScore =
    classified.length === 0
      ? null
      : Math.round((classified.reduce((sum, m) => sum + m.score, 0) / classified.length) * 10) / 10;

  // Strongest/weakest by score. `null` when nothing is classified, so the UI can
  // show the new-user empty state rather than a rank derived from nothing.
  const ranked = [...classified].sort((a, b) => b.score - a.score);

  return {
    muscles,
    globalRank: globalScore === null ? null : rankById(scoreToRankId(globalScore)),
    globalScore,
    strongest: ranked[0] ?? null,
    weakest: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    classifiedCount: classified.length,
    pendingCount: muscles.size - classified.length,
  };
}

/**
 * True when the user is new enough that the map should show its empty state.
 *
 * Separate from `classifiedCount === 0` because "no muscle has data yet" and
 * "one muscle happens to lack data" are different messages.
 */
export function shouldShowEmptyState(map: RankMap): boolean {
  return map.classifiedCount === 0;
}

/**
 * Sessions still needed before the least-trained muscle can be ranked.
 *
 * Used by the empty state to say how far the user is from the map, rather than
 * just refusing to show it.
 */
export function sessionsUntilFirstRank(map: RankMap): number {
  if (shouldShowEmptyState(map)) {
    // Nothing to count against; report the global requirement.
    return ELIGIBILITY.minSessions;
  }
  const weakest = map.weakest;
  if (!weakest) return 0;
  return Math.max(0, ELIGIBILITY.minSessions - weakest.detail.sessions);
}

/**
 * Snapshot of every classified muscle's current rank, for persistence.
 *
 * Only classified muscles are written. Recording `unranked` for a muscle would
 * make the next computation treat "no data" as a held rank, and the first real
 * session after that would show up as a promotion from a rank that never
 * existed.
 */
export function snapshotRanks(map: RankMap): PreviousRanks {
  const snapshot: PreviousRanks = {};
  for (const [slug, entry] of map.muscles) {
    if (entry.classified) snapshot[slug] = entry.rank.id;
  }
  return snapshot;
}

/** Timeline rows worth persisting: only actual rank changes. */
export function historyEntriesFor(
  map: RankMap,
  previous: PreviousRanks,
  recordedAt: Date,
): RankHistoryEntry[] {
  const entries: RankHistoryEntry[] = [];
  for (const [slug, entry] of map.muscles) {
    if (!entry.classified) continue;
    const before = previous[slug];
    // First classification counts: going from nothing to Bronze is a change.
    if (before === entry.rank.id) continue;
    entries.push({
      slug,
      rank: entry.rank.id,
      score: entry.score,
      recordedAt: recordedAt.toISOString(),
    });
  }
  return entries;
}

/**
 * Muscles that gained a rank in this computation.
 *
 * Drives the map animation and the "Pecho subió a Oro" notification.
 */
export function promotionsIn(map: RankMap): MuscleRank[] {
  return [...map.muscles.values()].filter((m) => m.promoted);
}

/** Per-muscle fill colour, for handing straight to the body map. */
export function colorByMuscle(map: RankMap): Map<Slug, string> {
  const colors = new Map<Slug, string>();
  for (const [slug, entry] of map.muscles) {
    colors.set(slug, entry.rank.color);
  }
  return colors;
}

/** Roll-up of how many muscles sit at each rank, for the legend. */
export function rankDistribution(map: RankMap): Record<RankId, number> {
  const counts = {} as Record<RankId, number>;
  for (const entry of map.muscles.values()) {
    counts[entry.rank.id] = (counts[entry.rank.id] ?? 0) + 1;
  }
  return counts;
}

export { rankById };
export type { RankDefinition, RankId };