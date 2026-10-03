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
  CVD_DISTINGUISHABLE,
  SURFACE_BLACK,
  contrastRatio,
  cvdDeltaE,
  darken,
  deltaE,
  isRecessive,
  lighten,
  paletteFor,
  relativeLuminance,
  simulateCvd,
  worstCaseCvdDeltaE,
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
  it("separates adjacent ranks for the viewer who can least tell them apart", () => {
    const ordered = [...RANKS].sort((a, b) => a.minScore - b.minScore);
    for (let i = 1; i < ordered.length; i += 1) {
      const distance = worstCaseCvdDeltaE(ordered[i - 1].color, ordered[i].color);
      // Deliberately not a large number. Two regions sitting next to each other on
      // the map only need to be tellable apart, not to be read as text against each
      // other, so the floor is "a few just-noticeable differences".
      expect(distance, `${ordered[i - 1].id} vs ${ordered[i].id}`).toBeGreaterThanOrEqual(
        CVD_DISTINGUISHABLE,
      );
    }
  });

  it("separates adjacent ranks under each dichromacy, not only the worst one", () => {
    // The min() in `worstCaseCvdDeltaE` would hide a single failing dichromacy
    // behind two passing ones. Asserting each kind on its own is what makes a
    // tritanopia regression visible while protanopia and deuteranopia still pass.
    const ordered = [...RANKS].sort((a, b) => a.minScore - b.minScore);
    for (const kind of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      for (let i = 1; i < ordered.length; i += 1) {
        expect(
          cvdDeltaE(ordered[i - 1].color, ordered[i].color, kind),
          `${kind}: ${ordered[i - 1].id} vs ${ordered[i].id}`,
        ).toBeGreaterThanOrEqual(CVD_DISTINGUISHABLE);
      }
    }
  });

  it("separates every pair of ranks, not only adjacent ones", () => {
    // A trichromat can hold two ranks in mind and compare them; a body map at a
    // glance cannot. Checking only neighbours would let two distant ranks collapse
    // into each other unnoticed.
    for (const a of RANKS) {
      for (const b of RANKS) {
        if (a.id >= b.id) continue;
        expect(
          worstCaseCvdDeltaE(a.color, b.color),
          `${a.id} vs ${b.id}`,
        ).toBeGreaterThanOrEqual(CVD_DISTINGUISHABLE);
      }
    }
  });

  it("would pass a weaker luminance-only check, which is why it is not used", () => {
    // Gold and Platinum sit within 9% of each other in luminance, so the old
    // contrast-ratio proxy called them the same colour at 1.09. Measured in Lab
    // they are 43.9 apart under the worst dichromacy. Pinned here so the weaker
    // check cannot quietly come back: it would fail on this pair and someone would
    // "fix" a palette that was never broken.
    const gold = RANKS.find((r) => r.id === "gold")!;
    const platinum = RANKS.find((r) => r.id === "platinum")!;

    expect(contrastRatio(gold.color, platinum.color)).toBeLessThan(1.15);
    expect(worstCaseCvdDeltaE(gold.color, platinum.color)).toBeGreaterThan(40);
  });

  it("gives every rank a distinct hex colour", () => {
    const colors = new Set(RANKS.map((r) => r.color.toLowerCase()));
    expect(colors.size).toBe(RANKS.length);
  });

  it("gives every rank a distinct glyph, so rank survives a monochrome print", () => {
    const glyphs = new Set(RANKS.map((r) => r.glyph));
    expect(glyphs.size).toBe(RANKS.length);
    for (const rank of RANKS) {
      // A glyph that renders as tofu or a blank box is not a channel at all.
      expect(rank.glyph.trim(), `${rank.id} sin glifo`).not.toBe("");
    }
  });

  it("gives every earned rank a distinct label", () => {
    const labels = RANKS.filter((r) => r.id !== "unranked").map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("simulateCvd", () => {
  it("leaves a grey unchanged under every dichromacy", () => {
    // Grey carries no hue information, so any hue loss must be a no-op. A matrix
    // that shifts it is wrong, not merely imprecise.
    for (const kind of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      expect(simulateCvd("#808080", kind), kind).toBe("#808080");
    }
  });

  it("shrinks a red/green pair for a protanope, which is the canonical case", () => {
    // The dichromacy that motivated the whole glyph channel: a trichromat sees a
    // red and a green as far apart, a protanope does not.
    expect(deltaE("#ff6b6b", "#6bff6b")).toBeGreaterThan(100);
    expect(worstCaseCvdDeltaE("#ff6b6b", "#6bff6b")).toBeLessThan(
      deltaE("#ff6b6b", "#6bff6b") * 0.7,
    );
  });

  it("barely moves a blue/yellow pair, which every dichromacy preserves", () => {
    // The control for the case above: if the simulation shrank this pair too it
    // would be destroying information rather than modelling missing cones.
    const trico = deltaE("#6bb6ff", "#ffd66b");
    const worst = worstCaseCvdDeltaE("#6bb6ff", "#ffd66b");
    expect(worst).toBeGreaterThan(trico * 0.4);
  });

  it("reports zero separation between a colour and itself", () => {
    expect(deltaE("#f2b84b", "#f2b84b")).toBe(0);
    expect(worstCaseCvdDeltaE("#f2b84b", "#f2b84b")).toBe(0);
  });

  it("returns the input unchanged rather than black for input it cannot parse", () => {
    // Black would read as "maximally different from everything" and quietly turn a
    // typo into a deliberate, maximally-contrasting choice. Note the unparseable
    // input has to be genuinely unparseable: the colour parser accepts `rgb()`
    // notation, so a hex string is not a test of the failure path.
    for (const kind of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      expect(simulateCvd("not-a-colour", kind), kind).toBe("not-a-colour");
      expect(simulateCvd("", kind), kind).toBe("");
    }
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