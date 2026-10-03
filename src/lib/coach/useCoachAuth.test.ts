/**
 * @vitest-environment jsdom
 *
 * The security claims in `useCoachAuth` are the ones this suite exists to hold:
 *
 *  1. **Nothing is persisted.** The module's whole design is that a coach session lives
 *     in memory and dies with the page, and there is no test for a negative property in
 *     the codebase that would catch a future "just add a sessionStorage key so the portal
 *     survives a refresh". So it is asserted directly: after a successful unlock, the PIN
 *     and the issued token appear in no storage API. A test that fails the moment someone
 *     adds one line is the only kind that keeps this true.
 *
 *  2. **The lockout is the server's.** A 429 is the interesting response because it is the
 *     one carrying state the client does not have -- `lockedUntil`. The assertion is that
 *     the value is taken from the body verbatim and surfaced, and that `Retry-After` is a
 *     fallback rather than a second source of truth.
 *
 *  3. **Idle really locks.** Thirty minutes with fake timers, and re-arming on activity,
 *     because a timer that fires on a fixed schedule from the unlock would expire a coach
 *     who has been working the whole time.
 *
 *  4. **Failure does not look like success, and success does not look like failure.** The
 *     provisional-PIN state is neither: it is its own branch, and the two easy bugs are
 *     clearing it on a typo and keeping it after a successful change.
 *
 *  5. **State is shared, not per-component.** The idle timer fires with no component
 *     mounted, so `lock()` has to reach every mounted gate. Two hooks, one session.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CALLER_TOKEN = "athlete-session-access-token";
const COACH_TOKEN = "coach-issued-jwt";
const PIN = "4821";

/** What the function answers with, per test. */
interface FakeReply {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/**
 * Records every fetch so the suite can assert the request shape as well as the outcome.
 *
 * A thrown error stands for a request that never arrived -- DNS, TLS, a dropped socket.
 */
function installFetch(reply: FakeReply | Error) {
  const calls: { url: string; init: RequestInit | undefined; body: unknown }[] = [];
  let current: FakeReply | Error = reply;

  const impl = vi.fn(async (url: string, init: RequestInit) => {
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, init, body });

    if (current instanceof Error) throw current;

    return new Response(JSON.stringify(current.body), {
      status: current.status,
      headers: { "Content-Type": "application/json", ...(current.headers ?? {}) },
    });
  });

  vi.stubGlobal("fetch", impl);

  return {
    calls,
    /**
     * Swap what the function answers next.
     *
     * A mutable reply rather than re-stubbing `fetch`, so the recorded calls stay
     * continuous across the swap and a test can assert the request that produced the
     * second outcome as well as the outcome itself.
     */
    setReply: (next: FakeReply | Error) => {
      current = next;
    },
    /** The auth header sent, or null. */
    authHeader: () => {
      const headers = calls[0]?.init?.headers as Record<string, string> | undefined;
      return headers?.Authorization ?? null;
    },
    /** The JSON body of the last call. */
    lastBody: () => calls[calls.length - 1]?.body,
  };
}

/** Stubs the Supabase auth client whose token authenticates the call. */
function installSupabaseAuth() {
  vi.doMock("@/lib/supabase", () => ({
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: CALLER_TOKEN } } }),
      },
    },
  }));
}

/** Fresh module, so the shared session and the idle timer both start empty. */
async function load() {
  const mod = await import("./useCoachAuth");
  return mod;
}

/** Fake timers that still advance, so `waitFor` can poll while the clock is controlled. */
function useAdvancingFakeTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
}

