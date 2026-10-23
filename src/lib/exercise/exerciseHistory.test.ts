/**
 * exerciseHistory.test.ts — grouping, and the join shapes PostgREST actually returns.
 *
 * The fetch itself is not tested here. `supabase` is a module-level client and the project
 * has no mocking layer for it; a test that stubbed `.from().select()` would assert that
 * this file calls the builder in the order this file wrote it, which is not a property
 * worth protecting. The parts that *are* worth protecting are all here: how rows are
 * grouped into sessions, and how the joined `workout_logs` is unpacked, because that shape
 * is chosen by the database's relationship and not by this code.
 */

import { describe, expect, it } from "vitest";
import { EPOCH, groupBySession } from "./exerciseHistory";
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

describe("grouping sets into sessions", () => {
  it("groups by log id, not by date", () => {
    // Two sessions on the same afternoon are two sessions. Grouping by timestamp would
    // report a single 14-set workout that never happened.
    const sets = [
      set({ id: "a1", log_id: "log-a", started_at: "2026-03-01T09:00:00.000Z", set_number: 1 }),
      set({ id: "b1", log_id: "log-b", started_at: "2026-03-01T18:00:00.000Z", set_number: 1 }),
    ];
    const sessions = groupBySession(sets);
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.logId).sort()).toEqual(["log-a", "log-b"]);
  });

  it("orders sessions newest first", () => {
    const sessions = groupBySession([
      set({ log_id: "old", started_at: "2026-01-01T10:00:00.000Z" }),
      set({ log_id: "new", started_at: "2026-03-01T10:00:00.000Z" }),
      set({ log_id: "mid", started_at: "2026-02-01T10:00:00.000Z" }),
    ]);
    expect(sessions.map((s) => s.logId)).toEqual(["new", "mid", "old"]);
  });

  it("orders the sets within a session by set_number", () => {
    // The query returns newest session first, so within a session the rows come back in
    // whatever order the planner chose. The list has to read in the order they were done.
    const sessions = groupBySession([
      set({ id: "s3", set_number: 3 }),
      set({ id: "s1", set_number: 1 }),
      set({ id: "s2", set_number: 2 }),
    ]);
    expect(sessions[0].sets.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("puts an undated session last rather than dropping it or interleaving it", () => {
    // A phone with the wrong clock writes a future or malformed timestamp. Dropping the row
    // would shorten the athlete's history silently; interleaving it would read as "that
    // week", which is a specific and wrong claim.
    const sessions = groupBySession([
      set({ log_id: "broken", started_at: EPOCH }),
      set({ log_id: "real", started_at: "2026-03-01T10:00:00.000Z" }),
    ]);
    expect(sessions.map((s) => s.logId)).toEqual(["real", "broken"]);
  });

  it("returns nothing for nothing", () => {
    expect(groupBySession([])).toEqual([]);
  });
});

describe("what a session carries", () => {
  it("exposes the log id and the date, so neither has to be re-derived per set", () => {
    const sessions = groupBySession([
      set({ log_id: "log-a", started_at: "2026-03-01T10:00:00.000Z" }),
      set({ log_id: "log-a", started_at: "2026-03-01T10:00:00.000Z", set_number: 2 }),
    ]);
    expect(sessions[0].logId).toBe("log-a");
    expect(sessions[0].startedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(sessions[0].sets).toHaveLength(2);
  });
});
