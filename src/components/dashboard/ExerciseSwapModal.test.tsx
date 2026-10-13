/**
 * ExerciseSwapModal.test.tsx — tests for the exercise substitution modal.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ExerciseSwapModal } from "./ExerciseSwapModal";
import type { Exercise } from "@/types/supabase";
import type { DraftExercise } from "@/lib/routines/routineDraftModel";

const makeExercise = (overrides: Partial<Exercise>): Exercise => ({
  id: overrides.id ?? "e-test",
  name: overrides.name ?? "Test",
  body_part: overrides.body_part ?? "chest",
  target: overrides.target ?? "pectorals",
  equipment: overrides.equipment ?? "body weight",
  gif_url: "",
  instructions: [],
});

const SOURCE_EXERCISE = makeExercise({
  id: "e-bench",
  name: "Press de banca",
  body_part: "chest",
  target: "pectorals",
  equipment: "barbell",
});

const SOURCE_DRAFT: DraftExercise = {
  exercise: SOURCE_EXERCISE,
  target_sets: 3,
  rest_seconds: 90,
  order_index: 0,
  target_reps_min: 8,
  target_reps_max: 10,
};

const CATALOG: Exercise[] = [
  SOURCE_EXERCISE,
  makeExercise({
    id: "e-incline",
    name: "Press inclinado",
    body_part: "chest",
    target: "pectorals",
    equipment: "barbell",
  }),
  makeExercise({
    id: "e-fly",
    name: "Flys en máquina",
    body_part: "chest",
    target: "pectorals",
    equipment: "leverage machine",
  }),
  makeExercise({
    id: "e-pushup",
    name: "Flexión de pecho",
    body_part: "chest",
    target: "triceps",
    equipment: "body weight",
  }),
  // Secondary-only match: same target, different body_part
  makeExercise({
    id: "e-tricep-pushdown",
    name: "Pulsera de tríceps",
    body_part: "upper arms",
    target: "pectorals",
    equipment: "cable",
  }),
  makeExercise({
    id: "e-squat",
    name: "Sentadilla",
    body_part: "upper legs",
    target: "quadriceps",
    equipment: "barbell",
  }),
];

afterEach(() => cleanup());

describe("ExerciseSwapModal", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <ExerciseSwapModal
        isOpen={false}
        source={SOURCE_DRAFT}
        allExercises={CATALOG}
        onReplace={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the swap title and source exercise info", () => {
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={CATALOG}
        onReplace={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Cambiar ejercicio")).toBeTruthy();
    expect(screen.getByText(/Press de banca/)).toBeTruthy();
  });

  it("lists only same-muscle alternatives (excludes different muscle)", () => {
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={CATALOG}
        onReplace={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Press inclinado")).toBeTruthy();
    expect(screen.getByText("Flys en máquina")).toBeTruthy();
    expect(screen.getByText("Flexión de pecho")).toBeTruthy();
    expect(screen.getByText("Pulsera de tríceps")).toBeTruthy();
    expect(screen.queryByText("Sentadilla")).toBeNull();
  });

  it("ranks primary muscle matches before secondary-only matches", () => {
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={CATALOG}
        onReplace={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Press inclinado") || b.textContent?.includes("Pulsera de tríceps"),
    );
    const primaryIdx = buttons.findIndex((b) => b.textContent?.includes("Press inclinado"));
    const secondaryIdx = buttons.findIndex((b) => b.textContent?.includes("Pulsera de tríceps"));
    expect(primaryIdx).toBeGreaterThanOrEqual(0);
    expect(secondaryIdx).toBeGreaterThanOrEqual(0);
    expect(primaryIdx).toBeLessThan(secondaryIdx);
  });

  it("filters the list by search query", () => {
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={CATALOG}
        onReplace={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const search = screen.getByPlaceholderText("Buscar ejercicio…");
    fireEvent.change(search, { target: { value: "Flys" } });
    expect(screen.getByText("Flys en máquina")).toBeTruthy();
    expect(screen.queryByText("Press inclinado")).toBeNull();
  });

  it("calls onReplace with the selected exercise and dismisses", () => {
    const onReplace = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={CATALOG}
        onReplace={onReplace}
        onDismiss={onDismiss}
      />,
    );
    const flyButton = screen.getByText("Flys en máquina").closest("button")!;
    fireEvent.click(flyButton);
    expect(onReplace).toHaveBeenCalledWith(
      expect.objectContaining({ id: "e-fly", name: "Flys en máquina" }),
    );
    expect(onDismiss).toHaveBeenCalled();
  });

  it("shows empty state when no candidates match", () => {
    const noMatchCatalog: Exercise[] = [
      SOURCE_EXERCISE,
      makeExercise({
        id: "e-squat",
        name: "Sentadilla",
        body_part: "upper legs",
        target: "quadriceps",
        equipment: "barbell",
      }),
    ];
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={noMatchCatalog}
        onReplace={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Sin alternativas/)).toBeTruthy();
  });

  it("calls onDismiss when Escape is pressed", () => {
    const onDismiss = vi.fn();
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={CATALOG}
        onReplace={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("shows equipment availability tags", () => {
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={CATALOG}
        onReplace={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
     const tags = screen.getAllByText(/Disponible|No disponible/);
    expect(tags.length).toBeGreaterThan(0);
  });

  it("shows a No disponible tag when equipment is not in gym", () => {
    const catalogWithUnavailable: Exercise[] = [
      SOURCE_EXERCISE,
      makeExercise({
        id: "e-band",
        name: "Remo con banda",
        body_part: "chest",
        target: "pectorals",
        equipment: "resistance band",
      }),
    ];
    render(
      <ExerciseSwapModal
        isOpen={true}
        source={SOURCE_DRAFT}
        allExercises={catalogWithUnavailable}
        onReplace={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("No disponible")).toBeTruthy();
  });
});
