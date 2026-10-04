/**
 * exercisePlateau.test.ts — the distinction the module exists to draw.
 *
 * The `now` argument on {@link spanInDays} and the fixed dates below are what make these
 * tests deterministic. Without them the verdict would depend on the day the suite ran,
 * which is the worst possible property for a test guarding "has this athlete stalled".
 */

import { describe, expect, it } from "vitest";
import {
  PLATEAU_RULES,
  detectPlateau,
  repsAreProgress,
  spanInDays,
} from "./exercisePlateau";
import type { ExerciseSetRecord } from "./exerciseHistory";

/** Fixed "now": 2026-04-01T12:00:00Z. */
const NOW = Date.UTC(2026, 3, 1, 12);

/** An ISO date `days` before {@link NOW}. */
function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString();
}

/** A session `daysAgo` whose best estimate is `weight * 1.1667`, i.e. 5 reps. */
function session(weight: number, days: number, id = `log-${days}-${weight}`) {
  return {
    logId: id,
    startedAt: daysAgo(days),
    sets: [
      {
        id: `${id}-1`,
        log_id: id,
        exercise_id: "sentadilla",
        set_number: 1,
        weight,
        reps: 5,
        rpe: null,
        notes: null,
        started_at: daysAgo(days),
      } satisfies ExerciseSetRecord,
    ],
  };
}

describe("not enough data yet", () => {
  it("refuses a verdict on two sessions, however far apart", () => {
    // Three is the floor. Two sessions is a comparison, not a trend, and telling an athlete
    // they have stalled on their second ever session is both wrong and a good way to lose
    // them.
    const verdict = detectPlateau([session(100, 2), session(100, 40)], NOW);
    expect(verdict.status).toBe("insufficient_data");
    if (verdict.status === "insufficient_data") {
      expect(verdict.reason).toBe("too_few_sessions");
      expect(verdict.sessionsSeen).toBe(2);
    }
  });

  it("refuses a verdict when every session is inside one fortnight", () => {
    // Three sessions this week is a novice, not a stall. This is the case a session count
    // alone gets wrong.
    const verdict = detectPlateau([session(100, 1), session(100, 3), session(100, 6)], NOW);
    expect(verdict.status).toBe("insufficient_data");
    if (verdict.status === "insufficient_data") {
      expect(verdict.reason).toBe("too_little_time");
      expect(verdict.daysSinceFirst).toBeLessThan(PLATEAU_RULES.MIN_DAYS);
    }
  });

  it("needs both, and says which one is missing", () => {
    // Enough sessions, enough time: a verdict.
    const enough = detectPlateau([session(100, 5), session(100, 12), session(100, 20)], NOW);
    expect(enough.status).not.toBe("insufficient_data");

    // Enough time, not enough sessions.
    expect(detectPlateau([session(100, 30), session(100, 40)], NOW).status).toBe(
      "insufficient_data",
    );
    // Enough sessions, not enough time.
    expect(detectPlateau([session(100, 1), session(100, 2), session(100, 3)], NOW).status).toBe(
      "insufficient_data",
    );
  });

  it("skips sessions with nothing estimable rather than counting them", () => {
    // Two real sessions plus one bodyweight-only. Counting the third would meet the floor
    // of three and produce a verdict about the wrong sessions.
    const bodyweight = {
      logId: "log-bw",
      startedAt: daysAgo(15),
      sets: [
        {
          id: "bw-1",
          log_id: "log-bw",
          exercise_id: "pull-ups",
          set_number: 1,
          weight: null,
          reps: 12,
          rpe: null,
          notes: null,
          started_at: daysAgo(15),
        } satisfies ExerciseSetRecord,
      ],
    };
    const verdict = detectPlateau([bodyweight, session(100, 20), session(100, 30)], NOW);
    expect(verdict.status).toBe("insufficient_data");
    if (verdict.status === "insufficient_data") {
      expect(verdict.sessionsSeen).toBe(2);
    }
  });
});

