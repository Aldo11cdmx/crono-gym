/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgressCharts } from "./ProgressCharts";
import { ConsistencyTracker } from "./ConsistencyTracker";
import { WorkoutHistory } from "./WorkoutHistory";
import type { ProgressStats, RecentSession, WeekPoint } from "@/hooks/useGymData";
import { PROGRESS_LABELS } from "@/lib/i18n";

afterEach(cleanup);

const WEEK: WeekPoint[] = [
  { label: "lun", date: "2026-10-19", count: 0 },
  { label: "mar", date: "2026-10-20", count: 1 },
  { label: "mié", date: "2026-10-21", count: 2 },
  { label: "jue", date: "2026-10-22", count: 0 },
  { label: "vie", date: "2026-10-23", count: 4 },
  { label: "sáb", date: "2026-10-24", count: 0 },
  { label: "dom", date: "2026-10-25", count: 0 },
];

const RECENT: RecentSession[] = [
  {
    id: "s1",
    started_at: "2026-10-23T08:00:00Z",
    routineTitle: "Fuerza superior",
    sets: 4,
    volume: 320,
  },
  { id: "s2", started_at: "2026-10-22T08:00:00Z", routineTitle: "xd", sets: 0, volume: 0 },
  { id: "s3", started_at: "2026-10-21T08:00:00Z", routineTitle: "", sets: 3, volume: 180 },
];

const STATS: ProgressStats = {
  totalWorkouts: 9,
  workoutsThisMonth: 4,
  bestWeight: 112.5,
  monthlyVolume: 12557,
  week: WEEK,
  recent: RECENT,
};

describe("ProgressCharts", () => {
  it("renderiza las cuatro tarjetas KPI como glass cards", () => {
    render(<ProgressCharts stats={STATS} />);
    expect(screen.getByText("Entrenamientos")).toBeTruthy();
    expect(screen.getByText("Peso máximo")).toBeTruthy();
    expect(screen.getByText("Volumen")).toBeTruthy();
    expect(screen.getByText("Sesiones totales")).toBeTruthy();
  });

  it("formatea el volumen con separador de millares", () => {
    render(<ProgressCharts stats={STATS} />);
    expect(screen.getByText("12,557 kg")).toBeTruthy();
    expect(screen.getByText("112.5 kg")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
  });
});

describe("ConsistencyTracker", () => {
  it("dibuja una columna por cada uno de los últimos 7 días", () => {
    render(<ConsistencyTracker week={WEEK} />);
    const bars = document.querySelectorAll('[class*="rounded-t-xl"]');
    expect(bars).toHaveLength(7);
  });

  it("pinta con gradiente sólo los días que tienen sesiones", () => {
    render(<ConsistencyTracker week={WEEK} />);
    const filled = document.querySelectorAll('[class*="from-red-500"]');
    const empty = document.querySelectorAll('[class*="bg-white/5"]');
    expect(filled).toHaveLength(3);
    expect(empty).toHaveLength(4);
  });
});

describe("WorkoutHistory", () => {
  it("oculta las sesiones vacías (0 series y 0 kg)", () => {
    render(<WorkoutHistory recent={RECENT} />);
    const rows = document.querySelectorAll("li");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Fuerza superior")).toBeTruthy();
    expect(screen.queryByText("xd")).toBeNull();
  });

  it('usa "Sesión de [día]" cuando la sesión no tiene nombre', () => {
    render(<WorkoutHistory recent={RECENT} />);
    expect(screen.getByText(/^Sesión de/)).toBeTruthy();
    expect(screen.getByText("320 kg")).toBeTruthy();
  });

  it("muestra estado vacío cuando no queda historial tras el filtro", () => {
    render(<WorkoutHistory recent={[]} />);
    expect(screen.getByText(PROGRESS_LABELS.historyEmpty)).toBeTruthy();
  });
});
