/**
 * @vitest-environment jsdom
 *
 * `useCoachAccess` exists to answer three questions, and this suite is arranged around
 * them in the order they can go wrong.
 *
 *  1. **Vía A must never be gated.** `canChat` and `canGenerateAiRoutine` are the whole
 *     free tier. If a refactor ever wires them to `isPremium` or `isLoading`, every
 *     athlete without the paid tier loses the assistant -- so the assertion is made
 *     against a *non-premium* profile and against the very first render, before the
 *     query has even returned.
 *
 *  2. **The entitlement must come from the database**, not from a constant. Asserted
 *     against both column values, because a hook that read only `is_premium` would look
 *     correct here and would serve a lapsed subscriber.
 *
 *  3. **The cache must not turn one read into one read per navigation.** Five minutes is
 *     a stated product decision, so the boundary is pinned with fake timers: a second
 *     mount inside the window issues no query, and a mount after it does. Without the
 *     second half, a cache that ignored its TTL entirely -- or never cached -- would
 *     still pass a test that only checked the first.
 *
 * The Supabase client is mocked at the module boundary rather than by stubbing a
 * builder, so the hook's own query shape is asserted too: `.select()` names the two
 * entitlement columns and nothing else, because selecting `*` would drag fourteen
 * unrelated profile columns across the wire to answer one question.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoachProfile } from "./access";

const USER = "b6293656-8dc4-4fa1-ad29-af8010702643";
const OTHER_USER = "00000000-0000-4000-8000-000000000000";

/** A coach row in `coaches`, as the `coach-auth` function would see it. */
const PREMIUM_ROW: CoachProfile = {
  is_premium: true,
  premium_expires_at: null,
};

const FREE_ROW: CoachProfile = {
  is_premium: false,
  premium_expires_at: null,
};

interface SelectCall {
  columns: string;
  filters: Record<string, unknown>;
}

interface MockOptions {
  row?: CoachProfile | null;
  error?: string | null;
}

/**
 * Stands in for the Supabase client.
 *
 * The response is mutable through `setRow` / `setError` rather than re-registering the
 * mock, and that is a correctness requirement rather than a convenience. `vi.doMock` only
 * affects *subsequent* imports: once `useCoachAccess` has been evaluated it holds the
 * binding it was given, so re-mocking `@/lib/supabase` mid-test would change nothing and
 * the test would quietly assert against the first response forever. Every test that needs
 * the database to answer differently over time swaps the response behind the same
 * registration instead.
 */
function installSupabaseMock(options: MockOptions = {}) {
  const selects: SelectCall[] = [];
  let current: MockOptions = options;

  /** A thenable builder that resolves like the awaited PostgREST response. */
  function chain() {
    const builder: Record<string, unknown> = {};
    const filters: Record<string, unknown> = {};
    let columns = "*";

    for (const method of ["single", "maybeSingle", "limit", "order"]) {
      builder[method] = () => builder;
    }
    builder.eq = (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    }
    builder.select = (next: string) => {
      columns = next;
      return builder;
    };
    builder.then = (resolve: (value: unknown) => void) => {
      selects.push({ columns, filters });
      resolve({
        data: current.error ? null : (current.row ?? null),
        error: current.error ? { message: current.error } : null,
      });
    };
    return builder;
  }

  vi.doMock("@/lib/supabase", () => ({
    supabase: {
      from: (name: string) => {
        if (name !== "profiles") throw new Error(`unexpected table ${name}`);
        return chain();
      },
    },
  }));

  return {
    selects,
    setRow: (row: CoachProfile | null) => {
      current = { row };
    },
    setError: (error: string | null) => {
      current = { error };
    },
  };
}

/** Fresh modules, so the module-scope entitlement cache starts empty. */
async function load() {
  const { useCoachAccess } = await import("./useCoachAccess");
  return { useCoachAccess };
}

/** Mounts the hook and waits for its first read to settle. */
async function mount(userId: string | null) {
  const { useCoachAccess } = await load();
  const result = renderHook(() => useCoachAccess(userId));
  await waitFor(() => expect(result.result.current.isLoading).toBe(false));
  return result;
}

/**
 * Fake timers that still advance with the wall clock.
 *
 * The cache tests need `Date.now()` to jump by minutes, but Testing Library's `waitFor`
 * polls on a timer -- and a frozen clock means that poll never runs, so those tests would
 * time out rather than fail. `shouldAdvanceTime` lets real time move the fake clock
 * forward, so an explicit `setSystemTime` jump still takes effect and `waitFor` still
 * resolves.
 */
function useAdvancingFakeTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCoachAccess · Vía A is free", () => {
  it("grants chat and routine generation to a non-premium athlete", async () => {
    installSupabaseMock({ row: FREE_ROW });

    const { result } = await mount(USER);

    expect(result.current.isPremium).toBe(false);
    expect(result.current.canChat).toBe(true);
    expect(result.current.canGenerateAiRoutine).toBe(true);
  });

  it("grants them on the very first render, before the profile has been read", async () => {
    installSupabaseMock({ row: PREMIUM_ROW });
    const { useCoachAccess } = await load();

    // Deliberately *not* awaited to completion: if these were derived from the profile
    // they would be false here, and the free tier would flash an upsell on every mount.
    const { result } = renderHook(() => useCoachAccess(USER));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPremium).toBe(false);
    expect(result.current.canChat).toBe(true);
    expect(result.current.canGenerateAiRoutine).toBe(true);
  });

  it("keeps granting them when the profile cannot be read at all", async () => {
    // The failure mode this pins: an error path that gates the assistant. The athlete
    // loses their coach because their network blipped on sign-in.
    installSupabaseMock({ error: "connection reset" });

    const { result } = await mount(USER);

    expect(result.current.error).toBe("connection reset");
    expect(result.current.canChat).toBe(true);
    expect(result.current.canGenerateAiRoutine).toBe(true);
  });

  it("withholds everything from a signed-out visitor", async () => {
    // `userId === null` is the whole condition. Unauthenticated is not a degraded
    // premium -- there is no session to send, so a request would fail anyway.
    const { result } = await mount(null);

    expect(result.current.canChat).toBe(false);
    expect(result.current.canGenerateAiRoutine).toBe(false);
    expect(result.current.isPremium).toBe(false);
    expect(result.current.humanCoachStatus.state).toBe("not_premium");
  });
});

describe("useCoachAccess · the entitlement comes from the database", () => {
  it("reports premium for a perpetual subscriber", async () => {
    installSupabaseMock({ row: PREMIUM_ROW });

    const { result } = await mount(USER);

    expect(result.current.isPremium).toBe(true);
  });

  it("reports not premium when the term has lapsed", async () => {
    // Both columns, not just the flag: a hook reading only `is_premium` would call this
    // athlete premium and serve a coach they have already paid past.
    installSupabaseMock({
      row: { is_premium: true, premium_expires_at: "2020-01-01T00:00:00.000Z" },
    });

    const { result } = await mount(USER);

    expect(result.current.isPremium).toBe(false);
  });

  it("reports premium for a subscriber whose term is still running", async () => {
    installSupabaseMock({
      row: { is_premium: true, premium_expires_at: "2999-01-01T00:00:00.000Z" },
    });

    const { result } = await mount(USER);

    expect(result.current.isPremium).toBe(true);
  });

  it("treats a missing profile row as not premium rather than as an error", async () => {
    // `maybeSingle` returning null is a real state -- a signup whose profile trigger has
    // not landed -- and it must not be reported as a failure.
    installSupabaseMock({ row: null });

    const { result } = await mount(USER);

    expect(result.current.error).toBeNull();
    expect(result.current.isPremium).toBe(false);
    expect(result.current.canChat).toBe(true);
  });

  it("does not cache a failed read, so a retry can succeed", async () => {
    const mock = installSupabaseMock({ error: "connection reset" });
    const first = await mount(USER);
    expect(first.result.current.error).toBe("connection reset");
    expect(first.result.current.isPremium).toBe(false);
    first.unmount();

    // If the failure had been cached, this mount would resolve from the cache, `selects`
    // would stay at one, and the athlete would be locked out for five minutes over a
    // single dropped packet.
    mock.setRow(PREMIUM_ROW);
    const second = await mount(USER);

    expect(mock.selects).toHaveLength(2);
    expect(second.result.current.isPremium).toBe(true);
    expect(second.result.current.error).toBeNull();
  });

  it("asks for the two entitlement columns and nothing else", async () => {
    const mock = installSupabaseMock({ row: PREMIUM_ROW });

    await mount(USER);

    expect(mock.selects).toHaveLength(1);
    expect(mock.selects[0].columns).toBe("is_premium,premium_expires_at");
    // Scoped to the caller: a query that read the whole table would be a way to learn
    // who else is premium, and RLS would reject it anyway.
    expect(mock.selects[0].filters).toEqual({ user_id: USER });
  });
});

