/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Profile } from "@/lib/profile";
import type { DashboardSession } from "@/lib/dashboard/dashboardMetrics";
import type { AthletePR } from "@/hooks/useAthletePRs";
import { DashboardPage } from "./DashboardPage";

const mockStart = vi.fn();
const mockNavigate = vi.fn();
const mockEnd = vi.fn();

const mockState = vi.hoisted(() => {
  const profile: Profile = {
    user_id: "user-1",
    display_name: "Test",
    birth_date: null,
    sex: null,
    height_cm: null,
    weight_kg: null,
    unit_system: "metric",
    experience_level: "beginner",
    activity_level: "moderate",
    goal: "maintain",
    guardian_consent_at: null,
    onboarding_completed_at: "2026-01-01T00:00:00Z",
  };

  const routine = {
    id: "r-1",
    title: "Full Body",
    exercises: [
      { exercise: { id: "e-1", name: "Squat" }, target_sets: 3, rest_seconds: 90 },
    ],
    is_favorite: false,
    user_id: "user-1",
    description: null,
    created_at: "2026-01-01T00:00:00Z",
    source: "manual",
    authored_by_coach: null,
  };

  const session: DashboardSession = {
    id: "s-1",
    startedAt: "2026-10-03T10:00:00",
    completedAt: "2026-10-03T10:45:00",
    routineId: "r-1",
    routineTitle: "Full Body",
    sets: [
      {
        id: "set-1",
        exerciseId: "e-1",
        exerciseName: "Squat",
        weight: 100,
        reps: 8,
        isWarmup: false,
        bodyPart: "quads",
      },
    ],
  };

  const pr: AthletePR = {
    exerciseId: "e-1",
    exerciseName: "Squat",
    weightKg: 150,
    reps: 5,
    achievedAt: "2026-10-01T10:00:00",
  };

  return {
    profile: profile as Profile | null,
    profileLoading: false,
    routines: [routine] as typeof routine[],
    routinesLoading: false,
    sessions: [session] as DashboardSession[],
    sessionsLoading: false,
    athletePRs: [pr] as AthletePR[],
    prsLoading: false,
    isActive: false,
    session: null as null | { routineId: string; title: string; startedAt: string },
  };
});

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mockState.profile,
    energy: null,
    loading: mockState.profileLoading,
    saving: false,
    error: null,
    refresh: vi.fn(),
    update: vi.fn(),
  }),
}));

vi.mock("@/hooks/useGymData", () => ({
  useRoutines: () => ({
    routines: mockState.routines,
    loading: mockState.routinesLoading,
    error: null,
    refresh: vi.fn(),
    toggleFavorite: vi.fn(),
    pendingIds: new Set(),
  }),
}));

vi.mock("@/hooks/useDashboardSessions", () => ({
  useDashboardSessions: () => ({
    sessions: mockState.sessions,
    loading: mockState.sessionsLoading,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAthletePRs", () => ({
  useAthletePRs: () => ({
    prs: mockState.athletePRs,
    loading: mockState.prsLoading,
    error: null,
  }),
}));

vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: () => ({
    session: mockState.session,
    isActive: mockState.isActive,
    start: mockStart,
    end: mockEnd,
  }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

afterEach(() => cleanup());

describe("DashboardPage", () => {
  beforeEach(() => {
    mockState.profile = {
      user_id: "user-1",
      display_name: "Test",
      birth_date: null,
      sex: null,
      height_cm: null,
      weight_kg: null,
      unit_system: "metric",
      experience_level: "beginner",
      activity_level: "moderate",
      goal: "maintain",
      guardian_consent_at: null,
      onboarding_completed_at: "2026-01-01T00:00:00Z",
    };
    mockState.profileLoading = false;
    mockState.routines = [
      {
        id: "r-1",
        title: "Full Body",
        exercises: [
          { exercise: { id: "e-1", name: "Squat" }, target_sets: 3, rest_seconds: 90 },
        ],
        is_favorite: false,
        user_id: "user-1",
        description: null,
        created_at: "2026-01-01T00:00:00Z",
        source: "manual",
        authored_by_coach: null,
      },
    ];
    mockState.routinesLoading = false;
    mockState.sessions = [
      {
        id: "s-1",
        startedAt: "2026-10-03T10:00:00",
        completedAt: "2026-10-03T10:45:00",
        routineId: "r-1",
        routineTitle: "Full Body",
        sets: [
          {
            id: "set-1",
            exerciseId: "e-1",
            exerciseName: "Squat",
            weight: 100,
            reps: 8,
            isWarmup: false,
            bodyPart: "quads",
          },
        ],
      },
    ];
    mockState.sessionsLoading = false;
    mockState.athletePRs = [
      {
        exerciseId: "e-1",
        exerciseName: "Squat",
        weightKg: 150,
        reps: 5,
        achievedAt: "2026-10-01T10:00:00",
      },
    ];
    mockState.prsLoading = false;
    mockState.isActive = false;
    mockState.session = null;
    mockStart.mockClear();
    mockNavigate.mockClear();
  });

  it("renders loading skeleton when any data source is loading", () => {
    mockState.profileLoading = true;

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

     // Loading state: hero shows a skeleton (no real greeting text).
    expect(screen.queryByText("Crear rutina")).toBeFalsy();
    expect(screen.queryByText("Empezar entrenamiento")).toBeFalsy();
  });

  it("renders the dashboard with data from all hooks", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Full Body/)).toBeTruthy();
    expect(screen.getByText("Racha")).toBeTruthy();
    expect(screen.getByText("Esta semana")).toBeTruthy();
    expect(screen.getByText("Récords recientes")).toBeTruthy();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("starts a session and navigates when primary button is clicked", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Empezar entrenamiento"));
    expect(mockStart).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/entrenar");
  });

  it("shows active session banner when a session is active", () => {
    mockState.isActive = true;
    mockState.session = {
      routineId: "r-1",
      title: "Full Body",
      startedAt: "2026-10-05T10:00:00",
    };

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("EN CURSO")).toBeTruthy();
    expect(screen.getByText("Continuar entrenamiento")).toBeTruthy();
    expect(screen.queryByText("Empezar entrenamiento")).toBeFalsy();
  });

  it("renders QuickActionButton with actions", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    const fab = screen.getByRole("button", { name: "▶" });
    fireEvent.click(fab);

    expect(screen.getByText("Nueva rutina")).toBeTruthy();
    expect(screen.getByText("Registro rápido")).toBeTruthy();
  });
});
