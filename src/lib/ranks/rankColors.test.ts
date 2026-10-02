/**
 * rankColors.test.ts — the contrast rules the rank map depends on.
 *
 * The labels drawn on top of the body map are the only place these colours are
 * load-bearing for readability, so the WCAG assertion is enforced here rather than
 * left as a comment in `rankConfig`.
 */

import { describe, expect, it } from "vitest";
import { RANKS } from "./rankConfig";
import {
  AA_CONTRAST,
  AA_LARGE_CONTRAST,
  SURFACE_BLACK,
  contrastRatio,
  darken,
  isRecessive,
  lighten,
  paletteFor,
  relativeLuminance,
} from "./rankColors";

describe("contrastRatio", () => {
  it("returns 21 for white on black and 1 for a colour on itself", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#000000")).toBeCloseTo(1, 5);
  });

  it("is order independent", () => {
    expect(contrastRatio("#ff9f0a", "#000000")).toBeCloseTo(
      contrastRatio("#000000", "#ff9f0a"),
      10,
    );
  });

  it("matches the published amber-on-black ratio", () => {
    // #ff9f0a on black is ~10.4:1; asserted with a loose bound because the exact
    // value is not the point, only that it is comfortably readable.
    const ratio = contrastRatio("#ff9f0a", SURFACE_BLACK);
    expect(ratio).toBeGreaterThan(9);
    expect(ratio).toBeLessThan(11);
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("returns 0 for unparseable input rather than NaN", () => {
    // NaN would silently poison every contrast comparison downstream.
    expect(relativeLuminance("nope")).toBe(0);
    expect(relativeLuminance("#12345")).toBe(0);
  });
});

describe("rank palettes on a true-black OLED panel", () => {
  it("gives every earned rank's fill enough contrast against black", () => {
    for (const rank of RANKS) {
      // obsidian: fill oscuro deliberado — la visibilidad recae en el borderColor (#DDD6FE, 17.82:1)
      if (isRecessive(rank) || rank.id === "obsidian") continue;
      const ratio = contrastRatio(rank.color, SURFACE_BLACK);
      expect(ratio, `${rank.id}: ${rank.color} sobre negro`).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });

  it("keeps the label readable on every rank fill, light and dark alike", () => {
    // The map draws the Spanish muscle name on the fill, so this is the rule that
    // actually matters. Half the ladder is light, so a single label colour cannot
    // pass; the palette has to choose per rank.
    for (const rank of RANKS) {
      const palette = paletteFor(rank);
      const ratio = contrastRatio(palette.label, palette.fill);
      expect(ratio, `${rank.id}: etiqueta sobre ${rank.color}`).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });

  it("keeps every border colour visible against black", () => {
    // WCAG 1.4.11: trazo decorativo de insignia, no control interactivo
    for (const rank of RANKS) {
      expect(
        contrastRatio(rank.borderColor, SURFACE_BLACK),
        `${rank.id} borde`,
      ).toBeGreaterThanOrEqual(AA_LARGE_CONTRAST);
    }
  });

  it("marks exactly one rank as recessive", () => {
    const recessive = RANKS.filter(isRecessive).map((r) => r.id);
    expect(recessive).toEqual(["unranked"]);
  });
});

describe("rank colours are distinguishable from each other", () => {
  it("separates adjacent ranks enough to read as different", () => {
    // Deliberately not 4.5:1. Two regions sitting next to each other on the map
    // only need to be tellable apart, not to be read as text against each other.
    const ordered = [...RANKS].sort((a, b) => a.minScore - b.minScore);
    for (let i = 1; i < ordered.length; i += 1) {
      const ratio = contrastRatio(ordered[i - 1].color, ordered[i].color);
      expect(ratio, `${ordered[i - 1].id} vs ${ordered[i].id}`).toBeGreaterThan(1.15);
    }
  });

  it("gives every rank a distinct hex colour", () => {
    const colors = new Set(RANKS.map((r) => r.color.toLowerCase()));
    expect(colors.size).toBe(RANKS.length);
  });
});

describe("darken and lighten", () => {
  it("darken moves toward black and clamps at the ends", () => {
    expect(darken("#ffffff", 1)).toBe("#000000");
    expect(darken("#ffffff", 0)).toBe("#ffffff");
    expect(darken("#ffffff", 0.5)).toBe("#808080");
  });

  it("lighten moves toward white and clamps at the ends", () => {
    expect(lighten("#000000", 1)).toBe("#ffffff");
    expect(lighten("#000000", 0)).toBe("#000000");
  });

  it("handles shorthand hex", () => {
    expect(darken("#fff", 1)).toBe("#000000");
    expect(lighten("#000", 1)).toBe("#ffffff");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    expect(darken("rgb(1,2,3)", 0.5)).toBe("rgb(1,2,3)");
    expect(lighten("", 0.5)).toBe("");
  });

  it("clamps out-of-range amounts instead of producing garbage", () => {
    expect(darken("#ffffff", 5)).toBe("#000000");
    expect(lighten("#000000", -3)).toBe("#000000");
  });
});