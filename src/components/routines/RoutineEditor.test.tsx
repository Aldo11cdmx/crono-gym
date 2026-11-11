/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { RoutineEditor } from "./RoutineEditor";
import type { Exercise } from "@/types/supabase";
import { saveRoutine } from "@/lib/routines/saveRoutine";

const OUTLET_CONTEXT: WorkspaceOutletContext = {
  userId: "user-1",
  email: "user@example.com",
};

const MOCK_EXERCISE: Exercise = {
  id: "ex-1",
  name: "Press banca",
  name_es: null,
  body_part: "chest",
  target: "pectorals",
  equipment: "barbell",
  gif_url: "",
  instructions: [],
  is_active: true,
  is_hidden: false,
};

vi.mock("@/lib/routines/saveRoutine", () => ({
  saveRoutine: vi.fn().mockResolvedValue({ ok: true, routineId: "routine-1" }),
  flushSave: vi.fn().mockResolvedValue(true),
  subscribeSave: vi.fn(() => () => {}),
}));

vi.mock("@/lib/catalog/catalogLoader", () => ({
  loadCatalog: () => Promise.resolve([]),
}));

vi.mock("@/components/UnifiedExerciseSelectorSheet", () => ({
  UnifiedExerciseSelectorSheet: vi.fn(({
    onSelectMultiple,
    onClose,
  }: any) => {
    return (
      <div data-testid="mock-selector">
        <button
          data-testid="selector-confirm"
          onClick={() => {
            onSelectMultiple([MOCK_EXERCISE]);
            onClose();
          }}
        >
          Confirmar selección
        </button>
        <button data-testid="selector-cancel" onClick={onClose}>
          Cancelar
        </button>
      </div>
    );
  }),
}));

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/rutinas"]}>
      <Routes>
        <Route path="/rutinas" element={<Outlet context={OUTLET_CONTEXT} />}>
          <Route index element={<RoutineEditor onClose={vi.fn()} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoutineEditor — guardar", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("guarda en modo individual con título corto ('ff') e invoca saveRoutine", async () => {
    renderEditor();

    // Título corto de 2 caracteres.
    const titleInput = screen.getByPlaceholderText("Nombre de la rutina");
    fireEvent.change(titleInput, { target: { value: "ff" } });

    // Abrir selector y confirmar → agrega ejercicio al día 0.
    fireEvent.click(screen.getByText("Añadir ejercicios a la sesión"));
    await waitFor(() => screen.getByTestId("mock-selector"));
    fireEvent.click(screen.getByTestId("selector-confirm"));

    // Espera a que el ejercicio se refleje en las métricas (canSave pasa a true).
    await waitFor(() => {
      expect(screen.getByText(/1 ejerc./)).toBeTruthy();
    });

    // El selector solo agrega ejercicios; saveRoutine no se llama aún.
    expect(saveRoutine).not.toHaveBeenCalled();

    // Guardar.
    fireEvent.click(screen.getByRole("button", { name: /Guardar rutina/ }));
    await waitFor(() => expect(saveRoutine).toHaveBeenCalledTimes(1));

    const call = vi.mocked(saveRoutine).mock.calls[0];
    expect(call[0]).toBe("user-1");
    expect(call[1].title).toBe("ff");
    expect(call[1].mode).toBe("single");
    expect(call[1].days).toHaveLength(1);
    expect(call[1].days[0].kind).toBe("training");
    expect(call[1].days[0].exercises).toHaveLength(1);
  });

  it("guarda ejercicios del martes en modo semanal con kind training y 7 días", async () => {
    renderEditor();

    // Cambiar a modo semanal (es un tab, no un button).
    fireEvent.click(screen.getByRole("tab", { name: "Semanal" }));

    // Espera a que se garanticen los 7 días del carrusel semanal (filtrar pestañas de día, no de modo).
    await waitFor(() => {
      const dayTabs = screen.getAllByRole("tab").filter(t => t.getAttribute("aria-label"));
      expect(dayTabs).toHaveLength(7);
    });

    // Seleccionar martes (índice 1 del carrusel de días, excluyendo pestañas de modo).
    const dayTabs = screen.getAllByRole("tab").filter(t => t.getAttribute("aria-label"));
    fireEvent.click(dayTabs[1]);
    await waitFor(() => {
      const updated = screen.getAllByRole("tab").filter(t => t.getAttribute("aria-label"));
      expect(updated[1].getAttribute("aria-selected")).toBe("true");
    });

    // Abrir selector y confirmar → agrega ejercicio al día martes.
    fireEvent.click(screen.getByText("Añadir ejercicios a la sesión"));
    await waitFor(() => screen.getByTestId("mock-selector"));
    fireEvent.click(screen.getByTestId("selector-confirm"));

    // Espera a que el botón guardar se habilite.
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Guardar rutina/ });
      expect(btn.getAttribute("disabled")).toBeNull();
    });

    expect(saveRoutine).not.toHaveBeenCalled();

    // Guardar.
    fireEvent.click(screen.getByRole("button", { name: /Guardar rutina/ }));
    await waitFor(() => expect(saveRoutine).toHaveBeenCalledTimes(1));

    const call = vi.mocked(saveRoutine).mock.calls[0];
    const draft = call[1];
    expect(call[0]).toBe("user-1");
    expect(draft.title).toBe("Plan Semanal"); // fallback por título vacío
    expect(draft.mode).toBe("weekly");
    expect(draft.days).toHaveLength(7);

    const martes = draft.days[1];
    expect(martes.weekday).toBe(1);
    expect(martes.kind).toBe("training");
    expect(martes.exercises).toHaveLength(1);
    expect(martes.exercises[0].exercise.id).toBe("ex-1");
  });
});