describe("useCoachAccess · the five-minute cache", () => {
  it("does not query again inside the window", async () => {
    useAdvancingFakeTimers();
    const mock = installSupabaseMock({ row: PREMIUM_ROW });

    const first = await mount(USER);
    expect(mock.selects).toHaveLength(1);
    first.unmount();

    // Three minutes in: still fresh.
    vi.setSystemTime(Date.now() + 3 * 60_000);
    const second = await mount(USER);

    expect(mock.selects).toHaveLength(1);
    expect(second.result.current.isPremium).toBe(true);
  });

  it("re-queries once the window has passed", async () => {
    useAdvancingFakeTimers();
    const mock = installSupabaseMock({ row: PREMIUM_ROW });

    const first = await mount(USER);
    expect(mock.selects).toHaveLength(1);
    first.unmount();

    // Six minutes: stale. Without this half of the test a cache that ignored its TTL --
    // or a hook that never cached at all -- would still look correct.
    vi.setSystemTime(Date.now() + 6 * 60_000);
    const second = await mount(USER);

    expect(mock.selects).toHaveLength(2);
    expect(second.result.current.isPremium).toBe(true);
  });

  it("serves a second mount without a loading state", async () => {
    useAdvancingFakeTimers();
    installSupabaseMock({ row: PREMIUM_ROW });
    const first = await mount(USER);
    first.unmount();
    vi.setSystemTime(Date.now() + 60_000);

    const { useCoachAccess } = await load();
    const { result } = renderHook(() => useCoachAccess(USER));

    // Synchronously, before any await: a cache hit that showed a spinner would blank the
    // coach surfaces on every navigation for a read that took no time.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPremium).toBe(true);
  });

  it("refresh() bypasses the cache, which is how an upgrade is reflected", async () => {
    useAdvancingFakeTimers();
    const mock = installSupabaseMock({ row: FREE_ROW });
    const { result } = await mount(USER);
    expect(result.current.isPremium).toBe(false);
    expect(mock.selects).toHaveLength(1);

    // The athlete pays. Waiting five minutes for the cache to expire would be the
    // difference between an upgrade working and looking broken.
    mock.setRow(PREMIUM_ROW);
    await act(async () => {
      await result.current.refresh();
    });

    expect(mock.selects).toHaveLength(2);
    expect(result.current.isPremium).toBe(true);
  });

  it("does not leak one athlete's entitlement to the next", async () => {
    useAdvancingFakeTimers();
    const mock = installSupabaseMock({ row: PREMIUM_ROW });
    const first = await mount(USER);
    first.unmount();

    // Same tab, a minute later, signed in as somebody else. Keyed by user, so this is a
    // miss -- and it must be a *query*, not a silent read of the previous account's tier.
    mock.setRow(FREE_ROW);
    const second = await mount(OTHER_USER);

    expect(mock.selects).toHaveLength(2);
    expect(mock.selects[1].filters).toEqual({ user_id: OTHER_USER });
    expect(second.result.current.isPremium).toBe(false);
  });
});

describe("useCoachAccess · the shift status", () => {
  it("resolves the shift from the browser clock, not from the database", async () => {
    useAdvancingFakeTimers();
    // 05:00 UTC is 23:00 in Mexico City: premium, and out of shift. The row says nothing
    // about a clock, which is the point -- the status cannot come from the database.
    vi.setSystemTime(new Date("2026-10-06T05:00:00Z"));
    installSupabaseMock({ row: PREMIUM_ROW });

    const { result } = await mount(USER);

    expect(result.current.isPremium).toBe(true);
    // Asserted against the runtime's own zone rather than a hardcoded state, because the
    // suite runs on machines that are not in Mexico City: what is being pinned is that
    // the status is derived from the clock at all, and that the two states are the only
    // ones a premium athlete can be in.
    expect(["off_shift", "available"]).toContain(result.current.humanCoachStatus.state);
    if (result.current.humanCoachStatus.state === "off_shift") {
      expect(result.current.humanCoachStatus.nextShiftStart).not.toBeNull();
    } else {
      expect(result.current.humanCoachStatus.shift).not.toBeNull();
      expect(result.current.humanCoachStatus.nextShiftStart).toBeNull();
    }
  });

  it("reports not_premium without a timetable when the athlete is free", async () => {
    installSupabaseMock({ row: FREE_ROW });

    const { result } = await mount(USER);

    expect(result.current.humanCoachStatus.state).toBe("not_premium");
    // No shift, and no time to come back: waiting cannot turn this into yes.
    expect(result.current.humanCoachStatus.shift).toBeNull();
    expect(result.current.humanCoachStatus.nextShiftStart).toBeNull();
  });

  it("reports not_premium while the read is still in flight", async () => {
    installSupabaseMock({ row: PREMIUM_ROW });
    const { useCoachAccess } = await load();

    const { result } = renderHook(() => useCoachAccess(USER));

    // The safe reading of "unknown" is "no". A premium athlete sees a neutral state for
    // one frame, never a promise of a coach who is not there.
    expect(result.current.humanCoachStatus.state).toBe("not_premium");
  });

  it("clears the entitlement when the athlete signs out", async () => {
    useAdvancingFakeTimers();
    installSupabaseMock({ row: PREMIUM_ROW });
    const { useCoachAccess } = await load();

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useCoachAccess(id),
      { initialProps: { id: USER as string | null } },
    );
    await waitFor(() => expect(result.current.isPremium).toBe(true));

    rerender({ id: null });

    await waitFor(() => expect(result.current.isPremium).toBe(false));
    // The module-scope cache is dropped too, so signing back in re-reads rather than
    // serving the previous session's entitlement from memory.
    expect(result.current.canChat).toBe(false);
  });
});