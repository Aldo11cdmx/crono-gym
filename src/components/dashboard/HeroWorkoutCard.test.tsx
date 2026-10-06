/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HeroWorkoutCard } from "./HeroWorkoutCard";

afterEach(() => cleanup());

const ROUTINE = {
  title: "Full Body",
  exerciseCount: 5,
  estimatedDurationMin: 30,
};

describe("HeroWorkoutCard", () => {
  it("renders a suggested routine with title and duration", () => {
    render(
      <HeroWorkoutCard
        suggestedRoutine={ROUTINE}
        onPrimary={vi.fn()}
      />,
    );

    expect(screen.getByText("Full Body")).toBeTruthy();
    expect(screen.getByText(/5 ejercicios/)).toBeTruthy();
    expect(screen.getByText("Empezar")).toBeTruthy();
  });

  it("calls onPrimary when the button is clicked", () => {
    const onPrimary = vi.fn();
    render(
      <HeroWorkoutCard
        suggestedRoutine={ROUTINE}
        onPrimary={onPrimary}
      />,
    );

    fireEvent.click(screen.getByText("Empezar"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("renders fallback when no suggested routine", () => {
    render(<HeroWorkoutCard suggestedRoutine={null} onPrimary={vi.fn()} />);

    expect(screen.getByText(/No hay rutina programada/)).toBeTruthy();
    expect(screen.getByText("Empezar")).toBeTruthy();
  });

  it("renders activeContent when provided (session active)", () => {
    render(
      <HeroWorkoutCard
        suggestedRoutine={null}
        onPrimary={vi.fn()}
        activeContent={<span data-testid="active-banner">Session running</span>}
      />,
    );

    expect(screen.getByTestId("active-banner")).toBeTruthy();
    expect(screen.queryByText("Empezar")).toBeNull();
  });

  it("shows a skeleton when loading", () => {
    render(<HeroWorkoutCard suggestedRoutine={null} onPrimary={vi.fn()} loading />);

    // Skeleton renders placeholder — no real content.
    expect(screen.queryByText("Empezar")).toBeNull();
  });
});
