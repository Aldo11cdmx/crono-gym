/**
 * @vitest-environment jsdom
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";import type { WorkspaceOutletContext } from "@/App";
import { RoutineEditor } from "./RoutineEditor";
import type { Exercise } from "@/types/supabase";
import type { PlannedExercise, RoutineWithExercises } from "@/hooks/useGymData";
import {
  saveRoutine,
  flushSave,
} from "@/lib/routines/saveRoutine";

const errors: string[] = [];
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    errors.push(args.join(" "));
  };
});

afterAll(() => {
  console.error = originalError;
  if (errors.length > 0) {
    console.log("CAPTURED ERRORS:", errors);
  }
});

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
  duplicateRoutine: vi.fn((draft: any, title: string) => ({ ...draft, title })),
}));

vi.mock("@/components/UnifiedExerciseSelectorSheet", () => {
  const mockExercise: Exercise = {
    id: "selector-ex",
    name: "Ejercicio selector",
    name_es: "Ejercicio selector",
    body_part: "Pecho",
    target: "Pecho",
    equipment: "Mancuernas",
    gif_url: "",
    instructions: [],
    is_active: true,
    is_hidden: false,
  } as unknown as Exercise;
  return {
    UnifiedExerciseSelectorSheet: ({
      onClose,
      onSelectSingle,
    }: any) => (
      <div data-testid="selector-sheet-mock">
        <button onClick={onClose}>Cerrar selector</button>
        <button
          onClick={() => onSelectSingle(mockExercise)}
        >
          Seleccionar ejercicio
        </button>
      </div>
    ),
  };
});

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
        target_reps_min: null,
        target_reps_max: null,
        dayIndex: 0,
        dayLabel: "",
      } as unknown as PlannedExercise,
    ],
  } as unknown as RoutineWithExercises;
}

function renderEditor(routine?: RoutineWithExercises) {
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
              <RoutineEditor
                mode={routine ? "edit" : "new"}
                routine={routine}
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

describe("RoutineEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the title input", () => {
    renderEditor();
    expect(screen.getByPlaceholderText("Mi rutina de 4 días")).toBeTruthy();
  });

  describe("A1 validaciones en español", () => {
    it("muestra mensaje de título demasiado corto", () => {
      renderEditor();
      const input = screen.getByPlaceholderText("Mi rutina de 4 días");
      fireEvent.change(input, { target: { value: "ab" } });
      const error = screen.getByText(/El nombre debe tener al menos 3 caracteres/);
      expect(error).toBeTruthy();
    });

    it("muestra mensaje cuando falta el nombre", () => {
      renderEditor();
      const input = screen.getByPlaceholderText("Mi rutina de 4 días");
      fireEvent.change(input, { target: { value: "" } });
      const error = screen.getByText(/Ponle un nombre a la rutina/);
      expect(error).toBeTruthy();
    });

    it("muestra mensaje cuando no hay días con ejercicios", () => {
      renderEditor();
      const input = screen.getByPlaceholderText("Mi rutina de 4 días");
      fireEvent.change(input, { target: { value: "Rutina válida" } });
      const error = screen.getByText(/Añade al menos un día/);
      expect(error).toBeTruthy();
    });
  });

  describe("A10 etiqueta y tipo de día", () => {
    it("permite editar la etiqueta del día", () => {
      renderEditor();
      const addDay = screen.getByRole("button", { name: /entrenamiento/ });
      fireEvent.click(addDay);
      const labelInput = screen.getAllByPlaceholderText(/Día \d/)[0];
      fireEvent.change(labelInput, { target: { value: "Pecho y espalda" } });
      expect(screen.getByText("Pecho y espalda")).toBeTruthy();
    });
  });

  describe("A28 etiquetas Día A/B/C", () => {
    it("muestra Día A para el primer día de entrenamiento sin nombre", () => {
      renderEditor();
      const addDay = screen.getByRole("button", { name: /entrenamiento/ });
      fireEvent.click(addDay);
      expect(screen.getByText("Día A")).toBeTruthy();
    });
  });

  describe("A19 aviso de cambios sin guardar", () => {
    it("muestra aviso al cerrar con cambios sin guardar", () => {
      renderEditor();
      const titleInput = screen.getByPlaceholderText("Mi rutina de 4 días");
      fireEvent.change(titleInput, { target: { value: "Rutina modificada" } });
      const closeButton = screen.getByRole("button", { name: /Cerrar editor/ });
      fireEvent.click(closeButton);
      expect(screen.getByText("Tienes cambios sin guardar")).toBeTruthy();
      expect(screen.getByText("Guardar y salir")).toBeTruthy();
      expect(screen.getByText("Descartar cambios")).toBeTruthy();
      expect(screen.getByText("Cancelar")).toBeTruthy();
    });

    it("no muestra aviso al cerrar sin cambios", () => {
      renderEditor();
      const closeButton = screen.getByRole("button", { name: /Cerrar editor/ });
      fireEvent.click(closeButton);
      expect(screen.queryByText("Tienes cambios sin guardar")).toBeNull();
    });
  });

  describe("guardado", () => {
    it("llama a saveRoutine con origin editor", async () => {
      vi.mocked(saveRoutine).mockResolvedValue({ ok: true, routineId: "test-id" });
      renderEditor(makeRoutineWithExercise());
      const saveButton = screen.getByRole("button", { name: /Guardar rutina/ });
      expect(saveButton.hasAttribute("disabled")).toBe(false);
      fireEvent.click(saveButton);
      await vi.waitFor(() => {
        expect(saveRoutine).toHaveBeenCalled();
      });
      const call = vi.mocked(saveRoutine).mock.calls[0];
      expect(call[2]).toBe("editor");
      expect(flushSave).toHaveBeenCalled();
    });

    it("duplica la rutina", () => {
      const routine: RoutineWithExercises = {
        id: "routine-1",
        user_id: "user-1",
        title: "Original",
        description: "desc",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        exercises: [],
      } as unknown as RoutineWithExercises;
      renderEditor(routine);
      const addDay = screen.getByRole("button", { name: /entrenamiento/ });
      fireEvent.click(addDay);
      const titleInput = screen.getByPlaceholderText("Mi rutina de 4 días");
      fireEvent.change(titleInput, { target: { value: "Rutina para duplicar" } });
      const dupButton = screen.getByRole("button", { name: "Duplicar rutina" });
      fireEvent.click(dupButton);
      const newTitleInput = screen.getAllByPlaceholderText("Mi rutina de 4 días")[0];
      expect((newTitleInput as HTMLInputElement).value).toBe("copia de Rutina para duplicar");
    });
  });
});
