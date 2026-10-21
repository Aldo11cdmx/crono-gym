/**
 * routineCloner.ts — a routine is a plan; a session is one run of it.
 *
 * The problem this solves
 * ----------------------
 * A routine is a template: a list of exercises, each with a prescription, that
 * the athlete can run again and again. A session is what actually happens
 * once: the same exercises, with the loads, reps, notes and attempts that this
 * particular run produced.
 *
 * The two used to be the same thing. The logger's state was built straight
 * from the routine's rows, and the sets it held were the routine's sets. So
 * every edit made during a workout -- a weight typed, a set marked as a drop
 * set, an exercise added on the fly -- was an edit to the template. Run the
 * routine again and the last session's guesses were already there, waiting.
 *
 * The separation
 * --------------
 * A template is read-only. Cloning it produces a session whose every object
 * is a fresh one: its own exercises, its own sets, its own identities. The
 * clone shares nothing with the template that a mutation could reach, so
 * editing the session cannot touch the routine and the routine stays a
 * prescription rather than becoming a log.
 *
 * Supersets
 * ---------
 * A group id marks exercises that are performed together -- "A then B,
 * back to back", the way Hevy and Cronos write it. The group id is a
 * *relationship*, not an identity: it says which exercises belong together,
 * and it means the same thing in the template and in every run of it. So it
 * is carried across verbatim.
 *
 * The execution ids are the opposite: they say *which run* and *which
 * attempt*, and they are generated here, so two runs of the same routine
 * never share one.
 *
 * The database
 * ------------
 * `routine_exercises` has no `group_id` column yet -- it arrives with the
 * superset migration, alongside `set_type`. The client model carries the
 * grouping as an optional field so that the shape is right the moment the
 * column exists, and a routine that has never been grouped reads as "no
 * group" rather than as an error.
 */

import type { Exercise } from "@/types/supabase";
import { newInstanceId } from "./instanceId";
import type { SetKind } from "./setKind";
import type { SetEntry } from "./types";

/**
 * A set as the template plans it: a type and a target, not a log.
 *
 * `kind` is not decoration. A warm-up is not volume, a drop set is not a
 * failure, and the plan says which of those each set is -- the same
 * distinction the logger's chips make and the sync payload carries.
 */
export interface TemplateSet {
  /** What kind of set this is: `normal`, `warmup`, `drop` or `failure`. */
  kind: SetKind;
  /** The load the plan asks for, when it asks for one. */
  weight?: string | null;
  /** The repetitions the plan asks for. */
  reps?: string | null;
  /** The effort the plan asks for. */
  rpe?: string | null;
  /** A note the plan carries onto the set. */
  notes?: string | null;
}

/** One movement in the template, with its prescription and its group. */
export interface TemplateExercise {
  /** The catalog exercise this row is about. */
  exercise: Exercise;
  /** Rest between the sets of this exercise, in seconds. */
  restSeconds: number;
  /** The planned sets, each with its own type. */
  sets: TemplateSet[];
  /**
   * The superset this exercise belongs to, or null when it stands alone.
   *
   * Optional and nullable because both answers are real: a template written
   * before supersets existed has no grouping to carry, and an exercise that
   * stands alone is not in one.
   */
  groupId?: string | null;
}

/**
 * A routine as a plan.
 *
 * Read-only by construction: the cloner reads it and writes something else.
 */
export interface RoutineTemplate {
  /** The routine this plan came from. Null for a session with no routine. */
  id: string | null;
  /** The routine's title. */
  title: string;
  /** The movements, in the order they are performed. */
  items: TemplateExercise[];
}

/**
 * A set as the session runs it: the template's set, with its own identity.
 *
 * A copy, never the template's own object: a set is edited constantly -- the
 * weight, the reps, the note, the kind -- and every one of those edits must
 * land on the session and nowhere else.
 */
export interface SessionSet extends SetEntry {
  /** The identity of this attempt within this run. */
  instanceId: string;
}

/**
 * An exercise as the session runs it.
 *
 * `key` is what the interface selects on and what the draft records, and it
 * stays the catalog id so that the draft written today and the draft read
 * tomorrow agree. `instanceId` is the identity of *this* execution of it,
 * and it is what makes two runs of the same routine two different runs.
 */