/** The happy path: a function that issues a session. */
const OK: FakeReply = {
  status: 200,
  body: { token: COACH_TOKEN, coachId: "coach-1", expiresAt: "2026-10-05T16:00:00.000Z" },
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  installSupabaseAuth();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCoachAuth · unlocking", () => {
  it("stores the issued session and reports unlocked", async () => {
    installFetch(OK);
    const { useCoachAuth, getCoachToken } = await load();

    const { result } = renderHook(() => useCoachAuth());
    expect(result.current.isUnlocked).toBe(false);

    let ok = false;
    await act(async () => {
      ok = await result.current.unlock(PIN);
    });

    expect(ok).toBe(true);
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.requiresPinChange).toBe(false);
    // The token is reachable for the portal's own fetches, but only from memory.
    expect(getCoachToken()).toBe(COACH_TOKEN);
  });

  it("sends the PIN as a verify action, authenticated as the caller", async () => {
    const fetchMock = installFetch(OK);
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    expect(fetchMock.calls[0].url).toContain("/functions/v1/coach-auth");
    expect(fetchMock.lastBody()).toEqual({ action: "verify", pin: PIN });
    // The coach's *app* session, not the anon key: the function resolves the caller with
    // `auth.getUser`, which only accepts a user token.
    expect(fetchMock.authHeader()).toBe(`Bearer ${CALLER_TOKEN}`);
  });

  it("refuses an empty PIN without asking the function", async () => {
    // A blank field is a form state, not an attempt. Sending it would burn the coach's
    // server-side attempt budget on a mistake the database has to be told about.
    const fetchMock = installFetch(OK);
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    let ok = true;
    await act(async () => {
      ok = await result.current.unlock("   ");
    });

    expect(ok).toBe(false);
    expect(fetchMock.calls).toHaveLength(0);
    expect(result.current.isUnlocked).toBe(false);
  });

  it("trims the PIN rather than sending the whitespace", async () => {
    const fetchMock = installFetch(OK);
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(`  ${PIN}  `);
    });

    expect(fetchMock.lastBody()).toEqual({ action: "verify", pin: PIN });
  });
});

describe("useCoachAuth · nothing is persisted", () => {
  it("leaves no trace of the PIN or the token in any storage", async () => {
    const writes: string[] = [];
    // Wrapped rather than merely read: reading `localStorage` after the fact only
    // proves nothing was written *by the time we looked*, and `sessionStorage` and
    // `document.cookie` are separate stores that a check of one does not cover.
    const realLocal = window.localStorage;
    const realSession = window.sessionStorage;
    let cookieSentinel = "";

    const storage = {
      getItem: (key: string) => realLocal.getItem(key),
      setItem: (key: string, value: string) => {
        writes.push(`localStorage:${key}`);
        realLocal.setItem(key, value);
      },
      removeItem: (key: string) => {
        writes.push(`localStorage:${key}`);
        realLocal.removeItem(key);
      },
      clear: () => realLocal.clear(),
      key: (index: number) => realLocal.key(index),
      get length() {
        return realLocal.length;
      },
    } as Storage;

    Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
    Object.defineProperty(window, "sessionStorage", { value: storage, configurable: true });
    Object.defineProperty(document, "cookie", {
      get: () => cookieSentinel,
      set: (value: string) => {
        writes.push(`cookie:${value.split("=")[0]}`);
        cookieSentinel = value;
      },
      configurable: true,
    });

    installFetch(OK);
    const { useCoachAuth } = await load();
    const { result } = renderHook(() => useCoachAuth());

    await act(async () => {
      await result.current.unlock(PIN);
      await result.current.changePin(PIN, "9134");
    });

    expect(result.current.isUnlocked).toBe(true);
    expect(writes).toEqual([]);
    expect(realLocal.length).toBe(0);
    expect(realSession.length).toBe(0);

    Object.defineProperty(window, "localStorage", { value: realLocal, configurable: true });
    Object.defineProperty(window, "sessionStorage", { value: realSession, configurable: true });
  });
});

