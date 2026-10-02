/**
 * color.ts — the colour maths every other design module is built on.
 *
 * Pure functions, no React and no DOM, so the rules that protect users with a
 * colour vision deficiency are verifiable by a test instead of asserted in a
 * comment. Three jobs:
 *
 * 1. WCAG 2.1 relative luminance and contrast ratio.
 * 2. HSL, needed by the saturated-red rule below, which is a *hue and
 *    saturation* rule rather than a list of banned hex values.
 * 3. Colour vision deficiency simulation, so the developer preview shows what a
 *    user actually sees instead of describing it in words.
 *
 * Why a hue rule rather than a grep for `red`
 * -----------------------------------------
 * A test that bans the string `red` misses `#fb7185` (hue 351, saturation 95%),
 * which is exactly the colour the rank ladder used to ship as "Élite". Banning
 * hues catches that class of mistake for any colour, in any token file, forever.
 */

// ----------------------------------------------------------------- parsing

export interface Rgb {
  r: number;
  g: number;
  b: number;
  /** 0-1. Present only when the source string carried an alpha channel. */
  a?: number;
}

export interface Hsl {
  /** 0-360. */
  h: number;
  /** 0-1. */
  s: number;
  /** 0-1. */
  l: number;
}

/**
 * Parses `#rgb`, `#rrggbb`, `rgb()`, `rgba()`, `hsl()` and `hsla()`.
 *
 * Returns null rather than throwing or coercing: an unparseable colour has to
 * be detectable so the design rules can report it instead of quietly passing it.
 * `NaN` luminance in particular would poison every downstream comparison, since
 * `NaN >= 4.5` is false and `NaN < 4.5` is also false.
 */
export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase();
  if (value === "") return null;

  if (value.startsWith("#")) return parseHex(value);

  const fn = /^rgba?\(([^)]+)\)$/.exec(value);
  if (fn) return parseRgbFunction(fn[1]);

  const hslFn = /^hsla?\(([^)]+)\)$/.exec(value);
  if (hslFn) return parseHslFunction(hslFn[1]);

  return null;
}

