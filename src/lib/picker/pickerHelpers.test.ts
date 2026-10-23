/**
 * pickerHelpers.test.ts — unit tests for the pure search/filter/sort helpers.
 */

import { describe, it, expect } from "vitest";
import type { Exercise } from "@/types/supabase";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import {
  normaliseQuery,
  expandQuery,
  matchesQuery,
  searchExercises,
  filterExercises,
  sortExercises,
  collectBodyParts,
  collectEquipment,
  collectTargets,
  EMPTY_FILTERS,
} from "./pickerHelpers";

function makeExercise(
  overrides: Partial<Exercise> & Pick<Exercise, "id" | "name" | "body_part" | "target" | "equipment">,
): Exercise {
  return {
    gif_url: "",
    instructions: [],
    ...overrides,
  } as Exercise;
}

const SAMPLE_EXERCISES: Exercise[] = [
  makeExercise({ id: "1", name: "Barbell Bench Press", body_part: "chest", target: "pectorals", equipment: "barbell" }),
  makeExercise({ id: "2", name: "Dumbbell Bench Press", body_part: "chest", target: "pectorals", equipment: "dumbbell" }),
  makeExercise({ id: "3", name: "Parallel Bar Dips", body_part: "upper arms", target: "triceps", equipment: "body weight" }),
  makeExercise({ id: "4", name: "Barbell Back Squat", body_part: "upper legs", target: "quads", equipment: "barbell" }),
  makeExercise({ id: "5", name: "Barbell Deadlift", body_part: "upper legs", target: "hamstrings", equipment: "barbell" }),
  makeExercise({ id: "6", name: "Dumbbell Shoulder Press", body_part: "shoulders", target: "delts", equipment: "dumbbell" }),
];

describe("normaliseQuery", () => {
  it("strips accents and lowercases", () => {
    expect(normaliseQuery("Press Dé Banca")).toBe("press de banca");
  });

  it("collapses whitespace", () =>
    expect(normaliseQuery("  press    de  ")).toBe("press de"));

  it("removes punctuation", () =>
    expect(normaliseQuery("curl-bíceps (peso)")).toBe("curl biceps peso"));

  it("returns empty string for blank input", () =>
    expect(normaliseQuery("   ")).toBe(""));
});

describe("expandQuery", () => {
  it("returns the normalized query for unknown terms", () => {
    expect(expandQuery("hello world")).toContain("hello world");
  });

  it("expands Spanish alias 'fondos' to 'dips'", () => {
    expect(expandQuery("fondos")).toContain("dips");
    expect(expandQuery("fondos")).toContain("parallel");
  });

  it("expands 'press de banca' tokens", () => {
    const terms = expandQuery("press de banca");
    expect(terms).toContain("press");
    expect(terms).toContain("bench press");
  });

  it("returns empty array for blank input", () =>
    expect(expandQuery("")).toEqual([]));

  it("handles accented input for alias matching", () => {
    const terms = expandQuery("fondós");
    expect(terms).toContain("dips");
  });
});

describe("matchesQuery", () => {
  it("matches when the text contains the term", () => {
    expect(matchesQuery("Barbell Bench Press", ["bench press"])).toBe(true);
  });

  it("does not match when text lacks the term", () => {
    expect(matchesQuery("Squat", ["bench"])).toBe(false);
  });

  it("returns true for empty terms (match everything)", () => {
    expect(matchesQuery("anything", [])).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesQuery("Barbell Bench Press", ["BENCH"])).toBe(true);
  });
});

describe("searchExercises", () => {
  it("finds exercises by English name", () => {
    const results = searchExercises(SAMPLE_EXERCISES, "squat");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Barbell Back Squat");
  });

  it("finds exercises by the Spanish name shown in the card", () => {
    // "Barbell Bench Press" is displayed as "Press de banca con barra".
    const results = searchExercises(SAMPLE_EXERCISES, "banca con barra");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Barbell Bench Press");
  });

  it("finds exercises by Spanish alias 'fondos'", () => {
    const results = searchExercises(SAMPLE_EXERCISES, "fondos");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Parallel Bar Dips");
  });

  it("finds exercises via body_part", () => {
    const results = searchExercises(SAMPLE_EXERCISES, "chest");
    expect(results).toHaveLength(2);
  });

  it("finds exercises via equipment", () => {
    const results = searchExercises(SAMPLE_EXERCISES, "barbell");
    expect(results).toHaveLength(3);
  });

  it("returns all exercises for empty query", () => {
    const results = searchExercises(SAMPLE_EXERCISES, "");
    expect(results).toHaveLength(SAMPLE_EXERCISES.length);
  });

  it("returns empty array for non-matching query", () => {
    const results = searchExercises(SAMPLE_EXERCISES, "nonexistent");
    expect(results).toHaveLength(0);
  });
});

