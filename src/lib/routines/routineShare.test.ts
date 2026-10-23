/**
 * routineShare.test.ts — tests for the routine share / duplicate view model.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Exercise } from "@/types/supabase";
import type { DraftExercise } from "@/lib/routines/routineDraftModel";
import {
  DUPLICATE_SUFFIX,
  formatShareText,
  sanitizeForShare,
  shareRoutineText,
} from "./routineShare";

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: overrides.id ?? "e-test",
  name: overrides.name ?? "Test Exercise",
  body_part: overrides.body_part ?? "chest",
  target: overrides.target ?? "pectorals",
  equipment: overrides.equipment ?? "barbell",
  gif_url: overrides.gif_url ?? "",
  instructions: overrides.instructions ?? [],
});

const makeDraft = (exercise: Exercise, overrides: Partial<DraftExercise> = {}): DraftExercise => ({
  exercise,
  target_sets: overrides.target_sets ?? 3,
  rest_seconds: overrides.rest_seconds ?? 90,
  order_index: overrides.order_index ?? 0,
  target_reps_min: overrides.target_reps_min ?? null,
  target_reps_max: overrides.target_reps_max ?? null,
});

function makeShareable(
  items: DraftExercise[],
  title = "Push Day",
  description: string | null = null,
) {
  return { title, description, items };
}

describe("DUPLICATE_SUFFIX", () => {
  it("is exactly ' (copia)'", () => {
    expect(DUPLICATE_SUFFIX).toBe(" (copia)");
  });
});

describe("formatShareText", () => {
  it("renders title, count and duration", () => {
    const ex = makeExercise({ id: "e1", name: "Press banca" });
    const draft = makeShareable([makeDraft(ex)], "Push Day");

    const text = formatShareText(draft);
    expect(text).toContain("Rutina: Push Day");
    expect(text).toContain("1 ejercicio • ~15 min");
  });

  it("uses plural 'ejercicios' when count is not 1", () => {
    const ex = makeExercise({ id: "e1", name: "Press banca" });
    const draft = makeShareable([makeDraft(ex), makeDraft({ ...ex, id: "e2", name: "Sentadilla" })], "Full Body");

    const text = formatShareText(draft);
    expect(text).toContain("2 ejercicios");
  });

  it("includes numbered exercise list with sets/reps", () => {
    const bench = makeExercise({ id: "e1", name: "Press banca" });
    const squat = makeExercise({ id: "e2", name: "Sentadilla" });
    const draft = makeShareable([
      makeDraft(bench, { target_sets: 4, target_reps_min: 8, target_reps_max: 10 }),
      makeDraft(squat, { target_sets: 3, target_reps_min: 10, target_reps_max: 10 }),
    ], "Push Day");

    const text = formatShareText(draft);
    expect(text).toContain("1. Press banca (4 × 8-10)");
    expect(text).toContain("2. Sentadilla (3 × 10)");
  });

  it("renders description when present", () => {
    const ex = makeExercise({ id: "e1", name: "Press banca" });
    const draft = makeShareable([makeDraft(ex)], "Push Day", "Entrenamiento de fuerza");

    const text = formatShareText(draft);
    expect(text).toContain("Entrenamiento de fuerza");
  });

  it("omits description block when empty", () => {
    const ex = makeExercise({ id: "e1", name: "Press banca" });
    const draft = makeShareable([makeDraft(ex)], "Push Day", null);

    const text = formatShareText(draft);
    expect(text).not.toMatch(/\n{3}/);
  });
});

describe("sanitizeForShare", () => {
  it("preserves title, description and items shape", () => {
    const ex = makeExercise({ id: "e1", name: "Press banca" });
    const input = makeShareable([makeDraft(ex)], "Push Day", "Desc");

    const clean = sanitizeForShare(input);
    expect(clean.title).toBe("Push Day");
    expect(clean.description).toBe("Desc");
    expect(clean.items).toHaveLength(1);
    expect(clean.items[0].exercise.name).toBe("Press banca");
    expect(clean.items[0].target_sets).toBe(3);
  });

  it("preserves sets, reps, rest and order", () => {
    const ex = makeExercise({ id: "e1", name: "Press banca" });
    const item = makeDraft(ex, {
      target_sets: 4,
      rest_seconds: 120,
      target_reps_min: 8,
      target_reps_max: 10,
      order_index: 2,
    });
    const input = makeShareable([item], "Push Day");

    const clean = sanitizeForShare(input);
    expect(clean.items[0].target_sets).toBe(4);
    expect(clean.items[0].rest_seconds).toBe(120);
    expect(clean.items[0].target_reps_min).toBe(8);
    expect(clean.items[0].target_reps_max).toBe(10);
    expect(clean.items[0].order_index).toBe(2);
  });

  it("does not include user_id in the exercise", () => {
    const ex = makeExercise({ id: "e1", name: "Press banca" });
    const input = makeShareable([makeDraft(ex)], "Push Day");

    const clean = sanitizeForShare(input);
    const serialized = JSON.stringify(clean);
    expect(serialized).not.toContain("user_id");
    expect(serialized).not.toContain("user_id");
  });
});

describe("shareRoutineText", () => {
  const originalShare = globalThis.navigator.share;
  const originalClipboard = globalThis.navigator.clipboard;

  beforeEach(() => {
    // Reset navigator mocks per test.
    Object.defineProperty(globalThis.navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis.navigator, "share", {
      value: originalShare,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  it("uses Web Share API when available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "share", {
      value: shareMock,
      configurable: true,
    });

    const result = await shareRoutineText("Push Day", "Rutina: Push Day");
    expect(result).toBe(true);
    expect(shareMock).toHaveBeenCalledWith({
      title: "Push Day",
      text: "Rutina: Push Day",
    });
  });

  it("falls back to clipboard when Web Share API is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const result = await shareRoutineText("Push Day", "Rutina: Push Day");
    expect(result).toBe(false);
    expect(writeText).toHaveBeenCalledWith("Rutina: Push Day");
  });

  it("falls back to clipboard when Web Share rejects", async () => {
    Object.defineProperty(globalThis.navigator, "share", {
      value: vi.fn().mockRejectedValue(new Error("aborted")),
      configurable: true,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const result = await shareRoutineText("Push Day", "Rutina: Push Day");
    expect(result).toBe(false);
    expect(writeText).toHaveBeenCalledWith("Rutina: Push Day");
  });

  it("returns false when neither API is available", async () => {
    const result = await shareRoutineText("Push Day", "Rutina: Push Day");
    expect(result).toBe(false);
  });
});
