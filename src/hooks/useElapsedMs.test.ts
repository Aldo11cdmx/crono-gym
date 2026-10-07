/**
 * @vitest-environment jsdom
 *
 * useElapsedMs is the single source of truth for the session clock. These tests
 * lock down the two invariants that the rest of the hub depends on:
 *
 * 1. Elapsed time is derived from `startedAt`, not accumulated — so there is no
 *    counter stored in component state to get out of sync.
 * 2. Exactly one `setInterval` is created, cleaned up on unmount and on
 *    `startedAt` change — no duplicate timers, no leaks.
 *
 * The format function is tested too because every component that shows a clock
 * must produce the identical string.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { formatElapsed, useElapsedMs } from "./useElapsedMs";

describe("formatElapsed", () => {
  it("formats seconds and minutes", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(1000)).toBe("00:01");
    expect(formatElapsed(65_000)).toBe("01:05");
    expect(formatElapsed(59_999)).toBe("00:59");
  });

  it("floors rather than rounds", () => {
    expect(formatElapsed(1500)).toBe("00:01");
    expect(formatElapsed(9900)).toBe("00:09");
  });

  it("does not cap minutes — long sessions go past 59", () => {
    expect(formatElapsed(3 * 60 * 1000)).toBe("03:00");
    expect(formatElapsed(125 * 60 * 1000)).toBe("125:00");
  });

  it("negative input is clamped to zero", () => {
    expect(formatElapsed(-1000)).toBe("00:00");
  });

  it("pads single-digit components", () => {
    expect(formatElapsed(9 * 1000)).toBe("00:09");
    expect(formatElapsed(9 * 60 * 1000 + 9 * 1000)).toBe("09:09");
  });
});

describe("useElapsedMs", () => {
  const BASE = new Date("2026-01-01T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 when there is no session", () => {
    const { result } = renderHook(() => useElapsedMs(null));
    expect(result.current).toBe(0);
  });

  it("returns 0 for an undefined timestamp", () => {
    const { result } = renderHook(() => useElapsedMs(undefined));
    expect(result.current).toBe(0);
  });

  it("returns 0 for an unparseable timestamp", () => {
    const { result } = renderHook(() => useElapsedMs("not-a-date"));
    expect(result.current).toBe(0);
  });

  it("derives elapsed from startedAt rather than accumulating", () => {
    const startedAt = new Date(BASE - 30_000).toISOString();
    const { result } = renderHook(() => useElapsedMs(startedAt));
    expect(result.current).toBe(30_000);
  });

  it("ticks once per second", () => {
    const startedAt = new Date(BASE - 30_000).toISOString();
    const { result } = renderHook(() => useElapsedMs(startedAt));
    expect(result.current).toBe(30_000);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(31_000);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(32_000);
  });

  it("never creates an interval when startedAt is null", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    renderHook(() => useElapsedMs(null));
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("creates exactly one interval when startedAt is present", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const startedAt = new Date(BASE - 60_000).toISOString();
    renderHook(() => useElapsedMs(startedAt));
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it("clears the interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const startedAt = new Date(BASE - 60_000).toISOString();
    const { unmount } = renderHook(() => useElapsedMs(startedAt));
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledWith(expect.any(Object));
  });

  it("clears and resets the interval when startedAt changes", () => {
    const first = new Date(BASE - 60_000).toISOString();
    const second = new Date(BASE - 120_000).toISOString();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const { rerender } = renderHook(
      ({ ts }: { ts: string | null }) => useElapsedMs(ts),
      { initialProps: { ts: first } },
    );
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    rerender({ ts: second });
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
  });

  it("goes back to 0 when startedAt is cleared", () => {
    const startedAt = new Date(BASE - 60_000).toISOString();
    const { result, rerender } = renderHook(
      ({ ts }: { ts: string | null }) => useElapsedMs(ts),
      { initialProps: { ts: startedAt } as { ts: string | null } },
    );
    expect(result.current).toBe(60_000);

    rerender({ ts: null });
    expect(result.current).toBe(0);
  });
});
