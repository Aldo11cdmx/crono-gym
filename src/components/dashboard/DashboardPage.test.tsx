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

const mockAnnouncements = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mockAnnouncements,
  } as any,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

afterEach(() => cleanup());

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
  mockSelect.mockReturnValue({
    order: () => Promise.resolve({ data: [], error: null }),
  });
  mockAnnouncements.mockReturnValue({
    select: mockSelect,
  });
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DashboardPage", () => {
  it("renders loading skeleton and hides the CTA while any source is loading", () => {
    mockState.profileLoading = true;

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Comenzar entrenamiento")).toBeFalsy();
    expect(screen.queryByText("Full Body")).toBeFalsy();
  });

  it("renders the hero with greeting, routine metadata and a single primary CTA", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Buenas tardes, Test/)).toBeTruthy();
    expect(screen.getByText("Full Body · 1 ej · 15 min")).toBeTruthy();
    expect(screen.getByText("Comenzar entrenamiento")).toBeTruthy();
    // Un solo CTA prominente primario.
    expect(screen.getAllByText("Comenzar entrenamiento").length).toBe(1);
    expect(screen.queryByText("Crear rutina")).toBeFalsy();
    // El monito anatomico va a la derecha en su contenedor recortado.
    expect(screen.getByTestId("muscle-readonly-map")).toBeTruthy();
    // Ningun simbolo de mojibake en pantalla.
    expect(document.body.textContent).not.toMatch(/Ã|\uFFFD/);
  });

  it("starts a session and navigates to training when the primary CTA is clicked", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Comenzar entrenamiento"));
    expect(mockStart).toHaveBeenCalledWith({
      id: "r-1",
      title: "Full Body",
    });
    expect(mockNavigate).toHaveBeenCalledWith("/entrenar");
  });

  it("shows Continuar entrenamiento when a session is active", () => {
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

    expect(screen.getByText("Continuar entrenamiento")).toBeTruthy();
    expect(screen.queryByText("Comenzar entrenamiento")).toBeFalsy();
  });

  it("shows Ver historial when today's session is completed and navigates to progreso", () => {
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

    expect(screen.getByText("Ver historial")).toBeTruthy();
    fireEvent.click(screen.getByText("Ver historial"));
    expect(mockNavigate).toHaveBeenCalledWith("/progreso");
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("shows the idle invitation and no anatomy distribution when no routine exists", () => {
    mockState.routines = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Rutina del día")).toBeTruthy();
    expect(screen.getByText("Crea tu primera rutina para empezar")).toBeTruthy();
    expect(
      screen.getByText(/Elige una rutina para ver los m/),
    ).toBeTruthy();
    expect(screen.getByTestId("muscle-readonly-map")).toBeTruthy();
  });

  it("renders the weekly consistency card with day pills and streak", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Esta semana")).toBeTruthy();
    expect(screen.getByText("0/3 completados")).toBeTruthy();
    ["L", "M", "X", "J", "V", "S", "D"].forEach((letter) =>
      expect(screen.getByText(letter)).toBeTruthy(),
    );
    // Lunes es hoy con FIXED_NOW: pastilla de acento.
    const lunes = screen.getAllByText("L")[0];
    expect((lunes as HTMLElement).style.backgroundColor).toBe("rgb(255, 59, 48)");
  });

  it("keeps the weekly streak factual once a session exists this week", () => {
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

    expect(screen.queryByText("0/3 completados")).toBeFalsy();
    expect(screen.getByText("1/3 completados")).toBeTruthy();
  });

  it("renders the fatigue alert card and the active announcements feed", async () => {
    mockSelect.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: [
            {
              id: "a-1",
              title: "Mantenimiento del gimnasio",
              message: "El gimnasio cierra a las 22 h.",
              kind: "notice",
              starts_at: "2026-10-01T00:00:00Z",
              expires_at: "2026-10-31T23:59:59Z",
            },
          ],
          error: null,
        }),
    });

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    await act(async () => {});

    expect(screen.getByText("Mantenimiento del gimnasio")).toBeTruthy();
    expect(screen.getByText("El gimnasio cierra a las 22 h.")).toBeTruthy();
    expect(screen.getByText("Aviso")).toBeTruthy();
    // NingÃºn anuncio vÃ­a de mojibake.
    expect(document.body.textContent).not.toMatch(/Ã|\uFFFD/);
  });

  it("shows the daily tip card when there are no announcements", async () => {
    mockSelect.mockReturnValue({
      order: () => Promise.resolve({ data: [], error: null }),
    });

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    await act(async () => {});

    // Un tip del catalogo se renderiza.
    expect(screen.getByText(/Deja 1-2 reps en la reserva/)).toBeTruthy();
    // El boton para pasar al siguiente tip esta presente.
    expect(screen.getByText("Siguiente tip")).toBeTruthy();
    // Ningun simbolo de mojibake en pantalla.
    expect(document.body.textContent).not.toMatch(/Ã|\uFFFD/);
  });

  it("sanitizes the display name: mich_nsqk -> Mich in the greeting", () => {
    mockState.profile = {
      ...mockState.profile,
      display_name: "mich_nsqk",
    } as Profile;

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Buenas tardes, Mich/)).toBeTruthy();
  });

  it("shows the day label when the routine title is xd", () => {
    mockState.routines = [
      {
        ...mockState.routines[0],
        title: "xd",
      },
    ];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // El dayLabel "Pecho" gana sobre el fallback cuando el titulo es "xd".
    expect(screen.getByText("Pecho")).toBeTruthy();
    expect(screen.queryByText("xd")).toBeFalsy();
  });

  it("cycles to a different tip when clicking Siguiente tip", async () => {
    mockSelect.mockReturnValue({
      order: () => Promise.resolve({ data: [], error: null }),
    });

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    await act(async () => {});

    const firstTipEl = screen.getByText(/Deja 1-2 reps en la reserva/);
    expect(firstTipEl).toBeTruthy();

    fireEvent.click(screen.getByText("Siguiente tip"));

    // El boton sigue presente y el tip cambio (12 tips distintos en el catalogo).
    expect(screen.getByText("Siguiente tip")).toBeTruthy();
    expect(screen.queryByText(/Deja 1-2 reps en la reserva/)).toBeFalsy();
  });

  it("renders no mojibake symbols anywhere on screen", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(document.body.textContent).not.toMatch(/Ã©|Â·|Ã³|Ã¡|Ã­|Ã±|\uFFFD/);
  });
});
