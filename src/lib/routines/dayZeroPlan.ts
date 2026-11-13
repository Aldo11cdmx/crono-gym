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
 * Selection is anatomical, not pattern-by-pattern: the dataset has seven movement
 * patterns for 1,324 rows, so pattern balancing alone produced days that were six
 * variations of the same hinge. Each frequency has its own day template (push /
 * pull / legs, upper / lower, V-taper) and each slot names a muscle group. Within
 * a group the machine comes first, because a first session happens without a
 * spotter, and one exercise per group is taken before a second.
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

/**
 * The nine groups a session can be built from.
 *
 * They are the coach's groups, not the dataset's: the catalog says `forearms`,
 * `traps`, `hip flexors` and `ankles`, which are not days anyone trains, so they
 * land where they belong — traps and rhomboids in the back, grip and hips in core.
 */
export type DayZeroGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "posterior_leg"
  | "calves"
  | "core";

const MUSCLE_TO_GROUP: Record<string, DayZeroGroup> = {
  chest: "chest",
  lats: "back",
  "latissimus dorsi": "back",
  "upper back": "back",
  "lower back": "back",
  rhomboids: "back",
  trapezius: "back",
  traps: "back",
  shoulders: "shoulders",
  deltoids: "shoulders",
  "rotator cuff": "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  quads: "quads",
  quadriceps: "quads",
  hamstrings: "posterior_leg",
  glute: "posterior_leg",
  glutes: "posterior_leg",
  calves: "calves",
  soleus: "calves",
  core: "core",
  abs: "core",
  abdominals: "core",
  obliques: "core",
  "hip flexors": "core",
  forearms: "core",
  "wrist flexors": "core",
  "wrist extensors": "core",
  wrists: "core",
  hands: "core",
  ankles: "core",
  "ankle stabilizers": "core",
};

/** The label the athlete reads, in the interface's language. */
const GROUP_LABELS: Record<DayZeroGroup, string> = {
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  quads: "Cuádriceps",
  posterior_leg: "Isquios y glúteos",
  calves: "Pantorrillas",
  core: "Core y agarre",
};

/** A slot of a day: one group, and how many exercises come from it. */
interface DaySlot {
  group: DayZeroGroup;
  count: number;
}

/** One training day of a split, in the order its exercises are taken. */
interface DayTemplate {
  label: string;
  slots: DaySlot[];
}

/**
 * The splits, one per frequency.
 *
 * Three days is push / pull / legs, four is upper / lower twice, five is the
 * V-taper the gym trains (push, pull, legs, then shoulders and back again, since
 * delts and lats respond to frequency). Two days is full body twice: a first
 * routine has to repeat every pattern, not specialise.
 */
const DAY_TEMPLATES: Record<DayZeroFrequency, DayTemplate[]> = {
  2: [
    {
      label: "Full body A",
      slots: [
        { group: "quads", count: 1 },
        { group: "chest", count: 1 },
        { group: "back", count: 2 },
        { group: "posterior_leg", count: 1 },
        { group: "core", count: 1 },
      ],
    },
    {
      label: "Full body B",
      slots: [
        { group: "posterior_leg", count: 1 },
        { group: "shoulders", count: 1 },
        { group: "back", count: 1 },
        { group: "quads", count: 1 },
        { group: "biceps", count: 1 },
        { group: "core", count: 1 },
      ],
    },
  ],
  3: [
    {
      label: "Empuje",
      slots: [
        { group: "chest", count: 2 },
        { group: "shoulders", count: 2 },
        { group: "triceps", count: 2 },
      ],
    },
    {
      label: "Tirón",
      slots: [
        { group: "back", count: 3 },
        { group: "biceps", count: 2 },
        { group: "shoulders", count: 1 },
      ],
    },
    {
      label: "Pierna",
      slots: [
        { group: "quads", count: 2 },
        { group: "posterior_leg", count: 2 },
        { group: "calves", count: 1 },
        { group: "core", count: 1 },
      ],
    },
  ],
  4: [
    {
      label: "Tren superior A",
      slots: [
        { group: "chest", count: 2 },
        { group: "back", count: 2 },
        { group: "shoulders", count: 1 },
        { group: "triceps", count: 1 },
      ],
    },
    {
      label: "Tren inferior A",
      slots: [
        { group: "quads", count: 2 },
        { group: "posterior_leg", count: 2 },
        { group: "calves", count: 1 },
        { group: "core", count: 1 },
      ],
    },
    {
      label: "Tren superior B",
      slots: [
        { group: "back", count: 2 },
        { group: "shoulders", count: 2 },
        { group: "chest", count: 1 },
        { group: "biceps", count: 1 },
      ],
    },
    {
      label: "Tren inferior B",
      slots: [
        { group: "posterior_leg", count: 2 },
        { group: "quads", count: 2 },
        { group: "calves", count: 1 },
        { group: "core", count: 1 },
      ],
    },
  ],
  5: [
    {
      label: "Empuje A",
      slots: [
        { group: "chest", count: 2 },
        { group: "shoulders", count: 2 },
        { group: "triceps", count: 1 },
        { group: "core", count: 1 },
      ],
    },
    {
      label: "Tirón A",
      slots: [
        { group: "back", count: 3 },
        { group: "biceps", count: 2 },
        { group: "core", count: 1 },
      ],
    },
    {
      label: "Pierna",
      slots: [
        { group: "quads", count: 2 },
        { group: "posterior_leg", count: 2 },
        { group: "calves", count: 1 },
        { group: "core", count: 1 },
      ],
    },
    {
      label: "Empuje B",
      slots: [
        { group: "shoulders", count: 2 },
        { group: "chest", count: 2 },
        { group: "triceps", count: 2 },
      ],
    },
    {
      label: "Tirón B",
      slots: [
        { group: "back", count: 3 },
        { group: "biceps", count: 2 },
        { group: "shoulders", count: 1 },
      ],
    },
  ],
};

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

