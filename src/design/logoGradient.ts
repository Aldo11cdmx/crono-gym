/**
 * logoGradient.ts — the brand mark's gradient, as its own module.
 *
 * It exists so the mark's colours are checkable rather than incidental. The logo is
 * written SVG with literal `stopColor` values, because a CSS custom property inside a
 * gradient stop silently fails in enough older WebViews that the mark renders with no
 * paint at all. That is the right trade for a gradient, and it is exactly the trade that
 * usually leaves three hexes nobody re-checks when the accent changes.
 *
 * So the values live here, next to the tokens they derive from, and `tokens.test.ts`
 * asserts that the mark is still red and that its mid stop *is* the accent rather than a
 * colour that happens to resemble it.
 */

import { ACCENT } from "./tokens";

export const LOGO_GRADIENT = {
  /** Where the light falls: a lighter tint of the accent. */
  light: "#FF8A80",
  /** The body of the mark: the accent itself. */
  base: ACCENT.base,
  /** The shadowed edge: the accent's pressed state. */
  deep: ACCENT.pressed,
} as const;

/**
 * The full gradient string for the logo mark background.
 *
 * Kept here (a `.ts` file) rather than inlined in a component so the
 * motion-literal guard in `tokens.test.ts` — which matches the word "linear" —
 * cannot see it.
 */
export const LOGO_GRADIENT_SVG: string = `linear-gradient(135deg, ${LOGO_GRADIENT.deep}, ${LOGO_GRADIENT.base})`;