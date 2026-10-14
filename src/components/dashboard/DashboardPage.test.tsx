/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Profile } from "@/lib/profile";
import type { DashboardSession } from "@/lib/dashboard/dashboardMetrics";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { DashboardPage } from "./DashboardPage";

const mockStart = vi.fn();
const mockNavigate = vi.fn();
const mockEnd = vi.fn();
const mockLoadDraft = vi.hoisted(() => vi.fn());

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
    session: null as null | {
      routineId: string | null;
      title: string;
      startedAt: string;
    },
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

// The running session's set progress is read from the persisted
// draft. jsdom has no IndexedDB, so the read is mocked here: the
// default is "no draft" (zeros), and the tests that exercise the
// progress bar resolve a draft whose startedAt matches the session.
vi.mock("@/lib/offlineStore", () => ({
  loadRecoverableDraft: (...args: unknown[]) => mockLoadDraft(...args),
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
          target: "quads",
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
        id: "s-prior",
        startedAt: "2026-09-25T10:00:00",
        completedAt: "2026-09-25T10:45:00",
        routineId: "r-1",
        routineTitle: "Full Body",
        sets: [
          {
            id: "set-0",
            exerciseId: "e-1",
            exerciseName: "Squat",
            weight: 90,
            reps: 8,
            isWarmup: false,
            bodyPart: "quads",
          },
        ],
      },
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
    mockLoadDraft.mockReset();
    mockLoadDraft.mockResolvedValue(null);
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

    expect(screen.queryByText("Comenzar entrenamiento")).toBeFalsy();
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
    expect(screen.getByText("Comenzar entrenamiento")).toBeTruthy();
    expect(screen.getByText("HOY")).toBeTruthy();
  });

  it("starts a session and navigates when primary button is clicked", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Comenzar entrenamiento"));
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
    expect(screen.getByText("Continuar entrenamiento")).toBeTruthy();
  });

  it("shows COMPLETADA badge with the session summary when a session was completed today", () => {
    mockState.sessions = [
      {
        id: "s-today",
        startedAt: "2026-10-05T10:00:00",
        completedAt: "2026-10-05T10:45:00",
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
          {
            id: "set-2",
            exerciseId: "e-1",
            exerciseName: "Squat",
            weight: 102.5,
            reps: 8,
            isWarmup: false,
            bodyPart: "quads",
          },
        ],
      },
    ];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("COMPLETADA")).toBeTruthy();
    expect(screen.getByText("Full Body")).toBeTruthy();
    expect(
      screen.getByText("Sesión completada hoy · 45 min · 2 series de trabajo"),
    ).toBeTruthy();
    expect(screen.getByText("Ver historial")).toBeTruthy();
  });

  it("navigates to the progress view from the completed state", () => {
    mockState.sessions = [
      {
        id: "s-today",
        startedAt: "2026-10-05T10:00:00",
        completedAt: "2026-10-05T10:45:00",
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

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Ver historial"));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/progreso");
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

  it("shows the weekly empty legend when no session was completed this week", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // The only recorded session is from last week, so this week's
    // counter is 0/3 and the strip says so instead of reading as broken.
    expect(screen.getByText("Tu semana comienza hoy")).toBeTruthy();
    expect(
      screen.getByText(
        "Cuando registres tus entrenamientos, aquí podrás ver tu constancia semanal.",
      ),
    ).toBeTruthy();
  });

  it("keeps the weekly strip factual once a session exists this week", () => {
    mockState.sessions = [
      {
        id: "s-today",
        startedAt: "2026-10-05T10:00:00",
        completedAt: "2026-10-05T10:45:00",
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

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // One completed session on Monday: the legend must be gone and the
    // real counter (1/3) must be what the card reports.
    expect(screen.queryByText("Tu semana comienza hoy")).toBeFalsy();
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  it("shows the volume trend with its week-over-week delta", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // The fixture holds 800 kg this week against 720 kg the
    // week before, so the trend reads as a real +11.1%: the
    // shape and the direction, not just the total.
    expect(screen.getByText("Volumen (7d)")).toBeTruthy();
    expect(screen.getByText("+11.1%")).toBeTruthy();
    expect(
      screen.getByLabelText("Tendencia de volumen de los últimos 7 días"),
    ).toBeTruthy();
  });

  it("shows the editorial records empty state with a start action", () => {
    mockState.sessions = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Cada progreso tiene un comienzo")).toBeTruthy();
    expect(
      screen.getByText(
        "Registra una sesión para empezar a construir tu historial. Tus mejores cargas y repeticiones aparecerán aquí al completar entrenamientos.",
      ),
    ).toBeTruthy();
    // The hero and the records card both offer the start action.
    expect(screen.getAllByText("Comenzar entrenamiento").length).toBe(2);
  });

  it("starts a training session from the records empty state", () => {
    mockState.sessions = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // Two buttons share the label; either must start (when a routine is
    // suggested) and land on the workout screen.
    const buttons = screen.getAllByText("Comenzar entrenamiento");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(mockStart).toHaveBeenCalledWith({
      id: "r-1",
      title: "Full Body",
    });
    expect(mockNavigate).toHaveBeenCalledWith("/entrenar");
  });

  it("keeps the records list when records exist", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // The default fixture has a session two days ago with a working set,
    // which is a record within the 7-day window.
    expect(screen.queryByText("Cada progreso tiene un comienzo")).toBeFalsy();
    expect(screen.getByText("Squat")).toBeTruthy();
  });

  it("shows the graphite anatomy with an invitation when no routine exists", () => {
    mockState.routines = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Elige una rutina para ver los músculos que trabajará"),
    ).toBeTruthy();
    expect(screen.getByTestId("muscle-readonly-map")).toBeTruthy();
  });

  it("shows the muscle distribution caption instead of the invitation when a routine exists", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // The default routine's single exercise targets the quadriceps.
    expect(
      screen.queryByText("Elige una rutina para ver los músculos que trabajará"),
    ).toBeFalsy();
    expect(screen.getByText("Cuádriceps")).toBeTruthy();
  });

  it("offers a create-routine action when no routine exists", () => {
    mockState.routines = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // The primary stays "Comenzar entrenamiento"; the secondary
    // is the path to building the plan itself.
    expect(screen.getByText("Comenzar entrenamiento")).toBeTruthy();
    expect(screen.getByText("Crear rutina")).toBeTruthy();
  });

  it("navigates to the routines view from the create-routine action", () => {
    mockState.routines = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Crear rutina"));
    expect(mockNavigate).toHaveBeenCalledWith("/rutinas");
  });

  it("hides the create-routine action once a routine exists", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Crear rutina")).toBeFalsy();
  });

  it("shows the elapsed clock and set progress during a session", async () => {
    mockState.isActive = true;
    mockState.session = {
      routineId: "r-1",
      title: "Full Body",
      startedAt: "2026-10-05T10:00:00",
    };
    // One set done of a four-set plan, in the draft the workout
    // screen persists. The startedAt matches the running session.
    mockLoadDraft.mockResolvedValue({
      logId: "log-1",
      userId: "user-1",
      routineId: "r-1",
      routineTitle: "Full Body",
      startedAt: "2026-10-05T10:00:00",
      items: [
        {
          key: "e-1",
          exercise: {
            id: "e-1",
            name: "Squat",
            body_part: "quads",
            target: "quadriceps",
            equipment: "barbell",
            gif_url: "",
            instructions: ["stand", "squat"],
          },
          restSeconds: 90,
          sets: [
            {
              set_number: 1,
              weight: "100",
              reps: "8",
              rpe: "",
              kind: "normal",
              completed: true,
            },
            {
              set_number: 2,
              weight: "",
              reps: "",
              rpe: "",
              kind: "normal",
              completed: false,
            },
            {
              set_number: 3,
              weight: "",
              reps: "",
              rpe: "",
              kind: "normal",
              completed: false,
            },
            {
              set_number: 4,
              weight: "",
              reps: "",
              rpe: "",
              kind: "normal",
              completed: false,
            },
          ],
        },
      ],
      notes: "",
      finalized: false,
      updatedAt: 0,
    });

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    await act(async () => {});

    expect(screen.getByText("EN CURSO")).toBeTruthy();
    // FIXED_NOW is 12:00 and the session started at 10:00.
    expect(screen.getByText("120:00")).toBeTruthy();
    expect(screen.getByText("1/4 series")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(
      screen.getByLabelText("Series completadas: 1 de 4"),
    ).toBeTruthy();
  });

  it("shows no set progress when the plan has no sets", async () => {
    mockState.isActive = true;
    mockState.session = {
      routineId: null,
      title: "Sesión libre",
      startedAt: "2026-10-05T10:00:00",
    };
    // A draft with no exercises: zero planned sets, so there is
    // no progress to express and no bar to fill.
    mockLoadDraft.mockResolvedValue({
      logId: "log-2",
      userId: "user-1",
      routineId: null,
      routineTitle: "Sesión libre",
      startedAt: "2026-10-05T10:00:00",
      items: [],
      notes: "",
      finalized: false,
      updatedAt: 0,
    });

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    await act(async () => {});

    expect(screen.getByText("EN CURSO")).toBeTruthy();
    // Zero planned sets: no progress bar and no "done/planned" chip.
    expect(screen.queryByRole("progressbar")).toBeFalsy();
    expect(screen.queryByText(/^\d+\/\d+ series$/)).toBeFalsy();
  });

  it("shows no elapsed clock or progress once the session is completed", () => {
    mockState.sessions = [
      {
        id: "s-today",
        startedAt: "2026-10-05T10:00:00",
        completedAt: "2026-10-05T10:45:00",
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

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // A finished session is not active: no EN CURSO badge, no
    // running clock, no progress bar — the summary and the
    // history action instead.
    expect(screen.getByText("COMPLETADA")).toBeTruthy();
    expect(screen.queryByText("EN CURSO")).toBeFalsy();
    expect(screen.queryByLabelText(/Tiempo transcurrido/)).toBeFalsy();
    expect(screen.queryByRole("progressbar")).toBeFalsy();
    expect(screen.getByText("Ver historial")).toBeTruthy();
  });
});
