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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExerciseSelectorModal } from "./ExerciseSelectorModal";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import type { CatalogExercise } from "@/lib/catalog/types";

vi.mock("@/lib/catalog/catalogLoader", () => ({
  loadCatalog: vi.fn(),
}));

const loadCatalogMock = vi.mocked(loadCatalog);

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
    fireEvent.change(screen.getByPlaceholderText("Buscar ejercicio…"), {
      target: { value: "zanca" },
    });

    expect(screen.getByText("Zancada")).toBeDefined();
    expect(screen.queryByText("Sentadilla")).toBeNull();
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
    fireEvent.change(screen.getByPlaceholderText("Buscar ejercicio…"), {
      target: { value: "muneca" },
    });

    expect(screen.getByText("Curl de muñeca con banda")).toBeDefined();
    expect(screen.queryByText("Press de banca con barra")).toBeNull();
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
});
