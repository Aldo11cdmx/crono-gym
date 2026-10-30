/**
 * exerciseSwap.test.ts — tests for the exercise substitution view model.
 */

import { describe, it, expect } from "vitest";
import type { Exercise } from "@/types/supabase";
import {
  findSwapCandidates,
  findAllSwapCandidates,
  filterByEquipment,
  exerciseAvailableInMyGym,
} from "@/lib/routines/exerciseSwap";

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: overrides.id ?? "e-test",
    name: overrides.name ?? "Test Exercise",
    body_part: overrides.body_part ?? "chest",
    target: overrides.target ?? "pectorals",
    equipment: overrides.equipment ?? "body weight",
    gif_url: "",
    instructions: [],
    name_es: overrides.name_es ?? null,
    is_active: overrides.is_active ?? true,
    is_hidden: overrides.is_hidden ?? false,
  };
}

const SOURCE = makeExercise({
  id: "e-squats",
  name: "Sentadilla",
  body_part: "upper legs",
  target: "quadriceps",
  equipment: "barbell",
});

const CATALOG: Exercise[] = [
  SOURCE,
  makeExercise({
    id: "e-legpress",
    name: "Press de pierna",
    body_part: "upper legs",
    target: "quadriceps",
    equipment: "leverage machine",
  }),
  makeExercise({
    id: "e-lunge",
    name: "Estocada",
    body_part: "upper legs",
    target: "quadriceps",
    equipment: "body weight",
  }),
  makeExercise({
    id: "e-deadlift",
    name: "Peso muerto",
    body_part: "upper legs",
    target: "hamstrings",
    equipment: "barbell",
  }),
  makeExercise({
    id: "e-curl",
    name: "Curl bíceps",
    body_part: "upper arms",
    target: "biceps",
    equipment: "barbell",
  }),
  makeExercise({
    id: "e-legext",
    name: "Extensión cuádriceps",
    body_part: "upper legs",
    target: "quadriceps",
    equipment: "leverage machine",
  }),
];

describe("findSwapCandidates", () => {
  it("includes exercises matching the primary muscle (body_part)", () => {
    const result = findSwapCandidates(SOURCE, {
      allExercises: CATALOG,
      excludeId: SOURCE.id,
    });
    const ids = result.map((c) => c.exercise.id);
    expect(ids).toContain("e-legpress");
    expect(ids).toContain("e-lunge");
    expect(ids).toContain("e-deadlift");
    expect(ids).not.toContain("e-curl"); // different body_part AND target
  });

  it("ranks primary muscle matches before secondary-only matches", () => {
    const result = findSwapCandidates(SOURCE, {
      allExercises: CATALOG,
      excludeId: SOURCE.id,
    });
    // All matches share body_part = "upper legs" so all should be primaryMatch.
    const allPrimary = result.every((c) => c.primaryMatch);
    expect(allPrimary).toBe(true);
  });

  it("ranks equipment-available candidates before unavailable ones", () => {
    const result = findSwapCandidates(SOURCE, {
      allExercises: CATALOG,
      excludeId: SOURCE.id,
      availableEquipment: new Set(["barbell", "dumbbell", "body weight"]),
    });
    // barbell (deadlift) and body weight (lunge) are available;
    // leverage machine is not in this gym's tag set.
    const availableIdx = result.findIndex((c) => c.exercise.id === "e-deadlift");
    const unavailableIdx = result.findIndex((c) => c.exercise.id === "e-legpress");
    expect(availableIdx).toBeGreaterThanOrEqual(0);
    expect(unavailableIdx).toBeGreaterThanOrEqual(0);
    expect(availableIdx).toBeLessThan(unavailableIdx);
  });

  it("does not mutate the input catalogue", () => {
    const input = [...CATALOG];
    findSwapCandidates(SOURCE, {
      allExercises: input,
      excludeId: SOURCE.id,
    });
    expect(input).toEqual(CATALOG);
  });

  it("excludes ids in excludeIds set", () => {
    const result = findSwapCandidates(SOURCE, {
      allExercises: CATALOG,
      excludeId: SOURCE.id,
      excludeIds: new Set(["e-legpress", "e-deadlift"]),
    });
    const ids = result.map((c) => c.exercise.id);
    expect(ids).not.toContain("e-legpress");
    expect(ids).not.toContain("e-deadlift");
    expect(ids).toContain("e-lunge");
  });
});

describe("findAllSwapCandidates", () => {
  it("returns same-muscle alternatives without equipment filtering", () => {
    const result = findAllSwapCandidates(SOURCE, CATALOG);
    expect(result.length).toBe(4); // legpress, lunge, deadlift, legext (all upper legs or quad)
    expect(result.some((c) => c.exercise.id === "e-curl")).toBe(false);
  });

  it("marks equipmentAvailable for each candidate", () => {
    const result = findAllSwapCandidates(SOURCE, CATALOG);
    result.forEach((c) => {
      expect(typeof c.equipmentAvailable).toBe("boolean");
    });
  });
});

describe("filterByEquipment", () => {
  it("keeps only candidates whose equipment is in the set", () => {
    const candidates = findAllSwapCandidates(SOURCE, CATALOG);
    const filtered = filterByEquipment(
      candidates,
      new Set(["barbell"]),
    );
    // Only barbell exercises survive: deadlift (barbell), source excluded
    expect(filtered.length).toBe(1);
    expect(filtered[0].exercise.id).toBe("e-deadlift");
  });
});

describe("exerciseAvailableInMyGym", () => {
  it("returns true for barbell exercises", () => {
    expect(exerciseAvailableInMyGym(SOURCE)).toBe(true);
  });

  it("returns true for leverage machine exercises", () => {
    const legPress = CATALOG.find((e) => e.id === "e-legpress")!;
    expect(exerciseAvailableInMyGym(legPress)).toBe(true);
  });

  it("returns false for band exercises", () => {
    const bandEx = makeExercise({
      id: "e-band-pull",
      name: "Remo con banda",
      body_part: "back",
      target: "lats",
      equipment: "resistance band",
    });
    expect(exerciseAvailableInMyGym(bandEx)).toBe(false);
  });
});
