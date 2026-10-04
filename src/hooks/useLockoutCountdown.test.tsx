/**
 * @vitest-environment jsdom
 *
 * The countdown is the only moving thing on a form that is otherwise frozen, so the tests
 * are about time: that it ticks, that it releases the form when it reaches zero, and that it
 * does not lie about being locked when there is no lockout.
 *
 * Faked timers throughout. With real ones a test either sleeps for a second per assertion or
 * asserts nothing, and a countdown tested by waiting is a countdown that stops being tested
 * the first time someone raises the interval.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useLockoutCountdown } from "./useLockoutCountdown";

const NOW = new Date("2026-10-03T12:00:00.000Z").getTime();

/** An instant `minutes` from the frozen "now". */
const inMinutes = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLockoutCountdown", () => {
  it("no dice nada sin bloqueo", () => {
    const { result } = renderHook(() => useLockoutCountdown(null));
    expect(result.current).toBeNull();
  });

  it("devuelve los milisegundos que faltan", () => {
    const { result } = renderHook(() => useLockoutCountdown(inMinutes(15)));
    expect(result.current).toBe(15 * 60_000);
  });

  it("baja con el tiempo", () => {
    const { result } = renderHook(() => useLockoutCountdown(inMinutes(15)));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe(14 * 60_000);
  });

  it("se libera al llegar a cero, en vez de quedarse en cero para siempre", () => {
    const { result } = renderHook(() => useLockoutCountdown(inMinutes(1)));

    expect(result.current).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    /*
     * `null` and not `0`. A countdown that reaches 0 and stays there is a form that is
     * disabled for ever behind a notice that says "0 minutos", which tells the coach to try
     * again immediately and spend an attempt they do not have.
     */
    expect(result.current).toBeNull();
  });

  it("trata un instante ya pasado como bloqueo terminado", () => {
    const { result } = renderHook(() => useLockoutCountdown(inMinutes(-5)));
    expect(result.current).toBeNull();
  });

  it("trata un instante ilegible como bloqueo terminado, no como eternal", () => {
    // `lockedUntil` is our own function reading our own server response, so an unparseable
    // value is a serialisation bug -- not a fact about the lockout. Treating it as "still
    // locked" would brick the form with no way back but a reload.
    const { result } = renderHook(() => useLockoutCountdown("no es una fecha"));

    expect(result.current).toBeNull();
    // And it must not then start a ticker against NaN.
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(result.current).toBeNull();
  });

  it("reinicia cuando el servidor mueve el instante", () => {
    const { result, rerender } = renderHook(({ until }) => useLockoutCountdown(until), {
      initialProps: { until: inMinutes(1) },
    });

    // Only the timer advances: `setSystemTime` plus `advanceTimersByTime` would move the
    // clock twice and land exactly on the target, which is a different test.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(30_000);

    // A longer block reported afterwards replaces the old one rather than the old ticker
    // continuing to count the previous target down to zero. The new target is measured from
    // the clock as it now stands -- 30 s in -- not from where the old count had got to.
    rerender({ until: inMinutes(20) });

    expect(result.current).toBe(20 * 60_000 - 30_000);
  });

  it("deja de contar cuando el bloqueo desaparece", () => {
    const { result, rerender } = renderHook(({ until }) => useLockoutCountdown(until), {
      initialProps: { until: inMinutes(15) as string | null },
    });

    expect(result.current).not.toBeNull();

    rerender({ until: null });
    expect(result.current).toBeNull();

    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(result.current).toBeNull();
  });

  it("limpia el temporizador al desmontar", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderHook(() => useLockoutCountdown(inMinutes(15)));

    unmount();

    // A leaked interval would keep a whole component tree re-rendering every second for the
    // rest of the session, long after the lockout is over.
    expect(clearSpy).toHaveBeenCalled();
  });
});