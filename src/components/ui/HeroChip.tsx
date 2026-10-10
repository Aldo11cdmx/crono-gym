/**
 * HeroChip.tsx — a small decorative chip for the HeroWorkoutCard.
 *
 * Renders a glass-filled background, glass border, an optional Lucide icon
 * (16px, sized by token), and a text label. Truncates with ellipsis so it
 * never breaks layout on a 375px viewport.
 */

import type { ReactNode } from "react";
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

export interface HeroChipProps {
  /** Short text content; truncated if it overflows. */
  label: string;
  /** Optional decorative icon (aria-hidden by the parent). */
  icon?: ReactNode;
  /** Accessible label when the icon carries meaning. */
  "aria-label"?: string;
}

export function HeroChip({ label, icon, "aria-label": ariaLabel }: HeroChipProps) {
  return (
    <span
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: SPACE.xs,
        borderRadius: RADIUS.pill,
        border: `1px solid ${GLASS.border}`,
        background: GLASS.fill,
        padding: `${SPACE.xs}px ${SPACE.sm}px`,
        fontSize: TYPE.caption.size,
        lineHeight: TYPE.caption.lineHeight,
        color: TEXT.secondary,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      {icon && (
        <span
          aria-hidden={Boolean(ariaLabel)}
          style={{
            display: "inline-flex",
            flexShrink: 0,
            width: "16px",
            height: "16px",
            color: TEXT.tertiary,
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
        {label}
      </span>
    </span>
  );
}
