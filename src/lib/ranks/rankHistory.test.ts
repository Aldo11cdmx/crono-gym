import { describe, expect, it } from "vitest";
import { isoDay, rankHistoryId } from "./rankHistory";

/**
 * These are the pure parts of the history store. The IndexedDB paths are not
 * covered here: jsdom has no IndexedDB, and adding `fake-indexeddb` would test the
 * library's behaviour rather than this module's. What matters here is that the
 * keys and dates are stable, because those are what make re-recording idempotent.
 */

describe("isoDay", () => {
  it("formats as YYYY-MM-DD in UTC", () => {
    expect(isoDay(new Date("2026-06-01T12:00:00.000Z"))).toBe("2026-06-01");
  });

  it("does not shift across the local timezone", () => {
    // A date late in the UTC day would roll over if the formatter used local
    // time on a machine behind UTC, putting a rank change on the wrong day.
    expect(isoDay(new Date("2026-06-01T23:30:00.000Z"))).toBe("2026-06-01");
    expect(isoDay(new Date("2026-06-01T00:30:00.000Z"))).toBe("2026-06-01");
  });

  it("accepts no argument and defaults to now", () => {
    expect(isoDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("rankHistoryId", () => {
  it("is stable for the same triple", () => {
    expect(rankHistoryId("chest", "gold", "2026-06-01")).toBe("chest|gold|2026-06-01");
  });

  it("differs when the muscle differs", () => {
    expect(rankHistoryId("chest", "gold", "2026-06-01")).not.toBe(
      rankHistoryId("gluteal", "gold", "2026-06-01"),
    );
  });

  it("differs when the rank differs", () => {
    expect(rankHistoryId("chest", "gold", "2026-06-01")).not.toBe(
      rankHistoryId("chest", "platinum", "2026-06-01"),
    );
  });

  it("differs when the day differs", () => {
    expect(rankHistoryId("chest", "gold", "2026-06-01")).not.toBe(
      rankHistoryId("chest", "gold", "2026-06-02"),
    );
  });

  it("cannot collide across muscles that share a rank and day", () => {
    // The separator makes the three components unambiguous: without it,
    // "upper-back" + "gold" and "upper" + "back|gold" would encode identically.
    const ids = new Set([
      rankHistoryId("upper-back", "gold", "2026-06-01"),
      rankHistoryId("upper", "back", "2026-06-01"),
      rankHistoryId("chest", "silver", "2026-06-01"),
    ]);
    expect(ids.size).toBe(3);
  });
});