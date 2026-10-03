/**
 * buildCoachContext.test.ts
 *
 * The coach's honesty is the thing under test. Every case here is about a situation
 * where the easy implementation would produce a number -- a score of zero, a ratio of
 * NaN, a bodyweight that silently falls back to the onboarding value -- and the
 * correct one produces a stated gap instead.
 *
 * The muscle facts come from the real `buildRankMap` rather than a hand-written
 * `RankMap`, so a change to the scorer's shape breaks this file instead of leaving
 * it asserting against a fixture that stopped resembling the product.
 */

import { describe, expect, it } from "vitest";
import {
  buildCoachContext,
  PROMPT_PAYLOAD_MAX_CHARS,
  toCoachPromptPayload,
} from "./buildCoachContext";
import type { CoachContext } from "./types";
import { buildRankMap } from "../ranks/buildRankMap";
import type { ExerciseRow, SetRow } from "../ranks/muscleScore";
import { computeEnergyTargets, type Profile } from "../profile";
import type { ProgressStats } from "../../hooks/useGymData";

const NOW = new Date("2026-06-01T12:00:00.000Z");

const EXERCISES: ExerciseRow[] = [
  { id: "press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
  { id: "row", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
];

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function chestSets(sessions = 14): SetRow[] {
  return Array.from({ length: sessions }, (_, i) => ({
    exerciseId: "press",
    weight: 90 + i,
    reps: 5,
    isWarmup: false,
    performedAt: daysAgo(i * 3),
  }));
}

const PROFILE: Profile = {
  user_id: "u1",
  display_name: "Ana",
  birth_date: "1994-03-02",
  sex: "female",
  height_cm: 168,
  weight_kg: 62,
  unit_system: "metric",
  experience_level: "intermediate",
  activity_level: "moderate",
  goal: "gain_muscle",
  guardian_consent_at: null,
  onboarding_completed_at: daysAgo(90),
};

const PROGRESS: ProgressStats = {
  totalWorkouts: 48,
  workoutsThisMonth: 9,
  bestWeight: 100,
  monthlyVolume: 41_250,
  week: [
    { label: "s1", date: "2026-05-04", count: 4 },
    { label: "s2", date: "2026-05-11", count: 5 },
  ],
  recent: [],
};

function ranksFor(sets: SetRow[], bodyweightKg: number | null) {
  return buildRankMap({
    sets,
    exercises: EXERCISES,
    context: { bodyweightKg, sex: "female", now: NOW },
  });
}

describe("buildCoachContext", () => {
  it("carries a muscle's real rank, score and drivers", () => {
    const context = buildCoachContext({
      profile: PROFILE,
      energy: computeEnergyTargets(PROFILE, NOW),
      progress: PROGRESS,
      ranks: ranksFor(chestSets(), 62),
      now: NOW,
    });

    const chest = context.muscles.find((m) => m.slug === "chest")!;
    expect(chest.classified).toBe(true);
    expect(chest.score).toBeGreaterThan(0);
    expect(chest.unrankedReason).toBeNull();
    // The exercise that drove the score is named, so a coach can talk about the
    // movement rather than about a number.
    expect(chest.topExercises[0]?.name).toBe("Press de banca");
    expect(chest.topExercises[0]?.estimatedOneRepMax).toBeGreaterThan(0);
  });

  it("gives an unranked muscle its reason and no invented score", () => {
    // Twelve sets of back work against a body with no back sessions, so the scorer
    // returns a real unranked reason.
    const context = buildCoachContext({
      profile: PROFILE,
      energy: computeEnergyTargets(PROFILE, NOW),
      progress: PROGRESS,
      ranks: ranksFor(chestSets(), 62),
      now: NOW,
    });

    const back = context.muscles.find((m) => m.slug === "upper-back")!;
    expect(back.classified).toBe(false);
    // A score of 0 here would be a claim that the athlete is as weak as a muscle
    // they have never trained. The reason is the fact; the zero is not.
    expect(back.score).toBe(0);
    expect(back.unrankedReason).not.toBeNull();
    expect(back.unrankedReason).toBeTruthy();
  });

  it("keeps classified and unclassified muscles in the same list", () => {
    // The context has to contain the anatomy the athlete has *not* trained too:
    // that gap is what a "start here" recommendation would be built from.
    const context = buildCoachContext({
      profile: PROFILE,
      energy: computeEnergyTargets(PROFILE, NOW),
      progress: PROGRESS,
      ranks: ranksFor(chestSets(), 62),
      now: NOW,
    });

    expect(context.muscles.length).toBeGreaterThan(5);
    expect(context.muscles.some((m) => m.classified)).toBe(true);
    expect(context.muscles.some((m) => !m.classified)).toBe(true);
  });

  it("states a missing bodyweight instead of dividing by nothing", () => {
    // No profile weight and no weigh-in series. The scorer's own reason for the
    // affected muscles is `unknown_bodyweight`, and the context must not paper over
    // it with a zero.
    const context = buildCoachContext({
      profile: { ...PROFILE, weight_kg: null },
      energy: null,
      progress: PROGRESS,
      ranks: ranksFor(chestSets(), null),
      bodyweight: { latestKg: null, changeLast30Days: null, seriesCount: 0 },
      now: NOW,
    });

    expect(context.dataGaps).toContain("no_bodyweight");
    expect(context.bodyweight.latestKg).toBeNull();
    // No NaN anywhere in a structure that is about to be JSON-serialized into a
    // prompt: `NaN` serializes to `null` and silently becomes a missing fact.
    expect(JSON.stringify(context)).not.toContain("null,null,null");
  });

  it("prefers a logged weigh-in over the number typed at onboarding", () => {
    const context = buildCoachContext({
      profile: PROFILE,
      energy: computeEnergyTargets(PROFILE, NOW),
      progress: PROGRESS,
      ranks: ranksFor(chestSets(), 62),
      bodyweight: { latestKg: 61.4, changeLast30Days: -1.2, seriesCount: 9 },
      now: NOW,
    });

    expect(context.bodyweight.latestKg).toBe(61.4);
    expect(context.bodyweight.changeLast30Days).toBe(-1.2);
    expect(context.bodyweight.seriesCount).toBe(9);
    // The profile view reports the same number, so the briefing and the profile
    // cannot disagree on screen.
    expect(context.profile?.weightKg).toBe(61.4);
    expect(context.dataGaps).not.toContain("no_bodyweight");
  });

  it("names the missing inputs of an athlete with no data at all", () => {
    const context = buildCoachContext({
      profile: null,
      energy: null,
      progress: null,
      ranks: null,
      now: NOW,
    });

    expect(context.profile).toBeNull();
    expect(context.muscles).toEqual([]);
    expect(context.dataGaps).toEqual(
      expect.arrayContaining([
        "no_readiness_checkins",
        "no_profile",
        "no_bodyweight",
        "no_profile_energy",
        "no_workouts",
        "no_classified_muscles",
      ]),
    );
  });

  it("always reports readiness as missing, because nothing writes it", () => {
    // `session_checkins` has a reader and no writer, so there is no version of this
    // app in which readiness is available. Reporting it unconditionally is honest;
    // probing for it would be theatre.
    const full = buildCoachContext({
      profile: PROFILE,
      energy: computeEnergyTargets(PROFILE, NOW),
      progress: PROGRESS,
      ranks: ranksFor(chestSets(), 62),
      bodyweight: { latestKg: 62, changeLast30Days: 0, seriesCount: 3 },
      now: NOW,
    });

    expect(full.dataGaps).toContain("no_readiness_checkins");
    // The only gap left on a well-populated athlete is the structural one.
    expect(full.dataGaps).toEqual(["no_readiness_checkins"]);
  });
});

describe("toCoachPromptPayload", () => {
  const SMALL: CoachContext = {
    generatedAt: "2026-06-01T12:00:00.000Z",
    profile: null,
    bodyweight: { latestKg: 62, changeLast30Days: 0, seriesCount: 4 },
    volume: { totalWorkouts: 10, workoutsThisMonth: 3, monthlyVolume: 9000, weeklyPoints: [] },
    energy: { targetKcal: 2200, proteinGrams: 130 },
    muscles: [],
    dataGaps: ["no_readiness_checkins"],
  };

  it("passes a small context through untouched", () => {
    const payload = toCoachPromptPayload(SMALL);
    expect(payload.truncatedChars).toBe(0);
    expect(payload.context).toEqual(SMALL);
  });

  it("stays JSON-serializable and inside the budget", () => {
    // Deliberately far past the cap, so the trimming path is the one under test. A
    // fixture that only just exceeds it would pass while cutting nothing, which is
    // the failure this assertion exists to prevent.
    const heavy: CoachContext = {
      ...SMALL,
      volume: {
        ...SMALL.volume,
        weeklyPoints: Array.from({ length: 600 }, (_, i) => ({
          label: `semana-${i}`,
          date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
          count: i % 6,
        })),
      },
      muscles: Array.from({ length: 60 }, (_, i) => ({
        slug: "chest",
        label: `Músculo con nombre largo ${i}`,
        classified: i % 2 === 0,
        rankId: "bronze",
        rankLabel: "Bronce",
        score: i,
        unrankedReason: i % 2 === 0 ? null : "no_data",
        confidence: "medium",
        effectiveSets: 20,
        activeWeeks: 6,
        topExercises: Array.from({ length: 3 }, (_unused, j) => ({
          name: `Ejercicio con nombre deliberadamente largo ${i}-${j}`,
          estimatedOneRepMax: 100 + j,
          bestSet: { weight: 80 + j, reps: 5 },
        })),
      })),
    };

    // Sanity check on the fixture itself: if this ever stops holding, the test below
    // is no longer testing the cap.
    expect(JSON.stringify(heavy).length).toBeGreaterThan(PROMPT_PAYLOAD_MAX_CHARS);

    const payload = toCoachPromptPayload(heavy);
    const serialized = JSON.stringify(payload.context);

    expect(serialized.length).toBeLessThanOrEqual(PROMPT_PAYLOAD_MAX_CHARS);
    expect(payload.truncatedChars).toBeGreaterThan(0);
    // Still parseable after the cut, which a naive `slice` of the string would not be.
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it("trims history before facts", () => {
    // The order matters: a capped payload that dropped the bodyweight would be able
    // to say nothing useful, because every strength standard is relative to it.
    const heavy: CoachContext = {
      ...SMALL,
      volume: {
        ...SMALL.volume,
        weeklyPoints: Array.from({ length: 900 }, (_, i) => ({
          label: `w${i}`,
          date: "2026-01-01",
          count: 3,
        })),
      },
      muscles: SMALL.muscles,
    };

    const payload = toCoachPromptPayload(heavy) as { context: CoachContext };
    // Bodyweight, energy and gaps survive; the long tail does not.
    expect(payload.context.bodyweight.latestKg).toBe(62);
    expect(payload.context.energy?.proteinGrams).toBe(130);
    expect(payload.context.dataGaps).toEqual(["no_readiness_checkins"]);
  });
});
