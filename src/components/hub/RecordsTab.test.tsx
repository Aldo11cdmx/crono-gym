/**
 * @vitest-environment jsdom
 *
 * RecordsTab.test.tsx — four tiles that must not invent anything.
 *
 * The claim under test throughout is that a record is either real or absent. The tempting
 * failure is rendering an absent record as `0`, which reads as "you lifted nothing" instead
 * of "you have not tried this yet" — and those two send somebody to completely different
 * places.
 *
 * The second claim is that `prs` outranks the in-memory scan. `loadExerciseHistory` is
 * capped at `HISTORY_LIMIT` sessions, so for anyone with a real history the set that set the
 * record is frequently *not* in the loaded window. A tab that only scanned what it happened
 * to be holding would quietly under-report the one number the tab exists to show.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RecordsTab } from "./RecordsTab";
import type { ExerciseSession } from "@/lib/exercise/exerciseHistory";
import type { SessionMetrics } from "@/lib/exercise/exerciseMetrics";
import type { AthletePR } from "@/hooks/useAthletePRs";
import { sessionMetrics } from "@/lib/exercise/exerciseMetrics";
import type { Exercise } from "@/types/supabase";

afterEach(cleanup);

/**
 * The profile seam, as a plain `vi.fn` closed over by the factory below.
 *
 * Not `vi.mocked(realHook)`: the factory returns a wrapper, not the mock itself, so
 * `vi.mocked` would be typing a spy that has no `mockReturnValue` on it. The factory is only
 * invoked when the module is first imported, which is after this binding is initialised.
 */
const useProfileMock = vi.fn(() => ({
  profile: { sex: "male", weight_kg: 80 } as never,
  energy: null,
  loading: false,
  saving: false,
  error: null,
  refresh: async () => undefined,
  update: async () => true,
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => useProfileMock(),
}));

function setProfile(over: { sex?: string | null; weight_kg?: number | null }) {
  useProfileMock.mockReturnValue({
    profile: { sex: "male", weight_kg: 80, ...over } as never,
    energy: null,
    loading: false,
    saving: false,
    error: null,
    refresh: async () => undefined,
    update: async () => true,
  });
}

const EXERCISE = {
  id: "bench",
  name: "Press de banca",
  body_part: "chest",
  target: "pectorals",
  equipment: "barbell",
  gif_url: "",
  instructions: [],
} as unknown as Exercise;

const DAY = 86400000;
const NOW = Date.parse("2026-06-01T12:00:00.000Z");

/** Newest first, matching `groupBySession`. */
function sessions(weights: readonly number[]): ExerciseSession[] {
  return weights.map((weight, index) => {
    const startedAt = new Date(NOW - index * 3 * DAY).toISOString();
    return {
      logId: `log-${index}`,
      startedAt,
      sets: [
        {
          id: `s-${index}`,
          log_id: `log-${index}`,
          exercise_id: "bench",
          set_number: 1,
          weight,
          reps: 5,
          rpe: null,
          notes: null,
          started_at: startedAt,
        },
      ],
    };
  });
}

function metricsFor(list: readonly ExerciseSession[]): SessionMetrics[] {
  return list.map((s) => sessionMetrics(s.logId, s.startedAt, s.sets));
}

function renderTab(over: {
  sessions?: ExerciseSession[];
  pr?: AthletePR | null;
  loading?: boolean;
} = {}) {
  const list = over.sessions ?? sessions([100]);
  return render(
    <RecordsTab
      exercise={EXERCISE}
      userId="u1"
      sessions={list}
      metrics={metricsFor(list)}
      pr={over.pr ?? null}
      loading={over.loading ?? false}
      unit="kg"
      convert={(kg) => kg}
    />,
  );
}

describe("RecordsTab", () => {
  it("says Sin marca rather than 0 for an exercise never trained", () => {
    renderTab({ sessions: [] });

    const group = screen.getByRole("group");
    expect(group.textContent).toMatch(/Sin marca/);
    // The absence has to survive into the accessibility tree as an absence. A dimmed zero
    // would screen readers announce as a real value.
    expect(group.textContent).not.toMatch(/>0</);
  });

  it("reports the heaviest set and the date it was set", () => {
    renderTab({ sessions: sessions([110, 100, 90]) });

    const group = screen.getByRole("group");
    expect(group.textContent).toMatch(/110/);
    // 110 is the newest session, so the date under the tile is the newest one -- not the
    // oldest, which is the easy mistake when the list runs newest-first.
    expect(group.textContent).toMatch(new Date(NOW).toISOString().slice(0, 10));
  });

  it("lets a pr outside the loaded window win over the scan", () => {
    // The scan only sees 100. The record table says 140, set months ago, and
    // `HISTORY_LIMIT` means that session simply is not loaded here.
    const pr: AthletePR = {
      exerciseId: "bench",
      exerciseName: "Press de banca",
      weightKg: 140,
      reps: 3,
      achievedAt: "2025-11-02T10:00:00.000Z",
    };
    renderTab({ sessions: sessions([100]), pr });

    const group = screen.getByRole("group");
    expect(group.textContent).toMatch(/140/);
    expect(group.textContent).toMatch(/2025-11-02/);
  });

  it("uses max single-set reps, not the session total", () => {
    // Three sets of 8. The session total is 24; "máx. repeticiones" is 8. Reporting 24
    // would make every multi-set exercise look like a rep PR.
    const list: ExerciseSession[] = [
      {
        logId: "log-0",
        startedAt: new Date(NOW).toISOString(),
        sets: [8, 8, 8].map((reps, index) => ({
          id: `s-${index}`,
          log_id: "log-0",
          exercise_id: "bench",
          set_number: index + 1,
          weight: 100,
          reps,
          rpe: null,
          notes: null,
          started_at: new Date(NOW).toISOString(),
        })),
      },
    ];
    renderTab({ sessions: list });

    const group = screen.getByRole("group");
    expect(group.textContent).not.toMatch(/\b24\b/);
  });

  it("converts the volume tile like any other load", () => {
    // Volume is kg·rep. On an imperial screen leaving it in kg would be the one figure on
    // screen not in the athlete's unit.
    render(
      <RecordsTab
        exercise={EXERCISE}
        userId="u1"
        sessions={sessions([100])}
        metrics={metricsFor(sessions([100]))}
        pr={null}
        loading={false}
        unit="lb"
        convert={(kg) => Math.round(kg * 2.20462)}
      />,
    );

    const group = screen.getByRole("group");
    expect(group.textContent).toMatch(/220/);
  });

  it("hides the strength standard until the pr query has answered", () => {
    renderTab({ sessions: sessions([100]), loading: true });
    // The badge is withheld while loading so it cannot appear against an empty estimate and
    // then jump once the answer lands.
    expect(screen.queryByText(/del estándar de/i)).toBeNull();
  });

  it("shows the standard once the estimate and a bodyweight are both known", () => {
    renderTab({ sessions: sessions([140]) });
    expect(screen.getByText(/del estándar de press de banca/i)).toBeTruthy();
  });

  it("suppresses the standard rather than guessing when the profile has no bodyweight", () => {
    setProfile({ weight_kg: null });
    renderTab({ sessions: sessions([140]) });

    // "Why is nothing ranked" is very often "you never entered your bodyweight", which is
    // actionable. Inventing a denominator would hide that behind a confident number.
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByText(/no tiene un estándar/i)).toBeTruthy();
  });
});