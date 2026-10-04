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
 * copies of one palette is how a token ends up red in TypeScript and amber in
 * CSS, and the drift is invisible until someone reads the wrong one.
 *
 * Aliases, not renames
 * --------------------
 * The redesign introduced a second name for several roles: `SURFACE.elevated`
 * beside `SURFACE.raised`, `MOTION.easeOut` beside `MOTION.ease`,
 * `TEXT.inverse` beside `TEXT.onAccent`. Both names resolve to one value rather
 * than drifting apart, and `tokens.test.ts` asserts that they do. Renaming
 * instead would have touched 24 files to change no pixel.
 *
 * Rules this palette is built to satisfy, all verified in `tokens.test.ts`:
 * - A saturated red *is* the accent. What is forbidden is a second saturated red
 *   anywhere it could be mistaken for it -- see the note on `ACCENT` below.
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
  /**
   * The redesign's name for {@link raised}. An alias, not a second shade: two names
   * for one job is what this file has been arguing against since the rank ladder.
   */
  elevated: "#0d0d10",
  /**
   * The single hairline, aliased from {@link GLASS.border}.
   *
   * The brief asked for `rgba(255, 255, 255, 0.08)` here while `GLASS.border` was
   * already 0.10. Keeping both would mean a separator is 0.08 on one screen and 0.10
   * on the next depending on which token the author reached for, so the stronger of
   * the two wins and there is one value to reason about.
   */
  border: "rgba(255, 255, 255, 0.10)",
  /** The glass fill, aliased from {@link GLASS.fill}. Same reasoning as `border`. */
  glass: "rgba(255, 255, 255, 0.06)",
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
  /**
   * The glass recipe's shadow: an inset top-edge highlight over a diffuse cast.
   *
   * The inset highlight is what sells glass as a *lit* surface rather than a dark
   * rectangle, so it is the first layer. The cast is deliberately soft and wide -- a
   * tighter shadow on a near-black card reads as a smudge rather than as elevation.
   */
  shadow: "0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 8px 32px rgba(0, 0, 0, 0.4)",
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
  primary: "#FFFFFF",
  /** Supporting copy: labels, metadata. */
  secondary: "#ABABAB",
  /**
   * Captions, units, timestamps. Still AA on every surface it is used on.
   *
   * The brief asked for `#6B6B6B`, Apple's tertiary label colour. That value lands at
   * **3.94:1** on true black and worse on the popover, under the 4.5:1 floor every other
   * tier here holds -- and this tier carries units and timestamps, the values a lifter
   * reads mid-set. So it is the coolest neutral that clears AA against the *lightest*
   * surface in the palette (the popover, 4.59:1) rather than the one that happened to
   * be checked first.
   */
  tertiary: "#808085",
  /** Inactive controls. Exempt from AA. */
  disabled: "#3D3D3D",
  /** Text on top of an accent or primary fill. */
  onAccent: "#000000",
  /** The redesign's name for {@link onAccent}. An alias, for the same reason. */
  inverse: "#000000",
} as const;

// ----------------------------------------------------------------- accents

/**
 * Cronos red is the single primary accent.
 *
 * Deliberately one hue for the whole app: an accent that changes colour per
 * screen stops reading as "this is the action" and starts reading as decoration.
 *
 * A saturated red, which the previous version of this file forbade outright. The rule
 * that forbade it was written when red was only ever a *danger* colour, and the
 * reasoning was sound: a protanope cannot reliably separate a saturated red from a dark
 * neutral, so a red error on a black card was a red smudge. Making red the accent does
 * not resurrect that problem, it relocates it -- the danger now lives in one place:
 *
 *   **A saturated red may appear once, as the accent.**
 *
 * `DANGER` and `STATUS.error` stay a desaturated wine, and `tokens.test.ts` fails the
 * build if either drifts into a saturated red or if the accent and the error wine stop
 * being distinguishable under deuteranopia and protanopia. That is a narrower and
 * stronger rule than the blanket ban it replaces: the ban could not say *how many*
 * reds are safe, only that none were.
 *
 * The measured separation, asserted in `tokens.test.ts`: the accent clears 3:1 on the
 * canvas for a non-text control and the accent's `text` tint clears 4.5:1, while the
 * lowest contrast between the accent and `STATUS.error.base` under any simulated
 * dichromacy stays above 1.15:1.
 */
