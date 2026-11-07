/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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
  displayDayLabel,
  swapDayContents,
  exercisesForDay,
} from "@/lib/routines/routineDayModel";

vi.mock("@/lib/routines/saveRoutine", () => ({
  saveRoutine: vi.fn(),
  flushSave: vi.fn().mockResolvedValue(true),
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

let uuidCounter = 0;
function testUuid(): string {
  uuidCounter += 1;
  const hex = uuidCounter.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
const EXERCISE_2: Exercise = {
  id: "ex-0002",
  name: "Sentadilla",
  body_part: "legs",
  target: "quadriceps",
  equipment: "barra",
  gif_url: "",
  instructions: [],
  name_es: null,
  is_active: true,
  is_hidden: false,
};

function weekMeta(days: { order: number; weekday: number; label: string; kind: "training" | "rest" | "mobility" | "empty" }[]): string {
  return JSON.stringify({
    v: 1,
    text: "",
    mode: "weekly",
    days,
  });
}

function makeWeeklyRoutine(
  title: string,
  dayExercises: { order: number; weekday: number; exercises: Exercise[] }[],
): RoutineWithExercises {
  const metaDays = dayExercises.map((de): { id: string; order: number; weekday: number; label: string; kind: "training" | "rest" } => ({
    id: testUuid(),
    order: de.order,
    weekday: de.weekday,
    label: "",
    kind: "training",
  }));
  // Rellenar los 7 días: días sin ejercicios van como rest
  const allOrders = new Set(metaDays.map((d) => d.order));
  for (let o = 0; o < 7; o += 1) {
    if (!allOrders.has(o)) {
      metaDays.push({ id: testUuid(), order: o, weekday: o, label: "", kind: "rest" });
    }
  }
  const exercises = dayExercises.flatMap(({ order, exercises: exs }) =>
    exs.map((ex, idx) => ({
      exercise: ex,
      rowId: `row-${order}-${idx}`,
      target_sets: 3,
      rest_seconds: 90,
      order_index: idx,
      target_reps_min: null,
      target_reps_max: null,
      dayIndex: order,
      dayLabel: "",
    })),
  );
  return {
    id: "routine-1",
    user_id: "user-1",
    title,
    description: weekMeta(metaDays),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    exercises,
  } as unknown as RoutineWithExercises;
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
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra los 7 días de la semana con nombre", () => {
    const routine = makeWeeklyRoutine("Rutina semanal", [
      { order: 0, weekday: 0, exercises: [EXERCISE] },
    ]);
    renderPlanner(routine);

    const lunes = screen.getAllByText("Lunes");
    const domingo = screen.getAllByText("Domingo");

    expect(lunes.length).toBeGreaterThan(0);
    expect(domingo.length).toBeGreaterThan(0);
  });

  // --- A2: marcar Jueves como descanso mueve su sesión al destino y se guarda correctamente ---
  it("A2: marcar Jueves como descanso mueve la sesión al destino y se guarda", () => {
    const routine = makeWeeklyRoutine("Rutina semanal", [
      { order: 0, weekday: 0, exercises: [EXERCISE] }, // Lunes
      { order: 1, weekday: 1, exercises: [EXERCISE] }, // Martes
      { order: 2, weekday: 2, exercises: [EXERCISE] }, // Miércoles
      { order: 3, weekday: 3, exercises: [EXERCISE] }, // Jueves (training → marcar descanso)
    ]);
    renderPlanner(routine);

    // Hacer clic en "Marcar descanso" de Jueves (índice 3: Lunes=0, Martes=1, Miércoles=2, Jueves=3)
    const moonButtons = screen.getAllByRole("button", { name: "Marcar descanso" });
    const juevesMoon = moonButtons[3];
    fireEvent.click(juevesMoon);

    // Se abre el diálogo de destino. Sábado (weekday 5) es rest por defecto → destino sugerido.
    const sabadoBtn = screen.getByRole("button", { name: /Mover a Sábado/ });
    fireEvent.click(sabadoBtn);

    // Guardar
    const saveButton = screen.getByRole("button", { name: /Guardar plan semanal/ });
    fireEvent.click(saveButton);

    expect(saveRoutine).toHaveBeenCalled();
    const call = vi.mocked(saveRoutine).mock.calls[0];
    const draft = call[1];
    expect(draft.mode).toBe("weekly");

    const jueves = draft.days.find((d) => d.weekday === 3);
    const sabado = draft.days.find((d) => d.weekday === 5);
    expect(jueves?.kind).toBe("rest");
    expect(jueves?.exercises).toHaveLength(0);
    expect(sabado?.kind).toBe("training");
    expect(sabado?.exercises).toHaveLength(1);
    expect(sabado?.exercises[0].exercise.id).toBe("ex-0001");
    expect(draft.snapshot).not.toBeNull();
  });

  // --- A3: swap Miércoles/Jueves con swapDayContents real ---
  it("A3: intercambiar Miércoles y Jueves preserva el contenido y los ids de día", () => {
    const routine = makeWeeklyRoutine("Rutina semanal", [
      { order: 2, weekday: 2, exercises: [EXERCISE] },   // Miércoles
      { order: 3, weekday: 3, exercises: [EXERCISE_2] }, // Jueves
    ]);
    renderPlanner(routine);

    // Verificar swapDayContents real conserva ids
    const loaded = draftFromRoutine(routine);
    const lunesId = loaded.days.find((d) => d.weekday === 0)!.id;
    const miercolesId = loaded.days.find((d) => d.weekday === 2)!.id;
    const juevesId = loaded.days.find((d) => d.weekday === 3)!.id;

    const swapped = swapDayContents(loaded.days, 2, 3);
    // swapDayContents conserva id y weekday en su posición, intercambia solo contenido
    expect(swapped.find((d) => d.weekday === 2)!.id).toBe(miercolesId);
    expect(swapped.find((d) => d.weekday === 3)!.id).toBe(juevesId);
    expect(swapped.find((d) => d.weekday === 2)!.exercises).toHaveLength(1);
    expect(swapped.find((d) => d.weekday === 2)!.exercises[0].exercise.id).toBe("ex-0002");
    expect(swapped.find((d) => d.weekday === 3)!.exercises).toHaveLength(1);
    expect(swapped.find((d) => d.weekday === 3)!.exercises[0].exercise.id).toBe("ex-0001");
    expect(swapped.find((d) => d.weekday === 0)!.id).toBe(lunesId);
  });

  // --- A5: dos rutinas con sesión el Lunes, cada una muestra su propia etiqueta ---
  it("A5: dos planners de rutinas distintas con sesión el Lunes no se pisan", () => {
    const routineA = makeWeeklyRoutine("Rutina A", [{ order: 0, weekday: 0, exercises: [EXERCISE] }]);
    const routineB = makeWeeklyRoutine("Rutina B", [{ order: 0, weekday: 0, exercises: [EXERCISE_2] }]);

    const draftA = draftFromRoutine(routineA);
    const draftB = draftFromRoutine(routineB);

    const lunesA = draftA.days.find((d) => d.weekday === 0)!;
    const lunesB = draftB.days.find((d) => d.weekday === 0)!;

    expect(lunesA.exercises).toHaveLength(1);
    expect(lunesA.exercises[0].exercise.id).toBe("ex-0001");
    expect(lunesB.exercises).toHaveLength(1);
    expect(lunesB.exercises[0].exercise.id).toBe("ex-0002");
    expect(draftA.draftKey).not.toBe(draftB.draftKey);
  });

  // --- A8: suma de ejercicios de los 7 días = total real ---
  it("A8: la suma de ejercicios de los 7 días del borrador es el total real", () => {
    const routine = makeWeeklyRoutine("Rutina 3 días", [
      { order: 0, weekday: 0, exercises: [EXERCISE, EXERCISE_2] },
      { order: 2, weekday: 2, exercises: [EXERCISE] },
      { order: 4, weekday: 4, exercises: [EXERCISE] },
    ]);
    const draft = draftFromRoutine(routine);

    const total = draft.days.reduce((sum, d) => sum + d.exercises.length, 0);
    expect(total).toBe(4);
    expect(exercisesForDay(draft, 0)).toHaveLength(2);
    expect(exercisesForDay(draft, 2)).toHaveLength(1);
    expect(exercisesForDay(draft, 4)).toHaveLength(1);
    expect(exercisesForDay(draft, 1)).toHaveLength(0);
    expect(exercisesForDay(draft, 6)).toHaveLength(0);
  });

  // --- A11: 7 días en descanso → guardar deshabilitado + mensaje ---
  it("A11: plan sin ningún día de entrenamiento → botón guardar deshabilitado", () => {
    // 7 días todos en descanso (sin ejercicios)
    const allRestMeta = Array.from({ length: 7 }, (_, o) => ({
      id: testUuid(),
      order: o,
      weekday: o,
      label: "",
      kind: "rest" as const,
    }));
    const routine = {
      id: "routine-1",
      user_id: "user-1",
      title: "Rutina descanso",
      description: JSON.stringify({ v: 1, text: "", mode: "weekly", days: allRestMeta }),
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      exercises: [],
    } as unknown as RoutineWithExercises;
    renderPlanner(routine);

    // No hay botón "Marcar descanso" (todos son rest)
    expect(screen.queryAllByRole("button", { name: "Marcar descanso" })).toHaveLength(0);

    const saveButton = screen.getByRole("button", { name: /Guardar plan semanal/ });
    expect(saveButton.hasAttribute("disabled")).toBe(true);

    expect(screen.getByText("El plan necesita al menos un día de entrenamiento.")).toBeTruthy();
  });

  // --- A12: Domingo vacío → "Sin sesión programada" ---
  it("A12: domingo sin nada asignado → muestra 'Sin sesión programada'", () => {
    const routine = makeWeeklyRoutine("Rutina semanal", [
      { order: 0, weekday: 0, exercises: [EXERCISE] }, // Lunes con ejercicio
    ]);
    renderPlanner(routine);

    // Domingo es rest por defecto, no empty. Cambiar a empty para probar A12.
    // Pero como no hay forma directa de cambiar kind a empty desde la UI sin ejercicios,
    // probamos displayDayLabel directamente:
    const emptyDay: any = { kind: "empty", label: "", weekday: 6, order: 6, id: "d6", exercises: [] };
    expect(displayDayLabel(emptyDay, "weekly")).toBe("Sin sesión programada");
  });

  // --- Guardado con origin planner ---
  it("guarda mediante saveRoutine con origin planner", async () => {
    const routine = makeWeeklyRoutine("Rutina semanal", [
      { order: 0, weekday: 0, exercises: [EXERCISE] },
    ]);
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
});
