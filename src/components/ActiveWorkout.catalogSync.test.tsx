/**
 * @vitest-environment jsdom
 *
 * What a coach changes in the portal has to reach a session that is already
 * open: the rename lands in the middle of a set, and the athlete should not have
 * to reload to see the exercise they are actually doing.
 *
 * The catalog is supplied in memory (the real one needs IndexedDB); everything
 * with a side effect is mocked, as in `ActiveWorkout.test.tsx`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActiveWorkout } from "./ActiveWorkout";
import { ActiveSessionProvider } from "../context/ActiveSessionContext";
import { GymSettingsProvider } from "../context/GymSettingsContext";
import type { Exercise } from "@/types/supabase";
import type { PlannedExercise } from "../hooks/useGymData";
import {
  CATALOG_OVERRIDES_KEY,
  EXERCISE_NAME_OVERRIDES_KEY,
  invalidateOverridesSnapshot,
} from "@/lib/catalog/customExercises";
import { resetCatalogRegistry, setLoadedCatalog } from "@/lib/catalog/catalogRegistry";
import type { CatalogExercise } from "@/lib/catalog/types";

const catalogRows = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock("@/hooks/useExerciseCatalog", () => ({
  useExerciseCatalog: () => ({ exercises: catalogRows.rows, loading: false, error: null, refresh: async () => undefined, find: () => null }),
  normaliseExerciseName: (value: string) => value.toLowerCase(),
  CATALOG_UPDATED_EVENT: "cronos:catalog-updated",
}));

vi.mock("@lib/supabase", () => ({
  supabase: { auth: {}, from: () => ({ select: () => ({ maybeSingle: async () => null }) }) },
}));
vi.mock("../lib/sessionSync", () => ({ queueAndSync: vi.fn(async () => null) }));
vi.mock("../lib/offlineStore", () => ({
  loadRecoverableDraft: vi.fn(async () => null),
  saveDraft: vi.fn(async () => undefined),
  deleteDraft: vi.fn(async () => undefined),
  newSessionId: () => "log-test",
}));
vi.mock("../hooks/useOfflineSync", () => ({
  useOfflineSync: () => ({
    status: "idle",
    pending: 0,
    online: true,
    error: null,
    syncNow: async () => undefined,
  }),
}));
vi.mock("../hooks/usePreviousPerformance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/usePreviousPerformance")>();
  return {
    ...actual,
    usePreviousPerformance: () => ({ performance: {}, previousNotes: {} }),
  };
});
vi.mock("./ExerciseBrowser", () => ({ ExerciseBrowser: () => null }));
vi.mock("./TutorialModal", () => ({ TutorialModal: () => null }));
vi.mock("./NotionJournal", () => ({ NotionJournal: () => null }));
vi.mock("./ExerciseCarousel", () => ({ ExerciseCarousel: () => null }));
vi.mock("../lib/audio", () => ({
  playBeep: vi.fn(() => true),
  isRecordBeepActive: vi.fn(() => false),
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

const EXERCISE = {
  id: "0001",
  name: "Push-up",
  name_es: "Flexión",
  body_part: "chest",
  target: "pectorals",
  equipment: "body weight",
  gif_url: "https://cdn.example/push-up.gif",
  instructions: [],
  is_active: true,
  is_hidden: false,
} as Exercise;

function planned(): PlannedExercise[] {
  return [
    {
      exercise: EXERCISE,
      target_sets: 3,
      rest_seconds: 90,
      rowId: "row-1",
      order_index: 0,
      target_reps_min: null,
      target_reps_max: null,
      dayIndex: null,
      dayLabel: "",
    },
  ];
}

function renderWorkout() {
  return render(
    <ActiveSessionProvider>
      <GymSettingsProvider>
        <ActiveWorkout
          userId="user-1"
          routineId={null}
          routineTitle="Fuerza"
          planned={planned()}
          onFinished={() => undefined}
        />
      </GymSettingsProvider>
    </ActiveSessionProvider>,
  );
}

function renameInPortal(name: string): void {
  window.localStorage.setItem(
    CATALOG_OVERRIDES_KEY,
    JSON.stringify({ "0001": { customNameEs: name } }),
  );
  window.dispatchEvent(new CustomEvent("cronos:catalog-updated"));
}

beforeEach(() => {
  window.localStorage.clear();
  invalidateOverridesSnapshot();
  resetCatalogRegistry();
  // The picker reads the catalog through the loader's mirror; the session reads
  // the rows the loader last accepted.
  catalogRows.rows = [CATALOG_ROW];
  setLoadedCatalog([CATALOG_ROW]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ActiveWorkout catalog sync", () => {
  it("shows the exercise the catalog knows, and the rename the coach just made", async () => {
    renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar Entrenamiento/ }));

    expect(screen.getAllByText("Flexión").length).toBeGreaterThan(0);

    act(() => {
      renameInPortal("Flexiones");
    });

    await waitFor(() => expect(screen.getAllByText("Flexiones").length).toBeGreaterThan(0));
    expect(screen.queryByText("Flexión")).toBeNull();
  });

  it("keeps the sets already logged through a rename", async () => {
    renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar Entrenamiento/ }));

    const reps = screen.getAllByLabelText("Repeticiones serie 1")[0] as HTMLInputElement;
    fireEvent.change(reps, { target: { value: "12" } });

    act(() => {
      renameInPortal("Flexiones");
    });

    await waitFor(() => expect(screen.getAllByText("Flexiones").length).toBeGreaterThan(0));
    expect((screen.getAllByLabelText("Repeticiones serie 1")[0] as HTMLInputElement).value).toBe("12");
  });

  it("leaves the session alone when the catalog has not answered yet", () => {
    catalogRows.rows = [];
    setLoadedCatalog([]);
    renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar Entrenamiento/ }));

    // The planned row is what there is; a rename must not erase it.
    act(() => {
      renameInPortal("Flexiones");
    });
    expect(screen.getAllByText("Flexión").length).toBeGreaterThan(0);
  });

  /**
   * The reload regression, from the screen the athlete is looking at.
   *
   * A coach renames the movement, points it at "no machine" and gives it their
   * own demonstration; the write could not reach Supabase, so the server still
   * holds the shipped row. Reloading re-hydrates from that row, and the screen
   * must still show what the coach decided.
   */
  it("survives a reload that re-hydrates the shipped row", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({
        "0001": {
          customNameEs: "Flexiones",
          equipment_id: "NONE",
          station_key: "floor_mat_area",
          gif_url: "https://cdn.example/coach.gif",
          dirty: true,
          syncStatus: "pending",
        },
      }),
    );
    window.localStorage.setItem(
      EXERCISE_NAME_OVERRIDES_KEY,
      JSON.stringify({ "0001": "Flexiones" }),
    );
    invalidateOverridesSnapshot();

    renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar Entrenamiento/ }));

    expect(screen.getAllByText("Flexiones").length).toBeGreaterThan(0);
    expect(screen.queryByText("Flexión")).toBeNull();
  });

  it("shows the coach's name, demonstration and floor area for a reassigned exercise", async () => {
    renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar Entrenamiento/ }));

    act(() => {
      window.localStorage.setItem(
        CATALOG_OVERRIDES_KEY,
        JSON.stringify({
          "0001": {
            customNameEs: "Flexiones",
            equipment_id: "NONE",
            station_key: "floor_mat_area",
            gif_url: "https://cdn.example/coach.gif",
          },
        }),
      );
      window.dispatchEvent(new CustomEvent("cronos:catalog-updated"));
    });

    await waitFor(() => expect(screen.getAllByText("Flexiones").length).toBeGreaterThan(0));

    const demo = document.querySelector(`img[alt="Demo de Flexiones"]`);
    expect(demo).not.toBeNull();
    expect(demo?.getAttribute("src")).toContain("coach.gif");

    // `NONE` is a place, not a missing machine: the pill says where it happens
    // instead of naming the station the row used to belong to.
    const pills = screen.getAllByRole("button", { name: /Ubicación: Área de Piso \/ Tapete/ });
    expect(pills.length).toBeGreaterThan(0);
    expect(pills[0].textContent).toContain("Peso corporal");
    expect(screen.queryByText(/CG-EQP/)).toBeNull();
  });
});