/** The group a catalog row belongs to, for the day templates above. */
export function groupOf(row: CatalogExercise): DayZeroGroup {
  const key = (row.muscle_group ?? "").trim().toLowerCase();
  return MUSCLE_TO_GROUP[key] ?? "core";
}

/** Whether the row is done on a machine rather than with free weights. */
function isMachine(row: CatalogExercise): boolean {
  return Boolean(row.equipment_id) && row.equipment_id !== "NONE";
}

/**
 * Picks the exercises of one group: machines first, then the compound pattern of
 * the group, and a different muscle when the catalog can offer one.
 *
 * `used` is shared across the whole plan: an exercise is never written twice,
 * because the same movement on two days is a plan the athlete cannot progress.
 */
function pickFromGroup(
  queue: readonly CatalogExercise[],
  used: Set<string>,
  count: number,
): CatalogExercise[] {
  const picked: CatalogExercise[] = [];
  const muscles = new Set<string>();
  const candidates = queue.filter((row) => !used.has(row.id));

  const take = (predicate: (row: CatalogExercise) => boolean) => {
    for (const row of candidates) {
      if (picked.length >= count) return;
      if (picked.includes(row) || muscles.has(row.muscle_group)) continue;
      if (!predicate(row)) continue;
      picked.push(row);
      muscles.add(row.muscle_group);
    }
  };

  // One exercise per muscle first, machines ahead of free weights: a first
  // session happens without a spotter and a machine teaches the path.
  take((row) => isMachine(row));
  take((row) => !isMachine(row));
  // The group may be deeper than its muscles: allow a second of the same muscle
  // only after every muscle has had one.
  for (const row of candidates) {
    if (picked.length >= count) break;
    if (picked.includes(row)) continue;
    picked.push(row);
  }

  return picked;
}

export interface BuildDayZeroPlanParams {
  catalog: readonly CatalogExercise[];
  frequency: DayZeroFrequency;
  goal: DayZeroGoal;
  level: DayZeroLevel;
  /** Exercises per training day. Defaults to the template's own total. */
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
  perDay,
  newId = defaultIdFactory(),
}: BuildDayZeroPlanParams): DayZeroPlan {
  const available = catalog.filter(isAvailableForDayZero);
  const queues = new Map<DayZeroGroup, CatalogExercise[]>();
  for (const row of available) {
    const group = groupOf(row);
    const queue = queues.get(group);
    if (queue) queue.push(row);
    else queues.set(group, [row]);
  }

  const used = new Set<string>();
  const days: DayZeroPlanDay[] = [];
  const safeFrequency = Math.min(Math.max(frequency, 1), 7) as DayZeroFrequency;
  const templates = DAY_TEMPLATES[safeFrequency] ?? DAY_TEMPLATES[3];

  for (const template of templates) {
    const slots = slotsForDay(template, perDay);
    const exercises: DayZeroPlanExercise[] = [];

    for (const slot of slots) {
      const picked = pickFromGroup(queues.get(slot.group) ?? [], used, slot.count);
      for (const row of picked) {
        used.add(row.id);
        const load = estimateSmartLoad({
          mode: "biometric_day_0",
          targetStation: row.station_key,
          movementPattern: row.movement_pattern,
          experienceLevel: level,
          targetReps: REPS_BY_GOAL[goal],
          weightKg: 65,
        });
        exercises.push({
          row,
          rowId: newId(),
          sets: SETS_BY_GOAL[goal],
          reps: load.suggestedReps,
          weightKg: load.weightKg,
        });
      }
    }

    // A day with nothing to train is not a day: writing it would leave a routine
    // card that cannot be started.
    if (exercises.length === 0) break;

    days.push({ id: newId(), label: template.label, exercises });
  }

  return {
    // The title counts the days that were actually written: a catalog that
    // cannot fill the frequency must not promise days the routine does not have.
    title: `Cronos Day 0 · ${days.length} ${days.length === 1 ? "día" : "días"}`,
    frequency: safeFrequency,
    goal,
    level,
    days,
  };
}

/**
 * The slots of one day, resized to the exercises the caller asked for.
 *
 * Extra exercises go to the day's first group (the compound lift the session is
 * built around) and missing ones are taken from the end, so a short day loses
 * the accessory work and never the main lift.
 */
function slotsForDay(template: DayTemplate, perDay?: number): DaySlot[] {
  const total = template.slots.reduce((sum, slot) => sum + slot.count, 0);
  if (!perDay || perDay === total) return template.slots;

  const slots = template.slots.map((slot) => ({ ...slot }));
  if (perDay < total) {
    let excess = total - perDay;
    for (let index = slots.length - 1; index >= 0 && excess > 0; index -= 1) {
      const take = Math.min(slots[index].count, excess);
      slots[index].count -= take;
      excess -= take;
    }
    return slots.filter((slot) => slot.count > 0);
  }

  const first = slots[0];
  first.count += perDay - total;
  return slots;
}

/** The group label, for a summary line that names what a day trains. */
export function dayZeroGroupLabel(group: DayZeroGroup): string {
  return GROUP_LABELS[group];
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