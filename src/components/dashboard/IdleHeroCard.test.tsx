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

  it("renders 'Empezar entrenamiento' button when routine provided", () => {
    renderCard();
    expect(screen.getByText("Empezar entrenamiento")).toBeTruthy();
  });

  it("calls onStart when start button clicked", () => {
    const onStart = vi.fn();
    renderCard({ onStart });
    fireEvent.click(screen.getByText("Empezar entrenamiento"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("renders 'Crear rutina' button when no routine", () => {
    renderCard({ routine: null });
    expect(screen.getByText("Crear rutina")).toBeTruthy();
  });

  it("calls onCreate when create button clicked", () => {
    const onCreate = vi.fn();
    renderCard({ routine: null, onCreate });
    fireEvent.click(screen.getByText("Crear rutina"));
    expect(onCreate).toHaveBeenCalledTimes(1);
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
    expect(screen.queryByText("Empezar entrenamiento")).toBeFalsy();
    expect(screen.queryByText("Crear rutina")).toBeFalsy();
  });

  it("does not show chips section when chips empty", () => {
    renderCard({ chips: [] });
    // No chip text should appear
    expect(screen.queryByText("5 ejercicios")).toBeFalsy();
    expect(screen.queryByText("30 min")).toBeFalsy();
  });
});
