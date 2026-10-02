/**
 * tokens.ts — the single source of truth for colour, type, space and motion.
 *
 * Every component reads from here. The rule this module exists to enforce is
 * simple: no component may name a raw colour. If a shade is needed it is added
 * here, gets a contrast test, and is available to everything at once.
 *
 * Two layers, on purpose
 * ----------------------
 * This file holds the values, so tests and TypeScript can import them and assert
 * against real numbers rather than against a stylesheet it cannot read.
 * `cssVars()` projects the same values into CSS custom properties, which is what
 * Tailwind and any runtime theming consume.
 *
 * Projecting rather than hand-writing both is deliberate. Two hand-maintained
 * copies of one palette is how a token ends up green in TypeScript and amber in
 * CSS, and the drift is invisible until someone reads the wrong one.
 *
 * Rules this palette is built to satisfy, all verified in `tokens.test.ts`:
 * - No saturated red anywhere. Protanopes and deuteranopes cannot reliably
 *   separate a saturated red from a dark neutral, which is why error and
 *   destructive states use a deep wine plus an icon and a label rather than red.
 * - Every text tier clears WCAG AA against the surface it is used on.
 * - Status colours are distinguishable under all three dichromacies.
 */

// --------------------------------------------------------------- surfaces

/**
 * True black at the base, because OLED panels switch those pixels off entirely.
 *
 * Four layers rather than one: a flat single-black screen has no depth cue, and
 * the eye reads "nothing is here" rather than "this is the bottom of the stack".
 * Layer 0 is the void; layer 3 is a raised panel.
 */
export const SURFACE = {
  /** The page itself. True black. */
  base: "#000000",
  /** Cards, panels, list rows. */
  raised: "#0d0d10",
  /** Elevated surfaces: popovers, modals, dropdowns. */
  overlay: "#16161a",
  /** Pressed or selected rows, inset wells. */
  sunken: "#08080a",
} as const;

/** Aliases so a token names its *role* rather than its position in the stack. */
export const SURFACE_ROLE = {
  /** The page. */
  canvas: SURFACE.base,
  /** A card resting on the page. */
  card: SURFACE.raised,
  /** A card lifted above another card. */
  popover: SURFACE.overlay,
  /** An input or track, visually below its container. */
  well: SURFACE.sunken,
} as const;

// ------------------------------------------------------------------ glass

/**
 * The glass recipe.
 *
 * A single translucent white fill rather than a colour-tinted one: tinting glass
 * amber makes every card read as a warning, which spends the brand accent on
 * decoration and destroys its meaning as "this is the primary action".
 *
 * The fill is composited over the canvas and the result must clear 3:1, which is
 * what `flatten()` in `color.ts` verifies.
 */
export const GLASS = {
  /** Translucent white over the canvas. */
  fill: "rgba(255, 255, 255, 0.06)",
  /** Slightly denser, for a card sitting on another card. */
  fillRaised: "rgba(255, 255, 255, 0.09)",
  /** Hairline. Below 10% it disappears on OLED at arm's length. */
  border: "rgba(255, 255, 255, 0.10)",
  /** Emphasised border: hover, focus-adjacent. */
  borderStrong: "rgba(255, 255, 255, 0.18)",
  /** The subtle top-edge highlight that makes glass read as a lit surface. */
  innerHighlight: "rgba(255, 255, 255, 0.14)",
  /** Diffuse drop shadow. Two layers: contact shadow plus ambient lift. */
  shadow: "0 1px 2px rgba(0, 0, 0, 0.6), 0 12px 32px rgba(0, 0, 0, 0.45)",
  /** Large radius. The brief asks for 20-28px; 24 is the middle and reads soft. */
  radius: "24px",
} as const;

/**
 * Solid fallback for the glass recipe.
 *
 * Used when `prefers-reduced-transparency` is on, when `backdrop-filter` is
 * unsupported, or when the high-contrast setting is enabled. Chosen to be a small
 * step lighter than the canvas so a card is still visible as a card without
 * relying on blur to define its edge.
 */
