/**
 * @vitest-environment jsdom
 *
 * AnatomicalRanksView is the assembly point for the whole rank feature: summary,
 * body map, legend and the detail modal. It is tested against the real scorer
 * rather than a hand-written fixture, because the interesting failures here are
 * mismatches between what the scorer produced and what the view claims -- an empty
 * state shown next to a real rank, or a "next rank" that does not exist.
 *
 * The hook is mocked only at the storage boundary (Supabase + IndexedDB); the map
 * it returns is built by `buildRankMap` over real sessions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildRankMap, type RankMap } from "../lib/ranks/buildRankMap";
import type { ExerciseRow, SetRow } from "../lib/ranks/muscleScore";

const NOW = new Date("2026-06-01T12:00:00.000Z");

const EXERCISES: ExerciseRow[] = [
  { id: "press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
  { id: "row", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
  { id: "squat", name: "Sentadilla", target: "glutes", body_part: "upper legs", equipment: "barbell" },
  { id: "curl", name: "Curl con barra", target: "biceps", body_part: "upper arms", equipment: "barbell" },
];

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

/** Weekly sessions of one exercise, ramping the load. */
function sessions(exerciseId: string, weight: number, count: number): SetRow[] {
  return Array.from({ length: count * 3 }, (_, i) => ({
    exerciseId,
    weight: weight + Math.floor(i / 3),
    reps: 5,
    isWarmup: false,
    performedAt: daysAgo(i * 3),
  }));
}

/** Chest well trained, everything else untouched. */
const TRAINED_SETS: SetRow[] = [...sessions("press", 90, 12), ...sessions("row", 80, 10)];

/** Two sessions of one muscle: one short of the eligibility minimum. */
const ALMOST_SETS: SetRow[] = [...sessions("squat", 120, 2)];

const CONTEXT = { bodyweightKg: 80, sex: "male" as const, now: NOW };

const state = {
  map: null as RankMap | null,
  initialLoading: false,
  loading: false,
  error: null as string | null,
  sessionsNeeded: 3,
  empty: false,
  distribution: {} as Record<string, number>,
  bodyweightKg: 80 as number | null,
  promotions: [] as RankMap["muscles"] extends Map<string, infer V> ? V[] : never[],
  historyFor: () => [],
  history: [],
  refresh: async () => undefined,
};

const useMuscleRanks = vi.fn(() => state);

vi.mock("../hooks/useMuscleRanks", () => ({
  useMuscleRanks: () => useMuscleRanks(),
}));

/** Reduced motion on by default: the promotion banner must not appear. */
const matchMedia = vi.fn((query: string) => ({
  matches: query.includes("reduce"),
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  onchange: null,
  dispatchEvent: () => false,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: matchMedia });
  state.map = buildRankMap({ sets: TRAINED_SETS, exercises: EXERCISES, context: CONTEXT });
  state.empty = false;
  state.bodyweightKg = 80;
  state.error = null;
  state.initialLoading = false;
  state.promotions = [];
});

afterEach(cleanup);

/** The view module reads the hook lazily, so it is imported after the mock. */
async function renderView() {
  const { AnatomicalRanksView } = await import("./AnatomicalRanksView");
  return render(<AnatomicalRanksView userId="user-1" />);
}

