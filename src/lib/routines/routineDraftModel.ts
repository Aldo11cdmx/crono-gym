/**
 * routineDraftModel.ts — the shape of a routine being built, and the pure
 * helpers that operate on it.
 *
 * Split from persistence (`routineSave.ts`) and from presentation so the
 * model can be unit-tested against literals with no database and no DOM.
 *
 * The fields mirror `routine_exercises.Row` so a draft maps field-for-field:
 *   - `exercise` carries the full Exercise for immediate display, the way
 *     `PlannedExercise` in `useGymData` does.
 *   - `targetRepsMin` / `targetRepsMax` map to the nullable columns, defaulting
 *     to `null` ("unspecified") rather than guessing.
 *   - `dayIndex` / `dayLabel` map to the multi-day columns.
 */

import type { Exercise } from "@/types/supabase";

/** One movement in the draft, with its prescription. */
export interface DraftExercise {
  exercise: Exercise;
  target_sets: number;
  rest_seconds: number;
  /** 1-based count within the day, preserved through reorders. */
  order_index: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  /**
   * The superset this movement belongs to, when it is in one.
   *
   * Two movements that share a group id are performed back to back, the way
   * Hevy and Symmetry write a superset. Optional and nullable because both
   * are real answers: a routine written before supersets existed has no
   * grouping to carry, and a movement that stands alone is not in one.
   *
   * The column it belongs to arrives with the superset migration, so the save
   * path does not write it yet -- see `routineSave.ts`.
   */
  groupId?: string | null;
}

/**
 * A draft routine.
 *
 * `id` is null for a new routine, set for an existing one being edited.
 * `dayIndex` / `dayLabel` describe which day this draft occupies in the
 * routine's calendar, matching `routine_exercises.day_index` / `day_label`.
 */
export interface RoutineDraft {
  id: string | null;
  title: string;
  description: string;
  dayIndex: number;
  dayLabel: string;
  items: DraftExercise[];
}

/** The problem type shared by the validator. */
export type DraftProblem = "noTitle" | "noExercises";

export const DEFAULT_REST_SECONDS = 90;
export const DEFAULT_SETS = 3;

/** A draft with no exercises, useful for seeding a new builder. */
export function emptyDraft(): RoutineDraft {
  return {
    id: null,
    title: "",
    description: "",
    dayIndex: 0,
    dayLabel: "",
    items: [],
  };
}

/**
 * Why this draft cannot be saved, or null when it can.
 *
 * Mirrors the rule in `coachRoutineDraft.draftProblem`: a routine needs a
 * title and at least one exercise. The exercise rows always carry a real
 * Exercise object (the browser only yields catalog rows), so there is no
 * "unpicked exercise" problem here.
 */
export function draftProblem(draft: RoutineDraft): DraftProblem | null {
  if (draft.title.trim() === "") return "noTitle";
  if (draft.items.length === 0) return "noExercises";
  return null;
}

/** True when the draft passes every validation rule. */
export function isSavableDraft(draft: RoutineDraft): boolean {
  return draftProblem(draft) === null;
}

/**
 * Human-readable display name for an exercise.
 *
 * Falls back to the raw id when the name is missing, so a card never renders
 * an empty label from a malformed row.
 */
export function getExerciseName(exercise: Exercise): string {
  return exercise.name && exercise.name.trim() !== ""
    ? exercise.name
    : `#${exercise.id}`;
}

/**
 * Human-readable rep-range label for a draft exercise.
 *
 * - "3 series" when reps are unspecified.
 * - "3 × 8-10" when both bounds are present.
 * - "3 × 8+" when only a minimum exists (the upper bound is open).
 */
export function getRepLabel(item: DraftExercise): string {
  const sets = item.target_sets;
  const min = item.target_reps_min;
  const max = item.target_reps_max;

  if (min !== null && max !== null && min === max) {
    return `${sets} × ${min}`;
  }
  if (min !== null && max !== null) {
    return `${sets} × ${min}-${max}`;
  }
  if (min !== null) {
    return `${sets} × ${min}+`;
  }
  return `${sets} series`;
}

/**
 * Rough duration estimate in minutes for a draft.
 *
 * 3 min of work per exercise plus the summed rest, floored at 15 so a
 * single-movement routine does not report 0. Matches the heuristic in
 * `dashboardMetrics.estimateDurationMin` so the two surfaces agree.
 */
export function estimateRoutineDuration(draft: RoutineDraft): number {
  if (draft.items.length === 0) return 0;

  const workMin = draft.items.length * 3;
  const restSec = draft.items.reduce((sum, item) => sum + (item.rest_seconds ?? 0), 0);
  const restMin = Math.round(restSec / 60);

  return Math.max(15, workMin + restMin);
}

/**
 * Builds the list of `(dayIndex, dayLabel)` entries for a multi-day routine.
 *
 * In the current single-day draft, this is just the one day. Kept as a function
 * so a future multi-day builder can feed the same call site without changes.
 */
export function routineDayEntries(draft: RoutineDraft): {
  dayIndex: number;
  dayLabel: string;
}[] {
  return [{ dayIndex: draft.dayIndex, dayLabel: draft.dayLabel }];
}
