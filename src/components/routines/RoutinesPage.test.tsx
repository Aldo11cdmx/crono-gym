/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { RoutinesPage } from "./RoutinesPage";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { useRoutines } from "@/hooks/useGymData";
import { ActiveSessionProvider } from "@/context/ActiveSessionContext";
import type { Exercise } from "@/types/supabase";
import type { ReactNode } from "react";

const mockStart = vi.hoisted(() => vi.fn(() => ({ ok: true })));
const mockIsActive = vi.hoisted(() => ({ value: false }));

vi.mock("@/hooks/useGymData", () => ({
  useRoutines: vi.fn(),
}));

vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: vi.fn(() => ({ isActive: mockIsActive.value, start: mockStart })),
  ActiveSessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const OUTLET_CONTEXT: WorkspaceOutletContext = {
  userId: "user-1",
  email: "user@example.com",
};

const EXERCISE: Exercise = {
  id: "ex-0001",
  name: "Press banca",
  body_part: "chest",
  target: "pectorals",
  equipment: "body weight",
  gif_url: "",
  instructions: [],
  name_es: null,
  is_active: true,
  is_hidden: false,
};

function makeRoutineExercise(overrides: any = {}) {
  return {
    exercise: EXERCISE,
    target_sets: 3,
    rest_seconds: 90,
    rowId: "row-1",
    order_index: 0,
    target_reps_min: null,
    target_reps_max: null,
    dayIndex: 0,
    dayLabel: "",
    groupId: null,
    ...overrides,
  };
}

function makePlannedExercise(overrides: Partial<import("@/hooks/useGymData").PlannedExercise> = {}): import("@/hooks/useGymData").PlannedExercise {
  return {
    exercise: EXERCISE,
    target_sets: 3,
    rest_seconds: 90,
    rowId: "row-1",
    order_index: 0,
    target_reps_min: null,
    target_reps_max: null,
    dayIndex: 0,
    dayLabel: "",
    ...overrides,
  };
}

function makeRoutine(overrides: Partial<RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" }> = {}): RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" } {
  return {
    id: "routine-1",
    user_id: "user-1",
    title: "Mi rutina",
    description: "Rutina de prueba",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    exercises: [],
    routineMode: "single",
    ...overrides,
  } as unknown as RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" };
}

