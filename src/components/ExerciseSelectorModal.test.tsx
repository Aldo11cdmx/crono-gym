/**
 * @vitest-environment jsdom
 *
 * ExerciseSelectorModal.test.tsx — the picker no longer owns the catalog.
 *
 * The catalog used to be a static import: 16.3 MB of JSON inside the entry
 * bundle, downloaded before the first paint of a screen most sessions never
 * open. Now it is fetched on demand, so the modal has states that did not
 * exist before — loading, failed, retry — and the assertions here pin those
 * states down, because a picker that silently shows nothing when the fetch
 * fails is indistinguishable from a picker with no results.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExerciseSelectorModal } from "./ExerciseSelectorModal";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import { hapticSuccess } from "@/lib/haptics";
import type { CatalogExercise } from "@/lib/catalog/types";

vi.mock("@/lib/catalog/catalogLoader", () => ({
  loadCatalog: vi.fn(),
}));
vi.mock("@/lib/haptics", () => ({ hapticSuccess: vi.fn() }));

const loadCatalogMock = vi.mocked(loadCatalog);
const hapticSuccessMock = vi.mocked(hapticSuccess);

function row(id: string, name: string, availableInCronosGym = true): CatalogExercise {
  return {
    id,
    name,
    category: "upper legs",
    body_part: "upper legs",
    equipment: "barbell",
    gif_url: `videos/${id}.gif`,
    image: `images/${id}.jpg`,
    muscle_group: "quadriceps",
    secondary_muscles: [],
    target: "quads",
    availableInCronosGym,
    instructions: { es: "Apártate" },
    instruction_steps: { es: ["Apártate"] },
    media_id: "abc",
    created_at: "2024-01-01",
    attribution: null,
  };
}

const CATALOG = [row("1", "Sentadilla"), row("2", "Peso muerto", false), row("3", "Zancada")];

beforeEach(() => {
  loadCatalogMock.mockReset();
  loadCatalogMock.mockResolvedValue(CATALOG);
  hapticSuccessMock.mockReset();
  window.localStorage.clear();
});

afterEach(cleanup);

describe("ExerciseSelectorModal", () => {
  it("muestra el estado de carga mientras descarga el catálogo", () => {
    loadCatalogMock.mockReturnValue(new Promise(() => undefined));

    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);

    expect(screen.getByText("Cargando catálogo…")).toBeDefined();
  });

  it("lista los ejercicios del catálogo una vez descargado", async () => {
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);

    expect(await screen.findByText("Sentadilla")).toBeDefined();
    expect(screen.getByText("Zancada")).toBeDefined();
  });

  it("oculta por defecto los ejercicios que no están en Cronos Gym", async () => {
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);

    expect(await screen.findByText("Sentadilla")).toBeDefined();
    expect(screen.queryByText("Peso muerto")).toBeNull();
  });

  it("muestra los ejercicios no disponibles al desactivar el filtro", async () => {
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);

    await screen.findByText("Sentadilla");
    fireEvent.click(screen.getByLabelText("Solo Cronos Gym"));

    expect(screen.getByText("Peso muerto")).toBeDefined();
  });

  it("filtra por nombre con el buscador", async () => {
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);

    await screen.findByText("Sentadilla");

    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByPlaceholderText("Buscar ejercicio…"), {
        target: { value: "zanca" },
      });

    // El input reacciona, pero el filtrado espera el debounce.
    expect(screen.queryByText("Sentadilla")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByText("Zancada")).toBeDefined();
    expect(screen.queryByText("Sentadilla")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

  it("muestra el nombre en español del ejercicio del catálogo", async () => {
    loadCatalogMock.mockResolvedValue([row("4", "band wrist curl")]);
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);

    expect(await screen.findByText("Curl de muñeca con banda")).toBeDefined();
  });

  it("filtra por el nombre en español que muestra la tarjeta", async () => {
    loadCatalogMock.mockResolvedValue([
      row("4", "band wrist curl"),
      row("5", "barbell bench press"),
    ]);
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);

    await screen.findByText("Curl de muñeca con banda");

    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByPlaceholderText("Buscar ejercicio…"), {
        target: { value: "muneca" },
      });
      expect(screen.queryByText("Press de banca con barra")).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.getByText("Curl de muñeca con banda")).toBeDefined();
      expect(screen.queryByText("Press de banca con barra")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("entrega el ejercicio elegido al pulsar una tarjeta", async () => {
    const onSelect = vi.fn();
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={onSelect} />);

    const option = await screen.findByRole("option", { name: "Sentadilla" });
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("1");
  });

  it("muestra el error y permite reintentar cuando la descarga falla", async () => {
    loadCatalogMock.mockRejectedValueOnce(new Error("HTTP 500 al cargar el catálogo"));
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);

    expect(await screen.findByText("HTTP 500 al cargar el catálogo")).toBeDefined();

    fireEvent.click(screen.getByText("Reintentar"));

    expect(await screen.findByText("Sentadilla")).toBeDefined();
    expect(loadCatalogMock).toHaveBeenCalledTimes(2);
  });

  it("diferra el filtrado ~150 ms sin bloquear el input", async () => {
    render(<ExerciseSelectorModal open onClose={() => undefined} onSelect={() => undefined} />);
    await screen.findByText("Sentadilla");

    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByPlaceholderText("Buscar ejercicio…"), {
        target: { value: "zanca" },
      });
      // El input reacciona, pero el filtrado aún no se ha disparado.
      expect(screen.queryByText("Sentadilla")).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.getByText("Zancada")).toBeDefined();
      expect(screen.queryByText("Sentadilla")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("muestra los ejercicios frecuentes de localStorage y los selecciona al tocar", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    window.localStorage.setItem("frequent_exercises", JSON.stringify(["1", "3"]));
    render(<ExerciseSelectorModal open onClose={onClose} onSelect={onSelect} />);

    await screen.findByText("Frecuentes");
    const chip = screen.getByRole("button", { name: "Sentadilla" });
    fireEvent.click(chip);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("multi-selección agrega el lote seleccionado con un clic y háptica", async () => {
    const onSelect = vi.fn();
    const onSelectMultiple = vi.fn();
    const onClose = vi.fn();
    render(
      <ExerciseSelectorModal
        open
        onClose={onClose}
        onSelect={onSelect}
        onSelectMultiple={onSelectMultiple}
      />,
    );
    await screen.findByText("Sentadilla");

    fireEvent.click(screen.getByLabelText("Activar la multi-selección"));
    expect(screen.getByLabelText("Desactivar la multi-selección")).toBeDefined();

    fireEvent.click(await screen.findByRole("option", { name: "Sentadilla" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar ejercicio…"), {
      target: { value: "zanca" },
    });
    await waitFor(() => expect(screen.getByText("Zancada")).toBeDefined());
    fireEvent.click(await screen.findByRole("option", { name: "Zancada" }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("Agregar 2 ejercicios")).toBeDefined();

    fireEvent.click(screen.getByText("Agregar 2 ejercicios"));

    expect(onSelectMultiple).toHaveBeenCalledTimes(1);
    expect(onSelectMultiple.mock.calls[0][0].map((e: CatalogExercise) => e.id)).toEqual([
      "1",
      "3",
    ]);
    expect(hapticSuccessMock).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
