/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import {
  getRecentPRs,
  getStreakStats,
  getVolumeTrend,
  getWeeklyProgress,
  getNextSuggestedRoutine,
  getMuscleBalance,
  estimateOneRepMax,
  EXERCISE_METRICS,
} from "./dashboardMetrics";

// ---- tiny builder to keep test cases readable ----

function makeSession(
  overrides: Partial<{
    id: string;
    startedAt: string;
    completedAt: string | null;
    routineId: string | null;
    routineTitle: string | null;
    sets: Array<Partial<{
      id: string;
      exerciseId: string;
      exerciseName: string;
      weight: number | null;
      reps: number | null;
      isWarmup: boolean;
      bodyPart: string | null;
    }>>;
  }>,
) {
  const sets = (overrides.sets ?? []).map((s, i) => ({
    id: s.id ?? `set-${i}`,
    exerciseId: s.exerciseId ?? "ex-1",
    exerciseName: s.exerciseName ?? "Squat",
    weight: s.weight ?? null,
    reps: s.reps ?? null,
    isWarmup: s.isWarmup ?? false,
    bodyPart: s.bodyPart ?? null,
  }));

  return {
    id: overrides.id ?? "session-1",
    startedAt: overrides.startedAt ?? "2026-09-30T10:00:00",
    // Use `=== undefined` so explicit `null` is preserved (not replaced by default).
    completedAt:
      overrides.completedAt === undefined
        ? "2026-09-30T10:30:00"
        : overrides.completedAt,
    routineId: overrides.routineId ?? null,
    routineTitle: overrides.routineTitle ?? null,
    sets,
  };
}

describe("estimateOneRepMax (imported sanity check)", () => {
  it("matches Epley: weight * (1 + reps/30) for reps=5", () => {
    // 100 * (1 + 5/30) = 100 * 35/30 = 116.667
    const result = estimateOneRepMax(100, 5);
    expect(result).toBeCloseTo(116.667, 2);
  });

  it("returns null for reps > MAX_ESTIMATABLE_REPS", () => {
    expect(
      estimateOneRepMax(100, EXERCISE_METRICS.MAX_ESTIMATABLE_REPS + 1),
    ).toBeNull();
  });
});

