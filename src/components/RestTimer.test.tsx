/**
 * @vitest-environment jsdom
 *
 * RestTimer.test.tsx — the rest, as a deadline.
 *
 * The clock is the thing under test: a deadline read by an
 * interval, not a counter subtracted from. Every case here
 * names the drift it prevents -- a background tab that
 * throttles, a pause that restarts, an adjustment that
 * lands in the past -- plus the two ways the end of a rest
 * is announced (sound, or vibration where there is no
 * sound) and the one sound it must yield to (a record's).
 *
 * The audio module is mocked, as in `RecordBadge.test.tsx`:
 * the assertions are about *when* the timer asks for a
 * sound, not about the Web Audio API inside jsdom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  REST_BEEP_HZ,
  REST_BEEP_MS,
  REST_VIBRATE_MS,
} from "../lib/workout/restTimer";
import { REST_TIMER_LABELS } from "../lib/i18n";
import { ACCENT, STATUS } from "../design/tokens";
import { RestTimer } from "./RestTimer";

vi.mock("../lib/audio", () => ({
  playBeep: vi.fn(() => true),
  isRecordBeepActive: vi.fn(() => false),
}));

import { isRecordBeepActive, playBeep } from "../lib/audio";

/** The clock under test, and the calls it should make. */
const onFinished = vi.fn();
const onClose = vi.fn();

function renderTimer(props?: { seconds?: number; endsAt?: number }) {
  return render(
    <RestTimer
      seconds={props?.seconds ?? 60}
      endsAt={props?.endsAt}
      onClose={onClose}
      onFinished={onFinished}
    />,
  );
}

/**
 * jsdom has no `matchMedia`, so `useReducedMotion` reads
 * `false` here -- the direction that plays. These tests
 * install one when they need the quiet direction instead.
 */
const originalMatchMedia = window.matchMedia;

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** The progress ring's stroke: the second circle of the dial. */
function ringStroke(container: HTMLElement): string | null {
  const circles = container.querySelectorAll("circle");
  return circles.item(1)?.getAttribute("stroke") ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
  onFinished.mockClear();
  onClose.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  if (originalMatchMedia === undefined) {
    delete (window as { matchMedia?: unknown }).matchMedia;
  } else {
    window.matchMedia = originalMatchMedia;
  }
  delete (navigator as { vibrate?: unknown }).vibrate;
});

describe("RestTimer", () => {
  it("counts down from the seconds it was given", () => {
    renderTimer({ seconds: 90 });
    expect(screen.getByText("01:30")).toBeTruthy();
  });

  it("reads the deadline the caller supplies, not its own clock", () => {
    // The caller that started the rest owns the moment it
    // ends: a remount must not restart the clock.
    renderTimer({ seconds: 90, endsAt: Date.now() + 30_000 });
    expect(screen.getByText("00:30")).toBeTruthy();
  });

  it("finishes a rest whose deadline has already passed", () => {
    renderTimer({ seconds: 90, endsAt: Date.now() - 1_000 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("ends the rest and beeps once when the clock runs out", () => {
    renderTimer({ seconds: 2 });
    act(() => {
      vi.advanceTimersByTime(2_100);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(playBeep).toHaveBeenCalledTimes(1);
    expect(playBeep).toHaveBeenCalledWith(REST_BEEP_HZ, REST_BEEP_MS);
  });

  it("adds a step to the rest", () => {
    renderTimer({ seconds: 60 });
    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.addAriaLabel }),
    );
    expect(screen.getByText("01:15")).toBeTruthy();
  });

  it("never moves the rest into the past", () => {
    renderTimer({ seconds: 10 });
    fireEvent.click(
      screen.getByRole("button", {
        name: REST_TIMER_LABELS.subtractAriaLabel,
      }),
    );
    // A rest that would go below zero is a rest that is
    // over: the next tick says so, rather than showing a
    // debt.
    expect(screen.getByText("00:00")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("pauses the clock and resumes from where it stopped", () => {
    renderTimer({ seconds: 60 });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.pauseAriaLabel }),
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // Paused: the clock must not have moved.
    expect(screen.getByText("00:50")).toBeTruthy();
    expect(onFinished).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.resumeAriaLabel }),
    );
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    // Twenty seconds of the held rest are left -- the
    // pause did not spend them.
    expect(screen.getByText("00:20")).toBeTruthy();
    expect(onFinished).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("adjusts the held rest while paused", () => {
    renderTimer({ seconds: 60 });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.pauseAriaLabel }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.addAriaLabel }),
    );
    expect(screen.getByText("01:05")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.resumeAriaLabel }),
    );
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    // The hold was the thing that moved: 35 seconds of it
    // are still left.
    expect(screen.getByText("00:35")).toBeTruthy();
  });

  it("skips the rest without a beep", () => {
    // "Saltar" is the athlete saying they are already back:
    // the beep is the "your rest is over" signal, and
    // nobody needs it announced twice.
    renderTimer({ seconds: 60 });
    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.skipLabel }),
    );
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(playBeep).not.toHaveBeenCalled();
  });

  it("yields the end-of-rest beep to a record", () => {
    // A record fires the moment a set completes -- the same
    // moment a rest starts. If the rest is short enough to
    // end inside the record's two seconds, the record's
    // confirmation is the sound the athlete keeps.
    vi.mocked(isRecordBeepActive).mockReturnValueOnce(true);
    renderTimer({ seconds: 2 });
    act(() => {
      vi.advanceTimersByTime(2_100);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(playBeep).not.toHaveBeenCalled();
  });

  it("vibrates on a device that cannot beep", () => {
    vi.mocked(playBeep).mockReturnValueOnce(false);
    const vibrate = vi.fn();
    (navigator as { vibrate?: unknown }).vibrate = vibrate;

    renderTimer({ seconds: 2 });
    act(() => {
      vi.advanceTimersByTime(2_100);
    });
    expect(vibrate).toHaveBeenCalledWith(REST_VIBRATE_MS);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("stays silent under reduced motion", () => {
    mockReducedMotion(true);
    renderTimer({ seconds: 2 });
    act(() => {
      vi.advanceTimersByTime(2_100);
    });
    // The preference asked for less stimulus; a surprise
    // tone is stimulus.
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(playBeep).not.toHaveBeenCalled();
  });

  it("minimizes to a bar above the navigation and comes back", () => {
    renderTimer({ seconds: 60 });
    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.minimizeAriaLabel }),
    );

    // The bar is a live region in its own right, so the
    // countdown keeps being announced while the table is
    // in view.
    expect(
      screen.getByRole("status", {
        name: REST_TIMER_LABELS.remainingAriaLabel(60),
      }),
    ).toBeTruthy();
    expect(screen.getByText("01:00")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.expandAriaLabel }),
    );
    expect(
      screen.getByRole("dialog", { name: REST_TIMER_LABELS.title }),
    ).toBeTruthy();
  });

  it("closes without finishing the rest", () => {
    renderTimer({ seconds: 60 });
    fireEvent.click(
      screen.getByRole("button", { name: REST_TIMER_LABELS.closeAriaLabel }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("takes the warning colour in the last stretch", () => {
    // The ring is the clock's voice in the last
    // stretch: amber beside the numeral that keeps
    // counting, so the urgency has a colour channel
    // and a time channel.
    const first = renderTimer({ seconds: 60 });
    expect(ringStroke(first.container)).toBe(ACCENT.base);
    cleanup();

    const urgent = renderTimer({ seconds: 4 });
    expect(ringStroke(urgent.container)).toBe(STATUS.warning.base);
  });
});