export const ACCENT = {
  /** Primary action fill. Near-black ink on it clears 5.9:1. */
  base: "#FF3B30",
  /** Hover. Also the value `text` uses, though the two may diverge later. */
  hover: "#FF6961",
  /** Pressed. */
  pressed: "#D63028",
  /** Tinted background: active chips, soft fills. */
  subtle: "rgba(255, 59, 48, 0.12)",
  /** Text and icons on dark backgrounds. */
  text: "#FF6961",
  /**
   * Amber, and nothing else.
   *
   * The accent used to be amber, which meant the primary action and a warning were the
   * same hue and a coach could not tell "Guardar" from "Aviso" by colour alone. Freed
   * of that duty, amber goes back to being what it is actually good at: the one warning
   * colour. `STATUS.warning.base` resolves to this value, so there is still exactly one
   * amber in the system.
   */
  secondary: "#FF9F0A",
  /** Diffuse accent glow, for the centre action and active rings. */
  glow: "rgba(255, 59, 48, 0.20)",
  /**
   * Hairline accent border, aliased from {@link subtle}'s hue at higher opacity.
   *
   * A border has to survive against the fill behind it, which a 12% tint does not, so
   * this is a separate alpha rather than an alias of `subtle`.
   */
  border: "rgba(255, 59, 48, 0.42)",
  /** Legacy name for {@link subtle}. An alias: one tint, one value. */
  muted: "rgba(255, 59, 48, 0.12)",
  /**
   * The two-part ring around the raised centre action: a hairline plus a soft cast.
   *
   * One token because the two halves only ever appear together, and a ring drawn with
   * one alpha and a shadow drawn with another is how the "active session" pulse ended
   * up visible on an idle button.
   */
  ring: "0 0 0 1px rgba(255, 59, 48, 0.3), 0 4px 16px rgba(255, 59, 48, 0.4)",
} as const;

/**
 * Copper: the secondary accent.
 *
 * Used for tertiary emphasis and for progressive-overload "deload" advice, where
 * amber would be confused with a warning. Deliberately desaturated and darker than
 * both the red accent and the amber warning so the three stay distinguishable side by
 * side -- copper is now the only warm colour in the system that is neither the action
 * nor the warning.
 */
export const COPPER = {
  base: "#c47a4a",
  text: "#d99a72",
  border: "rgba(196, 122, 74, 0.42)",
  muted: "rgba(196, 122, 74, 0.14)",
} as const;

// ------------------------------------------------------------------ scrims

/**
 * Darkening layers: the backdrop behind a summoned surface.
 *
 * The fourth way colour is used in this app, and the only one that goes *down* instead
 * of up. `SURFACE` and `GLASS` lighten a black canvas to build layers; `DIAGRAM` stays
 * neutral to draw; a scrim darkens what is already there so that something in front of
 * it becomes the subject.
 *
 * This group exists because the modal backdrop was written out in full in two different
 * files -- `ImportWizard` and `GymSettingsModal` both said `rgba(0, 0, 0, 0.72)` -- which
 * is how two modals end up dimming their surroundings at slightly different strengths and
 * nobody notices until one of them is opened after the other.
 */
export const SCRIM = {
  /**
   * A modal's backdrop.
   *
   * 72%, not lighter: a modal has to be unambiguous about being modal. A lighter scrim
   * lets the content behind it stay legible, and a dialog the user can read the page
   * through is a dialog they will answer the wrong question on.
   */
  modal: "rgba(0, 0, 0, 0.72)",
  /**
   * A surface nested inside a dark one, which has to read as *recessed* rather than
   * lighter.
   *
   * Darkening is the only option here. The chat bubble this serves sits on the canvas, and
   * a bubble drawn with any of the white fills would be brighter than the surrounding
   * card -- which is the visual grammar for "raised", and would claim the wrong elevation.
   */
  recessed: "rgba(0, 0, 0, 0.25)",
} as const;

// ----------------------------------------------------------- illustration

