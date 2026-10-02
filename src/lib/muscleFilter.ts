/**
 * muscleFilter.ts — the library filter's anatomy dimension.
 *
 * Pure functions, no React. `ExerciseBrowser` renders the result; this file
 * decides what belongs in it. Keeping the selection logic out of the component is
 * what makes multi-select, primary-first ordering and the "why is this empty"
 * hint unit-testable without a DOM.
 *
 * The core rule: a selection is a UNION of muscles (OR), which then combines
 * with the text query, body part, equipment and gym filters using AND. Anatomy
 * narrows by region while the other filters narrow by attributes, so treating
 * them the same way would be wrong.
 */

import type { Slug } from "react-muscle-highlighter";
import { muscleMatchLevel, muscleDefinition, type MatchLevel } from "./muscleMap";

/** Minimal shape this module needs; avoids importing the whole DB row type. */
export interface FilterableExercise {
  id: string;
  name: string;
  body_part: string;
  target: string;
  equipment: string;
}

/** The non-anatomy filter state, shared with the browser component. */
export interface BaseFilters {
  query: string;
  bodyPart: string;
  equipment: string;
  target: string;
  onlyMyGym: boolean;
}

export const EMPTY_BASE_FILTERS: BaseFilters = {
  query: "",
  bodyPart: "all",
  equipment: "all",
  target: "all",
  onlyMyGym: false,
};

/**
 * Which muscle a selection would need to drop to make results reappear.
 *
 * The empty state is the one place where a filter's existence has to be
 * explained in words, so the choice of what to blame is product behaviour, not
 * formatting. Blame the *most recently applied* narrowest filter: that is the
 * one the user just added and the one they will most want to undo.
 */
export interface EmptyCause {
  /** Spanish message, e.g. "Sin resultados para Antebrazo." */
  message: string;
  /** Label of the filter to blame. */
  label: string;
  /** What removing it would do. */
  action: string;
}

/**
 * Decides whether a piece of equipment counts for "Solo mi gym".
 *
 * Supplied by the caller rather than imported, so this module stays free of the
 * gym's equipment dataset and a pure filter stays a pure function. Defaults to
 * allowing everything, which is the correct behaviour when the caller does not
 * care about the gym filter at all.
 */
export type EquipmentMatcher = (equipment: string) => boolean;

const ALLOW_ANY_EQUIPMENT: EquipmentMatcher = () => true;

export interface BaseFilterOptions {
  isMyGymEquipment?: EquipmentMatcher;
}

/** Applies the non-anatomy filters. */
export function applyBaseFilters<T extends FilterableExercise>(
  exercises: T[],
  filters: BaseFilters,
  options: BaseFilterOptions = {},
): T[] {
  const q = filters.query.trim().toLowerCase();
  const matcher = options.isMyGymEquipment ?? ALLOW_ANY_EQUIPMENT;
  return exercises.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q)) return false;
    if (filters.bodyPart !== "all" && e.body_part !== filters.bodyPart) return false;
    if (filters.equipment !== "all" && e.equipment !== filters.equipment) return false;
    if (filters.target !== "all" && e.target !== filters.target) return false;
    if (filters.onlyMyGym && !matcher(e.equipment)) return false;
    return true;
  });
}

/**
 * Adds an exercise to a selection, or removes it when already present.
 *
 * Returns a new array rather than mutating, so the result can be compared by
 * identity in React state and so `useMemo` dependencies stay honest.
 */
export function toggleMuscle(selection: Slug[], slug: Slug): Slug[] {
  return selection.includes(slug)
    ? selection.filter((s) => s !== slug)
    : [...selection, slug];
}

/** Parses the URL fragment used to persist the selection across navigation. */
export function parseMuscleParam(raw: string | null): Slug[] {
  if (!raw) return [];
  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Reject anything the library does not know, so a stale or hand-edited URL
  // cannot inject a slug that renders as an unclickable shape.
  return slugs.filter((s): s is Slug => muscleDefinition(s as Slug)?.enabled === true);
}

/** Serialises the selection for the URL. Order-stable so it does not churn. */
export function serializeMuscleParam(selection: Slug[]): string | null {
  if (selection.length === 0) return null;
  return [...selection].sort().join(",");
}

export interface MuscleFilterResult<T extends FilterableExercise> {
  results: T[];
  /** Per-exercise best level across the whole selection, used for ordering. */
  levelById: Map<string, MatchLevel>;
}

/**
 * Applies the anatomy selection on top of the base filters.
 *
 * Ordering: primary matches first, then secondary, and the original catalog
 * order within each group. Sorting on the match level rather than on name keeps
 * the catalog's own ordering intact for the group it applies to, so the list
 * does not reshuffle every time a second muscle is added.
 */
