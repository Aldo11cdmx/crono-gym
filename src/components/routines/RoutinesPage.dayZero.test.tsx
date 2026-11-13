/**
 * @vitest-environment jsdom
 *
 * A Day 0 plan is only useful if it survives the tap: the row has to appear in
 * "Mis Rutinas" at once, and the save has to reach the queue. The assistant
 * itself is replaced by a harness that hands over a finished plan, so what is
 * asserted here is the persistence around it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { RoutinesPage } from "./RoutinesPage";
import { buildDayZeroPlan, type DayZeroPlan } from "@/lib/routines/dayZeroPlan";
import type { CatalogExercise } from "@/lib/catalog/types";

const { gymMock, saveMock } = vi.hoisted(() => ({
  gymMock: { upsertLocalRoutine: vi.fn(), refresh: vi.fn(async () => undefined) },
  saveMock: {
    saveRoutine: vi.fn(
      async (_userId: string, _draft: unknown, _origin: string): Promise<{ ok: boolean; routineId: string | null }> => ({
        ok: true,
        routineId: "saved-1",
      }),
    ),
    flushSave: vi.fn(async (_draftKey: string) => undefined),
  },
}));

vi.mock("@/hooks/useGymData", () => ({
  useRoutines: () => ({
    routines: [],
    loading: false,
    error: null,
    refresh: gymMock.refresh,
    upsertLocalRoutine: gymMock.upsertLocalRoutine,
  }),
}));

vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: () => ({ isActive: false, start: vi.fn(), session: null }),
}));

vi.mock("@/lib/routines/saveRoutine", () => ({
  saveRoutine: (...args: unknown[]) => saveMock.saveRoutine(...(args as [string, unknown, string])),
  flushSave: (...args: unknown[]) => saveMock.flushSave(...(args as [string])),
}));

vi.mock("./DayZeroAssistant", () => ({
  DayZeroAssistant: ({ onCreated }: { onCreated: (plan: DayZeroPlan) => void }) => (
    <button type="button" onClick={() => onCreated(globalThis.__cronosDayZeroPlan as DayZeroPlan)}>
      Crear plan de prueba
    </button>
  ),
}));

const CATALOG_ROW: CatalogExercise = {
  id: "0001",
  name: "Push-up",
  name_es: "Flexión",
  category: "strength",
  body_part: "chest",
  equipment: "body weight",
  gif_url: "https://cdn.example/push-up.gif",
  image: "https://cdn.example/push-up.jpg",
  muscle_group: "chest",
  secondary_muscles: [],
  target: "pectorals",
  availableInCronosGym: true,
  equipment_id: "NONE",
  instructions: {},
  instruction_steps: {},
  media_id: "0001",
  created_at: "2026-01-01T00:00:00.000Z",
  attribution: null,
};

const OUTLET_CONTEXT: WorkspaceOutletContext = { userId: "user-1", email: "user@example.com" };

declare global {
  // eslint-disable-next-line no-var
  var __cronosDayZeroPlan: DayZeroPlan | undefined;
}

function tree() {
  return (
    <MemoryRouter initialEntries={["/rutinas"]}>
      <Routes>
        <Route path="/rutinas" element={<Outlet context={OUTLET_CONTEXT} />}>
          <Route index element={<RoutinesPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  gymMock.upsertLocalRoutine.mockClear();
  gymMock.refresh.mockClear();
  saveMock.saveRoutine.mockClear();
  saveMock.flushSave.mockClear();
  saveMock.saveRoutine.mockResolvedValue({ ok: true, routineId: "saved-1" });
  globalThis.__cronosDayZeroPlan = buildDayZeroPlan({
    catalog: [CATALOG_ROW],
    frequency: 3,
    goal: "hypertrophy",
    level: "beginner",
    newId: () => crypto.randomUUID(),
  });
});

afterEach(() => {
  cleanup();
  delete globalThis.__cronosDayZeroPlan;
});

function openAssistant() {
  render(tree());
  return screen.getByRole("button", { name: "Crear plan de prueba" });
}

describe("RoutinesPage · rutina de Día 0", () => {
  it("muestra la rutina antes de que la red responda, y la guarda con el plan", async () => {
    const create = openAssistant();

    await act(async () => {
      fireEvent.click(create);
    });

    expect(gymMock.upsertLocalRoutine).toHaveBeenCalledTimes(1);
    const optimistic = gymMock.upsertLocalRoutine.mock.calls[0][0] as { id: string; title: string; routineMode: string };
    expect(optimistic.id).toBeTruthy();
    expect(optimistic.routineMode).toBe("single");
    expect(optimistic.title).toBe("Cronos Day 0 · 1 día");

    await waitFor(() => expect(saveMock.saveRoutine).toHaveBeenCalledTimes(1));
    const [, draft, origin] = saveMock.saveRoutine.mock.calls[0] as unknown as [
      string,
      { draftKey: string; mode: string; days: unknown[] },
      string,
    ];
    expect(origin).toBe("day_zero");
    expect(draft.mode).toBe("single");
    expect(draft.days).toHaveLength(1);
    expect(saveMock.flushSave).toHaveBeenCalledWith(draft.draftKey);
    expect(gymMock.refresh).toHaveBeenCalled();
  });

  it("no pierde el plan cuando el servidor no acepta la escritura", async () => {
    saveMock.saveRoutine.mockResolvedValue({ ok: false, routineId: null });
    const create = openAssistant();

    await act(async () => {
      fireEvent.click(create);
    });

    await waitFor(() => expect(saveMock.saveRoutine).toHaveBeenCalled());
    // The optimistic row stays: deleting it would lose the plan over a network.
    expect(gymMock.upsertLocalRoutine).toHaveBeenCalledTimes(1);
    expect(gymMock.refresh).not.toHaveBeenCalled();
    expect(await screen.findByText(/solo en este dispositivo/i)).toBeTruthy();
  });
});