/**
 * Illustration colour: the muscle map, the rest ring, the carousel's dots.
 *
 * A third category, alongside surfaces and text, and the reason this file needed one.
 * `GLASS` covers fills and the hairlines between them; none of it covers the ring on the
 * rest timer, the dot on the exercise carousel, or a region of a body. Those draw
 * something, and they were all written as inline literals.
 *
 * Named by role, and grouped as *pairs*
 * -------------------------------------
 * The muscle map is what made this a problem rather than a tidiness issue. It was drawing
 * a human body in **seven** different greys -- 0.05, 0.06, 0.07, 0.08, 0.12, 0.18 and 0.22
 * across the coach module, the map, the timer and the carousel. On a diagram where a
 * region's weight is supposed to say how much is there, seven arbitrary values means an
 * athlete cannot learn what any of them mean, because there is nothing consistent to
 * learn.
 *
 * So a region is one state, not one colour: every entry that has a fill has an edge, and
 * they are named together so that they cannot be separated. A hover that brightened the
 * fill without moving the edge would read as a different muscle rather than as the same
 * muscle being touched.
 *
 * Three of the edge values were also merged. They were 0.07, 0.08 and 0.08, which is not
 * three roles -- it is one role written three times with a rounding difference.
 *
 * Declared after `ACCENT` and `GLASS` because it reads from both. That ordering is the
 * price of a group that is composed rather than a palette of independent values, and it
 * is worth paying: a region's fill is defined *relative to* the surfaces and the accent,
 * which is the only way the relationship is visible to the next person reading it.
 */
export const DIAGRAM = {
  /**
   * An edge that is present but carries nothing: the remainder of a progress ring, an
   * inactive carousel dot, and the boundary of a muscle region with no exercises in the
   * catalog.
   */
  inert: "rgba(255, 255, 255, 0.08)",

  /**
   * A muscle region that has content in the catalog: its fill, and the edge that keeps it
   * from dissolving into the canvas.
   *
   * The fill sits between `SURFACE.raised` and `SURFACE.overlay` on purpose. A diagram
   * region cannot use a card's fill -- it is not a card and casts no shadow -- but it does
   * have to sit above the canvas, and reusing a surface value here is what would make a
   * muscle look like a panel.
   */
  regionFill: "#15151a",
  /**
   * An alias of {@link GLASS.borderStrong} rather than a second 0.18: it is the same value
   * doing the same job, and this file has spent its whole life arguing against two names
   * for one job.
   */
  regionStroke: GLASS.borderStrong,

  /**
   * A muscle region with nothing in the catalog.
   *
   * Darker than {@link regionFill} and closer to the canvas, so a region with no data
   * reads as absent rather than as empty. A region that kept the region's own fill would
   * still be outlined at {@link regionStroke}, and an outline with nothing behind it is a
   * shape, not an absence.
   */
  inertFill: "#0a0a0c",

  /** The fill an interactive region takes on hover. */
  regionHoverFill: "#2f2f38",

  /**
   * The outer boundary of a whole figure, one step above its regions.
   *
   * Separate from `regionStroke` because it is a different object: the outline of the
   * body, not the outline of a muscle. At the same weight the figure's edge would be
   * indistinguishable from the regions inside it and the diagram would lose its shape.
   */
  figureStroke: "rgba(255, 255, 255, 0.22)",

  /**
   * Selected: the accent, and nothing else.
   *
   * The one place a diagram is allowed to use the product's accent, because selection is
   * the one thing a diagram does that is an action rather than a description.
   */
  selectedFill: ACCENT.base,
  /**
   * A lighter tint of the fill rather than `ACCENT.text`, because this one has to survive
   * *on* the fill: at equal luminance the region would read as one flat silhouette with no
   * edge.
   */
  selectedStroke: ACCENT.hover,
  /**
   * The selected region's cast. Stronger than {@link ACCENT.glow} because this one has to
   * survive *behind* a saturated fill -- a 20% glow under an opaque red is invisible, so
   * the drop shadow reads as a rim rather than as a halo.
   */
  selectedGlow: "rgba(255, 59, 48, 0.75)",
  /**
   * The cast when a selected region is also hovered.
   *
   * Stronger, but the *same hue* as {@link selectedGlow}. This used to be amber at 0.9,
   * on the reasoning that a second colour would read as a second state -- but amber now
   * means warning and nothing else, so painting "you are hovering this" in the warning
   * colour puts a fourth warm meaning in the product: the accent is red, the warning is
   * amber, copper is tertiary, and now a muscle is amber. It does not need to be a
   * different hue to be distinguishable: the hovered state already forces the fill back to
   * the selection colour at `!important`, so the glow only has to be *louder*, not a
   * different colour.
   */
  selectedHoverGlow: "rgba(255, 59, 48, 0.9)",
} as const;

