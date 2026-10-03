/**
 * Tests for routineGenerator.
 *
 * The module's whole job is the boundary between a model's output and a foreign key, so
 * almost every test here is about a payload that is *nearly* right: an invented id, a
 * reversed rep range, a day with no exercises. A test suite that only fed it well-formed
 * JSON would be testing `JSON.parse`.
 *
 * The transport is injected for every generation test. That is not a convenience: loading,
 * cancelling and failing are three of the wizard's states and none of them is reachable
 * through a real network call in a unit test.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_EXERCISES_PER_DAY,
  RoutineGenerationError,
  buildRoutineContext,
  buildRoutineInstruction,
  buildRoutinePrompt,
  generateRoutine,
  parseRoutinePayload,
  substituteUnknownExercises,
  validateRoutine,
  type GeneratedRoutine,
  type RoutineGenerationRequest,
  type RoutineTransport,
} from "./routineGenerator";
import type { Exercise } from "@/types/supabase";

const REQUEST: RoutineGenerationRequest = {
  goal: "volume",
  daysPerWeek: 3,
  sessionDurationMinutes: 60,
  experienceLevel: "intermediate",
  muscleWeaknesses: ["pectoralis"],
  availableExerciseIds: ["ex-press", "ex-fly", "ex-row"],
};

const CATALOG: Pick<Exercise, "id" | "body_part">[] = [
  { id: "ex-press", body_part: "chest" },
  { id: "ex-fly", body_part: "chest" },
  { id: "ex-row", body_part: "back" },
  { id: "ex-pulldown", body_part: "back" },
];

/** A transport that answers with `reply`, recording what it was asked. */
function transport(reply: string): { ask: RoutineTransport; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    ask: async (instruction) => {
      calls.push(instruction);
      return reply;
    },
  };
}

/** One day of well-formed output, in the shape the prompt demands. */
function validPayload(exerciseId = "ex-press"): unknown {
  return {
    name: "Pecho y espalda",
    days: [
      {
        dayNumber: 1,
        focus: "Empuje",
        exercises: [
          { exerciseId, sets: 4, repsMin: 8, repsMax: 10, restSeconds: 120 },
          { exerciseId: "ex-fly", sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90 },
          { exerciseId: "ex-row", sets: 4, repsMin: 6, repsMax: 8, restSeconds: 150 },
        ],
      },
    ],
  };
}

// ------------------------------------------------------------------ prompt

describe("routineGenerator · the prompt", () => {
  it("states every parameter the request carries", () => {
    const instruction = buildRoutineInstruction(REQUEST);

    expect(instruction).toContain("volumen");
    expect(instruction).toContain("intermedio");
    expect(instruction).toContain("3 días");
    expect(instruction).toContain("60 min");
    expect(instruction).toContain("pectoralis");
  });

  it("says what to do when there are no priority muscles, rather than omitting the line", () => {
    const instruction = buildRoutineInstruction({ ...REQUEST, muscleWeaknesses: [] });

    // An absent line reads as a dropped parameter; this one is a decision.
    expect(instruction).toContain("equilibrada");
    expect(instruction).not.toContain("Prioriza:");
  });

  it("carries the exercise allow-list in the context, not in the instruction", () => {
    const instruction = buildRoutineInstruction(REQUEST);
    const context = buildRoutineContext(REQUEST);

    // The split is not cosmetic: `coach-assistant` refuses a user message over 500
    // characters, and 1,324 ids do not fit in one.
    expect(instruction.length).toBeLessThanOrEqual(500);
    expect(instruction).not.toContain("ex-press");
    expect(context.routineRequest.allowedExerciseIds).toEqual(["ex-press", "ex-fly", "ex-row"]);
    expect(context.routineRequest.daysPerWeek).toBe(3);
    expect(context.routineRequest.sessionDurationMinutes).toBe(60);
  });

  it("truncates the allow-list rather than sending 1,324 ids", () => {
    const many = Array.from({ length: 1000 }, (_, i) => `ex-${i}`);
    const context = buildRoutineContext({ ...REQUEST, availableExerciseIds: many }, 10);

    expect(context.routineRequest.allowedExerciseIds).toHaveLength(10);
  });

  it("puts the briefing before the instruction in the combined prompt", () => {
    const prompt = buildRoutinePrompt(REQUEST);

    expect(prompt.indexOf("allowedExerciseIds")).toBeLessThan(prompt.indexOf("Diseña"));
  });
});

