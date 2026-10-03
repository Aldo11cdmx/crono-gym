/**
 * types.test.ts — the projection from the app's context onto the model's wire format.
 *
 * Two things are being protected here. The first is correctness of the derivations:
 * per-muscle weekly volume, and PRs that have a real set behind them. The second is
 * what the model is *not* told — an unclassified muscle reported as a rank would read
 * to the model as a tier the athlete had actually been placed in, and a PR derived
 * from a set that does not exist would be an unverifiable number in a conversation
 * about the athlete's own body.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_GYM_SETTINGS, type GymSettings } from "@/context/GymSettingsContext";
import type { CoachContext } from "@/lib/coach/types";
import { GOAL_TO_FOCUS, isCoachAction, toAssistantContext } from "./types";

const NOW = "2026-06-01T12:00:00.000Z";

/** The least context that can be produced: a brand-new athlete with nothing logged. */
const EMPTY: CoachContext = {
  generatedAt: NOW,
  profile: null,
  bodyweight: { latestKg: null, changeLast30Days: null, seriesCount: 0 },
  volume: { totalWorkouts: 0, workoutsThisMonth: 0, monthlyVolume: 0, weeklyPoints: [] },
  energy: null,
  muscles: [],
  dataGaps: ["no_readiness_checkins", "no_profile", "no_bodyweight"],
};

/** A trained athlete: two muscles, one classified, one not. */
const TRAINED: CoachContext = {
  ...EMPTY,
  profile: {
    sex: "female",
    weightKg: 61.4,
    heightCm: 168,
    experienceLevel: "intermediate",
    activityLevel: "moderate",
    goal: "gain_muscle",
    unitSystem: "metric",
  },
  bodyweight: { latestKg: 61.4, changeLast30Days: -1.2, seriesCount: 9 },
  volume: {
    totalWorkouts: 48,
    workoutsThisMonth: 9,
    monthlyVolume: 41_250,
    // Deliberately 3, not 4: if the fixture's session count happened to equal the
    // per-muscle weekly volume, the assertion below would pass without proving the
    // mapper reads the right field.
    weeklyPoints: [{ label: "s1", date: "2026-05-04", count: 3 }],
  },
  muscles: [
    {
      slug: "chest",
      label: "Pecho",
      classified: true,
      rankId: "silver",
      rankLabel: "Plata",
      score: 42,
      unrankedReason: null,
      confidence: "medium",
      effectiveSets: 24,
      activeWeeks: 6,
      topExercises: [
        {
          name: "Press de banca",
          estimatedOneRepMax: 92.7,
          bestSet: { weight: 75, reps: 5 },
        },
        {
          name: "Press inclinado con mancuernas",
          estimatedOneRepMax: 34,
          bestSet: { weight: 32, reps: 6 },
        },
      ],
    },
    {
      slug: "upper-back",
      label: "Espalda alta",
      classified: false,
      rankId: "unranked",
      rankLabel: "Sin rango",
      score: 0,
      unrankedReason: "no_data",
      confidence: "low",
      effectiveSets: 8,
      activeWeeks: 2,
      topExercises: [],
    },
  ],
};

const GYM: GymSettings = {
  ...DEFAULT_GYM_SETTINGS,
  inventory: { 2.5: 2, 5: 2, 10: 2, 20: 2 },
};

describe("toAssistantContext with minimal data", () => {
  const wire = toAssistantContext(EMPTY, GYM);

  it("produces a usable context from nothing", () => {
    expect(wire.recentPRs).toEqual([]);
    expect(wire.weeklyVolume).toEqual({});
    expect(wire.currentMuscleRanks).toEqual({});
    // No bodyweight, so the key is absent rather than null: a model reading
    // `"bodyWeightKg": null` may treat it as a fact about a body that weighs nothing.
    expect("bodyWeightKg" in wire).toBe(false);
  });

  it("defaults an absent profile to the most conservative focus", () => {
    expect(wire.currentGoal).toBe("maintenance");
    expect(wire.experienceLevel).toBe("beginner");
  });

  it("is serializable, because it crosses a network boundary", () => {
    expect(() => JSON.parse(JSON.stringify(wire))).not.toThrow();
  });
});

