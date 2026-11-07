import { describe, expect, it } from "vitest";
import { buildRoutineDescription, parseRoutineMeta, type RoutineMeta, validateRoutineMeta } from "./routineMeta";

function makeMeta(overrides: Partial<RoutineMeta> = {}): RoutineMeta {
  return {
    v: 1,
    text: "Routine description",
    mode: "single",
    days: [
      { id: "day-1", order: 0, weekday: null, label: "Día A", kind: "training" },
    ],
    ...overrides,
  };
}

describe("validateRoutineMeta", () => {
  it("accepts a valid meta", () => {
    expect(validateRoutineMeta(makeMeta())).toBe(true);
  });

  it("rejects null and non-objects", () => {
    expect(validateRoutineMeta(null)).toBe(false);
    expect(validateRoutineMeta("not an object")).toBe(false);
    expect(validateRoutineMeta(42)).toBe(false);
  });

  it("rejects a version other than 1", () => {
    expect(validateRoutineMeta(makeMeta({ v: 2 as 1 }))).toBe(false);
  });

  it("rejects a missing text", () => {
    expect(validateRoutineMeta(makeMeta({ text: undefined as unknown as string }))).toBe(false);
  });

  it("rejects an invalid mode", () => {
    expect(validateRoutineMeta(makeMeta({ mode: "monthly" as "single" }))).toBe(false);
  });

  it("rejects a non-array days", () => {
    expect(validateRoutineMeta(makeMeta({ days: null as unknown as never }))).toBe(false);
  });

  it("rejects a day without a string id", () => {
    expect(validateRoutineMeta(makeMeta({ days: [{ order: 0, weekday: null, label: "", kind: "training" }] as never }))).toBe(false);
  });

  it("rejects a day with a negative order", () => {
    expect(validateRoutineMeta(makeMeta({ days: [{ id: "d", order: -1, weekday: null, label: "", kind: "training" }] as never }))).toBe(false);
  });

  it("rejects a day with an out-of-range weekday", () => {
    expect(validateRoutineMeta(makeMeta({ days: [{ id: "d", order: 0, weekday: 7, label: "", kind: "training" }] as never }))).toBe(false);
  });

  it("rejects a day without a string label", () => {
    expect(validateRoutineMeta(makeMeta({ days: [{ id: "d", order: 0, weekday: null, label: undefined as unknown as string, kind: "training" }] as never }))).toBe(false);
  });

  it("rejects a day with an invalid kind", () => {
    expect(validateRoutineMeta(makeMeta({ days: [{ id: "d", order: 0, weekday: null, label: "", kind: "cardio" as never }] as never }))).toBe(false);
  });

  it("rejects duplicate day ids", () => {
    const meta = makeMeta({ days: [{ id: "d", order: 0, weekday: null, label: "", kind: "training" }, { id: "d", order: 1, weekday: null, label: "", kind: "training" }] as never });
    expect(validateRoutineMeta(meta)).toBe(false);
  });

  it("rejects duplicate day orders", () => {
    const meta = makeMeta({ days: [{ id: "d1", order: 0, weekday: null, label: "", kind: "training" }, { id: "d2", order: 0, weekday: null, label: "", kind: "training" }] as never });
    expect(validateRoutineMeta(meta)).toBe(false);
  });

  it("rejects duplicate weekdays", () => {
    const meta = makeMeta({ days: [{ id: "d1", order: 0, weekday: 0, label: "", kind: "training" }, { id: "d2", order: 1, weekday: 0, label: "", kind: "training" }] as never });
    expect(validateRoutineMeta(meta)).toBe(false);
  });
});

describe("parseRoutineMeta", () => {
  it("returns empty text and null meta for an empty string", () => {
    expect(parseRoutineMeta("")).toEqual({ text: "", meta: null });
  });

  it("returns the raw string and null meta for a non-JSON string", () => {
    expect(parseRoutineMeta("just a description")).toEqual({ text: "just a description", meta: null });
  });

  it("extracts text and meta from a valid bridge JSON", () => {
    const base = makeMeta();
    const raw = JSON.stringify({ ...base, text: "Bridge text" });
    const result = parseRoutineMeta(raw);
    expect(result.text).toBe("Bridge text");
    expect(result.meta).toEqual({ ...base, text: "Bridge text" });
  });

  it("returns the raw string for invalid JSON that starts with a brace", () => {
    expect(parseRoutineMeta("{ not valid json }")).toEqual({ text: "{ not valid json }", meta: null });
  });

  it("returns the raw string for valid JSON that is not a valid meta", () => {
    expect(parseRoutineMeta(JSON.stringify({ v: 2 }))).toEqual({ text: JSON.stringify({ v: 2 }), meta: null });
  });
});

describe("buildRoutineDescription", () => {
  it("returns the plain text when there is no meta", () => {
    expect(buildRoutineDescription("just text", null)).toBe("just text");
  });

  it("wraps text and meta into a versioned bridge JSON", () => {
    const meta = makeMeta();
    const result = buildRoutineDescription("Bridge text", meta);
    const parsed = JSON.parse(result);
    expect(parsed.v).toBe(1);
    expect(parsed.text).toBe("Bridge text");
    expect(parsed.mode).toBe("single");
    expect(parsed.days).toHaveLength(1);
  });

  it("throws when the payload exceeds 4096 characters", () => {
    const meta = makeMeta();
    expect(() => buildRoutineDescription("x".repeat(5000), meta)).toThrow("routine_meta_too_large");
  });
});
