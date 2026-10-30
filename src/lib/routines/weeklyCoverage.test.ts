/**
 * weeklyCoverage.test.ts — tests for the weekly muscle coverage / deload VM.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import type { Exercise } from "@/types/supabase";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { WeeklyAssignment } from "@/lib/routines/routinesViewModel";
import {
  DELOAD_MULTIPLIER,
  LOW_VOLUME_THRESHOLD,
  computeWeeklyCoverage,
} from "./weeklyCoverage";

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: overrides.id ?? "e-test",
  name: overrides.name ?? "Test Exercise",
  name_es: overrides.name_es ?? null,
  body_part: overrides.body_part ?? "chest",
  target: overrides.target ?? "pectorals",
  equipment: overrides.equipment ?? "barbell",
  gif_url: "",
  instructions: [],
  is_active: overrides.is_active ?? true,
  is_hidden: overrides.is_hidden ?? false,
});

const makeRoutine = (
  id: string,
  title: string,
  exercises: { exercise: Exercise; target_sets: number; rest_seconds: number; dayIndex: number | null; dayLabel: string }[],
): RoutineWithExercises => ({
  id,
  user_id: "user-1",
  title,
  description: null,
  created_at: "2026-01-01T00:00:00Z",
  is_favorite: false,
  source: "user",
  authored_by_coach: null,
  is_template: false,
  exercises: exercises.map((e) => ({
    exercise: e.exercise,
    target_sets: e.target_sets,
    rest_seconds: e.rest_seconds,
    dayIndex: e.dayIndex ?? 0,
    dayLabel: e.dayLabel ?? "",
  })),
});

const benchPress = makeExercise({ id: "e1", name: "Press banca", body_part: "chest", target: "pectorals" });
const wristCurl = makeExercise({ id: "e2", name: "Curl de muñeca", body_part: "lower arms", target: "forearms" });

const assignments: WeeklyAssignment[] = [
  { id: "a1", routineId: "r1", dayIndex: 1, order: 0 },
  { id: "a2", routineId: "r2", dayIndex: 3, order: 0 },
];

const routines: RoutineWithExercises[] = [
  makeRoutine("r1", "Push Day", [
    { exercise: benchPress, target_sets: 4, rest_seconds: 90, dayIndex: 1, dayLabel: "Push" },
  ]),
  makeRoutine("r2", "Arm Day", [
    { exercise: wristCurl, target_sets: 6, rest_seconds: 60, dayIndex: 3, dayLabel: "Arms" },
  ]),
];

describe("DELOAD_MULTIPLIER", () => {
  it("is 0.5", () => {
    expect(DELOAD_MULTIPLIER).toBe(0.5);
  });
});

describe("LOW_VOLUME_THRESHOLD", () => {
  it("is 6 sets", () => {
    expect(LOW_VOLUME_THRESHOLD).toBe(6);
  });
});

describe("computeWeeklyCoverage", () => {
  it("counts sets per muscle from assigned routines", () => {
    const summary = computeWeeklyCoverage(routines, assignments, false);
    expect(summary.totalExercises).toBe(2);
    expect(summary.totalSets).toBe(10);
    const chest = summary.muscles.find((m) => m.slug === "chest");
    expect(chest).toBeDefined();
    expect(chest!.rawSets).toBe(4);
    const forearm = summary.muscles.find((m) => m.slug === "forearm");
    expect(forearm).toBeDefined();
    expect(forearm!.rawSets).toBe(6);
  });

  it("halves displayed sets when deload is active", () => {
    const summary = computeWeeklyCoverage(routines, assignments, true);
    expect(summary.totalSetsDisplayed).toBe(Math.round(10 * 0.5));
    const chest = summary.muscles.find((m) => m.slug === "chest");
    expect(chest).toBeDefined();
    expect(chest!.displayedSets).toBe(2);
    expect(chest!.rawSets).toBe(4);
  });

  it("preserves rawSets unchanged when deload is active", () => {
    const withoutDeload = computeWeeklyCoverage(routines, assignments, false);
    const withDeload = computeWeeklyCoverage(routines, assignments, true);
    expect(withDeload.muscles[0].rawSets).toBe(withoutDeload.muscles[0].rawSets);
    expect(withDeload.muscles[1].rawSets).toBe(withoutDeload.muscles[1].rawSets);
  });

  it("flags muscles below the low-volume threshold", () => {
    const summary = computeWeeklyCoverage(routines, assignments, false);
    const chest = summary.muscles.find((m) => m.slug === "chest");
    expect(chest).toBeDefined();
    expect(chest!.lowVolume).toBe(true);
  });

  it("does not flag muscles at or above the threshold", () => {
    const summary = computeWeeklyCoverage(routines, assignments, false);
    const forearm = summary.muscles.find((m) => m.slug === "forearm");
    expect(forearm).toBeDefined();
    expect(forearm!.rawSets).toBe(6);
    expect(forearm!.lowVolume).toBe(false);
  });

  it("returns zero totals when no routines are assigned", () => {
    const summary = computeWeeklyCoverage(routines, [], false);
    expect(summary.totalSets).toBe(0);
    expect(summary.totalSetsDisplayed).toBe(0);
    expect(summary.muscles).toHaveLength(0);
    expect(summary.activeRoutineIds.size).toBe(0);
  });

  it("ignores assignments whose routine is not in the catalogue", () => {
    const orphanAssignments: WeeklyAssignment[] = [
      { id: "a1", routineId: "unknown-routine", dayIndex: 0, order: 0 },
    ];
    const summary = computeWeeklyCoverage(routines, orphanAssignments, false);
    expect(summary.totalSets).toBe(0);
    expect(summary.activeRoutineIds.size).toBe(0);
  });

  it("aggregates sets across multiple routines for the same muscle", () => {
    const pushAM = makeRoutine("r1", "Push A", [
      { exercise: benchPress, target_sets: 4, rest_seconds: 90, dayIndex: 1, dayLabel: "Push" },
    ]);
    const pushPM = makeRoutine("r2", "Push B", [
      { exercise: benchPress, target_sets: 3, rest_seconds: 90, dayIndex: 2, dayLabel: "Push" },
    ]);
    const allAssignments: WeeklyAssignment[] = [
      { id: "a1", routineId: "r1", dayIndex: 1, order: 0 },
      { id: "a2", routineId: "r2", dayIndex: 2, order: 0 },
    ];
    const summary = computeWeeklyCoverage([pushAM, pushPM], allAssignments, false);
    const chest = summary.muscles.find((m) => m.slug === "chest");
    expect(chest).toBeDefined();
    expect(chest!.rawSets).toBe(7);
  });

  it("tracks active routine ids", () => {
    const summary = computeWeeklyCoverage(routines, assignments, false);
    expect(summary.activeRoutineIds.has("r1")).toBe(true);
    expect(summary.activeRoutineIds.has("r2")).toBe(true);
    expect(summary.activeRoutineIds.size).toBe(2);
  });

  it("does not mutate the input assignments array", () => {
    const original = [...assignments];
    computeWeeklyCoverage(routines, assignments, true);
    expect(assignments).toEqual(original);
  });

  it("lowVolumeCount equals the number of under-trained muscles", () => {
    const summary = computeWeeklyCoverage(routines, assignments, false);
    const expectedCount = summary.muscles.filter((m) => m.lowVolume).length;
    expect(summary.lowVolumeCount).toBe(expectedCount);
  });
});