// -------------------------------------------------------------- destructive

/**
 * Destructive and alert: a deep, desaturated wine.
 *
 * Two deliberate departures from the obvious choice.
 *
 * It is not bright red. A saturated red is invisible to roughly 1 in 12 men, and it is
 * *also* the accent now -- which is the same confusion axis as before with a second
 * reader on it: a coach would see a red smudge and have to work out whether it was the
 * primary action or a failure. `tokens.test.ts` fails the build if a saturated red
 * reappears here, and separately if the accent and the error wine stop being
 * distinguishable under simulated dichromacy.
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
 * The brief forbids the red/green pair. These are spread across blue, amber, wine and
 * violet, and each carries an `icon` and a `shape` so the state survives being read
 * without colour:
 *
 * - success is a blue tick on a circle. Deliberately *not* green: green is the colour a
 *   deuteranope is most likely to read as the same muted yellow-brown as amber, so a
 *   green success chip beside an amber warning chip collapses.
 * - warning is an amber triangle, and amber now belongs to warning alone -- it used to
 *   double as the accent, which meant the primary action and the warning were the same
 *   hue.
 * - error is the wine diamond. Deliberately *not* a circle: a success and an error chip
 *   that differ only in colour are the exact failure this table exists to prevent, and
 *   both are common enough to sit side by side.
 * - pr (personal record) is violet, used nowhere else, because a PR is a reward and
 *   reusing the success blue would dilute both. Its star is the only star in the set, so
 *   the shape carries the meaning independently of the hue.
 *
 * Violet rather than amber for a PR is a deliberate refusal. Amber is the warning hue,
 * so a record shown in amber reads as a caution, and an athlete who just set a record
 * should not be looking at the colour they see when something is wrong.
 *
 * `text` and `muted` are pre-paired, so a component never has to combine a colour with
 * whatever background it happens to land on.
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
    /**
     * Exactly `ACCENT.secondary`, written as a value rather than referenced.
     *
     * The two are pinned together in `tokens.test.ts` instead of one pointing at the
     * other, because a status table that reads its own hue out of the accent table is a
     * status table that can no longer be read on its own.
     */
    base: "#FF9F0A",
    text: "#f7b955",
    border: "rgba(255, 159, 10, 0.45)",
    muted: "rgba(255, 159, 10, 0.14)",
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
 * A ten-step type scale, Apple's, in the order a screen reads top to bottom.
 *
 * The previous version had four. Four is not too few on purpose -- a scale with nine
 * sizes is a scale where nothing looks intentional -- but this app now has a hero
 * screen, a wizard header and a set table, and four steps meant the biggest number on a
 * screen and the label on a chip were 11px and 15px with nothing in between.
 *
 * Two things keep ten steps from becoming drift:
 *
 * 1. `title` and `label` are kept as **aliases**, not as extra steps. `title` resolves
 *    to `title2` and `label` stays the uppercase microcopy role it always was. Neither
 *    adds a distinct size to the scale.
 * 2. Every step is assigned to a *role*, not chosen by eye. A component asks for
 *    "the largest number on the screen" or "a caption"; it does not pick a px value.
 *
 * `mono` is the only step carrying its own family. Anything numeric -- weights, reps,
 * timers, volume -- uses it, because digits that change width make a column of training
 * data jitter and a running clock shift its own layout every second.
 *
 * Sizes are in pixels because `tailwind.config.ts` sets a rem-based scale and
 * mixing the two units is how a "consistent" type scale drifts.
 */
