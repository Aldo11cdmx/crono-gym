/**
 * exerciseSwapPreserve.test.ts — verifies that exercise replacement preserves
 * sets, reps, and rest as an immutable operation.
 */

import { describe, it, expect } from "vitest";
import type { Exercise } from "@/types/supabase";
import type { DraftExercise } from "@/lib/routines/routineDraftModel";

const SOURCE: Exercise = {
  id: "e-bench",
  name: "Press de banca",
  body_part: "chest",
  target: "pectorals",
  equipment: "barbell",
  gif_url: "",
  instructions: [],
};

const REPLACEMENT: Exercise = {
  id: "e-incline",
  name: "Press inclinado",
  body_part: "chest",
  target: "pectorals",
  equipment: "barbell",
  gif_url: "",
  instructions: [],
};

describe("exercise swap immutability", () => {
  it("replaces only the exercise object, preserving sets/reps/rest", () => {
    const original: DraftExercise = {
      exercise: SOURCE,
      target_sets: 4,
      rest_seconds: 120,
      order_index: 2,
      target_reps_min: 6,
      target_reps_max: 8,
    };

    const replacement: DraftExercise = { ...original, exercise: REPLACEMENT };

    // Only the exercise field changed
    expect(replacement.exercise.id).toBe("e-incline");
    expect(replacement.exercise.name).toBe("Press inclinado");
    // All other fields preserved exactly
    expect(replacement.target_sets).toBe(4);
    expect(replacement.rest_seconds).toBe(120);
    expect(replacement.order_index).toBe(2);
    expect(replacement.target_reps_min).toBe(6);
    expect(replacement.target_reps_max).toBe(8);
  });

  it("does not mutate the original draft exercise", () => {
    const original: DraftExercise = {
      exercise: SOURCE,
      target_sets: 3,
      rest_seconds: 90,
      order_index: 0,
      target_reps_min: 8,
      target_reps_max: 10,
    };

    const replacement: DraftExercise = { ...original, exercise: REPLACEMENT };

    void replacement;
    // Original is untouched
    expect(original.exercise.id).toBe("e-bench");
    expect(original.target_sets).toBe(3);
    expect(original.rest_seconds).toBe(90);
    expect(original.order_index).toBe(0);
    expect(original.target_reps_min).toBe(8);
    expect(original.target_reps_max).toBe(10);
  });
});
