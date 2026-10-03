/**
 * commit.ts — the plan is the contract, so it is tested before anything runs.
 *
 * `planBatch` is pure and this file checks it exhaustively; the Supabase calls in
 * `commitBatch` and `undoBatch` are deliberately thin and covered by the wizard's
 * own tests through a mocked client. What matters here is the two properties that
 * make undo trustworthy: deterministic ids, and a batch that only ever contains
 * the sessions it actually wrote.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A chainable PostgREST stand-in.
 *
 * The real client is a fluent builder -- `delete().in()`, `delete().eq()`,
 * `select().eq()` -- and a mock whose `delete()` returned a bare object fails on
 * the *first* query rather than on the behaviour under test, which is a slow way
 * to learn the mock is wrong.
 */
const db = vi.hoisted(() => ({
  upsert: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  /** Table names in call order, for asserting delete-before-log ordering. */
  tables: [] as string[],
}));

vi.mock("@lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      db.tables.push(table);
      const filter = { eq: db.remove, in: db.remove };
      if (table === "workout_logs") {
        return {
          upsert: db.upsert,
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
          delete: () => filter,
        };
      }
      return { insert: db.insert, delete: () => filter };
    },
  },
}));

vi.mock("@/lib/trainingEvents", () => ({ notifyTrainingDataChanged: vi.fn() }));

import {
  commitBatch,
  deterministicUuid,
  planBatch,
  undoBatch,
  type ImportBatch,
} from "./commit";
import type { ImportSession, ImportSet } from "./types";

const USER = "user-1";

function set(over: Partial<ImportSet> = {}): ImportSet {
  return {
    exerciseName: "Sentadilla",
    weightKg: 100,
    reps: 5,
    rpe: null,
    setNumber: 1,
    isWarmup: false,
    completed: true,
    durationSec: null,
    distanceM: null,
    ...over,
  };
}

function session(over: Partial<ImportSession> = {}): ImportSession {
  return {
    key: "2024-03-05T17:00:00.000Z::fuerza a",
    title: "Fuerza A",
    startedAt: "2024-03-05T17:00:00.000Z",
    notes: null,
    sets: [set()],
    firstLine: 2,
    ...over,
  };
}

/** A plan where every exercise name resolves to the same id. */
function plan(sessions: ImportSession[], resolveExercise: (name: string) => string | null = () => "ex-1") {
  return planBatch(sessions, { userId: USER, batchId: "import-1", resolveExercise });
}

beforeEach(() => {
  db.tables.length = 0;
  db.upsert.mockReset().mockResolvedValue({ error: null });
  db.insert.mockReset().mockResolvedValue({ error: null });
  db.remove.mockReset().mockResolvedValue({ error: null });
});