describe("RoutinesPage", () => {
  beforeEach(() => {
    cleanup();
    mockIsActive.value = false;
    mockStart.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  function renderPageWithSession() {
    return render(
      <ActiveSessionProvider>
        <MemoryRouter initialEntries={["/rutinas"]}>
          <Routes>
            <Route
              path="/rutinas"
              element={<Outlet context={OUTLET_CONTEXT} />}
            >
              <Route index element={<RoutinesPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ActiveSessionProvider>,
    );
  }

  it("A16: rutina legacy (sin sobre) muestra 'Sin clasificar' y ofrece convertir a semanal", () => {
    const legacy = makeRoutine({ title: "Rutina antigua", routineMode: "legacy" });
    vi.mocked(useRoutines).mockReturnValue({
      routines: [legacy],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);
    renderPageWithSession();

    expect(screen.getByText("Sin clasificar")).toBeTruthy();
    expect(screen.getByText("Rutina antigua")).toBeTruthy();
  });

  it("muestra rutina semanal con badge 'Semanal'", () => {
    const weekly = makeRoutine({ title: "Rutina semanal", routineMode: "weekly", exercises: [makePlannedExercise()] });
    vi.mocked(useRoutines).mockReturnValue({
      routines: [weekly],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);
    renderPageWithSession();

    const titles = screen.getAllByText("Rutina semanal");
    expect(titles.length).toBeGreaterThan(0);
    expect(screen.getByText("Semanal")).toBeTruthy();
  });

  it("A16: rutina legacy (sin sobre) muestra 'Sin clasificar' en la lista", () => {
    const legacy = makeRoutine({ title: "Rutina antigua", routineMode: "legacy" });
    vi.mocked(useRoutines).mockReturnValue({
      routines: [legacy],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);
    renderPageWithSession();

    expect(screen.getByText("Sin clasificar")).toBeTruthy();
    expect(screen.getByText("Rutina antigua")).toBeTruthy();
  });

  it("no truena al alternar loading entre renders (hooks antes de early returns)", () => {
    const single = makeRoutine({ title: "Rutina individual", routineMode: "single", exercises: [makePlannedExercise()] });
    const mockUseRoutines = vi.mocked(useRoutines);

    const Page = () => (
      <ActiveSessionProvider>
        <MemoryRouter initialEntries={["/rutinas"]}>
          <Routes>
            <Route
              path="/rutinas"
              element={<Outlet context={OUTLET_CONTEXT} />}
            >
              <Route index element={<RoutinesPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ActiveSessionProvider>
    );

    mockUseRoutines.mockReturnValue({
      routines: [single],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);

    const { rerender } = render(<Page />);
    expect(screen.getByText("Rutina individual")).toBeTruthy();

    mockUseRoutines.mockReturnValue({
      routines: [single],
      loading: true,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);
    rerender(<Page />);
    expect(screen.getByText("Cargando rutinas…")).toBeTruthy();

    mockUseRoutines.mockReturnValue({
      routines: [single],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);
    rerender(<Page />);
    expect(screen.getByText("Rutina individual")).toBeTruthy();
  });

  it("muestra rutina individual sin badge de legado", () => {
    const single = makeRoutine({ title: "Rutina individual", routineMode: "single", exercises: [makePlannedExercise()] });
    vi.mocked(useRoutines).mockReturnValue({
      routines: [single],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);
    renderPageWithSession();

    expect(screen.getByText("Rutina individual")).toBeTruthy();
    expect(screen.queryByText("Sin clasificar")).toBeNull();
  });

  it("A4: iniciar el Lunes de un plan semanal → sesión con solo ejercicios del Lunes y routineDayId", () => {
    const lunesId = "11111111-1111-1111-1111-111111111101";
    const lunesEx = makeRoutineExercise({ dayIndex: 0, dayLabel: "Lunes", rowId: "row-lunes-1" });
    const martesEx = makeRoutineExercise({ dayIndex: 1, dayLabel: "Martes", rowId: "row-martes-1" });

    const weekly = makeRoutine({
      title: "Rutina semanal",
      routineMode: "weekly",
      description: JSON.stringify({
        v: 1,
        text: "Rutina semanal",
        mode: "weekly",
        days: [
          { id: lunesId, order: 0, weekday: 0, label: "Lunes", kind: "training" },
          { id: "22222222-2222-2222-2222-222222222202", order: 1, weekday: 1, label: "Martes", kind: "training" },
        ],
      }),
      exercises: [lunesEx, martesEx],
    });

    vi.mocked(useRoutines).mockReturnValue({
      routines: [weekly],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);

    renderPageWithSession();

    fireEvent.click(screen.getByText("Entrenar"));
    fireEvent.click(screen.getByText("Lunes"));

    expect(mockStart).toHaveBeenCalledWith({
      routine: { id: "routine-1", title: "Rutina semanal" },
      routineDayId: lunesId,
      dayLabel: "Lunes",
      planned: expect.arrayContaining([
        expect.objectContaining({ exercise: EXERCISE, dayIndex: 0, dayLabel: "Lunes" }),
      ]),
    });
  });

  it("rutina individual con 3 días → selector con 3 días, elegir el 2º inicia con sus ejercicios y routineDayId", () => {
    const dayBId = "33333333-3333-3333-3333-333333333302";
    const exA = makeRoutineExercise({ dayIndex: 0, dayLabel: "Día A", rowId: "row-a-1" });
    const exB = makeRoutineExercise({ dayIndex: 1, dayLabel: "Día B", rowId: "row-b-1" });
    const exC = makeRoutineExercise({ dayIndex: 2, dayLabel: "Día C", rowId: "row-c-1" });

    const individual = makeRoutine({
      title: "Rutina individual 3 días",
      routineMode: "single",
      description: JSON.stringify({
        v: 1,
        text: "Rutina individual",
        mode: "single",
        days: [
          { id: "44444444-4444-4444-4444-444444444400", order: 0, weekday: null, label: "Día A", kind: "training" },
          { id: dayBId, order: 1, weekday: null, label: "Día B", kind: "training" },
          { id: "55555555-5555-5555-5555-555555555503", order: 2, weekday: null, label: "Día C", kind: "training" },
        ],
      }),
      exercises: [exA, exB, exC],
    });

    vi.mocked(useRoutines).mockReturnValue({
      routines: [individual],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);

    renderPageWithSession();

    fireEvent.click(screen.getByText("Entrenar"));

    expect(screen.getByText("Día A")).toBeTruthy();
    expect(screen.getByText("Día B")).toBeTruthy();
    expect(screen.getByText("Día C")).toBeTruthy();

    fireEvent.click(screen.getByText("Día B"));

    expect(mockStart).toHaveBeenCalledWith({
      routine: { id: "routine-1", title: "Rutina individual 3 días" },
      routineDayId: dayBId,
      dayLabel: "Día B",
      planned: expect.arrayContaining([
        expect.objectContaining({ dayIndex: 1, dayLabel: "Día B" }),
      ]),
    });
  });

  it("A25: con sesión activa, clic Entrenar → aviso visible y sin nueva sesión", () => {
    mockIsActive.value = true;

    const single = makeRoutine({
      title: "Rutina individual",
      routineMode: "single",
      exercises: [makeRoutineExercise()],
    });

    vi.mocked(useRoutines).mockReturnValue({
      routines: [single],
      loading: false,
      error: null,
      refresh: vi.fn(),
      toggleFavorite: vi.fn(),
      pendingIds: new Set(),
    } as never);

    renderPageWithSession();

    fireEvent.click(screen.getByText("Entrenar"));

    expect(screen.getByText(/Ya hay una sesión activa/)).toBeTruthy();
    expect(mockStart).not.toHaveBeenCalled();
  });
});