describe("getRecentPRs", () => {
  it("returns empty for no sessions", () => {
    expect(getRecentPRs([], 1_760_000_000_000)).toEqual([]);
  });

  it("emits a PR only when the estimate strictly increases", () => {
    // Session 1: (100, 5) => 116.667 — first set ever, not a PR
    // Session 2: (100, 5) => 116.667 — equal, not a PR
    // Session 3: (110, 5) => 128.333 — strictly greater, PR!
    const sessions = [
      makeSession({
        startedAt: "2026-09-30T10:00:00",
        sets: [{ weight: 100, reps: 5, exerciseName: "Squat" }],
      }),
      makeSession({
        startedAt: "2026-10-01T10:00:00",
        sets: [{ weight: 100, reps: 5, exerciseName: "Squat" }],
      }),
      makeSession({
        startedAt: "2026-10-02T10:00:00",
        sets: [{ weight: 110, reps: 5, exerciseName: "Squat" }],
      }),
    ];

    const now = Date.parse("2026-10-03T10:00:00");
    const prs = getRecentPRs(sessions, now);
    expect(prs).toHaveLength(1);
    expect(prs[0].estimated1RM).toBeCloseTo(128.333, 2);
    expect(prs[0].exerciseName).toBe("Squat");
  });

  it("ignores warm-ups", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-09-30T10:00:00",
        sets: [
          { isWarmup: true, weight: 200, reps: 1, exerciseName: "Squat" },
          { weight: 100, reps: 5, exerciseName: "Squat" },
        ],
      }),
    ];

    const now = Date.parse("2026-10-03T10:00:00");
    const prs = getRecentPRs(sessions, now);
    expect(prs).toHaveLength(0);
  });

  it("ignores sets with too many reps (> MAX_ESTIMATABLE_REPS)", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-09-30T10:00:00",
        sets: [
          { weight: 100, reps: 11, exerciseName: "Squat" },
          { weight: 100, reps: 5, exerciseName: "Squat" },
        ],
      }),
    ];

    const now = Date.parse("2026-10-03T10:00:00");
    const prs = getRecentPRs(sessions, now);
    expect(prs).toHaveLength(0);
  });

  it("only considers sessions within the time window", () => {
    // Session 3 (Oct 1, inside window, weight 110) is the one that matters.
    // Its 1RM is 128.333, which is also a PR over session 2 (100 reps, 116.667).
    // Session 1 (Sep 20, outside window) is not in the window — but still
    // establishes the baseline that session 3 must exceed.
    const sessions = [
      makeSession({
        startedAt: "2026-09-20T10:00:00",
        sets: [{ weight: 100, reps: 5, exerciseName: "Squat" }],
      }),
      makeSession({
        startedAt: "2026-09-29T10:00:00",
        sets: [{ weight: 100, reps: 5, exerciseName: "Squat" }],
      }),
      makeSession({
        startedAt: "2026-10-01T10:00:00",
        sets: [{ weight: 110, reps: 5, exerciseName: "Squat" }],
      }),
    ];

    const now = Date.parse("2026-10-03T10:00:00");
    const prs = getRecentPRs(sessions, now);
    expect(prs).toHaveLength(1);
    expect(prs[0].estimated1RM).toBeCloseTo(128.333, 2);
  });

  it("limits the number of results", () => {
    const sessions: ReturnType<typeof makeSession>[] = [];
    const exercises = ["Squat", "Bench", "Deadlift", "Press", "Row"];
    exercises.forEach((name, i) => {
      sessions.push(
        makeSession({
          startedAt: "2026-09-30T10:00:00",
          sets: [
            { exerciseId: `ex-${i}`, exerciseName: name, weight: 100, reps: 5 },
          ],
        }),
        makeSession({
          startedAt: `2026-10-0${i + 1}T10:00:00`,
          sets: [
            { exerciseId: `ex-${i}`, exerciseName: name, weight: 120, reps: 5 },
          ],
        }),
      );
    });

    const now = Date.parse("2026-10-06T10:00:00");
    const prs = getRecentPRs(sessions, now, 3);
    expect(prs).toHaveLength(3);
  });
});

