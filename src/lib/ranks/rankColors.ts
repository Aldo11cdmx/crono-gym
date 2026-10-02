/**
 * rankColors.ts — colour maths for the rank map.
 *
 * Pure functions so the contrast rules are actually verified by a test rather than
 * asserted in a comment. `rankConfig` holds the hex values; this file decides what
 * may be drawn on top of them.
 *
 * Why contrast matters more here than anywhere else
 * -------------------------------------------------
 * The map paints a fill per muscle and draws the muscle's Spanish label on top of
 * it. Half the ladder is light (silver, gold, platinum, diamond) and half is dark,
 * so a single label colour cannot work for all of them. `paletteFor` picks per
 * rank, and `rankColors.test.ts` asserts the choice clears 4.5:1 in both
 * directions. `unranked` is exempt from the fill-vs-background rule on purpose:
 * the absence of a rank should recede, and a muscle with no data competing for
 * attention with one the user earned would be the wrong signal.
 */

/** WCAG AA for normal text, the floor every rank clears. */
export const AA_CONTRAST = 4.5;

import { RANKS, type RankDefinition, type RankId } from "./rankConfig";

/** Relative luminance per WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The app's pure-black OLED surface, and the near-black inactive fill. */
export const SURFACE_BLACK = "#000000";
export const SURFACE_INERT = "#0a0a0c";

/** Text colours from the app's neutral scale. */
const TEXT_PRIMARY = "#f5f5f7";
const TEXT_SECONDARY = "#8e8e93";
/** Ink for dark-on-light fills, so text is never near-white on a light rank. */
const TEXT_INK = "#0a0a0c";

export interface RankPalette {
  /** Map fill for the muscle. */
  fill: string;
  /** Stroke colour, readable against the black background. */
  stroke: string;
  /**
   * Label colour for text drawn on {@link fill}.
   *
   * Per-rank rather than global: near-white on gold is 1.7:1 and near-black is
   * 10.7:1, so the same colour cannot serve both ends of the ladder.
   */
  label: string;
  /** Glow colour for a promoted muscle. */
  glow: string;
}

/** Rank ids whose fill is allowed below the fill-vs-black floor. */
const RECESSIVE_RANKS = new Set<RankId>(["unranked"]);

/**
 * Picks whichever of the two label colours reads better on `fill`.
 *
 * Returned rather than hardcoded so the choice is testable and so a future rank
 * colour cannot silently break legibility.
 */
function labelFor(fill: string): string {
  return contrastRatio(TEXT_PRIMARY, fill) >= contrastRatio(TEXT_INK, fill)
    ? TEXT_PRIMARY
    : TEXT_INK;
}

const PALETTES = new Map<string, RankPalette>(
  RANKS.map((rank) => [
    rank.id,
    {
      fill: rank.color,
      stroke: rank.borderColor,
      label: labelFor(rank.color),
      glow: rank.borderColor,
    },
  ]),
);

/** Palette for a rank. `unranked` maps to the inert grey. */
export function paletteFor(rank: RankDefinition): RankPalette {
  return (
    PALETTES.get(rank.id) ?? {
      fill: SURFACE_INERT,
      stroke: rank.borderColor,
      label: TEXT_SECONDARY,
      glow: rank.borderColor,
    }
  );
}

/** True when this rank's fill is exempt from the fill-vs-background floor. */
export function isRecessive(rank: RankDefinition): boolean {
  return RECESSIVE_RANKS.has(rank.id);
}

/**
 * Blend a colour toward black by `amount`.
 *
 * Used for the hover state on the rank map: a lighter version of the muscle's own
 * rank reads as "that region" far better than a neutral grey, which would throw
 * away the rank information the user is looking at.
 */
export function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - Math.min(1, Math.max(0, amount));
  return `#${rgb
    .map((c) => Math.round(c * factor).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Lighten toward white, used for the unranked region's hover. */
export function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = Math.min(1, Math.max(0, amount));
  return `#${rgb
    .map((c) => Math.round(c + (255 - c) * factor).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace("#", "").trim();
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  if (full.length !== 6) return null;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return null;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}