describe("useCoachAuth · the lockout is the server's", () => {
  it("reports a 429 as too many attempts with the instant the server gave", async () => {
    const lockedUntil = "2026-10-05T12:15:00.000Z";
    installFetch({ status: 429, body: { error: "too_many_attempts", lockedUntil } });
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    let ok = true;
    await act(async () => {
      ok = await result.current.unlock("0000");
    });

    expect(ok).toBe(false);
    expect(result.current.error?.code).toBe("TOO_MANY_ATTEMPTS");
    // Verbatim from the body. The client has no opinion about when a lockout ends -- it
    // is counting rows in a table it cannot read -- so inventing a value here would be
    // the client overruling a decision it was told about.
    expect(result.current.lockedUntil).toBe(lockedUntil);
    expect(result.current.isUnlocked).toBe(false);
  });

  it("falls back to Retry-After when the body carries no instant", async () => {
    useAdvancingFakeTimers();
    const at = new Date("2026-10-05T12:00:00.000Z");
    vi.setSystemTime(at);
    installFetch({ status: 429, body: { error: "too_many_attempts" }, headers: { "Retry-After": "900" } });
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock("0000");
    });

    // Bounded rather than exact: these fake timers advance with the wall clock, so the
    // request lands some milliseconds after `setSystemTime`. What is under test is that
    // the cooldown came from the header -- fifteen minutes -- not the exact millisecond it
    // happened to land on.
    const lockedAt = Date.parse(result.current.lockedUntil ?? "");
    expect(lockedAt - at.getTime()).toBeGreaterThanOrEqual(15 * 60_000);
    expect(lockedAt - at.getTime()).toBeLessThanOrEqual(15 * 60_000 + 5000);
  });

  it("leaves lockedUntil null when neither the body nor the header says", async () => {
    // A rendered `NaN` countdown is worse than no countdown: the coach needs to know they
    // are locked out, and "NaN minutos" tells them nothing.
    installFetch({ status: 429, body: {}, headers: { "Retry-After": "not-a-number" } });
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock("0000");
    });

    expect(result.current.error?.code).toBe("TOO_MANY_ATTEMPTS");
    expect(result.current.lockedUntil).toBeNull();
  });
});