describe("getStreakStats", () => {
  it("returns zeros for no sessions", () => {
    expect(getStreakStats([], 1_760_000_000_000)).toEqual({
      currentWeeks: 0,
      currentDays: 0,
      longestWeeks: 0,
      trainedToday: false,
    });
  });

  it("counts consecutive qualifying weeks (not the in-progress week)", () => {
    // Oct 5 2026 is Monday. Oct 12 2026 is Monday.
    // "now" = Oct 12 (start of current week, in progress)
    //
    // Week B (Oct 5-11): 3 sessions → qualifies
    // Week A (Sep 28-Oct 4): 1 session → breaks streak
    // Week gap (Sep 21-27): 1 session → further back, not reached
    const sessions = [
      // Week B (Oct 5-11)
      makeSession({ startedAt: "2026-10-05T10:00:00", completedAt: "2026-10-05T10:30:00" }),
      makeSession({ startedAt: "2026-10-07T10:00:00", completedAt: "2026-10-07T10:30:00" }),
      makeSession({ startedAt: "2026-10-09T10:00:00", completedAt: "2026-10-09T10:30:00" }),
      // Week A (Sep 28-Oct 4): only 1 session → breaks streak
      makeSession({ startedAt: "2026-09-28T10:00:00", completedAt: "2026-09-28T10:30:00" }),
    ];

    // Now = Monday Oct 12 — start of the current week
    const now = Date.parse("2026-10-12T08:00:00");
    const streak = getStreakStats(sessions, now);

    // Week B qualifies (3 sessions), Week A breaks (1 < 3) → currentWeeks = 1
    expect(streak.currentWeeks).toBe(1);
    // Longest is also 1 (Week B)
    expect(streak.longestWeeks).toBe(1);
    expect(streak.trainedToday).toBe(false);
  });

  it("counts two consecutive qualifying weeks", () => {
    // Oct 12 = Monday. Now = Oct 19 (Monday).
    // Week C (Oct 12-18): 3 sessions → qualifies
    // Week B (Oct 5-11): 3 sessions → qualifies
    // Week A (Sep 28-Oct 4): 0 sessions → breaks
    const sessions = [
      // Week C (Oct 12-18)
      makeSession({ startedAt: "2026-10-12T10:00:00", completedAt: "2026-10-12T10:30:00" }),
      makeSession({ startedAt: "2026-10-14T10:00:00", completedAt: "2026-10-14T10:30:00" }),
      makeSession({ startedAt: "2026-10-16T10:00:00", completedAt: "2026-10-16T10:30:00" }),
      // Week B (Oct 5-11)
      makeSession({ startedAt: "2026-10-05T10:00:00", completedAt: "2026-10-05T10:30:00" }),
      makeSession({ startedAt: "2026-10-07T10:00:00", completedAt: "2026-10-07T10:30:00" }),
      makeSession({ startedAt: "2026-10-09T10:00:00", completedAt: "2026-10-09T10:30:00" }),
    ];

    const now = Date.parse("2026-10-19T08:00:00");
    const streak = getStreakStats(sessions, now);
    expect(streak.currentWeeks).toBe(2);
    expect(streak.longestWeeks).toBe(2);
  });

  it("trainedToday is true when a session completed today", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-10-05T08:00:00",
        completedAt: "2026-10-05T08:30:00",
      }),
    ];

    const now = Date.parse("2026-10-05T12:00:00");
    const streak = getStreakStats(sessions, now);
    expect(streak.trainedToday).toBe(true);
    expect(streak.currentDays).toBe(1);
  });

  it("currentDays requires a session today; yesterday-only gives 0", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-10-04T08:00:00",
        completedAt: "2026-10-04T08:30:00",
      }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const streak = getStreakStats(sessions, now);
    expect(streak.trainedToday).toBe(false);
    expect(streak.currentDays).toBe(0); // nothing today → streak is 0
  });

  it("currentDays counts consecutive days ending today", () => {
    // Today = Oct 5, trained Oct 5, 4, 3 → streak = 3
    // Oct 2 has no session → streak breaks
    const sessions = [
      makeSession({ startedAt: "2026-10-05T08:00:00", completedAt: "2026-10-05T08:30:00" }),
      makeSession({ startedAt: "2026-10-04T08:00:00", completedAt: "2026-10-04T08:30:00" }),
      makeSession({ startedAt: "2026-10-03T08:00:00", completedAt: "2026-10-03T08:30:00" }),
      // Oct 2: no session — streak breaks
      makeSession({ startedAt: "2026-10-01T08:00:00", completedAt: "2026-10-01T08:30:00" }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const streak = getStreakStats(sessions, now);
    expect(streak.currentDays).toBe(3);
  });

  it("ignores incomplete (completedAt=null) sessions", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-10-05T08:00:00",
        completedAt: null,
      }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const streak = getStreakStats(sessions, now);
    expect(streak.trainedToday).toBe(false);
    expect(streak.currentDays).toBe(0);
    expect(streak.currentWeeks).toBe(0);
  });
});