export const TYPE = {
  /** The single largest number or word on a screen. One per screen. */
  display: { size: "48px", lineHeight: "52px", weight: 700, tracking: "-0.03em" },
  /** The screen's own title: a routine name, a wizard step. */
  hero: { size: "34px", lineHeight: "40px", weight: 700, tracking: "-0.02em" },
  /** A section heading. */
  title1: { size: "28px", lineHeight: "34px", weight: 700, tracking: "-0.01em" },
  /** A subsection heading, and a card's top line. */
  title2: { size: "22px", lineHeight: "28px", weight: 600, tracking: "-0.005em" },
  /** A row's label: the left column of a set table, a list item's name. */
  headline: { size: "17px", lineHeight: "22px", weight: 600, tracking: "0" },
  /** Everything read in a sentence. */
  body: { size: "17px", lineHeight: "24px", weight: 400, tracking: "0" },
  /** Secondary prose, one step under body. */
  callout: { size: "16px", lineHeight: "21px", weight: 400, tracking: "0" },
  /** A control's own label: a button, a tab. */
  subhead: { size: "15px", lineHeight: "20px", weight: 500, tracking: "0" },
  /** Units, timestamps, anything the user may skip. */
  caption: { size: "12px", lineHeight: "16px", weight: 400, tracking: "0.02em" },
  /** Every number the user compares against another number. */
  mono: {
    size: "17px",
    lineHeight: "22px",
    weight: 600,
    tracking: "0",
    font: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
  },

  /*
   * Aliases. Both predate the scale above and both still have callers, so they resolve
   * to a step instead of being deleted -- renaming them would have touched 24 files to
   * change no pixel. `tokens.test.ts` pins `title` to `title2` so they cannot drift.
   */
  title: { size: "22px", lineHeight: "28px", weight: 600, tracking: "-0.005em" },
  /**
   * Uppercase microcopy. Deliberately *not* an alias of `caption`: it is a different
   * role (a tracked-out category label) at a different weight, and collapsing the two
   * is what would have produced the eleven-or-twelve-pixel ambiguity this scale exists
   * to remove.
   */
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

/**
 * A 4px grid with 8px aliases on top.
 *
 * The brief asks for an 8px base unit. The 4px half-steps stay, because `xs` is what
 * separates an icon from its label and an 8px grid cannot express that without making
 * every tight pair look like a mistake. What changed is the *named* steps: the redesign's
 * sizes (16/20/24/32) are now addressable by the name the layout rules use, so "card
 * padding" is `SPACE.card` rather than a literal someone typed.
 */
export const SPACE = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",

  /** Padding inside a card. The brief's floor is 16; 20 is the preference. */
  card: "20px",
  /** The gap between two sections. Never smaller than this. */
  section: "32px",
  /** Horizontal page margin. Alias per breakpoint: `gutter`, `gutterWide`. */
  gutter: "16px",
  gutterWide: "32px",
} as const;

/**
 * Corner radii, named for the object they are cut onto rather than by magnitude.
 *
 * `card` is the 24px the glass recipe asks for; `control` is smaller because a button
 * sitting on a card needs to read as a distinct object rather than blending into the
 * card's own curve.
 *
 * Two radii the brief introduced are *not* merged into these, deliberately. A 16px
 * content card and a 24px glass card are different objects -- one sits on the canvas,
 * the other is a lit panel -- and forcing them together is what makes a glass sheet look
 * like a web form. `surface` is the former, `card` the latter.
 */
export const RADIUS = {
  /** Chips and badges. */
  sm: "8px",
  /** Alias of `sm`, for the redesign's chip vocabulary. */
  chip: "8px",
  /** Large buttons. */
  control: "12px",
  /** Alias of `control`. */
  button: "12px",
  /** Numeric inputs. Smaller than a button so the two do not read as one control. */
  input: "10px",
  /** A content card sitting on the canvas. */
  surface: "16px",
  /** A glass panel. The largest radius in the system. */
  card: GLASS.radius,
  /** A bottom sheet: rounded at the top, flush with the floor it rises from. */
  sheet: "24px 24px 0 0",
  /** A centred modal. */
  modal: "20px",
  /** A circular control: the raised centre action, the FAB. */
  round: "50%",
  pill: "9999px",
} as const;

// ------------------------------------------------------------------ motion

/**
 * Durations and curves as tokens.
 *
 * The previous version had one curve and refused a spring on purpose: a spring needs a
 * duration *and* a stiffness, and tuning those per component is how an app ends up with
 * nine different feels. That reasoning still holds, so the answer was not "add a spring
 * per component" -- it was to fix one spring here, with its overshoot chosen once, and
 * let a component pick a curve by naming what the motion *is*.
 *
 * Four curves, by intent rather than by magnitude:
 * - `spring` overshoots, for something that is being picked up or confirmed.
 * - `easeOut` decelerates, for something entering the screen.
 * - `easeIn` accelerates away, for something leaving it.
 * - `standard` is the state-change curve, and the one a component should reach for when
 *   it cannot decide.
 *
 * Four durations, and the names are what the decision is, not how long it takes:
 * `instant` is tactile feedback, `fast` is a microinteraction, `normal` is a sheet or a
 * route change, `slow` is a full-screen transition.
 *
 * `ease` and `base` are kept as aliases so the 24 files that already reference them keep
 * working; `tokens.test.ts` pins both to their replacements.
 *
 * Every consumer must gate these behind `useReducedMotion`. See `a11y.ts`.
 */
