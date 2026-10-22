/**
 * pickerHelpers.ts — pure functions for searching, filtering and sorting the
 * exercise catalog for the ExercisePicker.
 *
 * No React, no Date.now(), no side-effects. Everything here is unit-testable
 * in isolation.
 *
 * Search behaviour:
 *  - The query is normalized (strip accents, lowercase, collapse whitespace).
 *  - It is matched against the exercise's display name (the Spanish one shown in
 *    the card), the body_part, the target and the equipment fields.
 *  - An alias map translates common Spanish terms to their English equivalent
 *    so that "fondos" finds "Parallel Bar Dips", "press de banca" finds
 *    "Barbell Bench", etc.
 */

import type { Exercise } from "@/types/supabase";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

export interface PickerFilters {
  /** Active slug selections from the muscle anatomy map. */
  muscles: string[];
  /** Selected body-part values ("all" means none). */
  bodyPart: string;
  /** Selected equipment values ("all" means none). */
  equipment: string;
  /** Selected target values ("all" means none). */
  target: string;
}

export const EMPTY_FILTERS: PickerFilters = {
  muscles: [],
  bodyPart: "all",
  equipment: "all",
  target: "all",
};

export type SortKey = "name" | "popularity";

/**
 * Alias map: Spanish search terms → English keywords that appear in catalog names.
 *
 * This is a *search* alias map for the words a user types that do not appear
 * verbatim in the Spanish display name ("patada" for kickbacks, "muerto" for
 * deadlift). Display names come from the Spanish catalog translation.
 * The keys are normalized (lowercase, no accents) so the lookup is
 * accent-insensitive.
 */
const SEARCH_ALIASES: Record<string, string[]> = {
  fondos: ["dips", "parallel"],
  press: ["press"],
  pressde: ["press"],
  bench: ["bench press", "chest press"],
  "press de banca": ["bench press"],
  "press banca": ["bench press"],
  pressdebanca: ["bench press"],
  pressbanca: ["bench press"],
  pressmilitar: ["shoulder press", "military press"],
  remo: ["row", "pullover"],
  curl: ["curl", "curls"],
  curlbde: ["barbell curl"],
  curlbiceps: ["curl", "biceps"],
  sentadilla: ["squat", "squad"],
  squat: ["squat"],
  peso: ["weight", "weighted"],
  muerto: ["deadlift", "romanian"],
  patada: ["kickback", "hip thrust", "glute bridge"],
  glute: ["glute", "hip thrust", "thrust"],
  abdominal: ["ab", "crunch", "sit-up"],
  plancha: ["plank", "ab"],
  pressfrances: ["overhead press", "arnold"],
  presscadera: ["hip thrust", "thrust"],
};

/**
 * Normalizes a string for matching: strips accents, lowercases, collapses
 * whitespace. Reuses the same algorithm as `normaliseExerciseName` so the
 * picker and the import wizard agree on what "equal enough" means.
 */
export function normaliseQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Returns the English keywords a normalized query maps to via the alias table.
 * Always returns at least the original query, so callers can treat the result
 * as a complete set of terms to check.
 */
export function expandQuery(query: string): string[] {
  const normalized = normaliseQuery(query);
  if (normalized === "") return [];

  const aliases = SEARCH_ALIASES[normalized];
  const tokens = normalized.split(" ").filter(Boolean);

  const expanded = new Set<string>([normalized]);
  for (const token of tokens) {
    const al = SEARCH_ALIASES[token];
    if (al) {
      for (const v of al) expanded.add(normaliseQuery(v));
    }
  }
  if (aliases) {
    for (const v of aliases) expanded.add(normaliseQuery(v));
  }

  return [...expanded];
}

/**
 * Returns true when the normalized `text` contains any of the expanded query
 * terms. Empty query matches everything.
 */
export function matchesQuery(text: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const normalized = normaliseQuery(text);
  for (const term of terms) {
    const t = normaliseQuery(term);
    if (t !== "" && normalized.includes(t)) return true;
  }
  return false;
}

/**
 * Filters exercises by a text query, matching against the display name, the
 * body_part, the target and the equipment fields. The display name is the
 * Spanish one shown in the card, so a query in Spanish finds what the user
 * sees; the catalog name is still matched too, and the Spanish aliases are
 * expanded so "fondos" finds "Dips".
 * Results are NOT sorted — callers apply sort after filtering.
 */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const terms = expandQuery(query);
  if (terms.length === 0) return exercises;

  return exercises.filter((e) => {
    return (
      matchesQuery(getExerciseDisplayName(e), terms) ||
      matchesQuery(e.name, terms) ||
      matchesQuery(e.body_part, terms) ||
      matchesQuery(e.target, terms) ||
      matchesQuery(e.equipment, terms)
    );
  });
}

/**
 * Applies attribute filters (body part, equipment, target) to a list.
 * Does NOT apply muscle-anatomy filtering — that is handled separately by
 * `filterByMuscles` in `muscleFilter.ts`, because muscle matching requires the
 * MatchLevel type that depends on `react-muscle-highlighter`.
 *
 * Returns a new array; does not mutate the input.
 */
export function filterExercises(
  exercises: Exercise[],
  filters: PickerFilters,
): Exercise[] {
  return exercises.filter((e) => {
    if (filters.bodyPart !== "all" && e.body_part !== filters.bodyPart) return false;
    if (filters.equipment !== "all" && e.equipment !== filters.equipment) return false;
    if (filters.target !== "all" && e.target !== filters.target) return false;
    return true;
  });
}

/**
 * Sorts a list of exercises.
 *
 * `name` sorts alphabetically by the Spanish display name, which is the name
 * the card shows.
 * `popularity` sorts primary muscle matches first, preserving original order
 * within each group — used by the muscle-map view to surface the best matches.
 */
export function sortExercises(
  exercises: Exercise[],
  sortBy: SortKey,
  primaryIds?: Set<string>,
): Exercise[] {
  if (sortBy === "name") {
    return [...exercises].sort((a, b) =>
      getExerciseDisplayName(a).localeCompare(getExerciseDisplayName(b), "es"),
    );
  }

  // "popularity": primary matches first (stable), then the rest in original order.
  const primary = primaryIds ?? new Set<string>();
  return [...exercises].sort((a, b) => {
    const ap = primary.has(a.id) ? 0 : 1;
    const bp = primary.has(b.id) ? 0 : 1;
    return ap - bp;
  });
}

/**
 * Builds the list of distinct `body_part` values present in the catalog, sorted
 * by their Spanish label for display. "all" is prepended as the pseudo-option.
 */
export function collectBodyParts(exercises: Exercise[]): string[] {
  const set = new Set(exercises.map((e) => e.body_part));
  return ["all", ...set];
}

/**
 * Builds the list of distinct `equipment` values present in the catalog.
 * "all" is prepended as the pseudo-option.
 */
export function collectEquipment(exercises: Exercise[]): string[] {
  const set = new Set(exercises.map((e) => e.equipment));
  return ["all", ...set];
}

/**
 * Builds the list of distinct `target` values present in the catalog.
 * "all" is prepended as the pseudo-option.
 */
export function collectTargets(exercises: Exercise[]): string[] {
  const set = new Set(exercises.map((e) => e.target));
  return ["all", ...set];
}
