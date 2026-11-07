import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  duplicateRoutine,
  flushSave,
  restoreRoutine,
  saveRoutine,
  saveState,
  subscribeSave,
} from "./saveRoutine";
import type { Exercise } from "@/types/supabase";
import type { RoutineDraftV2 } from "./routineDayModel";

function ex(id: string): Exercise {
  return {
    id,
    name: "Ejercicio",
    name_es: "Ejercicio",
    body_part: "Torso",
    target: "Pecho",
    equipment: "Mancuernas",
    gif_url: "",
    instructions: [],
    is_active: true,
    is_hidden: false,
  } as unknown as Exercise;
}

function uid(): string {
  return crypto.randomUUID();
}

function trainingDay(label: string, order: number, weekday: number): RoutineDraftV2["days"][0] {
  const id = uid();
  return {
    id,
    order,
    weekday,
    label,
    kind: "training",
    exercises: [
      {
        exercise: ex("ex-1"),
        rowId: `${id}-r1`,
        target_sets: 3,
        rest_seconds: 90,
        order_index: 0,
        target_reps_min: 8,
        target_reps_max: 12,
      },
    ],
  };
}

function makeDraft(overrides: Partial<RoutineDraftV2> = {}): RoutineDraftV2 {
  const snapshot =
    overrides.id !== null && overrides.snapshot === undefined
      ? { title: "Test", description: "", rows: [] }
      : null;
  return {
    id: null,
    title: "Test",
    description: "",
    mode: "single",
    days: [],
    snapshot,
    needsModeConfirmation: false,
    ...overrides,
  };
}

type Call = [string, ...unknown[]];

interface Write {
  table: string;
  values: unknown;
  filters: Call[];
  op: "upsert" | "delete" | "select";
}

let fixture: {
  failOn?: string | null;
  failOp?: "upsert" | "delete" | "select" | null;
  existingDescription?: string | null;
  routineData?: { id: string } | null;
  verifyTitle?: string | null;
} = {};
let writes: Write[] = [];

vi.mock("@lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const filters: Call[] = [];
      let op: "upsert" | "delete" | "select" | null = null;
      let values: unknown = null;

      const builder: Record<string, unknown> = {};

      for (const method of ["select", "eq", "in"]) {
        builder[method] = (...args: unknown[]) => {
          filters.push([method as string, ...args]);
          return builder;
        };
      }

      builder.upsert = (vals: unknown, _opts?: unknown) => {
        op = "upsert";
        values = vals;
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
        // Granular failure control: fail a specific operation on a specific table
        const failTable = fixture.failOn ? fixture.failOn === table : false;
        const failOp = fixture.failOp ? op === fixture.failOp : false;
        if ((failTable || failOp) && (fixture.failOp ? failOp : failTable)) {
          return resolve({ data: null, error: { message: "rechazado" } });
        }

        // External change check: routines select("description")
        if (
          table === "routines" &&
          filters.some((f) => f[0] === "select" && f[1] === "description")
        ) {
          const existingDesc = fixture.existingDescription ?? null;
          return resolve({
            data: { description: existingDesc },
            error: null,
          });
        }

        // Routine upsert returns { id }
        if (table === "routines" && op === "upsert") {
          return resolve({
            data: fixture.routineData ?? { id: "routine-1" },
            error: null,
          });
        }

        // Any other routines select (verify save)
        if (table === "routines") {
          return resolve({
            data: { id: "routine-1", title: fixture.verifyTitle ?? "Fuerza", description: "" },
            error: null,
          });
        }

        // routine_exercises select for cleanup
        if (table === "routine_exercises" && op === "select") {
          return resolve({ data: [], error: null });
        }

        // Delete for cleanup
        if (op === "delete") {
          return resolve({ data: null, error: null });
        }

        return resolve({ data: null, error: null });
      };

      return builder;
    },
  },
}));

