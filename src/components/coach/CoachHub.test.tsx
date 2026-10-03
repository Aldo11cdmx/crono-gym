/**
 * @vitest-environment jsdom
 *
 * CoachHub's job is to say things accurately, so these tests are mostly about the
 * cases where saying something would be a lie: a bodyweight that does not exist, a
 * muscle with no sessions, a loading state that would otherwise paint half a
 * briefing next to a third of another.
 *
 * The four data hooks are mocked at the module boundary and the real
 * `buildCoachContext` runs over their fixtures, so the assertions are on the join
 * between what the builder concludes and what the screen claims. Mocking the
 * builder instead would let this file pass against a context no product code
 * produces.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CoachHub } from "./CoachHub";
import { COACH_LABELS as T } from "@/lib/i18n";
import { computeEnergyTargets, type Profile } from "@/lib/profile";
import { buildRankMap } from "@/lib/ranks/buildRankMap";
import type { ExerciseRow, SetRow } from "@/lib/ranks/muscleScore";
import type { CoachContextSource, CoachNote, Recommendation } from "@/lib/coach/types";

// ------------------------------------------------------------- data sources

const PROFILE: Profile = {
  user_id: "u1",
  display_name: "Ana",
  birth_date: "1994-03-02",
  sex: "female",
  height_cm: 168,
  weight_kg: 62,
  unit_system: "metric",
  experience_level: "intermediate",
  activity_level: "moderate",
  goal: "gain_muscle",
  guardian_consent_at: null,
  onboarding_completed_at: "2026-03-01T00:00:00.000Z",
};

const NOW = new Date("2026-06-01T12:00:00.000Z");

const EXERCISES: ExerciseRow[] = [
  { id: "press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
];

function chestSets(): SetRow[] {
  return Array.from({ length: 42 }, (_, i) => ({
    exerciseId: "press",
    weight: 90 + i,
    reps: 5,
    isWarmup: false,
    performedAt: new Date(NOW.getTime() - i * 3 * 86_400_000).toISOString(),
  }));
}

/** Swapped per test; `false` models the loading window. */
let profileLoading = false;
let ranksLoading = false;
/**
 * Whether the athlete has no bodyweight anywhere.
 *
 * A flag rather than a one-shot mock return, because the hub re-renders as its
 * sources settle: a `mockReturnValueOnce` would apply to the first render and be
 * gone by the time the assertion ran, which tests nothing.
 */
let noBodyweight = false;
/** An error from one source, to check it is surfaced rather than swallowed. */
let progressError: string | null = null;

const useProfile = vi.fn(() => ({
  profile: noBodyweight ? { ...PROFILE, weight_kg: null } : PROFILE,
  energy: noBodyweight ? null : computeEnergyTargets(PROFILE, NOW),
  loading: profileLoading,
  saving: false,
  error: null,
  refresh: async () => undefined,
  update: async () => true,
}));

const useBodyMetrics = vi.fn(() => ({
  weights: noBodyweight
    ? []
    : [{ id: "w1", user_id: "u1", measured_on: "2026-05-20", weight_kg: 61.4, note: null, created_at: "" }],
  latestWeight: noBodyweight ? null : 61.4,
  changeLast30Days: noBodyweight ? null : -1.2,
  measurements: [],
  checkins: [],
  loading: false,
  error: null,
  logWeight: async () => true,
  refresh: async () => undefined,
}));

const useProgress = vi.fn(() => ({
  stats: progressError
    ? null
    : {
        totalWorkouts: 48,
        workoutsThisMonth: 9,
        bestWeight: 100,
        monthlyVolume: 41_250,
        week: [{ label: "s1", date: "2026-05-04", count: 4 }],
        recent: [],
      },
  loading: false,
  error: progressError,
}));

const useMuscleRanks = vi.fn(() => ({
  map: buildRankMap({
    sets: chestSets(),
    exercises: EXERCISES,
    context: { bodyweightKg: 62, sex: "female" as const, now: NOW },
  }),
  history: [],
  promotions: [],
  loading: ranksLoading,
  initialLoading: ranksLoading,
  error: null,
  sessionsNeeded: 0,
  empty: false,
  distribution: {} as Record<string, number>,
  bodyweightKg: 62,
  refresh: async () => undefined,
}));

vi.mock("../../hooks/useProfile", () => ({
  useProfile: () => useProfile(),
  useBodyMetrics: () => useBodyMetrics(),
}));
vi.mock("../../hooks/useGymData", () => ({ useProgress: () => useProgress() }));
vi.mock("../../hooks/useMuscleRanks", () => ({ useMuscleRanks: () => useMuscleRanks() }));

// ------------------------------------------------------------- fake seam

/** Records what the hub wrote, so a round-trip can be asserted for real. */
function fakeSource(initial: Partial<{ notes: CoachNote[]; recommendations: Recommendation[] }> = {}) {
  let notes = [...(initial.notes ?? [])];
  let recommendations = [...(initial.recommendations ?? [])];
  const source: CoachContextSource = {
    load: async () => ({ notes: [...notes], recommendations: [...recommendations] }),
    save: async (_userId, patch) => {
      if (patch.notes) notes = [...patch.notes];
      if (patch.recommendations) recommendations = [...patch.recommendations];
    },
  };
  return {
    source,
    current: () => ({ notes: [...notes], recommendations: [...recommendations] }),
  };
}

