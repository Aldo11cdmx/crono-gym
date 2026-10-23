/**
 * exerciseFatigue.test.ts — volume, intensity and the two axes kept apart.
 *
 * Volume and intensity are the pair this module exists to keep distinct, so most of these
 * assert that a change in one does not silently move the other. A hub that showed only one
 * would describe half of what happened and be confidently wrong about the other half.
 */

import { describe, expect, it } from "vitest";
import {
  FATIGUE_RULES,
  bestEver,
  currentIntensity,
  detrainingGap,
  intensityBand,
  sessionLoad,
  volumeTrend,
} from "./exerciseFatigue";
import type { ExerciseSetRecord } from "./exerciseHistory";

function set(over: Partial<ExerciseSetRecord> = {}): ExerciseSetRecord {
  return {
    id: "set-1",
    log_id: "log-1",
    exercise_id: "sentadilla",
    set_number: 1,
    weight: 100,
    reps: 5,
    rpe: null,
    notes: null,
    started_at: "2026-03-01T10:00:00.000Z",
    ...over,
  };
}

/**
 * A session load for the helpers that take loads rather than sets.
 *
 * `estimateKg` is passed explicitly rather than derived from the intensity, because the
 * two are different quantities -- intensity is a fraction *of* the athlete's best, and the
 * best estimate is the numerator. An earlier version derived one from the other, which
 * made the detraining tests compute their own expected value from the same arithmetic the
 * function under test was using.
 */
function load(volume: number, estimateKg: number | null, intensity: number | null = null, id = "l") {
  return {
    logId: id,
    startedAt: "2026-03-01T10:00:00.000Z",
    volumeKgReps: volume,
    bestEstimateKg: estimateKg,
    intensity,
    band: intensity === null ? null : intensityBand(intensity),
  };
}

describe("volume", () => {
  it("sums weight times reps", () => {
    const result = sessionLoad("log-1", "2026-03-01T10:00:00.000Z", [
      set({ weight: 100, reps: 5 }),
      set({ weight: 100, reps: 5 }),
      set({ weight: 90, reps: 8 }),
    ], null);
    // 500 + 500 + 720
    expect(result.volumeKgReps).toBe(1720);
  });

  it("excludes unweighted sets instead of inventing a bodyweight", () => {
    // A bodyweight set is real work. It is not expressible in kg·reps without an assumption
    // about the athlete's bodyweight, and a fabricated number in a volume total is worse
    // than an absent one.
    const result = sessionLoad("log-1", "2026-03-01T10:00:00.000Z", [
      set({ weight: 100, reps: 5 }),
      set({ weight: null, reps: 20 }),
    ], null);
    expect(result.volumeKgReps).toBe(500);
  });

  it("is zero, not null, for a session with no weighted work", () => {
    // Zero volume is a real reading -- a bodyweight day has no kg·reps. `null` would be the
    // right answer for "unknown", and this is not unknown.
    const result = sessionLoad("log-1", "2026-03-01T10:00:00.000Z", [set({ weight: null })], null);
    expect(result.volumeKgReps).toBe(0);
  });
});

describe("intensity", () => {
  it("is a fraction of the athlete's own best, not of a formula", () => {
    // Best ever is 120kg estimated; this session's best is 108.
    const best = sessionLoad("l", "2026-03-01T10:00:00.000Z", [set({ weight: 92.57, reps: 5 })], 120);
    expect(best.intensity).toBeCloseTo(108 / 120, 2);
  });

  it("needs both the session and a best to mean anything", () => {
    // A session with nothing estimable, or no history at all, has no intensity. Reporting a
    // number here would be dividing by a denominator that does not exist.
    const noEstimate = sessionLoad("l", "2026-03-01T10:00:00.000Z", [set({ reps: 30 })], 120);
    expect(noEstimate.intensity).toBeNull();
    expect(noEstimate.band).toBeNull();

    const noBest = sessionLoad("l", "2026-03-01T10:00:00.000Z", [set({ weight: 100, reps: 5 })], null);
    expect(noBest.intensity).toBeNull();
  });

  it("tiles the range with no gap, from the thresholds down", () => {
    expect(intensityBand(1)).toBe("heavy");
    expect(intensityBand(FATIGUE_RULES.BANDS.heavy)).toBe("heavy");
    expect(intensityBand(FATIGUE_RULES.BANDS.heavy - 0.01)).toBe("moderate");
    expect(intensityBand(FATIGUE_RULES.BANDS.moderate)).toBe("moderate");
    expect(intensityBand(FATIGUE_RULES.BANDS.moderate - 0.01)).toBe("light");
    expect(intensityBand(0)).toBe("light");
  });
});

describe("the all-time best", () => {
  it("is the max over every session, and null when nothing is estimable", () => {
    expect(
      bestEver([
        { sets: [set({ weight: 100, reps: 5 })] },
        { sets: [set({ weight: 120, reps: 3 })] },
      ]),
    ).toBeCloseTo(120 * 1.1, 6);
    expect(bestEver([{ sets: [] }])).toBeNull();
  });
});

