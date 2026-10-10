/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LiveSessionBanner } from "./LiveSessionBanner";

afterEach(cleanup);

const ROUTINE = {
  title: "Full Body",
  exerciseCount: 5,
  estimatedDurationMin: 30,
  muscles: ["chest", "shoulders"],
};

function renderBanner(overrides: Record<string, unknown> = {}) {
  const props = {
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    routineName: "Full Body",
    routine: ROUTINE,
    doneSets: 3,
    plannedSets: 10,
    onContinue: vi.fn(),
    ...overrides,
  };
  return render(<LiveSessionBanner {...props} />);
}

describe("LiveSessionBanner", () => {
  it("renders the routine name as a title", () => {
    renderBanner();
    expect(screen.getByText("Full Body")).toBeTruthy();
  });

  it("shows 'EN CURSO' badge", () => {
    renderBanner();
    expect(screen.getByText("EN CURSO")).toBeTruthy();
  });

  it("shows elapsed time", () => {
    renderBanner();
    expect(screen.getByLabelText(/Tiempo transcurrido/)).toBeTruthy();
    // Should show something like 1:00 or less
    const time = screen.getByLabelText(/Tiempo transcurrido/);
    expect(time.textContent).toMatch(/\d:[0-5]\d/);
  });

  it("shows chips for exercises and duration", () => {
    renderBanner();
    expect(screen.getByText("5 ejercicios")).toBeTruthy();
    expect(screen.getByText("30 min")).toBeTruthy();
  });

  it("hides timer when startedAt is invalid", () => {
    renderBanner({ startedAt: "not-a-date" });
    expect(screen.queryByLabelText(/Tiempo transcurrido/)).toBeFalsy();
  });

  it("hides progress bar when doneSets/plannedSets are null", () => {
    const { container } = renderBanner({ doneSets: null, plannedSets: null });
    expect(container.querySelector('[role="progressbar"]')).toBeFalsy();
  });

  it("shows progress bar with correct value", () => {
    renderBanner({ doneSets: 3, plannedSets: 10 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("30");
  });

  it("renders continuar button", () => {
    renderBanner();
    expect(screen.getByRole("button", { name: /Continuar entrenamiento/i })).toBeTruthy();
  });

  it("calls onContinue when button clicked", () => {
    const onContinue = vi.fn();
    renderBanner({ onContinue });
    screen.getByRole("button", { name: /Continuar/i }).click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
