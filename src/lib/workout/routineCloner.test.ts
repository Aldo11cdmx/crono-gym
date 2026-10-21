/**
 * routineCloner.test.ts — a routine is a plan; a session is one run of it.
 *
 * What this file guards
 * ---------------------
 * The separation itself. A routine is a template the athlete runs again and
 * again; a session is what happened once. When the two were the same object,
 * every edit made during a workout -- a weight typed, a set marked as a drop
 * set, an exercise added on the fly -- was an edit to the template, and the
 * next run of the routine started from the last one's guesses.
 *
 * Four properties carry that separation, and each of them is asserted here:
 *
 *   a) the routine is untouched by anything the session does;
 *   b) the supersets stay together;
 *   c) the type of every set survives the copy;
 *   d) the session's identities belong to the session and to nothing else.
 *
 * Pure functions against literals: no database, no DOM, no clock.
 */

import { describe, expect, it } from "vitest";
import type { Exercise } from "@/types/supabase";
import { newInstanceId } from "./instanceId";
import {
  cloneRoutineToSession,
  newSessionExercise,
  newSessionSet,
  templateFromPlanned,
  workingTemplateSets,
  type RoutineTemplate,
} from "./routineCloner";

function exercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    body_part: "upper legs",
    target: "quadriceps",
    equipment: "barbell",
    gif_url: "",
    instructions: ["Baja controlando el tempo."],
  };
}

const SQUAT = exercise("squat", "Sentadilla trasera");
const BENCH = exercise("bench", "Press de banca");
const ROW = exercise("row", "Remo con barra");

/**
 * A routine with a superset in it.
 *
 * The squat stands alone. The bench and the row share a group, the way a
 * routine written the way Hevy and Cronos write them would: the bench is
 * performed, then the row, back to back.
 */
function routine(): RoutineTemplate {
  return {
    id: "routine-1",
    title: "Fuerza",
    items: [
      {
        exercise: SQUAT,
        restSeconds: 90,
        groupId: null,
        sets: [
          { kind: "warmup", weight: "40", reps: "10" },
          { kind: "normal", weight: "100", reps: "5" },
        ],
      },
      {
        exercise: BENCH,
        restSeconds: 60,
        groupId: "superset-1",
        sets: [
          { kind: "normal", weight: "60", reps: "8" },
          { kind: "drop", weight: "60", reps: "8" },
          { kind: "failure", weight: "60", reps: "8" },
        ],
      },
      {
        exercise: ROW,
        restSeconds: 60,
        groupId: "superset-1",
        sets: [{ kind: "normal", weight: "50", reps: "10" }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// a) The routine is untouched by anything the session does.
// ---------------------------------------------------------------------------

describe("the routine is a plan, and the session is a copy of it", () => {
  it("shares no exercise with the routine it came from", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    // A copy, not the same object. The session's exercise is what the athlete
    // edits when they swap a movement; the routine's is what the next run
    // starts from.
    expect(session.items[0]?.exercise).not.toBe(base.items[0]?.exercise);
    expect(session.items[0]?.exercise).toEqual(base.items[0]?.exercise);
  });

  it("shares no set with the routine it came from", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    expect(session.items[0]?.sets[0]).not.toBe(base.items[0]?.sets[0]);
  });

  it("leaves the routine alone when the session's sets are edited", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    // Everything the athlete does during the workout, on one set.
    const edited = session.items[0]!.sets[0]!;
    edited.weight = "45";
    edited.reps = "12";
    edited.rpe = "6";
    edited.kind = "drop";
    edited.completed = true;
    edited.notes = "elagra rota";

    // The routine still says what it always said.
    expect(base.items[0]?.sets[0]).toEqual({
      kind: "warmup",
      weight: "40",
      reps: "10",
    });
  });

  it("leaves the routine alone when an exercise is added to the session", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    session.items.push(
      newSessionExercise({
        exercise: exercise("curl", "Curl con barra"),
        restSeconds: 60,
        groupId: null,
        sets: workingTemplateSets(2),
      }),
    );

    expect(base.items).toHaveLength(3);
    expect(base.items.map((item) => item.exercise.id)).toEqual([
      "squat",
      "bench",
      "row",
    ]);
  });

  it("leaves the routine alone when an exercise is removed from the session", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    session.items.splice(1, 1);

    expect(base.items).toHaveLength(3);
    expect(base.items[1]?.exercise.id).toBe("bench");
  });

  it("leaves the routine alone when the session's exercise is replaced", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    session.items[0]!.exercise = exercise("deadlift", "Peso muerto");

    expect(base.items[0]?.exercise.id).toBe("squat");
    expect(base.items[0]?.exercise.name).toBe("Sentadilla trasera");
  });

  it("leaves the routine alone when a set is duplicated in the session", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    const source = session.items[1]!.sets[0]!;
    session.items[1]!.sets.splice(1, 0, { ...source });

    expect(base.items[1]?.sets).toHaveLength(3);
  });

  it("does not mutate the routine just by being cloned", () => {
    const base = routine();
    const before = structuredClone(base);

    cloneRoutineToSession(base);

    expect(base).toEqual(before);
  });

  it("does not share the routine's instructions array with the session", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    // A shared array would be a shared future: the session's instructions
    // and the routine's would be the same list, and an edit to one would be
    // an edit to the other.
    session.items[0]!.exercise.instructions.push("Otra cosa.");
    expect(base.items[0]?.exercise.instructions).toEqual([
      "Baja controlando el tempo.",
    ]);
  });
});