describe("filterExercises", () => {
  it("returns all when filters are all 'all'", () => {
    const results = filterExercises(SAMPLE_EXERCISES, EMPTY_FILTERS);
    expect(results).toHaveLength(SAMPLE_EXERCISES.length);
  });

  it("filters by body_part", () => {
    const results = filterExercises(SAMPLE_EXERCISES, { ...EMPTY_FILTERS, bodyPart: "chest" });
    expect(results.every((e) => e.body_part === "chest")).toBe(true);
    expect(results).toHaveLength(2);
  });

  it("filters by equipment", () => {
    const results = filterExercises(SAMPLE_EXERCISES, { ...EMPTY_FILTERS, equipment: "barbell" });
    expect(results.every((e) => e.equipment === "barbell")).toBe(true);
    expect(results).toHaveLength(3);
  });

  it("filters by target", () => {
    const results = filterExercises(SAMPLE_EXERCISES, { ...EMPTY_FILTERS, target: "triceps" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Parallel Bar Dips");
  });

  it("combines multiple filters", () => {
    const results = filterExercises(SAMPLE_EXERCISES, {
      ...EMPTY_FILTERS,
      bodyPart: "chest",
      equipment: "barbell",
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Barbell Bench Press");
  });
});

describe("sortExercises", () => {
  it("sorts by the Spanish display name shown in the card", () => {
    const results = sortExercises(SAMPLE_EXERCISES, "name");
    expect(results.map((e) => getExerciseDisplayName(e))).toEqual([
      // The three names the catalog has no translation for keep their original
      // spelling; the rest sort by their Spanish label.
      "Barbell Back Squat",
      "Dumbbell Shoulder Press",
      "Parallel Bar Dips",
      "Peso muerto con barra",
      "Press de banca con barra",
      "Press de banca con mancuernas",
    ]);
  });

  it("sorts by popularity: primary matches first, then rest in original order", () => {
    const primaryIds = new Set<string>(["2", "6"]); // Dumbbell Bench Press, Dumbbell Shoulder Press
    const results = sortExercises(SAMPLE_EXERCISES, "popularity", primaryIds);
    const names = results.map((e) => e.name);
    expect(names).toEqual([
      "Dumbbell Bench Press",
      "Dumbbell Shoulder Press",
      "Barbell Bench Press",
      "Parallel Bar Dips",
      "Barbell Back Squat",
      "Barbell Deadlift",
    ]);
  });

  it("returns original order when no primary ids for popularity", () => {
    const results = sortExercises(SAMPLE_EXERCISES, "popularity", new Set());
    expect(results).toEqual(SAMPLE_EXERCISES);
  });

  it("does not mutate the input", () => {
    const copy = [...SAMPLE_EXERCISES];
    sortExercises(SAMPLE_EXERCISES, "name");
    expect(SAMPLE_EXERCISES).toEqual(copy);
  });
});

describe("collect* functions", () => {
  it("collectBodyParts returns unique values with 'all' first", () => {
    const parts = collectBodyParts(SAMPLE_EXERCISES);
    expect(parts[0]).toBe("all");
    expect(parts).toContain("chest");
    expect(parts).toContain("upper arms");
    expect(new Set(parts).size).toBe(parts.length);
  });

  it("collectEquipment returns unique values with 'all' first", () => {
    const eqs = collectEquipment(SAMPLE_EXERCISES);
    expect(eqs[0]).toBe("all");
    expect(eqs).toContain("barbell");
    expect(eqs).toContain("dumbbell");
    expect(new Set(eqs).size).toBe(eqs.length);
  });

  it("collectTargets returns unique values with 'all' first", () => {
    const targets = collectTargets(SAMPLE_EXERCISES);
    expect(targets[0]).toBe("all");
    expect(targets).toContain("pectorals");
    expect(targets).toContain("triceps");
    expect(new Set(targets).size).toBe(targets.length);
  });
});
