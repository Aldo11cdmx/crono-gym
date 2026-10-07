/**
 * @vitest-environment jsdom
 *
 * userTips.test.ts — the per-exercise tip list's storage contract.
 *
 * localStorage is a convenience, not a promise: a malformed value, a
 * foreign shape or an unavailable store all have to read as "no tips
 * yet" rather than throwing, because the official tips above the
 * athlete's own still work when their list breaks.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadUserTips,
  normaliseUserTip,
  saveUserTips,
  USER_TIPS_MAX,
  USER_TIPS_PREFIX,
  USER_TIP_MAX_LENGTH,
} from "./userTips";

const KEY = USER_TIPS_PREFIX + "squat";

beforeEach(() => {
  window.localStorage.clear();
});

describe("loadUserTips", () => {
  it("returns an empty list when nothing is saved", () => {
    expect(loadUserTips("squat")).toEqual([]);
  });

  it("round-trips what saveUserTips wrote, oldest first", () => {
    saveUserTips("squat", ["grip is wide", "brace hard"]);
    expect(loadUserTips("squat")).toEqual(["grip is wide", "brace hard"]);
  });

  it("is namespaced per exercise", () => {
    saveUserTips("squat", ["squat tip"]);
    saveUserTips("deadlift", ["deadlift tip"]);

    expect(loadUserTips("squat")).toEqual(["squat tip"]);
    expect(loadUserTips("deadlift")).toEqual(["deadlift tip"]);
  });

  it("reads corrupt JSON as no tips rather than throwing", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadUserTips("squat")).toEqual([]);
  });

  it("reads a foreign shape as no tips", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ tips: ["a"] }));
    expect(loadUserTips("squat")).toEqual([]);
  });

  it("drops non-string entries and blanks, keeping the list honest", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(["real", 42, null, "   ", "also real"]),
    );
    expect(loadUserTips("squat")).toEqual(["real", "also real"]);
  });

  it("caps the list at the documented maximum", () => {
    const many = Array.from({ length: USER_TIPS_MAX + 10 }, (_, i) => `t${i}`);
    window.localStorage.setItem(KEY, JSON.stringify(many));
    expect(loadUserTips("squat")).toHaveLength(USER_TIPS_MAX);
  });
});

describe("saveUserTips", () => {
  it("persists under the namespaced key", () => {
    saveUserTips("squat", ["tip"]);
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(["tip"]));
  });

  it("caps what it writes, so storage cannot grow unbounded", () => {
    const many = Array.from({ length: USER_TIPS_MAX + 5 }, (_, i) => `t${i}`);
    saveUserTips("squat", many);
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "[]")).toHaveLength(
      USER_TIPS_MAX,
    );
  });

  it("survives an unavailable store silently", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => saveUserTips("squat", ["tip"])).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("normaliseUserTip", () => {
  it("trims and collapses empty input to null", () => {
    expect(normaliseUserTip("  brace hard  ")).toBe("brace hard");
    expect(normaliseUserTip("   ")).toBeNull();
    expect(normaliseUserTip("")).toBeNull();
  });

  it("clamps to the documented length", () => {
    const long = "a".repeat(USER_TIP_MAX_LENGTH + 1);
    expect(normaliseUserTip(long)).toHaveLength(USER_TIP_MAX_LENGTH);
  });
});