describe("the volume trend", () => {
  it("needs two windows before it answers", () => {
    expect(volumeTrend([])).toBeNull();
    expect(volumeTrend([load(100, 80, 0.8), load(120, 80, 0.8)])).toBeNull();
  });

  it("reads a climb as up, as the change between the two windows", () => {
    // Recent four at 200 against previous four at 160 is a 25% climb. Window-over-window,
    // not divided by four: an earlier version divided it and the 10% dead band silently
    // became an effective 40%, so this read as "flat".
    const trend = volumeTrend([
      load(200, 80, 0.8, "n1"), load(200, 80, 0.8, "n2"), load(200, 80, 0.8, "n3"), load(200, 80, 0.8, "n4"),
      load(160, 80, 0.8, "p1"), load(160, 80, 0.8, "p2"), load(160, 80, 0.8, "p3"), load(160, 80, 0.8, "p4"),
    ])!;
    expect(trend.direction).toBe("up");
    expect(trend.percentChange).toBeCloseTo(25, 6);
    expect(trend.sampleSize).toBe(4);
  });

  it("calls a change inside the dead band flat", () => {
    // 162 against 160 is 1.25%: real, and entirely inside how much a session's finished-set
    // count varies day to day.
    const trend = volumeTrend([
      load(162, 80, 0.8, "n1"), load(162, 80, 0.8, "n2"), load(162, 80, 0.8, "n3"), load(162, 80, 0.8, "n4"),
      load(160, 80, 0.8, "p1"), load(160, 80, 0.8, "p2"), load(160, 80, 0.8, "p3"), load(160, 80, 0.8, "p4"),
    ])!;
    expect(trend.direction).toBe("flat");
  });

  it("reads a drop as down", () => {
    const trend = volumeTrend([
      load(120, 80, 0.8, "n1"), load(120, 80, 0.8, "n2"), load(120, 80, 0.8, "n3"), load(120, 80, 0.8, "n4"),
      load(200, 80, 0.8, "p1"), load(200, 80, 0.8, "p2"), load(200, 80, 0.8, "p3"), load(200, 80, 0.8, "p4"),
    ])!;
    expect(trend.direction).toBe("down");
    expect(trend.percentChange).toBeCloseTo(-40, 6);
  });

  it("does not divide by zero when the earlier window has no volume", () => {
    // An athlete adding their first weighted exercise goes 0 -> something. Infinity, or a
    // division error, is how that becomes a broken screen; the direction is the answer and
    // the magnitude is not yet meaningful.
    const trend = volumeTrend([
      load(500, 80, 0.8, "n1"), load(500, 80, 0.8, "n2"), load(500, 80, 0.8, "n3"), load(500, 80, 0.8, "n4"),
      load(0, null, null, "p1"), load(0, null, null, "p2"), load(0, null, null, "p3"), load(0, null, null, "p4"),
    ])!;
    expect(trend.direction).toBe("up");
    expect(Number.isFinite(trend.percentChange)).toBe(true);
  });

  it("calls zero to zero flat", () => {
    const trend = volumeTrend([
      load(0, null, null, "n1"), load(0, null, null, "n2"), load(0, null, null, "n3"), load(0, null, null, "n4"),
      load(0, null, null, "p1"), load(0, null, null, "p2"), load(0, null, null, "p3"), load(0, null, null, "p4"),
    ])!;
    expect(trend.direction).toBe("flat");
    expect(trend.percentChange).toBe(0);
  });
});

describe("the detraining gap", () => {
  it("measures the recent window against the all-time best", () => {
    // Best ever 120; the recent four sessions top out at 100. A gap of 20 to close.
    expect(detrainingGap([load(500, 100, 100 / 120)], 120)).toBeCloseTo(20, 6);
  });

  it("is zero when the recent window still holds the best", () => {
    expect(detrainingGap([load(500, 120, 1)], 120)).toBe(0);
  });

  it("takes the best in the window, not the average of it", () => {
    // Averaging would understate a recent window that contains one heavy session and three
    // light ones, and report a gap that is not there.
    expect(
      detrainingGap([load(0, 118, null), load(0, 100, null), load(0, 100, null), load(0, 100, null)], 120),
    ).toBeCloseTo(2, 6);
  });

  it("is null rather than zero without a best or without sessions", () => {
    // Null means "cannot say". Zero here would tell an athlete they have lost nothing when
    // in fact nothing is known.
    expect(detrainingGap([load(500, 100, 0.8)], null)).toBeNull();
    expect(detrainingGap([], 120)).toBeNull();
    expect(detrainingGap([load(500, 100, 0.8)], 0)).toBeNull();
  });
});

describe("current intensity", () => {
  it("is the best in the recent window, not the average", () => {
    // Averaging would hide the fact that the athlete can still hit a heavy single.
    const result = currentIntensity([
      load(0, 95, 0.95),
      load(0, 70, 0.7),
      load(0, 70, 0.7),
      load(0, 70, 0.7),
    ]);
    expect(result).toBeCloseTo(0.95, 6);
  });

  it("is null when the window holds nothing estimable", () => {
    expect(currentIntensity([load(0, null, null), load(0, null, null)])).toBeNull();
  });
});
