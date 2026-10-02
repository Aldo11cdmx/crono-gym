/**
 * GlassButton.tsx — the only button recipe.
 *
 * Four variants, and the choice between them is a claim about importance, not
 * about colour: `primary` is the one action the screen is offering, `secondary`
 * is a real alternative, `ghost` is present but optional, and `destructive`
 * removes something. Anything else is a variant this file has not been asked to
 * express, and reaching for a raw colour at a call site instead is the wrong fix.
 *
 * The accent fill carries dark ink, never white. Amber is far too light for white
 * text -- `tokens.test.ts` asserts the failure so a future "just use white" edit
 * is visible in review.
 *
 * Hover, pressed and focus live in `index.css` under `.gbtn` rather than here,
 * for two reasons: inline styles cannot express `:hover`, and naming a different
 * colour per variant in JS would put eight hex values in this file that all have
 * to be kept in step with `tokens.ts`. A `filter: brightness()` rule is
 * variant-agnostic, so the whole set of states is three lines of CSS.
 */

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import {
  ACCENT,
  DANGER,
  GLASS,
  MOTION,
  RADIUS,
  SOLID,
  TEXT,
  TYPE,
} from "@/design/tokens";

export type GlassButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  /** Leading icon. Decorative: the label always carries the meaning. */
  icon?: ReactNode;
  /** Fills the width of its container. */
  block?: boolean;
}

/**
 * The static colour recipe for each variant.
 *
 * Exported so the dev catalog can render the swatches, and so a test can assert
 * on the pairing without rendering a button.
 */
export const GLASS_BUTTON_RECIPES: Record<
  GlassButtonVariant,
  { background: string; color: string; border: string }
> = {
  primary: {
    background: ACCENT.base,
    color: TEXT.onAccent,
    border: ACCENT.base,
  },
  secondary: {
    background: GLASS.fillRaised,
    color: TEXT.primary,
    border: GLASS.borderStrong,
  },
  ghost: {
    background: "transparent",
    color: TEXT.secondary,
    border: "transparent",
  },
  destructive: {
    // The wine, never a saturated red: see the note above DANGER in tokens.ts.
    background: DANGER.muted,
    color: DANGER.text,
    border: DANGER.border,
  },
};

export function GlassButton({
  variant = "secondary",
  icon,
  block = false,
  className,
  style,
  children,
  type = "button",
  ...rest
}: GlassButtonProps) {
  const recipe = GLASS_BUTTON_RECIPES[variant];

  return (
    <button
      type={type}
      className={className ? `gbtn ${className}` : "gbtn"}
      style={
        {
          display: block ? "flex" : "inline-flex",
          width: block ? "100%" : undefined,
          minHeight: MOTION.minTouchTarget,
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "10px 18px",
          borderRadius: RADIUS.control,
          borderWidth: "1px",
          borderStyle: "solid",
          fontSize: TYPE.body.size,
          lineHeight: TYPE.body.lineHeight,
          fontWeight: 600,
          cursor: "pointer",
          background: recipe.background,
          color: recipe.color,
          borderColor: recipe.border,
          // A hairline top highlight, so a translucent button still reads as a
          // lit surface rather than a hole in the card.
          boxShadow: `inset 0 1px 0 ${variant === "primary" ? ACCENT.text : SOLID.border}`,
          ...style,
        } satisfies CSSProperties
      }
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}