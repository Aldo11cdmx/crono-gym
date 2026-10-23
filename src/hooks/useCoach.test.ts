/**
 * @vitest-environment jsdom
 *
 * Consent-gated projection of local-state extras onto the coach context.
 *
 * The hook wires `useAthleteContext` into `buildCoachContext` behind a consent
 * check: `injuries` and `daysPerWeek` only ride on the CoachContext when the
 * athlete has opted in. These assert that the gating recalculates on a consent
 * flip and never blocks the briefing when local state is unavailable.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/profile";
import type { ProgressStats } from "./useGymData";
import type { LocalStateRow } from "@/lib/profile/localState";

vi.mock("./useProfile", () => ({
  useProfile: vi.fn(),
  useBodyMetrics: vi.fn(),
}));
vi.mock("./useGymData", () => ({
  useProgress: vi.fn(),
}));
vi.mock("./useMuscleRanks", () => ({
  useMuscleRanks: vi.fn(),
}));
vi.mock("./useAthleteContext", () => ({
  useAthleteContext: vi.fn(),
}));

import { useCoachContext } from "./useCoach";
import { useProfile, useBodyMetrics } from "./useProfile";
import { useProgress } from "./useGymData";
import { useMuscleRanks } from "./useMuscleRanks";
import { useAthleteContext } from "./useAthleteContext";

const PROFILE: Profile = {
  user_id: "u1",
  display_name: null,
  birth_date: null,
  sex: null,
  height_cm: 175,
  weight_kg: 70,
  unit_system: "metric",
  experience_level: "intermediate",
  activity_level: "moderate",
  goal: "gain_muscle",
  guardian_consent_at: null,
  onboarding_completed_at: "2026-01-01T00:00:00.000Z",
};

const PROGRESS: ProgressStats = {
  totalWorkouts: 10,
  workoutsThisMonth: 3,
  bestWeight: 100,
  monthlyVolume: 9000,
  week: [],
  recent: [],
};

const INJURIES = "Dolor lumbar leve";
const DAYS_PER_WEEK = 4;

function setupMocks(row: LocalStateRow | null) {
  vi.mocked(useProfile).mockReturnValue({
    profile: PROFILE,
    energy: null,
    loading: false,
    error: null,
    saving: false,
    refresh: vi.fn(),
    update: vi.fn(),
  });
  vi.mocked(useBodyMetrics).mockReturnValue({
    weights: [],
    latestWeight: 70,
    changeLast30Days: null,
    measurements: [],
    checkins: [],
    loading: false,
    error: null,
    logWeight: vi.fn(),
    refresh: vi.fn(),
  });
  vi.mocked(useProgress).mockReturnValue({
    stats: PROGRESS,
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  vi.mocked(useMuscleRanks).mockReturnValue({
    map: null,
    history: [],
    promotions: [],
    loading: false,
    initialLoading: false,
    error: null,
    sessionsNeeded: 0,
    empty: true,
    distribution: {
      unranked: 0,
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
      elite: 0,
      obsidian: 0,
    },
    bodyweightKg: null,
    historyFor: () => [],
    refresh: vi.fn(),
  });
  vi.mocked(useAthleteContext).mockReturnValue({
    row,
    loading: false,
    error: null,
    revision: 0,
    save: vi.fn(),
    refresh: vi.fn(),
    clear: vi.fn(),
    schedule: vi.fn(),
  });
}

describe("useCoachContext consent gating", () => {
  it("includes injuries and daysPerWeek when consent is granted", () => {
    setupMocks({
      consent: { shareAiContext: true },
      context: { injuries: INJURIES, daysPerWeek: DAYS_PER_WEEK },
    } as LocalStateRow);

    const { result } = renderHook(() => useCoachContext("u1"));

    expect(result.current.loading).toBe(false);
    expect(result.current.context).not.toBeNull();
    expect(result.current.context?.profile?.injuries).toBe(INJURIES);
    expect(result.current.context?.profile?.daysPerWeek).toBe(DAYS_PER_WEEK);
  });

  it("omits injuries and daysPerWeek when consent is denied", () => {
    setupMocks({
      consent: { shareAiContext: false },
      context: { injuries: INJURIES, daysPerWeek: DAYS_PER_WEEK },
    } as LocalStateRow);

    const { result } = renderHook(() => useCoachContext("u1"));

    expect(result.current.loading).toBe(false);
    expect(result.current.context).not.toBeNull();
    expect(result.current.context?.profile).not.toHaveProperty("injuries");
    expect(result.current.context?.profile).not.toHaveProperty("daysPerWeek");
  });

  it("recalculates without injuries when consent flips from true to false", () => {
    setupMocks({
      consent: { shareAiContext: true },
      context: { injuries: INJURIES, daysPerWeek: DAYS_PER_WEEK },
    } as LocalStateRow);

    const { result, rerender } = renderHook(() => useCoachContext("u1"));

    expect(result.current.context?.profile?.injuries).toBe(INJURIES);
    expect(result.current.context?.profile?.daysPerWeek).toBe(DAYS_PER_WEEK);

    setupMocks({
      consent: { shareAiContext: false },
      context: { injuries: INJURIES, daysPerWeek: DAYS_PER_WEEK },
    } as LocalStateRow);
    rerender();

    expect(result.current.context?.profile).not.toHaveProperty("injuries");
    expect(result.current.context?.profile).not.toHaveProperty("daysPerWeek");
  });

  it("does not block the context when local state read fails", () => {
    setupMocks(null);

    const { result } = renderHook(() => useCoachContext("u1"));

    expect(result.current.loading).toBe(false);
    expect(result.current.context).not.toBeNull();
    expect(result.current.context?.profile).not.toHaveProperty("injuries");
    expect(result.current.context?.profile).not.toHaveProperty("daysPerWeek");
  });
});