export const SOLID = {
  card: "#141418",
  popover: "#1c1c21",
  border: "rgba(255, 255, 255, 0.14)",
  borderStrong: "rgba(255, 255, 255, 0.26)",
} as const;

// ------------------------------------------------------------------- text

/**
 * Titanium greys.
 *
 * Four tiers, split by *role in a sentence* rather than by lightness alone:
 * primary carries the reading, secondary supports it, tertiary is for units and
 * captions the user may skip, and disabled is explicitly not readable content.
 * Every tier clears 4.5:1 on the canvas except `disabled`, which WCAG 1.4.3
 * exempts for inactive controls and which the test documents as exempt.
 */
export const TEXT = {
  /** Body and headings. */
  primary: "#f5f5f7",
  /** Supporting copy: labels, metadata. */
  secondary: "#a1a1aa",
  /** Captions, units, timestamps. Still AA on canvas. */
  tertiary: "#85858e",
  /** Inactive controls. Exempt from AA. */
  disabled: "#52525b",
  /** Text on top of an accent or primary fill. */
  onAccent: "#0a0a0c",
} as const;

// ----------------------------------------------------------------- accents

/**
 * Amber is the single primary accent.
 *
 * Deliberately one hue for the whole app: an accent that changes colour per
 * screen stops reading as "this is the action" and starts reading as decoration.
 */
export const ACCENT = {
  /** Primary action fill. Dark ink on it clears 10:1. */
  base: "#f5a524",
  /** Text and icons on dark backgrounds. */
  text: "#f7b955",
  /**
   * The accent named for emphasis rather than for a surface.
   *
   * Intentionally identical to {@link text} for now, and `tokens.test.ts` fails
   * if an edit separates them. Two names rather than one because "a slightly
   * louder amber" and "the amber we use for text on black" are different intents
   * that happen to resolve to the same hex: the shell's two-hour session warning
   * wants the second one, and giving it its own name means it can become a
   * different colour later without every call site having to be re-read.
   */
  secondary: "#f7b955",
  /** Hairline accent border. */
  border: "rgba(245, 165, 36, 0.42)",
  /** Tinted background for an accent-tinted surface. */
  muted: "rgba(245, 165, 36, 0.14)",
  /** Pressed. */
  pressed: "#d8901a",
} as const;

/**
 * Copper: the secondary accent.
 *
 * Used for tertiary emphasis and for progressive-overload "deload" advice, where
 * amber would be confused with the primary action. Deliberately desaturated and
 * darker than amber so the two stay distinguishable side by side.
 */
export const COPPER = {
  base: "#c47a4a",
  text: "#d99a72",
  border: "rgba(196, 122, 74, 0.42)",
  muted: "rgba(196, 122, 74, 0.14)",
} as const;

// -------------------------------------------------------------- destructive

/**
 * Destructive and alert: a deep, desaturated wine.
 *
 * Two deliberate departures from the obvious choice.
 *
 * It is not bright red. A saturated red is invisible to roughly 1 in 12 men and
 * *also* sits next to the greens and ambers used for success and warning, which
 * is exactly the confusion axis. `isSaturatedRed` in `tokens.test.ts` fails the
 * build if a bright red reappears here.
 *
 * It is never the only signal. Every destructive control in `components/ui`
 * pairs this colour with an icon and a text label, so the meaning survives a
 * monochrome print or a colour-blind user.
 */
export const DANGER = {
  /** Fill for a destructive button. */
  base: "#7a2f3d",
  /** Text and icons on dark backgrounds. */
  text: "#e08d9c",
  border: "rgba(224, 141, 156, 0.42)",
  muted: "rgba(122, 47, 61, 0.24)",
  /** Deepest variant, for a critical banner. */
  deep: "#4a1a25",
} as const;

// ------------------------------------------------------------------ status

