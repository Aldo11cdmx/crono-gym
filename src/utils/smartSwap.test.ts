import { describe, it, expect } from "vitest";
import { smartSwap, type ExerciseLite } from "@/utils/smartSwap";

const base: ExerciseLite = {
  id: "orig",
  name: "Press banca",
  primaryMuscle: "chest",
  secondaryMuscles: ["triceps"],
  pattern: "push",
  equipment: "barbell",
};

const candidate = (overrides: Partial<ExerciseLite>): ExerciseLite => ({
  id: "cand",
  name: "Press inclinado",
  primaryMuscle: "chest",
  secondaryMuscles: ["triceps"],
  pattern: "push",
  equipment: "barbell",
  ...overrides,
});

describe("smartSwap availability scoring", () => {
  it("equipmentAvailability available → +10", () => {
    const res = smartSwap(base, [candidate({ equipmentAvailability: "available" })]);
    expect(res[0].score).toBe(40 + 25 + 5 + 10);
  });

  it("equipmentAvailability unavailable → 0", () => {
    const res = smartSwap(base, [candidate({ equipmentAvailability: "unavailable" })]);
    expect(res[0].score).toBe(40 + 25 + 5);
  });

  it("equipmentAvailability unknown → 0", () => {
    const res = smartSwap(base, [candidate({ equipmentAvailability: "unknown" })]);
    expect(res[0].score).toBe(40 + 25 + 5);
  });

  it("sin tri-state y available true → +10", () => {
    const res = smartSwap(base, [candidate({ available: true })]);
    expect(res[0].score).toBe(40 + 25 + 5 + 10);
  });

  it("sin tri-state y available false → 0", () => {
    const res = smartSwap(base, [candidate({ available: false })]);
    expect(res[0].score).toBe(40 + 25 + 5);
  });

  it("sin tri-state y available undefined → 0", () => {
    const res = smartSwap(base, [candidate({ available: undefined })]);
    expect(res[0].score).toBe(40 + 25 + 5);
  });

  it("tri-state unknown con booleano true → 0", () => {
    const res = smartSwap(base, [candidate({ equipmentAvailability: "unknown", available: true })]);
    expect(res[0].score).toBe(40 + 25 + 5);
  });

  it("tri-state available con booleano false → +10", () => {
    const res = smartSwap(base, [candidate({ equipmentAvailability: "available", available: false })]);
    expect(res[0].score).toBe(40 + 25 + 5 + 10);
  });

  it("exclusión conserva -100", () => {
    const res = smartSwap(base, [candidate({ equipmentAvailability: "available" })], { excludeEquipment: ["barbell"] });
    // excluded entirely (filter + score), so no result
    expect(res.length).toBe(0);
  });
});