describe("getVolumeTrend", () => {
  it("returns zero-filled points for empty sessions", () => {
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getVolumeTrend([], now, 7);
    expect(result.points).toHaveLength(7);
    expect(result.points.every((p) => p.volumeKg === 0)).toBe(true);
    expect(result.deltaPct).toBeNull();
  });

  it("sums weight * reps from non-warmup sets", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-10-05T08:00:00",
        completedAt: "2026-10-05T08:30:00",
        sets: [
          { weight: 100, reps: 5, isWarmup: false }, // 500
          { weight: 80, reps: 3, isWarmup: false }, // 240
          { weight: 50, reps: 10, isWarmup: true }, // ignored
          { weight: null, reps: 5, isWarmup: false }, // ignored
          { weight: 100, reps: null, isWarmup: false }, // ignored
        ],
      }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getVolumeTrend(sessions, now, 7);
    const today = result.points[result.points.length - 1];
    expect(today.volumeKg).toBe(740);
  });

  it("computes deltaPct vs the previous window", () => {
    // Previous window (Sep 28 - Oct 4): 500 kg
    // Current window (Oct 5-11): 1000 kg
    // delta = (1000 - 500) / 500 * 100 = 100%
    const sessions = [
      makeSession({
        startedAt: "2026-09-30T08:00:00",
        completedAt: "2026-09-30T08:30:00",
        sets: [{ weight: 100, reps: 5 }], // 500 (previous window)
      }),
      makeSession({
        startedAt: "2026-10-06T08:00:00",
        completedAt: "2026-10-06T08:30:00",
        sets: [{ weight: 100, reps: 10 }], // 1000 (current window)
      }),
    ];
    const now = Date.parse("2026-10-12T12:00:00");
    const result = getVolumeTrend(sessions, now, 7);
    expect(result.deltaPct).toBe(100);
  });

  it("deltaPct is null when previous window has no volume", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-10-11T08:00:00",
        completedAt: "2026-10-11T08:30:00",
        sets: [{ weight: 100, reps: 5 }],
      }),
    ];
    const now = Date.parse("2026-10-12T12:00:00");
    const result = getVolumeTrend(sessions, now, 7);
    expect(result.deltaPct).toBeNull();
  });

  it("deltaPct is negative when volume decreased", () => {
    // Previous window: 1000 kg, current window: 500 kg → -50%
    const sessions = [
      makeSession({
        startedAt: "2026-09-30T08:00:00",
        completedAt: "2026-09-30T08:30:00",
        sets: [{ weight: 100, reps: 10 }], // 1000 (previous window)
      }),
      makeSession({
        startedAt: "2026-10-10T08:00:00",
        completedAt: "2026-10-10T08:30:00",
        sets: [{ weight: 100, reps: 5 }], // 500 (current window)
      }),
    ];
    const now = Date.parse("2026-10-12T12:00:00");
    const result = getVolumeTrend(sessions, now, 7);
    expect(result.deltaPct).toBe(-50);
  });
});

describe("getWeeklyProgress", () => {
  it("counts sessions completed this week", () => {
    // Oct 5 2026 is Monday. now = Oct 8 (Thursday).
    // Week = Oct 5-11 (Mon-Sun).
    const sessions = [
      makeSession({ startedAt: "2026-10-05T08:00:00", completedAt: "2026-10-05T08:30:00" }),
      makeSession({ startedAt: "2026-10-06T08:00:00", completedAt: "2026-10-06T08:30:00" }),
      makeSession({ startedAt: "2026-10-07T08:00:00", completedAt: "2026-10-07T08:30:00" }),
      // Not this week
      makeSession({ startedAt: "2026-09-30T08:00:00", completedAt: "2026-09-30T08:30:00" }),
      // This week but incomplete
      makeSession({ startedAt: "2026-10-08T08:00:00", completedAt: null }),
    ];
    const now = Date.parse("2026-10-08T12:00:00");
    const result = getWeeklyProgress(sessions, now, 3);
    expect(result.completed).toBe(3);
    expect(result.goal).toBe(3);
    expect(result.daysTrained).toEqual([true, true, true, false, false, false, false]);
  });

  it("returns all-false days for no sessions", () => {
    const now = Date.parse("2026-10-08T12:00:00");
    const result = getWeeklyProgress([], now);
    expect(result.completed).toBe(0);
    expect(result.daysTrained).toEqual([false, false, false, false, false, false, false]);
  });
});

