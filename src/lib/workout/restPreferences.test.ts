/**
 * @vitest-environment jsdom
 *
 * restPreferences.test.ts — the athlete's own rest overrides.
 *
 * The claims worth protecting are about *honesty under decay*: a
 * corrupted entry must not take the healthy ones down with it, a
 * value outside the range the timer enforces must not be clamped
 * into a real rest, and a full store must not interrupt the athlete
 * mid-session.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FALLBACK_REST_SECONDS,
  REST_FLOOR_SECONDS,
  REST_MAX_SECONDS,
  REST_PREFERENCES_KEY,
  loadRestSeconds,
  saveRestSeconds,
} from "./restPreferences";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadRestSeconds", () => {
  it("returns the routine's rest before any preference exists", () => {
    expect(loadRestSeconds("sentadilla", FALLBACK_REST_SECONDS)).toBe(
      FALLBACK_REST_SECONDS,
    );
  });

  it("returns the routine's rest for an exercise with no override", () => {
    saveRestSeconds("sentadilla", 120);
    expect(loadRestSeconds("prensa", FALLBACK_REST_SECONDS)).toBe(
      FALLBACK_REST_SECONDS,
    );
  });

  it("round-trips a saved preference", () => {
    saveRestSeconds("sentadilla", 120);
    expect(loadRestSeconds("sentadilla", FALLBACK_REST_SECONDS)).toBe(120);
  });

  it("treats a saved value outside the timer's range as absent", () => {
    // A number that far off is a bug's residue, not a wish: clamping
    // it would keep the bug's effect around as a real rest.
    window.localStorage.setItem(
      REST_PREFERENCES_KEY,
      JSON.stringify({ sentadilla: 99999 }),
    );
    expect(loadRestSeconds("sentadilla", FALLBACK_REST_SECONDS)).toBe(
      FALLBACK_REST_SECONDS,
    );
  });

  it("keeps the healthy entries when one is corrupted", () => {
    // One corrupted entry is not a reason to forget every other
    // exercise's preference.
    window.localStorage.setItem(
      REST_PREFERENCES_KEY,
      JSON.stringify({ sentadilla: 120, prensa: "mucho" }),
    );
    expect(loadRestSeconds("sentadilla", FALLBACK_REST_SECONDS)).toBe(120);
    expect(loadRestSeconds("prensa", FALLBACK_REST_SECONDS)).toBe(
      FALLBACK_REST_SECONDS,
    );
  });

  it("reads no preferences from a store that is not an object", () => {
    window.localStorage.setItem(REST_PREFERENCES_KEY, "42");
    expect(loadRestSeconds("sentadilla", FALLBACK_REST_SECONDS)).toBe(
      FALLBACK_REST_SECONDS,
    );
  });

  it("falls back quietly when storage is unavailable", () => {
    // Private mode and friends: the routine's rest is the honest
    // default, and the athlete should never notice the difference.
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(loadRestSeconds("sentadilla", FALLBACK_REST_SECONDS)).toBe(
      FALLBACK_REST_SECONDS,
    );
  });
});

describe("saveRestSeconds", () => {
  it("clamps what it saves into the range the timer allows", () => {
    saveRestSeconds("sentadilla", 5);
    expect(loadRestSeconds("sentadilla", FALLBACK_REST_SECONDS)).toBe(
      REST_FLOOR_SECONDS,
    );

    saveRestSeconds("prensa", 9999);
    expect(loadRestSeconds("prensa", FALLBACK_REST_SECONDS)).toBe(
      REST_MAX_SECONDS,
    );
  });

  it("does not throw when storage is full", () => {
    // Best-effort by design: a failed write must not interrupt the
    // athlete mid-session.
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => saveRestSeconds("sentadilla", 120)).not.toThrow();
  });

  it("leaves other exercises' preferences alone", () => {
    saveRestSeconds("sentadilla", 120);
    saveRestSeconds("prensa", 150);
    expect(loadRestSeconds("sentadilla", FALLBACK_REST_SECONDS)).toBe(120);
    expect(loadRestSeconds("prensa", FALLBACK_REST_SECONDS)).toBe(150);
  });
});
