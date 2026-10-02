/**
 * Skeleton.tsx — a placeholder for content that has not arrived.
 *
 * Shaped like the thing it stands in for. A skeleton of the wrong size is worse
 * than a spinner: it moves the layout when the real content replaces it, which is
 * the jump the component exists to prevent.
 *
 * The pulse stops entirely under `prefers-reduced-motion` rather than just
 * slowing down. A pulse *is* the motion here, so there is no slower version of
 * it that still means "loading" -- and a reduced-motion user watching a bar
 * breathe forever gets no information a static placeholder would not give.
 */

import type { CSSProperties } from "react";
import { GLASS, RADIUS } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface SkeletonProps {
  /** `text` is a short run, `block` is a paragraph or a card body. */
  variant?: "text" | "block";
  width?: string;
  height?: string;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className,
  style,
}: SkeletonProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      // Decorative: the loading state is announced by whatever owns the skeleton,
      // so a screen reader should not meet an unlabelled empty box here.
      aria-hidden="true"
      className={className}
      style={{
        width: width ?? (variant === "text" ? "100%" : "100%"),
        height: height ?? (variant === "text" ? "14px" : "88px"),
        borderRadius: variant === "text" ? RADIUS.sm : RADIUS.control,
        backgroundColor: GLASS.fillRaised,
        animation: reducedMotion ? undefined : "cronos-pulse 1.6s ease-in-out infinite",
        ...style,
      }}
    />
  );
}