const DURATION = {
  /** Tactical feedback: press, ripple, toggle. */
  instant: "80ms",
  /** A microinteraction: a chip selecting, a dot sliding. */
  fast: "150ms",
  /** A sheet or a route change. */
  normal: "250ms",
  /** A full-screen transition. */
  slow: "400ms",
} as const;

export const MOTION = {
  ...DURATION,

  /**
   * Nested alias of the durations, for call sites that read better as a group --
   * `transition: 250ms` is written next to `var(--cronos-motion-normal)` far more often
   * than the word "normal" is written on its own.
   */
  duration: DURATION,

  /** Physical: picked up, confirmed, snapped into place. Overshoots slightly. */
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  /** Entering the screen: starts fast, settles. */
  easeOut: "cubic-bezier(0.0, 0.0, 0.2, 1.0)",
  /** Leaving the screen: starts slow, accelerates away. */
  easeIn: "cubic-bezier(0.4, 0.0, 1.0, 1.0)",
  /** A state change. The curve to use when the motion does not fit the others. */
  standard: "cubic-bezier(0.4, 0.0, 0.2, 1.0)",
  /** For opacity-only changes, where easing is invisible anyway. */
  easeLinear: "linear",
  /** Minimum tap target, per WCAG 2.5.5 and the brief. */
  minTouchTarget: "44px",

  /*
   * Aliases. `ease` was the only curve the app had and `base` the only medium duration,
   * and both still have callers. They resolve to the replacements above rather than
   * keeping their old values, so a call site that was not migrated gets the new motion
   * instead of a second, older feel. `tokens.test.ts` pins both.
   */
  ease: "cubic-bezier(0.4, 0.0, 0.2, 1.0)",
  base: DURATION.normal,
} as const;

// --------------------------------------------------------------- elevation

/**
 * Overlay stacking.
 *
 * `sticky` sits under the modals so a sheet is never occluded by a header, and
 * `toast` is above everything because a confirmation must never be hidden by the
 * thing it is confirming.
 *
 * `nav` is between sticky and sheet rather than at 60 as the brief specified. A bottom
 * bar at the modal's own index would paint over a sheet, which is the one thing a sheet
 * must never be: an athlete who opens a modal from the navigation and finds the bar
 * sitting on top of it would tap the wrong control. The bar is chrome, so it ranks with
 * chrome -- above content, below anything the user summoned on purpose.
 */
export const Z_INDEX = {
  base: 0,
  sticky: 40,
  /** The bottom bar and the side nav. Above content, below every summoned surface. */
  nav: 45,
  /** A floating action button. Above the nav, so it clears the bar it sits over. */
  fab: 46,
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
  "surface-border": SURFACE.border,
  "surface-glass": SURFACE.glass,

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

  "diagram-inert": DIAGRAM.inert,
  "diagram-region-fill": DIAGRAM.regionFill,
  "diagram-region-stroke": DIAGRAM.regionStroke,
  "diagram-inert-fill": DIAGRAM.inertFill,
  "diagram-region-hover-fill": DIAGRAM.regionHoverFill,
  "diagram-figure-stroke": DIAGRAM.figureStroke,
  "diagram-selected-fill": DIAGRAM.selectedFill,
  "diagram-selected-hover-glow": DIAGRAM.selectedHoverGlow,

  "scrim-modal": SCRIM.modal,
  "scrim-recessed": SCRIM.recessed,

  "text-primary": TEXT.primary,
  "text-secondary": TEXT.secondary,
  "text-tertiary": TEXT.tertiary,
  "text-disabled": TEXT.disabled,
  "text-on-accent": TEXT.onAccent,

  "accent-base": ACCENT.base,
  "accent-hover": ACCENT.hover,
  "accent-pressed": ACCENT.pressed,
  "accent-subtle": ACCENT.subtle,
  "accent-text": ACCENT.text,
  "accent-glow": ACCENT.glow,
  "accent-ring": ACCENT.ring,
  "accent-secondary": ACCENT.secondary,
  "accent-border": ACCENT.border,
  "accent-muted": ACCENT.muted,

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