beforeEach(() => {
  fixture = {};
  writes = [];
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function routineUpsertValues() {
  return writes.find((w) => w.table === "routines" && w.op === "upsert")?.values;
}

function exerciseRows() {
  const w = writes.find((w) => w.table === "routine_exercises" && w.op === "upsert");
  return (w?.values as Record<string, unknown>[]) ?? [];
}

async function runSave(
  draft: RoutineDraftV2,
  fix: {
    failOn?: string | null;
    failOp?: "upsert" | "delete" | "select" | null;
    existingDescription?: string | null;
    routineData?: { id: string } | null;
    verifyTitle?: string | null;
  } = {},
): Promise<ReturnType<typeof saveRoutine>> {
  Object.assign(fixture, fix);
  const savePromise = saveRoutine(draft);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return savePromise;
}

// ------------------------------------------------------------------- saveRoutine

describe("saveRoutine · camino feliz", () => {
  it("guarda una rutina nueva con id generado y devuelve routineId", async () => {
    const result = await runSave(
      makeDraft({
        id: "test-new",
        title: "Fuerza",
        description: "desc",
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: "desc" },
    );

    expect(result).toEqual({ ok: true, routineId: "test-new" });
    const vals = routineUpsertValues();
    expect(vals).toMatchObject({ title: "Fuerza", description: expect.any(String) });
  });

  it("escribe ejercicios con day_index correlativo y order_index por día", async () => {
    await runSave(
      makeDraft({
        id: "test-new",
        title: "Fuerza",
        description: "desc",
        days: [
          trainingDay("Lunes", 0, 1),
          {
            id: uid(),
            order: 1,
            weekday: 3,
            label: "Miércoles",
            kind: "training",
            exercises: [
              {
                exercise: ex("ex-2"),
                rowId: "d2-r1",
                target_sets: 3,
                rest_seconds: 120,
                order_index: 0,
                target_reps_min: 6,
                target_reps_max: 10,
              },
            ],
          },
        ],
      }),
      { existingDescription: "desc" },
    );

    const rows = exerciseRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      day_index: 0,
      order_index: 0,
      day_label: "Lunes",
      exercise_id: "ex-1",
    });
    expect(rows[1]).toMatchObject({
      day_index: 1,
      order_index: 0,
      day_label: "Miércoles",
      exercise_id: "ex-2",
    });
  });

  it("genera rowId para ejercicios que no lo tienen", async () => {
    await runSave(
      makeDraft({
        id: "test-new",
        title: "Fuerza",
        description: "desc",
        days: [
          {
            id: uid(),
            order: 0,
            weekday: 1,
            label: "Lunes",
            kind: "training",
            exercises: [
              {
                exercise: ex("ex-1"),
                target_sets: 3,
                rest_seconds: 90,
                order_index: 0,
                target_reps_min: 8,
                target_reps_max: 12,
              },
            ],
          },
        ],
      }),
      { existingDescription: "desc" },
    );

    const rows = exerciseRows();
    expect(rows[0].id).toBeDefined();
    expect(typeof rows[0].id).toBe("string");
  });
});

describe("saveRoutine · rutina existente", () => {
  it("guarda cuando la descripción en BD coincide", async () => {
    const result = await runSave(
      makeDraft({
        id: "routine-1",
        title: "Fuerza",
        description: "desc-v1",
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: "desc-v1" },
    );

    expect(result.ok).toBe(true);
  });

  it("rechaza con external_change si la descripción en BD difiere", async () => {
    const result = await runSave(
      makeDraft({
        id: "routine-1",
        title: "Fuerza",
        description: "desc-v1",
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: "desc-v2" },
    );

    expect(result).toEqual({ ok: false, error: "external_change" });
    expect(writes.find((w) => w.table === "routines" && w.op === "upsert")).toBeUndefined();
    expect(writes.find((w) => w.table === "routine_exercises")).toBeUndefined();
  });
});

describe("saveRoutine · fallos", () => {
  it("retorna not_found si la rutina existente no se encuentra", async () => {
    const result = await runSave(
      makeDraft({
        id: "routine-1",
        title: "Fuerza",
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { failOn: "routines", routineData: null },
    );

    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("retorna save_failed si el upsert de la rutina falla", async () => {
    const result = await runSave(
      makeDraft({
        id: "test-new",
        title: "Fuerza",
        description: "desc",
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { failOp: "upsert", existingDescription: "desc" },
    );

    expect(result).toEqual({ ok: false, error: "save_failed" });
  });

  it("retorna verify_failed si el título al verificar no coincide", async () => {
    const result = await runSave(
      makeDraft({
        id: "test-new",
        title: "Otro Título",
        description: "",
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: "", verifyTitle: "Fuerza" },
    );

    expect(result).toEqual({ ok: false, error: "verify_failed" });
  });

  it("nunca lanza aunque supabase falle", async () => {
    await expect(
      runSave(
        makeDraft({
          id: "test-new",
          title: "Fuerza",
          description: "desc",
          days: [trainingDay("Lunes", 0, 1)],
        }),
        { failOp: "upsert", existingDescription: "desc" },
      ),
    ).resolves.toEqual({ ok: false, error: "save_failed" });
  });
});

// ------------------------------------------------------------------- duplicateRoutine

describe("duplicateRoutine", () => {
  it("crea un draft nuevo con id=null y título nuevo", () => {
    const original = makeDraft({
      id: "routine-1",
      title: "Original",
      days: [trainingDay("Lunes", 0, 1)],
    });

    const copy = duplicateRoutine(original, "Copia");

    expect(copy.id).toBeNull();
    expect(copy.title).toBe("Copia");
    expect(copy.description).toBe("");
    expect(copy.mode).toBe("single");
    expect(copy.snapshot).toBeNull();
    expect(copy.needsModeConfirmation).toBe(false);
  });

  it("copia días y ejercicios sin rowId (se regeneran al insertar)", () => {
    const original = makeDraft({
      days: [trainingDay("Lunes", 0, 1)],
    });

    const copy = duplicateRoutine(original, "Copia");

    expect(copy.days).toHaveLength(1);
    expect(copy.days[0].id).not.toBeUndefined();
    expect(copy.days[0].order).toBe(0);
    expect(copy.days[0].label).toBe("Lunes");
    expect(copy.days[0].exercises).toHaveLength(1);
    expect(copy.days[0].exercises[0].rowId).toBeUndefined();
    expect(copy.days[0].exercises[0].exercise.id).toBe("ex-1");
    expect(copy.days[0].exercises[0].target_sets).toBe(3);
  });
});

// ------------------------------------------------------------------- restoreRoutine

describe("restoreRoutine", () => {
  it("crea un draft con id de la rutina existente", () => {
    const days: RoutineDraftV2["days"] = [
      {
        id: uid(),
        order: 0,
        weekday: 1,
        label: "Lunes",
        kind: "training",
        exercises: [],
      },
    ];

    const draft = restoreRoutine("routine-1", "Mi Rutina", "desc", "single", days);

    expect(draft.id).toBe("routine-1");
    expect(draft.title).toBe("Mi Rutina");
    expect(draft.description).toBe("desc");
    expect(draft.mode).toBe("single");
    expect(draft.days).toBe(days);
    expect(draft.snapshot).toBeNull();
    expect(draft.needsModeConfirmation).toBe(false);
  });
});

// ------------------------------------------------------------------- queue delegation

describe("queue delegation", () => {
  it("saveState devuelve idle inicialmente", () => {
    expect(saveState("clave-nueva")).toBe("idle");
  });

  it("subscribeSave retorna función de desuscripción", () => {
    const listener = vi.fn();
    const unsub = subscribeSave("clave", listener);
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("flushSave devuelve promesa", async () => {
    const result = await flushSave("clave-inexistente");
    expect(result).toBe(true);
  });
});