function parseHex(value: string): Rgb | null {
  let body = value.slice(1);
  if (body.length === 3) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (body.length === 8) body = body.slice(0, 6);
  if (!/^[0-9a-f]{6}$/.test(body)) return null;
  const int = Number.parseInt(body, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function parseRgbFunction(body: string): Rgb | null {
  const parts = body.split(/[,/\s]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channels = parts.slice(0, 3).map((part) => parseChannel(part));
  if (channels.some((c) => c === null)) return null;
  const alpha = parts.length > 3 ? Number.parseFloat(parts[3]) : undefined;
  if (alpha !== undefined && Number.isNaN(alpha)) return null;
  return { r: channels[0] as number, g: channels[1] as number, b: channels[2] as number, a: alpha };
}

function parseHslFunction(body: string): Rgb | null {
  const parts = body.split(/[,/\s]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const h = parseAngle(parts[0]);
  const s = Number.parseFloat(parts[1]) / 100;
  const l = Number.parseFloat(parts[2]) / 100;
  if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) return null;
  const [r, g, b] = hslToRgb(h, s, l);
  const alpha = parts.length > 3 ? Number.parseFloat(parts[3]) : undefined;
  return { r, g, b, a: alpha };
}

function parseChannel(part: string): number | null {
  if (part.endsWith("%")) {
    const pct = Number.parseFloat(part);
    if (Number.isNaN(pct)) return null;
    return Math.round((pct / 100) * 255);
  }
  const value = Number.parseFloat(part);
  if (Number.isNaN(value)) return null;
  return Math.round(value);
}

function parseAngle(part: string): number {
  if (part.endsWith("deg")) return Number.parseFloat(part);
  return Number.parseFloat(part);
}

// -------------------------------------------------------------- conversion

/** `#000000` from an rgb triple. Alpha is dropped; tokens are opaque. */
export function toHex({ r, g, b }: Rgb): string {
  const part = (c: number) =>
    clampChannel(c).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function clampChannel(c: number): number {
  return Math.max(0, Math.min(255, Math.round(c)));
}

/** RGB to HSL. Returns achromatic colours as hue 0 with saturation 0. */
export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
  else h = 60 * ((rn - gn) / delta + 4);
  if (h < 0) h += 360;

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return [
    (rgb[0] + m) * 255,
    (rgb[1] + m) * 255,
    (rgb[2] + m) * 255,
  ];
}

// ------------------------------------------------------------------ WCAG

/**
 * WCAG 2.1 relative luminance.
 *
 * Returns 0 for unparseable input, which reads as "black" and therefore fails
 * any contrast assertion rather than passing one. A rule that cannot be checked
 * must not be trusted.
 */
export function relativeLuminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ------------------------------------------------- saturated red detection

/** WCAG AA for normal-size text. */
export const AA_CONTRAST = 4.5;

/** WCAG AA for large text and for non-text UI boundaries. */
export const AA_LARGE_CONTRAST = 3;

/**
 * Hue window treated as "red" for the colour-blindness rule.
 *
 * Two arcs, because red wraps around 0/360: 345-360 and 0-15. 15 degrees of
 * slack past pure red catches the rose and salmon tones that read as red to a
 * protanope, while staying clear of orange (25-45), which is where the amber
 * accent and the Bronze rank legitimately live.
 */
export const RED_HUE_ARCS: ReadonlyArray<readonly [number, number]> = [
  [345, 360],
  [0, 15],
];

/** Saturation at or above which a red hue is called saturated. */
export const SATURATED_RED_MIN_SATURATION = 0.6;

/**
 * True when a colour is a saturated red.
 *
 * The rule the brief asks for: hue near 0 or 360 *and* high saturation. Both
 * halves matter. A desaturated warm grey has a red hue but is not a red-green
 * confusion risk, and a fully saturated colour at 200 degrees is a completely
 * different problem.
 */
export function isSaturatedRed(color: string): boolean {
  const rgb = parseColor(color);
  if (!rgb) return false;
  const { h, s } = rgbToHsl(rgb);
  if (s < SATURATED_RED_MIN_SATURATION) return false;
  return RED_HUE_ARCS.some(([from, to]) => h >= from && h <= to);
}

/** Human-readable explanation, for the test failure message. */
export function describeRedViolation(color: string): string {
  const rgb = parseColor(color);
  if (!rgb) return `${color}: formato de color no reconocido`;
  const { h, s, l } = rgbToHsl(rgb);
  return `${color}: hue ${Math.round(h)}°, saturación ${Math.round(s * 100)}%, luminosidad ${Math.round(l * 100)}%`;
}

// ------------------------------------------------ colour vision deficiency

export type CvdKind = "protanopia" | "deuteranopia" | "tritanopia";

/**
 * Brettel/Vienot/Mollon dichromat matrices, applied in linear RGB.
 *
 * Working in linear light is what makes these accurate: sRGB gamma encoding is
 * non-linear, so transforming gamma-encoded values produces the wrong result and
 * an over-bright yellow. The encode/decode pair below is the reason the
 * simulation matches what a user reports seeing.
 *
 * Rows are linear-RGB output for red, green and blue inputs respectively.
 */
const CVD_MATRICES: Record<CvdKind, readonly [number[], number[], number[]]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/**
 * Simulates a colour vision deficiency.
 *
 * Used by the dev-only preview. Not applied in production: simulating a
 * deficiency in the real UI would be a lie about what the user sees, and would
 * break their own contrast guarantees.
 */
export function simulateCvd(color: string, kind: CvdKind): string {
  const rgb = parseColor(color);
  if (!rgb) return color;

  const matrix = CVD_MATRICES[kind];
  const linear = [rgb.r, rgb.g, rgb.b].map(toLinear);
  const out = matrix.map((row) => clampChannel(encodeSrgb(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]) * 255));
  return toHex({ r: out[0], g: out[1], b: out[2] });
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function encodeSrgb(linear: number): number {
  const c = Math.max(0, Math.min(1, linear));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Smallest WCAG contrast between a colour and all three deficiency views of it.
 *
 * The number that matters for a colour-blind user is not the WCAG ratio of the
 * original pair, it is the worst ratio *after* the user's own vision is applied.
 * Two colours can sit at 8:1 normally and collapse to 1.4:1 under deuteranopia,
 * which is why the rank palette has to be checked through this function too.
 */
export function contrastRatioUnderCvd(
  a: string,
  b: string,
  kind: CvdKind,
): number {
  return contrastRatio(simulateCvd(a, kind), simulateCvd(b, kind));
}

/** Every deficiency, for a test that asserts a colour survives all of them. */
export const CVD_KINDS: readonly CvdKind[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

// -------------------------------------------------------------- compositing

/**
 * Flattens a translucent colour over an opaque backdrop.
 *
 * Required before any contrast check, because a 10% white fill on black is a
 * very different colour from the white it was derived from. Checking the
 * un-composited value would pass a surface that is unreadable in practice.
 */
export function flatten(fg: string, bg: string): string {
  const top = parseColor(fg);
  const bottom = parseColor(bg);
  if (!top) return bg;
  if (!bottom) return fg;
  const alpha = top.a ?? 1;
  if (alpha >= 1) return toHex(top);
  return toHex({
    r: top.r * alpha + bottom.r * (1 - alpha),
    g: top.g * alpha + bottom.g * (1 - alpha),
    b: top.b * alpha + bottom.b * (1 - alpha),
  });
}

/**
 * Picks whichever of two inks reads better on `background`.
 *
 * The same rule the rank map already applies per rank: a single label colour
 * cannot work across a palette that spans light and dark fills.
 */
export function bestInk(background: string, light: string, dark: string): string {
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;
}
