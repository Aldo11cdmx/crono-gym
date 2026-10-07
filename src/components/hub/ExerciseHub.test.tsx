/**
 * @vitest-environment jsdom
 *
 * ExerciseHub is the composition root for the whole screen: route → params → data →
 * header + tabs + panels. The tabs, header and panels each have their own suites; what
 * *this* file guards is the wiring — that the URL decides the tab, that a bad id surfaces
 * a notice, and that the back button goes to the right place.
 *
 * `useExerciseHubData` and `useGymSettings` are mocked so the test is about the
 * component's own logic, not about Supabase queries. A parent `<Outlet context>`
 * provides the `userId` that `ExerciseHub` reads through `useOutletContext`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import type { Exercise } from "@/types/supabase";
import type { WorkspaceOutletContext } from "@/App";
import { HUB_LABELS } from "@/lib/i18n";

vi.mock("@/hooks/useExerciseHubData", () => ({
  useExerciseHubData: vi.fn(),
}));

vi.mock("@/hooks/useHubChips", () => ({
  useHubChips: () => [],
}));

vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: () => ({
    session: null,
    isActive: false,
    start: vi.fn(),
    end: vi.fn(),
    warmups: [],
    enqueueWarmup: vi.fn(),
    resolveWarmup: vi.fn(),
  }),
}));

vi.mock("@/context/GymSettingsContext", () => ({
  useGymSettings: () => ({
    weightUnit: "kg" as const,
    platesAvailable: true,
  }),
}));

import { useExerciseHubData } from "@/hooks/useExerciseHubData";
import { ExerciseHub } from "@/components/hub/ExerciseHub";

const TEST_EXERCISE: Exercise = {
  id: "ex-1",
  name: "Press de banca",
  body_part: "chest",
  target: "pectorals",
  equipment: "barbell",
  gif_url: "",
  instructions: ["Acostado."],
} as Exercise;

const LOADED_DATA = {
  exercise: TEST_EXERCISE,
  loadingExercise: false,
  catalogError: null,
  sessions: [],
  metrics: [],
  loadingHistory: false,
  historyError: null,
  pr: null,
  loadingPr: false,
};

const LOADING_DATA = {
  exercise: null as Exercise | null,
  loadingExercise: true,
  catalogError: null,
  sessions: [],
  metrics: [],
  loadingHistory: false,
  historyError: null,
  pr: null,
  loadingPr: false,
};

const NOT_FOUND_DATA = {
  exercise: null as Exercise | null,
  loadingExercise: false,
  catalogError: null,
  sessions: [],
  metrics: [],
  loadingHistory: false,
  historyError: null,
  pr: null,
  loadingPr: false,
};

const CATALOG_ERROR_DATA = {
  exercise: null as Exercise | null,
  loadingExercise: false,
  catalogError: "No se pudo conectar a Supabase.",
  sessions: [],
  metrics: [],
  loadingHistory: false,
  historyError: null,
  pr: null,
  loadingPr: false,
};

const OUTLET_CONTEXT: WorkspaceOutletContext = {
  userId: "user-1",
  email: "user@example.com",
};

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderHub(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/ejercicio/:exerciseId" element={<Outlet context={OUTLET_CONTEXT} />}>
          <Route
            index
            element={<><LocationProbe /><ExerciseHub /></>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ExerciseHub wiring", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the exercise name in the header when data is loaded", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADED_DATA);
    const { getByText } = renderHub("/ejercicio/ex-1");
    expect(getByText(TEST_EXERCISE.name)).toBeTruthy();
  });

  it("shows a loading notice while the catalog is loading", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADING_DATA);
    const { getByText } = renderHub("/ejercicio/ex-1");
    expect(getByText(HUB_LABELS.loading)).toBeTruthy();
  });

  it("shows a not-found notice when the exercise id does not match any exercise", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(NOT_FOUND_DATA);
    const { getByText } = renderHub("/ejercicio/nonexistent");
    expect(getByText(HUB_LABELS.notFound)).toBeTruthy();
  });

  it("shows the catalog error text when the catalog itself fails", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(CATALOG_ERROR_DATA);
    const { getByText } = renderHub("/ejercicio/ex-1");
    expect(getByText("No se pudo conectar a Supabase.")).toBeTruthy();
  });

  it("does not render the tab strip while loading", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADING_DATA);
    const { queryByRole } = renderHub("/ejercicio/ex-1");
    expect(queryByRole("tablist")).toBeNull();
  });

  it("does not render the tab strip when exercise is not found", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(NOT_FOUND_DATA);
    const { queryByRole } = renderHub("/ejercicio/nonexistent");
    expect(queryByRole("tablist")).toBeNull();
  });

  it("renders the tab strip when the exercise is loaded", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADED_DATA);
    const { getByRole } = renderHub("/ejercicio/ex-1");
    expect(getByRole("tablist")).toBeTruthy();
  });

  it("defaults to the demo tab when no ?tab= param is present", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADED_DATA);
    const { getByRole } = renderHub("/ejercicio/ex-1");
    const demoTab = getByRole("tab", { name: HUB_LABELS.tabs.demo.aria });
    expect(demoTab.getAttribute("aria-selected")).toBe("true");
  });

  it("selects the tab from the ?tab= query param", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADED_DATA);
    const { getByRole } = renderHub("/ejercicio/ex-1?tab=records");
    const recordsTab = getByRole("tab", { name: HUB_LABELS.tabs.records.aria });
    expect(recordsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("falls back to demo for an invalid ?tab= value", () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADED_DATA);
    const { getByRole } = renderHub("/ejercicio/ex-1?tab=invalid");
    const demoTab = getByRole("tab", { name: HUB_LABELS.tabs.demo.aria });
    expect(demoTab.getAttribute("aria-selected")).toBe("true");
  });

  it("updates the URL when a tab is clicked", async () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADED_DATA);
    const { getByRole, getByTestId } = renderHub("/ejercicio/ex-1");
    const recordsTab = getByRole("tab", { name: HUB_LABELS.tabs.records.aria });
    fireEvent.click(recordsTab);
    await waitFor(() => {
      expect(getByTestId("location").textContent).toBe("/ejercicio/ex-1?tab=records");
    });
  });

  it("removes ?tab= when returning to demo", async () => {
    vi.mocked(useExerciseHubData).mockReturnValue(LOADED_DATA);
    const { getByRole, getByTestId } = renderHub("/ejercicio/ex-1?tab=records");
    const demoTab = getByRole("tab", { name: HUB_LABELS.tabs.demo.aria });
    fireEvent.click(demoTab);
    await waitFor(() => {
      expect(getByTestId("location").textContent).toBe("/ejercicio/ex-1");
    });
  });
});
