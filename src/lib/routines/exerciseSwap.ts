/**
 * exerciseSwap.ts — pure-logic view model for the "Cambiar" exercise feature.
 *
 * Given a source exercise and a catalogue, finds replacement candidates that
 * share the same primary or secondary muscle, optionally prioritising those that
 * match the user's available gym equipment.
 *
 * This module is intentionally free of React so it can be unit-tested against
 * literals and reused by both the routine editor and the active-workout view.
 */

import type { Exercise } from "@/types/supabase";
import { isAvailableInMyGym } from "@/data/myGymEquipment";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

export interface SwapCandidate {
  exercise: Exercise;
  /** true when the candidate matches the source's primary muscle (body_part). */
  primaryMatch: boolean;
  /** true when the candidate shares only the secondary target. */
  secondaryMatch: boolean;
  /** true when the candidate's equipment is in the user's gym. */
  equipmentAvailable: boolean;
}

export interface SwapOptions {
  /** All exercises in the catalogue. */
  allExercises: Exercise[];
  /** Equipment tags the user owns; when undefined, all candidates are shown
   * with `equipmentAvailable` flagged but no filtering occurs. */
  availableEquipment?: ReadonlySet<string>;
  /** Exclude the source exercise itself from results. */
  excludeId?: string;
  /** Exclude exercises already in the routine (by id). */
  excludeIds?: Set<string>;
}

/**
 * Finds replacement candidates for `source`.
 *
 * Matching rule: a candidate qualifies if it shares `body_part` (primary) or
 * `target` (secondary) with the source. Candidates are then ranked:
 *
 * 1. Primary-muscle match beats secondary-only match.
 * 2. Within the same match tier, equipment-available beats equipment-unavailable
 *    (only when `availableEquipment` is provided).
 * 3. Alphabetical by name within the same tier.
 *
 * Returns empty array when no candidate matches the muscle filter.
 */
export function findSwapCandidates(
  source: Exercise,
  opts: SwapOptions,
): SwapCandidate[] {
  const { allExercises, availableEquipment, excludeId, excludeIds } = opts;

  const primary = source.body_part;
  const secondary = source.target;
  const excluded = new Set(excludeIds);
  if (excludeId) excluded.add(excludeId);

  const candidates: SwapCandidate[] = [];

  for (const ex of allExercises) {
    if (excluded.has(ex.id)) continue;
    if (ex.body_part !== primary && ex.target !== secondary) continue;

    const primaryMatch = ex.body_part === primary;
    const secondaryMatch = !primaryMatch && ex.target === secondary;
    const equipmentAvailable = availableEquipment
      ? availableEquipment.has(ex.equipment)
      : isAvailableInMyGym(ex.equipment);

    candidates.push({ exercise: ex, primaryMatch, secondaryMatch, equipmentAvailable });
  }

  return rankCandidates(candidates, availableEquipment);
}

/**
 * Ranks candidates: primary > secondary match, then equipment available > not,
 * then alphabetical by name.
 */
function rankCandidates(
  candidates: SwapCandidate[],
  availableEquipment?: ReadonlySet<string>,
): SwapCandidate[] {
  const withEquipmentFilter = availableEquipment !== undefined;

  return [...candidates].sort((a, b) => {
    // Primary matches rank above secondary-only matches.
    if (a.primaryMatch !== b.primaryMatch) {
      return a.primaryMatch ? -1 : 1;
    }
    // When equipment filtering is active, available gear ranks above not.
    if (withEquipmentFilter && a.equipmentAvailable !== b.equipmentAvailable) {
      return a.equipmentAvailable ? -1 : 1;
    }
    // Alphabetical tiebreaker, on the Spanish label the list shows.
    return getExerciseDisplayName(a.exercise).localeCompare(
      getExerciseDisplayName(b.exercise),
      "es",
    );
  });
}

/**
 * Returns the full candidate list without equipment filtering — every exercise
 * that shares the primary or secondary muscle with `source`, excluding `source`
 * and any ids in `excludeIds`.
 *
 * Use this path when gym equipment data is absent so the user still sees
 * same-muscle alternatives rather than a blocked empty state.
 */
export function findAllSwapCandidates(
  source: Exercise,
  allExercises: Exercise[],
  excludeIds?: Set<string>,
): SwapCandidate[] {
  return findSwapCandidates(source, {
    allExercises,
    excludeId: source.id,
    excludeIds,
  });
}

/**
 * Filters a candidate list to only those whose equipment is available in the
 * user's gym. Used when gym settings exist and we want to narrow a list that
 * was already retrieved without equipment filtering.
 */
export function filterByEquipment(
  candidates: SwapCandidate[],
  availableEquipment: ReadonlySet<string>,
): SwapCandidate[] {
  return candidates.filter((c) => availableEquipment.has(c.exercise.equipment));
}

/**
 * Convenience: checks whether the user's gym has the equipment for `exercise`.
 * Uses the static `MY_GYM_EQUIPMENT_TAGS` as a fallback when no per-user set is
 * provided.
 */
export function exerciseAvailableInMyGym(exercise: Exercise): boolean {
  return isAvailableInMyGym(exercise.equipment);
}
