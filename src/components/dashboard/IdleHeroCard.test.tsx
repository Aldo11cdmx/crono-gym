/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { IdleHeroCard } from "./IdleHeroCard";
import type { RoutineSummary } from "@/lib/dashboard/heroCardModel";

afterEach(cleanup);

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false, // mobile by default
}));

const ROUTINE: RoutineSummary = {
  title: "Full Body",
  exerciseCount: 5,
  estimatedDurationMin: 30,
  muscles: ["chest"],
};

const CHIPS = [{ label: "5 ejercicios" }, { label: "30 min" }];

function renderCard(overrides: Record<string, unknown> = {}) {
  const props = {
    greeting: "Buenos días, Ana",
    routine: ROUTINE,
    chips: CHIPS,
    onStart: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  };
  return render(<IdleHeroCard {...props} />);
}

describe("IdleHeroCard", () => {
  it("renders the greeting as a heading", () => {
    renderCard();
    expect(screen.getByText("Buenos días, Ana")).toBeTruthy();
  });

  it("renders the routine info when routine is provided", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("Full Body");
    expect(screen.getAllByText(/5 ejercicios/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/30 min/).length).toBeGreaterThan(0);
  });

  it("renders INICIAR ENTRENAMIENTO button when routine provided", () => {
    renderCard();
    expect(screen.getByText("INICIAR ENTRENAMIENTO")).toBeTruthy();
  });

  it("calls onStart when start button clicked", () => {
    const onStart = vi.fn();
    renderCard({ onStart });
    fireEvent.click(screen.getByText("INICIAR ENTRENAMIENTO"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("renders INICIAR ENTRENAMIENTO button when no routine", () => {
    renderCard({ routine: null });
    expect(screen.getByText("INICIAR ENTRENAMIENTO")).toBeTruthy();
  });

  it("calls onStart when INICIAR clicked with no routine", () => {
    const onStart = vi.fn();
    renderCard({ routine: null, onStart });
    fireEvent.click(screen.getByText("INICIAR ENTRENAMIENTO"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("shows welcome message when no routine", () => {
    renderCard({ routine: null, greeting: "Buenas noches" });
    expect(screen.getByText(/primera rutina/)).toBeTruthy();
  });

  it("shows different message when greeting has a name", () => {
    renderCard({ routine: null, greeting: "Buenos días, Ana" });
    expect(screen.getByText(/nuevo entrenamiento/)).toBeTruthy();
  });

  it("renders skeleton when loading", () => {
    renderCard({ loading: true });
    expect(screen.queryByText("INICIAR ENTRENAMIENTO")).toBeFalsy();
    expect(screen.queryByText("Crear rutina")).toBeFalsy();
  });

  it("does not show chips section when chips empty", () => {
    renderCard({ chips: [] });
    // No chip text should appear
    expect(screen.queryByText("5 ejercicios")).toBeFalsy();
    expect(screen.queryByText("30 min")).toBeFalsy();
  });

  it("renders day name in the HOY badge when provided", () => {
    renderCard({ dayName: "Sábado", dayLabel: null });
    expect(screen.getByText(/HOY/)).toBeTruthy();
    expect(screen.getByText(/Sábado/)).toBeTruthy();
  });

  it("renders day name badge and muscle focus together", () => {
    renderCard({ dayName: "Sábado", dayLabel: "Pecho" });
    expect(screen.getByText(/HOY/)).toBeTruthy();
    expect(screen.getByText("Enfoque: Pecho")).toBeTruthy();
  });

  it("shows INICIAR ENTRENAMIENTO instead of Empezar entrenamiento", () => {
    renderCard();
    expect(screen.getByText("INICIAR ENTRENAMIENTO")).toBeTruthy();
    expect(screen.queryByText("Empezar entrenamiento")).toBeFalsy();
  });

  it("renders rest-day state when restDay is true", () => {
    renderCard({ restDay: true });
    expect(screen.getByText("Día de Recuperación")).toBeTruthy();
    expect(screen.getByText(/Ya entrenaste hoy/)).toBeTruthy();
  });

  it("renders Ver progreso button when restDay is true", () => {
    const onStart = vi.fn();
    renderCard({ restDay: true, onStart });
    expect(screen.getByText("Ver progreso")).toBeTruthy();
    fireEvent.click(screen.getByText("Ver progreso"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("does not show routine details in rest-day state", () => {
    renderCard({ restDay: true });
    expect(screen.queryByText(/Full Body/)).toBeFalsy();
    expect(screen.queryByText(/ejercicios/)).toBeFalsy();
  });
});