describe("useCoachAuth · failures are not successes", () => {
  it("reports a wrong PIN without unlocking", async () => {
    installFetch({ status: 401, body: { error: "invalid_pin" } });
    const { useCoachAuth, getCoachToken } = await load();

    const { result } = renderHook(() => useCoachAuth());
    let ok = true;
    await act(async () => {
      ok = await result.current.unlock("1111");
    });

    expect(ok).toBe(false);
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.error?.code).toBe("INVALID_PIN");
    expect(getCoachToken()).toBeNull();
  });

  it("reports a 404 as a wrong PIN, because the function will not say why", async () => {
    // The function answers 404 for a signed-in user who owns no active `coaches` row --
    // an athlete who typed a PIN they do not have, or a retired coach. It refuses to
    // distinguish either case from a wrong PIN on purpose, so a client that let 404 fall
    // through to SERVICE_UNAVAILABLE would be inventing a distinction the server withheld
    // on purpose, and would tell a correct PIN that the service is broken.
    installFetch({ status: 404, body: { error: "not_found" } });
    const { useCoachAuth, getCoachToken } = await load();

    const { result } = renderHook(() => useCoachAuth());
    let ok = true;
    await act(async () => {
      ok = await result.current.unlock(PIN);
    });

    expect(ok).toBe(false);
    expect(result.current.error?.code).toBe("INVALID_PIN");
    expect(result.current.isUnlocked).toBe(false);
    // Not a lockout, so no countdown to render.
    expect(result.current.lockedUntil).toBeNull();
    expect(getCoachToken()).toBeNull();
  });

  it("reports an unreachable function as a network problem, not a wrong PIN", async () => {
    // The distinction that matters: telling a coach their PIN is wrong when the network
    // is down sends them to retype a PIN that was always right.
    installFetch(new TypeError("Failed to fetch"));
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    expect(result.current.error?.code).toBe("NETWORK_ERROR");
  });

  it("reports a 500 as a service problem", async () => {
    installFetch({ status: 500, body: { error: "boom" } });
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    expect(result.current.error?.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("does not unlock on a 200 that carries no token", async () => {
    // A 200 with an unexpected body is a proxy or a redeploy, not a session. Opening the
    // portal on it would show an empty, broken portal rather than an error.
    installFetch({ status: 200, body: { ok: true } });
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    let ok = true;
    await act(async () => {
      ok = await result.current.unlock(PIN);
    });

    expect(ok).toBe(false);
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.error?.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("survives a body that is not JSON at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })),
    );
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    // Classified, not thrown: a gateway's HTML must not become a SyntaxError on the code
    // path whose only job is to classify.
    expect(result.current.error?.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("clears the error once a later attempt succeeds", async () => {
    const fetchMock = installFetch({ status: 401, body: { error: "invalid_pin" } });
    const { useCoachAuth } = await load();
    const { result } = renderHook(() => useCoachAuth());

    await act(async () => {
      await result.current.unlock("1111");
    });
    expect(result.current.error).not.toBeNull();

    fetchMock.setReply(OK);
    await act(async () => {
      await result.current.unlock(PIN);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isUnlocked).toBe(true);
  });
});

describe("useCoachAuth · the provisional PIN", () => {
  it("asks for a change rather than opening the portal", async () => {
    // A coach on a seeded PIN has not chosen their own credential yet, so this is
    // neither a failure nor a success. Rendering it as a failure would tell them the PIN
    // they were given is wrong; rendering it as success opens the portal behind a PIN the
    // coach did not choose.
    installFetch({ status: 200, body: { requiresPinChange: true } });
    const { useCoachAuth, getCoachToken } = await load();

    const { result } = renderHook(() => useCoachAuth());
    let ok = true;
    await act(async () => {
      ok = await result.current.unlock(PIN);
    });

    expect(ok).toBe(false);
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.requiresPinChange).toBe(true);
    expect(result.current.error).toBeNull();
    expect(getCoachToken()).toBeNull();
  });

  it("keeps asking after a mistyped PIN", async () => {
    // The last thing the function said about this coach was that they are on a seeded
    // PIN. A typo does not make that untrue, and clearing the flag would replace the
    // change form with the verify form -- asking for a PIN they have already given wrong.
    const fetchMock = installFetch({ status: 200, body: { requiresPinChange: true } });
    const { useCoachAuth } = await load();
    const { result } = renderHook(() => useCoachAuth());

    await act(async () => {
      await result.current.unlock(PIN);
    });
    expect(result.current.requiresPinChange).toBe(true);

    fetchMock.setReply({ status: 401, body: { error: "invalid_pin" } });
    await act(async () => {
      await result.current.unlock("0000");
    });

    expect(result.current.requiresPinChange).toBe(true);
    expect(result.current.error?.code).toBe("INVALID_PIN");
  });

  it("clears the flag once the change succeeds, and unlocks in the same call", async () => {
    const fetchMock = installFetch({ status: 200, body: { requiresPinChange: true } });
    const { useCoachAuth } = await load();
    const { result } = renderHook(() => useCoachAuth());

    await act(async () => {
      await result.current.unlock(PIN);
    });

    fetchMock.setReply(OK);
    let ok = false;
    await act(async () => {
      ok = await result.current.changePin(PIN, "9134");
    });

    // The coach just proved who they are; bouncing them back to the PIN form would be
    // asking for the thing they have only just changed.
    expect(ok).toBe(true);
    expect(result.current.requiresPinChange).toBe(false);
    expect(result.current.isUnlocked).toBe(true);
  });

  it("sends both PINs as a change action, and never the new one as the current", async () => {
    const fetchMock = installFetch({ status: 200, body: { requiresPinChange: true } });
    const { useCoachAuth } = await load();
    const { result } = renderHook(() => useCoachAuth());

    await act(async () => {
      await result.current.unlock(PIN);
    });
    await act(async () => {
      await result.current.changePin(PIN, "9134");
    });

    expect(fetchMock.lastBody()).toEqual({ action: "change", pin: PIN, newPin: "9134" });
  });

  it("distinguishes a refused change from a wrong current PIN", async () => {
    // Two different instructions to the person typing. Lumping them together is how
    // somebody ends up retrying the wrong one of the two fields.
    installFetch({ status: 400, body: { error: "pin_too_short" } });
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    let ok = true;
    await act(async () => {
      ok = await result.current.changePin(PIN, "12");
    });

    expect(ok).toBe(false);
    expect(result.current.error?.code).toBe("PIN_CHANGE_REJECTED");
    expect(result.current.isUnlocked).toBe(false);
  });
});

describe("useCoachAuth · the idle timeout", () => {
  it("locks after thirty minutes of nothing", async () => {
    useAdvancingFakeTimers();
    installFetch(OK);
    const { useCoachAuth, getCoachToken } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });
    expect(result.current.isUnlocked).toBe(true);

    // A minute before the deadline: still open. The boundary is asserted from both sides
    // because a timer that fires early locks a coach mid-conversation, which is the more
    // annoying of the two possible mistakes and the easier one to make.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29 * 60_000);
    });
    expect(result.current.isUnlocked).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000);
    });
    expect(result.current.isUnlocked).toBe(false);
    expect(getCoachToken()).toBeNull();
  });

  it("restarts the countdown on every touch", async () => {
    useAdvancingFakeTimers();
    installFetch(OK);
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    // Activity every twenty minutes for an hour: a fixed schedule from the unlock would
    // have locked this coach at minute thirty while they were still working.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20 * 60_000);
      });
      expect(result.current.isUnlocked).toBe(true);
      act(() => {
        result.current.touch();
      });
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31 * 60_000);
    });
    expect(result.current.isUnlocked).toBe(false);
  });

  it("ignores a touch while locked, so it cannot arm a timer with nothing to protect", async () => {
    useAdvancingFakeTimers();
    installFetch({ status: 401, body: { error: "invalid_pin" } });
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock("0000");
    });
    act(() => {
      result.current.touch();
    });

    expect(result.current.isUnlocked).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60_000);
    });
    // Still locked, and still reporting the same refusal rather than a second, timer-
    // induced failure on top of it.
    expect(result.current.error?.code).toBe("INVALID_PIN");
  });
});

