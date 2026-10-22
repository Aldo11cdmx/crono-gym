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
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

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
   * Hevy and Cronos write a superset. Optional and nullable because both
   * are real answers: a routine written before supersets existed has no
   * grouping to carry, and a movement that stands alone is not in one.
   *
   * The column it belongs to arrives with the superset migration, so the save
   * path does not write it yet -- see `routineSave.ts`.
   */
  groupId?: string | null;
  /**
   * Which day of a weekly plan this movement belongs to (0 = Monday).
   *
   * Absent for a single-day routine, which is the common case: the day's
   * index then comes from the draft itself.
   */
  dayIndex?: number;
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
  /**
   * The session name of each day of a weekly plan, keyed by day index.
   *
   * A weekly plan is one routine whose movements are spread over the seven
   * days of the week, each day with its own name ("Lunes: Empuje Pro"). The
   * names live here rather than on the movements because a day can be named
   * before it has any movement in it, and because renaming a day must not
   * rewrite every row that belongs to it.
   */
  dayLabels?: Record<number, string>;
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
    dayLabels: {},
  };
}

/** The seven days of a week, Monday first. */
export const WEEK_DAYS = 7;

/**
 * The movements of a draft, bucketed by the day they belong to.
 *
 * Always seven buckets, in calendar order, so a caller can render a weekly
 * plan without checking which days exist. A movement with no day of its own
 * belongs to the draft's own day.
 */
export function itemsByDay(draft: RoutineDraft): DraftExercise[][] {
  const buckets: DraftExercise[][] = Array.from(
    { length: WEEK_DAYS },
    () => [] as DraftExercise[],
  );
  for (const item of draft.items) {
    const day = item.dayIndex ?? draft.dayIndex;
    if (day < 0 || day >= WEEK_DAYS) continue;
    buckets[day].push(item);
  }
  return buckets;
}

/** The session name of a day, or an empty string when it has none. */
export function dayLabelFor(draft: RoutineDraft, dayIndex: number): string {
  return draft.dayLabels?.[dayIndex] ?? "";
}

/** A copy of the draft with the session name of a day set. */
export function withDayLabel(
  draft: RoutineDraft,
  dayIndex: number,
  label: string,
): RoutineDraft {
  return {
    ...draft,
    dayLabels: { ...(draft.dayLabels ?? {}), [dayIndex]: label },
  };
}

/**
 * Rough duration estimate in minutes for a set of movements.
 *
 * 3 min of work per exercise plus the summed rest, floored at 15 so a
 * single-movement routine does not report 0. Matches the heuristic in
 * `dashboardMetrics.estimateDurationMin` so the two surfaces agree.
 */
export function estimateMinutes(
  itemCount: number,
  restSeconds: number,
): number {
  if (itemCount === 0) return 0;
  const workMin = itemCount * 3;
  const restMin = Math.round(restSeconds / 60);
  return Math.max(15, workMin + restMin);
}

/**
 * Rough duration estimate in minutes for a draft.
 *
 * 3 min of work per exercise plus the summed rest, floored at 15 so a
 * single-movement routine does not report 0. Matches the heuristic in
 * `dashboardMetrics.estimateDurationMin` so the two surfaces agree.
 */
export function estimateRoutineDuration(draft: RoutineDraft): number {
  const restSec = draft.items.reduce(
    (sum, item) => sum + (item.rest_seconds ?? 0),
    0,
  );
  return estimateMinutes(draft.items.length, restSec);
}

/**
 * Builds the list of `(dayIndex, dayLabel)` entries for a multi-day routine.
 *
 * For a single-day draft this is just the one day. For a weekly plan it is one
 * entry per day that has movements or a name of its own, which is what the
 * dashboard reads to label "today".
 */
export function routineDayEntries(draft: RoutineDraft): {
  dayIndex: number;
  dayLabel: string;
}[] {
  const buckets = itemsByDay(draft);
  const entries: { dayIndex: number; dayLabel: string }[] = [];

  for (let day = 0; day < WEEK_DAYS; day++) {
    const label = dayLabelFor(draft, day);
    if (buckets[day].length === 0 && label.trim() === "") continue;
    entries.push({ dayIndex: day, dayLabel: label });
  }

  if (entries.length === 0) {
    return [{ dayIndex: draft.dayIndex, dayLabel: draft.dayLabel }];
  }
  return entries;
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
 * The Spanish label is the app's single vocabulary for an exercise name, so it
 * is the one every screen shows. Falls back to the raw id when the name is
 * missing, so a card never renders an empty label from a malformed row.
 */
export function getExerciseName(exercise: Exercise): string {
  const displayName = getExerciseDisplayName(exercise);
  return displayName && displayName.trim() !== ""
    ? displayName
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
