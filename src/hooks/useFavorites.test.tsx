/**
 * @vitest-environment jsdom
 *
 * `toggleFavorite` is an optimistic write, which is the only kind of write that can
 * be wrong in three ways at once: it can display a value the server never accepted,
 * it can leave the row on the wrong value after a refusal, and it can apply two
 * rapid taps out of order. None of those show up in a component test, so they are
 * asserted here against the hook's own contract.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "b6293656-8dc4-4fa1-ad29-af8010702643";
const OTHER_USER = "00000000-0000-4000-8000-000000000000";

const ROUTINES = [
  {
    id: "r-1",
    user_id: USER,
    title: "Push",
    description: null,
    created_at: "2026-10-01T10:00:00.000Z",
    is_favorite: false,
  },
  {
    id: "r-2",
    user_id: USER,
    title: "Pull",
    description: null,
    created_at: "2026-09-01T10:00:00.000Z",
    is_favorite: true,
  },
];

const EXERCISES = [
  {
    id: "ex-1",
    name: "Press de banca",
    body_part: "upper",
    target: "chest",
    equipment: "barbell",
    gif_url: "",
    instructions: [],
  },
];

/** A write as the server received it, so the test can assert the request shape. */
interface WriteCall {
  id: string;
  userId: string | null;
  value: boolean;
}

/**
 * Stands in for the Supabase client.
 *
 * `update()` returns a thenable builder so the hook's `.update().eq().eq()` chain runs
 * unchanged, and it records the user scope that travelled with the request -- the
 * assertion that a routine belonging to another athlete updates zero rows.
 *
 * `holdWrites` lets a test keep a write open so a second tap can be queued behind it,
 * which is the only way to reproduce an out-of-order flip deterministically.
 */
function installSupabaseMock(options: {
  rows?: typeof ROUTINES;
  failWrites?: string | null;
  /** When true, writes block until `release()` is called. */
  holdWrites?: boolean;
} = {}) {
  const writes: WriteCall[] = [];
  let release: (() => void) | null = null;

  /** A chain that resolves to `result` when awaited. */
  function chain(result: { data: unknown; error: { message: string } | null }) {
    const builder: Record<string, unknown> = {};
    const filters: Record<string, string> = {};
    let update: { is_favorite: boolean } | null = null;

    for (const method of ["select", "in", "order", "limit"]) {
      builder[method] = () => builder;
    }
    builder.eq = (column: string, value: string) => {
      filters[column] = value;
      return builder;
    };
    builder.update = (values: { is_favorite: boolean }) => {
      update = values;
      return builder;
    };
    builder.then = async (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      try {
        if (update) {
          writes.push({
            id: filters.id ?? "",
            userId: filters.user_id ?? null,
            value: update.is_favorite,
          });
          if (options.holdWrites) {
            await new Promise<void>((r) => {
              release = r;
            });
          }
          resolve({
            data: null,
            error: options.failWrites ? { message: options.failWrites } : null,
          });
          return;
        }
        /*
         * Reads honour the equality filters the way PostgREST does. Without this the
         * mock hands back every row regardless of `.eq("user_id", €€¦)`, and a test
         * asserting "this routine is not the caller's" would pass for the wrong
         * reason -- or fail against a hook that is behaving correctly.
         */
        const filtered = (Array.isArray(result.data) ? result.data : []).filter((row) =>
          Object.entries(filters).every(
            ([column, value]) => (row as Record<string, unknown>)[column] === value,
          ),
        );
        resolve({ data: filtered, error: result.error });
      } catch (e) {
        reject(e);
      }
    };
    return builder;
  }

  const rows = options.rows ?? ROUTINES;

  vi.doMock("@/lib/supabase", () => ({
    supabase: {
      from: (name: string) => {
        if (name === "routines") return chain({ data: rows, error: null });
        if (name === "routine_exercises") return chain({ data: [], error: null });
        if (name === "exercises") return chain({ data: EXERCISES, error: null });
        throw new Error(`unexpected table ${name}`);
      },
    },
  }));

  return {
    writes,
    release: () => release?.(),
  };
}

async function loadRoutines() {
  const { useRoutines } = await import("@/hooks/useGymData");
  const { result } = renderHook(() => useRoutines(USER));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await waitFor(() => expect(result.current.routines).toHaveLength(2));
  return { result };
}

