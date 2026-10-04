/**
 * @vitest-environment jsdom
 *
 * `/perfil` is the screen a user opens to answer "what have you got me set up as?",
 * so the assertions here are about it showing the *stored* values and about the two
 * things that are supposed to be editable without a modal.
 *
 * The numbers are computed by the real `computeEnergyTargets` from a real profile
 * row rather than a stubbed report: a profile screen whose readouts disagree with
 * the engine that drives the rest of the app is worse than no screen, and a
 * hand-written fixture would hide exactly that.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Outlet, Route, Routes } from "react-router-dom";
import { MemoryRouter, useLocation } from "react-router-dom";

const db = vi.hoisted(() => ({
  /** What `.select("*")` on `profiles` resolves with. */
  profile: null as Record<string, unknown> | null,
  update: vi.fn(),
}));

vi.mock("@lib/supabase", () => {
  const builder = () => {
    const value = db.profile ? { data: db.profile, error: null } : { data: null, error: null };
    return {
      select: () => builder(),
      eq: () => builder(),
      maybeSingle: () => Promise.resolve(value),
      single: () => Promise.resolve(value),
      then: (onOk: (v: unknown) => unknown) => Promise.resolve(value).then(onOk),
    };
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => builder(),
            update: (patch: Record<string, unknown>) => {
              db.update(patch);
              if (db.profile) db.profile = { ...db.profile, ...patch };
              return builder();
            },
          };
        }
        return { select: () => builder(), from: () => builder() };
      },
      auth: { signOut: vi.fn() },
    },
  };
});

import { ProfileView, bmiOf, configuredSizes } from "./ProfileView";
import {
  ACTIVITY_LABELS,
  EXPERIENCE_LABELS,
  GYM_LABELS,
  GOAL_LABELS,
  PROFILE_LABELS,
} from "@/lib/i18n";
import { ACTIVITY_FACTORS } from "@/lib/profile";
import { GymSettingsProvider } from "@/context/GymSettingsContext";
import {
  COACH_PATH,
  NAV_DESTINATIONS,
  SECONDARY_DESTINATIONS,
} from "@/components/shell/navItems";
import type { WorkspaceOutletContext } from "@/App";

const EMAIL = "someone@example.com";

/** A 34-year-old, 180 cm, 82 kg, already set up for strength. */
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

/**
 * `ProfileView` reads its user through the router outlet, so the test has to
 * reproduce the real shape: a parent route that renders `<Outlet context>` with a
 * child route underneath. Wrapping it the other way round would leave the hook
 * reading an empty context and the screen would never load a profile.
 */
/** Reports where the router actually is, so the coach card's link can be checked for real. */
function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

function renderView() {
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
            <Route index element={<ProfileView />} />
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
});

afterEach(cleanup);

describe("ProfileView stored values", () => {
  it("shows the account's email, which the gate already resolved", async () => {
    renderView();
    // In the header and in the read-only identity field: the second is what a
    // screen reader reads when the user navigates the sections, so it has to be
    // there too, not just decorative in the header.
    await waitFor(() => expect(screen.getAllByText(EMAIL).length).toBeGreaterThanOrEqual(2));
  });

  it("shows the body metrics stored, not a form to re-enter them", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText("180 cm")).toBeTruthy());

    expect(screen.getByText("82 kg")).toBeTruthy();
    expect(screen.getByText(ROW.birth_date as string)).toBeTruthy();
    // A minor's flag is spelled out, because it changes the legal calorie floor.
    expect(screen.getByText(/\(menor de edad\)|años$/)).toBeTruthy();
  });

  it("names the experience, activity and goal currently in effect", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(EXPERIENCE_LABELS.intermediate)).toBeTruthy());

    const activity = screen.getByRole("button", {
      name: `${ACTIVITY_LABELS.moderate} ×${ACTIVITY_FACTORS.moderate}`,
    });
    expect(activity.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: GOAL_LABELS.strength }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("shows the daily energy targets the app will actually coach against", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.energyTdee)).toBeTruthy());

    // Metric, so a kcal figure with the unit, not the imperial spelling.
    expect(screen.getAllByText(/kcal$/).length).toBeGreaterThan(0);
  });
});

