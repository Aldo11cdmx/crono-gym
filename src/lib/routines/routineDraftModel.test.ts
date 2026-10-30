/**
 * routineDraftModel.test.ts — exercises the pure helpers for the
 * RoutinesPage draft model: duration estimation, rep labels, draft
 * validation, and the empty-draft seed.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETS,
  DEFAULT_REST_SECONDS,
  draftProblem,
  emptyDraft,
  estimateRoutineDuration,
  getExerciseName,
  getRepLabel,
  isSavableDraft,
  type DraftExercise,
  type RoutineDraft,
} from "./routineDraftModel";
import type { Exercise } from "@/types/supabase";

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

function makeItem(overrides: Partial<DraftExercise> = {}): DraftExercise {
  return {
    exercise: EXERCISE,
    target_sets: DEFAULT_SETS,
    rest_seconds: DEFAULT_REST_SECONDS,
    order_index: 0,
    target_reps_min: null,
    target_reps_max: null,
    ...overrides,
  };
}

function makeDraft(overrides: Partial<RoutineDraft> = {}): RoutineDraft {
  return {
    id: null,
    title: "Push Day",
    description: "",
    dayIndex: 0,
    dayLabel: "Pecho",
    items: [makeItem({ order_index: 0 })],
    ...overrides,
  };
}

describe("emptyDraft", () => {
  it("starts with no id and an empty item list", () => {
    const d = emptyDraft();
    expect(d.id).toBeNull();
    expect(d.title).toBe("");
    expect(d.items).toHaveLength(0);
  });
});

describe("draftProblem", () => {
  it("returns noTitle when the title is blank", () => {
    expect(draftProblem(makeDraft({ title: "   " }))).toBe("noTitle");
  });

  it("returns noExercises when there are no items", () => {
    expect(draftProblem(makeDraft({ items: [] }))).toBe("noExercises");
  });

  it("returns null for a valid draft", () => {
    expect(draftProblem(makeDraft())).toBeNull();
  });
});

describe("isSavableDraft", () => {
  it("rejects a draft with no title", () => {
    expect(isSavableDraft(makeDraft({ title: "" }))).toBe(false);
  });

  it("rejects a draft with no exercises", () => {
    expect(isSavableDraft(makeDraft({ items: [] }))).toBe(false);
  });

  it("accepts a complete draft", () => {
    expect(isSavableDraft(makeDraft())).toBe(true);
  });
});

describe("getExerciseName", () => {
  it("returns the exercise name when present", () => {
    expect(getExerciseName(EXERCISE)).toBe("Press banca");
  });

  it("returns the Spanish label of a catalog exercise", () => {
    // The app's single vocabulary for an exercise name: the Spanish one.
    expect(getExerciseName({ ...EXERCISE, name: "Barbell Bench Press" })).toBe(
      "Press de banca con barra",
    );
  });

  it("falls back to the id when the name is blank", () => {
    const unnamed: Exercise = { ...EXERCISE, name: "" };
    expect(getExerciseName(unnamed)).toBe("#0001");
  });
});

describe("getRepLabel", () => {
  it("shows sets only when reps are null", () => {
    expect(getRepLabel(makeItem())).toBe("3 series");
  });

  it("shows a single rep count when min equals max", () => {
    expect(getRepLabel(makeItem({ target_reps_min: 10, target_reps_max: 10 }))).toBe("3 × 10");
  });

  it("shows a range when min and max differ", () => {
    expect(getRepLabel(makeItem({ target_reps_min: 8, target_reps_max: 10 }))).toBe("3 × 8-10");
  });

  it("shows a plus when only min is specified", () => {
    expect(getRepLabel(makeItem({ target_reps_min: 8, target_reps_max: null }))).toBe("3 × 8+");
  });
});

describe("estimateRoutineDuration", () => {
  it("returns 0 for a draft with no items", () => {
    expect(estimateRoutineDuration(makeDraft({ items: [] }))).toBe(0);
  });

  it("floors at 15 minutes", () => {
    const oneExercise = makeDraft({
      items: [makeItem({ rest_seconds: 0 })],
    });
    expect(estimateRoutineDuration(oneExercise)).toBe(15);
  });

  it("adds work minutes and rest minutes", () => {
    const fourExercises = makeDraft({
      items: Array.from({ length: 4 }, (_, i) =>
        makeItem({ order_index: i, target_sets: 3, rest_seconds: 90 }),
      ),
    });
    // 4 × 3 = 12 work min + (4 × 90 / 60) = 6 rest min = 18
    expect(estimateRoutineDuration(fourExercises)).toBe(18);
  });
});
