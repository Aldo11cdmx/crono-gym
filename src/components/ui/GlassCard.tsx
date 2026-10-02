/**
 * GlassCard.tsx — the surface every panel in the app is built on.
 *
 * Translucent white over whatever is beneath rather than a colour-tinted glass.
 * Tinting it amber would make every card read as a warning and spend the one
 * accent colour on decoration, which destroys its meaning as "this is the primary
 * action".
 *
 * `reducedTransparency` swaps the recipe for the solid one. That is not a
 * nicety: `backdrop-filter` is unsupported on enough browsers, and a user who has
 * asked for reduced transparency cannot perceive the translucency at all, so the
 * card would collapse into the page and its content would lose its edge.
 */

import type { CSSProperties, ElementType, ReactNode } from "react";
import { GLASS, MOTION, RADIUS, SOLID, TEXT } from "@/design/tokens";

export interface GlassCardProps {
  children?: ReactNode;
  /** Element to render. A card inside a link must stay an anchor, not a div. */
  as?: ElementType;
  /**
   * Use the opaque surface instead of the translucent one.
   *
   * Set from a `prefers-reduced-transparency` media query at the call site, so
   * the decision stays where the preference is known.
   */
  reducedTransparency?: boolean;
  /** Slightly denser fill, for a card resting on another card. */
  raised?: boolean;
  /** Drop the card padding, for cards whose child owns its own gutters. */
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function GlassCard({
  children,
  as: Tag = "div",
  reducedTransparency = false,
  raised = false,
  flush = false,
  className,
  style,
}: GlassCardProps) {
  const recipe: CSSProperties = reducedTransparency
    ? {
        backgroundColor: SOLID.card,
        borderColor: SOLID.border,
      }
    : {
        backgroundColor: raised ? GLASS.fillRaised : GLASS.fill,
        borderColor: GLASS.border,
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
      };

  return (
    <Tag
      className={className}
      style={{
        position: "relative",
        borderRadius: RADIUS.card,
        borderWidth: "1px",
        borderStyle: "solid",
        boxShadow: GLASS.shadow,
        transition: `border-color ${MOTION.base} ${MOTION.ease}`,
        padding: flush ? undefined : "20px",
        color: TEXT.primary,
        ...recipe,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}