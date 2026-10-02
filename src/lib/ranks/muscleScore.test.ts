import { describe, expect, it } from "vitest";
import {
  calculateMuscleScore,
  confidenceFor,
  countSessions,
  decayFactorFor,
  sessionsNeededMessage,
  type ExerciseRow,
  type SetRow,
} from "./muscleScore";
import { ELIGIBILITY, VOLUME_RULES, standardRatioFor, hasCalibratedStandard } from "./rankConfig";

const NOW = new Date("2026-06-01T12:00:00.000Z");

/** ISO date N days before NOW, so tests never depend on the wall clock. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

/**
 * A press and a row are the only two movements needed to exercise both the
 * strength and volume paths, and both have a standard ratio to compare against.
 */
const EXERCISES: ExerciseRow[] = [
  { id: "press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
  { id: "row", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
  { id: "curl", name: "Curl con barra", target: "biceps", body_part: "upper arms", equipment: "barbell" },
  { id: "squat", name: "Sentadilla", target: "glutes", body_part: "upper legs", equipment: "barbell" },
  { id: "custom", name: "Ejercicio personalizado", target: "", body_part: "", equipment: "barbell" },
];

/** The chest muscles only: a match on `target: pectorals` counts as primary. */
const chestWeights = (exercise: ExerciseRow): number | null =>
  exercise.target === "pectorals" ? 1.0 : exercise.body_part === "chest" ? 0.4 : null;

const context = { bodyweightKg: 80, sex: "male" as const, now: NOW };

/** Three sessions of a solid press: enough data to be classified. */
function pressHistory(weight: number, reps = 5, sessions = 3): SetRow[] {
  return Array.from({ length: sessions }, (_, i) => ({
    exerciseId: "press",
    weight,
    reps,
    isWarmup: false,
    performedAt: daysAgo(i * 7),
  }));
}

describe("calculateMuscleScore — eligibility", () => {
  it("returns unranked with no sets at all", () => {
    const result = calculateMuscleScore({ sets: [], exercises: EXERCISES, context, weightFor: chestWeights });
    expect(result.classified).toBe(false);
    expect(result.unrankedReason).toBe("no_data");
    expect(result.score).toBe(0);
  });

  it("returns unranked below the session minimum", () => {
    const result = calculateMuscleScore({
      sets: pressHistory(80, 5, 2),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    expect(result.classified).toBe(false);
    expect(result.unrankedReason).toBe("insufficient_sessions");
    expect(result.sessions).toBe(2);
  });

  it("classifies at exactly the session minimum", () => {
    const result = calculateMuscleScore({
      sets: pressHistory(80, 5, ELIGIBILITY.minSessions),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    expect(result.classified).toBe(true);
    expect(result.sessions).toBe(ELIGIBILITY.minSessions);
  });

  it("returns unranked when bodyweight is unknown rather than dividing by zero", () => {
    const result = calculateMuscleScore({
      sets: pressHistory(100, 5, 4),
      exercises: EXERCISES,
      context: { ...context, bodyweightKg: null },
      weightFor: chestWeights,
    });
    expect(result.classified).toBe(false);
    expect(result.unrankedReason).toBe("unknown_bodyweight");
  });

  it("returns unranked when bodyweight is zero or negative", () => {
    for (const bodyweightKg of [0, -5]) {
      const result = calculateMuscleScore({
        sets: pressHistory(100, 5, 4),
        exercises: EXERCISES,
        context: { ...context, bodyweightKg },
        weightFor: chestWeights,
      });
      expect(result.unrankedReason).toBe("unknown_bodyweight");
    }
  });

  it("returns unranked when every set is a warm-up", () => {
    const sets: SetRow[] = Array.from({ length: 5 }, (_, i) => ({
      exerciseId: "press",
      weight: 100,
      reps: 5,
      isWarmup: true,
      performedAt: daysAgo(i),
    }));
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    expect(result.unrankedReason).toBe("no_data");
    expect(result.volume.effectiveSets).toBe(0);
  });

  it("counts warm-ups as neither volume nor sessions", () => {
    const sets = [
      ...pressHistory(80, 5, 3),
      { exerciseId: "press", weight: 40, reps: 10, isWarmup: true, performedAt: daysAgo(1) },
    ];
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    // Three sessions of working sets only; the warm-up adds neither.
    expect(result.sessions).toBe(3);
    expect(result.volume.effectiveSets).toBe(3);
  });

  it("ignores sets above the Epley rep window for strength", () => {
    const sets: SetRow[] = [
      ...pressHistory(80, 5, 3),
      // 30 reps is real volume but not a trustworthy 1RM signal.
      { exerciseId: "press", weight: 40, reps: 30, isWarmup: false, performedAt: daysAgo(1) },
    ];
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    const press = result.contributions.find((c) => c.exerciseId === "press");
    // The 80 kg x 5 still wins; the 30-rep set must not replace it.
    expect(press?.estimatedOneRepMax).toBeCloseTo(80 * (1 + 5 / 30), 1);
  });

  it("still counts high-rep sets as volume", () => {
    const sets: SetRow[] = Array.from({ length: 6 }, (_, i) => ({
      exerciseId: "press",
      weight: 40,
      reps: 20,
      isWarmup: false,
      performedAt: daysAgo(i * 5),
    }));
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    expect(result.volume.effectiveSets).toBe(6);
    // Six sessions of honest volume, but every set is past the Epley window, so
    // there is no strength signal to rank on. Volume alone must not manufacture
    // a rank.
    expect(result.classified).toBe(false);
    expect(result.unrankedReason).toBe("no_strength_signal");
    expect(result.volume.volumePercent).toBeGreaterThan(0);
  });

  it("counts a set at the rep window boundary but not one past it", () => {
    const sets: SetRow[] = [
      ...pressHistory(80, 5, 2),
      // Exactly at the window: still a usable 1RM signal.
      { exerciseId: "press", weight: 60, reps: 10, isWarmup: false, performedAt: daysAgo(1) },
    ];
    const withBoundary = calculateMuscleScore({
      sets,
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    expect(withBoundary.contributions.length).toBeGreaterThan(0);

    const setsPastWindow: SetRow[] = [
      ...pressHistory(80, 5, 2),
      { exerciseId: "press", weight: 60, reps: 11, isWarmup: false, performedAt: daysAgo(1) },
    ];
    const pastWindow = calculateMuscleScore({
      sets: setsPastWindow,
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    const contribution = pastWindow.contributions.find((c) => c.exerciseId === "press");
    // The 80 kg x 5 sets still stand on their own.
    expect(contribution?.estimatedOneRepMax).toBeCloseTo(80 * (1 + 5 / 30), 1);
  });
});

describe("calculateMuscleScore — unit handling", () => {
  it("scores the same for identical loads regardless of the input unit", () => {
    // 100 kg and 220 lb are the same physical load. The scorer reads the
    // canonical metric column, so this asserts the value it receives is treated
    // as kg and nothing silently converts it a second time.
    const kg = calculateMuscleScore({
      sets: pressHistory(100, 5, 3),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    const sameLoad = calculateMuscleScore({
      sets: pressHistory(100, 5, 3),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    expect(sameLoad.score).toBe(kg.score);
  });

  it("reacts to bodyweight as a ratio, not to absolute kilos", () => {
    // Twice the bodyweight at the same lift ratio must score identically.
    const light = calculateMuscleScore({
      sets: pressHistory(50, 5, 3),
      exercises: EXERCISES,
      context: { ...context, bodyweightKg: 40 },
      weightFor: chestWeights,
    });
    const heavy = calculateMuscleScore({
      sets: pressHistory(100, 5, 3),
      exercises: EXERCISES,
      context: { ...context, bodyweightKg: 80 },
      weightFor: chestWeights,
    });
    expect(heavy.score).toBeCloseTo(light.score, 1);
  });

  it("scores a heavier lift above the same lifter's bodyweight", () => {
    const lighter = calculateMuscleScore({
      sets: pressHistory(60, 5, 3),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    const heavier = calculateMuscleScore({
      sets: pressHistory(100, 5, 3),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    expect(heavier.score).toBeGreaterThan(lighter.score);
  });

  it("rates the female standard table below the male one for the same lift", () => {
    const male = calculateMuscleScore({
      sets: pressHistory(100, 5, 3),
      exercises: EXERCISES,
      context: { ...context, sex: "male" },
      weightFor: chestWeights,
    });
    const female = calculateMuscleScore({
      sets: pressHistory(100, 5, 3),
      exercises: EXERCISES,
      context: { ...context, sex: "female" },
      weightFor: chestWeights,
    });
    // A higher bench standard means the same lift is a smaller fraction of it.
    expect(female.score).toBeGreaterThan(male.score);
  });

  it("never lets an undisclosed sex reach high confidence", () => {
    const result = calculateMuscleScore({
      sets: pressHistory(100, 5, 12),
      exercises: EXERCISES,
      context: { ...context, sex: "other" },
      weightFor: chestWeights,
    });
    expect(result.confidence).not.toBe("high");
  });
});

describe("calculateMuscleScore — contributions", () => {
  const squatWeights = (exercise: ExerciseRow): number | null =>
    exercise.target === "glutes" ? 1.0 : exercise.body_part === "upper legs" ? 0.4 : null;

  it("keeps at most the configured number of exercises", () => {
    const many: ExerciseRow[] = Array.from({ length: 6 }, (_, i) => ({
      id: `leg${i}`,
      name: `Variación ${i}`,
      target: "glutes",
      body_part: "upper legs",
      equipment: "barbell",
    }));
    const sets: SetRow[] = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 3 }, (_, j) => ({
        exerciseId: `leg${i}`,
        weight: 100 + i * 5,
        reps: 5,
        isWarmup: false,
        performedAt: daysAgo(j * 7),
      })),
    ).flat();

    const result = calculateMuscleScore({
      sets,
      exercises: many,
      context,
      weightFor: squatWeights,
    });
    expect(result.contributions).toHaveLength(6);
    expect(result.contributions.filter((c) => c.counted)).toHaveLength(3);
  });

  it("counts the strongest exercises, not the most recent", () => {
    const exercises: ExerciseRow[] = [
      { id: "strong", name: "Sentadilla pesada", target: "glutes", body_part: "upper legs", equipment: "barbell" },
      { id: "light", name: "Sentadilla ligera", target: "glutes", body_part: "upper legs", equipment: "barbell" },
    ];
    const sets: SetRow[] = [
      // The light one is trained more recently; the heavy one is stronger.
      { exerciseId: "light", weight: 60, reps: 5, isWarmup: false, performedAt: daysAgo(1) },
      { exerciseId: "strong", weight: 160, reps: 5, isWarmup: false, performedAt: daysAgo(30) },
      { exerciseId: "light", weight: 60, reps: 5, isWarmup: false, performedAt: daysAgo(14) },
      { exerciseId: "strong", weight: 160, reps: 5, isWarmup: false, performedAt: daysAgo(42) },
      { exerciseId: "light", weight: 60, reps: 5, isWarmup: false, performedAt: daysAgo(28) },
    ];
    const result = calculateMuscleScore({ sets, exercises, context, weightFor: squatWeights });
    const counted = result.contributions.filter((c) => c.counted).map((c) => c.exerciseId);
    expect(counted).toContain("strong");
  });

  it("weights primary work above secondary work", () => {
    // Both are chest-region moves, so both match the chest muscle; only one is
    // filed under `pectorals`. Triceps is used as the secondary target because
    // it has a standard ratio to be measured against.
    const exercises: ExerciseRow[] = [
      { id: "primary", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
      { id: "secondary", name: "Fondos", target: "triceps", body_part: "chest", equipment: "body weight" },
    ];
    const sets: SetRow[] = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 3 }, (_, j) => ({
        exerciseId: i % 2 === 0 ? "primary" : "secondary",
        weight: 80,
        reps: 5,
        isWarmup: false,
        performedAt: daysAgo(j * 7),
      })),
    ).flat();
    const result = calculateMuscleScore({ sets, exercises, context, weightFor: chestWeights });
    const primary = result.contributions.find((c) => c.exerciseId === "primary");
    const secondary = result.contributions.find((c) => c.exerciseId === "secondary");
    expect(primary?.contributionWeight).toBe(1.0);
    expect(secondary?.contributionWeight).toBe(0.4);
  });

it("pulls the average toward the stronger contributor", () => {
    // Both moves must map to the *same* standard ratio, otherwise the
    // comparison also changes what they are measured against. `lats` and `traps`
    // both resolve to the `row` standard.
    const exercises: ExerciseRow[] = [
      { id: "strong", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
      { id: "weak", name: "Encogimiento", target: "traps", body_part: "back", equipment: "dumbbell" },
    ];
  const sets: SetRow[] = [
    ...["strong", "weak"].flatMap((id) =>
      Array.from({ length: 3 }, (_, j) => ({
        exerciseId: id,
        // The strong move is nearly double the weak one.
        weight: id === "strong" ? 140 : 70,
        reps: 5,
        isWarmup: false,
        performedAt: daysAgo(j * 7),
      })),
    ),
  ];

  const bothPrimary = calculateMuscleScore({
    sets,
    exercises,
    context,
    weightFor: () => 1.0,
  });
  const strongIsPrimary = calculateMuscleScore({
    sets,
    exercises,
    context,
    weightFor: (e) => (e.id === "strong" ? 1.0 : 0.4),
  });

  // Weighting the stronger move more must raise the muscle score.
  expect(strongIsPrimary.score).toBeGreaterThan(bothPrimary.score);
});

it("leaves the score unchanged when equal-strength moves swap weights", () => {
  // A weighted mean of identical values is that value, whatever the weights.
  // Asserting this pins down that the weighting redistributes influence rather
  // than inflating the score on its own.
  const exercises: ExerciseRow[] = [
    { id: "a", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
    { id: "b", name: "Press alternativo", target: "pectorals", body_part: "chest", equipment: "cable" },
  ];
  const sets: SetRow[] = ["a", "b"].flatMap((id) =>
    Array.from({ length: 3 }, (_, j) => ({
      exerciseId: id,
      weight: 80,
      reps: 5,
      isWarmup: false,
      performedAt: daysAgo(j * 7),
    })),
  );
  const even = calculateMuscleScore({ sets, exercises, context, weightFor: () => 1.0 });
  const skewed = calculateMuscleScore({
    sets,
    exercises,
    context,
    weightFor: (e) => (e.id === "a" ? 1.0 : 0.4),
  });
  expect(skewed.score).toBe(even.score);
});

  it("lets a standard-ratio difference outweigh the contribution weight", () => {
    // Documents an intentional consequence of the design: contribution weight is
    // not the only thing that matters. A secondary move measured against a much
    // lower standard (overhead press) can out-score a primary move measured
    // against a high one (bench), which is arguably right -- the ratio is the
    // capability signal and the weight is only a tie-breaker.
    const exercises: ExerciseRow[] = [
      { id: "primary", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
      { id: "secondary", name: "Press militar", target: "delts", body_part: "chest", equipment: "barbell" },
    ];
    const sets: SetRow[] = ["primary", "secondary"].flatMap((id) =>
      Array.from({ length: 3 }, (_, j) => ({
        exerciseId: id,
        weight: 80,
        reps: 5,
        isWarmup: false,
        performedAt: daysAgo(j * 7),
      })),
    );
    const result = calculateMuscleScore({ sets, exercises, context, weightFor: chestWeights });
    const secondary = result.contributions.find((c) => c.exerciseId === "secondary");
    const primary = result.contributions.find((c) => c.exerciseId === "primary");
    expect(secondary?.strengthPercent).toBeGreaterThan(primary?.strengthPercent ?? 0);
    expect(secondary?.contributionWeight).toBe(0.4);
  });

  it("skips exercises with no muscles assigned", () => {
    const sets: SetRow[] = Array.from({ length: 4 }, (_, i) => ({
      exerciseId: "custom",
      weight: 100,
      reps: 5,
      isWarmup: false,
      performedAt: daysAgo(i * 7),
    }));
    const result = calculateMuscleScore({
      sets,
      exercises: EXERCISES,
      context,
      // Matches everything, to prove the skip comes from the exercise metadata.
      weightFor: () => 1.0,
    });
    expect(result.unrankedReason).toBe("no_strength_signal");
    expect(result.contributions).toHaveLength(0);
  });

  it("skips sets whose exercise is missing from the catalog", () => {
    const sets: SetRow[] = [
      { exerciseId: "ghost", weight: 100, reps: 5, isWarmup: false, performedAt: daysAgo(1) },
      { exerciseId: "ghost", weight: 100, reps: 5, isWarmup: false, performedAt: daysAgo(8) },
      { exerciseId: "ghost", weight: 100, reps: 5, isWarmup: false, performedAt: daysAgo(15) },
    ];
    const result = calculateMuscleScore({
      sets,
      exercises: EXERCISES,
      context,
      weightFor: () => 1.0,
    });
    // A deleted exercise is dropped before counting, so this reads as no data
    // rather than as three sessions that happened to be unusable.
    expect(result.classified).toBe(false);
    expect(result.unrankedReason).toBe("no_data");
  });

  it("does not count another muscle's sessions as this muscle's volume", () => {
    // The bug this guards: counting first and filtering later made a chest-only
    // lifter look like they had trained legs three times a week.
    const chestOnly = pressHistory(80, 5, 12);
    const result = calculateMuscleScore({
      sets: chestOnly,
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    expect(result.sessions).toBe(12);
    expect(result.volume.effectiveSets).toBe(12);

    const forLegs = calculateMuscleScore({
      sets: chestOnly,
      exercises: EXERCISES,
      context,
      // Nothing the chest lifter logged works the legs.
      weightFor: (e) => (e.target === "glutes" ? 1.0 : null),
    });
    expect(forLegs.sessions).toBe(0);
    expect(forLegs.unrankedReason).toBe("no_data");
  });

  it("reports no strength signal when the target has no standard ratio", () => {
    const odd: ExerciseRow[] = [
      { id: "odd", name: "Ejercicio raro", target: "levator scapulae", body_part: "neck", equipment: "band" },
    ];
    const sets: SetRow[] = Array.from({ length: 4 }, (_, i) => ({
      exerciseId: "odd",
      weight: 30,
      reps: 8,
      isWarmup: false,
      performedAt: daysAgo(i * 5),
    }));
    const result = calculateMuscleScore({ sets, exercises: odd, context, weightFor: () => 1.0 });
    expect(result.unrankedReason).toBe("no_strength_signal");
  });
});

describe("calculateMuscleScore — volume, decay and confidence", () => {
  it("gives full volume credit at the configured weekly set target", () => {
    // Dated exactly 7 days apart so each date lands in a distinct ISO week, and
    // sized to `targetSetsPerWeek` so both halves of the volume score saturate.
    // Offsets that are not multiples of 7 straddle week boundaries and inflate
    // the week count, which would make this assertion test the fixture rather
    // than the scorer.
    const sets: SetRow[] = Array.from({ length: 13 }, (_, w) =>
      Array.from({ length: VOLUME_RULES.targetSetsPerWeek }, () => ({
        exerciseId: "press",
        weight: 80,
        reps: 8,
        isWarmup: false,
        performedAt: daysAgo(w * 7),
      })),
    ).flat();
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    expect(result.volume.activeWeeks).toBe(VOLUME_RULES.targetWeeks);
    expect(result.volume.decayFactor).toBe(1);
    expect(result.volume.setsPerWeek).toBeCloseTo(VOLUME_RULES.targetSetsPerWeek, 0);
    expect(result.volume.volumePercent).toBe(100);
  });

  it("gives partial volume credit below the target", () => {
    // Half the target sets across the full window: the set half of the score
    // should land near halfway while the week half stays saturated.
    const sets: SetRow[] = Array.from({ length: 13 }, (_, w) =>
      Array.from({ length: Math.floor(VOLUME_RULES.targetSetsPerWeek / 2) }, () => ({
        exerciseId: "press",
        weight: 80,
        reps: 8,
        isWarmup: false,
        performedAt: daysAgo(w * 7),
      })),
    ).flat();
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    // setScore 0.5 * 0.4 + weekScore 1 * 0.6 = 80.
    expect(result.volume.volumePercent).toBeCloseTo(80, 0);
  });

  it("caps volume at 100 however much is logged", () => {
    const sets: SetRow[] = Array.from({ length: 52 }, (_, w) =>
      Array.from({ length: 10 }, (_, s) => ({
        exerciseId: "press",
        weight: 80,
        reps: 8,
        isWarmup: false,
        performedAt: daysAgo(w * 7 + s),
      })),
    ).flat();
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    expect(result.volume.volumePercent).toBeLessThanOrEqual(100);
  });

  it("excludes sets older than the lookback window from volume", () => {
    const recent = Array.from({ length: 3 }, (_, i) => ({
      exerciseId: "press",
      weight: 80,
      reps: 5,
      isWarmup: false,
      performedAt: daysAgo(i * 5),
    }));
    // Two sessions well outside the 90-day window.
    const stale = [
      { exerciseId: "press", weight: 80, reps: 5, isWarmup: false, performedAt: daysAgo(200) },
      { exerciseId: "press", weight: 80, reps: 5, isWarmup: false, performedAt: daysAgo(210) },
    ];
    const result = calculateMuscleScore({
      sets: [...recent, ...stale],
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    expect(result.volume.effectiveSets).toBe(3);
    // Session eligibility counts every session, not only recent ones.
    expect(result.sessions).toBe(5);
    expect(result.classified).toBe(true);
  });

  it("decays volume but not strength after a long layoff", () => {
    const active = Array.from({ length: 12 }, (_, i) => ({
      exerciseId: "press",
      weight: 100,
      reps: 5,
      isWarmup: false,
      performedAt: daysAgo(i * 7),
    }));
    const freshResult = calculateMuscleScore({
      sets: active,
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    // Same history, but evaluated 100 days after the last set.
    const later = new Date(NOW.getTime() + 100 * 86_400_000);
    const staleResult = calculateMuscleScore({
      sets: active,
      exercises: EXERCISES,
      context: { ...context, now: later },
      weightFor: chestWeights,
    });

    expect(staleResult.volume.decayFactor).toBeLessThan(1);
    expect(staleResult.volume.volumePercent).toBeLessThan(freshResult.volume.volumePercent);
    // Strength is history, and history does not evaporate.
    const freshStrength = freshResult.strength?.volumePercent ?? 0;
    const staleStrength = staleResult.strength?.volumePercent ?? 0;
    expect(staleStrength).toBeCloseTo(freshStrength, 1);
  });

  it("reports low confidence with few sessions", () => {
    const result = calculateMuscleScore({
      sets: pressHistory(80, 5, 3),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });
    expect(result.confidence).toBe("low");
  });

  it("reports high confidence with many recent sessions", () => {
    const sets = Array.from({ length: 12 }, (_, i) => ({
      exerciseId: "press",
      weight: 80,
      reps: 5,
      isWarmup: false,
      performedAt: daysAgo(i * 3),
    }));
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    expect(result.confidence).toBe("high");
  });

  it("drops out of high confidence when the data is stale", () => {
    const sets = Array.from({ length: 12 }, (_, i) => ({
      exerciseId: "press",
      weight: 80,
      reps: 5,
      isWarmup: false,
      performedAt: daysAgo(60 + i * 3),
    }));
    const result = calculateMuscleScore({ sets, exercises: EXERCISES, context, weightFor: chestWeights });
    expect(result.confidence).not.toBe("high");
  });
});

describe("decayFactorFor", () => {
  it("is 1 while the muscle is fresh", () => {
    expect(decayFactorFor(0)).toBe(1);
    expect(decayFactorFor(VOLUME_RULES.decayAfterDays)).toBe(1);
  });

  it("decays once past the inactivity threshold", () => {
    expect(decayFactorFor(VOLUME_RULES.decayAfterDays + 1)).toBeLessThan(1);
  });

  it("never falls below the configured floor", () => {
    expect(decayFactorFor(10_000)).toBe(VOLUME_RULES.decayFloor);
  });

  it("is 0 with no sets at all", () => {
    expect(decayFactorFor(null)).toBe(0);
  });
});

describe("confidenceFor", () => {
  it("escalates with session count", () => {
    expect(confidenceFor(2, 0, "male")).toBe("low");
    expect(confidenceFor(5, 0, "male")).toBe("medium");
    expect(confidenceFor(12, 0, "male")).toBe("high");
  });

  it("caps high confidence for stale data", () => {
    expect(confidenceFor(20, ELIGIBILITY.stalenessDays + 5, "male")).toBe("medium");
  });

  it("keeps the midpoint standard table out of high confidence", () => {
    expect(confidenceFor(20, 0, "other")).toBe("medium");
  });
});

describe("standards tables", () => {
  it("uses the midpoint for an undisclosed sex", () => {
    const key = "bench";
    expect(standardRatioFor(key, "other")).toBeCloseTo(
      (standardRatioFor(key, "male") + standardRatioFor(key, "female")) / 2,
      5,
    );
  });

  it("rates male and female standards as calibrated, other as not", () => {
    expect(hasCalibratedStandard("male")).toBe(true);
    expect(hasCalibratedStandard("female")).toBe(true);
    expect(hasCalibratedStandard("other")).toBe(false);
  });
});

describe("countSessions and sessionsNeededMessage", () => {
  it("counts distinct sessions, not sets", () => {
    const sets: SetRow[] = [
      { exerciseId: "press", weight: 80, reps: 5, isWarmup: false, performedAt: daysAgo(1) },
      { exerciseId: "press", weight: 80, reps: 5, isWarmup: false, performedAt: daysAgo(1) },
      { exerciseId: "press", weight: 80, reps: 5, isWarmup: false, performedAt: daysAgo(8) },
    ];
    expect(countSessions(sets)).toBe(2);
  });

  it("reports how many sessions are still missing", () => {
    expect(sessionsNeededMessage(0)).toEqual({ needed: 3, missing: 3 });
    expect(sessionsNeededMessage(2)).toEqual({ needed: 3, missing: 1 });
    expect(sessionsNeededMessage(9)).toEqual({ needed: 3, missing: 0 });
  });
});