describe("useCoachAuth · lock()", () => {
  it("clears the session and the token", async () => {
    installFetch(OK);
    const { useCoachAuth, getCoachToken } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    act(() => {
      result.current.lock();
    });

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.error).toBeNull();
    expect(getCoachToken()).toBeNull();
  });

  it("cancels the idle timer, so a locked coach cannot be locked again", async () => {
    useAdvancingFakeTimers();
    installFetch(OK);
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    act(() => {
      result.current.lock();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60_000);
    });

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps the provisional flag, which is a fact about the account", async () => {
    installFetch({ status: 200, body: { requiresPinChange: true } });
    const { useCoachAuth } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });
    expect(result.current.requiresPinChange).toBe(true);

    act(() => {
      result.current.lock();
    });

    // Clearing it would show a coach who has already changed their PIN the form for
    // changing one.
    expect(result.current.requiresPinChange).toBe(true);
  });
});

describe("useCoachAuth · the session is shared, not per-component", () => {
  it("reaches every mounted gate, so the timer locks all of them", async () => {
    useAdvancingFakeTimers();
    installFetch(OK);
    const { useCoachAuth } = await load();

    // Two gates, as a portal with a header lock button and a form would have.
    const header = renderHook(() => useCoachAuth());
    const body = renderHook(() => useCoachAuth());

    await act(async () => {
      await header.result.current.unlock(PIN);
    });
    await waitFor(() => expect(body.result.current.isUnlocked).toBe(true));

    // The idle timer fires with no user interaction at all. If the state lived in one
    // component's `useState`, this second hook would still believe it was unlocked and
    // the portal behind it would be.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31 * 60_000);
    });

    await waitFor(() => expect(header.result.current.isUnlocked).toBe(false));
    await waitFor(() => expect(body.result.current.isUnlocked).toBe(false));
  });

  it("lets one gate lock a session another one opened", async () => {
    installFetch(OK);
    const { useCoachAuth } = await load();

    const opener = renderHook(() => useCoachAuth());
    const reader = renderHook(() => useCoachAuth());

    await act(async () => {
      await opener.result.current.unlock(PIN);
    });
    await waitFor(() => expect(reader.result.current.isUnlocked).toBe(true));

    act(() => {
      opener.result.current.lock();
    });

    await waitFor(() => expect(reader.result.current.isUnlocked).toBe(false));
  });

  it("reports no session at all before anything is unlocked", async () => {
    const { useCoachAuth, getCoachToken } = await load();

    const { result } = renderHook(() => useCoachAuth());

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lockedUntil).toBeNull();
    expect(getCoachToken()).toBeNull();
  });

  it("exposes loading only while this component's own request is in flight", async () => {
    // `isLoading` is deliberately local. Shared, an unmount mid-unlock would leave the
    // next gate reporting a spinner that never resolves.
    installFetch(OK);
    const { useCoachAuth } = await load();

    const first = renderHook(() => useCoachAuth());
    await act(async () => {
      await first.result.current.unlock(PIN);
    });
    first.unmount();

    const second = renderHook(() => useCoachAuth());

    expect(second.result.current.isLoading).toBe(false);
// And the session survives the remount, which is the whole point of module scope:
    // navigating away from the portal must not lock a coach out of it.
    expect(second.result.current.isUnlocked).toBe(true);
  });
});

