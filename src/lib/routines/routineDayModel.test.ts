import { describe, expect, it } from "vitest";
import type { Exercise } from "@/types/supabase";
import {
  draftFromRoutine,
  displayDayLabel,
  newDraftKey,
  swapDayContents,
  type RoutineDay,
  type RoutineDraftV2,
  validateDraft,
} from "./routineDayModel";
import type { PlannedExercise, RoutineWithExercises } from "@/hooks/useGymData";

const EXERCISE: Exercise = {
  id: "0001",
  name: "Press banca",
  body_part: "chest",
  target: "pectorals",
  equipment: "body weight",
  gif_url: "",
  instructions: [],
  name_es: null,
  is_active: true,
  is_hidden: false,
};

function makeDay(overrides: Partial<RoutineDay> = {}): RoutineDay {
  return {
    id: crypto.randomUUID(),
    order: 0,
    weekday: null,
    label: "",
    kind: "training",
    exercises: [{ exercise: EXERCISE, target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null }],
    ...overrides,
  };
}

function makeDraft(overrides: Partial<RoutineDraftV2> = {}): RoutineDraftV2 {
  const draft: RoutineDraftV2 = {
    id: null,
    title: "Push Day",
    description: "",
    mode: "single",
    days: [makeDay()],
    snapshot: null,
    ...overrides,
  };
  return draft;
}

describe("displayDayLabel", () => {
  it("returns the custom label when present, single mode", () => {
    const day = makeDay({ label: "Pecho" });
    expect(displayDayLabel(day, "single")).toBe("Pecho");
  });

  it("returns Día A/B for training days in single mode", () => {
    const day0 = makeDay({ order: 0, label: "", kind: "training" });
    const day1 = makeDay({ order: 1, label: "", kind: "training" });
    expect(displayDayLabel(day0, "single")).toBe("Día A");
    expect(displayDayLabel(day1, "single")).toBe("Día B");
  });

  it("returns the weekday name in weekly mode", () => {
    const day = makeDay({ kind: "training", weekday: 2, label: "" });
    expect(displayDayLabel(day, "weekly")).toBe("Miércoles");
  });

  it("returns Descanso for a rest day", () => {
    const day = makeDay({ kind: "rest", label: "" });
    expect(displayDayLabel(day, "weekly")).toBe("Descanso");
  });

  it("returns Movilidad for a mobility day", () => {
    const day = makeDay({ kind: "mobility", label: "" });
    expect(displayDayLabel(day, "weekly")).toBe("Movilidad");
  });

  it("returns Sin sesión programada for an empty day", () => {
    const day = makeDay({ kind: "empty", label: "" });
    expect(displayDayLabel(day, "weekly")).toBe("Sin sesión programada");
  });

  it("returns Sin sesión programada for an empty day even with a label", () => {
    const day = makeDay({ kind: "empty", label: "Descanso activo" });
    expect(displayDayLabel(day, "weekly")).toBe("Sin sesión programada");
  });

  it("prefers the custom label over the weekday in weekly mode", () => {
    const day = makeDay({ kind: "training", weekday: 0, label: "Lunes: Pecho" });
    expect(displayDayLabel(day, "weekly")).toBe("Lunes: Pecho");
  });
});

describe("swapDayContents", () => {
  it("swaps kind, label and exercises between two days by order", () => {
    const a = makeDay({ order: 0, weekday: 0, kind: "training", label: "Lunes", exercises: [{ exercise: EXERCISE, target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null }] });
    const b = makeDay({ order: 1, weekday: 1, kind: "rest", label: "Martes", exercises: [] });
    const result = swapDayContents([a, b], 0, 1);
    expect(result[0].kind).toBe("rest");
    expect(result[0].label).toBe("Martes");
    expect(result[0].exercises).toHaveLength(0);
    expect(result[1].kind).toBe("training");
    expect(result[1].label).toBe("Lunes");
    expect(result[1].exercises).toHaveLength(1);
  });

  it("swaps by weekday in weekly mode", () => {
    const a = makeDay({ order: 0, weekday: 0, kind: "training", label: "Lunes" });
    const b = makeDay({ order: 1, weekday: 6, kind: "rest", label: "Domingo" });
    const result = swapDayContents([a, b], 0, 6);
    expect(result[0].kind).toBe("rest");
    expect(result[1].kind).toBe("training");
  });

  it("returns the same array when indices are equal", () => {
    const a = makeDay({ order: 0 });
    const input = [a];
    const result = swapDayContents(input, 0, 0);
    expect(result).toBe(input);
  });

  it("returns the same array when a day is not found", () => {
    const a = makeDay({ order: 0 });
    const result = swapDayContents([a], 0, 5);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(a);
  });
});

