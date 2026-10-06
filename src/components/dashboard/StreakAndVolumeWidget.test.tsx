/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StreakAndVolumeWidget } from "./StreakAndVolumeWidget";
import type { StreakStats, VolumeTrendResult } from "@/lib/dashboard/dashboardMetrics";

const STREAK: StreakStats = {
  currentWeeks: 2,
  currentDays: 5,
  longestWeeks: 4,
  trainedToday: true,
};

const VOLUME: VolumeTrendResult = {
  points: [
    { date: "2026-9-29", volumeKg: 500 },
    { date: "2026-9-30", volumeKg: 0 },
    { date: "2026-10-1", volumeKg: 1000 },
    { date: "2026-10-2", volumeKg: 800 },
    { date: "2026-10-3", volumeKg: 1200 },
    { date: "2026-10-4", volumeKg: 900 },
    { date: "2026-10-5", volumeKg: 1100 },
  ],
  deltaPct: 20.5,
};

afterEach(() => cleanup());

describe("StreakAndVolumeWidget", () => {
  it("renders streak and volume numbers", () => {
    render(<StreakAndVolumeWidget streak={STREAK} volume={VOLUME} />);

    expect(screen.getByText("5d")).toBeTruthy();
    expect(screen.getByText("2w")).toBeTruthy();
    expect(screen.getByText("4w")).toBeTruthy();
    expect(screen.getByText(/Hoy/)).toBeTruthy();
  });

  it("shows the delta percentage with sign", () => {
    render(<StreakAndVolumeWidget streak={STREAK} volume={VOLUME} />);

    expect(screen.getByText("+20.5%")).toBeTruthy();
  });

  it("shows — when deltaPct is null", () => {
    render(
      <StreakAndVolumeWidget
        streak={STREAK}
        volume={{ ...VOLUME, deltaPct: null }}
      />,
    );

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("shows negative delta in red", () => {
    render(
      <StreakAndVolumeWidget
        streak={STREAK}
        volume={{ ...VOLUME, deltaPct: -15 }}
      />,
    );

    expect(screen.getByText("-15.0%")).toBeTruthy();
  });

  it("renders the last day's volume", () => {
    render(<StreakAndVolumeWidget streak={STREAK} volume={VOLUME} />);

    // Last point has 1100 kg, formatted by `formatNumber` as "1,100".
    expect(screen.getByText(/1,100/)).toBeTruthy();
  });

  it("shows skeleton when loading", () => {
    render(<StreakAndVolumeWidget streak={null} volume={null} loading />);

    expect(screen.getAllByText("Racha")).toHaveLength(1);
  });

  it("does not show Hoy when trainedToday is false", () => {
    render(
      <StreakAndVolumeWidget
        streak={{ ...STREAK, trainedToday: false }}
        volume={VOLUME}
      />,
    );

    expect(screen.queryByText("Hoy")).toBeNull();
  });
});