export function filterByMuscles<T extends FilterableExercise>(
  base: T[],
  selection: Slug[],
): MuscleFilterResult<T> {
  const levelById = new Map<string, MatchLevel>();
  if (selection.length === 0) {
    return { results: base, levelById };
  }

  const kept = base.filter((e) => {
    let best: MatchLevel | null = null;
    for (const slug of selection) {
      const level = muscleMatchLevel(e, slug);
      // A muscle can match through both a primary and a secondary route in the
      // same selection; primary wins so the exercise is not demoted.
      if (level === "primary") {
        best = "primary";
        break;
      }
      if (level === "secondary") best = "secondary";
    }
    if (!best) return false;
    levelById.set(e.id, best);
    return true;
  });

  const results = kept
    .map((exercise, index) => ({
      exercise,
      index,
      level: levelById.get(exercise.id) ?? "secondary",
    }))
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === "primary" ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.exercise);

  return { results, levelById };
}

/**
 * Decides which filter to blame when the selection returns nothing.
 *
 * Returns null when the base filters alone already return nothing, because then
 * the anatomy selection is not the cause and blaming it would mislead.
 */
export function explainEmpty<T extends FilterableExercise>(
  baseFiltered: T[],
  allExercises: T[],
  selection: Slug[],
  filters: BaseFilters,
  labels: EmptyStateLabels,
  options: BaseFilterOptions = {},
): EmptyCause | null {
  if (baseFiltered.length > 0) {
    // Only the anatomy filter can be at fault here.
    return {
      message: labels.emptyWithMuscle(selectionLabels(selection)),
      label: selectionLabels(selection),
      action: labels.suggestDropMuscle,
    };
  }

  // Nothing survives the base filters. Bisect one attribute at a time: the
  // cheapest way to find the culprit without rendering every combination.
  const without = (patch: Partial<BaseFilters>): boolean =>
    applyBaseFilters(allExercises, { ...filters, ...patch }, options).length > 0;

  const q = filters.query.trim();
  if (q !== "" && without({ query: "" })) {
    return { message: `Sin resultados para "${q}".`, label: q, action: labels.suggestDropSearch };
  }
  if (filters.equipment !== "all" && without({ equipment: "all" })) {
    return {
      message: `Sin ejercicios con ${filters.equipment}.`,
      label: filters.equipment,
      action: labels.suggestDropEquipment,
    };
  }
  if (filters.target !== "all" && without({ target: "all" })) {
    return {
      message: `Sin ejercicios de ${filters.target}.`,
      label: filters.target,
      action: labels.suggestDropEverything,
    };
  }
  if (filters.bodyPart !== "all" && without({ bodyPart: "all" })) {
    return {
      message: `Sin ejercicios de ${filters.bodyPart}.`,
      label: filters.bodyPart,
      action: labels.suggestDropEverything,
    };
  }
  if (filters.onlyMyGym && without({ onlyMyGym: false })) {
    return {
      message: "Sin ejercicios con el equipamiento de tu gym.",
      label: "Solo mi gym",
      action: labels.suggestDropEverything,
    };
  }
  return null;
}

/** Copy the empty state needs, injected so this module stays presentation-free. */
export interface EmptyStateLabels {
  emptyWithMuscle: (muscleLabel: string) => string;
  suggestDropSearch: string;
  suggestDropEquipment: string;
  suggestDropMuscle: string;
  suggestDropEverything: string;
}

/** Comma-joined Spanish labels for a selection, for chips and messages. */
export function selectionLabels(selection: Slug[]): string {
  const labels = selection
    .map((slug) => muscleDefinition(slug)?.label)
    .filter((l): l is string => Boolean(l));
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

/** Per-muscle counts over an already-base-filtered list, for the legend. */
export function muscleCounts<T extends FilterableExercise>(
  baseFiltered: T[],
  slugs: Slug[],
): Map<Slug, number> {
  const counts = new Map<Slug, number>();
  for (const slug of slugs) counts.set(slug, 0);
  for (const exercise of baseFiltered) {
    for (const slug of slugs) {
      if (muscleMatchLevel(exercise, slug) !== null) {
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * Which view a selection is visible from.
 *
 * Used to badge the front/back toggle: without it, selecting "Glúteos" then
 * flipping to the front view looks like the selection was lost, when the muscle
 * is simply not drawn there.
 */
export function selectionSides(selection: Slug[]): { front: boolean; back: boolean } {
  const front = selection.some((s) => FRONT_ONLY.has(s) || BOTH_SIDES.has(s));
  const back = selection.some((s) => BACK_ONLY.has(s) || BOTH_SIDES.has(s));
  return { front, back };
}

/** Muscles the library only draws on the front view. */
const FRONT_ONLY = new Set<Slug>([
  "chest",
  "obliques",
  "abs",
  "biceps",
  "quadriceps",
  "knees",
  "tibialis",
]);

/** Muscles the library only draws on the back view. */
const BACK_ONLY = new Set<Slug>(["upper-back", "lower-back", "gluteal", "hamstring"]);

/** Muscles drawn on both views. */
const BOTH_SIDES = new Set<Slug>([
  "triceps",
  "neck",
  "trapezius",
  "deltoids",
  "adductors",
  "calves",
  "forearm",
  "hands",
  "ankles",
  "feet",
  "head",
  "hair",
]);