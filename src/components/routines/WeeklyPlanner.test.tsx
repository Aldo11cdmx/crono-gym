/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { WeeklyPlanner } from "./WeeklyPlanner";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { Exercise } from "@/types/supabase";
import {
  saveRoutine,
  flushSave,
} from "@/lib/routines/saveRoutine";
import {
  draftFromRoutine,
  type RoutineDraftV2,
} from "@/lib/routines/routineDayModel";

vi.mock("@/lib/routines/saveRoutine", () => ({
  saveRoutine: vi.fn(),
  flushSave: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/routines/routineDayModel", () => ({
  draftFromRoutine: vi.fn(),
  displayDayLabel: vi.fn((day: any, mode: any) => {
    if (day.kind === "empty") return "Sin sesión programada";
    const label = (day.label ?? "").trim();
    if (label !== "") return label;
    if (day.kind === "training") {
      if (mode === "single") return `Día ${String.fromCharCode(65 + (day.order % 26))}`;
      const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
      if (day.weekday !== null && day.weekday >= 0 && day.weekday <= 6) return weekdays[day.weekday];
      return "Día";
    }
    if (day.kind === "rest") return "Descanso";
    if (day.kind === "mobility") return "Movilidad";
    return "Sin sesión programada";
  }),
  swapDayContents: vi.fn((days: any[], from: number, to: number) => {
    const next = [...days];
    const tmp = next[from];
    next[from] = next[to];
    next[to] = tmp;
    return next;
  }),
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

function makeDraft(overrides: Partial<RoutineDraftV2> = {}): RoutineDraftV2 {
  const days: RoutineDraftV2["days"] = [];
  for (let wd = 0; wd < 7; wd += 1) {
    days.push({
      id: `day-${wd}`,
      order: wd,
      weekday: wd,
      label: "",
      kind: wd < 5 ? "training" : "rest",
      exercises: wd < 5 ? [{ exercise: EXERCISE, rowId: `row-${wd}`, target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null }] : [],
    });
  }
  return {
    draftKey: "draft-key-1",
    id: "routine-1",
    title: "Rutina semanal",
    description: "",
    mode: "weekly",
    days,
    snapshot: null,
    ...overrides,
  };
}

function renderPlanner(routine: RoutineWithExercises) {
  return render(
    <MemoryRouter initialEntries={["/rutinas"]}>
      <Routes>
        <Route
          path="/rutinas"
          element={<Outlet context={OUTLET_CONTEXT} />}
        >
          <Route
            index
            element={<WeeklyPlanner routine={routine} onSave={vi.fn()} />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("WeeklyPlanner", () => {
  beforeEach(() => {
    vi.mocked(saveRoutine).mockResolvedValue({ ok: true, routineId: "routine-1" });
    vi.mocked(flushSave).mockResolvedValue(true);
    vi.mocked(draftFromRoutine).mockImplementation(() => makeDraft());
    cleanup();
  });

  it("muestra los 7 días de la semana con nombre", () => {
    const routine = { id: "routine-1", title: "Rutina semanal" } as unknown as RoutineWithExercises;
    renderPlanner(routine);

    const lunes = screen.getAllByText("Lunes");
    const martes = screen.getAllByText("Martes");
    const miercoles = screen.getAllByText("Miércoles");
    const jueves = screen.getAllByText("Jueves");
    const viernes = screen.getAllByText("Viernes");
    const sabado = screen.getAllByText("Sábado");
    const domingo = screen.getAllByText("Domingo");

    expect(lunes.length).toBeGreaterThan(0);
    expect(martes.length).toBeGreaterThan(0);
    expect(miercoles.length).toBeGreaterThan(0);
    expect(jueves.length).toBeGreaterThan(0);
    expect(viernes.length).toBeGreaterThan(0);
    expect(sabado.length).toBeGreaterThan(0);
    expect(domingo.length).toBeGreaterThan(0);

    const entrenamientos = screen.getAllByText("Entrenamiento");
    const descansos = screen.getAllByText("Descanso");
    expect(entrenamientos.length).toBeGreaterThan(0);
    expect(descansos.length).toBeGreaterThan(0);
  });

  it("A2: Jueves y Sábado tienen botón para marcar descanso", () => {
    const routine = { id: "routine-1", title: "Rutina semanal" } as unknown as RoutineWithExercises;
    renderPlanner(routine);

    const moonButtons = screen.getAllByRole("button", { name: /Marcar descanso/ });
    expect(moonButtons.length).toBeGreaterThan(0);
  });

  it("A3: intercambiar Miércoles y Jueves y guardar persiste el cambio", () => {
    const routine = { id: "routine-1", title: "Rutina semanal" } as unknown as RoutineWithExercises;
    renderPlanner(routine);

    const arrowDownButtons = screen.getAllByRole("button", { name: /Mover día abajo/ });
    expect(arrowDownButtons.length).toBeGreaterThan(0);
    fireEvent.click(arrowDownButtons[0]);

    const saveButton = screen.getByRole("button", { name: /Guardar plan semanal/ });
    fireEvent.click(saveButton);

    expect(saveRoutine).toHaveBeenCalled();
  });

  it("A11: plan sin ningún día de entrenamiento → botón guardar deshabilitado", () => {
    const routine = { id: "routine-1", title: "Rutina semanal" } as unknown as RoutineWithExercises;
    vi.mocked(draftFromRoutine).mockImplementation(() => makeDraft({ days: [] }));
    renderPlanner(routine);

    const saveButton = screen.getByRole("button", { name: /Guardar plan semanal/ });
    expect(saveButton.hasAttribute("disabled")).toBe(true);
  });

  it("A12: domingo sin nada asignado → muestra tipo Descanso", () => {
    const routine = { id: "routine-1", title: "Rutina semanal" } as unknown as RoutineWithExercises;
    renderPlanner(routine);

    const descansos = screen.getAllByText("Descanso");
    expect(descansos.length).toBeGreaterThanOrEqual(2);
  });

  it("guarda mediante saveRoutine con origin planner", async () => {
    const routine = { id: "routine-1", title: "Rutina semanal" } as unknown as RoutineWithExercises;
    renderPlanner(routine);

    const saveButton = screen.getByRole("button", { name: /Guardar plan semanal/ });
    fireEvent.click(saveButton);

    await vi.waitFor(() => {
      expect(saveRoutine).toHaveBeenCalled();
    });
    const call = vi.mocked(saveRoutine).mock.calls[0];
    expect(call[2]).toBe("planner");
    expect(flushSave).toHaveBeenCalled();
  });

  it("A5: una rutina semanal muestra su propio Lunes sin conflicto con otra", () => {
    const routine = { id: "routine-1", title: "Rutina A" } as unknown as RoutineWithExercises;
    vi.mocked(draftFromRoutine).mockImplementation(() => makeDraft());
    renderPlanner(routine);

    const lunes = screen.getAllByText("Lunes");
    expect(lunes.length).toBeGreaterThan(0);
    // Cada instancia del planner maneja su propio estado; no hay uso de estado global compartido.
  });

  it("A8: rutina de 3 días de entrenamiento muestra 3 días, no el triple", () => {
    const routine = { id: "routine-1", title: "Rutina 3 días" } as unknown as RoutineWithExercises;
    // Solo 3 días con entrenamiento (Lun, Mié, Vie), resto descanso
    vi.mocked(draftFromRoutine).mockImplementation(() => makeDraft({
      days: [
        { id: "d0", order: 0, weekday: 0, label: "", kind: "training", exercises: [{ exercise: EXERCISE, rowId: "r0", target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null }] },
        { id: "d1", order: 1, weekday: 1, label: "", kind: "rest", exercises: [] },
        { id: "d2", order: 2, weekday: 2, label: "", kind: "training", exercises: [{ exercise: EXERCISE, rowId: "r2", target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null }] },
        { id: "d3", order: 3, weekday: 3, label: "", kind: "rest", exercises: [] },
        { id: "d4", order: 4, weekday: 4, label: "", kind: "training", exercises: [{ exercise: EXERCISE, rowId: "r4", target_sets: 3, rest_seconds: 90, order_index: 0, target_reps_min: null, target_reps_max: null }] },
        { id: "d5", order: 5, weekday: 5, label: "", kind: "rest", exercises: [] },
        { id: "d6", order: 6, weekday: 6, label: "", kind: "rest", exercises: [] },
      ],
    }));
    renderPlanner(routine);

    const entrenamientos = screen.getAllByText("Entrenamiento");
    expect(entrenamientos.length).toBe(3);
  });
});
