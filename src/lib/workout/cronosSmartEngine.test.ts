import { describe, expect, it } from "vitest";
import {
  calibratePendingSets,
  estimateSmartLoad,
  generateSmartWarmupSets,
  getAdaptiveRestSeconds,
} from "./cronosSmartEngine";

describe("cronosSmartEngine", () => {
  it("increments overload after completing target reps", () => {
    expect(estimateSmartLoad({
      mode: "overload",
      targetReps: 8,
      weightHistory: [{ weightKg: 50, reps: 8, completed: true }],
    }).weightKg).toBe(52.5);
  });

  it("uses station-aware biometric day zero loads", () => {
    const legPress = estimateSmartLoad({
      mode: "biometric_day_0",
      weightKg: 80,
      targetStation: "leg_press_45",
      experienceLevel: "beginner",
    });
    const curl = estimateSmartLoad({
      mode: "biometric_day_0",
      weightKg: 80,
      targetStation: "free_weight_area",
      movementPattern: "isolation",
      experienceLevel: "beginner",
    });
    expect(legPress.weightKg).toBeGreaterThan(curl.weightKg);
  });

  it("returns zero for invalid negative body weight", () => {
    expect(estimateSmartLoad({
      mode: "biometric_day_0",
      weightKg: -20,
      experienceLevel: "beginner",
    }).weightKg).toBe(0);
  });

  it("creates progressive warmup sets", () => {
    const sets = generateSmartWarmupSets(80, false);
    expect(sets).toHaveLength(3);
    expect(sets[0].weightKg).toBeLessThan(sets[2].weightKg);
  });

  it("calibrates only pending sets", () => {
    const sets = [{ weightKg: 50 }, { weightKg: 50 }, { weightKg: 50 }];
    const result = calibratePendingSets(sets, 0, "too_heavy");
    expect(result.map((set) => set.weightKg)).toEqual([50, 45, 45]);
  });

  it("returns adaptive rests", () => {
    expect(getAdaptiveRestSeconds("warmup", "squat")).toBe(45);
    expect(getAdaptiveRestSeconds("normal", "squat")).toBe(120);
    expect(getAdaptiveRestSeconds("normal", "isolation")).toBe(75);
  });
});