// ------------------------------------------------------------------- parse

describe("routineGenerator · reading the reply", () => {
  it("reads a fenced block", () => {
    expect(parseRoutinePayload('```json\n{"name":"A"}\n```')).toEqual({ name: "A" });
  });

  it("reads a fenced block tagged with something unexpected", () => {
    // Requiring an exact fence is how a good routine goes missing over a space.
    expect(parseRoutinePayload('```ACTION\n{"name":"A"}\n```')).toEqual({ name: "A" });
  });

  it("reads an unfenced object", () => {
    expect(parseRoutinePayload('{"name":"A"}')).toEqual({ name: "A" });
  });

  it("recovers an object wrapped in prose", () => {
    expect(parseRoutinePayload('Aquí tienes: {"name":"A"} — avísame.')).toEqual({ name: "A" });
  });

  it("returns null for prose with no object in it", () => {
    expect(parseRoutinePayload("No puedo diseñar eso.")).toBeNull();
  });

  /*
   * The regression this group pins. Taking the text between the first `{` and the *last*
   * `}` reads to the end of the reply rather than the end of the object, so a reply that
   * carried an action block after the routine was sliced into two JSON values glued
   * together and the routine was lost to a parse error -- the model had answered
   * correctly. Every case below is one way that happens.
   */
  it("stops at the end of the routine object, not the end of the reply", () => {
    const routine = '{"name":"A","days":[]}';

    expect(
      parseRoutinePayload(`${routine}\n\`\`\`action\n{"type":"deload_suggestion"}\n\`\`\``),
    ).toEqual({ name: "A", days: [] });

    expect(parseRoutinePayload(`${routine} {"note":"bye"}`)).toEqual({ name: "A", days: [] });
  });

  it("is not fooled by a brace inside a string", () => {
    // `focus` legitimately carries prose. Counting that `}` as structure ends the object
    // early and hands `JSON.parse` a fragment.
    const raw = '{"name":"A","days":[{"focus":"pierna } baja","exercises":[]}]}';
    expect(parseRoutinePayload(raw)).toEqual({
      name: "A",
      days: [{ focus: "pierna } baja", exercises: [] }],
    });
  });

  it("is not fooled by an escaped quote inside a string", () => {
    const raw = '{"name":"A \\" B","days":[]}';
    expect(parseRoutinePayload(raw)).toEqual({ name: 'A " B', days: [] });
  });

  it("picks the json block when the model also wrote another fence", () => {
    // The prompt demands one block and nothing else. The model wrote two; the one it
    // tagged `json` is the payload, and taking the first fence blind would take the other.
    const raw = [
      "Pensando en la rutina.",
      "```text\ndays: 3\n```",
      '```json\n{"name":"A","days":[]}\n```',
      "Avísame si quieres cambios.",
    ].join("\n");
    expect(parseRoutinePayload(raw)).toEqual({ name: "A", days: [] });
  });

  it("recovers an object from a fence the model never closed", () => {
    // `max_tokens` cuts the reply mid-block. The object is whole; only the fence is missing.
    expect(parseRoutinePayload('```json\n{"name":"A","days":[]}')).toEqual({
      name: "A",
      days: [],
    });
  });

  it("returns null rather than a sentinel when nothing parses", () => {
    // The old implementation returned its internal "did not parse" marker from this path,
    // which `validateRoutine` rejected by accident rather than by contract.
    const parsed = parseRoutinePayload('Aquí tienes: {"name":"A" — avísame.');
    expect(parsed).toBeNull();
    expect(typeof parsed).not.toBe("symbol");
  });

  it("does not leak state between calls", () => {
    // The fence pattern is module-level and global; a sticky lastIndex would make the
    // second call see the first call's fence.
    const raw = '```json\n{"name":"A"}\n```';
    expect(parseRoutinePayload(raw)).toEqual({ name: "A" });
    expect(parseRoutinePayload(raw)).toEqual({ name: "A" });
  });
});

// ----------------------------------------------------------------- validate

