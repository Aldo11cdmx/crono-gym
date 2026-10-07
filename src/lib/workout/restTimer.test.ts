/**
 * restTimer.test.ts — the clock's arithmetic, with no clock at all.
 *
 * Every answer the timer shows comes from one of these functions,
 * so each one is pinned here against the lie it prevents: a
 * negative remainder, a second shown before it is spent, a ring
 * that fills backwards.
 */

import { describe, expect, it } from "vitest";
import {
  FINAL_STRETCH_MS,
  REST_BEEP_HZ,
  REST_BEEP_MS,
  REST_STEP_MS,
  REST_VIBRATE_MS,
  TICK_MS,
  formatRemaining,
  isFinalStretch,
  remainingMs,
  ringProgress,
} from "./restTimer";

describe("remainingMs", () => {
  it("names the time before the deadline", () => {
    expect(remainingMs(10_000, 4_000)).toBe(6_000);
  });

  it("is zero at the deadline", () => {
    expect(remainingMs(10_000, 10_000)).toBe(0);
  });

  it("never goes negative -- a past deadline is over, not owed", () => {
    expect(remainingMs(10_000, 12_000)).toBe(0);
  });
});

describe("isFinalStretch", () => {
  it("is false once nothing is left", () => {
    // A rest that has ended is not "about to end".
    expect(isFinalStretch(0)).toBe(false);
  });

  it("is true through the last five seconds", () => {
    expect(isFinalStretch(1)).toBe(true);
    expect(isFinalStretch(FINAL_STRETCH_MS)).toBe(true);
  });

  it("is false before the last five seconds", () => {
    expect(isFinalStretch(FINAL_STRETCH_MS + 1)).toBe(false);
  });
});

describe("ringProgress", () => {
  it("is full with the whole rest ahead", () => {
    expect(ringProgress(90_000, 90_000)).toBe(1);
  });

  it("is empty with no time left", () => {
    expect(ringProgress(0, 90_000)).toBe(0);
  });

  it("stays inside the ring, whatever the numbers say", () => {
    // An adjustment can put more time on the clock than the
    // rest started with, and a clamped deadline can report
    // nothing at all: the ring has two ends and no third.
    expect(ringProgress(90_001, 90_000)).toBe(1);
    expect(ringProgress(-1, 90_000)).toBe(0);
  });

  it("is empty when the rest has no length to measure", () => {
    expect(ringProgress(1_000, 0)).toBe(0);
  });
});

describe("formatRemaining", () => {
  it("renders minutes and seconds", () => {
    expect(formatRemaining(90_000)).toBe("01:30");
    expect(formatRemaining(61_000)).toBe("01:01");
  });

  it("rounds up, so a second is shown only once it is spent", () => {
    // 4.2 seconds left reads as "00:05": the fifth second
    // is still being lived.
    expect(formatRemaining(4_200)).toBe("00:05");
    expect(formatRemaining(59_999)).toBe("01:00");
  });

  it("renders an ended rest as zero, not as a debt", () => {
    expect(formatRemaining(0)).toBe("00:00");
  });
});

describe("the clock's own constants", () => {
  it("ticks fast enough to sweep the ring, slow enough to spare the battery", () => {
    expect(TICK_MS).toBeLessThan(1_000);
    expect(TICK_MS).toBeGreaterThan(16);
  });

  it("adjusts by a quarter minute", () => {
    expect(REST_STEP_MS).toBe(15_000);
  });

  it("sounds the end of a rest rather than ticking it", () => {
    expect(REST_BEEP_HZ).toBeGreaterThan(0);
    expect(REST_BEEP_MS).toBeGreaterThan(0);
    expect(REST_VIBRATE_MS).toBeGreaterThan(0);
  });
});
