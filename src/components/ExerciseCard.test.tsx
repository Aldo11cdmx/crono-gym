/**
 * @vitest-environment jsdom
 *
 * ExerciseCard.test.tsx — tests the card's selection, favorite, and detail
 * toggle behaviour.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExerciseCard } from "./ExerciseCard";
import type { Exercise } from "@/types/supabase";

afterEach(cleanup);

function makeExercise(overrides: Partial<Exercise> & Pick<Exercise, "id" | "name">): Exercise {
  return {
    body_part: "chest",
    target: "pectorals",
    equipment: "barbell",
    gif_url: "https://example.com/anim.gif",
    instructions: ["Step 1", "Step 2"],
    ...overrides,
  } as Exercise;
}

const SAMPLE = makeExercise({ id: "ex-1", name: "Barbell Bench Press" });

describe("ExerciseCard", () => {
  it("renders the exercise name", () => {
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={false}
        onToggleSelect={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    expect(screen.getByText("Barbell Bench Press")).toBeTruthy();
  });

  it("shows check icon when selected", () => {
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={true}
        onToggleSelect={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    // The checkbox button should have the "Deseleccionar" aria-label
    expect(screen.getByRole("button", { name: /Deseleccionar/i })).toBeTruthy();
  });

  it("calls onToggleSelect with the exercise id when checkbox clicked", () => {
    const onToggleSelect = vi.fn();
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={false}
        onToggleSelect={onToggleSelect}
        onOpenDetail={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole("button", { name: /Seleccionar/i });
    fireEvent.click(checkbox);
    expect(onToggleSelect).toHaveBeenCalledWith("ex-1");
  });

  it("shows alreadyAdded badge when alreadyAdded is true", () => {
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={false}
        alreadyAdded={true}
        onToggleSelect={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    expect(screen.getByText("Añadido")).toBeTruthy();
  });

  it("shows favorite star when onToggleFavorite is provided", () => {
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={false}
        favorite={true}
        onToggleFavorite={vi.fn()}
        onToggleSelect={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    const favButton = screen.getByRole("button", { name: /Quitar de favoritos/i });
    expect(favButton).toBeTruthy();
  });

  it("does not show star when onToggleFavorite is not provided", () => {
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={false}
        onToggleSelect={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/favoritos/i)).not.toBeTruthy();
  });

  it("calls onOpenDetail when card is clicked", () => {
    const onOpenDetail = vi.fn();
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={false}
        onToggleSelect={vi.fn()}
        onOpenDetail={onOpenDetail}
      />,
    );
    const detailButton = screen.getByRole("button", { name: /Ver detalles/i });
    fireEvent.click(detailButton);
    expect(onOpenDetail).toHaveBeenCalled();
  });

  it("shows 1RM badge when provided", () => {
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={false}
        oneRepMax={185.5}
        onToggleSelect={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    expect(screen.getByText("1RM: 186")).toBeTruthy();
  });

  it("renders in list view with different layout", () => {
    render(
      <ExerciseCard
        exercise={SAMPLE}
        selected={false}
        onToggleSelect={vi.fn()}
        onOpenDetail={vi.fn()}
        view="list"
      />,
    );
    expect(screen.getByText("Barbell Bench Press")).toBeTruthy();
  });
});
