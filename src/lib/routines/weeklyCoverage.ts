/**
 * weeklyCoverage.ts — pure-logic view model for weekly muscle volume coverage
 * and the Deload multiplier.
 *
 * Reads the set of routines assigned to the current week (by day index) and
 * sums `target_sets` per muscle group using the same `countMuscleSets`
 * counter the rest of the app uses, so the coverage indicator and the muscle
 * diagram never disagree.
 *
 * The Deload multiplier (0.5) is applied only to the *displayed* volume —
 * the source routine data is never mutated. Callers pass a `deload` boolean
 * and get back adjusted figures; toggling it back to `false` restores the
 * original 100% values.
 *
 * Token-only by contract: this module is pure TypeScript with no CSS, so the
 * token rules are enforced in the component layer that consumes it.
 */

import { countMuscleSets } from "@/components/MuscleReadonlyMap";
import { translateBodyPart } from "@/lib/i18n";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { WeeklyAssignment } from "./routinesViewModel";

/** Multiplier applied when deload mode is active. */
export const DELOAD_MULTIPLIER = 0.5;

/** Below this weekly set count a muscle is flagged as under-trained. */
export const LOW_VOLUME_THRESHOLD = 6;

export interface MuscleCoverage {
  slug: string;
  label: string;
  /** Raw weekly set count before any deload multiplier. */
  rawSets: number;
  /** Displayed set count — halved when deload is active. */
  displayedSets: number;
  /** True when the raw volume is below the low-volume threshold. */
  lowVolume: boolean;
}

export interface WeeklyCoverageSummary {
  totalExercises: number;
  totalSets: number;
  totalSetsDisplayed: number;
  muscles: MuscleCoverage[];
  lowVolumeCount: number;
  activeRoutineIds: Set<string>;
}

/**
 * Computes the weekly muscle-volume coverage for a given set of routines
 * assigned to the current week.
 *
 * @param routines       All loaded routines (looked up by id).
 * @param assignments    The weekly day assignments.
 * @param deload         When true, displayed sets are scaled by 50%.
 */
export function computeWeeklyCoverage(
  routines: RoutineWithExercises[],
  assignments: WeeklyAssignment[],
  deload: boolean,
): WeeklyCoverageSummary {
  const routineMap = new Map(routines.map((r) => [r.id, r]));

  const activeRoutineIds = new Set<string>();
  const allPlanned: { exercise: { target: string; body_part: string }; target_sets: number }[] = [];

  for (const assignment of assignments) {
    const routine = routineMap.get(assignment.routineId);
    if (!routine) continue;
    activeRoutineIds.add(routine.id);
    for (const pe of routine.exercises) {
      allPlanned.push({
        exercise: { target: pe.exercise.target, body_part: pe.exercise.body_part },
        target_sets: pe.target_sets,
      });
    }
  }

  const counts = countMuscleSets(allPlanned);
  const multiplier = deload ? DELOAD_MULTIPLIER : 1;
  const muscles: MuscleCoverage[] = [];
  let totalSets = 0;
  let totalSetsDisplayed = 0;

  for (const [slug, rawSets] of counts.entries()) {
    totalSets += rawSets;
    const displayedSets = Math.round(rawSets * multiplier);
    totalSetsDisplayed += displayedSets;
    muscles.push({
      slug,
      label: translateBodyPart(slug),
      rawSets,
      displayedSets,
      lowVolume: rawSets < LOW_VOLUME_THRESHOLD,
    });
  }

  muscles.sort((a, b) => b.rawSets - a.rawSets);

  return {
    totalExercises: allPlanned.length,
    totalSets,
    totalSetsDisplayed,
    muscles,
    lowVolumeCount: muscles.filter((m) => m.lowVolume).length,
    activeRoutineIds,
  };
}
