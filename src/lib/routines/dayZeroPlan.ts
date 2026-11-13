/**
 * dayZeroPlan.ts — the "Cronos Smart Day 0" routine, as data.
 *
 * The assistant asks three questions and produces a plan: which days, which
 * exercises, how many sets and how much weight. The plan is built here, away
 * from the component, because three other things need exactly the same answer:
 * the screen that shows it, the routine that is written to Supabase, and the row
 * that appears in "Mis Rutinas" before the network has answered.
 *
 * The catalog constraint is the point of the module: a plan may only contain
 * exercises the gym can actually host. That is the shipped `availableInCronosGym`
 * flag *and* a station that is not `unavailable_station`, because ten rows claim
 * to be available while pointing at a station that cannot host a session.
 *
 * Selection is balanced by biomechanical pattern so a plan is not ten variations
 * of the same movement: patterns are visited in compound-first order and each day
 * takes one exercise per pattern before taking a second.
 */

import type { Exercise } from "@/types/supabase";
import type { PlannedExercise, RoutineWithExercises } from "@/hooks/useGymData";
import { resolveCatalogExercise } from "@/lib/catalog/resolveExercise";
import type { CatalogExercise } from "@/lib/catalog/types";
import { estimateSmartLoad } from "@/lib/workout/cronosSmartEngine";
import type { RoutineDay, RoutineDraftV2 } from "./routineDayModel";
import { newDraftKey } from "./routineDayModel";
import { buildRoutineDescription } from "./routineMeta";

export type DayZeroFrequency = 2 | 3 | 4 | 5;
export type DayZeroGoal = "strength" | "hypertrophy" | "general_fitness";
export type DayZeroLevel = "beginner" | "intermediate" | "advanced";

/** Rest between sets, in seconds, for a plan generated without history. */
export const DAY_ZERO_REST_SECONDS = 90;

/** A day of the plan, with the catalog row each exercise came from. */
export interface DayZeroPlanExercise {
  row: CatalogExercise;
  rowId: string;
  sets: number;
  reps: number;
  weightKg: number;
}

export interface DayZeroPlanDay {
  id: string;
  label: string;
  exercises: DayZeroPlanExercise[];
}

export interface DayZeroPlan {
  title: string;
  frequency: DayZeroFrequency;
  goal: DayZeroGoal;
  level: DayZeroLevel;
  days: DayZeroPlanDay[];
}

/** Compound first, isolation last: the order the days are filled in. */
const PATTERN_ORDER = [
  "squat",
  "hinge",
  "horizontal_push",
  "horizontal_pull",
  "extension",
  "curl",
  "isolation",
] as const;

const SETS_BY_GOAL: Record<DayZeroGoal, number> = {
  strength: 4,
  hypertrophy: 3,
  general_fitness: 3,
};

const REPS_BY_GOAL: Record<DayZeroGoal, number> = {
  strength: 5,
  hypertrophy: 10,
  general_fitness: 8,
};

/** A row the gym can host: available, and not pointing at an unusable station. */
export function isAvailableForDayZero(row: CatalogExercise): boolean {
  return row.availableInCronosGym !== false && row.station_key !== "unavailable_station";
}

/** New id for a plan day or an exercise link. Injectable so tests are stable. */
export type DayZeroIdFactory = () => string;

