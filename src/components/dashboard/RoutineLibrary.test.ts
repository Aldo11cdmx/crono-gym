/**
 * RoutineLibrary.test.ts — tests for the pure helpers used by RoutineLibrary.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { normalizeText, formatLastRunRelative } from "@/components/dashboard/RoutineLibrary";

describe("normalizeText", () => {
  it("lowercases ASCII text", () => {
    expect(normalizeText("SENTADILLA")).toBe("sentadilla");
  });

  it("strips accents for accent-insensitive matching", () => {
    expect(normalizeText("Rutina Áéíóú")).toBe("rutina aeiou");
  });

  it("strips tildes from ñ to n (NFD decomposes ñ → n + combining tilde)", () => {
    expect(normalizeText("niño")).toBe("nino");
  });

  it("handles empty strings", () => {
    expect(normalizeText("")).toBe("");
  });

  it("preserves spaces and numbers", () => {
    expect(normalizeText("Ejercicio 1")).toBe("ejercicio 1");
  });

  it("treats accented and non-accented as equal after normalization", () => {
    expect(normalizeText("Café")).toBe(normalizeText("CAFE"));
  });
});

describe("formatLastRunRelative", () => {
  const NOW = 1_747_000_000_000;

  it("returns 'Nunca' for null input", () => {
    expect(formatLastRunRelative(null, NOW)).toBe("Nunca");
  });

  it("returns 'Nunca' for invalid date string", () => {
    expect(formatLastRunRelative("not-a-date", NOW)).toBe("Nunca");
  });

  it("returns 'Hoy' for a run earlier today", () => {
    expect(formatLastRunRelative("2025-05-11T18:00:00Z", NOW)).toBe("Hoy");
  });

  it("returns 'Ayer' for yesterday", () => {
    expect(formatLastRunRelative("2025-05-10T18:00:00Z", NOW)).toBe("Ayer");
  });

  it("returns 'Hace X días' for a run 3 days ago", () => {
    expect(formatLastRunRelative("2025-05-08T18:00:00Z", NOW)).toBe("Hace 3 días");
  });

  it("returns 'Hace X semanas' for a run 2 weeks ago", () => {
    expect(formatLastRunRelative("2025-04-27T18:00:00Z", NOW)).toBe("Hace 2 semanas");
  });

  it("returns 'Hace X meses' for a run 2 months ago", () => {
    expect(formatLastRunRelative("2025-03-11T18:00:00Z", NOW)).toBe("Hace 2 meses");
  });
});