/**
 * `getCoachId()` -- the `coaches.id` of the held session.
 *
 * Exists because `routines.authored_by_coach` has to be written by the coach's own id,
 * and that column is not decoration: the DELETE policy on `routines` matches it against
 * the calling coach's row and nothing else, so a routine written with a null author is a
 * routine its own author cannot retract -- the exact leak of an empty routine into an
 * athlete's library that `VipRoutineBuilder`'s compensating delete exists to close.
 *
 * The empty-string case is the one worth a test. The function stores `coachId` as `""`
 * when the payload omits it, and `""` is not null: written straight into a uuid column it
 * is a value the database refuses, and quietly defaulted it would produce a row that
 * looks authored and is not.
 */
describe("useCoachAuth · getCoachId", () => {
  it("reports no id before anything is unlocked", async () => {
    const { getCoachId } = await load();

    expect(getCoachId()).toBeNull();
  });

  it("returns the id the function issued", async () => {
    installFetch(OK);
    const { useCoachAuth, getCoachId } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    expect(getCoachId()).toBe("coach-1");
  });

  it("returns null once the session is dropped", async () => {
    installFetch(OK);
    const { useCoachAuth, getCoachId } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });
    expect(getCoachId()).toBe("coach-1");

    act(() => {
      result.current.lock();
    });

    expect(getCoachId()).toBeNull();
  });

  it("reports null, not an empty string, when the function omits the id", async () => {
    installFetch({
      status: 200,
      body: { token: COACH_TOKEN, expiresAt: null },
    });
    const { useCoachAuth, getCoachId } = await load();

    const { result } = renderHook(() => useCoachAuth());
    await act(async () => {
      await result.current.unlock(PIN);
    });

    // The token issued, so this is a usable session -- but there is no id to write into
    // `authored_by_coach`, and the caller has to be able to tell that apart from a
    // session that has neither.
    expect(getCoachId()).toBeNull();
  });
});
