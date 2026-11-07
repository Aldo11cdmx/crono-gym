/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { RoutineCard } from "./RoutineCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";

vi.mock("@/hooks/useGymData", () => ({
  useRoutines: vi.fn(),
}));

const OUTLET_CONTEXT: WorkspaceOutletContext = {
  userId: "user-1",
  email: "user@example.com",
};

function makeRoutine(title: string, description: string, routineMode: "single" | "weekly" | "legacy" = "single"): RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" } {
  return {
    id: "routine-1",
    user_id: "user-1",
    title,
    description,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    exercises: [],
    routineMode,
  } as unknown as RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" };
}

function renderCard(routine: RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" }) {
  return render(
    <MemoryRouter initialEntries={["/rutinas"]}>
      <Routes>
        <Route
          path="/rutinas"
          element={<Outlet context={OUTLET_CONTEXT} />}
        >
          <Route
            index
            element={
              <RoutineCard
                routine={routine}
                onTrain={vi.fn()}
                onEdit={vi.fn()}
              />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoutineCard — C3 descripción en texto plano", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra texto plano, no el sobre JSON, en la descripción", () => {
    const routine = makeRoutine(
      "Fuerza 4 días",
      "Rutina de fuerza para hipertrofia",
    );
    renderCard(routine);

    // Debería mostrar el texto plano, no el JSON crudo
    expect(screen.getByText("Rutina de fuerza para hipertrofia")).toBeTruthy();
    expect(screen.queryByText(/{"v":1/)).toBeNull();
    expect(screen.queryByText(/text:/)).toBeNull();
  });

  it("muestra descripción vacía cuando no hay descripción", () => {
    const routine = makeRoutine("Sin desc", "");
    renderCard(routine);
    expect(screen.queryByText("Sin desc")).toBeTruthy();
    expect(screen.queryByText("Rutina de fuerza para hipertrofia")).toBeNull();
  });

  it("muestra el título de la rutina", () => {
    const routine = makeRoutine("Mi rutina", "desc");
    renderCard(routine);
    expect(screen.getByText("Mi rutina")).toBeTruthy();
  });
});

describe("RoutineCard — Entrenar deshabilitado hasta E5", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("el botón Entrenar está deshabilitado", () => {
    const routine = makeRoutine("Rutina", "desc");
    renderCard(routine);

    const trainButton = screen.getByRole("button", { name: /Entrenar/ });
    expect(trainButton.hasAttribute("disabled")).toBe(true);
  });

  it("el botón favorito está deshabilitado", () => {
    const routine = makeRoutine("Rutina", "desc");
    renderCard(routine);

    const favButton = screen.getByRole("button", { name: /Favoritos/ });
    expect(favButton.hasAttribute("disabled")).toBe(true);
  });
});
