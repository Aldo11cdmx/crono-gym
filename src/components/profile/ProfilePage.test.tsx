/**
 * @vitest-environment jsdom
 *
 * ProfilePage.test.tsx — the three-tab athlete command center.
 *
 * The assertions mirror ProfileView.test.tsx but are organised by tab: the
 * numbers are still computed by the real `computeEnergyTargets` from a real
 * profile row, and inline edits still write through the same `update` path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Outlet, Route, Routes } from "react-router-dom";
import { MemoryRouter, useLocation } from "react-router-dom";

const db = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  update: vi.fn(),
  weights: [] as unknown[],
}));

vi.mock("@lib/supabase", () => {
  function profileBuilder() {
    const value = db.profile ? { data: db.profile, error: null } : { data: null, error: null };
    return {
      select: () => profileBuilder(),
      eq: () => profileBuilder(),
      order: () => profileBuilder(),
      limit: () => Promise.resolve(value),
      maybeSingle: () => Promise.resolve(value),
      single: () => Promise.resolve(value),
      then: (onOk: (v: unknown) => unknown) => Promise.resolve(value).then(onOk),
    };
  }

  function weightBuilder() {
    const value = { data: db.weights, error: null };
    return {
      select: () => weightBuilder(),
      eq: () => weightBuilder(),
      order: () => weightBuilder(),
      limit: () => Promise.resolve(value),
      upsert: () => Promise.resolve({ data: null, error: null }),
      then: (onOk: (v: unknown) => unknown) => Promise.resolve(value).then(onOk),
    };
  }

  function emptyBuilder() {
    const value = { data: [], error: null };
    return {
      select: () => emptyBuilder(),
      eq: () => emptyBuilder(),
      order: () => emptyBuilder(),
      limit: () => Promise.resolve(value),
      then: (onOk: (v: unknown) => unknown) => Promise.resolve(value).then(onOk),
    };
  }

  return {
    supabase: {
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => profileBuilder(),
            update: (patch: Record<string, unknown>) => {
              db.update(patch);
              if (db.profile) db.profile = { ...db.profile, ...patch };
              return profileBuilder();
            },
          };
        }
        if (table === "bodyweight_entries") {
          return weightBuilder();
        }
        return emptyBuilder();
      },
      auth: {
        signOut: vi.fn(),
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
    },
  };
});

import { ProfilePage, bmiOf, configuredSizes } from "./ProfilePage";
import {
  ACTIVITY_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  GYM_LABELS,
  PROFILE_LABELS,
} from "@/lib/i18n";
import { ACTIVITY_FACTORS } from "@/lib/profile";
import { GymSettingsProvider } from "@/context/GymSettingsContext";
import { COACH_PATH, NAV_DESTINATIONS, SECONDARY_DESTINATIONS } from "@/components/shell/navItems";
import type { WorkspaceOutletContext } from "@/App";
import type { BodyweightEntry } from "@/types/supabase";

const EMAIL = "someone@example.com";

const ROW: Record<string, unknown> = {
  user_id: "user-1",
  display_name: "Alex",
  birth_date: "1992-04-17",
  sex: "male",
  height_cm: 180,
  weight_kg: 82,
  unit_system: "metric",
  experience_level: "intermediate",
  activity_level: "moderate",
  goal: "strength",
  guardian_consent_at: null,
  onboarding_completed_at: "2026-01-02T10:00:00Z",
};

const WEIGHTS: BodyweightEntry[] = [
  { id: "w1", user_id: "user-1", measured_on: "2026-09-01", weight_kg: 83, note: null, created_at: "2026-09-01T10:00:00Z" },
  { id: "w2", user_id: "user-1", measured_on: "2026-09-15", weight_kg: 82.5, note: null, created_at: "2026-09-15T10:00:00Z" },
  { id: "w3", user_id: "user-1", measured_on: "2026-10-01", weight_kg: 82, note: null, created_at: "2026-10-01T10:00:00Z" },
];

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/perfil"]}>
      <GymSettingsProvider>
        <Routes>
          <Route
            path="/perfil"
            element={
              <Outlet context={{ userId: "user-1", email: EMAIL } satisfies WorkspaceOutletContext} />
            }
          >
            <Route index element={<ProfilePage />} />
          </Route>
        </Routes>
        <LocationProbe />
      </GymSettingsProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  db.profile = { ...ROW };
  db.update.mockClear();
  db.weights = [...WEIGHTS];
});

afterEach(cleanup);

describe("ProfilePage tab navigation", () => {
  it("renders three tabs with correct labels and ARIA", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());
    expect(screen.getByText(PROFILE_LABELS.tabs.gym.label)).toBeTruthy();
    expect(screen.getByText(PROFILE_LABELS.tabs.preferences.label)).toBeTruthy();
  });

  it("has tablist and tab roles with correct ARIA", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: PROFILE_LABELS.tabs.biometric.aria })).toBeTruthy();
    expect(screen.getByRole("tab", { name: PROFILE_LABELS.tabs.gym.aria })).toBeTruthy();
    expect(screen.getByRole("tab", { name: PROFILE_LABELS.tabs.preferences.aria })).toBeTruthy();
  });

  it("shows the biometric tab content by default", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.bodyLabel)).toBeTruthy());
    expect(screen.getByText("180 cm")).toBeTruthy();
    // Gym tab content is not visible initially.
    expect(screen.queryByText(PROFILE_LABELS.gymSettingsLabel)).toBeNull();
  });

  it("switches to the gym tab when clicked", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.gym.label));

    expect(screen.getByText(PROFILE_LABELS.gymSettingsLabel)).toBeTruthy();
  });

  it("switches to the preferences tab when clicked", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.preferences.label));

    expect(screen.getByRole("button", { name: PROFILE_LABELS.signOut })).toBeTruthy();
  });
});

describe("ProfilePage biometric tab", () => {
  it("shows the account's email in the header", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(EMAIL)).toBeTruthy());
  });

  it("shows body metrics stored", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("180 cm")).toBeTruthy());
    expect(screen.getByText("82 kg")).toBeTruthy();
    expect(screen.getByText(ROW.birth_date as string)).toBeTruthy();
  });

  it("names the experience, activity and goal currently in effect", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(EXPERIENCE_LABELS.intermediate)).toBeTruthy());

    const activity = screen.getByRole("button", {
      name: `${ACTIVITY_LABELS.moderate} ×${ACTIVITY_FACTORS.moderate}`,
    });
    expect(activity.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: GOAL_LABELS.strength }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("shows the daily energy targets the app will actually coach against", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.energyTdee)).toBeTruthy());
    expect(screen.getAllByText(/kcal$/).length).toBeGreaterThan(0);
  });

  it("shows the weight trend when weigh-in data exists", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.weightTrendTitle)).toBeTruthy());
  });
});

describe("ProfilePage inline edits", () => {
  it("writes a new experience level without a modal", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(EXPERIENCE_LABELS.intermediate)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: EXPERIENCE_LABELS.advanced }));

    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ experience_level: "advanced" }));
  });

  it("writes a new goal without a modal", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: GOAL_LABELS.strength })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: GOAL_LABELS.endurance }));

    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ goal: "endurance" }));
  });

  it("never sends the primary key, which is not client-writable", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(EXPERIENCE_LABELS.intermediate)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: EXPERIENCE_LABELS.beginner }));

    await waitFor(() => expect(db.update).toHaveBeenCalled());
    expect(db.update.mock.calls[0][0]).not.toHaveProperty("user_id");
  });
});

describe("ProfilePage gym tab", () => {
  it("shows the same gym-settings panel the logger uses, named for this screen", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.gym.label));

    expect(screen.getByText(PROFILE_LABELS.gymSettingsLabel)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: GYM_LABELS.triggerAriaLabel(GYM_LABELS.profileTriggerContext) }),
    ).toBeTruthy();
  });

  it("opens the import wizard, which is the only bulk write in the app", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.gym.label));

    fireEvent.click(screen.getByRole("button", { name: PROFILE_LABELS.importOpen }));

    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("ProfilePage preferences tab", () => {
  it("shows the sign out button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.preferences.label));

    expect(screen.getByRole("button", { name: PROFILE_LABELS.signOut })).toBeTruthy();
  });

  it("shows the export button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.preferences.label));

    expect(screen.getByRole("button", { name: PROFILE_LABELS.exportButton })).toBeTruthy();
  });
});

describe("ProfilePage premium coach card", () => {
  it("pitches the coach on the preferences tab", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.preferences.label));

    expect(screen.getByText(PROFILE_LABELS.premiumLabel)).toBeTruthy();
    expect(screen.getByText(PROFILE_LABELS.premiumCoachName)).toBeTruthy();
  });

  it("names what the workspace actually contains, not a subscription", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.preferences.label));

    for (const feature of PROFILE_LABELS.premiumFeatures) {
      expect(screen.getByText(feature)).toBeTruthy();
    }
  });

  it("is the way into the coach workspace, which has no navigation entry", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.tabs.biometric.label)).toBeTruthy());

    fireEvent.click(screen.getByText(PROFILE_LABELS.tabs.preferences.label));

    const advertised = [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS].map((d) => d.path);
    expect(advertised).not.toContain(COACH_PATH);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROFILE_LABELS.premiumOpen) }));
    expect(screen.getByTestId("location").textContent).toBe(COACH_PATH);
  });
});

describe("ProfilePage pure helpers", () => {
  it("refuses a body-mass index it cannot compute", () => {
    expect(bmiOf(82, 180)).toBe(25.3);
    expect(bmiOf(null, 180)).toBeNull();
    expect(bmiOf(82, null)).toBeNull();
    expect(bmiOf(82, 0)).toBeNull();
    expect(bmiOf(0, 180)).toBeNull();
  });

  it("lists only the plates the user actually owns, smallest first", () => {
    expect(configuredSizes({ 20: 4, 2.5: 0, 15: 2 })).toEqual([15, 20]);
    expect(configuredSizes({ 1.25: undefined, 20: 4 })).toEqual([20]);
    expect(configuredSizes({})).toEqual([]);
  });

  it("describes an empty rack rather than claiming no plates exist", () => {
    expect(GYM_LABELS.platesSummary(configuredSizes({}))).toBe("Sin discos configurados.");
    expect(
      GYM_LABELS.platesSummary(configuredSizes({ 20: 4, 15: 2, 2.5: 0 })),
    ).toContain("15, 20");
  });
});

describe("ProfilePage failure", () => {
  it("offers a retry instead of a blank screen when the row is missing", async () => {
    db.profile = null;
    renderPage();

    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.notLoaded)).toBeTruthy());
    expect(screen.getByRole("button", { name: PROFILE_LABELS.retry })).toBeTruthy();
  });
});