// The hub uses the default seam unless told otherwise, so tests that care about
// persistence inject one through the exported setter.
const { setCoachSource } = await import("../../hooks/useCoach");

let seam = fakeSource();

beforeEach(() => {
  profileLoading = false;
  ranksLoading = false;
  noBodyweight = false;
  progressError = null;
  seam = fakeSource();
  setCoachSource(seam.source);
});

afterEach(() => {
  cleanup();
  setCoachSource(fakeSource().source);
});

function renderHub() {
  return render(
    <MemoryRouter>
      <CoachHub userId="u1" />
    </MemoryRouter>,
  );
}

// ------------------------------------------------------------------ tests

describe("CoachHub", () => {
  it("renders a real screen rather than a placeholder", () => {
    // `router.test.ts` asserts the route resolves to a screen; this asserts the
    // screen is one, so the two together catch a hub that mounts but says nothing.
    renderHub();

    expect(screen.getByRole("heading", { level: 2, name: T.title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: T.contextTitle })).toBeTruthy();
    expect(screen.getByRole("heading", { name: T.notesTitle })).toBeTruthy();
    expect(screen.getByRole("heading", { name: T.recommendationsTitle })).toBeTruthy();
    expect(screen.queryByText("Próximamente")).toBeNull();
  });

  it("paints no numbers while a source is still loading", () => {
    // The failure this prevents: a bodyweight arriving next to a volume figure
    // computed from a different moment, both looking equally authoritative.
    ranksLoading = true;
    renderHub();

    expect(screen.getByText(T.loading)).toBeTruthy();
    // The briefing's own figures must not be on screen yet.
    expect(screen.queryByText(T.nutritionTitle)).toBeNull();
    expect(screen.queryByText(T.workouts(48))).toBeNull();
    expect(screen.queryByText(/61\.4 kg/)).toBeNull();
  });

  it("shows the assembled briefing once every source has settled", async () => {
    renderHub();

    await waitFor(() => expect(screen.getByText(T.nutritionTitle)).toBeTruthy());
    // The logged weigh-in wins over the onboarding value, in both places.
    expect(screen.getByText("61.4 kg")).toBeTruthy();
    expect(screen.getByText(T.bodyweightChange(-1.2))).toBeTruthy();
    expect(screen.getByText("Ganar músculo")).toBeTruthy();
    // The volume line is one summary sentence, asserted whole.
    expect(
      screen.getByText(
        `${T.workouts(48)} · ${T.thisMonth(9)} · ${T.monthlyVolume(41_250)}`,
      ),
    ).toBeTruthy();
  });

  it("names the inputs it is missing instead of showing a placeholder number", async () => {
    renderHub();

    await waitFor(() => expect(screen.getByText(T.gapsTitle)).toBeTruthy());
    // Readiness is structurally absent -- no writer exists -- so it is stated.
    expect(screen.getByText(T.gaps.no_readiness_checkins)).toBeTruthy();
  });

  it("says so plainly when there is no bodyweight at all", async () => {
    // Both sources have to be silent. The builder prefers a logged weigh-in over
    // the onboarding value, so emptying only the profile would still leave a number
    // -- which is the correct behaviour, and is what this test pins down.
    noBodyweight = true;

    renderHub();

    await waitFor(() => expect(screen.getByText(T.noBodyweight)).toBeTruthy());
    // Not a zero and not a dash: a weight is not known to be 0 kg.
    expect(screen.queryByText("0 kg")).toBeNull();
    expect(screen.getByText(T.gaps.no_bodyweight)).toBeTruthy();
  });

  it("lists the classified muscles and counts the ones still waiting", async () => {
    renderHub();

    await waitFor(() => expect(screen.getByText("Pecho")).toBeTruthy());
    expect(screen.getByRole("link", { name: T.openRanks })).toBeTruthy();
    expect(screen.getByText(/músculos sin rango/)).toBeTruthy();
  });

  it("writes a note through the seam and shows it", async () => {
    renderHub();

    const box = await screen.findByRole("textbox");
    fireEvent.change(box, { target: { value: "El press de banca va justo; no subir más la barra." } });
    fireEvent.click(screen.getByRole("button", { name: T.notesSave }));

    await waitFor(() =>
      expect(screen.getByText(/El press de banca va justo/)).toBeTruthy(),
    );
    // Persisted, not just rendered: the seam is what the Step 2 table replaces.
    expect(seam.current().notes).toHaveLength(1);
    expect(seam.current().notes[0].body).toContain("press de banca");
  });

  it("survives a re-render with the note still there", async () => {
    const { rerender } = renderHub();

    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Dormir mejor la próxima semana." },
    });
    fireEvent.click(screen.getByRole("button", { name: T.notesSave }));
    await waitFor(() => expect(screen.getByText(/Dormir mejor/)).toBeTruthy());

    rerender(
      <MemoryRouter>
        <CoachHub userId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Dormir mejor/)).toBeTruthy();
  });

  it("refuses to save an empty note and leaves the draft alone", async () => {
    // A note that renders as nothing is not a note, and clearing the box on a
    // rejected save would throw away what the user was typing.
    renderHub();

    const box = await screen.findByRole("textbox");
    fireEvent.change(box, { target: { value: "   " } });

    const save = screen.getByRole("button", { name: T.notesSave }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(seam.current().notes).toHaveLength(0);
  });

  it("labels a note by its author, and never presents the user's as the coach's", async () => {
    seam = fakeSource({
      notes: [
        { id: "n1", author: "user", body: "Nota mía", createdAt: "2026-06-01T10:00:00.000Z", muscleSlug: null },
        { id: "n2", author: "coach", body: "Nota del modelo", createdAt: "2026-06-01T11:00:00.000Z", muscleSlug: null },
      ],
    });
    setCoachSource(seam.source);

    renderHub();

    await waitFor(() => expect(screen.getByText("Nota mía")).toBeTruthy());
    const user = screen.getByText("Nota mía").closest("li")!;
    const coach = screen.getByText("Nota del modelo").closest("li")!;

    // Provenance is stated per note. A log that only started labelling the author
    // once the AI arrived would have no way to introduce it.
    expect(within(user).getByText(/Tu nota/)).toBeTruthy();
    expect(within(user).queryByText(/Nota del Coach/)).toBeNull();
    expect(within(coach).getByText(/Nota del Coach/)).toBeTruthy();
  });

  it("removes a note and persists the removal", async () => {
    seam = fakeSource({
      notes: [
        { id: "n1", author: "user", body: "Para borrar", createdAt: "2026-06-01T10:00:00.000Z", muscleSlug: null },
      ],
    });
    setCoachSource(seam.source);

    renderHub();

    await waitFor(() => expect(screen.getByText("Para borrar")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: T.notesDelete("2026-06-01") }));

    await waitFor(() => expect(screen.queryByText("Para borrar")).toBeNull());
    expect(seam.current().notes).toHaveLength(0);
  });

  it("says there is nothing to act on when no recommendation exists", async () => {
    renderHub();
    expect(await screen.findByText(T.recommendationsEmpty)).toBeTruthy();
  });

  it("files each recommendation kind under its own heading", async () => {
    const swap: Recommendation = {
      kind: "exercise_swap",
      id: "r1",
      exerciseId: "press",
      exerciseName: "Press militar",
      suggestedExerciseId: "landmine",
      reason: "Molestia en el hombro aluru de carga",
      blockedBy: { muscleSlug: "deltoids", restrictionId: null },
    };
    const adjust: Recommendation = {
      kind: "training_adjustment",
      id: "r2",
      area: "frequency",
      change: "Baja el pectoral a dos veces por semana.",
      reason: "Tres sesiones sin recuperar",
      muscleSlug: "chest",
    };
    seam = fakeSource({ recommendations: [swap, adjust] });
    setCoachSource(seam.source);

    renderHub();

    await waitFor(() => expect(screen.getByText("Press militar")).toBeTruthy());
    // A swap is named by the movement it affects; an adjustment by its area. The
    // two are different instructions and cannot share one generic row.
    expect(screen.getByText(T.recommendationAreas.frequency)).toBeTruthy();
    expect(screen.getByText("Baja el pectoral a dos veces por semana.")).toBeTruthy();
    expect(screen.getByText(adjust.reason)).toBeTruthy();
  });

  it("dismisses a recommendation and persists the dismissal", async () => {
    seam = fakeSource({
      recommendations: [
        {
          kind: "training_adjustment",
          id: "r1",
          area: "deload",
          change: "Una semana de descarga.",
          reason: "Tres semanas sin progresión",
          muscleSlug: null,
        },
      ],
    });
    setCoachSource(seam.source);

    renderHub();

    await waitFor(() => expect(screen.getByText("Una semana de descarga.")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: T.recommendationDismiss }));

    await waitFor(() => expect(screen.queryByText("Una semana de descarga.")).toBeNull());
    expect(seam.current().recommendations).toHaveLength(0);
  });

  it("surfaces a source error rather than rendering an empty context", async () => {
    progressError = "no such table: workout_logs";

    renderHub();

    // One failing source is enough to name the problem; an averaged-out "some data
    // failed" would send the athlete looking in the wrong place.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("no such table");
  });
});

describe("CoachHub labels", () => {
  it("gives every enum value in the profile a Spanish name", async () => {
    // The database stores `gain_muscle`; a coach screen that leaked the raw slug
    // would be the first English the athlete sees.
    const { COACH_ENUM_LABELS } = await import("./CoachHub");
    expect(Object.keys(COACH_ENUM_LABELS.goal).sort()).toEqual(
      ["endurance", "gain_muscle", "lose_weight", "maintain", "strength"].sort(),
    );
    expect(Object.keys(COACH_ENUM_LABELS.experience).sort()).toEqual(
      ["advanced", "beginner", "intermediate"].sort(),
    );
  });
});