describe("routineGenerator · validating the payload", () => {
  it("accepts a well-formed routine and coerces quoted numbers", () => {
    const routine = validateRoutine({
      name: "  Split  ",
      days: [
        {
          dayNumber: "1",
          focus: " Empuje ",
          exercises: [{ exerciseId: "ex-press", sets: "4", repsMin: 8, repsMax: 10, restSeconds: 90 }],
        },
      ],
    });

    // Models emit quoted numbers constantly; dropping a whole routine over one is worse
    // than accepting it.
    expect(routine?.name).toBe("Split");
    expect(routine?.days[0].focus).toBe("Empuje");
    expect(routine?.days[0].exercises[0].sets).toBe(4);
    expect(routine?.days[0].exercises[0].restSeconds).toBe(90);
  });

  it("refuses a reversed rep range instead of swapping it", () => {
    // Repairing this would be reading an intent the payload never stated.
    const routine = validateRoutine({
      name: "A",
      days: [{ exercises: [{ exerciseId: "ex-press", sets: 4, repsMin: 10, repsMax: 5, restSeconds: 90 }] }],
    });

    expect(routine).toBeNull();
  });

  it("refuses a day with no exercises, rather than shipping an empty day", () => {
    expect(validateRoutine({ name: "A", days: [{ exercises: [] }] })).toBeNull();
  });

  it("refuses a routine with no name or no days", () => {
    expect(validateRoutine({ days: [{ exercises: [{ exerciseId: "a" }] }] })).toBeNull();
    expect(validateRoutine({ name: "A", days: [] })).toBeNull();
  });

  it("refuses a non-positive count", () => {
    expect(
      validateRoutine({
        name: "A",
        days: [{ exercises: [{ exerciseId: "a", sets: 0, repsMin: 5, repsMax: 5, restSeconds: 60 }] }],
      }),
    ).toBeNull();
  });

  it("caps a day at the documented exercise maximum", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      exerciseId: `ex-${i}`,
      sets: 3,
      repsMin: 8,
      repsMax: 12,
      restSeconds: 60,
    }));
    const routine = validateRoutine({ name: "A", days: [{ exercises: many }] });

    expect(routine?.days[0].exercises).toHaveLength(MAX_EXERCISES_PER_DAY);
  });

  it("falls back to position when a day carries no number", () => {
    const routine = validateRoutine({
      name: "A",
      days: [
        { exercises: [{ exerciseId: "a", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 60 }] },
        { exercises: [{ exerciseId: "b", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 60 }] },
      ],
    });

    expect(routine?.days.map((day) => day.dayNumber)).toEqual([1, 2]);
  });
});

// -------------------------------------------------------------- substitution

