/**
 * @vitest-environment jsdom
 *
 * ExerciseBrowser.test.tsx — tests the exercise browser's rendering,
 * body-part chip filtering, detail-sheet integration, empty state,
 * FilterSheet invocation, and multiselection with the Floating Action Dock.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ExerciseBrowser } from "./ExerciseBrowser";

const hoisted = vi.hoisted(() => ({
  mockSetSearchParams: vi.fn(),
  mockExercises: [
    {
      id: "ex-1",
      name: "Barbell Bench Press",
      body_part: "chest",
      target: "pectorals",
      equipment: "barbell",
      gif_url: "https://example.com/anim1.gif",
      instruction_steps: { es: ["Lie down.", "Grab the bar."] },
    },
    {
      id: "ex-2",
      name: "Squat",
      body_part: "upper legs",
      target: "quadriceps",
      equipment: "barbell",
      gif_url: "https://example.com/anim2.gif",
      instruction_steps: { es: ["Stand.", "Bend knees."] },
    },
  ],
}));

/*
 * The browser reads the catalog from the device, not from the server: the
 * 1,324 rows it needs are the ones the app ships with.
 */
vi.mock("@/lib/catalog/catalogLoader", () => ({
  loadCatalog: () =>
    Promise.resolve(
      hoisted.mockExercises.map((ex) => ({
        ...ex,
        category: ex.body_part,
        image: "",
        muscle_group: ex.target,
        secondary_muscles: [],
        availableInCronosGym: true,
        instructions: { es: ex.instruction_steps.es.join(" ") },
        media_id: "test",
        created_at: "2024-01-01",
        attribution: null,
      })),
    ),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useSearchParams: () => [
      new URLSearchParams(""),
      hoisted.mockSetSearchParams,
    ],
  };
});

afterEach(() => cleanup());

describe("ExerciseBrowser", () => {
  it("renders the title", () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Biblioteca de Ejercicios")).toBeTruthy();
  });

  it("renders the search input with placeholder", () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Buscar/i)).toBeTruthy();
  });

  it("renders body-part chips including Todos and Pecho after loading", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Todos" })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Pecho" })).toBeTruthy();
  });

  it("shows the result count after loading exercises", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/2 de 2 ejercicios/)).toBeTruthy();
    });
  });

  it("renders exercise card names after loading", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    expect(screen.getByText("Squat")).toBeTruthy();
  });

  it("renders selection checkboxes on each card", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    expect(screen.getAllByRole("button", { name: /Seleccionar/i }).length).toBeGreaterThan(0);
  });

  it("shows the Floating Action Dock after selecting an exercise", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Seleccionar" })[0]);
    await waitFor(() => {
      expect(screen.getByText("1 seleccionado")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /Añadir al entrenamiento/i })).toBeTruthy();
  });

  it("calls onAdd with selected exercises when Add is clicked in the dock", async () => {
    const onAdd = vi.fn();
    render(<ExerciseBrowser onAdd={onAdd} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Seleccionar" })[0]);
    await waitFor(() => {
      expect(screen.getByText("1 seleccionado")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Añadir al entrenamiento/i }));
    expect(onAdd).toHaveBeenCalledWith([
      expect.objectContaining({ id: "ex-1", name: "Barbell Bench Press" }),
    ]);
  });

  it("clears selection when Clear is clicked in the dock", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Seleccionar" })[0]);
    await waitFor(() => {
      expect(screen.getByText("1 seleccionado")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Limpiar selección/i }));
    await waitFor(() => {
      expect(screen.queryByText(/seleccionado/)).toBeFalsy();
    });
  });

  it("allows multi-select before adding", async () => {
    const onAdd = vi.fn();
    render(<ExerciseBrowser onAdd={onAdd} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    const selectButtons = screen.getAllByRole("button", { name: /Seleccionar/i });
    fireEvent.click(selectButtons[0]);
    fireEvent.click(selectButtons[1]);
    await waitFor(() => {
      expect(screen.getByText("2 seleccionados")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Añadir al entrenamiento/i }));
    expect(onAdd).toHaveBeenCalledWith([
      expect.objectContaining({ id: "ex-1" }),
      expect.objectContaining({ id: "ex-2" }),
    ]);
  });

  it("disables Add button when all selected are already added", async () => {
    const { rerender } = render(
      <ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} isAdded={() => false} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Seleccionar" })[0]);
    await waitFor(() => {
      expect(screen.getByText("1 seleccionado")).toBeTruthy();
    });
    rerender(
      <ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} isAdded={(id) => id === "ex-1"} />,
    );
    const addButton = screen.getByRole("button", { name: /Añadir al entrenamiento/i });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("filters exercises when the Pecho chip is clicked", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Pecho" }));
    await waitFor(() => {
      expect(screen.getByText(/1 de 2 ejercicios/)).toBeTruthy();
    });
    expect(screen.queryByText("Squat")).toBeFalsy();
  });

  it("opens the detail sheet when a card's detail button is clicked", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    const detailButtons = screen.getAllByLabelText("Ver detalles");
    fireEvent.click(detailButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Instrucciones")).toBeTruthy();
    });
  });

  it("renders 'GIF de referencia' badge on each card", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    expect(screen.getAllByText("GIF de referencia").length).toBeGreaterThan(0);
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Cerrar"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when the search matches nothing", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    const searchInput = screen.getByPlaceholderText(/Buscar/i);
    fireEvent.change(searchInput, {
      target: { value: "nonexistent exercise" },
    });
    await waitFor(() => {
      expect(screen.getByText(/Sin resultados/)).toBeTruthy();
    });
  });

  it("opens FilterSheet when the Equipamiento y objetivo button is clicked", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Equipamiento y objetivo"));
    await waitFor(() => {
      expect(screen.getByText("Filtrar ejercicios")).toBeTruthy();
    });
  });

  it("clears filters when Limpiar todo is clicked", async () => {
    render(<ExerciseBrowser onAdd={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Press de banca con barra")).toBeTruthy();
    });
    // Apply a filter first
    fireEvent.click(screen.getByRole("button", { name: "Pecho" }));
    await waitFor(() => {
      expect(screen.getByText(/1 de 2 ejercicios/)).toBeTruthy();
    });
    // Clear all
    fireEvent.click(screen.getByText("Limpiar todo"));
    await waitFor(() => {
      expect(screen.getByText(/2 de 2 ejercicios/)).toBeTruthy();
    });
  });
});
