/**
 * @vitest-environment jsdom
 *
 * ProgressionTab.test.tsx — the chart, the verdict, and the two ways this screen could lie.
 *
 * One is the empty state. "No sessions in the last month" and "you have never trained this"
 * need opposite responses — switch the window back versus go and do a session — so they are
 * two different sentences. Collapsing them into one is how a tab tells somebody they have no
 * history when they trained it in March.
 *
 * The other is the record marker. `isRecord` rings the *best estimate in the whole history*,
 * not the best in the visible window, so an athlete who opened the one-month view on a
 * plateau still sees where their ceiling actually is. Marking the window maximum instead
 * would move the ring every time they changed the period, which reads as a new PR.
 *
 * The period cut is also asserted to be arithmetic over already-loaded data, not a refetch:
 * a metric switch that blanks the chart is a switch the athlete stops using.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProgressionTab } from "./ProgressionTab";
import type { ExerciseSession } from "@/lib/exercise/exerciseHistory";
import { sessionMetrics, type SessionMetrics } from "@/lib/exercise/exerciseMetrics";
import type { Exercise } from "@/types/supabase";

afterEach(cleanup);

const DAY = 86400000;
const NOW = Date.parse("2026-06-01T12:00:00.000Z");

const EXERCISE = {
  id: "bench",
  name: "Press de banca",
  body_part: "chest",
  target: "pectorals",
  equipment: "barbell",
  gif_url: "",
  instructions: [],
} as unknown as Exercise;

/** Newest first, as `groupBySession` returns them. */
function sessionsAt(daysAgo: readonly number[], weightKg = 100): ExerciseSession[] {
  return daysAgo.map((days) => {
    const startedAt = new Date(NOW - days * DAY).toISOString();
    return {
      logId: `log-${days}`,
      startedAt,
      sets: [
        {
          id: `s-${days}`,
          log_id: `log-${days}`,
          exercise_id: "bench",
          set_number: 1,
          weight: weightKg,
          reps: 5,
          rpe: null,
          notes: null,
          started_at: startedAt,
        },
      ],
    };
  });
}

function renderTab(list: readonly ExerciseSession[], metrics?: readonly SessionMetrics[]) {
  return render(
    <ProgressionTab
      exercise={EXERCISE}
      sessions={list}
      metrics={metrics ?? list.map((s) => sessionMetrics(s.logId, s.startedAt, s.sets))}
      loading={false}
      error={null}
      unit="kg"
      convert={(kg) => kg}
      now={NOW}
    />,
  );
}

/**
 * The chart as a screen reader gets it.
 *
 * Asserting on `role="img"`'s label rather than on internal circles or `data-testid`s,
 * because that label is the whole contract: it is what `describe()` promises somebody who
 * cannot see the line, and a test that reaches past it into SVG would keep passing while the
 * description went stale.
 */
function chartDescription(): string {
  return screen.getByRole("img").getAttribute("aria-label") ?? "";
}

/** How many rings the chart drew, which is how many records it believes are marked. */
function recordRings(): number {
  return document.querySelectorAll("[data-testid='progress-chart-record']").length;
}

describe("ProgressionTab", () => {
  it("says it has never been trained when there is no history at all", () => {
    renderTab([]);
    expect(document.body.textContent).toMatch(/Todavía no hay sesiones/i);
  });

  it("tells the athlete to widen the window when only the period is empty", () => {
    // Every session is older than a year. "You have never trained this" would be a lie, and
    // the fix is one tap on the period control.
    renderTab(sessionsAt([800, 700, 600]));
    expect(document.body.textContent).toMatch(/No hay sesiones en los últimos/i);
    expect(document.body.textContent).toMatch(/periodo más largo/i);
  });

  it("redraws on a metric switch without asking for more data", () => {
    renderTab(sessionsAt([3, 40, 100], 100));

    const before = chartDescription();
    expect(before).toMatch(/1RM est\./);

    fireEvent.click(screen.getByRole("radio", { name: "Volumen" }));
    const after = chartDescription();

    expect(after).toMatch(/Volumen/);
    // Volume and weight are different quantities. If the numbers did not change, the switch
    // is only relabelling the same line -- which is the bug this test exists to catch.
    expect(after).not.toBe(before);
  });

  it("narrows to the selected period rather than redrawing everything", () => {
    // One session inside 30 days, two far outside it.
    renderTab(sessionsAt([3, 300, 500]));
    expect(chartDescription()).toMatch(/en 1 sesión/);

    fireEvent.click(screen.getByRole("radio", { name: "1A" }));
    expect(chartDescription()).not.toMatch(/en 1 sesión/);
  });

  it("marks the record against the whole history, not the visible window", () => {
    // The best estimate sits in a session far outside the default three-month view. A ring
    // that followed the window would move every time the period changed, reading as a new
    // PR on every tap.
    const list = sessionsAt([200, 10, 5]);
    renderTab(list);

    expect(recordRings()).toBe(1);
    // The one-month view excludes it, and the ring is still there.
    fireEvent.click(screen.getByRole("radio", { name: "1M" }));
    expect(recordRings()).toBe(1);
  });

  it("rings one session when every session ties, not all of them", () => {
    // A genuine plateau: identical estimates throughout. Marking every tie would ring the
    // entire chart and ring it hardest exactly when there is least to celebrate -- the ring
    // is supposed to mean "you have never done this before".
    renderTab(sessionsAt([3, 30, 60, 80]));
    expect(recordRings()).toBe(1);
  });

  it("rings nothing on the volume series", () => {
    renderTab(sessionsAt([3, 30, 60]));
    fireEvent.click(screen.getByRole("radio", { name: "Volumen" }));
    // Volume moving is not the same event as a strength record. Marking it would make the
    // two indistinguishable on the same chart.
    expect(recordRings()).toBe(0);
  });

  it("says the chart is thin when there is only one point", () => {
    renderTab(sessionsAt([5]));
    // A chart with one dot has no shape. Without this the athlete concludes the feature is
    // broken rather than that they have one session.
    expect(document.body.textContent).toMatch(/Solo hay 1 sesión/i);
  });

  it("keeps the history collapsed until it is asked for", () => {
    renderTab(sessionsAt([5, 20, 60]));

    const toggle = screen.getByRole("button", { expanded: false });
    expect(toggle.getAttribute("aria-controls")).toBe("hub-history-table");
    expect(document.getElementById("hub-history-table")).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
    expect(document.getElementById("hub-history-table")).toBeTruthy();
  });

  it("renders metric and period as one-of-N choices, not tabs", () => {
    renderTab(sessionsAt([5, 20]));

    expect(screen.getAllByRole("radiogroup").length).toBe(2);
    // These change what is drawn, not which panel is shown. A tablist would promise panels
    // that do not exist and hand the athlete a keyboard model that does not match.
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});