/**
 * @vitest-environment jsdom
 *
 * audio.test.ts — the lazy AudioContext singleton.
 *
 * The singleton must not be created at import time and must be reused across calls,
 * because constructing an AudioContext has a cost that should only be paid once
 * per page lifetime (and the user-gesture tax applies to every construction).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { playBeep, resetAudioContext } from "@/lib/audio";

class MockOscillator {
  type = "sine";
  frequency = { setValueAtTime: vi.fn() };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGain {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

class MockAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn();
  createGain = vi.fn(() => new MockGain());
  createOscillator = vi.fn(() => new MockOscillator());
}

describe("audio singleton", () => {
  const originalAudioContext = globalThis.AudioContext;

  afterEach(() => {
    vi.restoreAllMocks();
    resetAudioContext();
    if (originalAudioContext) {
      globalThis.AudioContext = originalAudioContext;
    } else {
      delete (globalThis as { AudioContext?: unknown }).AudioContext;
    }
  });

  it("returns false when AudioContext is not available", () => {
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
    expect(playBeep()).toBe(false);
  });

  it("creates the context lazily on first call, not at import", () => {
    const ctx = new MockAudioContext();
    const ctor = vi.fn(() => ctx);
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = ctor;

    expect(ctor).not.toHaveBeenCalled();

    const result = playBeep();

    expect(ctor).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it("reuses the same context across multiple calls", () => {
    const ctx = new MockAudioContext();
    const ctor = vi.fn(() => ctx);
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = ctor;

    playBeep();
    playBeep();
    playBeep();

    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it("schedules an oscillator with a gain envelope on each call", () => {
    const ctx = new MockAudioContext();
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = vi.fn(() => ctx);

    playBeep();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createGain).toHaveBeenCalledTimes(1);
  });

  it("resumes a suspended context", () => {
    const ctx = new MockAudioContext();
    ctx.state = "suspended";
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = vi.fn(() => ctx);

    playBeep();

    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("does not resume a running context", () => {
    const ctx = new MockAudioContext();
    ctx.state = "running";
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = vi.fn(() => ctx);

    playBeep();

    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it("returns true when the oscillator is scheduled successfully", () => {
    const ctx = new MockAudioContext();
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = vi.fn(() => ctx);

    expect(playBeep()).toBe(true);
  });

  it("returns false if scheduling throws", () => {
    const ctx = new MockAudioContext();
    ctx.createOscillator.mockImplementationOnce(() => {
      throw new Error("Web Audio not supported");
    });
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = vi.fn(() => ctx);

    expect(playBeep()).toBe(false);
  });

  it("resetAudioContext drops the cached singleton", () => {
    const ctx = new MockAudioContext();
    const ctor = vi.fn(() => ctx);
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = ctor;

    playBeep();
    expect(ctor).toHaveBeenCalledTimes(1);

    resetAudioContext();
    playBeep();
    expect(ctor).toHaveBeenCalledTimes(2);
  });
});