/**
 * Status colours.
 *
 * The brief forbids the red/green pair. These are spread across blue, amber and
 * violet, and each carries an `icon` and a `shape` so the state survives being
 * read without colour:
 *
 * - success is a blue tick on a circle. Deliberately *not* green: green is the
 *   colour a deuteranope is most likely to read as the same muted yellow-brown
 *   as amber, so a green success chip beside an amber warning chip collapses.
 * - warning is an amber triangle.
 * - error is the wine diamond. Deliberately *not* a circle: a success and an
 *   error chip that differ only in colour are the exact failure this table
 *   exists to prevent, and both are common enough to sit side by side.
 * - pr (personal record) is violet, used nowhere else, because a PR is a reward
 *   and reusing the success blue would dilute both. Its star is the only star in
 *   the set, so the shape carries the meaning independently of the hue.
 *
 * `text` and `muted` are pre-paired, so a component never has to combine a colour
 * with whatever background it happens to land on.
 */
export const STATUS = {
  success: {
    base: "#4a9fd8",
    text: "#8fc9ef",
    border: "rgba(74, 159, 216, 0.45)",
    muted: "rgba(74, 159, 216, 0.16)",
    icon: "check",
    shape: "circle",
    label: "Completado",
  },
  warning: {
    base: "#f5a524",
    text: "#f7b955",
    border: "rgba(245, 165, 36, 0.45)",
    muted: "rgba(245, 165, 36, 0.14)",
    icon: "alert",
    shape: "triangle",
    label: "Aviso",
  },
  error: {
    base: "#a34455",
    text: "#e08d9c",
    border: "rgba(224, 141, 156, 0.45)",
    muted: "rgba(122, 47, 61, 0.24)",
    icon: "alert",
    shape: "diamond",
    label: "Error",
  },
  pr: {
    base: "#b28dff",
    text: "#cbb0ff",
    border: "rgba(178, 141, 255, 0.45)",
    muted: "rgba(178, 141, 255, 0.16)",
    icon: "sparkle",
    shape: "star",
    label: "Marca",
  },
  /**
   * The training signal earned: the load went up.
   *
   * Cyan, not the green this product refuses everywhere else. Green is the hue a
   * deuteranope is most likely to fold into the amber of `warning`, and these
   * two sit on the same card in `SetLoggerRow`.
   *
   * `text` is a light tint read against the black canvas, like every other
   * status in this table. A dark teal would be the colour of ink *on* a light
   * chip, and it lands at 3.9:1 on black -- below the AA floor this token set
   * holds everywhere else.
   */
  progression: {
    base: "#6EE7F7",
    text: "#A5F3FC",
    border: "rgba(110, 231, 247, 0.42)",
    muted: "rgba(110, 231, 247, 0.12)",
    icon: "trend-up",
    shape: "chevron",
    label: "Progresión",
  },
  /**
   * Coming back after a break.
   *
   * A softer blue than `progression`, and deliberately *darker* rather than a
   * different hue. Both tints are cyan, and at the same lightness the dichromacy
   * simulation folds them into each other; the separation has to come from
   * luminance, so `progression.text` is the lightest cyan in the set and this one
   * sits well below it. Shape (flag vs chevron) and the label still carry the
   * distinction, because 1.22:1 is a thin margin for two chips on one card.
   */
  comeback: {
    base: "#93C5FD",
    text: "#9DD8FA",
    border: "rgba(147, 197, 253, 0.42)",
    muted: "rgba(147, 197, 253, 0.12)",
    icon: "undo",
    shape: "flag",
    label: "Vuelta tras pausa",
  },
} as const;

export type StatusName = keyof typeof STATUS;

/**
 * Status colour, icon and shape as a unit.
 *
 * Returned together rather than as three lookups because the three always travel
 * together: a chip that shows the colour without the icon is the exact failure
 * this table exists to prevent, so the type does not allow it.
 */
export function statusFor(name: StatusName): {
  base: string;
  text: string;
  border: string;
  muted: string;
  icon: string;
  shape: string;
  label: string;
} {
  return STATUS[name];
}

// ------------------------------------------------------------------- ranks

import { EARNABLE_RANKS } from "../lib/ranks/rankConfig";