// ---------------------------------------------------------------------------
// b) The supersets stay together.
// ---------------------------------------------------------------------------

describe("supersets", () => {
  it("keeps the exercises of a group in the same group", () => {
    const session = cloneRoutineToSession(routine());

    const grouped = session.items.filter((item) => item.groupId === "superset-1");
    expect(grouped.map((item) => item.exercise.id)).toEqual(["bench", "row"]);
  });

  it("leaves an exercise that stands alone without a group", () => {
    const session = cloneRoutineToSession(routine());

    expect(session.items[0]?.groupId).toBeNull();
  });

  it("keeps the relationship when the routine is run again", () => {
    const base = routine();
    const first = cloneRoutineToSession(base);
    const second = cloneRoutineToSession(base);

    // The group is a relationship, not an identity: it means the same thing
    // in every run, because it says which exercises go together.
    expect(first.items.map((item) => item.groupId)).toEqual(
      second.items.map((item) => item.groupId),
    );
    expect(first.items[1]?.groupId).toBe("superset-1");
    expect(second.items[1]?.groupId).toBe("superset-1");
  });

  it("keeps a group of more than two exercises together", () => {
    const base = routine();
    // A third exercise joins the group, and the squat joins it as well: four
    // movements in one superset, which is more than the two the usual
    // "A then B" shape has.
    base.items.push({
      exercise: exercise("pullup", "Dominadas"),
      restSeconds: 60,
      groupId: "superset-1",
      sets: [{ kind: "normal", weight: "0", reps: "6" }],
    });
    base.items[0]!.groupId = "superset-1";

    const session = cloneRoutineToSession(base);

    expect(session.items.filter((item) => item.groupId === "superset-1")).toHaveLength(4);
  });

  it("reads as no group when the routine has never been grouped", () => {
    const base = routine();
    delete base.items[1]!.groupId;

    const session = cloneRoutineToSession(base);

    // Absent and null both mean "no group", and neither is an error: a
    // routine written before supersets existed is still a routine.
    expect(session.items[1]?.groupId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// c) The type of every set survives the copy.
// ---------------------------------------------------------------------------

describe("the type of every set", () => {
  it("keeps the kind of every planned set", () => {
    const session = cloneRoutineToSession(routine());

    const kinds = session.items.flatMap((item) => item.sets.map((set) => set.kind));
    expect(kinds).toEqual(["warmup", "normal", "normal", "drop", "failure", "normal"]);
  });

  it("keeps the load the plan asked for", () => {
    const session = cloneRoutineToSession(routine());

    expect(session.items[0]?.sets[0]?.weight).toBe("40");
    expect(session.items[1]?.sets[1]?.weight).toBe("60");
  });

  it("keeps a note the plan carried onto the set", () => {
    const base = routine();
    base.items[0]!.sets[1]!.notes = "la última serie es a fallo";

    const session = cloneRoutineToSession(base);

    expect(session.items[0]?.sets[1]?.notes).toBe("la última serie es a fallo");
  });

  it("starts every set uncompleted, because a plan is not a log", () => {
    const session = cloneRoutineToSession(routine());

    expect(session.items.flatMap((item) => item.sets.map((set) => set.completed))).toEqual(
      [false, false, false, false, false, false],
    );
  });

  it("numbers the sets of an exercise from one", () => {
    const session = cloneRoutineToSession(routine());

    expect(session.items[1]?.sets.map((set) => set.set_number)).toEqual([1, 2, 3]);
  });

  it("builds a fresh set of the kind it was asked for", () => {
    const set = newSessionSet({ kind: "drop", weight: "50" }, 2);

    expect(set.kind).toBe("drop");
    expect(set.weight).toBe("50");
    expect(set.set_number).toBe(3);
    expect(set.completed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// d) The identities belong to the session.
// ---------------------------------------------------------------------------

describe("the execution identities", () => {
  it("gives every exercise of the session an id of its own", () => {
    const session = cloneRoutineToSession(routine());

    const ids = session.items.map((item) => item.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("gives every set of the session an id of its own", () => {
    const session = cloneRoutineToSession(routine());

    const ids = session.items.flatMap((item) => item.sets.map((set) => set.instanceId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("gives two runs of the same routine different ids", () => {
    const base = routine();
    const first = cloneRoutineToSession(base);
    const second = cloneRoutineToSession(base);

    // The same routine, run twice, is two different sessions. Sharing ids
    // would make the tracker read the second run's first set as the first
    // run's first set.
    const firstIds = first.items.flatMap((item) => [
      item.instanceId,
      ...item.sets.map((set) => set.instanceId),
    ]);
    const secondIds = second.items.flatMap((item) => [
      item.instanceId,
      ...item.sets.map((set) => set.instanceId),
    ]);

    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it("does not reuse the routine's own identity", () => {
    const base = routine();
    const session = cloneRoutineToSession(base);

    // The catalog id identifies the movement and is shared by every session
    // that runs it; the instance id identifies this run of it.
    expect(session.items[0]?.instanceId).not.toBe(base.items[0]?.exercise.id);
    expect(session.items[0]?.key).toBe(base.items[0]?.exercise.id);
  });

  it("keeps a set's identity when the set is edited", () => {
    const session = cloneRoutineToSession(routine());
    const before = session.items[1]!.sets[0]!.instanceId;

    session.items[1]!.sets[0]!.weight = "65";
    session.items[1]!.sets[0]!.kind = "drop";

    // The attempt is the same attempt; what was logged about it changed.
    expect(session.items[1]!.sets[0]!.instanceId).toBe(before);
  });

  it("gives a duplicated set an identity of its own", () => {
    const session = cloneRoutineToSession(routine());
    const source = session.items[1]!.sets[0]!;

    const copy = { ...source, instanceId: newInstanceId() };
    expect(copy.instanceId).not.toBe(source.instanceId);
  });
});

// ---------------------------------------------------------------------------
// The bridge from the planned list the app actually holds.
// ---------------------------------------------------------------------------

describe("the planned list the app holds", () => {
  it("becomes a template of ordinary working sets", () => {
    const template = templateFromPlanned(
      [
        { exercise: SQUAT, target_sets: 4, rest_seconds: 90 },
        { exercise: BENCH, target_sets: 3, rest_seconds: 60 },
      ],
      { id: "routine-1", title: "Fuerza" },
    );

    expect(template.items[0]?.sets).toHaveLength(4);
    expect(template.items[0]?.sets.every((set) => set.kind === "normal")).toBe(true);
    expect(template.items[1]?.sets).toHaveLength(3);
  });

  it("carries the grouping of the planned list", () => {
    const template = templateFromPlanned(
      [
        { exercise: SQUAT, target_sets: 3, rest_seconds: 90, groupId: null },
        { exercise: BENCH, target_sets: 3, rest_seconds: 60, groupId: "superset-1" },
      ],
      { id: "routine-1", title: "Fuerza" },
    );

    expect(template.items[0]?.groupId).toBeNull();
    expect(template.items[1]?.groupId).toBe("superset-1");
  });

  it("reads as no group when the planned list has never been grouped", () => {
    const template = templateFromPlanned(
      [{ exercise: SQUAT, target_sets: 3, rest_seconds: 90 }],
      { id: null, title: "Sesión libre" },
    );

    expect(template.items[0]?.groupId).toBeNull();
  });

  it("gives an exercise at least one set", () => {
    const template = templateFromPlanned(
      [{ exercise: SQUAT, target_sets: 0, rest_seconds: 90 }],
      { id: null, title: "Sesión libre" },
    );

    // An exercise with no sets is not an exercise the athlete can do
    // anything with, and the logger shows a row for every set.
    expect(template.items[0]?.sets).toHaveLength(1);
  });

  it("runs the planned list as a session of its own", () => {
    const template = templateFromPlanned(
      [{ exercise: SQUAT, target_sets: 2, rest_seconds: 90 }],
      { id: "routine-1", title: "Fuerza" },
    );

    const session = cloneRoutineToSession(template);

    expect(session.routineId).toBe("routine-1");
    expect(session.title).toBe("Fuerza");
    expect(session.items).toHaveLength(1);
    expect(session.items[0]?.sets).toHaveLength(2);
  });
});
