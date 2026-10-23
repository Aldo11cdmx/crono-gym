/**
 * Colour helpers for tests.
 *
 * jsdom rewrites whatever spelling the tokens use: `#0d0d10` comes back from
 * `style.background` as `rgb(13, 13, 16)`, and `rgba(255, 255, 255, 0.10)` as
 * `rgba(255, 255, 255, 0.1)`. So a test that compares a computed style to a token by string
 * equality fails on the *spelling* and reports nothing about the colour -- and the obvious
 * "fix" of loosening it to a substring match is how a wrong colour slips through.
 *
 * Comparing the numbers instead keeps the assertion about the colour, which is the thing
 * under test. Tokens are imported, never retyped, so this stays honest when the palette
 * moves.
 */

/** `rgba()` channels, or `null` for a spelling this cannot read. */
export function parseColor(value: string): number[] | null {
  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    return rgb[1].split(",").map((part) => Number.parseFloat(part.trim()));
  }
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (!hex) return null;
  // `#abc` is shorthand for `#aabbcc`; the trailing digits need doubling before slicing.
  const digits = hex[1].length <= 4 ? [...hex[1]].map((c) => c + c) : [...hex[1]];
  return [0, 2, 4].map((i) => Number.parseInt(digits.join("").slice(i, i + 2), 16));
}

/** Whether two colour spellings denote the same colour. */
export function sameColor(a: string, b: string): boolean {
  const left = parseColor(a);
  const right = parseColor(b);
  return left !== null && right !== null && left.every((n, i) => n === right[i]);
}

/**
 * The colour out of a CSS `border` shorthand.
 *
 * For assertions about a border's *colour*, where the width and style are not the claim.
 * A `toContain(TOKEN)` here fails on `0.10` versus `0.1` for no reason an athlete would
 * ever notice.
 */
export function borderColor(shorthand: string): string {
  const start = shorthand.indexOf("solid ");
  return start === -1 ? "" : shorthand.slice(start + "solid ".length).trim();
}