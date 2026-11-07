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
import { validateDraft } from "./routineDayModel";

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
    draftKey: crypto.randomUUID(),
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
  op: "upsert" | "delete" | "select" | "update";
}

let fixture: {
  userId?: string;
  failOn?: string | null;
  failOp?: "upsert" | "delete" | "select" | "update" | null;
  existingDescription?: string | null;
  routineData?: { id: string } | null;
  verifyTitle?: string | null;
  ownershipRoutineId?: string | null;
} = {};
let writes: Write[] = [];

vi.mock("@lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const filters: Call[] = [];
      let op: "upsert" | "delete" | "select" | "update" | null = null;
      let values: unknown = null;

      const builder: Record<string, unknown> = {};

      for (const method of ["select", "eq", "in", "order"]) {
        builder[method] = (...args: unknown[]) => {
          filters.push([method as string, ...args]);
          if (method === "select" && op === null) op = "select";
          return builder;
        };
      }

      builder.upsert = (vals: unknown, _opts?: unknown) => {
        op = "upsert";
        values = vals;
        writes.push({ table, values, filters, op });
        return builder;
      };

      builder.update = (vals: unknown) => {
        op = "update";
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
        // Granular failure control
        const failTable = fixture.failOn ? fixture.failOn === table : false;
        const failOp = fixture.failOp ? op === fixture.failOp : false;
        if ((failTable || failOp) && (fixture.failOp ? failOp : failTable)) {
          return resolve({ data: null, error: { message: "rechazado" } });
        }

        // Validar user_id en upsert de creación (crítico 1)
        if (table === "routines" && op === "upsert") {
          const v = values as Record<string, unknown>;
          if (v.user_id !== fixture.userId) {
            return resolve({ data: null, error: { message: "invalid user_id" } });
          }
        }

        // External change check: routines select("description")
        if (
          table === "routines" &&
          filters.some((f) => f[0] === "select" && f[1] === "description")
        ) {
          // La descripción de BD es el sobre JSON crudo, no el texto plano
          const existingDesc = fixture.existingDescription ?? null;
          return resolve({
            data: { description: existingDesc },
            error: null,
          });
        }

        // Routine upsert/update returns { id }
        if (table === "routines" && (op === "upsert" || op === "update")) {
          return resolve({
            data: fixture.routineData ?? { id: "routine-1" },
            error: null,
          });
        }

        // Any other routines select (verify save)
        if (table === "routines" && op === "select") {
          const lastUpsert = writes.find((w) => w.table === "routines" && w.op === "upsert");
          const lastUpdate = writes.find((w) => w.table === "routines" && w.op === "update");
          const upsertedDesc = lastUpsert ? (lastUpsert.values as Record<string, unknown>).description : null;
          const updatedDesc = lastUpdate ? (lastUpdate.values as Record<string, unknown>).description : null;
          const description = upsertedDesc ?? updatedDesc ?? (fixture.existingDescription ?? "");
          return resolve({
            data: { id: "routine-1", title: fixture.verifyTitle ?? "Fuerza", description },
            error: null,
          });
        }

        // routine_exercises select for ownership check (N4)
        if (table === "routine_exercises" && op === "select" && filters.some((f) => f[0] === "in")) {
          // rowIds como propiedad de routine-1 por defecto, o de otra rutina si se indica
          const rowIds = filters.find((f) => f[0] === "in")?.[2] as string[] ?? [];
          const ownerId = fixture.ownershipRoutineId ?? "routine-1";
          return resolve({
            data: rowIds.map((id) => ({ id, routine_id: ownerId })),
            error: null,
          });
        }

        // routine_exercises select for verify save (return upserted rows)
        if (table === "routine_exercises" && op === "select") {
          const lastUpsert = writes.find((w) => w.table === "routine_exercises" && w.op === "upsert");
          const rows = lastUpsert ? (lastUpsert.values as Record<string, unknown>[]) : [];
          return resolve({ data: rows, error: null });
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

function routineUpdateValues() {
  return writes.find((w) => w.table === "routines" && w.op === "update")?.values;
}

function exerciseRows() {
  const w = writes.find((w) => w.table === "routine_exercises" && w.op === "upsert");
  return (w?.values as Record<string, unknown>[]) ?? [];
}

async function runSave(
  userId: string,
  draft: RoutineDraftV2,
  fix: {
    userId?: string;
    failOn?: string | null;
    failOp?: "upsert" | "delete" | "select" | "update" | null;
    existingDescription?: string | null;
    routineData?: { id: string } | null;
    verifyTitle?: string | null;
    ownershipRoutineId?: string | null;
  } = {},
): Promise<ReturnType<typeof saveRoutine>> {
  Object.assign(fixture, { userId, ...fix });
  const savePromise = saveRoutine(userId, draft);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return savePromise;
}

// ------------------------------------------------------------------- saveRoutine

describe("saveRoutine · camino feliz", () => {
  it("guarda una rutina nueva con user_id y devuelve routineId", async () => {
    const result = await runSave(
      "user-1",
      makeDraft({
        id: null,
        title: "Fuerza",
        description: "desc",
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: "desc" },
    );

    expect(result).toEqual({ ok: true, routineId: expect.any(String) });
    const vals = routineUpsertValues();
    expect(vals).toMatchObject({ title: "Fuerza", user_id: "user-1", description: expect.any(String) });
  });

  it("rechaza si el user_id del upsert no coincide", async () => {
    const result = await runSave(
      "user-1",
      makeDraft({
        id: null,
        title: "Fuerza",
        description: "desc",
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { userId: "otro-usuario", existingDescription: "desc" },
    );

    expect(result).toEqual({ ok: false, error: "save_failed" });
  });

  it("escribe ejercicios con day_index = day.order", async () => {
    await runSave(
      "user-1",
      makeDraft({
        id: null,
        title: "Fuerza",
        description: "desc",
        days: [
          trainingDay("Lunes", 0, 1),
          {
            id: uid(),
            order: 3,
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
      day_index: 3,
      order_index: 0,
      day_label: "Miércoles",
      exercise_id: "ex-2",
    });
  });

  it("rechaza ejercicios sin rowId (error de validación)", async () => {
    const result = await runSave(
      "user-1",
      makeDraft({
        id: null,
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
                // sin rowId
              },
            ],
          },
        ],
      }),
      { existingDescription: "desc" },
    );

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("verifySave pasa aunque los días del draft no vengan ordenados por day_index (compara por rowId)", async () => {
    const result = await runSave(
      "user-1",
      makeDraft({
        id: null,
        title: "Fuerza",
        description: "desc",
        days: [
          {
            id: uid(),
            order: 3,
            weekday: 3,
            label: "Miércoles",
            kind: "training",
            exercises: [
              {
                exercise: ex("ex-2"),
                rowId: "d3-r1",
                target_sets: 3,
                rest_seconds: 120,
                order_index: 0,
                target_reps_min: 6,
                target_reps_max: 10,
              },
            ],
          },
          {
            id: uid(),
            order: 0,
            weekday: 1,
            label: "Lunes",
            kind: "training",
            exercises: [
              {
                exercise: ex("ex-1"),
                rowId: "d1-r1",
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

    expect(result).toEqual({ ok: true, routineId: expect.any(String) });
    const rows = exerciseRows();
    expect(rows).toHaveLength(2);
    // day_index = day.order, no la posición en el array
    expect(rows.find((r) => r.id === "d1-r1")?.day_index).toBe(0);
    expect(rows.find((r) => r.id === "d3-r1")?.day_index).toBe(3);
  });
});

describe("saveRoutine · rutina existente", () => {
  it("usa .update() (no upsert) y conserva user_id", async () => {
    await runSave(
      "user-1",
      makeDraft({
        id: "routine-1",
        title: "Fuerza",
        description: "desc-v1",
        snapshot: { title: "Fuerza", description: "desc-v1", rows: [] },
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: "desc-v1" },
    );

    const upd = routineUpdateValues();
    expect(upd).toMatchObject({ title: "Fuerza", description: expect.any(String) });
    expect(routineUpsertValues()).toBeUndefined();
  });

  it("rechaza con external_change si la descripción de BD difiere del snapshot", async () => {
    const result = await runSave(
      "user-1",
      makeDraft({
        id: "routine-1",
        title: "Fuerza",
        description: "desc-v1",
        snapshot: { title: "Fuerza", description: "desc-v0", rows: [] },
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: '{"v":1,"text":"desc-v0","mode":"single","days":[]}' },
    );

    expect(result).toEqual({ ok: false, error: "external_change" });
    expect(routineUpdateValues()).toBeUndefined();
    expect(writes.find((w) => w.table === "routine_exercises")).toBeUndefined();
  });

  it("no permite editar una rutina existente sin snapshot (missingSnapshot)", async () => {
    const result = await runSave(
      "user-1",
      makeDraft({
        id: "routine-1",
        title: "Fuerza",
        description: "desc-v1",
        snapshot: null,
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: '{"v":1,"text":"desc-v1","mode":"single","days":[]}' },
    );

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("edita una rutina existente con sobre JSON: snapshot igual al sobre de BD → ok", async () => {
    const envelope = '{"v":1,"text":"desc-v1","mode":"single","days":[{"id":"day-1","order":0,"weekday":null,"label":"Lunes","kind":"training"}]}';
    const result = await runSave(
      "user-1",
      makeDraft({
        id: "routine-1",
        title: "Fuerza",
        description: "desc-v1",
        snapshot: { title: "Fuerza", description: envelope, rows: [] },
        days: [trainingDay("Lunes", 0, 1)],
      }),
      { existingDescription: envelope },
    );

    expect(result).toEqual({ ok: true, routineId: expect.any(String) });
    const upd = routineUpdateValues();
    expect(upd).toMatchObject({ title: "Fuerza", description: expect.any(String) });
    expect(routineUpsertValues()).toBeUndefined();
  });

  it("rowId que pertenece a otra rutina → rowIdNotOwned y ninguna escritura", async () => {
    const result = await runSave(
      "user-1",
      makeDraft({
        id: "routine-1",
        title: "Fuerza",
        description: "desc-v1",
        snapshot: { title: "Fuerza", description: "desc-v1", rows: [] },
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
                rowId: "foreign-row-1",
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
      { existingDescription: "desc-v1", ownershipRoutineId: "otra-rutina" },
    );

    expect(result).toEqual({ ok: false, error: "rowIdNotOwned" });
    expect(routineUpdateValues()).toBeUndefined();
    expect(routineUpsertValues()).toBeUndefined();
    expect(writes.find((w) => w.table === "routine_exercises" && w.op === "upsert")).toBeUndefined();
  });
});

describe("saveRoutine · fallos", () => {
  it("retorna not_found si la rutina existente no se encuentra", async () => {
    const result = await runSave(
      "user-1",
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
      "user-1",
      makeDraft({
        id: null,
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
      "user-1",
      makeDraft({
        id: null,
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
        "user-1",
        makeDraft({
          id: null,
          title: "Fuerza",
          description: "desc",
          days: [trainingDay("Lunes", 0, 1)],
        }),
        { failOp: "upsert", existingDescription: "desc" },
      ),
    ).resolves.toEqual({ ok: false, error: "save_failed" });
  });

  it("dos guardados rápidos de un draft nuevo crean una sola rutina y ambas promesas se resuelven", async () => {
    fixture.userId = "user-1";
    const draft = makeDraft({
      id: null,
      title: "Fuerza",
      description: "desc",
      days: [trainingDay("Lunes", 0, 1)],
    });

    const p1 = saveRoutine("user-1", draft);
    const p2 = await saveRoutine("user-1", draft);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeDefined();
    expect(r2.ok).toBe(true);
    const upserts = writes.filter((w) => w.table === "routines" && w.op === "upsert");
    expect(upserts).toHaveLength(1);
  });
});

// ------------------------------------------------------------------- duplicateRoutine

describe("duplicateRoutine", () => {
  it("crea un draft nuevo con id=null, título nuevo y descripción conservada", () => {
    const original = makeDraft({
      id: "routine-1",
      title: "Original",
      description: "texto del usuario",
      days: [trainingDay("Lunes", 0, 1)],
    });

    const copy = duplicateRoutine(original, "Copia");

    expect(copy.id).toBeNull();
    expect(copy.title).toBe("Copia");
    expect(copy.description).toBe("texto del usuario");
    expect(copy.draftKey).not.toBe(original.draftKey);
    expect(copy.mode).toBe("single");
    expect(copy.snapshot).toBeNull();
    expect(copy.needsModeConfirmation).toBe(false);
  });

  it("copia días y ejercicios con rowId nuevos, distintos del original", () => {
    const original = makeDraft({
      days: [trainingDay("Lunes", 0, 1)],
    });

    const copy = duplicateRoutine(original, "Copia");

    expect(copy.days).toHaveLength(1);
    expect(copy.days[0].id).not.toBeUndefined();
    expect(copy.days[0].order).toBe(0);
    expect(copy.days[0].label).toBe("Lunes");
    expect(copy.days[0].exercises).toHaveLength(1);
    expect(copy.days[0].exercises[0].rowId).toBeDefined();
    expect(copy.days[0].exercises[0].rowId).not.toBe(original.days[0].exercises[0].rowId);
    expect(copy.days[0].exercises[0].exercise.id).toBe("ex-1");
    expect(copy.days[0].exercises[0].target_sets).toBe(3);
  });

  it("el draft duplicado pasa validateDraft (sin missingRowId)", () => {
    const original = makeDraft({
      days: [trainingDay("Lunes", 0, 1)],
    });

    const copy = duplicateRoutine(original, "Copia");

    const problems = validateDraft(copy);
    expect(problems).not.toContain("missingRowId");
  });
});

// ------------------------------------------------------------------- restoreRoutine

describe("restoreRoutine", () => {
  it("crea un draft con id de la rutina existente y draftKey estable", () => {
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
    expect(draft.draftKey).toBeDefined();
    expect(typeof draft.draftKey).toBe("string");
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

  // --- Issue 2: wrappers resuelven draftKey → draft:${draftKey} para rutinas nuevas ---

  it("flushSave(draftKey) fuerza el guardado de una rutina nueva", async () => {
    vi.useFakeTimers();
    fixture.userId = "user-1";
    const draft = makeDraft({
      id: null,
      title: "Fuerza",
      description: "desc",
      days: [trainingDay("Lunes", 0, 1)],
    });
    const savePromise = saveRoutine("user-1", draft);
    vi.advanceTimersByTime(50);
    const flushed = await flushSave(draft.draftKey);
    expect(flushed).toBe(true);
    const result = await savePromise;
    expect(result.ok).toBe(true);
    vi.useRealTimers();
  });

  it("saveState(draftKey) refleja saving durante el guardado de una rutina nueva", async () => {
    vi.useFakeTimers();
    fixture.userId = "user-1";
    const draft = makeDraft({
      id: null,
      title: "Fuerza",
      description: "desc",
      days: [trainingDay("Lunes", 0, 1)],
    });
    const savePromise = saveRoutine("user-1", draft);
    vi.advanceTimersByTime(800);
    expect(saveState(draft.draftKey)).toBe("saving");
    await savePromise;
    await Promise.resolve();
    expect(saveState(draft.draftKey)).toBe("idle");
    vi.useRealTimers();
  });

  it("subscribeSave(draftKey) recibe cambios de estado de una rutina nueva", () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const unsub = subscribeSave("nuevo-draft-key", listener);
    const draft = makeDraft({
      id: null,
      title: "Fuerza",
      description: "desc",
      days: [trainingDay("Lunes", 0, 1)],
    });
    (draft as any).draftKey = "nuevo-draft-key";
    saveRoutine("user-1", draft);
    expect(listener).toHaveBeenCalledWith("dirty");
    unsub();
    vi.useRealTimers();
  });
});