/**
 * The seven-rank ladder, colour-blind safe.
 *
 * The values are deliberately *not* repeated here. `rankConfig.ts` owns rank
 * colour, glyph and threshold, and the map, the legend and the scoring engine
 * all read it from there. A second copy here would be free to drift, and the
 * symptom of drift -- a muscle painted bronze in the map and gold in the
 * legend -- is invisible in review and obvious to a user.
 *
 * So this section is a re-export plus the design-system rules the ladder has to
 * satisfy, and `tokens.test.ts` checks `rankConfig` against those rules
 * directly rather than against a mirror of it.
 *
 * `unranked` is excluded on purpose: it is the *absence* of a rank, its fill is
 * deliberately recessive (`rankColors.ts` marks it exempt from the contrast
 * floor), and it is not a rung on the ladder.
 *
 * Two decisions make the ladder readable without colour:
 *
 * 1. Ordered by *luminance as well as hue*. Two adjacent ranks must differ in
 *    brightness, because a protanope collapsing hues still sees brightness.
 *    `tokens.test.ts` asserts a minimum luminance step between neighbours.
 * 2. `glyph` is a distinct shape per rank, so the ladder survives monochrome.
 *    The glyphs are the ones `rankConfig.ts` already ships to the badge.
 */
export { EARNABLE_RANKS as RANK_COLORS };

/** The design-system view of a rank: colour, border and glyph, no thresholds. */
export type RankColorToken = (typeof EARNABLE_RANKS)[number];
// -------------------------------------------------------------- typography

/**
 * A four-step type scale.
 *
 * `display` is for the single largest number on a screen, `title` for a section,
 * `body` for everything read in a sentence, `label` for uppercase microcopy. Four
 * steps is deliberately few: a scale with nine sizes is a scale where nothing
 * looks intentional.
 *
 * Sizes are in pixels because `tailwind.config.ts` sets a rem-based scale and
 * mixing the two units is how a "consistent" type scale drifts.
 */
export const TYPE = {
  display: { size: "32px", lineHeight: "40px", weight: 700, tracking: "-0.02em" },
  title: { size: "20px", lineHeight: "26px", weight: 600, tracking: "-0.01em" },
  body: { size: "15px", lineHeight: "22px", weight: 400, tracking: "0" },
  label: { size: "11px", lineHeight: "14px", weight: 600, tracking: "0.08em" },
} as const;

export type TypeRole = keyof typeof TYPE;

/**
 * SF/Inter stack, matching what `tailwind.config.ts` already declares.
 *
 * Listed in the same order: the system's own face first, then Inter for the web
 * build, then the generic fallbacks. Duplicated here so a token test can assert
 * the two files agree rather than letting them drift.
 */
export const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, SF Pro Text, Inter, system-ui, sans-serif";

/**
 * Tabular figures for anything numeric.
 *
 * Weights, times and volumes sit in columns that must not jitter as digits
 * change. `tabular-nums` is what stops a running clock from shifting its own
 * layout every second.
 */
export const NUMERIC = {
  /** Apply to any changing number: timers, weights, scores. */
  transform: "tabular-nums",
  /** Optical alignment for right-aligned columns of numbers. */
  align: "font-variant-numeric: tabular-nums",
} as const;

// ------------------------------------------------------------------- space

/** 4px base grid. */
export const SPACE = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
} as const;

/**
 * Corner radii.
 *
 * `card` is the 24px the glass recipe asks for; `control` is smaller because a
 * button sitting on a card needs to read as a distinct object rather than
 * blending into the card's own curve.
 */
export const RADIUS = {
  sm: "8px",
  control: "12px",
  card: GLASS.radius,
  pill: "9999px",
} as const;

// ------------------------------------------------------------------ motion

/**
 * Durations and curves as tokens.
 *
 * Motion here is one slow ease and one fast ease. A spring curve would be nicer
 * for the physical interactions, but it needs a duration and a stiffness, and
 * tuning those per component is how an app ends up with nine different feels. One
 * curve, three durations, is enough to keep the whole product coherent.
 *
 * Every consumer must gate these behind `useReducedMotion`. See `a11y.ts`.
 */
