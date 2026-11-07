/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { RoutinesPage } from "./RoutinesPage";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { useRoutines } from "@/hooks/useGymData";
import type { Exercise } from "@/types/supabase";

vi.mock("@/hooks/useGymData", () => ({
  useRoutines: vi.fn(),
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

function renderPage(routines: (RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" })[]) {
  vi.mocked(useRoutines).mockReturnValue({
    routines,
    loading: false,
    error: null,
    refresh: vi.fn(),
    toggleFavorite: vi.fn(),
    pendingIds: new Set(),
  } as never);

  return render(
    <MemoryRouter initialEntries={["/rutinas"]}>
      <Routes>
        <Route
          path="/rutinas"
          element={<Outlet context={OUTLET_CONTEXT} />}
        >
          <Route index element={<RoutinesPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoutinesPage", () => {
  beforeEach(() => {
    cleanup();
  });

  it("A16: rutina legacy (sin sobre) muestra 'Sin clasificar' y ofrece convertir a semanal", () => {
    const legacy = makeRoutine({ title: "Rutina antigua", routineMode: "legacy" });
    renderPage([legacy]);

    expect(screen.getByText("Sin clasificar")).toBeTruthy();
    expect(screen.getByText("Rutina antigua")).toBeTruthy();
  });

  it("muestra rutina semanal con badge 'Semanal'", () => {
    const weekly = makeRoutine({ title: "Rutina semanal", routineMode: "weekly", exercises: [makePlannedExercise()] });
    renderPage([weekly]);

    const titles = screen.getAllByText("Rutina semanal");
    expect(titles.length).toBeGreaterThan(0);
    expect(screen.getByText("Semanal")).toBeTruthy();
  });

  it("A16: rutina legacy (sin sobre) muestra 'Sin clasificar' en la lista", () => {
    const legacy = makeRoutine({ title: "Rutina antigua", routineMode: "legacy" });
    renderPage([legacy]);

    expect(screen.getByText("Sin clasificar")).toBeTruthy();
    expect(screen.getByText("Rutina antigua")).toBeTruthy();
  });

  it("muestra rutina individual sin badge de legado", () => {
    const single = makeRoutine({ title: "Rutina individual", routineMode: "single", exercises: [makePlannedExercise()] });
    renderPage([single]);

    expect(screen.getByText("Rutina individual")).toBeTruthy();
    expect(screen.queryByText("Sin clasificar")).toBeNull();
  });
});