describe("getNextSuggestedRoutine", () => {
  it("returns null for an empty plan", () => {
    expect(getNextSuggestedRoutine([], [], 1_760_000_000_000)).toBeNull();
  });

  it("suggests a never-done routine first", () => {
    const plan = [
      { id: "r1", title: "Upper", exerciseCount: 5, restSecondsPerExercise: 90 },
      { id: "r2", title: "Lower", exerciseCount: 6, restSecondsPerExercise: 120 },
    ];
    const sessions = [
      makeSession({
        startedAt: "2026-10-01T08:00:00",
        completedAt: "2026-10-01T08:30:00",
        routineId: "r1",
      }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getNextSuggestedRoutine(plan, sessions, now);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("r2");
    expect(result!.title).toBe("Lower");
    expect(result!.lastDoneAt).toBeNull();
  });

  it("suggests the routine trained least recently", () => {
    const plan = [
      { id: "r1", title: "Upper", exerciseCount: 5, restSecondsPerExercise: 90 },
      { id: "r2", title: "Lower", exerciseCount: 6, restSecondsPerExercise: 120 },
    ];
    const sessions = [
      makeSession({ startedAt: "2026-09-28T08:00:00", completedAt: "2026-09-28T08:30:00", routineId: "r1" }),
      makeSession({ startedAt: "2026-10-01T08:00:00", completedAt: "2026-10-01T08:30:00", routineId: "r2" }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getNextSuggestedRoutine(plan, sessions, now);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("r1");
    expect(result!.lastDoneAt).toBe("2026-09-28T08:00:00");
    expect(result!.estimatedDurationMin).toBeGreaterThan(0);
  });

  it("ignores incomplete sessions when finding lastDoneAt", () => {
    const plan = [
      { id: "r1", title: "Upper", exerciseCount: 5, restSecondsPerExercise: 90 },
    ];
    const sessions = [
      makeSession({ startedAt: "2026-09-28T08:00:00", completedAt: null, routineId: "r1" }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getNextSuggestedRoutine(plan, sessions, now);
    expect(result).not.toBeNull();
    expect(result!.lastDoneAt).toBeNull();
  });

  it("computes estimatedDurationMin from exercise count and rest", () => {
    const plan = [
      { id: "r1", title: "Full Body", exerciseCount: 6, restSecondsPerExercise: 90 },
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getNextSuggestedRoutine(plan, [], now);
    expect(result).not.toBeNull();
    // workMin = 6*3=18, restMin=round(6*90/60)=9, total=27, max(15,27)=27
    expect(result!.estimatedDurationMin).toBe(27);
  });

  it("minimum estimated duration is 15 minutes", () => {
    const plan = [
      { id: "r1", title: "Mini", exerciseCount: 1, restSecondsPerExercise: 30 },
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getNextSuggestedRoutine(plan, [], now);
    expect(result).not.toBeNull();
    expect(result!.estimatedDurationMin).toBe(15);
  });
});

describe("getMuscleBalance", () => {
  it("returns null when no set has a bodyPart", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-10-05T08:00:00",
        completedAt: "2026-10-05T08:30:00",
        sets: [{ weight: 100, reps: 5, bodyPart: null }],
      }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getMuscleBalance(sessions, now, 7);
    expect(result).toBeNull();
  });

  it("counts non-warmup sets per muscle group (within window)", () => {
    // BODY_PART_LABELS keys: "hamstrings" -> "Isquiotibiales",
    //                         "upper legs" -> "Cuádriceps"
    const sessions = [
      makeSession({
        startedAt: "2026-10-05T08:00:00",
        completedAt: "2026-10-05T08:30:00",
        sets: [
          { weight: 100, reps: 5, bodyPart: "upper legs", isWarmup: false },
          { weight: 100, reps: 5, bodyPart: "upper legs", isWarmup: false },
          { weight: 100, reps: 5, bodyPart: "hamstrings", isWarmup: false },
          { weight: 50, reps: 5, bodyPart: "upper legs", isWarmup: true }, // ignored
        ],
      }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getMuscleBalance(sessions, now, 7);
    expect(result).not.toBeNull();
    expect(result!["Cuádriceps"]).toBe(2);
    expect(result!["Isquiotibiales"]).toBe(1);
  });

  it("ignores sessions outside the window", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-09-20T08:00:00",
        completedAt: "2026-09-20T08:30:00",
        sets: [{ weight: 100, reps: 5, bodyPart: "hamstrings" }],
      }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getMuscleBalance(sessions, now, 7);
    expect(result).toBeNull();
  });

  it("ignores incomplete sessions", () => {
    const sessions = [
      makeSession({
        startedAt: "2026-10-05T08:00:00",
        completedAt: null,
        sets: [{ weight: 100, reps: 5, bodyPart: "hamstrings" }],
      }),
    ];
    const now = Date.parse("2026-10-05T12:00:00");
    const result = getMuscleBalance(sessions, now, 7);
    expect(result).toBeNull();
  });
});
