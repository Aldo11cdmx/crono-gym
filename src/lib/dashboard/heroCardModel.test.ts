/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import {
  getGreeting,
  getElapsedMs,
  formatElapsed,
  getSessionProgress,
  buildHeroChips,
  getDailyFocus,
  getWeekdayIndex,
  WEEKDAY_NAME_ES,
} from "./heroCardModel";

describe("getGreeting", () => {
  it("returns a name-less greeting for morning hours", () => {
    // 2026-10-05T08:00:00 — a Monday at 8am local
    const now = Date.parse("2026-10-05T08:00:00");
    expect(getGreeting(now, null)).toBe("Buenos días");
    expect(getGreeting(now, undefined)).toBe("Buenos días");
  });

  it("appends a trimmed first name", () => {
    const now = Date.parse("2026-10-05T08:00:00");
    expect(getGreeting(now, "Ana")).toBe("Buenos días, Ana");
  });

  it("uses only the first name", () => {
    const now = Date.parse("2026-10-05T08:00:00");
    expect(getGreeting(now, "Ana María")).toBe("Buenos días, Ana");
  });

  it("returns afternoon greeting for midday", () => {
    const now = Date.parse("2026-10-05T14:00:00");
    expect(getGreeting(now, null)).toBe("Buenas tardes");
  });

  it("returns evening greeting after 6pm", () => {
    const now = Date.parse("2026-10-05T20:00:00");
    expect(getGreeting(now, null)).toBe("Buenas noches");
  });

  it("truncates long names to 20 characters", () => {
    const now = Date.parse("2026-10-05T08:00:00");
    const longName = "AlexandroSupercalifragilistic";
    const result = getGreeting(now, longName);
    expect(result).toBe(`Buenos días, ${longName.slice(0, 20)}`);
  });

  it("returns name-less greeting for empty name", () => {
    const now = Date.parse("2026-10-05T08:00:00");
    expect(getGreeting(now, "")).toBe("Buenos días");
    expect(getGreeting(now, "   ")).toBe("Buenos días");
  });
});

describe("getElapsedMs", () => {
  it("returns null for missing timestamp", () => {
    expect(getElapsedMs(null, Date.now())).toBeNull();
    expect(getElapsedMs(undefined, Date.now())).toBeNull();
  });

  it("returns null for invalid timestamp", () => {
    expect(getElapsedMs("not-a-date", Date.now())).toBeNull();
  });

  it("returns milliseconds since start", () => {
    const start = "2026-10-05T10:00:00.000Z";
    const now = Date.parse("2026-10-05T10:00:05.000Z");
    expect(getElapsedMs(start, now)).toBe(5000);
  });

  it("never returns negative", () => {
    const start = "2026-10-05T10:00:00.000Z";
    const now = Date.parse("2026-10-05T09:59:59.000Z"); // before start
    expect(getElapsedMs(start, now)).toBe(0);
  });
});

describe("formatElapsed", () => {
  it("formats mm:ss", () => {
    expect(formatElapsed(65000)).toBe("1:05");
  });

  it("formats h:mm:ss for long durations", () => {
    expect(formatElapsed(3_721_000)).toBe("1:02:01");
  });

  it("returns 0:00 for null or zero", () => {
    expect(formatElapsed(null)).toBe("0:00");
    expect(formatElapsed(0)).toBe("0:00");
  });

  it("returns 0:00 for negative", () => {
    expect(formatElapsed(-1000)).toBe("0:00");
  });
});

describe("getSessionProgress", () => {
  it("returns null when planned is unknown", () => {
    expect(getSessionProgress(3, null)).toBeNull();
    expect(getSessionProgress(3, undefined)).toBeNull();
  });

  it("returns null when planned is zero", () => {
    expect(getSessionProgress(3, 0)).toBeNull();
  });

  it("returns ratio clamped to [0, 1]", () => {
    expect(getSessionProgress(1, 4)).toBe(0.25);
    expect(getSessionProgress(4, 4)).toBe(1);
    expect(getSessionProgress(5, 4)).toBe(1);
  });
});

describe("buildHeroChips", () => {
  it("builds exercise count chip with pluralization", () => {
    const chips = buildHeroChips({ exerciseCount: 1, minutes: null });
    expect(chips).toEqual([{ label: "1 ejercicio" }]);
  });

  it("builds exercise count chip plural", () => {
    const chips = buildHeroChips({ exerciseCount: 5, minutes: null });
    expect(chips).toEqual([{ label: "5 ejercicios" }]);
  });

  it("builds minutes chip", () => {
    const chips = buildHeroChips({ exerciseCount: null, minutes: 30 });
    expect(chips).toEqual([{ label: "30 min" }]);
  });

  it("builds both chips", () => {
    const chips = buildHeroChips({ exerciseCount: 3, minutes: 20 });
    expect(chips).toEqual([
      { label: "3 ejercicios" },
      { label: "20 min" },
    ]);
  });

  it("returns empty array for null values", () => {
    expect(buildHeroChips({ exerciseCount: null, minutes: null })).toEqual([]);
  });
});

