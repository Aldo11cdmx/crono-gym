/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PRHighlightsCard } from "./PRHighlightsCard";
import type { RecentPR } from "@/lib/dashboard/dashboardMetrics";

afterEach(() => cleanup());

const PRS: RecentPR[] = [
  { exerciseName: "Squat", estimated1RM: 150, achievedAt: "2026-10-03T10:00:00" },
  { exerciseName: "Press de banca", estimated1RM: 100, achievedAt: "2026-10-01T10:00:00" },
];

describe("PRHighlightsCard", () => {
  it("renders a list of PRs with exercise name and 1RM", () => {
    render(<PRHighlightsCard prs={PRS} />);

    expect(screen.getByText("Squat")).toBeTruthy();
    expect(screen.getByText("Press de banca")).toBeTruthy();
    expect(screen.getByText("150 kg")).toBeTruthy();
    expect(screen.getByText("100 kg")).toBeTruthy();
  });

  it("marks estimates as est.", () => {
    render(<PRHighlightsCard prs={PRS} />);

    expect(screen.getAllByText("est.")).toHaveLength(2);
  });

  it("shows empty state when no PRs", () => {
    render(<PRHighlightsCard prs={[]} />);

    expect(screen.getByText(/Aún no tienes/)).toBeTruthy();
  });

  it("shows skeleton when loading", () => {
    render(<PRHighlightsCard prs={[]} loading />);

    expect(screen.getByText("Récords recientes")).toBeTruthy();
    expect(screen.queryByText(/Aún no tienes/)).toBeNull();
  });

  it("renders metric unit by default", () => {
    render(<PRHighlightsCard prs={[PRS[0]]} />);

    expect(screen.getByText("150 kg")).toBeTruthy();
  });

  it("renders imperial unit when set to imperial", () => {
    render(<PRHighlightsCard prs={[PRS[0]]} unit="imperial" />);

    // 150 kg ≈ 331 lb
    expect(screen.getByText("331 lb")).toBeTruthy();
  });
});