export const MOTION = {
  /** Instant acknowledgement: press, ripple, toggle. */
  fast: "120ms",
  /** State change: chip select, tab change. */
  base: "200ms",
  /** Enter and exit: sheet, modal. */
  slow: "320ms",
  /** Standard ease-out. Decelerating, so movement starts fast and settles. */
  ease: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** For opacity-only changes, where easing is invisible anyway. */
  easeLinear: "linear",
  /** Minimum tap target, per WCAG 2.5.5 and the brief. */
  minTouchTarget: "44px",
} as const;

// --------------------------------------------------------------- elevation

/**
 * Overlay stacking.
 *
 * `sticky` sits under the modals so a sheet is never occluded by a header, and
 * `toast` is above everything because a confirmation must never be hidden by the
 * thing it is confirming.
 */
export const Z_INDEX = {
  base: 0,
  sticky: 40,
  sheet: 50,
  modal: 60,
  popover: 70,
  toast: 80,
  /** The dev-only colour-blindness simulator, which must tint everything. */
  simulator: 100,
} as const;

// ---------------------------------------------------------------- css vars

/** All colour tokens, flattened. Shared by `cssVars()` and the design tests. */
export const COLOR_TOKENS = {
  "surface-base": SURFACE.base,
  "surface-raised": SURFACE.raised,
  "surface-overlay": SURFACE.overlay,
  "surface-sunken": SURFACE.sunken,

  "surface-canvas": SURFACE_ROLE.canvas,
  "surface-card": SURFACE_ROLE.card,
  "surface-popover": SURFACE_ROLE.popover,
  "surface-well": SURFACE_ROLE.well,

  "glass-fill": GLASS.fill,
  "glass-fill-raised": GLASS.fillRaised,
  "glass-border": GLASS.border,
  "glass-border-strong": GLASS.borderStrong,
  "glass-highlight": GLASS.innerHighlight,
  "glass-shadow": GLASS.shadow,

  "solid-card": SOLID.card,
  "solid-popover": SOLID.popover,
  "solid-border": SOLID.border,
  "solid-border-strong": SOLID.borderStrong,

  "text-primary": TEXT.primary,
  "text-secondary": TEXT.secondary,
  "text-tertiary": TEXT.tertiary,
  "text-disabled": TEXT.disabled,
  "text-on-accent": TEXT.onAccent,

  "accent-base": ACCENT.base,
  "accent-text": ACCENT.text,
  "accent-secondary": ACCENT.secondary,
  "accent-border": ACCENT.border,
  "accent-muted": ACCENT.muted,
  "accent-pressed": ACCENT.pressed,

  "copper-base": COPPER.base,
  "copper-text": COPPER.text,
  "copper-border": COPPER.border,
  "copper-muted": COPPER.muted,

  "danger-base": DANGER.base,
  "danger-text": DANGER.text,
  "danger-border": DANGER.border,
  "danger-muted": DANGER.muted,
  "danger-deep": DANGER.deep,

  ...Object.fromEntries(
    Object.entries(STATUS).flatMap(([name, value]) => [
      [`status-${name}`, value.base],
      [`status-${name}-text`, value.text],
      [`status-${name}-border`, value.border],
      [`status-${name}-muted`, value.muted],
    ]),
  ),

  ...Object.fromEntries(
    EARNABLE_RANKS.flatMap((rank) => [
      [`rank-${rank.id}`, rank.color],
      [`rank-${rank.id}-border`, rank.borderColor],
    ]),
  ),
} as Record<string, string>;

/**
 * Projects the tokens to CSS custom properties.
 *
 * `--cronos-` prefixed so a token can never collide with a utility class or a
 * browser default, and so `grep -- --cronos-` lists everything the design system
 * actually depends on.
 */
export function cssVars(): string {
  const lines = Object.entries(COLOR_TOKENS)
    .map(([name, value]) => `  --cronos-${name}: ${value};`)
    .join("\n");

  return `:root {\n${lines}\n}`;
}
