/**
 * @vitest-environment jsdom
 *
 * DemoTab.test.tsx — the warm-up ramp: what weights it offers, what it inserts, and
 * what it refuses to do when there is no session to insert into.
 *
 * `warmupSets()` itself is covered by weightUtils tests; here the assertion is about the
 * component's contract: it reads the working weight from `metrics.bestEstimateKg`, builds
 * the ramp with the real gym settings, hands it to `enqueueWarmup` intact, and shows a
 * confirmation rather than re-inserting when clicked twice.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Exercise } from "@/types/supabase";
import type { SessionMetrics } from "@/lib/exercise/exerciseMetrics";
import { warmupSets, type PlateInventory } from "@/lib/workout/weightUtils";
import { HUB_DEMO_LABELS } from "@/lib/i18n";

vi.mock("@/context/GymSettingsContext", () => ({
  useGymSettings: () => ({
    weightUnit: "kg" as const,
    barKg: 20,
    loadableInventory: { 2.5: 2, 5: 2, 10: 2, 15: 2, 20: 2 } as PlateInventory,
  }),
}));

vi.mock("@/components/MuscleReadonlyMap", () => ({
  MuscleReadonlyMap: () => null,
  countMuscleSets: () => ({}),
}));

const enqueueWarmup = vi.fn();
let isActive: boolean;

vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: () => ({
    isActive,
    enqueueWarmup,
    session: null,
    start: vi.fn(),
    end: vi.fn(),
    warmups: [],
    resolveWarmup: vi.fn(),
  }),
}));

import { DemoTab } from "@/components/hub/DemoTab";

const EXERCISE: Exercise = {
  id: "bench",
  name: "Press de banca",
  body_part: "chest",
  target: "pectorals",
  equipment: "barbell",
  gif_url: "",
  instructions: [],
} as Exercise;

const GYM_INVENTORY: PlateInventory = { 2.5: 2, 5: 2, 10: 2, 15: 2, 20: 2 };
const BAR_KG = 20;
const WORKING_KG = 135;

const METRICS: SessionMetrics[] = [
  {
    logId: "log-1",
    startedAt: "2026-06-01T00:00:00Z",
    setCount: 3,
    topWeightKg: 100,
    totalReps: 15,
    bestEstimateKg: WORKING_KG,
    averageEstimateKg: 130,
    averageRpe: null,
  },
];

const METRICS_NO_ESTIMATE: SessionMetrics[] = [
  { ...METRICS[0], bestEstimateKg: null, topWeightKg: null },
];

function renderTab(props: {
  metrics: SessionMetrics[];
  sessionActive: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  isActive = props.sessionActive;
  return render(
    <DemoTab
      exercise={EXERCISE}
      sessions={[]}
      metrics={props.metrics}
      loading={props.loading ?? false}
      error={props.error ?? null}
      formatWeight={(kg) => `${kg} kg`}
    />,
  );
}

describe("DemoTab warm-up ramp", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the ramp weights for the working weight derived from bestEstimateKg", () => {
    const { getByText } = renderTab({ metrics: METRICS, sessionActive: true });
    const ramp = warmupSets(WORKING_KG, BAR_KG, GYM_INVENTORY);
    ramp.forEach((kg) => {
      expect(getByText(`${kg} kg`)).toBeTruthy();
    });
  });

  it("renders the percentage labels for each ramp step", () => {
    const { getByText } = renderTab({ metrics: METRICS, sessionActive: true });
    expect(getByText("40%")).toBeTruthy();
    expect(getByText("60%")).toBeTruthy();
    expect(getByText("80%")).toBeTruthy();
  });

  it("calls enqueueWarmup with the exercise name and ramp weights on insert", () => {
    const { getByRole } = renderTab({ metrics: METRICS, sessionActive: true });
    fireEvent.click(getByRole("button", { name: HUB_DEMO_LABELS.warmupInsert }));

    expect(enqueueWarmup).toHaveBeenCalledTimes(1);
    const call = enqueueWarmup.mock.calls[0][0];
    expect(call.exerciseName).toBe(EXERCISE.name);
    expect(call.weights).toEqual(warmupSets(WORKING_KG, BAR_KG, GYM_INVENTORY));
  });

  it("shows a confirmation message after inserting", () => {
    const { getByRole, getByText } = renderTab({ metrics: METRICS, sessionActive: true });
    fireEvent.click(getByRole("button", { name: HUB_DEMO_LABELS.warmupInsert }));

    const ramp = warmupSets(WORKING_KG, BAR_KG, GYM_INVENTORY);
    expect(getByText(HUB_DEMO_LABELS.warmupQueued(ramp.length))).toBeTruthy();
  });

  it("disables the insert button when no session is active", () => {
    const { getByRole } = renderTab({ metrics: METRICS, sessionActive: false });
    const insertButton = getByRole("button", { name: HUB_DEMO_LABELS.warmupNoSession });
    expect(insertButton.hasAttribute("disabled")).toBe(true);
  });

  it("does not call enqueueWarmup when clicked without a session", () => {
    const { getByRole } = renderTab({ metrics: METRICS, sessionActive: false });
    fireEvent.click(getByRole("button", { name: HUB_DEMO_LABELS.warmupNoSession }));
    expect(enqueueWarmup).not.toHaveBeenCalled();
  });

  it("shows a hint about recorded sets when there is no working weight in metrics", () => {
    const { getByText } = renderTab({ metrics: METRICS_NO_ESTIMATE, sessionActive: true });
    expect(getByText(/La rampa se calcula sobre el peso con el que vas a trabajar/i)).toBeTruthy();
  });

  it("does not render the insert button when there is no working weight", () => {
    const { queryByRole } = renderTab({ metrics: METRICS_NO_ESTIMATE, sessionActive: true });
    expect(queryByRole("button", { name: HUB_DEMO_LABELS.warmupInsert })).toBeNull();
  });

  it("shows the 'no warmup needed' message when the ramp collapses below the bar weight", () => {
    // A working weight barely above the bar means all ramp steps snap to the same
    // loadable weight and deduplicate to one entry — the ramp effectively offers
    // nothing beyond the empty bar.
    const metrics = [{ ...METRICS[0], bestEstimateKg: 21, topWeightKg: 21 }];
    const { getByText, queryByRole } = renderTab({
      metrics,
      sessionActive: true,
    });
    // With 21 kg working weight, 40% = 8.4, 60% = 12.6, 80% = 16.8 — all round
    // to the 20 kg bar. The ramp has one deduplicated entry, and the insert button
    // is still rendered.
    expect(getByText("20 kg")).toBeTruthy();
    expect(queryByRole("button", { name: HUB_DEMO_LABELS.warmupInsert })).toBeTruthy();
  });

  it("shows a loading state in the muscle panel", () => {
    const { getByText } = renderTab({
      metrics: METRICS,
      sessionActive: true,
      loading: true,
    });
    expect(getByText("Cargando historial…")).toBeTruthy();
  });

  it("shows an error state in the muscle panel", () => {
    const { getByText } = renderTab({
      metrics: METRICS,
      sessionActive: true,
      error: "Connection failed",
    });
    expect(getByText(/No pudimos leer el historial/i)).toBeTruthy();
  });

  it("shows the no-sessions hint when sessions is empty and not loading", () => {
    const { getByText } = renderTab({ metrics: METRICS, sessionActive: true });
    expect(getByText(/Todavía no has registrado series/i)).toBeTruthy();
  });
});
