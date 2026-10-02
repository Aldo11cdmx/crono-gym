/**
 * scoreToRank.ts — score to rank, with hysteresis.
 *
 * Pure functions. No React, no Supabase, no filesystem. Everything here can be
 * exercised with plain numbers, which is why the boundary thresholds and the
 * demotion buffer each have their own tests.
 *
 * Hysteresis
 * ----------
 * A rank ladder computed from a noisy signal flickers. One session where the
 * user was tired or under-recovered drags the score a point or two under a
 * threshold, the rank drops, the next good session restores it, and the badge
 * animates twice in a week. So:
 *
 * - Promotions apply at the threshold.
 * - Demotions require the score to fall `demotionBuffer` points *below* the
 *   threshold of the rank being held.
 *
 * The asymmetry is deliberate. Being late to promote costs the user a badge they
 * earned; being quick to demote costs them a badge they had. `unranked` is
 * exempt from the buffer: it means "no data", and holding a stale rank while the
 * data disappears would be worse than showing the honest unknown.
 */

import {
  HYSTERESIS,
  RANKS,
  rankById,
  type RankDefinition,
  type RankId,
} from "./rankConfig";

/** Rank below which hysteresis stops and the score decides outright. */
const UNRANKED: RankDefinition = RANKS[0];

/**
 * Resolves a raw score to a rank, ignoring any previously held rank.
 *
 * Thresholds are inclusive: a score of exactly 46 is Gold, not Silver.
 */
export function scoreToRank(score: number): RankDefinition {
  if (!isFinite(score) || score < 0) return UNRANKED;

  // Ranks are declared ascending by minScore; walk down from the top so the
  // first threshold the score clears wins.
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (score >= RANKS[i].minScore) return RANKS[i];
  }
  return UNRANKED;
}

/**
 * Resolves a score to a rank while respecting the rank the muscle currently
 * holds.
 *
 * `previousRankId` is the rank stored from the last computation. Pass `null`
 * for a first computation.
 */
export function scoreToRankWithHysteresis(
  score: number,
  previousRankId: RankId | null,
): RankDefinition {
  const fresh = scoreToRank(score);
  if (previousRankId === null) return fresh;

  const previous = RANKS.find((r) => r.id === previousRankId) ?? null;
  if (!previous) return fresh;

  // `unranked` means "not enough data". The buffer does not apply to it: holding
  // a stale rank while the data has gone away is worse than admitting the gap.
  if (previous.id === "unranked") return fresh;
  if (fresh.id === "unranked") return fresh;

  const index = (id: RankId): number => RANKS.findIndex((r) => r.id === id);

  // Promotion: the score alone clears the next threshold, so take it.
  if (index(fresh.id) > index(previous.id)) return fresh;

  // Demotion: only once the score has fallen the full buffer below the floor.
  // The comparison is strict so that landing exactly on the buffer counts as
  // demoted -- "fell N points below the threshold" includes N.
  const floor = previous.minScore - HYSTERESIS.demotionBuffer;
  if (score > floor) return previous;

  return fresh;
}

/** Rank without hysteresis, expressed as an id for storage. */
export function scoreToRankId(score: number): RankId {
  return scoreToRank(score).id;
}

/**
 * Progress toward the next rank.
 *
 * `percent` is the distance from the current rank's floor to the next rank's
 * floor, which is what makes a bar mean the same thing across ranks of unequal
 * width. At the floor of the current rank it is 0; at the next threshold it is
 * 1.
 */
export interface RankProgress {
  current: RankDefinition;
  /** Null at Obsidian, the top of the ladder. */
  next: RankDefinition | null;
  /** 0-1, where 1 means "one point below the next rank". */
  percent: number;
  /** Score points still needed. Zero at the top rank. */
  pointsToNext: number;
  /**
   * Whether the score is close enough to the next threshold that a single
   * session could plausibly cross it. The UI highlights this case.
   */
  nearlyThere: boolean;
}

export function getNextRankProgress(score: number): RankProgress {
  const current = scoreToRank(score);

  if (current.id === "obsidian") {
    return { current, next: null, percent: 1, pointsToNext: 0, nearlyThere: false };
  }

  const index = RANKS.findIndex((r) => r.id === current.id);
  const next = RANKS[index + 1] ?? null;
  if (!next) {
    return { current, next: null, percent: 1, pointsToNext: 0, nearlyThere: false };
  }

  const span = next.minScore - current.minScore;
  // Clamped at zero because hysteresis can leave a muscle sitting above a score
  // that would not qualify for its rank; the bar must never render negative.
  const earned = Math.max(0, score - current.minScore);
  const percent = span <= 0 ? 1 : Math.min(1, earned / span);
  const pointsToNext = Math.max(0, Math.round((next.minScore - score) * 10) / 10);

  return {
    current,
    next,
    percent,
    pointsToNext,
    // Within the last fifth of the band: one session away.
    nearlyThere: percent >= 0.8,
  };
}

/**
 * How far a rank moved, in steps. Positive means the muscle improved.
 *
 * Used to decide whether to animate the map.
 */
export function rankDelta(from: RankId | null, to: RankId): number {
  if (from === null) return 0;
  return rankIndex(to) - rankIndex(from);
}

/** True when the muscle gained one or more ranks. */
export function isPromotion(from: RankId | null, to: RankId): boolean {
  return rankDelta(from, to) > 0;
}

function rankIndex(id: RankId): number {
  return RANKS.findIndex((r) => r.id === id);
}

/** Re-exported so callers need one import for a full rank lookup. */
export { rankById };
export type { RankDefinition, RankId };