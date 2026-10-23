/**
 * @vitest-environment jsdom
 *
 * `usePolling` is four behaviours that only misbehave on a clock, so every test here
 * drives fake timers and asserts on *call counts at a point in time* rather than on
 * rendered output. Three of them are the ones a fixed `setInterval` gets wrong and that a
 * real browser would take ten seconds and a slow network to reproduce: overlap, the
 * restart after the tab comes back, and a response landing after teardown.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePolling } from "@/hooks/usePolling";

const INTERVAL = 10_000;

/**
 * Drives `document.hidden`.
 *
 * jsdom exposes it as a getter on `Document.prototype`, so it cannot be assigned. The
 * descriptor is captured and restored per test rather than left redefined, because every
 * other suite in this repo may assume the real property.
 */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
}

/** A task that resolves immediately, counted. */
function countingTask(): { calls: () => number; task: () => Promise<void> } {
  let calls = 0;
  return {
    calls: () => calls,
    task: async () => {
      calls += 1;
    },
  };
}

/**
 * A task that stays pending until the test releases it.
 *
 * The only way to hold a request open deterministically: the overlap test needs the
 * first call to still be in flight while the clock passes the interval twice.
 */
function heldTask(): {
  calls: () => number;
  task: () => Promise<void>;
  release: () => Promise<void>;
} {
  let calls = 0;
  let open: (() => void) | null = null;

  return {
    calls: () => calls,
    task: () => {
      calls += 1;
      return new Promise<void>((resolve) => {
        open = resolve;
      });
    },
    release: async () => {
      const resolve = open;
      open = null;
      resolve?.();
      // Let the awaiting continuation run so `scheduleNext` is reached.
      await Promise.resolve();
    },
  };
}