function defaultIdFactory(): DayZeroIdFactory {
  return () =>
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `day-zero-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function patternOf(row: CatalogExercise): string {
  return row.movement_pattern ?? "isolation";
}

/**
 * Picks the exercises of one day: one per pattern before a second of the same
 * pattern, and a different muscle group when the catalog can offer one.
 */
function pickForDay(
  queues: Map<string, CatalogExercise[]>,
  used: Set<string>,
  perDay: number,
): CatalogExercise[] {
  const picked: CatalogExercise[] = [];
  const muscles = new Set<string>();

  for (const pattern of PATTERN_ORDER) {
    if (picked.length >= perDay) break;
    const queue = queues.get(pattern);
    if (!queue) continue;
    const row =
      queue.find((candidate) => !used.has(candidate.id) && !muscles.has(candidate.muscle_group)) ??
      queue.find((candidate) => !used.has(candidate.id));
    if (!row) continue;
    picked.push(row);
    used.add(row.id);
    muscles.add(row.muscle_group);
  }

  // A day may still be short when the catalog ran out of patterns: fill it with
  // whatever is left, still without repeating a muscle group if possible.
  if (picked.length < perDay) {
    for (const queue of queues.values()) {
      for (const row of queue) {
        if (picked.length >= perDay) break;
        if (used.has(row.id) || muscles.has(row.muscle_group)) continue;
        picked.push(row);
        used.add(row.id);
        muscles.add(row.muscle_group);
      }
      if (picked.length >= perDay) break;
    }
  }

  return picked;
}

export interface BuildDayZeroPlanParams {
  catalog: readonly CatalogExercise[];
  frequency: DayZeroFrequency;
  goal: DayZeroGoal;
  level: DayZeroLevel;
  /** Exercises per training day. Defaults to six. */
  perDay?: number;
  newId?: DayZeroIdFactory;
}

/**
 * Builds a plan from the catalog. Returns a plan whose days are all training
 * days; a catalog with nothing available yields zero days rather than a plan that
 * cannot be trained.
 */
export function buildDayZeroPlan({
  catalog,
  frequency,
  goal,
  level,
  perDay = 6,
  newId = defaultIdFactory(),
}: BuildDayZeroPlanParams): DayZeroPlan {
  const available = catalog.filter(isAvailableForDayZero);
  const queues = new Map<string, CatalogExercise[]>();
  for (const row of available) {
    const pattern = patternOf(row);
    const queue = queues.get(pattern);
    if (queue) queue.push(row);
    else queues.set(pattern, [row]);
  }

  const used = new Set<string>();
  const days: DayZeroPlanDay[] = [];
  const safeFrequency = Math.min(Math.max(frequency, 1), 7);
  for (let index = 0; index < safeFrequency; index += 1) {
    const picked = pickForDay(queues, used, perDay);
    // A day with nothing to train is not a day: writing it would leave a routine
    // card that cannot be started.
    if (picked.length === 0) break;
    const exercises = picked.map((row) => {
      const load = estimateSmartLoad({
        mode: "biometric_day_0",
        targetStation: row.station_key,
        movementPattern: row.movement_pattern,
        experienceLevel: level,
        targetReps: REPS_BY_GOAL[goal],
        weightKg: 65,
      });
      return {
        row,
        rowId: newId(),
        sets: SETS_BY_GOAL[goal],
        reps: load.suggestedReps,
        weightKg: load.weightKg,
      };
    });
    days.push({
      id: newId(),
      label: `Día ${String.fromCharCode(65 + index)}`,
      exercises,
    });
  }

  return {
    // The title counts the days that were actually written: a catalog that
    // cannot fill the frequency must not promise days the routine does not have.
    title: `Cronos Day 0 · ${days.length} ${days.length === 1 ? "día" : "días"}`,
    frequency: safeFrequency as DayZeroFrequency,
    goal,
    level,
    days,
  };
}

/**
 * The plan as the draft the routine saver writes.
 *
 * `routineId` is null for a new routine: the saver generates the id and returns
 * it, so the optimistic row can be replaced by the saved one once it exists.
 */
export function dayZeroDraft(plan: DayZeroPlan, routineId: string | null): RoutineDraftV2 {
  const days: RoutineDay[] = plan.days.map((day, index) => ({
    id: day.id,
    order: index,
    weekday: null,
    label: day.label,
    kind: "training",
    exercises: day.exercises.map((exercise, position) => ({
      exercise: toPlanExercise(exercise.row),
      rowId: exercise.rowId,
      target_sets: exercise.sets,
      rest_seconds: DAY_ZERO_REST_SECONDS,
      order_index: position,
      target_reps_min: Math.max(1, exercise.reps - 1),
      target_reps_max: exercise.reps + 1,
    })),
  }));

  return {
    draftKey: newDraftKey(),
    id: routineId,
    title: plan.title,
    description: plan.title,
    mode: "single",
    days,
    snapshot: null,
    needsModeConfirmation: false,
  };
}

/**
 * The plan as a routine row, before the server has confirmed it.
 *
 * The description is the same JSON envelope `saveRoutine` writes, so the card and
 * the editor read the optimistic row exactly as they will read the saved one.
 */
export function dayZeroRoutineRow(
  plan: DayZeroPlan,
  routineId: string,
  userId: string,
  createdAt: string = new Date().toISOString(),
): RoutineWithExercises & { routineMode: "single" } {
  const description = buildRoutineDescription(plan.title, {
    mode: "single",
    days: plan.days.map((day, index) => ({
      id: day.id,
      order: index,
      weekday: null,
      label: day.label,
      kind: "training",
    })),
  });

  const exercises: PlannedExercise[] = plan.days.flatMap((day, dayIndex) =>
    day.exercises.map((exercise, position) => ({
      exercise: toPlanExercise(exercise.row),
      target_sets: exercise.sets,
      rest_seconds: DAY_ZERO_REST_SECONDS,
      rowId: exercise.rowId,
      order_index: position,
      target_reps_min: Math.max(1, exercise.reps - 1),
      target_reps_max: exercise.reps + 1,
      dayIndex,
      dayLabel: day.label,
      groupId: null,
    })),
  );

  return {
    id: routineId,
    user_id: userId,
    title: plan.title,
    description,
    created_at: createdAt,
    is_favorite: false,
    source: "ai",
    authored_by_coach: null,
    is_template: false,
    exercises,
    routineMode: "single",
  };
}

/** The catalog row as the exercise shape a routine link stores. */
export function toPlanExercise(row: CatalogExercise): Exercise {
  const resolved = resolveCatalogExercise(row);
  return {
    id: resolved.id,
    name: resolved.name,
    name_es: resolved.nameEs,
    body_part: resolved.body_part,
    target: resolved.target,
    equipment: resolved.equipment,
    gif_url: resolved.effectiveGifUrl,
    instructions: resolved.instruction_steps?.es ?? [],
    is_active: true,
    is_hidden: false,
  };
}