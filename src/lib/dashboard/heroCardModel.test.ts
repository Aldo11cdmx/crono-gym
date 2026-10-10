import { describe, expect, it } from "vitest";
import {
  buildHeroChips,
  formatElapsed,
  getElapsedMs,
  getGreeting,
  getSessionProgress,
} from "./heroCardModel";

describe("getGreeting", () => {
  // Use local-time Date constructor so tests are portable across timezones.
  // Jan 1 2025, 08:00 local = morning for all zones.
  const nowMorning = new Date(2025, 0, 1, 8, 0, 0).getTime();
  const nowAfternoon = new Date(2025, 0, 1, 15, 0, 0).getTime();
  const nowEvening = new Date(2025, 0, 1, 20, 0, 0).getTime();
  const nowEarly = new Date(2025, 0, 1, 4, 0, 0).getTime();

  it("returns 'Buenos días' in the morning without a name", () => {
    expect(getGreeting(nowMorning, null)).toBe("Buenos días");
  });

  it("includes a short name safely truncated", () => {
    expect(getGreeting(nowMorning, "Ana")).toBe("Buenos días, Ana");
    expect(getGreeting(nowMorning, "  Luis  ")).toBe("Buenos días, Luis");
  });

  it("uses only the first word of a full name", () => {
    expect(getGreeting(nowMorning, "Ana María")).toBe("Buenos días, Ana");
  });

  it("truncates names longer than 20 chars", () => {
    const longName = "Supercalifragilisticoespialidoso";
    expect(getGreeting(nowMorning, longName)).toBe(`Buenos días, ${longName.slice(0, 20)}`);
  });

  it("returns bare greeting for empty or whitespace-only names", () => {
    expect(getGreeting(nowMorning, "")).toBe("Buenos días");
    expect(getGreeting(nowMorning, "   ")).toBe("Buenos días");
  });

  it("says 'Buenas tardes' at 3pm", () => {
    expect(getGreeting(nowAfternoon, "Test")).toBe("Buenas tardes, Test");
  });

  it("says 'Buenas noches' at 8pm and 4am", () => {
    expect(getGreeting(nowEvening, null)).toBe("Buenas noches");
    expect(getGreeting(nowEarly, null)).toBe("Buenas noches");
  });
});

describe("getElapsedMs", () => {
  it("computes positive elapsed from a valid timestamp", () => {
    const startedAt = "2026-01-01T10:00:00.000Z";
    const now = Date.parse(startedAt) + 60_000; // 1 minute later
    expect(getElapsedMs(startedAt, now)).toBe(60_000);
  });

  it("never returns negative even if clock jumps backward", () => {
    const startedAt = "2026-01-01T10:00:00.000Z";
    const now = Date.parse(startedAt) - 5_000; // 5 seconds before start
    expect(getElapsedMs(startedAt, now)).toBe(0);
  });

  it("returns null for missing startedAt", () => {
    expect(getElapsedMs(null, Date.now())).toBeNull();
    expect(getElapsedMs(undefined, Date.now())).toBeNull();
  });

  it("returns null for unparseable timestamp", () => {
    expect(getElapsedMs("not-a-date", Date.now())).toBeNull();
    expect(getElapsedMs("NaN", 1234)).toBeNull();
  });
});

describe("formatElapsed", () => {
  it("formats seconds as m:ss", () => {
    expect(formatElapsed(65_000)).toBe("1:05");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(5 * 60_000 + 3_000)).toBe("5:03");
  });

  it("formats hours as h:mm:ss", () => {
    // 1h 37m 5s = 3600000 + 37*60000 + 5000
    expect(formatElapsed(3600000 + 37 * 60_000 + 5_000)).toBe("1:37:05");
  });

  it("returns 0:00 for null", () => {
    expect(formatElapsed(null)).toBe("0:00");
  });

  it("returns 0:00 for zero or negative", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(-1_000)).toBe("0:00");
  });
});

describe("getSessionProgress", () => {
  it("computes ratio from done/planned", () => {
    expect(getSessionProgress(3, 10)).toBe(0.3);
  });

  it("clamps to 1 when done exceeds planned", () => {
    expect(getSessionProgress(15, 10)).toBe(1);
  });

  it("clamps to 0 when done is 0", () => {
    expect(getSessionProgress(0, 10)).toBe(0);
  });

  it("returns null when planned <= 0", () => {
    expect(getSessionProgress(3, 0)).toBeNull();
    expect(getSessionProgress(3, -1)).toBeNull();
  });

  it("returns null when done or planned is null", () => {
    expect(getSessionProgress(null, 10)).toBeNull();
    expect(getSessionProgress(3, null)).toBeNull();
  });
});

describe("buildHeroChips", () => {
  it("produces pluralized exercise chip", () => {
    const chips = buildHeroChips({ exerciseCount: 5, minutes: 30 });
    expect(chips).toContainEqual({ label: "5 ejercicios" });
  });

  it("produces singular exercise chip", () => {
    const chips = buildHeroChips({ exerciseCount: 1, minutes: 5 });
    expect(chips).toContainEqual({ label: "1 ejercicio" });
  });

  it("produces minutes chip", () => {
    const chips = buildHeroChips({ exerciseCount: 3, minutes: 30 });
    expect(chips).toContainEqual({ label: "30 min" });
  });

  it("omits chips when values are null", () => {
    const chips = buildHeroChips({ exerciseCount: null, minutes: null });
    expect(chips).toEqual([]);
  });

  it("omits exercise chip when count is 0", () => {
    const chips = buildHeroChips({ exerciseCount: 0, minutes: 30 });
    expect(chips).toEqual([{ label: "30 min" }]);
  });

  it("ignores muscles (no helper yet)", () => {
    const chips = buildHeroChips({ exerciseCount: 3, minutes: 30, muscles: ["chest", "shoulders"] });
    expect(chips).toHaveLength(2); // only exercise + minutes
  });
});