describe("routineGenerator · substituting invented ids", () => {
  const routine = (exerciseIds: string[]): GeneratedRoutine => ({
    name: "A",
    days: [
      {
        dayNumber: 1,
        focus: "Pecho",
        exercises: exerciseIds.map((exerciseId) => ({
          exerciseId,
          sets: 4,
          repsMin: 8,
          repsMax: 10,
          restSeconds: 90,
        })),
      },
    ],
  });

  it("leaves a routine the catalog recognises untouched", () => {
    const result = substituteUnknownExercises(routine(["ex-press", "ex-fly"]), REQUEST.availableExerciseIds, CATALOG);

    expect(result.substituted).toBe(0);
    expect(result.routine.days[0].exercises.map((e) => e.exerciseId)).toEqual(["ex-press", "ex-fly"]);
  });

  it("replaces an invented id with one from the region the day is already in", () => {
    // The day is chest -- the model put press banca and aperturas in it -- so an id it
    // invented next to them is a chest movement too.
    const result = substituteUnknownExercises(
      routine(["ex-press", "sentadilla-inventada", "ex-fly"]),
      REQUEST.availableExerciseIds,
      CATALOG,
    );

    const ids = result.routine.days[0].exercises.map((e) => e.exerciseId);
    expect(ids).toEqual(["ex-press", "ex-press", "ex-fly"]);
    expect(result.substituted).toBe(1);
    expect(result.unresolved).toEqual([]);
  });

  it("falls back to a back movement when the day is about back", () => {
    const result = substituteUnknownExercises(routine(["ex-row", "inventada"]), REQUEST.availableExerciseIds, CATALOG);

    expect(result.routine.days[0].exercises[1].exerciseId).toBe("ex-row");
  });

  it("keeps an id it cannot substitute and reports it, rather than silently dropping it", () => {
    // A day short of sets with nothing on screen explaining why is the worse outcome.
    const result = substituteUnknownExercises(routine(["inventada"]), [], []);

    expect(result.routine.days[0].exercises).toHaveLength(1);
    expect(result.unresolved).toEqual(["inventada"]);
    expect(result.substituted).toBe(0);
  });

  it("leaves every id in the catalog, whatever the model returned", () => {
    const result = substituteUnknownExercises(
      routine(["ex-press", "inventada-1", "ex-row", "inventada-2"]),
      REQUEST.availableExerciseIds,
      CATALOG,
    );

    const known = new Set([...REQUEST.availableExerciseIds, ...CATALOG.map((e) => e.id)]);
    for (const day of result.routine.days) {
      for (const exercise of day.exercises) {
        expect(known.has(exercise.exerciseId)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------- generate

describe("routineGenerator · generating", () => {
  it("returns a routine with every id the catalog holds", async () => {
    const { ask } = transport(JSON.stringify(validPayload()));

    const { routine, substituted } = await generateRoutine(REQUEST, { ask, catalog: CATALOG });

    expect(routine.name).toBe("Pecho y espalda");
    expect(routine.days[0].exercises).toHaveLength(3);
    expect(substituted).toBe(0);
  });

  it("substitutes an invented id before the routine reaches the wizard", async () => {
    const { ask } = transport(JSON.stringify(validPayload("sentadilla")));

    const { routine, substituted } = await generateRoutine(REQUEST, { ask, catalog: CATALOG });

    expect(substituted).toBe(1);
    const known = new Set([...REQUEST.availableExerciseIds, ...CATALOG.map((e) => e.id)]);
    for (const exercise of routine.days[0].exercises) {
      expect(known.has(exercise.exerciseId)).toBe(true);
    }
  });

  it("throws a classified error for a reply that is not a routine", async () => {
    const { ask } = transport("Lo siento, no puedo ayudarte con eso.");

    // Typed, not a bare SyntaxError: the wizard switches on the code to decide whether to
    // offer "retry" or to give up, and it cannot do that from an exception name.
    await expect(generateRoutine(REQUEST, { ask, catalog: CATALOG })).rejects.toBeInstanceOf(
      RoutineGenerationError,
    );
    await expect(generateRoutine(REQUEST, { ask, catalog: CATALOG })).rejects.toMatchObject({
      detail: { code: "SERVICE_UNAVAILABLE" },
    });
  });

  it("throws a classified error for well-formed JSON that is not a routine", async () => {
    const { ask } = transport('{"name":"A","days":[]}');

    await expect(generateRoutine(REQUEST, { ask, catalog: CATALOG })).rejects.toMatchObject({
      detail: { code: "SERVICE_UNAVAILABLE" },
    });
  });

  it("carries a transport failure through as a network error", async () => {
    const ask: RoutineTransport = () => Promise.reject(new TypeError("Failed to fetch"));

    await expect(generateRoutine(REQUEST, { ask, catalog: CATALOG })).rejects.toMatchObject({
      detail: { code: "NETWORK_ERROR" },
    });
  });

  it("does not call the transport when the wizard cancelled before it started", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const ask: RoutineTransport = async () => {
      calls += 1;
      return "{}";
    };

    // Aborted before the first await: the wizard shows a spinner the instant Cancel is
    // pressed, and nothing should reach the network after that.
    await expect(generateRoutine(REQUEST, { ask, signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(calls).toBe(0);
  });

  it("throws an AbortError, not a generation error, when cancelled mid-flight", async () => {
    const controller = new AbortController();
    const ask: RoutineTransport = async () => {
      controller.abort();
      return JSON.stringify(validPayload());
    };

    // The distinction the wizard needs: "the user stopped this" and "this failed" are
    // different screens.
    await expect(
      generateRoutine(REQUEST, { ask, signal: controller.signal, catalog: CATALOG }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("passes the signal to the transport so the request itself is cancellable", async () => {
    const controller = new AbortController();
    let received: AbortSignal | undefined;
    const ask: RoutineTransport = async (_instruction, _context, signal) => {
      received = signal;
      return JSON.stringify(validPayload());
    };

    await generateRoutine(REQUEST, { ask, signal: controller.signal, catalog: CATALOG });

    expect(received).toBe(controller.signal);
  });
});