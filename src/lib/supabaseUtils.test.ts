import { describe, expect, it } from "vitest";

import { sanitizeIds, stripIdSuffix } from "./supabaseUtils";

describe("stripIdSuffix", () => {
  it("removes a trailing :N suffix", () => {
    expect(stripIdSuffix("0009:1")).toBe("0009");
    expect(stripIdSuffix("uuid-abc:0")).toBe("uuid-abc");
  });

  it("is a no-op for clean ids", () => {
    expect(stripIdSuffix("0009")).toBe("0009");
    expect(stripIdSuffix("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
  });

  it("does not strip dots colons inside the id", () => {
    expect(stripIdSuffix("a1b2c3d4-:5")).toBe("a1b2c3d4-");
  });
});

describe("sanitizeIds", () => {
  it("strips :N suffixes from every element", () => {
    expect(sanitizeIds(["0009:1", "0010", "0009"])).toEqual(["0009", "0010"]);
  });

  it("drops empty strings after stripping", () => {
    expect(sanitizeIds([":1", ":0"])).toEqual([]);
  });

  it("filters out non-string values", () => {
    expect(sanitizeIds(["0009", undefined as unknown as string, "0010"])).toEqual([
      "0009",
      "0010",
    ]);
  });

  it("de-duplicates the result", () => {
    expect(sanitizeIds(["0009", "0009", "0009:1"])).toEqual(["0009"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(sanitizeIds([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = ["0009:1", "0010"];
    const snapshot = [...input];
    sanitizeIds(input);
    expect(input).toEqual(snapshot);
  });
});
