/**
 * HeroGlow.tsx — a decorative gradient glow layer for HeroWorkoutCard.
 *
 * Renders an absolutely-positioned, pointer-events:none layer with the
 * LOGO_GRADIENT at very low opacity and an ACCENT.glow cast in one corner.
 * It sits behind the card's content so text above it retains contrast.
 *
 * Contrast note: the layer is opaque-less and painted on the card's own
 * SOLID.card surface, so the AA contrast of TEXT.primary over SOLID.card
 * is unchanged. The glow is tuned to ACCENT.glow (20% alpha) which the
 * tokens already assert meets the design's visibility bar.
 */

import { LOGO_GRADIENT } from "@/design/logoGradient";
import { ACCENT, SOLID } from "@/design/tokens";

export function HeroGlow() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        pointerEvents: "none",
        backgroundImage: `radial-gradient(
          ellipse at 85% 15%,
          ${LOGO_GRADIENT.light}15 0%,
          transparent 60%
        ),
        radial-gradient(
          circle at 88% 18%,
          ${ACCENT.glow} 0%,
          transparent 70%
        )`,
        backgroundColor: SOLID.card,
        zIndex: 0,
      }}
    />
  );
}
