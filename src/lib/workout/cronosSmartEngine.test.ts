import { describe, expect, it } from "vitest";
import {
  BODYWEIGHT_LOAD_HINT,
  calibratePendingSets,
  estimateSmartLoad,
  generateSmartWarmupSets,
  getAdaptiveRestSeconds,
  getLoadBreakdownHint,
  isBodyweightExercise,
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

  it("keeps a bodyweight movement at zero load and bodyweight reps", () => {
    const pushUp = estimateSmartLoad({ mode: "bodyweight", targetReps: 8 });
    expect(pushUp.weightKg).toBe(0);
    expect(pushUp.suggestedReps).toBe(15);

    // A bodyweight exercise must never inherit the biometric multiplier: the
    // same 65 kg that load a bench would turn a push-up into a weighted one.
    const biometric = estimateSmartLoad({
      mode: "biometric_day_0",
      weightKg: 65,
      targetStation: "free_weight_area",
      movementPattern: "isolation",
      experienceLevel: "beginner",
    });
    expect(biometric.weightKg).toBeGreaterThan(0);
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

/**
 * The pull-up regression: the row is mapped to the pull-up bar, so it carries an
 * `CG-EQP-*` id, and a mapped id used to mean "loaded machine". The athlete was
 * told to load "Barra 7kg" for an exercise that only ever carries their body.
 */
describe("isBodyweightExercise", () => {
  it("recognises the pull-up bar, the decline ab bench and the hyperextension bench", () => {
    expect(isBodyweightExercise({ equipment_id: "CG-EQP-0051", name: "Dominadas" })).toBe(true);
    expect(isBodyweightExercise({ equipment_id: "CG-EQP-0028", name: "Abdominales" })).toBe(true);
    expect(isBodyweightExercise({ equipment_id: "CG-EQP-0015", name: "Hiperextensiones" })).toBe(true);
  });

  it("recognises a bodyweight row, whatever the catalog named the equipment", () => {
    expect(isBodyweightExercise({ equipment_id: "NONE" })).toBe(true);
    expect(isBodyweightExercise({ equipment: "body weight" })).toBe(true);
    expect(isBodyweightExercise({ equipment: "Assisted" })).toBe(true);
    expect(isBodyweightExercise({ name: "Push-up" })).toBe(true);
    expect(isBodyweightExercise({ name_es: "Elevación de piernas colgado" })).toBe(true);
    expect(isBodyweightExercise({ name: "Plancha abdominal" })).toBe(true);
  });

  it("leaves a loaded movement alone, even when it is named after a calisthenics one", () => {
    expect(isBodyweightExercise({ equipment_id: "CG-EQP-0012", name: "Press banca" })).toBe(false);
    expect(isBodyweightExercise({ name: "Crunch en polea" })).toBe(false);
    expect(isBodyweightExercise({ name: "Dominadas con lastre" })).toBe(false);
    expect(isBodyweightExercise({ name: "Fondos en máquina" })).toBe(false);
    expect(isBodyweightExercise({ equipment: "barbell" })).toBe(false);
    expect(isBodyweightExercise(null)).toBe(false);
  });
});

describe("prescripción sin carga externa", () => {
  it("never prescribes a bar breakdown for a pull-up", () => {
    expect(getLoadBreakdownHint(7, "pullup_dip_station", "body weight")).toBe(BODYWEIGHT_LOAD_HINT);
    expect(getLoadBreakdownHint(60, "flat_bench", "barbell")).toContain("Barra");
  });

  it("keeps a pull-up at zero load and bodyweight reps", () => {
    const pullUp = estimateSmartLoad({ mode: "bodyweight", targetReps: 15 });
    expect(pullUp.weightKg).toBe(0);
    expect(pullUp.suggestedReps).toBe(15);
    expect(pullUp.reason).toContain("Peso corporal");
  });
});
