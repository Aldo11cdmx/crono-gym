/**
 * exerciseMetrics.test.ts — the arithmetic, asserted against hand-computed values.
 *
 * Every expected number here is worked out in the test rather than derived from the
 * implementation. A test that calls `estimateOneRepMax` and compares it to
 * `estimateOneRepMax` proves the function is deterministic, which it is; it does not prove
 * it is *right*, and an Epley coefficient is exactly the kind of thing that gets changed
 * to a plausible-looking wrong value.
 */

import { describe, expect, it } from "vitest";
import {
  EXERCISE_METRICS,
  TREND_DEAD_BAND_KG,
  estimateOneRepMax,
  estimateTrend,
  personalRecord,
  sessionMetrics,
  toDisplayWeight,
  toKilograms,
} from "./exerciseMetrics";
import type { ExerciseSetRecord } from "./exerciseHistory";

/** A set, with only the fields a metric reads. */
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

describe("the one-rep-max estimate", () => {
  it("uses Epley, hand-checked", () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.667, 2);
    // 60 * (1 + 1/30) = 62
    expect(estimateOneRepMax(60, 1)).toBeCloseTo(62, 3);
    // A single at the weight is the weight itself: no reps means no estimate above it.
    expect(estimateOneRepMax(80, 1)).toBeCloseTo(82.667, 2);
  });

  it("is monotonically increasing in both inputs", () => {
    // A coefficient that stopped monotonic somewhere would make "am I getting stronger"
    // answerable by picking a flattering set.
    let previous = 0;
    for (const reps of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const estimate = estimateOneRepMax(100, reps)!;
      expect(estimate).toBeGreaterThan(previous);
      previous = estimate;
    }
    expect(estimateOneRepMax(101, 5)!).toBeGreaterThan(estimateOneRepMax(100, 5)!);
  });

  it("refuses past the heaviest rep Epley means anything at", () => {
    // Not clamped, not extrapolated: refused. A 12-rep "max" is a claim about a rep the
    // athlete has not done, and it is the number a PR list would headline.
    expect(estimateOneRepMax(100, EXERCISE_METRICS.MAX_ESTIMATABLE_REPS)).not.toBeNull();
    expect(estimateOneRepMax(100, EXERCISE_METRICS.MAX_ESTIMATABLE_REPS + 1)).toBeNull();
    expect(estimateOneRepMax(40, 25)).toBeNull();
  });

  it("stays positive where Brzycki would have gone negative", () => {
    // The reason Epley was chosen. Brzycki's 36/(37-reps) form returns a negative estimate
    // past 37 reps, which renders as progress going backwards.
    expect(estimateOneRepMax(50, 37)).toBeNull();
    // And for every input it does accept, the result is positive.
    for (let reps = 1; reps <= EXERCISE_METRICS.MAX_ESTIMATABLE_REPS; reps++) {
      expect(estimateOneRepMax(20, reps)!).toBeGreaterThan(0);
    }
  });

  it("returns null rather than zero when there is nothing to estimate", () => {
    // Zero is a claim. It would beat every real estimate in a comparison and render as a
    // bar falling to nothing.
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    expect(estimateOneRepMax(Number.NaN, 5)).toBeNull();
    expect(estimateOneRepMax(100, Number.NaN)).toBeNull();
    expect(estimateOneRepMax(-50, 5)).toBeNull();
    expect(estimateOneRepMax(100, -1)).toBeNull();
  });
});

describe("unit conversion", () => {
  it("uses the exact pound, not 2.2", () => {
    // 2.2 accumulates about 0.9kg of drift over 100kg, in one direction only, because the
    // error does not cancel between the two directions of conversion.
    expect(toDisplayWeight(100, "lb")).toBeCloseTo(220.462, 2);
    // And back, declaring the input's unit rather than the output's.
    expect(toKilograms(220.46226218, "lb")).toBeCloseTo(100, 6);
  });

  it("round-trips within float tolerance", () => {
    for (const kg of [1, 20, 60, 100, 180.5]) {
      expect(toKilograms(toDisplayWeight(kg, "lb"), "lb")).toBeCloseTo(kg, 10);
      expect(toDisplayWeight(toKilograms(kg, "lb"), "lb")).toBeCloseTo(kg, 10);
    }
  });

  it("leaves kilograms alone", () => {
    expect(toDisplayWeight(72.5, "kg")).toBe(72.5);
    expect(toKilograms(72.5, "kg")).toBe(72.5);
  });
});