describe("useRoutines.toggleFavorite", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("flips the flag and scopes the write to the caller", async () => {
    const mock = installSupabaseMock();
    const { result } = await loadRoutines();

    const ok = await result.current.toggleFavorite("r-1");

    expect(ok).toBe(true);
    await waitFor(() =>
      expect(result.current.routines.find((r) => r.id === "r-1")?.is_favorite).toBe(true),
    );
    // The write carries the caller's id, so a uuid belonging to another athlete
    // updates zero rows instead of one.
    expect(mock.writes).toEqual([{ id: "r-1", userId: USER, value: true }]);
  });

  it("restores the previous value when the server refuses", async () => {
    installSupabaseMock({ failWrites: "permission denied" });
    const { result } = await loadRoutines();

    const ok = await result.current.toggleFavorite("r-1");

    expect(ok).toBe(false);
    // Back to unstarred, not left showing a favourite the server rejected.
    await waitFor(() =>
      expect(result.current.routines.find((r) => r.id === "r-1")?.is_favorite).toBe(false),
    );
    expect(result.current.error).toBe("permission denied");
  });

  it("unstars a routine that was already a favourite", async () => {
    const mock = installSupabaseMock();
    const { result } = await loadRoutines();

    const ok = await result.current.toggleFavorite("r-2");

    expect(ok).toBe(true);
    expect(mock.writes).toEqual([{ id: "r-2", userId: USER, value: false }]);
    await waitFor(() =>
      expect(result.current.routines.find((r) => r.id === "r-2")?.is_favorite).toBe(false),
    );
  });

  it("marks only the written row as pending", async () => {
    const mock = installSupabaseMock({ holdWrites: true });
    const { result } = await loadRoutines();

    const write = result.current.toggleFavorite("r-1");
    await waitFor(() => expect(result.current.pendingIds.has("r-1")).toBe(true));
    // Another row's star stays live: a global flag would disable the whole list.
    expect(result.current.pendingIds.has("r-2")).toBe(false);

    mock.release();
    await write;
    await waitFor(() => expect(result.current.pendingIds.has("r-1")).toBe(false));
  });

  it("applies two rapid taps in order, not out of order", async () => {
    const mock = installSupabaseMock({ holdWrites: true });
    const { result } = await loadRoutines();

    const first = result.current.toggleFavorite("r-1");
    await waitFor(() => expect(mock.writes).toHaveLength(1));

    // Queued behind the first write rather than racing it.
    const second = result.current.toggleFavorite("r-1");
    mock.release();
    await first;
    await waitFor(() => expect(mock.writes).toHaveLength(2));
    mock.release();
    await second;

    // Star, then unstar: two taps on a routine that started unstarred.
    expect(mock.writes.map((w) => w.value)).toEqual([true, false]);
    await waitFor(() =>
      expect(result.current.routines.find((r) => r.id === "r-1")?.is_favorite).toBe(false),
    );
  });

  it("refuses to write with no user", async () => {
    const mock = installSupabaseMock();
    const { useRoutines } = await import("@/hooks/useGymData");
    const { result } = renderHook(() => useRoutines(null));

    expect(await result.current.toggleFavorite("r-1")).toBe(false);
    expect(mock.writes).toEqual([]);
  });
});

describe("useFavorites", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns only the flagged routines", async () => {
    installSupabaseMock();
    const { useFavorites } = await import("@/hooks/useGymData");
    const { result } = renderHook(() => useFavorites(USER));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.favorites.map((r) => r.id)).toEqual(["r-2"]);
  });

  it("is empty when the athlete has no favourites", async () => {
    installSupabaseMock({
      rows: [
        { ...ROUTINES[0], is_favorite: false },
        { ...ROUTINES[1], is_favorite: false },
      ],
    });
    const { useFavorites } = await import("@/hooks/useGymData");
    const { result } = renderHook(() => useFavorites(USER));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.favorites).toEqual([]);
  });

  it("does not offer another athlete's routines as favourites", async () => {
    installSupabaseMock({ rows: [{ ...ROUTINES[0], user_id: OTHER_USER, is_favorite: true }] });
    const { useFavorites } = await import("@/hooks/useGymData");
    const { result } = renderHook(() => useFavorites(USER));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.favorites).toEqual([]);
  });
});