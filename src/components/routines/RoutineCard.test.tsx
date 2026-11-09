/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { RoutineCard } from "./RoutineCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";

const OUTLET_CONTEXT: WorkspaceOutletContext = {
  userId: "user-1",
  email: "user@example.com",
};

type CardRoutine = RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" };

function makeRoutine(
  title: string,
  routineMode: "single" | "weekly" | "legacy" = "single",
  description = "desc",
): CardRoutine {
  return {
    id: "routine-1",
    user_id: "user-1",
    title,
    description,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    exercises: [],
    routineMode,
  } as unknown as CardRoutine;
}

function renderCard(routine: CardRoutine) {
  return render(
    <MemoryRouter initialEntries={["/rutinas"]}>
      <Routes>
        <Route path="/rutinas" element={<Outlet context={OUTLET_CONTEXT} />}>
          <Route
            index
            element={<RoutineCard routine={routine} onTrain={vi.fn()} onEdit={vi.fn()} />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoutineCard — Bloque 1", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra el título y no expone JSON crudo del bridge", () => {
    renderCard(makeRoutine("Fuerza 4 días", "single", "Rutina de fuerza"));
    expect(screen.getByText("Fuerza 4 días")).toBeTruthy();
    expect(screen.queryByText(/{"v":1/)).toBeNull();
  });

  it("habilita Iniciar Entreno para una rutina completa", () => {
    const routine = makeRoutine("Rutina", "single");
    (routine as unknown as { exercises: unknown[] }).exercises = [
      {
        rowId: "r1",
        exercise: { id: "ex-1", name: "Sentadilla", body_part: "upper legs", target: "quads", equipment: "barbell" },
        target_sets: 3,
        rest_seconds: 90,
        order_index: 0,
        target_reps_min: 8,
        target_reps_max: 12,
        dayIndex: 0,
        dayLabel: "",
      },
    ];
    renderCard(routine);
    expect(screen.getByRole("button", { name: "Iniciar Entreno" }).hasAttribute("disabled")).toBe(false);
  });

  it("deshabilita Iniciar Entreno para una rutina incompleta", () => {
    renderCard(makeRoutine("Rutina incompleta", "single", '{"v":1,"mode":"single","days":[]}'));
    expect(screen.getByRole("button", { name: "Iniciar Entreno" }).hasAttribute("disabled")).toBe(true);
  });

  it("expone botón de opciones", () => {
    renderCard(makeRoutine("Rutina"));
    expect(screen.getByRole("button", { name: "Opciones" })).toBeTruthy();
  });
});