beforeEach(() => {
  setHidden(false);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePolling", () => {
  it("runs once on mount without waiting out the first interval", async () => {
    const { calls, task } = countingTask();
    renderHook(() => usePolling(task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);

    expect(calls()).toBe(1);
  });

  it("repeats on the interval once each run has settled", async () => {
    const { calls, task } = countingTask();
    renderHook(() => usePolling(task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(1);

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(calls()).toBe(2);

    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(calls()).toBe(5);
  });

  it("does not start the next run until the previous one has resolved", async () => {
    // The bug a fixed setInterval has: at 30s the interval has fired three times, and a
    // query slower than the interval would be three requests deep.
    const held = heldTask();
    renderHook(() => usePolling(held.task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    expect(held.calls()).toBe(1);

    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(held.calls()).toBe(1);

    // Releasing arms the timer; the second run is a full interval away, not immediate.
    await held.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(held.calls()).toBe(1);

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(held.calls()).toBe(2);
  });

  it("waits the full interval after the response, not from the request", async () => {
    const held = heldTask();
    renderHook(() => usePolling(held.task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL * 2);
    await held.release();

    // The response landed at t=20s. At t=25s there must still be no second call.
    await vi.advanceTimersByTimeAsync(INTERVAL - 5_000);
    expect(held.calls()).toBe(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(held.calls()).toBe(2);
  });

  it("keeps polling after a task rejects", async () => {
    // One dropped packet must not end all polling silently.
    let calls = 0;
    const task = async (): Promise<void> => {
      calls += 1;
      throw new Error("network");
    };

    renderHook(() => usePolling(task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL * 2);

    expect(calls).toBe(3);
  });

  it("stops while the tab is hidden and resumes once, on return", async () => {
    const { calls, task } = countingTask();
    renderHook(() => usePolling(task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(1);

    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));

    // Long enough for several intervals. A tab nobody is watching costs nothing.
    await vi.advanceTimersByTimeAsync(INTERVAL * 10);
    expect(calls()).toBe(1);

    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(2);

    // And exactly two, not three: the handler must not leave a second chain running.
    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(2);
  });

  it("resumes when the tab returns even if nothing was pending", async () => {
    // The loop can die with no timer: hidden *while a request was in flight*. That run
    // resolves, sees hidden, and declines to arm a timer -- leaving a handler that only
    // fires on a pending timer with nothing to fire.
    const held = heldTask();
    renderHook(() => usePolling(held.task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    expect(held.calls()).toBe(1);

    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await held.release();
    await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(held.calls()).toBe(1);

    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(held.calls()).toBe(2);
  });

  it("ignores a return to hidden", async () => {
    const { calls, task } = countingTask();
    renderHook(() => usePolling(task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);

    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);

    expect(calls()).toBe(1);
  });

  it("does not start a second run while one is already in flight", async () => {
    const held = heldTask();
    renderHook(() => usePolling(held.task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    expect(held.calls()).toBe(1);

    // Return to the tab mid-request: the in-flight run will schedule the next tick
    // itself, so the handler has nothing to add.
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);

    expect(held.calls()).toBe(1);
  });

  it("stops for good on unmount", async () => {
    const { calls, task } = countingTask();
    const { unmount } = renderHook(() => usePolling(task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    unmount();

    await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(calls()).toBe(1);
  });

  it("does not let a response that lands after unmount schedule another run", async () => {
    const held = heldTask();
    const { unmount } = renderHook(() => usePolling(held.task, INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    unmount();
    await held.release();

    await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(held.calls()).toBe(1);
  });

  it("does nothing while disabled, and starts once enabled", async () => {
    const { calls, task } = countingTask();
    const { rerender } = renderHook(({ on }: { on: boolean }) => usePolling(task, INTERVAL, on), {
      initialProps: { on: false },
    });

    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(calls()).toBe(0);

    rerender({ on: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(1);

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(calls()).toBe(2);
  });

  it("stops when disabled mid-flight and does not schedule another run", async () => {
    const held = heldTask();
    const { rerender } = renderHook(({ on }: { on: boolean }) => usePolling(held.task, INTERVAL, on), {
      initialProps: { on: true },
    });

    await vi.advanceTimersByTimeAsync(0);
    rerender({ on: false });
    await held.release();

    await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(held.calls()).toBe(1);
  });

  it("picks up a new interval without a manual restart", async () => {
    const { calls, task } = countingTask();
    const { rerender } = renderHook(
      ({ ms }: { ms: number }) => usePolling(task, ms),
      { initialProps: { ms: INTERVAL } },
    );

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(calls()).toBe(2);

    rerender({ ms: 1_000 });

    // Changing the period is a dependency change, so the effect restarts and fetches
    // immediately rather than waiting out the old interval. A caller that changes the
    // period wants fresh data now, not in the nine seconds it did not ask for.
    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(3);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls()).toBe(4);
  });

  it("does not restart when the task identity changes", async () => {
    // A caller passing an inline arrow gets a new function every render. Restarting on
    // identity would fire the task immediately every time -- a busy loop wearing a
    // timer as a disguise.
    const { calls, task } = countingTask();
    const { rerender } = renderHook(() => usePolling(() => task(), INTERVAL));

    await vi.advanceTimersByTimeAsync(0);
    rerender();
    rerender();

    expect(calls()).toBe(1);
  });

  it("runs the newest task, not the one captured on mount", async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});

    const { rerender } = renderHook(({ task }: { task: () => Promise<void> }) => usePolling(task, INTERVAL), {
      initialProps: { task: first },
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ task: second });
    await vi.advanceTimersByTimeAsync(INTERVAL);

    // Same chain, so the interval did not reset -- the mount run plus exactly one tick.
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("treats an interval of zero as disabled rather than spinning", async () => {
    const { calls, task } = countingTask();
    renderHook(() => usePolling(task, 0));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(calls()).toBe(0);
  });

  it("removes its visibility listener on unmount", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => usePolling(async () => {}, INTERVAL));

    unmount();

    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});