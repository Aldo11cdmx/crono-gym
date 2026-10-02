/**
 * @vitest-environment jsdom
 *
 * Pagination tests for the history read in `useMuscleRanks`.
 *
 * The bug these cover is invisible from the outside: PostgREST truncates a
 * response at 1000 rows and still reports success, so an unpaginated read looks
 * fine while the map is computed from a partial history. The demo account has
 * 1,221 sets across 56 sessions and a 1,283-row exercise catalog, so both reads
 * were affected and every score came out lower than the same data scored in full.
 *
 * These assert on the ranges the hook requests rather than on scores, because
 * paging is a request-shaping decision and score assertions would couple the
 * test to the scorer's tuning.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Rows per response, matching the server's default `max-rows`. */
const CAP = 1000;

interface FakeSet {
  log_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  is_warmup: boolean;
}

const USER = "b6293656-8dc4-4fa1-ad29-af8010702643";

const LOGS = [
  { id: "log-1", started_at: "2026-10-01T10:00:00.000Z", completed_at: "2026-10-01T11:00:00.000Z" },
];

const EXERCISE = {
  id: "ex-1",
  name: "Sentadilla trasera",
  target: "quads",
  body_part: "lower",
  equipment: "barbell",
};

/** `total` sets, all belonging to the single session above. */
function makeSets(total: number): FakeSet[] {
  return Array.from({ length: total }, (_, i) => ({
    log_id: "log-1",
    exercise_id: EXERCISE.id,
    weight: 60 + (i % 40),
    reps: 8,
    is_warmup: false,
  }));
}

/** Row counts and injected failures, per table. */
interface Fixture {
  sets: FakeSet[];
  exercises: unknown[];
  /** Fails the nth (zero-based) range call for a table, as PostgREST would. */
  failRange?: (table: string, callIndex: number) => string | null;
}

/**
 * Stands in for the Supabase client.
 *
 * Records every `range()` call so a test can assert that paging happened, and so
 * it can truncate exactly like the server does rather than returning everything.
 */
function installSupabaseMock(fixture: Fixture) {
  const calls: { table: string; from: number; to: number }[] = [];
  const perTable = new Map<string, number>();

  const table = (name: string, rows: unknown[]) => {
    const builder: Record<string, unknown> = {};
    // Present only so the hook's filter chain type-checks and runs unchanged.
    for (const method of ["select", "eq", "not", "gte", "in", "order", "limit", "maybeSingle"]) {
      builder[method] = () => builder;
    }
    builder.range = (from: number, to: number) => {
      const index = perTable.get(name) ?? 0;
      perTable.set(name, index + 1);
      calls.push({ table: name, from, to });

      const failure = fixture.failRange?.(name, index);
      if (failure) return Promise.resolve({ data: null, error: { message: failure } });

      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    };
    return builder;
  };

  vi.doMock("@/lib/supabase", () => ({
    supabase: {
      from: (name: string) => {
        if (name === "workout_logs") return table(name, LOGS);
        if (name === "completed_sets") return table(name, fixture.sets);
        if (name === "exercises") return table(name, fixture.exercises);
        if (name === "profiles") {
          const builder: Record<string, unknown> = {};
          for (const method of ["select", "eq", "maybeSingle"]) builder[method] = () => builder;
          builder.then = (resolve: (v: unknown) => void) =>
            resolve({ data: { weight_kg: 70, sex: "male" }, error: null });
          return builder;
        }
        throw new Error(`unexpected table ${name}`);
      },
    },
  }));

  return calls;
}

/** Spies on the history store, which stands in for IndexedDB under jsdom. */
const saveLastRanks = vi.fn(async () => {});
const appendRankHistory = vi.fn(async () => {});

vi.mock("@/lib/ranks/rankHistory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ranks/rankHistory")>();
  return {
    ...actual,
    loadLastRanks: vi.fn(async () => ({})),
    loadRankHistory: vi.fn(async () => []),
    saveLastRanks: (...args: unknown[]) => saveLastRanks(...(args as [])),
    appendRankHistory: (...args: unknown[]) => appendRankHistory(...(args as [])),
  };
});

/** Mounts the hook and waits for the first completed load. */
async function loadRanks() {
  const { useMuscleRanks } = await import("@/hooks/useMuscleRanks");
  const { result } = renderHook(() => useMuscleRanks(USER));
  await waitFor(() => expect(result.current.initialLoading).toBe(false));
  await waitFor(() => expect(result.current.map).not.toBeNull());
  return result;
}