describe("validateDraft", () => {
  it("accepts a valid single-mode draft", () => {
    expect(validateDraft(makeDraft())).toEqual([]);
  });

  it("rejects a blank title", () => {
    expect(validateDraft(makeDraft({ title: "   " }))).toContain("noTitle");
  });

  it("rejects a title that is too short", () => {
    expect(validateDraft(makeDraft({ title: "ab" }))).toContain("titleTooShort");
  });

  it("rejects a draft with no days", () => {
    expect(validateDraft(makeDraft({ days: [] }))).toContain("noExercises");
  });

  it("rejects a weekly draft that does not have 7 days", () => {
    expect(validateDraft(makeDraft({ mode: "weekly", days: [makeDay(), makeDay()] }))).toContain("weekdayConflict");
  });

  it("rejects duplicate day ids", () => {
    const id = crypto.randomUUID();
    const days = [makeDay({ id }), makeDay({ id })];
    expect(validateDraft(makeDraft({ days }))).toContain("invalidDayId");
  });

  it("rejects a training day without exercises", () => {
    expect(validateDraft(makeDraft({ days: [makeDay({ exercises: [] })] }))).toContain("dayWithoutExercises");
  });

  it("rejects a non-training day with exercises", () => {
    const day = makeDay({ kind: "rest", exercises: [{ exercise: EXERCISE, target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null }] });
    expect(validateDraft(makeDraft({ days: [day] }))).toContain("dayWithoutExercises");
  });

  it("rejects duplicate rowIds within a draft", () => {
    const rowId = crypto.randomUUID();
    const day = makeDay({
      exercises: [
        { exercise: EXERCISE, target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null, rowId },
        { exercise: EXERCISE, target_sets: 3, rest_seconds: 90, order_index: 1, target_reps_min: null, target_reps_max: null, rowId },
      ],
    });
    expect(validateDraft(makeDraft({ days: [day] }))).toContain("duplicateRowId");
  });

  it("V9: rejects the same rowId in two different days", () => {
    const rowId = crypto.randomUUID();
    const day1 = makeDay({
      id: crypto.randomUUID(),
      order: 0,
      exercises: [{ exercise: EXERCISE, target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null, rowId }],
    });
    const day2 = makeDay({
      id: crypto.randomUUID(),
      order: 1,
      exercises: [{ exercise: EXERCISE, target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null, rowId }],
    });
    expect(validateDraft(makeDraft({ days: [day1, day2] }))).toContain("duplicateRowId");
  });

  it("rejects a weekly draft with duplicate weekdays", () => {
    const days = [makeDay({ weekday: 0 }), makeDay({ weekday: 0 })];
    expect(validateDraft(makeDraft({ mode: "weekly", days }))).toContain("weekdayConflict");
  });

  it("rejects a weekly draft with no training day", () => {
    const days = [makeDay({ kind: "rest" }), makeDay({ kind: "rest" })];
    expect(validateDraft(makeDraft({ mode: "weekly", days }))).toContain("noTrainingDay");
  });

  it("rejects a single-mode draft with more than 14 days", () => {
    const days = Array.from({ length: 15 }, () => makeDay());
    expect(validateDraft(makeDraft({ mode: "single", days }))).toContain("tooManyDays");
  });

  it("rejects a saved draft with no snapshot", () => {
    expect(validateDraft(makeDraft({ id: "routine-1", snapshot: null }))).toContain("missingSnapshot");
  });
});

describe("newDraftKey", () => {
  it("returns a UUID string", () => {
    const key = newDraftKey();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns unique values on each call", () => {
    expect(newDraftKey()).not.toBe(newDraftKey());
  });
});