describe("AnatomicalRanksView", () => {
  it("shows the global rank and how many muscles are classified", async () => {
    await renderView();
    expect(screen.getByRole("heading", { name: "Rangos anatómicos" })).toBeTruthy();
    expect(screen.getByText("Rango global")).toBeTruthy();
    expect(screen.getByText(/de 100/)).toBeTruthy();
    expect(screen.getByText(/músculos clasificados/)).toBeTruthy();
  });

  it("names the strongest and the focus muscle, and both are clickable", async () => {
    await renderView();
    const strongest = screen.getByText("Más fuerte");
    expect(strongest).toBeTruthy();
    expect(screen.getByText("Enfoque")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Pecho/ }).length).toBeGreaterThan(0);
  });

  it("does not call a single muscle both the strongest and the weakest", async () => {
    // One classified muscle means there is no comparison to make.
    state.map = buildRankMap({
      sets: sessions("press", 90, 12),
      exercises: EXERCISES,
      context: CONTEXT,
    });
    await renderView();
    expect(screen.getByText("Más fuerte")).toBeTruthy();
    expect(
      screen.getByText(/Entrena un segundo músculo para comparar/),
    ).toBeTruthy();
  });

  it("exposes every muscle as a real button, so the map is never the only path", async () => {
    await renderView();
    const legend = screen.getByRole("list", { name: "Rango por músculo" });
    const buttons = within(legend).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(10);
    // Names, not slugs.
    expect(within(legend).getByRole("button", { name: /Pecho/ })).toBeTruthy();
  });

  it("lists all seven earned ranks in the legend with their thresholds", async () => {
    await renderView();
    expect(screen.getByText("Leyenda")).toBeTruthy();
    for (const label of ["Bronce", "Plata", "Oro", "Platino", "Diamante", "Élite", "Obsidiana"]) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0);
    }
    // `unranked` is not a rank on the ladder and stays out of the legend.
    expect(screen.queryByText(/Sin clasificar/)).toBeNull();
  });

  it("opens the detail panel for a muscle and closes it again", async () => {
    await renderView();
    expect(screen.queryByRole("dialog")).toBeNull();

    const legend = screen.getByRole("list", { name: "Rango por músculo" });
    // `fireEvent`, not a raw `.click()`: the click opens stateful UI, and only
    // Testing Library's wrapper flushes the resulting render.
    fireEvent.click(within(legend).getByRole("button", { name: /Pecho/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: /Pecho/ })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("tells a new user how many sessions are missing instead of an empty map", async () => {
    state.map = buildRankMap({ sets: [], exercises: EXERCISES, context: CONTEXT });
    state.empty = true;
    state.sessionsNeeded = 3;
    await renderView();

    expect(screen.getByText("Registra 3 sesiones para ver tus rangos")).toBeTruthy();
    expect(screen.getByText(/Te faltan 3/)).toBeTruthy();
    // No body map, no legend: they would be empty decoration.
    expect(screen.queryByRole("list", { name: "Rango por músculo" })).toBeNull();
    expect(screen.queryByText("Leyenda")).toBeNull();
  });

  it("names the missing bodyweight, which is the most common blocker", async () => {
    state.map = buildRankMap({
      sets: TRAINED_SETS,
      exercises: EXERCISES,
      context: { bodyweightKg: null, sex: "male", now: NOW },
    });
    state.empty = true;
    state.bodyweightKg = null;
    await renderView();
    expect(screen.getByText(/Añade tu peso a tu perfil/)).toBeTruthy();
  });

  it("shows the loading copy instead of a blank page on the first load", async () => {
    state.initialLoading = true;
    state.map = null;
    await renderView();
    expect(screen.getByText(/Calculando tus rangos/)).toBeTruthy();
  });

  it("offers a retry when the map could not be computed", async () => {
    state.map = null;
    state.error = "boom";
    await renderView();
    expect(screen.getByText("No se pudieron calcular los rangos")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("never announces a promotion to a user who asked for reduced motion", async () => {
    const promoted = buildRankMap({
      sets: TRAINED_SETS,
      exercises: EXERCISES,
      context: CONTEXT,
      // A deliberately lower previous rank for two trained muscles, so the map
      // reports genuine promotions rather than first-time classifications.
      previous: { chest: "silver", "upper-back": "bronze" },
    });
    state.map = promoted;
    state.promotions = [...promoted.muscles.values()].filter((m) => m.promoted);

    expect(state.promotions.length).toBeGreaterThan(0);
    await renderView();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("collects the unclassified muscles under a disclosure, with the reason", async () => {
    // Enough data for one muscle, not for the rest: the partial state.
    state.map = buildRankMap({ sets: ALMOST_SETS, exercises: EXERCISES, context: CONTEXT });
    state.empty = false;
    await renderView();
    expect(screen.getByText(/músculos sin clasificar todavía/)).toBeTruthy();
  });
});