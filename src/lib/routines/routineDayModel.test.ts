import { describe, expect, it } from "vitest";
import type { Exercise } from "@/types/supabase";
import {
  displayDayLabel,
  newDraftKey,
  swapDayContents,
  type RoutineDay,
  type RoutineDraftV2,
  validateDraft,
} from "./routineDayModel";

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
    expect(validateDraft(makeDraft({ id: "routine-1", snapshot: null }))).toContain("rowIdNotOwned");
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