describe("toAssistantContext with full data", () => {
  const wire = toAssistantContext(TRAINED, GYM);

  it("maps the profile onto training focus and level", () => {
    expect(wire.currentGoal).toBe("volume");
    expect(wire.experienceLevel).toBe("intermediate");
    expect(wire.bodyWeightKg).toBe(61.4);
  });

  it("derives per-muscle weekly volume, not whole-body session counts", () => {
    // 24 sets over 6 active weeks. Reading `weeklyPoints` instead would have said
    // "4 sessions last week", which cannot distinguish legs twice a week from legs
    // untouched for a month -- the exact question a volume change turns on.
    expect(wire.weeklyVolume).toEqual({ chest: 4, "upper-back": 4 });
    expect(wire.weeklyVolume.chest).not.toBe(TRAINED.volume.weeklyPoints[0].count);
  });

  it("omits a muscle with no active weeks rather than dividing by zero", () => {
    const idle: CoachContext = {
      ...TRAINED,
      muscles: [{ ...TRAINED.muscles[0], effectiveSets: 4, activeWeeks: 0 }],
    };
    expect(toAssistantContext(idle, GYM).weeklyVolume).toEqual({});
  });

  it("lists PRs strongest first", () => {
    expect(wire.recentPRs).toEqual([
      { exercise: "Press de banca", weightKg: 75, reps: 5 },
      { exercise: "Press inclinado con mancuernas", weightKg: 32, reps: 6 },
    ]);
  });

  it("never reports a PR without a real set behind it", () => {
    const estimateOnly: CoachContext = {
      ...TRAINED,
      muscles: [
        {
          ...TRAINED.muscles[0],
          topExercises: [
            { name: "Press de banca", estimatedOneRepMax: 92.7, bestSet: null },
          ],
        },
      ],
    };
    // An estimate with no origin is not a personal record; quoting it would put an
    // unverifiable number into a conversation about the athlete's own body.
    expect(toAssistantContext(estimateOnly, GYM).recentPRs).toEqual([]);
  });

  it("reports a rank only for classified muscles", () => {
    expect(wire.currentMuscleRanks).toEqual({ chest: "Plata" });
    // `upper-back` is unranked. Reporting `"Sin rango"` would read to a model as a
    // tier the athlete had been placed in.
    expect(wire.currentMuscleRanks?.["upper-back"]).toBeUndefined();
  });
});

describe("gym settings projection", () => {
  it("reads the plate scale from the rack and sorts it", () => {
    const wire = toAssistantContext(TRAINED, {
      ...GYM,
      inventory: { 20: 2, 2.5: 2, 10: 2 },
    });
    expect(wire.availablePlates).toEqual([2.5, 10, 20]);
  });

  it("drops a corrupt inventory key rather than reporting NaN", () => {
    const wire = toAssistantContext(TRAINED, {
      ...GYM,
      inventory: { 20: 2, weird: 2 } as GymSettings["inventory"],
    });
    expect(wire.availablePlates).toEqual([20]);
  });

  it("uses the custom bar weight for a custom bar", () => {
    // `BAR_WEIGHTS.custom` is 0, which is right for a dumbbell but would be told to
    // the model as a real bar if passed through unchanged.
    const wire = toAssistantContext(TRAINED, {
      ...GYM,
      barType: "custom",
      customBarKg: 12,
    });
    expect(wire.barWeightKg).toBe(12);
  });

  it("uses the table for a known bar", () => {
    expect(toAssistantContext(TRAINED, { ...GYM, barType: "olympic" }).barWeightKg).toBe(20);
    expect(toAssistantContext(TRAINED, { ...GYM, barType: "ez" }).barWeightKg).toBe(10);
  });
});

describe("goal mapping", () => {
  it("covers every value the profiles.goal column can hold", () => {
    // A missing mapping silently becomes `maintenance`, which would tell a model to
    // hold a gaining athlete still. The check is on the whole domain, not one case.
    expect(Object.keys(GOAL_TO_FOCUS).sort()).toEqual(
      ["endurance", "gain_muscle", "lose_weight", "maintain", "strength"].sort(),
    );
  });

  it("treats bulking and lifting-for-strength as the same instruction", () => {
    // Both mean "add load". Mapping strength to maintenance would have a strong
    // athlete being told to hold still.
    expect(GOAL_TO_FOCUS.gain_muscle).toBe("volume");
    expect(GOAL_TO_FOCUS.strength).toBe("volume");
  });

  it("routes a cut to definition and everything else to maintenance", () => {
    expect(GOAL_TO_FOCUS.lose_weight).toBe("definition");
    expect(GOAL_TO_FOCUS.maintain).toBe("maintenance");
    // The app tracks no aerobic work, so there is nothing to progress.
    expect(GOAL_TO_FOCUS.endurance).toBe("maintenance");
  });

  it("falls back for an unknown goal rather than throwing", () => {
    // A value from a newer build than this one. The documented fallback is
    // `maintenance` -- do nothing irreversible to an athlete whose intent is
    // unknown -- and it must not be a throw on the render path.
    const future = {
      ...TRAINED,
      profile: { ...TRAINED.profile!, goal: "longevity" },
    } as unknown as CoachContext;

    expect(() => toAssistantContext(future, GYM)).not.toThrow();
    expect(toAssistantContext(future, GYM).currentGoal).toBe("maintenance");
  });
});

describe("isCoachAction", () => {
  it("accepts the four known kinds", () => {
    for (const type of [
      "exercise_swap",
      "training_adjustment",
      "calorie_adjustment",
      "deload_suggestion",
    ]) {
      expect(isCoachAction({ type })).toBe(true);
    }
  });

  it("rejects anything a model might invent", () => {
    expect(isCoachAction({ type: "prescribe_medication" })).toBe(false);
    expect(isCoachAction({ type: 42 })).toBe(false);
    expect(isCoachAction(null)).toBe(false);
    expect(isCoachAction("exercise_swap")).toBe(false);
    expect(isCoachAction(undefined)).toBe(false);
  });
});