describe("ProfileView inline edits", () => {
  it("writes a new experience level without a modal", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(EXPERIENCE_LABELS.intermediate)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: EXPERIENCE_LABELS.advanced }));

    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ experience_level: "advanced" }));
  });

  it("writes a new goal without a modal", async () => {
    renderView();
    await waitFor(() => expect(screen.getByRole("button", { name: GOAL_LABELS.strength })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: GOAL_LABELS.endurance }));

    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ goal: "endurance" }));
  });

  it("never sends the primary key, which is not client-writable", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(EXPERIENCE_LABELS.intermediate)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: EXPERIENCE_LABELS.beginner }));

    await waitFor(() => expect(db.update).toHaveBeenCalled());
    expect(db.update.mock.calls[0][0]).not.toHaveProperty("user_id");
  });
});

describe("ProfileView entry points", () => {
  it("offers the same gym-settings panel the logger uses, named for this screen", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.gymSettingsLabel)).toBeTruthy());

    // Qualified, because "Ajustes del gimnasio" alone is indistinguishable from
    // this screen's own settings when both are on screen at once.
    expect(
      screen.getByRole("button", {
        name: GYM_LABELS.triggerAriaLabel(GYM_LABELS.profileTriggerContext),
      }),
    ).toBeTruthy();
  });

  it("opens the import wizard, which is the only bulk write in the app", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.importLabel)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: PROFILE_LABELS.importOpen }));

    // Step one, not a finished import: nothing is written from this screen.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("¿De dónde viene el archivo?")).toBeTruthy();
  });
});

describe("ProfileView premium coach card", () => {
  it("pitches the coach here, where the redesign moved it from the bar", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.premiumLabel)).toBeTruthy());
    expect(screen.getByText(PROFILE_LABELS.premiumCoachName)).toBeTruthy();
  });

  it("names what the workspace actually contains, not a subscription", async () => {
    // Three concrete things an athlete can look for in the screen they are about to
    // enter. A pitch that promised something the screen does not do would be the one
    // lie in a product whose whole organising rule is not to lie about a body.
    renderView();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.premiumLabel)).toBeTruthy());
    for (const feature of PROFILE_LABELS.premiumFeatures) {
      expect(screen.getByText(feature)).toBeTruthy();
    }
  });

  it("is the way into the coach workspace, which has no navigation entry", async () => {
    // `COACH_PATH` is deliberately absent from `navItems.ts`, so this card is the only
    // route into the briefing, the chat, the notes and the pending recommendations.
    // Drop it and the coach becomes unreachable, not merely unadvertised.
    renderView();
    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.premiumLabel)).toBeTruthy());

    const advertised = [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS].map((d) => d.path);
    expect(advertised).not.toContain(COACH_PATH);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROFILE_LABELS.premiumOpen) }));
    expect(screen.getByTestId("location").textContent).toBe(COACH_PATH);
  });
});

describe("ProfileView pure helpers", () => {
  it("refuses a body-mass index it cannot compute", () => {
    expect(bmiOf(82, 180)).toBe(25.3);
    expect(bmiOf(null, 180)).toBeNull();
    expect(bmiOf(82, null)).toBeNull();
    // Zero is not a body, and a division by it is not a BMI.
    expect(bmiOf(82, 0)).toBeNull();
    expect(bmiOf(0, 180)).toBeNull();
  });

  it("lists only the plates the user actually owns, smallest first", () => {
    expect(configuredSizes({ 20: 4, 2.5: 0, 15: 2 })).toEqual([15, 20]);
    // A plate size the column was added for but never filled in is not owned.
    expect(configuredSizes({ 1.25: undefined, 20: 4 })).toEqual([20]);
    expect(configuredSizes({})).toEqual([]);
  });

  it("describes an empty rack rather than claiming no plates exist", () => {
    expect(GYM_LABELS.platesSummary(configuredSizes({}))).toBe("Sin discos configurados.");
    // Smallest first, because that is the order a lifter racks them in and the
    // order `configuredSizes` hands over.
    expect(GYM_LABELS.platesSummary(configuredSizes({ 20: 4, 15: 2, 2.5: 0 }))).toContain("15, 20");
  });
});

describe("ProfileView failure", () => {
  it("offers a retry instead of a blank screen when the row is missing", async () => {
    db.profile = null;
    renderView();

    await waitFor(() => expect(screen.getByText(PROFILE_LABELS.notLoaded)).toBeTruthy());
    expect(screen.getByRole("button", { name: PROFILE_LABELS.retry })).toBeTruthy();
  });
});
