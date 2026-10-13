/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Profile } from "@/lib/profile";
import type { DashboardSession } from "@/lib/dashboard/dashboardMetrics";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { DashboardPage } from "./DashboardPage";

const mockStart = vi.fn();
const mockNavigate = vi.fn();
const mockEnd = vi.fn();

const FIXED_NOW = new Date("2026-10-05T12:00:00").getTime();

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

  const routine: RoutineWithExercises = {
    id: "r-1",
    title: "Full Body",
    exercises: [
      {
        exercise: {
          id: "e-1",
          name: "Squat",
          body_part: "quads",
          target: "quadriceps",
          equipment: "barbell",
          gif_url: "",
          instructions: ["stand", "squat"],
        },
        target_sets: 3,
        rest_seconds: 90,
        dayIndex: 0,
        dayLabel: "Pecho",
      },
    ],
    is_favorite: false,
    user_id: "user-1",
    description: null,
    created_at: "2026-01-01T00:00:00Z",
    source: "user",
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

  return {
    profile: profile as Profile | null,
    profileLoading: false,
    profileError: null as string | null,
    routines: [routine] as RoutineWithExercises[],
    routinesLoading: false,
    routinesError: null as string | null,
    sessions: [session] as DashboardSession[],
    sessionsLoading: false,
    sessionsError: null as string | null,
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
    error: mockState.profileError,
    refresh: vi.fn(),
    update: vi.fn(),
  }),
}));

vi.mock("@/hooks/useGymData", () => ({
  useRoutines: () => ({
    routines: mockState.routines,
    loading: mockState.routinesLoading,
    error: mockState.routinesError,
    refresh: vi.fn(),
    toggleFavorite: vi.fn(),
    pendingIds: new Set(),
  }),
}));

vi.mock("@/hooks/useDashboardSessions", () => ({
  useDashboardSessions: () => ({
    sessions: mockState.sessions,
    loading: mockState.sessionsLoading,
    error: mockState.sessionsError,
    refresh: vi.fn(),
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
    vi.useFakeTimers({ now: FIXED_NOW });
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
    mockState.profileError = null;
    mockState.routines = [
      {
        id: "r-1",
        title: "Full Body",
        exercises: [
          {
            exercise: {
          id: "e-1",
          name: "Squat",
          body_part: "quads",
          target: "quadriceps",
          equipment: "barbell",
          gif_url: "",
          instructions: ["stand", "squat"],
        },
            target_sets: 3,
            rest_seconds: 90,
            dayIndex: 0,
            dayLabel: "Pecho",
          },
        ],
        is_favorite: false,
        user_id: "user-1",
        description: null,
        created_at: "2026-01-01T00:00:00Z",
        source: "user",
        authored_by_coach: null,
      },
    ];
    mockState.routinesLoading = false;
    mockState.routinesError = null;
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
    mockState.sessionsError = null;
    mockState.isActive = false;
    mockState.session = null;
    mockStart.mockClear();
    mockNavigate.mockClear();
    mockEnd.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading skeleton when any data source is loading", () => {
    mockState.profileLoading = true;

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Iniciar Sesión")).toBeFalsy();
    expect(screen.queryByText("Full Body")).toBeFalsy();
  });

  it("renders the dashboard with data from all hooks", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Full Body/)).toBeTruthy();
    expect(screen.getByText("Consistencia")).toBeTruthy();
    expect(screen.getByText("Esta semana")).toBeTruthy();
    expect(screen.getByText("Récords recientes")).toBeTruthy();
    expect(screen.getByText("Iniciar Sesión")).toBeTruthy();
    expect(screen.getByText("HOY")).toBeTruthy();
  });

  it("starts a session and navigates when primary button is clicked", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Iniciar Sesión"));
    expect(mockStart).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/entrenar");
  });

  it("shows EN CURSO badge when a session is active", () => {
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
    expect(screen.getByText("Iniciar Sesión")).toBeTruthy();
  });

  it("shows Rutina del día when no routine is suggested", () => {
    mockState.routines = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Rutina del día")).toBeTruthy();
    expect(screen.getByText("Crea tu primera rutina para empezar")).toBeTruthy();
  });
});
