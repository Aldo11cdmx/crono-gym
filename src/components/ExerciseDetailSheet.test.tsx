/**
 * @vitest-environment jsdom
 *
 * ExerciseDetailSheet.test.tsx — tests the detail sheet's rendering of exercise
 * data (name, GIF, labels, instructions) and close behaviour.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExerciseDetailSheet } from "./ExerciseDetailSheet";
import type { Exercise } from "@/types/supabase";

afterEach(cleanup);

function makeExercise(overrides: Partial<Exercise> & Pick<Exercise, "id" | "name">): Exercise {
  return {
    body_part: "chest",
    target: "pectorals",
    equipment: "barbell",
    gif_url: "https://example.com/anim.gif",
    instructions: ["Acuéstese boca arriba.", "Agarra la barra."],
    ...overrides,
  } as Exercise;
}

describe("ExerciseDetailSheet", () => {
  it("renders exercise name when open", () => {
    render(
      <ExerciseDetailSheet
        exercise={makeExercise({ id: "ex-1", name: "Barbell Bench Press" })}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    // The sheet shows the Spanish label, the app's single vocabulary.
    expect(screen.getByText("Press de banca con barra")).toBeTruthy();
  });

  it("renders null when exercise is null", () => {
    const { container } = render(
      <ExerciseDetailSheet exercise={null} isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders GIF image when gif_url is provided", () => {
    render(
      <ExerciseDetailSheet
        exercise={makeExercise({ id: "ex-1", name: "Test" })}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    const img = screen.getByAltText(/Animación de Test/i);
    expect(img).toBeTruthy();
  });

  it("renders fallback icon when gif_url is empty", () => {
    render(
      <ExerciseDetailSheet
        exercise={makeExercise({ id: "ex-1", name: "Test", gif_url: "" })}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByAltText(/Animación/i)).toBeFalsy();
  });

  it("renders translated attribute labels", () => {
    render(
      <ExerciseDetailSheet
        exercise={makeExercise({ id: "ex-1", name: "Test", body_part: "chest", target: "pectorals", equipment: "barbell" })}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Pecho")).toBeTruthy();
    expect(screen.getByText("Pectorales")).toBeTruthy();
    expect(screen.getByText("Barra")).toBeTruthy();
  });

  it("renders instructions as a list", () => {
    render(
      <ExerciseDetailSheet
        exercise={makeExercise({ id: "ex-1", name: "Test" })}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Acuéstese boca arriba.")).toBeTruthy();
    expect(screen.getByText("Agarra la barra.")).toBeTruthy();
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ExerciseDetailSheet
        exercise={makeExercise({ id: "ex-1", name: "Test" })}
        isOpen={true}
        onClose={onClose}
      />,
    );
    const closeButton = screen.getByRole("button", { name: /Cerrar/i });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ExerciseDetailSheet
        exercise={makeExercise({ id: "ex-1", name: "Test" })}
        isOpen={true}
        onClose={onClose}
      />,
    );
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders GIF fallback label", () => {
    render(
      <ExerciseDetailSheet
        exercise={makeExercise({ id: "ex-1", name: "Test" })}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("GIF de referencia")).toBeTruthy();
  });
});