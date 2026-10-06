/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WeeklyGoalCard } from "./WeeklyGoalCard";
import type { WeeklyProgress } from "@/lib/dashboard/dashboardMetrics";

const PROGRESS: WeeklyProgress = {
  completed: 2,
  goal: 3,
  daysTrained: [true, true, false, false, false, false, false],
};

afterEach(() => cleanup());

afterEach(() => cleanup());

describe("WeeklyGoalCard", () => {
  it("renders completed/goal progress", () => {
    render(<WeeklyGoalCard progress={PROGRESS} />);

    expect(screen.getByText("2/3")).toBeTruthy();
  });

  it("shows a message when behind schedule", () => {
    render(<WeeklyGoalCard progress={PROGRESS} />);

    expect(screen.getByText(/1 sesión/)).toBeTruthy();
  });

  it("shows a success message when goal is met", () => {
    const done: WeeklyProgress = {
      completed: 3,
      goal: 3,
      daysTrained: [true, false, true, false, true, false, false],
    };
    render(<WeeklyGoalCard progress={done} />);

    expect(screen.getByText("Meta alcanzada")).toBeTruthy();
  });

  it("shows extra message when ahead of goal", () => {
    const ahead: WeeklyProgress = {
      completed: 4,
      goal: 3,
      daysTrained: [true, true, false, true, false, false, false],
    };
    render(<WeeklyGoalCard progress={ahead} />);

    expect(screen.getByText(/1 sesión/)).toBeTruthy();
  });

  it("renders all 7 day labels", () => {
    render(<WeeklyGoalCard progress={PROGRESS} />);

    // Default Spanish day labels: L, M, X, J, V, S, D
    const labels = screen.getAllByText(/[LMJXVSD]/);
    expect(labels.length).toBeGreaterThanOrEqual(7);
  });

  it("shows skeleton when loading", () => {
    render(<WeeklyGoalCard progress={null} loading />);

    expect(screen.getAllByText("Esta semana")).toHaveLength(1);
  });

  it("accepts custom day labels", () => {
    const custom: [string, string, string, string, string, string, string] = [
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    ];
    render(<WeeklyGoalCard progress={PROGRESS} dayLabels={custom} />);

    expect(screen.getByText("Mon")).toBeTruthy();
    expect(screen.getByText("Sun")).toBeTruthy();
  });
});