describe("useMuscleRanks history pagination", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
  });

  it("asks for a second page when the first one comes back full", async () => {
    // 1,221 sets: the demo account's real total. One request returns 1,000 of
    // them and only paging returns the remaining 221.
    const calls = installSupabaseMock({ sets: makeSets(1221), exercises: [EXERCISE] });
    await loadRanks();

    const setRanges = calls.filter((c) => c.table === "completed_sets");
    expect(setRanges.map((c) => [c.from, c.to])).toEqual([
      [0, CAP - 1],
      [CAP, CAP * 2 - 1],
    ]);
  });

  it("stops after one request when the history fits in a single response", async () => {
    const calls = installSupabaseMock({ sets: makeSets(400), exercises: [EXERCISE] });
    await loadRanks();

    // A short page is the end-of-data signal, so no speculative second request.
    const setRanges = calls.filter((c) => c.table === "completed_sets");
    expect(setRanges).toHaveLength(1);
    expect(setRanges[0]).toMatchObject({ from: 0, to: CAP - 1 });
  });

  it("pages the exercise catalog, whose tail carries real training data", async () => {
    // The catalog is 1,283 rows in production. An unpaginated read silently drops
    // the last 283, and every set pointing at a dropped exercise is then discarded
    // by the hook, so this is a data-correctness bug and not just a bytes one.
    const exercises = Array.from({ length: 1283 }, (_, i) => ({
      ...EXERCISE,
      id: `ex-${i}`,
    }));
    const calls = installSupabaseMock({ sets: makeSets(200), exercises });
    await loadRanks();

    const catalogRanges = calls.filter((c) => c.table === "exercises");
    expect(catalogRanges.map((c) => [c.from, c.to])).toEqual([
      [0, CAP - 1],
      [CAP, CAP * 2 - 1],
    ]);
  });

  it("pages sessions rather than assuming one response is the whole history", async () => {
    const calls = installSupabaseMock({ sets: makeSets(10), exercises: [EXERCISE] });
    await loadRanks();

    const logRanges = calls.filter((c) => c.table === "workout_logs");
    expect(logRanges.map((c) => [c.from, c.to])).toEqual([[0, CAP - 1]]);
  });

  it("splits the log-id filter into chunks the URL can carry", async () => {
    // 120 sessions: a single `in.(...)` of 120 uuids is a URL length that
    // proxies reject, so the hook chunks it. Each chunk pages independently.
    const logs = Array.from({ length: 120 }, (_, i) => ({
      id: `log-${i}`,
      started_at: "2026-10-01T10:00:00.000Z",
      completed_at: "2026-10-01T11:00:00.000Z",
    }));

    const calls: { table: string; from: number; to: number }[] = [];
    const perTable = new Map<string, number>();

    vi.doMock("@/lib/supabase", () => ({
      supabase: {
        from: (name: string) => {
          const rows =
            name === "workout_logs" ? logs : name === "completed_sets" ? [] : [EXERCISE];
          const builder: Record<string, unknown> = {};
          for (const method of [
            "select",
            "eq",
            "not",
            "gte",
            "in",
            "order",
            "limit",
            "maybeSingle",
          ]) {
            builder[method] = () => builder;
          }
          builder.range = (from: number, to: number) => {
            const index = perTable.get(name) ?? 0;
            perTable.set(name, index + 1);
            calls.push({ table: name, from, to });
            return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
          };
          return builder;
        },
      },
    }));

    const result = await loadRanks();

    // 120 ids at 50 per chunk is three requests, each paged to its own end.
    const setCalls = calls.filter((c) => c.table === "completed_sets");
    expect(setCalls).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a failed page as an error instead of a short history", async () => {
    installSupabaseMock({
      sets: makeSets(1500),
      exercises: [EXERCISE],
      // The second page of sets fails, which is where an unpaginated read would
      // have returned its truncated first page and reported nothing wrong.
      failRange: (table, index) => (table === "completed_sets" && index === 1 ? "boom" : null),
    });
    const result = await loadRanks();
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toBe("boom");
  });
});

/**
 * The persist effect feeds `previous` back into the `map` memo.
 *
 * If it stores a fresh object every pass, the memo is invalidated, the effect
 * re-runs, and the cycle repeats without end. That loop pins the main thread, so
 * the map never repaints and no click handler appears to run -- which is exactly
 * how the front/back toggle and the summary cards presented as two unrelated
 * wiring bugs. Every other suite passed while the real view was unusable, so this
 * is asserted as a run count rather than inferred from the rendered result.
 */
describe("useMuscleRanks persistence settles", () => {
  beforeEach(() => {
    vi.resetModules();
    saveLastRanks.mockClear();
    appendRankHistory.mockClear();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
  });

  it("does not recompute in a loop when the ranks are unchanged", async () => {
    installSupabaseMock({ sets: makeSets(200), exercises: [EXERCISE] });
    await loadRanks();

    const atSettle = saveLastRanks.mock.calls.length;
    // Long enough to catch a loop, which ran at well over 1,000 passes per second.
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(atSettle).toBeGreaterThan(0);
    expect(saveLastRanks.mock.calls.length).toBe(atSettle);
  });

  it("persists once, not once per render", async () => {
    installSupabaseMock({ sets: makeSets(200), exercises: [EXERCISE] });
    await loadRanks();

    // One pass writes the ranks; a second pass would find the same snapshot and
    // record nothing, which is what the bail-out in the effect relies on.
    expect(saveLastRanks).toHaveBeenCalledTimes(1);
  });

  it("still returns a usable map after settling", async () => {
    // The end-to-end consequence: with the loop in place the view computed
    // thousands of maps and never went idle, so the map and the click handlers
    // on top of it never got a turn.
    installSupabaseMock({ sets: makeSets(200), exercises: [EXERCISE] });
    const result = await loadRanks();

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(result.current.error).toBeNull();
    // One session and one exercise is below the eligibility floor, so the map
    // exists but is empty; what matters is that it is settled and rendered.
    expect(result.current.map).not.toBeNull();
  });
});