describe("draftFromRoutine", () => {
  function makePlannedExercise(overrides: {
    exerciseId?: string;
    dayIndex?: number;
    dayLabel?: string;
    rowId?: string;
    target_sets?: number;
    rest_seconds?: number;
  } = {}): PlannedExercise {
    return {
      exercise: { ...EXERCISE, id: overrides.exerciseId ?? "0001" },
      target_sets: overrides.target_sets ?? 3,
      rest_seconds: overrides.rest_seconds ?? 90,
      rowId: overrides.rowId ?? crypto.randomUUID(),
      dayIndex: overrides.dayIndex ?? 0,
      dayLabel: overrides.dayLabel ?? "",
    };
  }

  function makeRoutine(overrides: {
    id?: string;
    title?: string;
    description?: string | null;
    exercises?: PlannedExercise[];
  } = {}): RoutineWithExercises {
    return {
      id: overrides.id ?? "routine-1",
      user_id: "user-1",
      title: overrides.title ?? "Rutina",
      description: overrides.description ?? null,
      created_at: "2026-01-01T00:00:00Z",
      is_favorite: false,
      source: "user",
      authored_by_coach: null,
      is_template: false,
      exercises: overrides.exercises ?? [],
    };
  }

  // U6: sobre válido → los días recuperan sus id
  it("U6: sobre válido reconstruye días con los ids del sobre", () => {
    const dayIdA = crypto.randomUUID();
    const dayIdB = crypto.randomUUID();
    const meta = {
      v: 1,
      text: "desc",
      mode: "single",
      days: [
        { id: dayIdA, order: 0, weekday: null, label: "Día A", kind: "training" },
        { id: dayIdB, order: 1, weekday: null, label: "Día B", kind: "training" },
      ],
    };
    const routine = makeRoutine({
      description: JSON.stringify(meta),
      exercises: [
        makePlannedExercise({ dayIndex: 0, rowId: "row-1" }),
        makePlannedExercise({ dayIndex: 1, rowId: "row-2" }),
      ],
    });
    const draft = draftFromRoutine(routine);
    expect(draft.days).toHaveLength(2);
    expect(draft.days[0].id).toBe(dayIdA);
    expect(draft.days[1].id).toBe(dayIdB);
    expect(draft.days[0].exercises).toHaveLength(1);
    expect(draft.days[0].exercises[0].rowId).toBe("row-1");
    expect(draft.days[1].exercises[0].rowId).toBe("row-2");
    expect(draft.snapshot!.rows).toHaveLength(2);
    expect(draft.snapshot!.title).toBe("Rutina");
    expect(draft.snapshot!.description).toBe(JSON.stringify(meta));
  });

  // U7: sobre incoherente → fallback legado + sucio
  it("U7: sobre incoherente cae a legado con needsModeConfirmation", () => {
    const dayId = crypto.randomUUID();
    const meta = {
      v: 1,
      text: "desc",
      mode: "weekly",
      days: [
        { id: dayId, order: 0, weekday: 0, label: "Lunes", kind: "training" },
      ],
    };
    const routine = makeRoutine({
      description: JSON.stringify(meta),
      exercises: [makePlannedExercise({ dayIndex: 5, rowId: "row-1" })],
    });
    const draft = draftFromRoutine(routine);
    expect(draft.mode).toBe("single");
    expect(draft.needsModeConfirmation).toBe(true);
    expect(draft.days).toHaveLength(1);
    expect(draft.days[0].id).not.toBe(dayId);
    expect(draft.days[0].weekday).toBeNull();
  });

  // U8: legado → cualquier número de day_index → single + confirmación
  it("U8: legado con day_index dispersos → single, needsModeConfirmation, ids regenerados", () => {
    const routine = makeRoutine({
      description: "just text",
      exercises: [
        makePlannedExercise({ dayIndex: 0, rowId: "row-1" }),
        makePlannedExercise({ dayIndex: 2, rowId: "row-2" }),
        makePlannedExercise({ dayIndex: 5, rowId: "row-3" }),
      ],
    });
    const draft = draftFromRoutine(routine);
    expect(draft.mode).toBe("single");
    expect(draft.needsModeConfirmation).toBe(true);
    expect(draft.days).toHaveLength(3);
    expect(draft.days[0].order).toBe(0);
    expect(draft.days[1].order).toBe(1);
    expect(draft.days[2].order).toBe(2);
    expect(draft.days[0].weekday).toBeNull();
    expect(draft.days[0].kind).toBe("training");
    expect(draft.days[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  // U20: legado rotativo A/B/C → single + confirmación pendiente
  it("U20: legado con 3 días → single con needsModeConfirmation", () => {
    const routine = makeRoutine({
      description: null,
      exercises: [
        makePlannedExercise({ dayIndex: 0, rowId: "row-1" }),
        makePlannedExercise({ dayIndex: 1, rowId: "row-2" }),
        makePlannedExercise({ dayIndex: 2, rowId: "row-3" }),
      ],
    });
    const draft = draftFromRoutine(routine);
    expect(draft.mode).toBe("single");
    expect(draft.needsModeConfirmation).toBe(true);
    expect(draft.days).toHaveLength(3);
  });

  // U21: legado con day_label "Lunes" → texto no afecta estructura
  it("U21: legado con day_label 'Lunes' → weekday sigue null, kind training", () => {
    const routine = makeRoutine({
      description: "not json",
      exercises: [makePlannedExercise({ dayIndex: 0, dayLabel: "Lunes", rowId: "row-1" })],
    });
    const draft = draftFromRoutine(routine);
    expect(draft.mode).toBe("single");
    expect(draft.needsModeConfirmation).toBe(true);
    expect(draft.days[0].weekday).toBeNull();
    expect(draft.days[0].kind).toBe("training");
  });

  // U17: 0 filas + sobre con días training → incomplete
  it("U17: 0 filas + sobre con días training → draft incompleto (validateDraft falla)", () => {
    const dayId = crypto.randomUUID();
    const meta = {
      v: 1,
      text: "desc",
      mode: "single",
      days: [
        { id: dayId, order: 0, weekday: null, label: "Día A", kind: "training" },
      ],
    };
    const routine = makeRoutine({
      description: JSON.stringify(meta),
      exercises: [],
    });
    const draft = draftFromRoutine(routine);
    expect(draft.days).toHaveLength(1);
    expect(draft.days[0].exercises).toHaveLength(0);
    const problems = validateDraft(draft);
    expect(problems).toContain("dayWithoutExercises");
  });
});
