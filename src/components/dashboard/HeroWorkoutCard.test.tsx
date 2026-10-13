/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HeroWorkoutCard } from "./HeroWorkoutCard";
import type { RoutineSummary } from "@/lib/dashboard/heroCardModel";

vi.mock("@/components/ui/HeroGlow", () => ({
  HeroGlow: () => null,
}));

afterEach(() => cleanup());

const ROUTINE: RoutineSummary = {
  title: "Full Body",
  exerciseCount: 5,
  estimatedDurationMin: 30,
  muscles: ["chest"],
};

describe("HeroWorkoutCard", () => {
  it("renders a suggested routine with title and duration", () => {
    render(
      <HeroWorkoutCard
        suggestedRoutine={ROUTINE}
        name={null}
        onPrimary={vi.fn()}
      />,
    );

    expect(screen.getByText(/Full Body/)).toBeTruthy();
    expect(screen.getAllByText(/5 ejercicios/).length).toBeGreaterThan(0);
    expect(screen.getByText("INICIAR ENTRENAMIENTO")).toBeTruthy();
  });

  it("calls onPrimary when INICIAR clicked with no routine", () => {
    const onPrimary = vi.fn();
    render(
      <HeroWorkoutCard
        suggestedRoutine={null}
        name={null}
        onPrimary={onPrimary}
      />,
    );

    fireEvent.click(screen.getByText("INICIAR ENTRENAMIENTO"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("renders start button when routine provided", () => {
    render(
      <HeroWorkoutCard
        suggestedRoutine={ROUTINE}
        name={null}
        onPrimary={vi.fn()}
      />,
    );

    expect(screen.getByText("INICIAR ENTRENAMIENTO")).toBeTruthy();
  });

  it("calls onPrimary when start button clicked", () => {
    const onPrimary = vi.fn();
    render(
      <HeroWorkoutCard
        suggestedRoutine={ROUTINE}
        name={null}
        onPrimary={onPrimary}
      />,
    );

    fireEvent.click(screen.getByText("INICIAR ENTRENAMIENTO"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("renders fallback when no suggested routine", () => {
    render(<HeroWorkoutCard suggestedRoutine={null} name={null} onPrimary={vi.fn()} />);

    expect(screen.getByText(/primera rutina/)).toBeTruthy();
    expect(screen.getByText("INICIAR ENTRENAMIENTO")).toBeTruthy();
  });

  it("renders activeContent when provided (session active)", () => {
    render(
      <HeroWorkoutCard
        suggestedRoutine={null}
        name={null}
        onPrimary={vi.fn()}
        activeContent={<span data-testid="active-banner">Session running</span>}
      />,
    );

    expect(screen.getByTestId("active-banner")).toBeTruthy();
  });

  it("renders LiveSessionBanner when activeSession provided", () => {
    render(
      <HeroWorkoutCard
        suggestedRoutine={null}
        name="Ana"
        activeSession={{
          startedAt: new Date(Date.now() - 30_000).toISOString(),
          title: "Entrenamiento A",
          doneSets: 2,
          plannedSets: 8,
        }}
        onPrimary={vi.fn()}
      />,
    );

    expect(screen.getByText("EN CURSO")).toBeTruthy();
    expect(screen.getByLabelText(/Tiempo transcurrido/)).toBeTruthy();
  });

  it("shows a skeleton when loading", () => {
    render(<HeroWorkoutCard suggestedRoutine={null} name={null} onPrimary={vi.fn()} loading />);

    // Skeleton renders placeholder — no real content.
    expect(screen.queryByText("INICIAR ENTRENAMIENTO")).toBeNull();
  });
});
