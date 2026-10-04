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
  GLASS,
  MOTION,
  RADIUS,
  SOLID,
  STATUS,
  SURFACE,
  SURFACE_ROLE,
  TEXT,
  TYPE,
  Z_INDEX,
  cssVars,
} from "./tokens";
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
