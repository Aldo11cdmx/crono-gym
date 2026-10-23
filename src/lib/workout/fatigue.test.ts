/**
 * fatigue.test.ts — the rule, isolated from every screen that shows it.
 *
 * Each case names the lie it prevents: a verdict that fires on a
 * warm-up, a record, or a met target is a verdict the athlete stops
 * reading, and a severe shortfall called "mild" because the load was
 * never weighed is a verdict that understates the session.
 */

import { describe, expect, it } from "vitest";
import {
  FATIGUE,
  fatigueShortfall,
  getSetFatigue,
  summarizeFatigue,
  type FatigueContext,
} from "./fatigue";

/** A completed working set, as the logger holds it. */
function doneSet(reps: string, weight = "100") {
  return { reps, weight, kind: "normal" as const };
}

/** The context every case shares unless a test says otherwise. */
function context(over: Partial<FatigueContext> = {}): FatigueContext {
  return { plannedReps: 10, allTimeBest: null, isRecord: false, ...over };
}

/**
 * A best of 100×5: Epley puts the historical 1RM at 116.7, so the
 * heavy-load threshold is 99.2. A set at 100 kg is heavy; a set at
 * 60 kg is not.
 */
const BEST_100x5 = { weightKg: 100, reps: 5 };

describe("fatigueShortfall", () => {
  it("reports nothing without a target to compare against", () => {
    expect(fatigueShortfall(doneSet("8"), null)).toBeNull();
  });

  it("reports nothing for a set with nothing countable", () => {
    expect(fatigueShortfall(doneSet(""), 10)).toBeNull();
  });

  it("reports nothing when the set met the plan", () => {
    expect(fatigueShortfall(doneSet("10"), 10)).toBeNull();
  });

  it("reports nothing when the set beat the plan -- extra reps are progress", () => {
    expect(fatigueShortfall(doneSet("12"), 10)).toBeNull();
  });

  it("reports the gap when the set fell short", () => {
    expect(fatigueShortfall(doneSet("8"), 10)).toBe(2);
  });
});

describe("getSetFatigue", () => {
  it("never calls a warm-up tired, however short it is", () => {
    // Preparation, not work: the plan does not apply to it.
    expect(
      getSetFatigue({ ...doneSet("2", "60"), kind: "warmup" }, context()),
    ).toBe("none");
  });

  it("never calls a record-breaker tired", () => {
    // The best set ever did not fall short by any useful definition.
    expect(getSetFatigue(doneSet("8"), context({ isRecord: true }))).toBe("none");
  });

  it("stays silent when the set met the plan", () => {
    expect(getSetFatigue(doneSet("10"), context())).toBe("none");
  });

  it("stays silent when there is no target and nothing to count", () => {
    expect(getSetFatigue(doneSet(""), context({ plannedReps: null }))).toBe("none");
  });

  it("calls one rep short mild", () => {
    expect(getSetFatigue(doneSet("9"), context())).toBe("mild");
  });

  it("calls a two-rep shortfall high when there is no history to weigh the load against", () => {
    // A target missed by that much is worth saying either way.
    expect(getSetFatigue(doneSet("8"), context())).toBe("high");
  });

  it("calls a two-rep shortfall high when the bar was heavy", () => {
    // 100 kg against a 99.2 kg threshold: the shortfall is the muscle,
    // not the load.
    expect(
      getSetFatigue(doneSet("8"), context({ allTimeBest: BEST_100x5 })),
    ).toBe("high");
  });

  it("calls a two-rep shortfall mild when the bar was light", () => {
    // Falling short at a light load is a bad set, not a tired muscle.
    expect(
      getSetFatigue(doneSet("8", "60"), context({ allTimeBest: BEST_100x5 })),
    ).toBe("mild");
  });

  it("calls a quarter of the target short high at a heavy load", () => {
    // 9 of 12: the ratio threshold, not just the absolute one.
    expect(
      getSetFatigue(doneSet("9"), context({ plannedReps: 12, allTimeBest: BEST_100x5 })),
    ).toBe("high");
  });

  it("calls a severe shortfall mild when the bar is empty", () => {
    // A set with no weight cannot be "heavy", however short
    // it fell -- but only once there is history to weigh the
    // load against, because with none the shortfall decides.
    expect(
      getSetFatigue(doneSet("8", ""), context({ allTimeBest: BEST_100x5 })),
    ).toBe("mild");
  });
});

describe("summarizeFatigue", () => {
  it("counts only the sets that showed fatigue", () => {
    expect(
      summarizeFatigue(["none", "mild", "none", "high"]),
    ).toEqual({ fatigued: 2, total: 4 });
  });

  it("reports an empty session as an empty verdict", () => {
    expect(summarizeFatigue([])).toEqual({ fatigued: 0, total: 0 });
  });

  it("keeps the summary threshold reviewable", () => {
    // The number the UI waits for before it says anything at all.
    expect(FATIGUE.SUMMARY_MIN_SETS).toBe(2);
  });
});
