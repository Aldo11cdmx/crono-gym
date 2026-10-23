/**
 * @vitest-environment jsdom
 *
 * ExercisePicker.test.tsx — exercises the picker's search, filter, selection
 * and floating action bar behaviour.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Exercise } from "@/types/supabase";
import { ExercisePicker } from "./ExercisePicker";

afterEach(cleanup);

function makeExercise(
  id: string,
  name: string,
  body_part: string,
  target: string,
  equipment: string,
): Exercise {
  return {
    id,
    name,
    body_part,
    target,
    equipment,
    gif_url: "",
    instructions: [],
  } as Exercise;
}

const SAMPLE_EXERCISES: Exercise[] = [
  makeExercise("1", "Barbell Bench Press", "chest", "pectorals", "barbell"),
  makeExercise("2", "Dumbbell Shoulder Press", "shoulders", "delts", "dumbbell"),
  makeExercise("3", "Parallel Bar Dips", "upper arms", "triceps", "body weight"),
  makeExercise("4", "Barbell Back Squat", "upper legs", "quads", "barbell"),
  makeExercise("5", "Barbell Deadlift", "upper legs", "hamstrings", "barbell"),
];

function renderPicker(overrides: Record<string, unknown> = {}) {
  const props = {
    exercises: SAMPLE_EXERCISES,
    selectedIds: [] as string[],
    onSelectionChange: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  };
  const utils = render(<ExercisePicker {...props} />);
  return { ...utils, props };
}

describe("ExercisePicker — search", () => {
  it("filters exercises by name", () => {
    renderPicker();
    const input = screen.getByPlaceholderText(/Buscar/i);
    fireEvent.change(input, { target: { value: "press" } });

    const items = screen.getAllByRole("button", { name: /^Seleccionar$/ });
    // Only "Barbell Bench Press" and "Dumbbell Shoulder Press" contain "press"
    expect(items.length).toBe(2);
  });

  it("matches Spanish alias: 'fondos' finds 'Parallel Bar Dips'", () => {
    renderPicker();
    const input = screen.getByPlaceholderText(/Buscar/i);
    fireEvent.change(input, { target: { value: "fondos" } });

    // Only one result visible — the dip card
    expect(screen.getAllByRole("button", { name: /^Seleccionar$/ })).toHaveLength(1);
  });

  it("shows empty state when no results", () => {
    renderPicker();
    const input = screen.getByPlaceholderText(/Buscar/i);
    fireEvent.change(input, { target: { value: "nonexistent exercise" } });

    expect(screen.getByText(/Ningún ejercicio/i)).toBeTruthy();
  });
});

describe("ExercisePicker — selection", () => {
  it("toggles selection via checkbox", () => {
    const { props } = renderPicker();
    // Cards are sorted by name, so the first checkbox is for "Barbell Back Squat" (id "4")
    const checkboxes = screen.getAllByRole("button", { name: /^Seleccionar$/ });
    fireEvent.click(checkboxes[0]);

    expect(props.onSelectionChange).toHaveBeenCalledWith(["4"]);
  });

  it("calls onAdd with selected exercises", () => {
    const { props } = renderPicker({ selectedIds: ["1", "4"] });
    const addButton = screen.getByRole("button", { name: /Añadir al entrenamiento/i });
    fireEvent.click(addButton);

    expect(props.onAdd).toHaveBeenCalledWith([
      expect.objectContaining({ id: "1" }),
      expect.objectContaining({ id: "4" }),
    ]);
  });

  it("shows SelectionBar only when items are selected", () => {
    const { unmount } = renderPicker();
    expect(screen.queryByRole("button", { name: /Añadir al entrenamiento/i })).toBeFalsy();

    unmount();
    renderPicker({ selectedIds: ["1"] });
    expect(screen.getByRole("button", { name: /Añadir al entrenamiento/i })).toBeTruthy();
    expect(screen.getByText("1 seleccionado")).toBeTruthy();
  });

  it("shows correct plural for multiple selections", () => {
    renderPicker({ selectedIds: ["1", "2", "3"] });
    expect(screen.getByText("3 seleccionados")).toBeTruthy();
  });
});

describe("ExercisePicker — filter sheet", () => {
  it("opens filter sheet when button is clicked", () => {
    renderPicker();
    const filterButton = screen.getByRole("button", { name: /Filtrar ejercicios/i });
    fireEvent.click(filterButton);

    expect(screen.getByText("Filtrar ejercicios")).toBeTruthy();
  });

  it("displays body part options in the sheet", () => {
    renderPicker();
    const filterButton = screen.getByRole("button", { name: /Filtrar ejercicios/i });
    fireEvent.click(filterButton);

    expect(screen.getByText("Parte del cuerpo")).toBeTruthy();
    expect(screen.getAllByText("Todos")[0]).toBeTruthy();
    expect(screen.getAllByText("Pecho")[0]).toBeTruthy();
  });

  it("shows 'Todos' for the 'all' option (not raw 'all')", () => {
    renderPicker();
    const filterButton = screen.getByRole("button", { name: /Filtrar ejercicios/i });
    fireEvent.click(filterButton);

    const selects = screen.getAllByRole("combobox");
    selects.forEach((select) => {
      const allOption = within(select).getByText("Todos");
      expect(allOption).toBeTruthy();
    });
  });
});

describe("ExercisePicker — loading and error states", () => {
  it("shows loading spinner when isLoading is true", () => {
    renderPicker({ isLoading: true, exercises: [] });
    expect(screen.getByText(/Cargando ejercicios/i)).toBeTruthy();
  });

  it("shows error with retry button when error is set", () => {
    const onRetry = vi.fn();
    renderPicker({ error: "Network error", onRetry, exercises: [] });
    expect(screen.getByText("Network error")).toBeTruthy();

    const retryButton = screen.getByRole("button", { name: /Reintentar/i });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });
});
