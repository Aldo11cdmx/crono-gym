/**
 * tokens.test.ts — the design system holds itself to its own rules.
 *
 * These are not smoke tests. Each one encodes a decision that would otherwise
 * only exist as a comment, and each one is capable of failing on a future edit
 * that looks harmless in review.
 *
 * The most important one is the red policy. "Don't use red for errors" is easy to
 * agree with and easy to break three months later when someone adds an urgent
 * banner; a role-based assertion makes that impossible to ship silently -- and now
 * that red *is* the accent, the rule has to be about how many reds there are rather
 * than about whether any of them are allowed.
 */

import { describe, expect, it } from "vitest";
import {
  AA_CONTRAST,
  AA_LARGE_CONTRAST,
  CVD_DISTINGUISHABLE_DELTA_E,
  CVD_KINDS,
  contrastRatio,
  contrastRatioUnderCvd,
  cvdDeltaE,
  flatten,
  isSaturatedRed,
  parseColor,
  rgbToHsl,
  redPolicyFor,
  simulateCvd,
  toHex,
} from "./color";
import {
  ACCENT,
  COLOR_TOKENS,
  COPPER,
  DANGER,
  DIAGRAM,
  FOCUS,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SOLID,
  STATUS,
  SURFACE,
  SURFACE_ROLE,
  TEXT,
  TYPE,
  Z_INDEX,
  cssVars,
  stateRules,
} from "./tokens";
import { designTokensCss } from "./installDesignTokens";
import tailwind from "../../tailwind.config";

/**
 * The rank ladder is read from `rankConfig`, not from `tokens`.
 *
 * `rankConfig.ts` is the single source of truth for rank colour, glyph and
 * threshold, so testing a *re-export* of it would assert that a file agrees with
 * itself. Reading the ladder here from the module that actually owns it means
 * these rules are checked against the values the app ships.
 */
import { EARNABLE_RANKS } from "../lib/ranks/rankConfig";
import { LOGO_GRADIENT } from "./logoGradient";

/**
 * Every component source file, read as text, so the type scale can be checked for leaks.
 *
 * `?raw` rather than `node:fs`, and `?raw` rather than a plain eager glob, which is the
 * obvious tool and is wrong twice. A plain `import.meta.glob(..., { eager: true })`
 * *executes* every matched module, which pulls `router.tsx` in -- and that calls
 * `createBrowserRouter` at module scope and throws outside a DOM. A check for a token
 * leak must not run the code it is checking. `node:fs` would work at runtime, but the
 * project has no `@types/node` on purpose: its tsconfig is browser-only, and adding
 * node types would let any file quietly import a node API it cannot use in a bundle.
 *
 * `.test.tsx` is excluded on purpose: a test asserting on a literal font size is
 * asserting on the implementation, and this rule is about production code only.
 */
