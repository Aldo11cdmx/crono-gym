/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { RoutineEditor } from "./RoutineEditor";
import type { Exercise } from "@/types/supabase";
import type { PlannedExercise, RoutineWithExercises } from "@/hooks/useGymData";
import { saveRoutine, flushSave } from "@/lib/routines/saveRoutine";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const OUTLET_CONTEXT: WorkspaceOutletContext = {
  userId: "user-1",
  email: "user@example.com",
};

vi.mock("@/lib/routines/saveRoutine", () => ({
  saveRoutine: vi.fn(),
  flushSave: vi.fn().mockResolvedValue(true),
  duplicateRoutine: vi.fn((draft: unknown, title: string) => ({ ...(draft as object), title })),
}));

function ex(id: string): Exercise {
  return {
    id,
    name: "Ejercicio " + id,
    name_es: "Ejercicio " + id,
    body_part: "Pecho",
    target: "Pecho",
    equipment: "Mancuernas",
    gif_url: "",
    instructions: [],
    is_active: true,
    is_hidden: false,
  } as unknown as Exercise;
}

function makeRoutineWithExercise(): RoutineWithExercises {
  return {
    id: "routine-1",
    user_id: "user-1",
    title: "Rutina válida",
    description: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    exercises: [
      {
        exercise: ex("ex-1"),
        target_sets: 3,
        rest_seconds: 90,
        rowId: "row-1",
        order_index: 0,
        target_reps_min: 8,
        target_reps_max: 12,
        dayIndex: 0,
        dayLabel: "",
      } as unknown as PlannedExercise,
    ],
  } as unknown as RoutineWithExercises;
}

function renderEditor(routine?: RoutineWithExercises, initialPlanMode?: "single" | "weekly" | "split") {
  return render(
    <MemoryRouter initialEntries={["/rutinas"]}>
      <Routes>
        <Route path="/rutinas" element={<Outlet context={OUTLET_CONTEXT} />}>
          <Route
            index
            element={
              <RoutineEditor
                mode={routine ? "edit" : "new"}
                routine={routine}
                initialPlanMode={initialPlanMode}
                onSave={vi.fn()}
                onClose={vi.fn()}
              />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoutineEditor (Apple HIG)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renderiza header minimalista (Cancelar/Nueva Rutina/Guardar) e input de nombre", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    expect(screen.getByText("Nueva Rutina")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar rutina" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Nombre de tu rutina")).toBeTruthy();
  });

  it("modo single muestra fila Añadir ejercicio (iOS)", () => {
    renderEditor(undefined, "single");
    expect(screen.getByText(/^Ejercicios$/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Añadir ejercicio" })).toBeTruthy();
  });

  it("modo weekly (hint split->weekly) muestra lista de 7 días sin toggle de plan", () => {
    renderEditor(undefined, "split");
    expect(screen.getByText("Plan Semanal")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Lunes/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Domingo/ })).toBeTruthy();
    expect(screen.queryByText("Tipo de plan")).toBeNull();
    expect(screen.queryByRole("button", { name: "Plan individual" })).toBeNull();
  });

  it("navega a subpantalla de día y vuelve con Listo/Volver", () => {
    renderEditor(undefined, "weekly");
    fireEvent.click(screen.getByRole("button", { name: /Lunes/ }));
    expect(screen.getByRole("button", { name: "Volver" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Listo" })).toBeTruthy();
    expect(screen.getByText("Añadir ejercicios a Lunes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(screen.getByText("Plan Semanal")).toBeTruthy();
  });

  it("muestra aviso al cerrar con cambios sin guardar", () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText("Nombre de tu rutina"), { target: { value: "Rutina modificada" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Tienes cambios sin guardar")).toBeTruthy();
    expect(screen.getByText("Guardar y salir")).toBeTruthy();
    expect(screen.getByText("Descartar cambios")).toBeTruthy();
  });

  it("llama a saveRoutine con origin editor al guardar una rutina válida", async () => {
    vi.mocked(saveRoutine).mockResolvedValue({ ok: true, routineId: "test-id" });
    renderEditor(makeRoutineWithExercise());
    const saveButton = screen.getByRole("button", { name: "Guardar rutina" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveButton);
    await vi.waitFor(() => expect(saveRoutine).toHaveBeenCalled());
    expect(vi.mocked(saveRoutine).mock.calls[0][2]).toBe("editor");
    expect(flushSave).toHaveBeenCalled();
  });

  it("habilita Guardar cuando hay ejercicios aunque el nombre sea corto (asigna título por defecto)", async () => {
    vi.mocked(saveRoutine).mockResolvedValue({ ok: true, routineId: "test-id" });
    renderEditor(makeRoutineWithExercise());
    fireEvent.change(screen.getByPlaceholderText("Nombre de tu rutina"), { target: { value: "x" } });
    const saveButton = screen.getByRole("button", { name: "Guardar rutina" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveButton);
    await vi.waitFor(() => expect(saveRoutine).toHaveBeenCalled());
    const savedDraft = vi.mocked(saveRoutine).mock.calls[0][1] as { title: string };
    expect(savedDraft.title).toBe("Nueva Rutina");
  });
});
