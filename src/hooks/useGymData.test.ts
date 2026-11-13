/**
 * @vitest-environment jsdom
 *
 * useGymData.test.ts — the routines list must not read the whole table.
 *
 * The list used to be three parallel reads: the user's routines, every link in
 * `routine_exercises` and every row in `exercises`. Two of them were
 * unbounded, so a routine of four exercises made the app download 1,324
 * exercises and every link every user had ever written. The links are now read
 * for these routines only, and the exercise each link points at comes with
 * them.
 *
 * The assertions are about the *queries*, not about the rows: a regression
 * here is a payload that grows with the size of the database rather than with
 * the size of the screen.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useRoutines } from "./useGymData";

const { calls, state } = vi.hoisted(() => ({
  calls: [] as { table: string; select: string; filters: string[] }[],
  state: { failRoutines: false },
}));

vi.mock("@lib/supabase", () => {
  const from = (table: string) => {
    const record = { table, select: "", filters: [] as string[] };
    const builder = {
      select(columns: string) {
        record.select = columns;
        return builder;
      },
      eq(column: string) {
        record.filters.push(`eq:${column}`);
        return builder;
      },
      in(column: string) {
        record.filters.push(`in:${column}`);
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        calls.push(record);
        const result =
          table === "routines" && state.failRoutines
            ? Promise.reject(new Error("db down"))
            : Promise.resolve({
              data: table === "routines" ? [{ id: "r-1", user_id: "u-1", title: "Rutina", created_at: "2026-01-01" }] : [],
              error: null,
            });
        return result.then(resolve, reject);
      },
    };
    return builder;
  };
  return { supabase: { from } };
});

beforeEach(() => {
  calls.length = 0;
  state.failRoutines = false;
});

afterEach(cleanup);

describe("useRoutines", () => {
  it("lee los enlaces de estas rutinas, no todos los enlaces", async () => {
    const { result } = renderHook(() => useRoutines("u-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const linkCall = calls.find((call) => call.table === "routine_exercises");
    expect(linkCall).toBeDefined();
    expect(linkCall?.filters).toContain("in:routine_id");
  });

  it("no lee la tabla exercises por su cuenta", async () => {
    const { result } = renderHook(() => useRoutines("u-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The exercise arrives with the link, not in a read of its own table.
    expect(calls.some((call) => call.table === "exercises")).toBe(false);
  });

  it("deja de cargar cuando la lectura falla, en vez de colgarse", async () => {
    state.failRoutines = true;
    const { result } = renderHook(() => useRoutines("u-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.routines).toEqual([]);
  });

  it("muestra la rutina recién creada sin esperar a la red", async () => {
    const { result } = renderHook(() => useRoutines("u-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.upsertLocalRoutine({
        id: "r-2",
        user_id: "u-1",
        title: "Día 0",
        description: null,
        created_at: "2026-01-02",
        is_favorite: false,
        source: "ai",
        authored_by_coach: null,
        is_template: false,
        exercises: [],
        routineMode: "single",
      });
    });

    expect(result.current.routines.map((row) => row.id)).toEqual(["r-2", "r-1"]);
    expect(result.current.loading).toBe(false);
  });
});