describe("one session's numbers", () => {
  it("reduces a session by hand", () => {
    const result = sessionMetrics("log-1", "2026-03-01T10:00:00.000Z", [
      set({ set_number: 1, weight: 100, reps: 5 }),
      set({ set_number: 2, weight: 100, reps: 5 }),
      set({ set_number: 3, weight: 90, reps: 8, rpe: 8 }),
    ]);

    expect(result.setCount).toBe(3);
    expect(result.topWeightKg).toBe(100);
    // 5 + 5 + 8
    expect(result.totalReps).toBe(18);
    // 100 at 5 reps is the best of the three: 100 * (1 + 5/30) = 116.667, against
    // 90 * (1 + 8/30) = 114 for the lighter set with more reps. A heaviest-set-only
    // reading would have picked the 90 and been wrong, which is the reason the max is taken
    // over estimates rather than over weights.
    expect(result.bestEstimateKg).toBeCloseTo(116.6667, 3);
    // Mean of 116.667, 116.667 and 114
    expect(result.averageEstimateKg).toBeCloseTo((116.6667 + 116.6667 + 114) / 3, 3);
    expect(result.averageRpe).toBe(8);
  });

  it("averages RPE over the sets that recorded one, not over all of them", () => {
    // Two sets logged RPE 6 and 8. Averaging over three sets would dilute an athlete's
    // reported effort with a null, every single time -- so the mean is 7, not 4.67.
    const result = sessionMetrics("log-1", "2026-03-01T10:00:00.000Z", [
      set({ set_number: 1, reps: 5, rpe: 6 }),
      set({ set_number: 2, reps: 5, rpe: 8 }),
      set({ set_number: 3, reps: 5, rpe: null }),
    ]);
    expect(result.averageRpe).toBe(7);
  });

  it("reports nothing rather than zero for an empty session", () => {
    const result = sessionMetrics("log-1", "2026-03-01T10:00:00.000Z", []);
    expect(result.setCount).toBe(0);
    expect(result.topWeightKg).toBeNull();
    expect(result.bestEstimateKg).toBeNull();
    expect(result.averageEstimateKg).toBeNull();
    expect(result.averageRpe).toBeNull();
    expect(result.totalReps).toBe(0);
  });
});

describe("the personal record", () => {
  const sessions = [
    {
      logId: "log-2",
      startedAt: "2026-03-08T10:00:00.000Z",
      sets: [set({ id: "s1", weight: 100, reps: 5 })],
    },
    {
      logId: "log-1",
      startedAt: "2026-03-01T10:00:00.000Z",
      // 60 at 3 reps: 60 * 1.1 = 66, well under log-2's 116.67
      sets: [set({ id: "s2", weight: 60, reps: 3 })],
    },
  ];

  it("reports the heaviest estimate and where it happened", () => {
    const record = personalRecord(sessions);
    expect(record).not.toBeNull();
    expect(record!.estimateKg).toBeCloseTo(116.6667, 3);
    expect(record!.logId).toBe("log-2");
    expect(record!.setId).toBe("s1");
    expect(record!.startedAt).toBe("2026-03-08T10:00:00.000Z");
  });

  it("keeps the earlier session on an exact tie, whichever order it is given in", () => {
    // Repeating a session exactly is common. "You have held this since March" is the
    // answer worth giving. Asserted in both orders on purpose: an earlier version broke
    // the tie with `>=`, which happened to be right only because the caller sorted
    // newest-first and would have started reporting the opposite if anyone sorted
    // differently.
    const older = {
      logId: "log-1",
      startedAt: "2026-03-01T10:00:00.000Z",
      sets: [set({ id: "s2", weight: 100, reps: 5 })],
    };
    const newer = {
      logId: "log-2",
      startedAt: "2026-03-08T10:00:00.000Z",
      sets: [set({ id: "s1", weight: 100, reps: 5 })],
    };

    expect(personalRecord([newer, older])!.logId).toBe("log-1");
    expect(personalRecord([older, newer])!.logId).toBe("log-1");
  });

  it("is null when nothing is estimable", () => {
    expect(personalRecord([])).toBeNull();
    expect(
      personalRecord([
        { logId: "l", startedAt: "2026-03-01T10:00:00.000Z", sets: [set({ reps: 20 })] },
      ]),
    ).toBeNull();
  });
});

describe("the trend", () => {
  /** A session whose best estimate is `estimate`, built so it actually produces it. */
  function sessionAt(estimate: number, index: number) {
    return {
      logId: `log-${index}`,
      startedAt: new Date(Date.UTC(2026, 2, index + 1)).toISOString(),
      sets: [set({ weight: estimate / 1.1666667, reps: 5 })],
    };
  }

  it("needs two windows before it will answer", () => {
    // Two sessions is a comparison, not a trend.
    expect(estimateTrend([])).toBeNull();
    expect(estimateTrend([sessionAt(100, 0)])).toBeNull();
    expect(
      estimateTrend([sessionAt(100, 0), sessionAt(105, 1)]),
    ).toBeNull();
  });

  it("reads a genuine climb as up", () => {
    // Six sessions, newest first, climbing 10 per session.
    const trend = estimateTrend([
      sessionAt(160, 5),
      sessionAt(150, 4),
      sessionAt(140, 3),
      sessionAt(130, 2),
      sessionAt(120, 1),
      sessionAt(110, 0),
    ])!;
    expect(trend.direction).toBe("up");
    expect(trend.kgPerSession).toBeGreaterThan(0);
    expect(trend.sampleSize).toBe(6);
  });

  it("calls a change inside the dead band flat, rather than flickering", () => {
    // Climbing 0.4kg per session: real, and entirely inside the noise of the estimate.
    // Reported as `up` it would flip to `down` on rounding alone.
    const trend = estimateTrend([
      sessionAt(102, 5),
      sessionAt(101.6, 4),
      sessionAt(101.2, 3),
      sessionAt(100.8, 2),
      sessionAt(100.4, 1),
      sessionAt(100, 0),
    ])!;
    expect(trend.direction).toBe("flat");
    expect(Math.abs(trend.kgPerSession)).toBeLessThan(TREND_DEAD_BAND_KG);
  });

  it("reads a decline as down", () => {
    const trend = estimateTrend([
      sessionAt(100, 5),
      sessionAt(105, 4),
      sessionAt(110, 3),
      sessionAt(115, 2),
      sessionAt(120, 1),
      sessionAt(125, 0),
    ])!;
    expect(trend.direction).toBe("down");
  });
});