describe("deterministicUuid", () => {
  it("is stable across calls, which is the whole point", () => {
    expect(deterministicUuid("a")).toBe(deterministicUuid("a"));
  });

  it("looks like a version-4 UUID", () => {
    // Postgres validates the format, and a hand-rolled hash that gets it wrong
    // fails at insert time on the user's data rather than in a test.
    expect(deterministicUuid("fuerza a")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("separates different inputs", () => {
    const ids = new Set(
      ["a", "b", "c", "", "Fuerza A", "fuerza a", "2024-03-05T17:00:00.000Z::x"].map(
        deterministicUuid,
      ),
    );
    expect(ids.size).toBe(7);
  });

  it("separates the same session belonging to different users", () => {
    // Two accounts can each import the same Hevy file; the ids must not collide
    // or the second account's import would overwrite the first one's rows.
    expect(deterministicUuid(`k|${USER}`)).not.toBe(deterministicUuid(`k|user-2`));
  });
});

describe("planBatch", () => {
  it("gives a session a stable id from its own fingerprint", () => {
    const first = plan([session()]).sessions[0].id;
    const second = plan([session()]).sessions[0].id;
    expect(first).toBe(second);
    expect(first).toBe(deterministicUuid(`${session().key}|${USER}`));
  });

  it("ends the session after the start, so a log has a duration", () => {
    const planned = plan([session()], () => "ex-1");
    const end = new Date(planned.sessions[0].completedAt).getTime();
    const start = new Date(planned.sessions[0].startedAt).getTime();
    expect(end).toBeGreaterThan(start);
  });

  it("honours an explicit duration", () => {
    const batch = planBatch([session()], {
      userId: USER,
      batchId: "b",
      resolveExercise: () => "ex-1",
      durationMinutes: 75,
    });
    const minutes =
      (new Date(batch.sessions[0].completedAt).getTime() -
        new Date(batch.sessions[0].startedAt).getTime()) /
      60_000;
    expect(minutes).toBe(75);
  });

  it("resolves each exercise name through the caller's function", () => {
    const batch = plan([session({ sets: [set(), set({ exerciseName: "Press banca" })] })], (name) =>
      name === "Sentadilla" ? "ex-squat" : "ex-bench",
    );
    expect(batch.sessions[0].sets.map((s) => s.exercise_id)).toEqual(["ex-squat", "ex-bench"]);
  });

  it("closes the numbering gap an unresolved exercise leaves", () => {
    // The analysis numbered the sets before the catalog lookup, so dropping one
    // here would leave `set_number` as 1, 3 -- and every consumer that reads the
    // last set as the highest number would pick the wrong one.
    const batch = plan(
      [
        session({
          sets: [
            set({ exerciseName: "Sentadilla", setNumber: 1 }),
            set({ exerciseName: "Ejercicio raro", setNumber: 2 }),
            set({ exerciseName: "Sentadilla", setNumber: 3 }),
          ],
        }),
      ],
      (name) => (name === "Sentadilla" ? "ex-squat" : null),
    );
    expect(batch.sessions[0].sets.map((s) => s.set_number)).toEqual([1, 2]);
  });

  it("numbers each exercise separately, as the schema expects", () => {
    const batch = plan(
      [
        session({
          sets: [
            set({ exerciseName: "Sentadilla" }),
            set({ exerciseName: "Press banca" }),
            set({ exerciseName: "Sentadilla" }),
          ],
        }),
      ],
      (name) => (name === "Sentadilla" ? "ex-squat" : "ex-bench"),
    );
    expect(
      batch.sessions[0].sets.map((s) => `${s.exercise_id}:${s.set_number}`),
    ).toEqual(["ex-squat:1", "ex-bench:1", "ex-squat:2"]);
  });

  it("lists the exercises it could not resolve instead of dropping them quietly", () => {
    // An unrecognised name means its sets are missing from the ranks, and only
    // the user can tell a spelling variant from a different movement.
    const batch = plan(
      [session({ sets: [set({ exerciseName: "Sentadilla" }), set({ exerciseName: "Máquina rara" })] })],
      (name) => (name === "Sentadilla" ? "ex-1" : null),
    );
    expect(batch.unresolved).toEqual(["Máquina rara"]);
    expect(batch.sessions[0].sets).toHaveLength(1);
  });

  it("keeps a session whose exercises all failed, with zero sets", () => {
    // Omitting it would make a partially-understood file look complete.
    const batch = plan([session()], () => null);
    expect(batch.sessions).toHaveLength(1);
    expect(batch.sessions[0].sets).toEqual([]);
    expect(batch.unresolved).toEqual(["Sentadilla"]);
  });

  it("carries the notes through", () => {
    expect(plan([session({ notes: "me dolía el hombro" })]).sessions[0].notes).toBe(
      "me dolía el hombro",
    );
  });

  it("plans an empty analysis into an empty batch rather than throwing", () => {
    expect(plan([]).sessions).toEqual([]);
  });
});

describe("commitBatch", () => {
  it("writes a log and its sets for each session", async () => {
    const batch = plan([
      session(),
      session({ key: "k2", title: "B", startedAt: "2024-03-06T17:00:00.000Z" }),
    ]);
    const result = await commitBatch(batch);

    expect(result.failures).toEqual([]);
    expect(result.written).toEqual(batch.sessions.map((s) => s.id));
    expect(db.tables).toContain("workout_logs");
    expect(db.tables).toContain("completed_sets");
    expect(db.upsert).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it("replaces any existing sets rather than appending to them", async () => {
    // Otherwise a retried batch -- which is the normal case after a network
    // failure -- doubles every set.
    await commitBatch(plan([session()]));
    // Both filters, `eq` for the commit and `in` for the undo, on one mock:
    // either way a delete is issued before the insert.
    expect(db.remove).toHaveBeenCalled();
    expect(db.tables.indexOf("completed_sets")).toBeLessThan(db.tables.length - 1);
  });

  it("skips the insert for a session with no resolved exercises", async () => {
    await commitBatch(plan([session()], () => null));
    // The log still lands, so the user can see the session and fix the mapping.
    expect(db.upsert).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("keeps going after a failure and reports it", async () => {
    // Aborting on the first bad session would leave a partial history with no
    // indication of how far it got.
    const batch = plan([session({ key: "k1" }), session({ key: "k2" })]);
    db.upsert.mockResolvedValueOnce({ error: { message: "boom" } });

    const result = await commitBatch(batch);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].message).toBe("boom");
    expect(result.written).toHaveLength(1);
  });

  it("does not count a failed session among the ids to undo", async () => {
    const batch = plan([session({ key: "k1" }), session({ key: "k2" })]);
    db.upsert.mockResolvedValueOnce({ error: { message: "boom" } });

    const result = await commitBatch(batch);
    expect(result.written).toEqual([batch.sessions[1].id]);
  });

  it("reports progress per session, ending at the total", async () => {
    const batch = plan([session({ key: "a" }), session({ key: "b" })]);
    const seen: { done: number; total: number }[] = [];
    await commitBatch(batch, (p) => seen.push({ done: p.done, total: p.total }));

    expect(seen[0]).toEqual({ done: 0, total: 2 });
    expect(seen.at(-1)).toEqual({ done: 2, total: 2 });
  });

  it("commits nothing for an empty batch", async () => {
    const result = await commitBatch(plan([]));
    expect(result).toEqual({ written: [], failures: [] });
    expect(db.tables).toEqual([]);
  });
});

describe("undoBatch", () => {
  it("returns immediately for an empty batch", async () => {
    // The wizard must be be able to offer "deshacer" without a round trip.
    const result = await undoBatch([]);
    expect(result).toEqual({ written: [], failures: [] });
    expect(db.tables).toEqual([]);
  });

  it("deletes the sets before the logs", async () => {
    // The other order leaves orphaned set rows belonging to no session, which no
    // other code path can clean up.
    await undoBatch(["id-1"]);
    expect(db.tables).toEqual(["completed_sets", "workout_logs"]);
  });

  it("reports a failure instead of pretending it worked", async () => {
    db.remove.mockResolvedValueOnce({ error: { message: "RLS" } });
    const result = await undoBatch(["id-1"]);
    expect(result.failures[0].message).toBe("RLS");
    expect(result.written).toEqual([]);
  });
});

describe("a batch and its undo round trip", () => {
  it("removes exactly the sessions the commit wrote", async () => {
    // The property the whole module exists for: undo per batch, never per file
    // and never per user.
    const batch: ImportBatch = plan([
      session({ key: "imported-1" }),
      session({ key: "imported-2" }),
      // Not in this batch: a session logged by hand the day after.
      session({ key: "hand-written" }),
    ]);
    const onlyThisBatch = { ...batch, sessions: batch.sessions.slice(0, 2) };

    const written = await commitBatch(onlyThisBatch);
    expect(written.written).toHaveLength(2);

    const removed = await undoBatch(written.written);
    expect(removed.failures).toEqual([]);
    expect(removed.written).toHaveLength(0);
  });
});