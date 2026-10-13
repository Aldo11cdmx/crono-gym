/**
 * heatmapColors.ts — volume-based colour for the heatmap map mode.
 *
 * Pure functions returning token-backed colour values so the component never
 * has to carry a hex literal. The bucketing thresholds (1-5 maintenance,
 * 6-12 optimal, 13+ fatigue, 0 inactive) come from common hypertrophy
 * guidelines and are expressed here as named constants rather than inline,
 * so they are reviewable and adjustable in one place.
 */

import type { Slug } from "react-muscle-highlighter";
import {
  type MuscleRank,
  type RankMap,
} from "./buildRankMap";
import { HEATMAP } from "@/design/tokens";

/** Effective sets accumulated in a week, bucketed by training guidance. */
export const HEATMAP_BUCKETS = {
  /** Below this, a muscle is considered inactive. */
  inactiveMax: 0,
  /** 1-5 sets: maintenance range. */
  maintenanceMax: 5,
  /** 6-12 sets: optimal hypertrophy range. */
  optimalMax: 12,
  /** 13+ sets: fatigue overload. */
} as const;

/** One of the four heatmap buckets for a muscle. */
export type HeatmapBucket = "inactive" | "maintenance" | "optimal" | "fatigue";

/**
 * Effective weekly sets for a muscle, rounded.
 *
 * Uses `setsPerWeek` from the volume summary, which is the 90-day average
 * expressed per week. This is the best per-muscle weekly volume signal
 * available without re-querying the raw set log — the map is a *summary*,
 * and a nine-day window would show gaps where none exist in the average.
 */
export function weeklySetsFor(entry: MuscleRank): number {
  if (!entry.classified) {
    // Unranked muscles still have a volume summary computed, so they can
    // show training activity even before they earn a rank.
    return Math.round(entry.detail.volume.setsPerWeek);
  }
  return Math.round(entry.detail.volume.setsPerWeek);
}

/**
 * Maps a weekly-set count to one of the four heatmap buckets.
 */
export function bucketForWeeklySets(sets: number): HeatmapBucket {
  if (sets === 0) return "inactive";
  if (sets <= HEATMAP_BUCKETS.maintenanceMax) return "maintenance";
  if (sets <= HEATMAP_BUCKETS.optimalMax) return "optimal";
  return "fatigue";
}

/** Fill colour for a given heatmap bucket, drawn from the HEATMAP token group. */
export function heatmapColorFor(bucket: HeatmapBucket): string {
  switch (bucket) {
    case "inactive":
      return HEATMAP.inactive;
    case "maintenance":
      return HEATMAP.maintenance;
    case "optimal":
      return HEATMAP.optimal;
    case "fatigue":
      return HEATMAP.fatigue;
  }
}

/** Glow colour for a heatmap bucket — used for the drop-shadow halo. */
export function heatmapGlowFor(bucket: HeatmapBucket): string {
  switch (bucket) {
    case "optimal":
      return HEATMAP.optimalGlow;
    case "fatigue":
      return HEATMAP.fatigueGlow;
    default:
      return HEATMAP.maintenance;
  }
}

/**
 * Builds a per-muscle fill map for the heatmap view, keyed by slug.
 *
 * Muscles with no training data at all fall to the inactive bucket, which
 * reuses the inert diagram fill so they recede into the background.
 */
export function heatmapColorByMuscle(map: RankMap): Map<Slug, string> {
  const colors = new Map<Slug, string>();
  for (const [slug, entry] of map.muscles) {
    const sets = weeklySetsFor(entry);
    const bucket = bucketForWeeklySets(sets);
    colors.set(slug, heatmapColorFor(bucket));
  }
  return colors;
}

/**
 * Per-muscle weekly set count, for rendering in cards and the drawer.
 */
export function weeklySetsByMuscle(map: RankMap): Map<Slug, number> {
  const result = new Map<Slug, number>();
  for (const [slug, entry] of map.muscles) {
    result.set(slug, weeklySetsFor(entry));
  }
  return result;
}

/**
 * Returns the heatmap bucket for a muscle entry, for conditional rendering
 * in cards and the detail drawer.
 */
export function bucketForEntry(entry: MuscleRank): HeatmapBucket {
  return bucketForWeeklySets(weeklySetsFor(entry));
}

/** Re-export the colour groups so components import from one place. */
export { HEATMAP };