const COMPONENT_SOURCES = import.meta.glob("../**/*.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/**
 * Sources written by another task and not yet adopted onto the scale.
 *
 * Each entry is a file whose owner is mid-change, not a permanent exception. They are
 * listed individually rather than excluded by pattern so that a *new* literal anywhere
 * still fails: the moment these three are migrated the entry is deleted and the rule
 * covers the whole tree again.
 */
const IN_FLIGHT_SOURCES: readonly string[] = [
  "../components/coach/CoachFloatingButton.tsx",
  "../components/coach/RoutineGeneratorWizard.tsx",
  "../components/coach/SymmetryBottomSheet.tsx",
];

/**
 * Every `fontSize: <number>` literal outside production code, as `path:line  text`.
 */
function fontSizeLiterals(): string[] {
  const offenders: string[] = [];
  for (const path of Object.keys(COMPONENT_SOURCES).sort()) {
    if (path.endsWith(".test.tsx")) continue;
    if (IN_FLIGHT_SOURCES.includes(path)) continue;
    COMPONENT_SOURCES[path]
      .split("\n")
      .forEach((text: string, index: number) => {
        if (/fontSize:\s*\d/.test(text)) {
          offenders.push(`${path}:${index + 1}  ${text.trim()}`);
        }
      });
  }
  return offenders;
}

/**
 * Strips comments before a source is searched for colour literals.
 *
 * Without this the guards below read their own documentation: this file's prose quotes
 * the alphas it removed on purpose, and a rule that fails because a comment explains the
 * rule is a rule people turn off.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every inline white alpha in production code, as `path:line  text`. */
function inlineWhiteAlphas(): string[] {
  const offenders: string[] = [];
  for (const path of Object.keys(COMPONENT_SOURCES).sort()) {
    if (path.endsWith(".test.tsx")) continue;
    if (IN_FLIGHT_SOURCES.includes(path)) continue;
    stripComments(COMPONENT_SOURCES[path])
      .split("\n")
      .forEach((text: string, index: number) => {
        if (/rgba\(\s*255,\s*255,\s*255,/.test(text)) {
          offenders.push(`${path}:${index + 1}  ${text.trim()}`);
        }
      });
  }
  return offenders;
}

/** Every inline `#rrggbb` literal in production code, as `path:line  text`. */
function inlineHexColours(): string[] {
  const offenders: string[] = [];
  for (const path of Object.keys(COMPONENT_SOURCES).sort()) {
    if (path.endsWith(".test.tsx")) continue;
    if (IN_FLIGHT_SOURCES.includes(path)) continue;
    stripComments(COMPONENT_SOURCES[path])
      .split("\n")
      .forEach((text: string, index: number) => {
        if (/#[0-9a-fA-F]{6}\b/.test(text) && !/from\s+"/.test(text)) {
          offenders.push(`${path}:${index + 1}  ${text.trim()}`);
        }
      });
  }
  return offenders;
}

/**
 * Every `rgba()` literal in production code, of any hue.
 *
 * The white-only version of this rule was not enough, and it took two defects slipping
 * through it to see why: a muscle's selected glow at `rgba(255, 59, 48, 0.75)` and a
 * hovered selection at `rgba(255, 159, 10, 0.9)`. Both are accent hues, so neither looks
 * like a stray grey, and a rule that only watches for greys would have watched them walk
 * past. Colour is one system; the guard has to be too.
 */
function inlineRgbaColours(): string[] {
  const offenders: string[] = [];
  for (const path of Object.keys(COMPONENT_SOURCES).sort()) {
    if (path.endsWith(".test.tsx")) continue;
    if (IN_FLIGHT_SOURCES.includes(path)) continue;
    stripComments(COMPONENT_SOURCES[path])
      .split("\n")
      .forEach((text: string, index: number) => {
        if (/rgba\(/.test(text)) {
          offenders.push(`${path}:${index + 1}  ${text.trim()}`);
        }
      });
  }
  return offenders;
}

/**
 * Every motion literal in production code: a raw duration or a raw curve.
 *
 * Motion is the one design system that had no guard at all, and it drifted the way colour
 * did before it: a muscle diagram crossfading at `140ms ease`, a skeleton pulsing at
 * `1.6s ease-in-out`, both correct-looking and neither reachable from `MOTION`. `140ms` in
 * particular is nobody's decision -- it is not `fast`, it is not `normal`, and it is close
 * enough to `fast` that nobody would notice it as wrong.
 *
 * The pattern is chosen to catch the *value* rather than the property, so `transition` and
 * `animation` are both covered, and both the `ms`/`s` and the keyword forms:
 * - `\d+ms` and `\d+(\.\d+)?s` catch durations, including the loop periods.
 * - `cubic-bezier(` catches curves written out.
 * - The keyword list catches the curves Tailwind and CSS reach for by name, which are
 *   what `tailwind.config.ts` used to carry.
 *
 * `MOTION.ease` and `MOTION.base` are not matched by any of these -- they are the retired
 * aliases, and the separate test below pins their call-site count to zero.
 */
function motionLiterals(): string[] {
  const offenders: string[] = [];
  const DURATION = /\b\d+(?:\.\d+)?m?s\b/;
  const CURVE = /\bcubic-bezier\s*\(|\bease-in-out\b|\bease-out\b|\bease-in\b|\blinear\b/;

  for (const path of Object.keys(COMPONENT_SOURCES).sort()) {
    if (path.endsWith(".test.tsx")) continue;
    if (IN_FLIGHT_SOURCES.includes(path)) continue;
    stripComments(COMPONENT_SOURCES[path])
      .split("\n")
      .forEach((text: string, index: number) => {
        // A CSS custom property name is not a duration.
        if (/--cronos-/.test(text)) return;
        if (DURATION.test(text) || CURVE.test(text)) {
          offenders.push(`${path}:${index + 1}  ${text.trim()}`);
        }
      });
  }
  return offenders;
}

/**
 * The alpha channel of a `rgba()` string.
 *
 * `parseColor` deliberately drops alpha and returns channels only, because everything
 * that uses it wants the colour and not how transparent it is. Ordering three strokes by
 * weight is the one thing here that does want the alpha, so it reads the string.
 */
function alphaOf(colour: string): number {
  const match = colour.match(/rgba\([^,]+,\s*[^,]+,\s*[^,]+,\s*([\d.]+)\s*\)/);
  if (!match) throw new Error(`no alpha in ${colour}`);
  return Number.parseFloat(match[1]);
}

// ------------------------------------------------------------- the red policy

describe("a saturated red is the accent, and only the accent", () => {
  it("rejects the saturated reds this rule was written for", () => {
    // The colour the rank ladder used to ship as "Élite", and the Tailwind red
    // currently scattered across error states. Both must be caught.
    expect(isSaturatedRed("#fb7185")).toBe(true);
    expect(isSaturatedRed("#ef4444")).toBe(true);
    expect(isSaturatedRed("#ff0000")).toBe(true);
    expect(isSaturatedRed("hsl(0, 90%, 50%)")).toBe(true);
    expect(isSaturatedRed("hsl(352, 80%, 50%)")).toBe(true);
  });

  it("allows red hues that are desaturated, since those are not the risk", () => {
    // A warm grey has a red hue and is not a red-green confusion problem.
    expect(isSaturatedRed("#3f3f46")).toBe(false);
    expect(isSaturatedRed("#8b7355")).toBe(false);
    expect(isSaturatedRed("hsl(0, 20%, 50%)")).toBe(false);
  });

  it("allows saturated colours outside the red arcs", () => {
    // Orange at 30 degrees is where the Bronze rank and the amber warning live.
    expect(isSaturatedRed(STATUS.progression.base)).toBe(false);
    expect(isSaturatedRed("#c2660a")).toBe(false);
    expect(isSaturatedRed(STATUS.success.base)).toBe(false);
    expect(isSaturatedRed(EARNABLE_RANKS[0].color)).toBe(false);
  });

  it("agrees with itself about which accent shades are exempt", () => {
    // Documents the size of the exemption: the accent's fill, hover and text tints are
    // all saturated reds on purpose.
    expect(redPolicyFor(ACCENT.base, "accent")).toBe(false);
    expect(redPolicyFor(ACCENT.hover, "accent")).toBe(false);
    expect(redPolicyFor(ACCENT.text, "accent")).toBe(false);
  });

  it("keeps the accent's pressed state a darker red, not a different one", () => {
    /*
     * `pressed` is a saturated red on purpose -- it is the same hue as the fill, held down
     * -- so what has to hold is that it stays *perceivable* as the same control. Two
     * accident-prone edits are caught here: warming it toward orange, which would make a
     * finger-down state read as a different button, and lightening it, which would make
     * the press read as a hover and tell the athlete the tap registered when it did not.
     */
    expect(isSaturatedRed(ACCENT.pressed)).toBe(true);
    expect(redPolicyFor(ACCENT.pressed, "accent")).toBe(false);
    expect(contrastRatio(ACCENT.pressed, ACCENT.base)).toBeGreaterThan(1.15);
    const { h } = rgbToHsl(parseColor(ACCENT.pressed)!);
    const baseHue = rgbToHsl(parseColor(ACCENT.base)!).h;
    // Within a few degrees: same hue, less light.
    expect(Math.abs(h - baseHue)).toBeLessThan(5);
  });

  it("contains no saturated red in any status, rank, copper or destructive token", () => {
    const entries = [
      ...Object.values(STATUS).flatMap((s) => [s.base, s.text, s.border, s.muted]),
      ...EARNABLE_RANKS.flatMap((r) => [r.color, r.borderColor]),
      COPPER.base,
      COPPER.text,
      DANGER.base,
      DANGER.text,
      DANGER.deep,
    ];

    const violations = entries.filter((value) => redPolicyFor(value, "status"));
    expect(violations).toEqual([]);
  });

  it("treats the destructive colour as wine, not red", () => {
    // Guards the intent behind the choice: if someone "simplifies" DANGER to a
    // stock red token this is the assertion that explains why not. This is load-bearing
    // now rather than merely tidy: with a red accent, a red error would be the one
    // thing on screen a coach could not tell from the primary action.
    expect(redPolicyFor(DANGER.base, "destructive")).toBe(false);
    expect(isSaturatedRed(DANGER.base)).toBe(false);
    const { h, s } = rgbToHsl(parseColor(DANGER.base)!);
    // el arco rojo ocupa 345-360 y 0-15
    expect(h < 15 || h > 345).toBe(true);
    // Deep and desaturated: readable, and unmistakably not an alert siren.
    expect(s).toBeLessThan(0.6);
  });

  it("keeps the error wine separable from the accent under every deficiency", () => {
    /*
     * The compensation for allowing a saturated red at all. A protanope reads the red
     * accent and the wine error as two shades of the same brown, so this asserts they
     * stay far enough apart once the hue is taken away -- which is exactly the failure a
     * contrast ratio measured with full colour vision cannot see.
     */
    for (const kind of CVD_KINDS) {
      const ratio = contrastRatioUnderCvd(ACCENT.base, STATUS.error.base, kind);
      expect(ratio, `accent vs error under ${kind}: ${ratio.toFixed(3)}:1`).toBeGreaterThan(
        1.15,
      );
    }
  });

  it("keeps the accent's own shades from collapsing into each other", () => {
    // The adjacent failure: an accent whose fill and hover stop being distinguishable
    // is a button that looks stuck down.
    expect(cvdDeltaE(ACCENT.base, ACCENT.hover, "deuteranopia")).toBeGreaterThan(
      CVD_DISTINGUISHABLE_DELTA_E,
    );
  });
});

// --------------------------------------------------- Cronos red, measured

describe("the red accent meets the contrast floors it is used at", () => {
  it("ACCENT.base clears 3:1 on the canvas, which is the non-text floor", () => {
    // A control boundary has to be perceivable without reading it. Measured, this is
    // 5.92:1 -- past the 3:1 floor and close to the 4.5:1 a text fill would need, which
    // is why `TEXT.onAccent` is near-black on it rather than white.
    expect(contrastRatio(ACCENT.base, SURFACE.base)).toBeGreaterThanOrEqual(
      AA_LARGE_CONTRAST,
    );
  });

  it("ACCENT.text clears 4.5:1 on the canvas, because it carries text", () => {
    // The brief quotes 5.2:1 for this tint; measured, it is 7.45:1. The assertion is the
    // floor rather than the quote, so a future darkening has to be a deliberate decision.
    expect(contrastRatio(ACCENT.text, SURFACE.base)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("ACCENT.secondary is not ACCENT.text, because amber and red are different jobs", () => {
    /*
     * The inverse of a test this file used to have. Amber used to *be* the accent, so
     * "the accent's text tint" and "the emphasis tint" were the same colour and pinning
     * them together stopped them drifting apart. Now amber means warning and the accent's
     * text tint is a light red, so the assertion is that they never collapse back into one
     * colour: an athlete who cannot tell a warning from an action label is being asked to
     * make a safety decision from a hue.
     */
    expect(ACCENT.secondary).not.toBe(ACCENT.text);
    expect(ACCENT.secondary).toBe(STATUS.warning.base);
  });

  it("puts dark ink on the accent fill, since red is far too dark for white", () => {
    // White on this red would be legible and would still look like a sticker rather than
    // a label, which is the cheaper of the two problems to avoid.
    expect(contrastRatio(TEXT.onAccent, ACCENT.base)).toBeGreaterThanOrEqual(AA_CONTRAST);
    expect(contrastRatio("#FFFFFF", ACCENT.base)).toBeLessThan(
      contrastRatio(TEXT.onAccent, ACCENT.base),
    );
  });
});

// ------------------------------------------------- tokens vs. Tailwind config

describe("the Tailwind config does not drift from the tokens", () => {
  /**
   * `tailwind.config.ts` has to repeat the palette because Tailwind cannot read a
   * TypeScript module. That makes it a hand-maintained second copy, and a second
   * copy is exactly how an accent ends up amber in a utility class and a slightly
   * different amber in a token -- invisible until someone compares the two.
   *
   * So the copy is checked instead of trusted.
   */
  it("uses ACCENT.base for the accent utility", () => {
    expect(tailwind.theme.extend.colors.accent.DEFAULT).toBe(ACCENT.base);
  });

  it("uses ACCENT.muted for the accent tint utility", () => {
    expect(tailwind.theme.extend.colors.accent.muted).toBe(ACCENT.muted);
  });

  it("keeps the neutral 950 the OLED surface depends on at true black", () => {
    // Not a cosmetic value: `body` paints `bg-neutral-950`, and anything lighter
    // means the pixels stay lit on an OLED panel.
    expect(tailwind.theme.extend.colors.neutral[950]).toBe(SURFACE.base);
  });

  it("keeps the neutral 50 the body copy reads at the primary text token", () => {
    expect(tailwind.theme.extend.colors.neutral[50]).toBe(TEXT.primary);
  });

  it("does not use the warning amber as the primary text tint", () => {
    /*
     * The inverse of a test this file used to have, which asserted that `ACCENT.text` and
     * `ACCENT.secondary` were *identical* and warned against anyone "making the emphasis
     * slightly warmer". That was the right rule when both were amber and meant the same
     * thing. They mean different things now, so the rule is that they stay apart: the
     * two-hour-session warning in `ActiveWorkoutPill` reads `ACCENT.secondary` because it
     * is a warning, and a session-warning chip that renders in the accent's text red would
     * read as "keep training" instead of "you have been going two hours".
     */
    expect(ACCENT.text).not.toBe(ACCENT.secondary);
    expect(COLOR_TOKENS["accent-secondary"]).toBe(ACCENT.secondary);
  });
});

// ------------------------------------------------------------------ contrast

describe("text clears WCAG AA on every surface it is used on", () => {
  const surfaces = [
    ["canvas", SURFACE.base],
    ["card", SURFACE.raised],
    ["popover", SURFACE.overlay],
    ["well", SURFACE.sunken],
  ] as const;

  const tiers = ["primary", "secondary", "tertiary"] as const;

  for (const tier of tiers) {
    for (const [surfaceName, surface] of surfaces) {
      it(`${tier} on ${surfaceName} is at least ${AA_CONTRAST}:1`, () => {
        const ratio = contrastRatio(TEXT[tier], surface);
        expect(
          ratio,
          `${tier} (${TEXT[tier]}) sobre ${surfaceName} (${surface}): ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_CONTRAST);
      });
    }
  }

  it("keeps disabled text dimmer than tertiary, as an inactive control should", () => {
    // WCAG 1.4.3 exempts inactive controls from the contrast minimum, but they
    // must still read as disabled rather than as broken.
    expect(contrastRatio(TEXT.disabled, SURFACE.base)).toBeLessThan(
      contrastRatio(TEXT.tertiary, SURFACE.base),
    );
  });

  /*
   * The accent's own ink is asserted in "the red accent meets the contrast floors it is
   * used at" above, where the reason it is near-black rather than white is written down.
   * It used to live here, and used to assert that white *failed* against amber. That
   * assertion is gone rather than inverted: the red fill takes white at 5.92:1, so white
   * is legible on it now, and the reason to stay on dark ink is that white on a fill
   * this saturated reads as a sticker rather than as a label.
   */

  it("keeps every status label readable on the canvas", () => {
    for (const [name, status] of Object.entries(STATUS)) {
      const ratio = contrastRatio(status.text, SURFACE.base);
      expect(ratio, `${name} (${status.text}): ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_CONTRAST,
      );
    }
  });

  it("keeps every status label readable on its own muted background", () => {
    // The real risk: a tinted chip is where a status colour usually fails,
    // because the background is the status colour at low alpha, not the canvas.
    for (const [name, status] of Object.entries(STATUS)) {
      const background = flatten(status.muted, SURFACE.base);
      const ratio = contrastRatio(status.text, background);
      expect(
        ratio,
        `${name} (${status.text}) sobre su fondo (${background}): ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });
});

// --------------------------------------------------------------------- glass

describe("the glass recipe survives being composited", () => {
  it("keeps a glass border detectable as a lighter edge, without holding it to 3:1", () => {
    // 3:1 is WCAG 1.4.11, and 1.4.11 governs a boundary that *carries* meaning:
    // the edge of a control the user has to find. A 10% white hairline between a
    // card and the page is decoration -- the card is already defined by its fill
    // and its radius -- and holding it to 3:1 would mean shipping a grey box
    // outline that fights the glass it belongs to.
    //
    // What it does have to do is register as lighter than the canvas at all,
    // otherwise the recipe collapses into a flat black screen.
    const composited = flatten(GLASS.border, SURFACE.base);
    expect(composited).not.toBe(SURFACE.base);
    expect(contrastRatio(composited, SURFACE.base)).toBeGreaterThan(1.05);
  });

  it("keeps a glass fill distinguishable from the canvas", () => {
    const composited = flatten(GLASS.fill, SURFACE.base);
    expect(composited).not.toBe(SURFACE.base);
    expect(contrastRatio(composited, SURFACE.base)).toBeGreaterThan(1.05);
  });

  it("offers a solid fallback that is a visible step off the canvas", () => {
    // Without this, a user on `prefers-reduced-transparency` sees every card
    // vanish into a flat black screen.
    expect(contrastRatio(SOLID.card, SURFACE.base)).toBeGreaterThan(1.05);
    expect(contrastRatio(flatten(SOLID.border, SURFACE_ROLE.card), SOLID.card)).toBeGreaterThanOrEqual(
      // separador decorativo entre superficies, no control interactivo (WCAG 1.4.11 no aplica)
      1.1,
    );
  });

  it("uses the large radius the brief asks for, within its 20-28px range", () => {
    const px = Number.parseFloat(GLASS.radius);
    expect(px).toBeGreaterThanOrEqual(20);
    expect(px).toBeLessThanOrEqual(28);
  });
});

// --------------------------------------------------------------------- ranks

describe("the rank ladder is readable without colour", () => {
  it("gives every rank a distinct glyph", () => {
    const glyphs = EARNABLE_RANKS.map((r) => r.glyph);
    expect(new Set(glyphs).size).toBe(EARNABLE_RANKS.length);
  });

  it("uses a distinct glyph shape, not just a distinct character", () => {
    // A hue-blind user reads the glyph. If two ranks share a glyph family the
    // ladder stops being readable in monochrome, so compare shape classes.
    const shapes = EARNABLE_RANKS.map((r) => shapeOf(r.glyph));
    expect(new Set(shapes).size).toBe(EARNABLE_RANKS.length);
  });

  it("separates neighbours by luminance, not only by hue", () => {
    // The core colour-blindness rule. Two adjacent ranks must differ in
    // brightness, because that difference survives a collapsed hue axis.
    for (let i = 1; i < EARNABLE_RANKS.length; i += 1) {
      const previous = relativeLuminanceOf(EARNABLE_RANKS[i - 1].color);
      const current = relativeLuminanceOf(EARNABLE_RANKS[i].color);
      const step = Math.abs(previous - current);
      expect(
        step,
        `${EARNABLE_RANKS[i - 1].id} -> ${EARNABLE_RANKS[i].id}: Δluminance ${step.toFixed(3)}`,
      ).toBeGreaterThan(0.04);
    }
  });

  it("separates adjacent ranks under every colour vision deficiency", () => {
    // Adjacent pairs only, and that is a deliberate limit rather than a
    // convenient one. Seven hues cannot be pairwise separable through three
    // dichromacies at once -- the gamut a deuteranope sees is one-dimensional, so
    // any all-pairs threshold is either satisfied by a palette of near-neutrals
    // that reads as seven shades of grey, or unsatisfiable at all. What the map
    // actually has to survive is the pair a user is *comparing*: the two ranks
    // that meet on a legend or a leaderboard, which is always consecutive.
    //
    // Non-adjacent ranks are carried by glyph and by the Spanish label instead,
    // which is why both exist.
    //
    // Measured in Lab rather than by WCAG contrast: contrast is a luminance
    // metric, so it cannot see hue at all and calls Gold and Platinum the same
    // colour at 1.09:1. `ranksEngine.test.ts` covers every pair, which is possible
    // there because it also asserts the glyphs are distinct.
    for (const kind of CVD_KINDS) {
      for (let i = 1; i < EARNABLE_RANKS.length; i += 1) {
        const distance = cvdDeltaE(
          EARNABLE_RANKS[i - 1].color,
          EARNABLE_RANKS[i].color,
          kind,
        );
        expect(
          distance,
          `${kind}: ${EARNABLE_RANKS[i - 1].id} vs ${EARNABLE_RANKS[i].id}: ΔE ${distance.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(CVD_DISTINGUISHABLE_DELTA_E);
      }
    }
  });

  it("keeps the top rank's ring visible against the canvas", () => {
    // `rankConfig` draws Obsidiana as a violet fill with a lighter stroke rather
    // than as a near-black core inside a bright ring, so the requirement here is
    // the one that actually applies to a stroke: it has to be locatable against
    // the canvas. WCAG 1.4.11 non-text floor, not the text one.
    const obsidian = EARNABLE_RANKS.find((r) => r.id === "obsidian")!;
    expect(contrastRatio(obsidian.borderColor, SURFACE.base)).toBeGreaterThanOrEqual(
      AA_LARGE_CONTRAST,
    );
  });

  it("keeps a readable label on every rank fill", () => {
    for (const rank of EARNABLE_RANKS) {
      const fill = rank.color;
      const onDark = contrastRatio(TEXT.primary, fill);
      const onLight = contrastRatio(TEXT.onAccent, fill);
      expect(
        Math.max(onDark, onLight),
        `${rank.id}: ${Math.max(onDark, onLight).toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });
});

// ------------------------------------------------------------------- status

describe("status states are separable without colour", () => {
  it("gives every status a distinct icon and a distinct shape", () => {
    const shapes = Object.values(STATUS).map((s) => s.shape);
    expect(new Set(shapes).size).toBe(Object.keys(STATUS).length);
  });

  it("labels every status in text, so state never depends on colour alone", () => {
    for (const [name, status] of Object.entries(STATUS)) {
      expect(status.label.length, `${name} sin etiqueta`).toBeGreaterThan(0);
    }
  });

  it("separates success from warning under deuteranopia", () => {
    // The specific failure the brief calls out: a green tick beside an amber
    // triangle. Blue vs amber survives; green vs amber does not.
    const ratio = contrastRatioUnderCvd(
      STATUS.success.base,
      STATUS.warning.base,
      "deuteranopia",
    );
    expect(ratio).toBeGreaterThan(1.15);
  });

  it("separates error from pr, the two most similar hues", () => {
    const ratio = contrastRatioUnderCvd(STATUS.error.base, STATUS.pr.base, "deuteranopia");
    expect(ratio).toBeGreaterThan(1.15);
  });

  it("does not use green for success anywhere in the token set", () => {
    // Green is the specific colour this product refuses, and this is the
    // assertion that keeps a future "success = green, surely?" from landing.
    const green = { h: 120, s: 0.6 };
    for (const [name, value] of Object.entries(COLOR_TOKENS)) {
      const rgb = parseColor(value);
      if (!rgb) continue;
      const { h, s } = rgbToHsl(rgb);
      if (s < green.s) continue;
      expect(Math.min(Math.abs(h - green.h), 360 - Math.abs(h - green.h)), name).toBeGreaterThan(
        25,
      );
    }
  });
});

// --------------------------------------------- progression / comeback statuses

describe("the overload statuses are separable without colour", () => {
  it("defines progression with a base, a text colour and a tint", () => {
    expect(STATUS.progression.base).toMatch(/^#[0-9a-f]{6}$/i);
    expect(STATUS.progression.text).toMatch(/^#[0-9a-f]{6}$/i);
    expect(STATUS.progression.muted).toMatch(/^rgba\(/);
  });

  it("defines comeback with a base, a text colour and a tint", () => {
    expect(STATUS.comeback.base).toMatch(/^#[0-9a-f]{6}$/i);
    expect(STATUS.comeback.text).toMatch(/^#[0-9a-f]{6}$/i);
    expect(STATUS.comeback.muted).toMatch(/^rgba\(/);
  });

  it("finds progression on a true-black canvas under every deficiency", () => {
    // The rationale for cyan instead of green: green folds into `warning` under
    // deuteranopia, and these two sit on the same card.
    for (const kind of CVD_KINDS) {
      expect(
        contrastRatioUnderCvd(STATUS.progression.text, SURFACE.base, kind),
        kind,
      ).toBeGreaterThan(1.15);
    }
  });

  it("finds comeback on a true-black canvas under every deficiency", () => {
    for (const kind of CVD_KINDS) {
      expect(contrastRatioUnderCvd(STATUS.comeback.text, SURFACE.base, kind), kind).toBeGreaterThan(
        1.15,
      );
    }
  });

  it("separates progression from comeback, the two cool statuses", () => {
    // They are both light cyan-blue and sit at close luminance, so this is the
    // assertion that makes their shapes (chevron vs flag) necessary rather than
    // merely decorative.
    for (const kind of CVD_KINDS) {
      expect(
        contrastRatioUnderCvd(STATUS.progression.text, STATUS.comeback.text, kind),
        kind,
      ).toBeGreaterThan(1.15);
    }
  });

  it("does not reuse a shape already claimed by another status", () => {
    // The existing suite already asserts global shape uniqueness; this names the
    // risk explicitly, because a new status added next quarter is the moment a
    // shape gets copied rather than invented.
    const shapes = Object.values(STATUS).map((s) => s.shape);
    expect(new Set(shapes).size).toBe(Object.keys(STATUS).length);
  });
});

// ------------------------------------------------------------- CVD simulator

describe("the colour vision simulator produces plausible output", () => {
  it("leaves greys almost untouched, since deficiency is about hue", () => {
    // A simulator that shifts greys is visibly wrong to the user looking at it,
    // and would make every previewed screen look broken.
    for (const kind of CVD_KINDS) {
      const simulated = simulateCvd("#808080", kind);
      const rgb = parseColor(simulated)!;
      expect(Math.abs(rgb.r - rgb.g)).toBeLessThan(12);
      expect(Math.abs(rgb.g - rgb.b)).toBeLessThan(12);
    }
  });

  it("collapses a red/green pair under deuteranopia, which is the point", () => {
    // If this test ever fails the simulator is broken and the dev preview is
    // lying to the developer.
    const ratio = contrastRatioUnderCvd("#d93025", "#1e8e3e", "deuteranopia");
    expect(ratio).toBeLessThan(contrastRatio("#d93025", "#1e8e3e"));
  });

  it("keeps an achromatic surface achromatic", () => {
    expect(simulateCvd(SURFACE.base, "protanopia")).toBe("#000000");
  });
});

// -------------------------------------------------------- type, motion, vars

describe("the rest of the token set", () => {
  it("gives every type role a line height that suits its size", () => {
    for (const [role, value] of Object.entries(TYPE)) {
      const size = Number.parseFloat(value.size);
      const line = Number.parseFloat(value.lineHeight);
      expect(line, `${role}: ${line}/${size}`).toBeGreaterThanOrEqual(size);

      /*
       * Two floors rather than one, because one ratio cannot serve both sizes.
       *
       * The absolute floor is 3px of extra leading at every size: enough that an
       * accented descender ("í", "ñ") has somewhere to go.
       *
       * The relative floor only applies at reading sizes. Under ~1.2 a line clips the
       * ascender of the line above, and at 12px that is a real collision. At 48px the
       * same 1.2 would demand a 58px line box for a headline that is the only line on
       * the screen, which is not a clipping problem -- it is wasted space. So the large
       * steps are held to the absolute floor and the reading steps to the ratio.
       */
      expect(line - size, `${role} leading`).toBeGreaterThanOrEqual(3);
      if (size <= 24) {
        expect(line / size, `${role} ratio`).toBeGreaterThan(1.2);
      }
    }
  });

  it("orders the type scale from largest to smallest", () => {
    /*
     * The nine *sizes*, not `Object.values(TYPE)`. Two entries are aliases -- `title`
     * resolves to `title2`, and `label` is a role rather than a step -- and `mono` re-uses
     * an existing size with a different family, so none of the three belongs in a walk
     * that asserts the sizes descend.
     */
    const steps = [
      TYPE.display,
      TYPE.hero,
      TYPE.title1,
      TYPE.title2,
      TYPE.headline,
      TYPE.body,
      TYPE.callout,
      TYPE.subhead,
      TYPE.caption,
    ];

    for (let i = 1; i < steps.length; i += 1) {
      const previous = Number.parseFloat(steps[i - 1].size);
      const current = Number.parseFloat(steps[i].size);
      expect(current, `${current}px after ${previous}px`).toBeLessThanOrEqual(previous);

      /*
       * Two steps may share a size -- `headline` and `body` are both 17px -- but then they
       * have to be told apart by weight or line height, or they are the same step written
       * twice and a component picking between them is picking a name, not a look.
       */
      if (current === previous) {
        expect(
          steps[i].weight !== steps[i - 1].weight ||
            steps[i].lineHeight !== steps[i - 1].lineHeight,
          `${current}px appears twice with the same weight and leading`,
        ).toBe(true);
      }
    }
  });

  it("keeps the legacy type names pointing at a step, not at a value of their own", () => {
    // These two are the reason the scale can grow without a 24-file rename.
    expect(TYPE.title).toEqual(TYPE.title2);
    // `label` is the one deliberate exception: uppercase microcopy is a role of its own,
    // not a size, and collapsing it into `caption` is what produced the eleven-or-twelve
    // pixel ambiguity this scale exists to remove.
    expect(TYPE.label.size).not.toBe(TYPE.caption.size);
  });

  it("gives every number the user compares a monospaced step to be read in", () => {
    // Weights, reps, timers and volumes all change while they are on screen. A step
    // without `tabular-nums` shifts its own layout every time a digit changes, which is
    // why `mono` carries a family and the rest do not.
    expect(TYPE.mono.font).toContain("monospace");
    for (const role of ["display", "hero", "title1", "body", "caption"] as const) {
      expect(TYPE[role], `${role} must not hardcode a family`).not.toHaveProperty("font");
    }
  });

  it("meets the 44px minimum touch target the brief requires", () => {
    expect(Number.parseFloat(MOTION.minTouchTarget)).toBeGreaterThanOrEqual(44);
  });

  it("keeps every motion duration short enough to feel responsive", () => {
    // `Object.values(MOTION)` would include the nested `duration` object and the curve
    // strings, so this walks the named durations rather than the whole map.
    for (const name of ["instant", "fast", "normal", "slow", "base"] as const) {
      const ms = Number.parseFloat(MOTION[name]);
      expect(ms, `${name} is not a duration`).toBeGreaterThan(0);
      // Past ~400ms an interface stops feeling like it responded to the tap.
      expect(ms, `${name}`).toBeLessThanOrEqual(400);
    }
  });

  it("names each motion curve by what it does, and keeps the aliases pointing at them", () => {
    // `spring` is the curve this file used to argue against on the grounds that a spring
    // needs a stiffness as well as a duration. The answer was to fix one spring here
    // rather than to let components tune their own, so the argument is now checkable:
    // exactly one spring exists, and it overshoots.
    const curves = [MOTION.spring, MOTION.easeOut, MOTION.easeIn, MOTION.standard];
    expect(new Set(curves).size).toBe(4);
    // A cubic-bezier overshoots when its second control point is above 1.
    const springControl = Number.parseFloat(MOTION.spring.split(",")[1].trim());
    expect(springControl).toBeGreaterThan(1);
    for (const curve of curves) {
      expect(curve, `not a cubic-bezier: ${curve}`).toMatch(
        /^cubic-bezier\(-?[\d.]+,\s*-?[\d.]+,\s*-?[\d.]+,\s*-?[\d.]+\)$/,
      );
    }
    // The two legacy names resolve to their replacements rather than keeping an older feel.
    expect(MOTION.ease).toBe(MOTION.standard);
    expect(MOTION.base).toBe(MOTION.normal);
    expect(MOTION.duration).toEqual({
      instant: MOTION.instant,
      fast: MOTION.fast,
      normal: MOTION.normal,
      slow: MOTION.slow,
    });
  });

  it("keeps the loop periods apart from the transition durations", () => {
    // The two sets are two orders of magnitude apart and mixing them is the failure that
    // matters: a 250ms period on an infinite repeat is a strobe, and the loading skeleton
    // is the last thing on this app that should strobe -- an athlete watches it mid-set.
    // Asserted structurally so a `pulse` added to `DURATION` fails here rather than
    // shipping.
    //
    // Compared in milliseconds: the two sets are written in different units, and a naive
    // `parseFloat` comparison calls 1.6s "less than" 400ms, which would pass a loop period
    // that is actually two hundred times too short.
    const ms = (value: string) => {
      const n = Number.parseFloat(value);
      return value.trim().endsWith("s") && !value.trim().endsWith("ms") ? n * 1000 : n;
    };

    for (const period of Object.values(MOTION.loop)) {
      expect(ms(period), `${period} is not longer than the slowest transition`).toBeGreaterThan(
        ms(MOTION.slow),
      );
    }
    // And all three are genuinely loop periods, not transition lengths wearing a longer
    // number. Named for what they belong to, not for how fast they are.
    expect(MOTION.loop.skeleton).toBe("1.6s");
    expect(MOTION.loop.session).toBe("2s");
    expect(MOTION.loop.rest).toBe("0.9s");
    expect(MOTION.loop.caret).toBe("1s");
  });
});

/**
 * Tailwind carries a second copy of every duration and curve.
 *
 * Duplicated on purpose -- see the note in `tailwind.config.ts` -- but a copy that nothing
 * checks is a copy that drifts, so it is pinned here. `tailwind.config.ts` is loaded by
 * Tailwind's own loader rather than by the app's module graph, so importing `MOTION` into
 * it would make the config's resolution depend on how it was loaded; this is the same
 * duplicate-and-pin arrangement already used for the accent colour and `boxShadow`.
 */
describe("Tailwind's motion defaults are the design system's motion", () => {
  const extended = tailwind.theme?.extend ?? {};

  it("resolves a bare `transition` through MOTION, not Tailwind's stock values", () => {
    // Roughly forty call sites write `transition` with no duration or curve, so these
    // defaults are what almost every animated surface in the app actually uses.
    expect(extended.transitionDuration).toEqual({
      instant: MOTION.instant,
      fast: MOTION.fast,
      normal: MOTION.normal,
      slow: MOTION.slow,
    });
    expect(extended.transitionTimingFunction).toEqual({
      spring: MOTION.spring,
      easeOut: MOTION.easeOut,
      easeIn: MOTION.easeIn,
      standard: MOTION.standard,
    });
  });

  it("names the curves in the keyframes rather than reaching for the CSS keywords", () => {
    // `fade-in` said `ease-out`, which is `cubic-bezier(0, 0, 0.58, 1)` -- a different
    // curve from `MOTION.easeOut`, so a sheet was easing along a curve nobody had chosen.
    // `pulse-ring` said `ease-in-out`, which happens to equal `MOTION.standard`; it is now
    // spelled out so the two can move together.
    const animations = extended.animation ?? {};
    expect(animations["fade-in"]).toBe(`fade-in ${MOTION.normal} ${MOTION.easeOut}`);
    expect(animations["pulse-ring"]).toBe(
      `pulse-ring ${MOTION.loop.session} ${MOTION.standard} infinite`,
    );
    // A bare keyword here means the curve is whatever the browser decides, which is the
    // exact thing the token group exists to stop.
    for (const [name, value] of Object.entries(animations)) {
      expect(value, `${name} uses a CSS keyword for its curve`).not.toMatch(
        /\b(ease-in-out|ease-out|ease-in|ease|linear)\b/,
      );
    }
  });

  it("does not expose the retired aliases as Tailwind classes", () => {
    // `ease-linear` and `ease` are absent above on purpose. The keywords exist as values
    // in CSS but naming one as a Tailwind utility is how the old `ease` alias came back
    // after being retired.
    expect(Object.keys(extended.transitionTimingFunction ?? {})).not.toContain("ease");
  });
});

describe("the token set", () => {
  it("exports every colour token as a CSS custom property", () => {
    const css = cssVars();
    for (const name of Object.keys(COLOR_TOKENS)) {
      expect(css, `falta --cronos-${name}`).toContain(`--cronos-${name}:`);
    }
  });

  it("prefixes every CSS variable so it cannot collide with a utility class", () => {
    const css = cssVars();
    const unprefixed = css.match(/^\s*--(?!cronos-)/m);
    expect(unprefixed).toBeNull();
  });

  it("names no CSS variable twice", () => {
    const names = Object.keys(COLOR_TOKENS);
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolves the surface aliases to the surface they rename", () => {
    /*
     * The redesign's names are aliases rather than a second palette. That is only an
     * improvement if they are the *same value* -- two names that are allowed to diverge
     * are how a separator ends up 0.08 on one screen and 0.10 on the next.
     */
    expect(SURFACE.elevated).toBe(SURFACE.raised);
    expect(SURFACE.border).toBe(GLASS.border);
    expect(SURFACE.glass).toBe(GLASS.fill);
    expect(TEXT.inverse).toBe(TEXT.onAccent);
    expect(ACCENT.muted).toBe(ACCENT.subtle);
  });

  it("keeps the accent's tints and its border at different alphas on purpose", () => {
    // A border has to survive against the fill behind it, which a 12% tint does not, so
    // `border` is deliberately the stronger of the two rather than an alias of `subtle`.
    const borderAlpha = Number.parseFloat(ACCENT.border.split(",")[3]);
    const subtleAlpha = Number.parseFloat(ACCENT.subtle.split(",")[3]);
    expect(borderAlpha).toBeGreaterThan(subtleAlpha);
  });

  it("ranks the navigation below every surface the user summoned", () => {
    /*
     * A bottom bar at the modal's own z-index paints over a sheet, and an athlete who
     * opens a modal from the navigation would tap the wrong control. The brief asked for
     * 60; this asserts why it is not 60.
     */
    expect(Z_INDEX.nav).toBeGreaterThan(Z_INDEX.sticky);
    expect(Z_INDEX.nav).toBeLessThan(Z_INDEX.sheet);
    expect(Z_INDEX.fab).toBeGreaterThan(Z_INDEX.nav);
    expect(Z_INDEX.fab).toBeLessThan(Z_INDEX.sheet);
  });

  it("keeps the radius vocabulary keyed to the object it is cut onto", () => {
    // `surface` and `card` are both "a card" and deliberately different radii: one sits
    // on the canvas, the other is a lit glass panel.
    expect(RADIUS.surface).toBe("16px");
    expect(RADIUS.card).toBe(GLASS.radius);
    expect(RADIUS.card).not.toBe(RADIUS.surface);
    expect(RADIUS.chip).toBe(RADIUS.sm);
    expect(RADIUS.button).toBe(RADIUS.control);
  });

  it("keeps the brand mark in the accent's red", () => {
    /*
     * The logo is the one asset that cannot read a CSS custom property, so its stops are
     * literals in `logoGradient.ts`. That is exactly the arrangement that lets a palette
     * change leave the mark behind, which is what happened once already: the mark was gold
     * while the accent went red, and the two only stopped matching when someone noticed.
     * The mid stop is asserted to *be* the accent rather than a colour resembling it.
     */
    expect(LOGO_GRADIENT.base).toBe(ACCENT.base);
    expect(LOGO_GRADIENT.deep).toBe(ACCENT.pressed);
    expect(redPolicyFor(LOGO_GRADIENT.light, "accent")).toBe(false);
    // No gold survives anywhere in the mark.
    for (const stop of Object.values(LOGO_GRADIENT)) {
      const { h } = rgbToHsl(parseColor(stop)!);
      expect(h < 20 || h > 340, `${stop} is not in the red arc`).toBe(true);
    }
  });
});

// --------------------------------------------------------------- colour maths

describe("the type scale is the only source of font sizes", () => {
  it("has no font-size literal left in any component", () => {
    // A literal `fontSize: 13` is a size the scale does not contain, so nothing about
    // it is reviewable in one place and nothing about it moves when the scale does.
    //
    // This is the check that makes the scale a system rather than a suggestion. It
    // found 115 of them, and the interesting ones were not the majority: 41 sites
    // rendered 13px body copy, which is below the legibility floor iOS and Android
    // both ask for, so the fix was to raise them onto the scale rather than to add a
    // tier that enshrined the defect.
    expect(fontSizeLiterals()).toEqual([]);
  });

  it("still allows a bespoke size, but only where the brand needs one", () => {
    // The wordmark scales with the mark, so its two sizes are a function of the mark's
    // height and not part of the reading scale. Naming the exception is the point:
    // without it the rule above would be one exception away from being wrong quietly,
    // and the first thing anyone adds to an absolute rule is a way around it.
    expect(COMPONENT_SOURCES["../components/shell/BrandLockup.tsx"]).toContain(
      'size >= 40 ? "22px" : "20px"',
    );
  });

  it("keeps every size on the scale one the product actually reads", () => {
    // The tiers below are the ones components reference. A tier nothing references is
    // a size someone will reach for, and the scale should say what it is for rather
    // than leaving it to be discovered.
    const referenced = [
      TYPE.label.size,
      TYPE.caption.size,
      TYPE.subhead.size,
      TYPE.callout.size,
      TYPE.body.size,
      TYPE.headline.size,
      TYPE.title2.size,
      TYPE.title1.size,
      TYPE.hero.size,
      TYPE.display.size,
    ];
    const pixels = referenced.map((size) => Number.parseFloat(size));
    for (let i = 1; i < pixels.length; i += 1) {
      // Ascending and non-decreasing, not strictly: `body` and `headline` are both 17px
      // on purpose -- the same size, one regular and one bold -- and a strict
      // comparison would push the scale to invent a difference it does not have.
      // Every one a real px value, since a rem or a percentage would make the
      // `fontSize:` comparison above meaningless.
      expect(pixels[i], "the scale must ascend").toBeGreaterThanOrEqual(pixels[i - 1]);
    }
  });
});

describe("colour reaches components only through a token", () => {
  it("has no inline white alpha left in any component", () => {
    // This is the rule that found the muscle map drawing a human body in seven
    // different greys. Those seven were not seven decisions; they were seven places
    // where somebody needed a grey and reached past the token file because the token file
    // had nothing for it. Adding `STROKE` was the fix, and this is what keeps the gap
    // from reopening.
    expect(inlineWhiteAlphas()).toEqual([]);
  });

  it("has no hex colour left in any component either", () => {
    // A hex in a component cannot be reviewed next to the palette it is competing with,
    // which is the whole reason the palette is a module. `#15151a` as a muscle region
    // and `#15151a` as a card are one colour that will drift apart the first time
    // someone edits one of them.
    expect(inlineHexColours()).toEqual([]);
  });

  it("has no rgba literal of any hue left in any component", () => {
    // Supersedes the white-only rule above, which was too narrow to be useful: accent
    // hues do not look like stray greys, so two of them walked straight past it.
    expect(inlineRgbaColours()).toEqual([]);
  });

  it("has no raw duration or curve left in any component", () => {
    // Motion was the one design system with no guard, and it drifted the way colour did
    // before it: `140ms ease` on the muscle diagram, `1.6s ease-in-out` on the skeleton,
    // and `linear` on the rest ring. All three looked right, and none of them were
    // reachable from `MOTION`.
    //
    // The rule covers `transition` and `animation` alike, and the keyword curves as well as
    // `cubic-bezier`, because the keywords are what this codebase actually reached for --
    // they were in `tailwind.config.ts` and in three components, and a duration-only rule
    // would have watched all of it walk past.
    expect(motionLiterals()).toEqual([]);
  });

  it("has retired the motion aliases, rather than leaving them as a second vocabulary", () => {
    // `MOTION.ease` and `MOTION.base` exist so an un-migrated call site gets the current
    // motion instead of an older feel. That work is done -- three call sites, all migrated
    // -- and an alias that still has callers is just a name nobody chose. Pinned to zero so
    // a new one has to be written deliberately.
    for (const [path, source] of Object.entries(COMPONENT_SOURCES).sort()) {
      if (path.endsWith(".test.tsx")) continue;
      if (IN_FLIGHT_SOURCES.includes(path)) continue;
      const hits = stripComments(source)
        .split("\n")
        .filter((text: string) => /MOTION\.(ease|base)\b/.test(text));
      expect(hits, `${path} still uses a retired motion alias`).toEqual([]);
    }
  });

  it("keeps illustration states distinct from surface hairlines", () => {
    // `DIAGRAM` exists because `GLASS` covers fills and the lines between them, and
    // nothing covered the things that *draw* something. The three edges ascend, because
    // on a diagram the weight of a line is the only thing saying how much is there.
    expect(alphaOf(DIAGRAM.inert)).toBeLessThan(alphaOf(DIAGRAM.regionStroke));
    expect(alphaOf(DIAGRAM.regionStroke)).toBeLessThan(alphaOf(DIAGRAM.figureStroke));
  });

  it("separates an inert region from one with content, on both fill and edge", () => {
    // Both halves matter and they fail separately. A region that receded only in fill
    // would still be outlined and would read as a shape rather than as an absence; one
    // that receded only in edge would keep a panel's worth of weight while claiming to
    // have nothing in it.
    expect(DIAGRAM.inertFill).not.toBe(DIAGRAM.regionFill);
    expect(DIAGRAM.inert).not.toBe(DIAGRAM.regionStroke);
    // Inert is darker, so it is closer to the canvas rather than brighter than a region
    // that has content -- the two states must not be ordered by "which looks more".
    expect(relativeLuminanceOf(DIAGRAM.inertFill)).toBeLessThan(
      relativeLuminanceOf(DIAGRAM.regionFill),
    );
  });

  it("aliases the region edge to the hairline it renames", () => {
    // Not a second 0.18. This file has argued against two names for one job since the
    // rank ladder, and a region's edge is the same value doing the same work as a border.
    expect(DIAGRAM.regionStroke).toBe(GLASS.borderStrong);
  });

  it("lets the accent into a diagram exactly once, as selection", () => {
    // Selection is the one thing a diagram does that is an action rather than a
    // description, so it is the one thing allowed to wear the product's accent. Every
    // other diagram value is a neutral, which is what makes a selected region legible as
    // a selection rather than as "the diagram has some colour in it".
    expect(DIAGRAM.selectedFill).toBe(ACCENT.base);
    for (const neutral of [
      DIAGRAM.inert,
      DIAGRAM.regionFill,
      DIAGRAM.regionStroke,
      DIAGRAM.regionHoverFill,
      DIAGRAM.figureStroke,
      DIAGRAM.inertFill,
    ]) {
      expect(isSaturatedRed(neutral), neutral).toBe(false);
    }
  });

  it("keeps a hovered selection in the accent's own hue", () => {
    // It used to be amber, on the reasoning that a second colour would read as a second
    // state. Amber now means warning and nothing else, so that put a fourth warm meaning
    // into a product that already has the accent, the warning and copper. The state is
    // already carried by the fill being forced back to the selection colour, so the glow
    // only has to be louder.
    expect(DIAGRAM.selectedHoverGlow).not.toBe(DIAGRAM.selectedGlow);
    const resting = parseColor(DIAGRAM.selectedGlow)!;
    const hovered = parseColor(DIAGRAM.selectedHoverGlow)!;
    expect(rgbToHsl(hovered).h).toBe(rgbToHsl(resting).h);
    // Louder, not different: a stronger alpha on the same hue.
    expect(alphaOf(DIAGRAM.selectedHoverGlow)).toBeGreaterThan(alphaOf(DIAGRAM.selectedGlow));
    // And it is emphatically not the warning's amber.
    expect(hovered).not.toEqual(parseColor(STATUS.warning.base));
  });
});

describe("scrims darken rather than lighten", () => {
  it("dims a modal's surroundings hard enough to be unambiguous", () => {
    // A lighter scrim lets the content behind it stay legible, and a dialog the user can
    // read the page through is a dialog they will answer the wrong question on.
    expect(alphaOf(SCRIM.modal)).toBeGreaterThan(0.6);
  });

  it("is darker than the canvas it dims, not a fifth surface", () => {
    // Every other surface in this file builds *up* from black. A scrim is the one thing
    // that goes down, and a scrim expressed as a white fill would be a lighter panel,
    // which is the visual grammar for "raised" -- the wrong elevation entirely.
    expect(alphaOf(SCRIM.modal)).toBeGreaterThan(0);
    const modal = parseColor(SCRIM.modal)!;
    const recessed = parseColor(SCRIM.recessed)!;
    expect(modal.r).toBe(0);
    expect(recessed.r).toBe(0);
    expect(relativeLuminanceOf(SCRIM.modal)).toBe(0);
  });

  it("keeps the recessed step recessed rather than merely darker", () => {
    // It sits on the canvas rather than over content, so it does not need to dim as hard.
    // It does need to be dim *something*: at zero it would be invisible, and a bubble
    // drawn with no backdrop on a dark surface has no edge to be read by.
    expect(alphaOf(SCRIM.recessed)).toBeGreaterThan(0);
    expect(alphaOf(SCRIM.recessed)).toBeLessThan(alphaOf(SCRIM.modal));
  });

  it("is the same backdrop everywhere a modal appears", () => {
    // It was written out in full in two files, which is how two modals end up dimming
    // their surroundings at different strengths and nobody notices until one is opened
    // after the other. One value, and the components read it.
    const scrimFiles = Object.keys(COMPONENT_SOURCES).filter(
      (path) =>
        !path.endsWith(".test.tsx") &&
        !IN_FLIGHT_SOURCES.includes(path) &&
        /Modal\.tsx$/.test(path),
    );
    expect(scrimFiles.length).toBeGreaterThan(0);
    // `GymSettingsModal` is the modal the app has, and it reads the token rather than a
    // literal -- which the `rgba` guard above already enforces. Asserted here anyway
    // because this is the pair of facts that guard alone does not explain.
    expect(COMPONENT_SOURCES["../components/workout/GymSettingsModal.tsx"]).toContain(
      "SCRIM.modal",
    );
  });
});

/**
 * The generated interactive-state CSS, and the app stylesheet next to it.
 *
 * Asserted on directly because the interesting part of the focus and disabled states is
 * *the rule*, not the token: `FOCUS` can be perfectly correct while no control has a ring,
 * because what paints it is CSS. Testing the token alone would pass against the state this
 * commit was written to fix.
 *
 * Two sources, because there are now two places the rule could live and they must not both
 * answer. `GENERATED` is what reaches the browser, from `stateRules()`. `STYLESHEET` is
 * `index.css`, asserted only to confirm it has stopped restating what is generated --
 * a hand-written copy would be the same value in two files, and the next edit to `FOCUS`
 * would reach one of them.
 *
 * A static `?raw` import rather than a glob. The glob form was tried first and returns
 * nothing for `.css` under this project's Vite pipeline, where it works fine for `.tsx` --
 * so this is the third tool tried for reading source in this file, after an eager glob
 * that executed every module and `node:fs`, which the browser-only tsconfig will not type.
 * A static import is the one that was always going to work, because `?raw` is a
 * first-class Vite feature and does not depend on glob expansion at all.
 */
import STYLESHEET from "../index.css?raw";

describe("every focusable control can show where it is", () => {
  it("paints a ring on more than the one button primitive", () => {
    // The reason this commit exists: the ring lived only on `.gbtn`, and the app has 90
    // native `<button>`s and 23 `<input>`s. Everything else fell back to the browser's
    // default, which is not a designed state -- it differs per engine, it is drawn outside
    // the element's own dark surface, and forced-colors mode removes it, which is exactly
    // the mode a keyboard user here is most likely to be in.
    expect(stateRules()).toMatch(/:where\([^)]*\):focus-visible\s*\{[^}]*outline/);
  });

  it("covers the elements a keyboard actually lands on", () => {
    const rule = stateRules().match(/:where\([^)]*\):focus-visible/);
    expect(rule).toBeTruthy();
    // A rule that lists only `button` would leave every link in the app unfocusable, and
    // `input` covers the numeric fields an athlete uses mid-set.
    for (const selector of ["button", "a", "input", "select", "textarea", "[tabindex]"]) {
      expect(rule![0], `focus rule omits ${selector}`).toContain(selector);
    }
  });

  it("uses :where(), so a component can still override it", () => {
    // Without zero specificity this global rule outranks a component's own
    // :focus-visible, and every deliberate override then needs !important to survive --
    // which is how a global rule becomes something components route around instead of
    // build on. Asserted structurally so the intent cannot be lost to a refactor that
    // "simplifies" `:where` away.
    const focusRules = stateRules().match(/[^\n]*:focus-visible[^\n]*\{/g) ?? [];
    expect(focusRules.length).toBeGreaterThan(0);
    expect(focusRules.every((rule) => rule.includes(":where("))).toBe(true);
  });

  it("writes the token's value, so it cannot drift from the token", () => {
    // The ring is interpolated from `FOCUS`, not restated. Asserted by value rather than
    // by looking for the absence of a hex, because `FOCUS.ring` legitimately *is* a hex --
    // it aliases `ACCENT.text` -- so "no hex" would only prove the rule reads something.
    const outline = stateRules().match(/outline:[^;]*;/);
    expect(outline, "no outline declaration in the generated rules").toBeTruthy();
    expect(outline![0]).toBe(`outline: ${FOCUS.width} solid ${FOCUS.ring};`);
    expect(stateRules()).toContain(`outline-offset: ${FOCUS.offset};`);
  });

  it("leaves the stylesheet free of a second copy of the ring", () => {
    // The generated rule and a hand-written one would disagree the first time `FOCUS`
    // changed, and the loser would be invisible until someone tabbed through the app.
    //
    // Comments are stripped because `index.css` explains this decision in prose that names
    // `.gbtn:focus-visible` outright. Matching a comment that documents the rule is the
    // same failure as a colour guard matching this file's own documentation, and
    // `stripComments` already exists for it.
    const css = stripComments(STYLESHEET);
    expect(css).not.toContain("--cronos-focus-ring");
    expect(css).not.toMatch(/\.gbtn:focus-visible/);
  });

  it("is the accent itself, not a second colour beside it", () => {
    // Identity is the assertion. The ring aliases `ACCENT.text` rather than restating a
    // hue, so the accent changing changes the ring in the same edit -- and there is no
    // second colour to drift out of step with the first.
    expect(FOCUS.ring).toBe(ACCENT.text);
    // The accent is red, and Block A made that deliberate: red is allowed as the accent and
    // nowhere else. `redPolicyFor` is a *violation* predicate -- it answers "does this
    // colour break the rule for the role it plays" -- so both directions are asserted:
    // clean as an accent, and genuinely load-bearing, because the same red would break the
    // rule the moment it was used anywhere else. That is the whole shape of the decision:
    // one red, one place, and the focus ring is that place by aliasing rather than copying.
    expect(isSaturatedRed(FOCUS.ring)).toBe(true);
    expect(redPolicyFor(FOCUS.ring, "accent")).toBe(false);
    expect(redPolicyFor(FOCUS.ring, "status")).toBe(true);
    // The one thing it must not become is the warning. That is the confusion the alias
    // exists to prevent: an amber warning and a red focus ring are both "pay attention to
    // this control", and an athlete mid-set cannot tell which one they are looking at.
    expect(FOCUS.ring).not.toBe(STATUS.warning.base);
    expect(FOCUS.ring).not.toBe(STATUS.error.base);
  });

  it("survives being drawn on top of a control's own border", () => {
    // 1px is the hairline every control here draws. A 1px ring drawn outside a 1px
    // border reads as a slightly thick border rather than as a ring, and the one state
    // that has to be unmistakable becomes the easiest to miss.
    expect(Number.parseFloat(FOCUS.width)).toBeGreaterThanOrEqual(2);
    expect(Number.parseFloat(FOCUS.offset)).toBeGreaterThan(0);
  });

  it("is actually installed, so the token cannot be correct and unreachable", () => {
    // `cssVars()` had no caller outside this file for as long as it existed: the
    // projection looked alive and painted nothing. Asserting the shape of the output is
    // not enough -- this checks the one function that puts it in the document, and that it
    // puts the custom properties in too, since that is what makes `--cronos-*` in
    // `index.css` real instead of a fallback that always wins.
    expect(designTokensCss()).toContain(`--cronos-focus-ring: ${FOCUS.ring};`);
    expect(designTokensCss()).toContain(stateRules());
  });
});

describe("a disabled control says so", () => {
  it("styles disabled globally, not only on the button primitive", () => {
    // 32 controls in the app set `disabled` and 5 had any styling for it. The rest
    // answered a tap with nothing, which is the worst version of a disabled state: the
    // athlete cannot tell a control that is waiting from one that is broken, so they tap
    // it again.
    expect(stateRules()).toMatch(/:where\([^)]*\):disabled\s*\{[^}]*opacity/);
  });

  it("stays legible, because a control nobody can read is just absent", () => {
    const opacity = Number.parseFloat(FOCUS.disabledOpacity);
    // Dim enough to say "not now", bright enough that the label survives. Text on a
    // disabled control is exempt from the contrast floor precisely because it is still
    // information, so dimming it below legibility throws away the one thing it is for.
    expect(opacity).toBeGreaterThan(0.3);
    expect(opacity).toBeLessThan(1);
  });

  it("styles the ARIA form too, because it still takes clicks", () => {
    // `aria-disabled` does not stop a tap landing, so it has to look inert or the
    // athlete has no way to know their tap did nothing.
    expect(stateRules()).toContain('[aria-disabled="true"]');
  });

  it("keeps the not-allowed cursor, so the pointer agrees with the opacity", () => {
    // Matched by block rather than by selector. The `aria-disabled` selector contains a
    // `)`, so any regex shaped like `:where\([^)]*\)\[aria-` cannot span it -- and a test
    // that has to be re-shaped whenever a selector gains an attribute is a test that will
    // be loosened until it passes.
    const blocks = stateRules().match(/\{[^}]*\}/g) ?? [];
    const dimmed = blocks.filter((block) => block.includes("opacity"));
    expect(dimmed, "no disabled declaration").toHaveLength(2);
    // Both forms: the attribute and the ARIA one, which are separate rules precisely
    // because they are separate reasons.
    for (const block of dimmed) {
      expect(block).toContain(`opacity: ${FOCUS.disabledOpacity};`);
      expect(block).toContain("cursor: not-allowed;");
    }
  });

  it("leaves the stylesheet free of a second copy", () => {
    // Same reason as the ring: `.gbtn:disabled` was the hand-written original, and the
    // generated rule now reaches that button too. Stripped of comments for the same reason
    // -- the stylesheet names the class in the note explaining why it is gone.
    expect(stripComments(STYLESHEET)).not.toMatch(/\.gbtn:disabled/);
  });
});

describe("the session ring reaches the screen", () => {
  /**
   * The stylesheet read back, with comments stripped.
   *
   * Every assertion about `index.css` goes through this rather than the raw import, for
   * one reason: `vitest.config.ts` disables CSS processing by default, and with it off
   * Vitest replaces a `.css` module with an empty string *before* `?raw` is resolved. The
   * import then yields `""` -- silently. Only a positive assertion notices, so the two
   * guards written as "the stylesheet must not contain X" passed against nothing at all
   * for as long as they existed.
   *
   * Asserting the import is non-empty makes that failure loud. It is a positive assertion
   * on purpose, because that is the only shape that can catch an empty read.
   */
  it("reads the stylesheet back rather than an empty stand-in for it", () => {
    expect(STYLESHEET.length).toBeGreaterThan(0);
    expect(STYLESHEET).toContain("@tailwind base");
    expect(stripComments(STYLESHEET).length).toBeGreaterThan(0);
  });

  /**
   * The ring's keyframes are asserted here rather than in a component test on purpose.
   *
   * `BottomNav` names `cronos-session-ring` and this is where it is defined, so the two
   * can only be checked together. Nothing else in the file reads the stylesheet, and a
   * component test can only see the name it passed in -- if the keyframes were renamed or
   * deleted, every component test would still pass while the ring rendered nothing.
   *
   * `scale` rather than a growing `width`, asserted because that is the reason the ring
   * exists as a keyframe instead of an animated `box-shadow`: `transform` does not force
   * layout, and this is on a fixed bar that a phone is trying to animate mid-workout.
   */
  it("defines the keyframes the nav's centre action names", () => {
    expect(STYLESHEET).toContain("@keyframes cronos-session-ring");
  });

  it("animates transform and opacity, never a layout property or a colour", () => {
    const frames = STYLESHEET.match(
      /@keyframes cronos-session-ring \{([\s\S]*?)\n  \}/,
    );
    expect(frames, "no cronos-session-ring keyframes").toBeTruthy();

    for (const property of ["transform", "opacity"]) {
      expect(frames![1], `the ring never animates ${property}`).toContain(property);
    }
    // The colour comes from `ACCENT.base` on the element, so the keyframes cannot hold an
    // orange beside a red circle. Same reasoning as the `DIAGRAM` migration.
    expect(frames![1]).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
    // Animating `width` or `box-shadow` on a fixed bottom bar reflows or repaints every
    // frame for an effect that is purely decorative.
    expect(frames![1]).not.toMatch(/^\s*(width|height|box-shadow|border[a-z-]*)\s*:/m);
  });

  it("scales outward, because growing inward collides with the press animation", () => {
    const frames = STYLESHEET.match(
      /@keyframes cronos-session-ring \{([\s\S]*?)\n  \}/,
    )!;
    const scales = [...frames[1].matchAll(/scale\(([\d.]+)\)/g)].map((m) =>
      Number.parseFloat(m[1]),
    );
    expect(scales.length).toBeGreaterThanOrEqual(2);
    // Outward and further outward. A ring that starts smaller than the button would read as
    // the button swelling, which is what the press animation already does.
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...scales)).toBeGreaterThan(1);
  });

  it("stops under reduced motion without being removed", () => {
    // What the ring says -- a session is running -- is information. The override is about
    // movement, so the animation is cancelled and the element stays; `BottomNav` renders
    // it at a static alpha in that mode.
    const reduced = STYLESHEET.match(
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n  \}/g,
    ) ?? [];
    expect(reduced.some((block) => block.includes(".cronos-nav-session-ring"))).toBe(true);
  });
});

describe("colour parsing and conversion", () => {
  it("parses every notation a design file realistically contains", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("#f5a524")).toEqual({ r: 245, g: 165, b: 36 });
    expect(parseColor("rgb(245, 165, 36)")).toEqual({ r: 245, g: 165, b: 36 });
    expect(parseColor("rgba(255, 255, 255, 0.06)")).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 0.06,
    });
    expect(parseColor("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null for anything it cannot read, rather than guessing", () => {
    // A silent NaN here would make every downstream assertion vacuously pass.
    expect(parseColor("nope")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("rgb(1,2)")).toBeNull();
  });

  it("round-trips hex through RGB", () => {
    // Lowercased: `toHex` rebuilds the string from parsed channels, so case is not
    // something it can preserve. Comparing case-insensitively is what this test means.
    expect(toHex(parseColor(ACCENT.base)!)).toBe(ACCENT.base.toLowerCase());
    expect(toHex(parseColor(SURFACE.base)!)).toBe("#000000");
  });

  it("reports achromatic colours as unsaturated regardless of hue maths", () => {
    expect(rgbToHsl(parseColor("#808080")!).s).toBe(0);
  });

  it("composites a translucent fill onto an opaque backdrop", () => {
    // Half-transparent white on black is mid grey, not white.
    expect(flatten("rgba(255, 255, 255, 0.5)", "#000000")).toBe("#808080");
    // An opaque fill ignores the backdrop entirely.
    expect(flatten("#ff0000", "#00ff00")).toBe("#ff0000");
  });
});

// ------------------------------------------------------------- test helpers

function relativeLuminanceOf(color: string): number {
  const { contrastRatio: _unused } = { contrastRatio };
  const rgb = parseColor(color)!;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Coarse glyph family, so ● and ● at different sizes count as one shape. */
function shapeOf(glyph: string): string {
  if (/[●○◉◎]/.test(glyph)) return "circle";
  if (/[◆◇◈]/.test(glyph)) return "diamond";
  if (/[⬟⬠⬡]/.test(glyph)) return "pentagon";
  if (/[⬢⬣]/.test(glyph)) return "hexagon";
  if (/[★☆]/.test(glyph)) return "star";
  return `other:${glyph}`;
}