describe("a real stall", () => {
  it("reports a plateau once enough sessions and enough time have passed", () => {
    const verdict = detectPlateau([
      session(100, 3),
      session(100, 9),
      session(100, 16),
      session(100, 25),
    ], NOW);
    expect(verdict.status).toBe("plateau");
    if (verdict.status === "plateau") {
      expect(verdict.shortfallKg).toBeCloseTo(PLATEAU_RULES.MIN_GAIN_KG, 6);
      expect(verdict.sessionsSinceProgress).toBeGreaterThanOrEqual(2);
    }
  });

  it("reports progress when the numbers have moved", () => {
    const verdict = detectPlateau([
      session(110, 3),
      session(105, 9),
      session(100, 16),
      session(95, 25),
    ], NOW);
    expect(verdict.status).toBe("progressing");
  });

  it("lets one bad day inside a good stretch not decide it", () => {
    // The gain is computed from the *endpoints* of the window, so a slump in the middle
    // cannot reach the verdict at all -- there is no arithmetic path from the 80 below to
    // the answer. The endpoints here are 115 and 105, which is ~11.7kg of estimated 1RM
    // across three steps, comfortably over the 1kg threshold.
    //
    // An earlier version of this test used endpoints only 2kg apart and expected
    // "progressing", which was wrong: 2kg over three sessions is under the dead band, and
    // the module was right to call that flat.
    const verdict = detectPlateau([
      session(115, 3),
      session(80, 9),
      session(114, 16),
      session(105, 25),
    ], NOW);
    expect(verdict.status).toBe("progressing");
  });

  it("ignores the slump entirely, rather than merely averaging it away", () => {
    // The same four sessions with the slump removed must give the same verdict. If the
    // middle session were being averaged in, these two would differ.
    const withSlump = detectPlateau([
      session(115, 3),
      session(80, 9),
      session(114, 16),
      session(105, 25),
    ], NOW);
    const without = detectPlateau([
      session(115, 3),
      session(114, 16),
      session(105, 25),
    ], NOW);

    expect(withSlump.status).toBe(without.status);
    expect(withSlump.status).toBe("progressing");
  });

  it("calls a change inside the dead band not progress", () => {
    // Climbing by 0.5kg of estimated 1RM per session across the window: inside the noise of
    // the estimate itself.
    const verdict = detectPlateau([
      session(100.5, 3),
      session(100, 9),
      session(99.5, 16),
      session(99, 25),
    ], NOW);
    expect(verdict.status).toBe("plateau");
  });
});

describe("the elapsed-time helper", () => {
  it("measures from the oldest entry to now", () => {
    expect(spanInDays([{ startedAt: daysAgo(30) }], NOW)).toBe(30);
    expect(
      spanInDays([{ startedAt: daysAgo(5) }, { startedAt: daysAgo(30) }], NOW),
    ).toBe(30);
  });

  it("never returns a negative span", () => {
    // A phone with the wrong clock writes a future timestamp. A negative span would read
    // as "this is a plateau, take -4 days".
    expect(spanInDays([{ startedAt: daysAgo(-10) }], NOW)).toBe(0);
  });

  it("is zero for nothing and for an unparseable date", () => {
    expect(spanInDays([], NOW)).toBe(0);
    expect(spanInDays([{ startedAt: "not a date" }], NOW)).toBe(0);
  });
});

describe("reps are progress", () => {
  const heavy = (weight: number, reps: number): ExerciseSetRecord[] => [
    {
      id: `w${weight}r${reps}`,
      log_id: "l",
      exercise_id: "sentadilla",
      set_number: 1,
      weight,
      reps,
      rpe: null,
      notes: null,
      started_at: daysAgo(7),
    },
  ];

  it("sees a rep added at the same weight as progress", () => {
    // The case a weight-only comparison gets wrong, and the reason this function is
    // exposed and tested rather than inlined: the weight did not move and the athlete is
    // stronger.
    expect(repsAreProgress(heavy(100, 5), heavy(100, 6))).toBe(true);
  });

  it("sees more weight at the same reps as progress", () => {
    expect(repsAreProgress(heavy(100, 5), heavy(102.5, 5))).toBe(true);
  });

  it("does not call less weight at more reps progress", () => {
    // Heavier is better here: the top set got lighter. Adding a rep at a lower weight is a
    // different session, not a stronger one, and calling it progress would make a deload
    // look like an improvement.
    expect(repsAreProgress(heavy(100, 5), heavy(90, 8))).toBe(false);
  });

  it("is false when either side has no weight to compare", () => {
    expect(repsAreProgress([], heavy(100, 5))).toBe(false);
    expect(repsAreProgress(heavy(100, 5), [])).toBe(false);
  });
});