describe("getWeekdayIndex", () => {
  it("returns 0 for Monday", () => {
    // 2026-10-05 is a Monday
    expect(getWeekdayIndex(Date.parse("2026-10-05T12:00:00"))).toBe(0);
  });

  it("returns 5 for Saturday", () => {
    // 2026-10-10 is a Saturday
    expect(getWeekdayIndex(Date.parse("2026-10-10T12:00:00"))).toBe(5);
  });

  it("returns 6 for Sunday", () => {
    // 2026-10-04 is a Sunday
    expect(getWeekdayIndex(Date.parse("2026-10-04T12:00:00"))).toBe(6);
  });
});

describe("WEEKDAY_NAME_ES", () => {
  it("has 7 entries in Monday-first order", () => {
    expect(WEEKDAY_NAME_ES).toHaveLength(7);
    expect(WEEKDAY_NAME_ES[0]).toBe("Lunes");
    expect(WEEKDAY_NAME_ES[6]).toBe("Domingo");
  });
});

describe("getDailyFocus", () => {
  // Oct 5 2026 is Monday. Oct 10 2026 is Saturday.
  const MONDAY = Date.parse("2026-10-05T12:00:00");
  const SATURDAY = Date.parse("2026-10-10T12:00:00");

  it("returns the correct day name for Monday", () => {
    const result = getDailyFocus([], [], MONDAY);
    expect(result.dayName).toBe("Lunes");
  });

  it("returns the correct day name for Saturday", () => {
    const result = getDailyFocus([], [], SATURDAY);
    expect(result.dayName).toBe("Sábado");
  });

  it("returns null dayLabel when no plan entries", () => {
    const result = getDailyFocus([], [], MONDAY);
    expect(result.dayLabel).toBeNull();
  });

  it("resolves day label via modulo for a 3-day routine", () => {
    const entries = [
      { dayIndex: 0, dayLabel: "Pecho" },
      { dayIndex: 1, dayLabel: "Pierna" },
      { dayIndex: 2, dayLabel: "Espalda" },
    ];
    // Monday (weekday 0) → day 0 → "Pecho"
    const mondayFocus = getDailyFocus(entries, [], MONDAY);
    expect(mondayFocus.dayLabel).toBe("Pecho");

    // Tuesday (weekday 1) → day 1 → "Pierna"
    const tuesdayFocus = getDailyFocus(entries, [], Date.parse("2026-10-06T12:00:00"));
    expect(tuesdayFocus.dayLabel).toBe("Pierna");

    // Thursday (weekday 3) → 3 % 3 = 0 → "Pecho" (wraps)
    const thursdayFocus = getDailyFocus(entries, [], Date.parse("2026-10-08T12:00:00"));
    expect(thursdayFocus.dayLabel).toBe("Pecho");

    // Saturday (weekday 5) → 5 % 3 = 2 → "Espalda" (wraps)
    const saturdayFocus = getDailyFocus(entries, [], SATURDAY);
    expect(saturdayFocus.dayLabel).toBe("Espalda");
  });

  it("returns isRestDay=false when no session today", () => {
    const result = getDailyFocus([], [], MONDAY);
    expect(result.isRestDay).toBe(false);
  });

  it("returns isRestDay=true when a session completed today", () => {
    const sessions = [
      { startedAt: "2026-10-05T10:00:00", completedAt: "2026-10-05T10:30:00" },
    ];
    const result = getDailyFocus([], sessions, MONDAY);
    expect(result.isRestDay).toBe(true);
  });

  it("returns isRestDay=false for incomplete session today", () => {
    const sessions = [
      { startedAt: "2026-10-05T10:00:00", completedAt: null },
    ];
    const result = getDailyFocus([], sessions, MONDAY);
    expect(result.isRestDay).toBe(false);
  });

  it("honors explicit trainedToday override", () => {
    expect(getDailyFocus([], [], MONDAY, true).isRestDay).toBe(true);
    expect(getDailyFocus([], [], MONDAY, false).isRestDay).toBe(false);
  });

  it("ignores empty day labels", () => {
    const entries = [
      { dayIndex: 0, dayLabel: "" },
      { dayIndex: 1, dayLabel: "  " },
    ];
    const result = getDailyFocus(entries, [], MONDAY);
    expect(result.dayLabel).toBeNull();
  });
});