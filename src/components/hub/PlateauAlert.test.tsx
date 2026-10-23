/**
 * @vitest-environment jsdom
 *
 * PlateauAlert.test.tsx — the verdict must not be stronger than the data.
 *
 * Four cases, and the one that matters most is the one that is *not* a verdict.
 *
 * `detectPlateau` can honestly say "I have not seen enough to tell", and this component has
 * to be able to say exactly that. The failure mode being guarded against is the generous
 * one: rendering a reassuring line for a lifter with two sessions, who would then believe
 * the app has assessed them and stop looking. Silence about a question is better than an
 * invented answer, but "silence" is not available here -- the athlete came to this screen to
 * be told something -- so what is left is saying plainly that the answer does not exist yet.
 *
 * The other half is that a real plateau shows *both* options. The engine answers "has it
 * stalled"; it does not answer "should I add weight or back off", and a screen that picks
 * one is making a product decision nobody made.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PlateauAlert } from "./PlateauAlert";
import type { ExerciseSession } from "@/lib/exercise/exerciseHistory";

afterEach(cleanup);

/** Fixed so "now" is a constant and the day-count branches are deterministic. */
const NOW = Date.parse("2026-06-01T12:00:00.000Z");
const DAY = 86400000;

/**
 * One session, with one real set in it.
 *
 * The set is not decoration: `detectPlateau` skips any session with nothing estimable, so a
 * session with an empty `sets` array is invisible to the engine and every fixture built that
 * way answers "too few sessions" no matter what the dates say.
 */
function session(daysAgo: number, weightKg: number, reps = 5): ExerciseSession {
  const startedAt = new Date(NOW - daysAgo * DAY).toISOString();
  return {
    logId: `log-${daysAgo}`,
    startedAt,
    sets: [
      {
        id: `set-${daysAgo}`,
        log_id: `log-${daysAgo}`,
        exercise_id: "bench",
        set_number: 1,
        weight: weightKg,
        reps,
        rpe: null,
        notes: null,
        started_at: startedAt,
      },
    ],
  };
}

/**
 * A stalled history: `count` identical sessions spread over `spreadDays`, newest first.
 *
 * Newest-first is a contract, not a convenience. `detectPlateau` reads "recently" as
 * position rather than sorting, so an oldest-first array would make it compute the trend
 * backwards and report a stall for an athlete climbing steadily. Building it in order here
 * keeps the requirement visible instead of leaving it to the reader of the fixture.
 */
function flat(count: number, spreadDays: number, weightKg = 100): ExerciseSession[] {
  return Array.from({ length: count }, (_, index) =>
    session(Math.round((spreadDays * index) / (count - 1)), weightKg),
  ).reverse();
}

/** A climbing history over the same window, newest first. */
function rising(count: number, spreadDays: number, fromKg = 100, stepKg = 10): ExerciseSession[] {
  return Array.from({ length: count }, (_, index) =>
    session(Math.round((spreadDays * index) / (count - 1)), fromKg + stepKg * index),
  ).reverse();
}

const formatWeight = (kg: number) => `${kg} kg`;

/** The notice's whole text, however it chose to render. */
function text(): string {
  return document.body.textContent ?? "";
}

describe("PlateauAlert", () => {
  it("says it has too little data rather than declaring a plateau", () => {
    // Two sessions a month apart. Plenty of time, not enough sessions: any verdict here
    // would be invention.
    render(<PlateauAlert sessions={flat(2, 30)} formatWeight={formatWeight} now={NOW} />);

    const body = text();
    expect(body).toMatch(/Muy pocas sesiones/i);
    expect(body).not.toMatch(/Sin gains/i);
    expect(body).not.toMatch(/Te faltan/i);
  });

  it("distinguishes too-few-sessions from too-soon", () => {
    // Three sessions inside one week: the count clears, the calendar does not. This is the
    // branch that keeps a novice from being told they have stalled.
    render(<PlateauAlert sessions={flat(3, 5)} formatWeight={formatWeight} now={NOW} />);

    const body = text();
    expect(body).toMatch(/días con este ejercicio/i);
    expect(body).not.toMatch(/Muy pocas sesiones/i);
  });

  it("reports progress with the gain in the athlete's unit", () => {
    render(<PlateauAlert sessions={rising(4, 60)} formatWeight={formatWeight} now={NOW} />);

    const body = text();
    expect(body).toMatch(/Vas ganando/i);
    expect(body).not.toMatch(/Sin gains/i);
  });

  it("offers both directions on a plateau, because the engine only says stalled", () => {
    render(<PlateauAlert sessions={flat(4, 60)} formatWeight={formatWeight} now={NOW} />);

    const body = text();
    expect(body).toMatch(/Sin gains/i);
    // Both, not one: adding weight and backing off are opposite advice, and nothing in the
    // data says which of them applies.
    expect(body).toMatch(/subir/i);
    expect(body).toMatch(/descarga/i);
  });

  it("gives the same verdict to the same sessions a second time", () => {
    // The whole reason `now` is a prop: a component reaching for `Date.now()` would render
    // this the same way too, but a *test* of it could not be written -- these assertions
    // would start failing on a calendar boundary with no code change at all.
    const { unmount } = render(
      <PlateauAlert sessions={flat(4, 60)} formatWeight={formatWeight} now={NOW} />,
    );
    const first = text();
    unmount();

    render(<PlateauAlert sessions={flat(4, 60)} formatWeight={formatWeight} now={NOW} />);
    expect(text()).toBe(first);
  });

  it("does not announce itself to a screen reader mid-scroll", () => {
    render(<PlateauAlert sessions={flat(4, 60)} formatWeight={formatWeight} now={NOW} />);
    // `role="alert"` would interrupt. The hub is somewhere the athlete navigates to, not a
    // thing that happens to them unasked.
    expect(screen.queryByRole("alert")).toBeNull();
  });
});