export interface SessionExercise {
  /** Stable within the run: the selection key, and the draft's item key. */
  key: string;
  /** The identity of this exercise within this run. */
  instanceId: string;
  /** The catalog exercise, copied so the template's own object is not shared. */
  exercise: Exercise;
  /** Rest between the sets of this exercise, in seconds. */
  restSeconds: number;
  /** The sets of this exercise, each one a copy with its own identity. */
  sets: SessionSet[];
  /** The superset this exercise belongs to, or null when it stands alone. */
  groupId: string | null;
}

/** One run of a routine. */
export interface ActiveSessionPlan {
  /** The routine this run came from. Null for a free session. */
  routineId: string | null;
  /** The routine's title. */
  title: string;
  /** The movements of this run, in order. */
  items: SessionExercise[];
}

/**
 * The shape the cloner needs from a planned exercise.
 *
 * Structural on purpose, so this module stays a pure function over a plan and
 * does not reach into the data layer for it. `PlannedExercise` satisfies it.
 */
export interface PlannedLike {
  exercise: Exercise;
  /** How many working sets the plan asks for. */
  target_sets: number;
  /** Rest between the sets, in seconds. */
  rest_seconds: number;
  /** The superset this exercise belongs to, when it is in one. */
  groupId?: string | null;
}

/**
 * Builds a template out of a list of planned exercises.
 *
 * The planned list carries a *count* of sets, not a plan for them, so every
 * set it produces is an ordinary working set. A routine that prescribes
 * warm-ups or drop sets carries them in its own template and does not come
 * through here.
 */
export function templateFromPlanned(
  planned: readonly PlannedLike[],
  meta: { id: string | null; title: string },
): RoutineTemplate {
  return {
    id: meta.id,
    title: meta.title,
    items: planned.map((item) => ({
      exercise: item.exercise,
      restSeconds: item.rest_seconds,
      groupId: item.groupId ?? null,
      sets: workingTemplateSets(item.target_sets),
    })),
  };
}

/**
 * Turns a template into the session that runs it.
 *
 * Every object in the result is new. Nothing in it is shared with the
 * template, so nothing the athlete does during the session can reach the
 * routine they started from.
 */
export function cloneRoutineToSession(template: RoutineTemplate): ActiveSessionPlan {
  return {
    routineId: template.id,
    title: template.title,
    items: template.items.map((item) => newSessionExercise(item)),
  };
}

/**
 * A fresh exercise for a running session.
 *
 * Used for the exercises the routine planned and for the ones added while
 * the session runs, so both arrive at the logger in the same shape and with
 * the same kind of identity.
 */
export function newSessionExercise(source: TemplateExercise): SessionExercise {
  return {
    key: source.exercise.id,
    instanceId: newInstanceId(),
    exercise: cloneCatalogExercise(source.exercise),
    restSeconds: source.restSeconds,
    groupId: source.groupId ?? null,
    sets: source.sets.map((set, index) => newSessionSet(set, index)),
  };
}

/**
 * A fresh set for a running session.
 *
 * The number is the set's position in the exercise, which is what the
 * interface shows and what the payload carries; the instance id is the set's
 * identity, which is what stays the same when the set is edited and what
 * changes when it is duplicated.
 */
export function newSessionSet(source: TemplateSet, index: number): SessionSet {
  return {
    set_number: index + 1,
    weight: source.weight ?? "",
    reps: source.reps ?? "",
    rpe: source.rpe ?? "",
    kind: source.kind,
    completed: false,
    notes: source.notes ?? undefined,
    instanceId: newInstanceId(),
  };
}

/**
 * The template of an exercise with no prescribed sets: N ordinary working sets.
 *
 * One is the floor: an exercise with no sets is not an exercise the athlete
 * can do anything with, and the logger shows a row for every set.
 */
export function workingTemplateSets(count: number): TemplateSet[] {
  const total = Math.max(count, 1);
  return Array.from({ length: total }, () => ({ kind: "normal" }));
}

/**
 * Copies a catalog exercise.
 *
 * The catalog row is shared by every session that uses it, and the session
 * holds its own copy so that replacing the exercise mid-workout -- with a
 * different movement, or with a reloaded catalog row -- leaves the template
 * alone.
 */
function cloneCatalogExercise(source: Exercise): Exercise {
  return {
    ...source,
    instructions: source.instructions ? [...source.instructions] : [],
  };
}
