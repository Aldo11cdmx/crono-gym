/**
 * The persistence half of the coach's routine builder, separated from the component so the
 * two-insert order and the compensating delete can be tested against a literal draft.
 *
 * What matters here is the failure path. There is no transaction available from the browser
 * client, so the second insert can fail after the routine row is already visible to the
 * athlete. The delete that cleans up is legal only because `authored_by_coach` was written
 * and because the policy reads it from `auth.uid()` -- a client cannot supply the value the
 * policy compares against, so the filter here is by id and nothing else.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveCoachRoutine } from "./saveCoachRoutine";
import { draftProblem, filledDays, type CoachRoutineDraft } from "./coachRoutineDraft";

const ATHLETE = "athlete-1";
const COACH = "coach-row-1";

type Call = [string, ...unknown[]];

interface Write {
  table: string;
  values: unknown;
  filters: Call[];
  op: "insert" | "delete";
}

interface Fixture {
  failOn?: string | null;
}

let fixture: Fixture = {};
let writes: Write[] = [];

vi.mock("@lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const filters: Call[] = [];
      const builder: Record<string, unknown> = {};
      let op: "insert" | "delete" | null = null;

      for (const method of ["select", "eq"]) {
        builder[method] = (...args: unknown[]) => {
          filters.push([method as string, ...args]);
          return builder;
        };
      }

      builder.insert = (values: unknown) => {
        op = "insert";
        writes.push({ table, values, filters, op });
        return builder;
      };

      builder.delete = () => {
        op = "delete";
        writes.push({ table, values: null, filters, op });
        return builder;
      };

      builder.single = () => builder;

      builder.then = (resolve: (value: unknown) => void) => {
        if (op === "delete") return resolve({ data: null, error: null });

        const failure = fixture.failOn === table ? "rechazado" : null;
        return resolve({
          data: table === "routines" && !failure ? { id: "routine-1" } : null,
          error: failure ? { message: failure } : null,
        });
      };

      return builder;
    },
  },
}));

const exercise = (id: string) => ({
  exerciseId: id,
  sets: 4,
  repsMin: 8,
  repsMax: 12,
  restSeconds: 90,
});

const DRAFT: CoachRoutineDraft = {
  title: "Fuerza 4 días",
  days: [
    { label: "Pecho", exercises: [exercise("ex-banca"), exercise("ex-press")] },
    { label: "Pierna", exercises: [exercise("ex-squat")] },
  ],
};

function rows(): Record<string, unknown>[] {
  return (writes.find((w) => w.table === "routine_exercises")?.values ?? []) as Record<
    string,
    unknown
  >[];
}

beforeEach(() => {
  fixture = {};
  writes = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ------------------------------------------------------------------- tests

describe("saveCoachRoutine · el camino feliz", () => {
  it("escribe la rutina antes que sus ejercicios", async () => {
    expect(await saveCoachRoutine(ATHLETE, COACH, DRAFT)).toBe(true);

    // `routine_exercises.routine_id` is a foreign key. The other order produces rows
    // pointing at nothing, which are invisible *and* orphaned.
    expect(writes.map((w) => w.table)).toEqual(["routines", "routine_exercises"]);
  });

  it("escribe la rutina a nombre del atleta y con el coach como autor", async () => {
    await saveCoachRoutine(ATHLETE, COACH, DRAFT);

    expect(writes[0].values).toEqual({
      user_id: ATHLETE,
      title: "Fuerza 4 días",
      source: "human_coach",
      authored_by_coach: COACH,
    });
  });

  it("aplaña los días con day_index correlativo y order_index por día", async () => {
    await saveCoachRoutine(ATHLETE, COACH, DRAFT);

    expect(rows().map((row) => [row.day_index, row.order_index])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
  });

  it("guarda el nombre del día y el rango de reps", async () => {
    await saveCoachRoutine(ATHLETE, COACH, DRAFT);

    expect(rows()[0]).toMatchObject({
      day_label: "Pecho",
      target_reps_min: 8,
      target_reps_max: 12,
      target_sets: 4,
      rest_seconds: 90,
    });
  });

  it("no persiste el nombre memorizado del ejercicio", async () => {
    // `exerciseName` exists so the builder can redisplay the choice; it is not a column.
    await saveCoachRoutine(ATHLETE, COACH, {
      ...DRAFT,
      days: [{ label: "Pecho", exercises: [{ ...exercise("ex-banca"), exerciseName: "Press" }] }],
    });

    expect(Object.keys(rows()[0])).not.toContain("exerciseName");
  });
});

describe("saveCoachRoutine · cuando falla", () => {
  it("borra la rutina si los ejercicios no se insertan", async () => {
    fixture = { failOn: "routine_exercises" };

    expect(await saveCoachRoutine(ATHLETE, COACH, DRAFT)).toBe(false);

    // A routine the athlete can open and find empty is worse than no routine at all.
    expect(writes.filter((w) => w.op === "delete")).toHaveLength(1);
  });

  it("borra por id y no manda un autor que la política no lee", async () => {
    fixture = { failOn: "routine_exercises" };
    await saveCoachRoutine(ATHLETE, COACH, DRAFT);

    const cleanup = writes.at(-1);
    expect(cleanup?.filters).toContainEqual(["eq", "id", "routine-1"]);
    // The policy derives the coach from `auth.uid()`. A client-supplied value would be a
    // filter the policy has no use for, and comparing against one would be a bug waiting to
    // look like a security control.
    expect(cleanup?.filters.some((call) => call[1] === "authored_by_coach")).toBe(false);
  });

  it("no borra nada si la rutina misma no se pudo insertar", async () => {
    fixture = { failOn: "routines" };

    expect(await saveCoachRoutine(ATHLETE, COACH, DRAFT)).toBe(false);
    // There is no id to delete by, and issuing one would delete an unrelated row.
    expect(writes.filter((w) => w.op === "delete")).toHaveLength(0);
  });

  it("no inserta ejercicios cuando la rutina quedó vacía", async () => {
    const empty: CoachRoutineDraft = { title: "Vacía", days: [{ label: "", exercises: [] }] };

    expect(await saveCoachRoutine(ATHLETE, COACH, empty)).toBe(false);
    // Refused before the second insert rather than written and rolled back.
    expect(writes.filter((w) => w.table === "routine_exercises")).toHaveLength(0);
  });

  it("nunca lanza, aunque el cliente se caiga", async () => {
    fixture = { failOn: "routine_exercises" };
    // The caller is a button: a rejected promise here leaves the spinner running forever.
    await expect(saveCoachRoutine(ATHLETE, COACH, DRAFT)).resolves.toBe(false);
  });
});

describe("draftProblem · por qué no se guarda", () => {
  it("acepta un borrador completo", () => {
    expect(draftProblem(DRAFT, COACH)).toBeNull();
  });

  it("exige el id del coach antes que nada", () => {
    // `authored_by_coach` is what makes the compensating delete legal, so a save without it
    // would write a row nobody can clean up.
    expect(draftProblem(DRAFT, null)).toBe("noCoachId");
  });

  it("distingue un título vacío de unos espacios", () => {
    expect(draftProblem({ ...DRAFT, title: "   " }, COACH)).toBe("noTitle");
  });

  it("distingue no tener filas de no haber elegido ejercicio", () => {
    // Two different one-tap fixes, so two different messages: telling a coach who has
    // already added a row to "add an exercise" sends them to write a second row.
    expect(draftProblem({ title: "T", days: [{ label: "", exercises: [] }] }, COACH)).toBe(
      "noExercises",
    );
    expect(
      draftProblem({ title: "T", days: [{ label: "", exercises: [exercise("")] }] }, COACH),
    ).toBe("unpickedExercise");
  });

  it("acepta un borrador con una fila sin elegir y otra completa", () => {
    // Only the complete rows are written; see `filledDays`.
    expect(
      draftProblem(
        { title: "T", days: [{ label: "", exercises: [exercise(""), exercise("ex-banca")] }] },
        COACH,
      ),
    ).toBeNull();
  });
});

describe("filledDays", () => {
  it("descarta los días sin ejercicios para no dejar huecos en day_index", () => {
    // `day_index` is positional, so an empty day in the middle would punch a hole in the
    // sequence the reader groups by.
    const days = filledDays({
      title: "T",
      days: [
        { label: "A", exercises: [exercise("ex-a")] },
        { label: "B", exercises: [] },
        { label: "C", exercises: [exercise("ex-c")] },
      ],
    });

    expect(days.map((day) => day.label)).toEqual(["A", "C"]);
  });

  it("descarta las filas sin ejercicio elegido", () => {
    const days = filledDays({
      title: "T",
      days: [{ label: "A", exercises: [exercise(""), exercise("ex-a")] }],
    });

    expect(days[0].exercises.map((e) => e.exerciseId)).toEqual(["ex-a"]);
  });
});