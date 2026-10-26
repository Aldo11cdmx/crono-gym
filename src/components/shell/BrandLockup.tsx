/**
 * BrandLockup.tsx — the official mark, as a lockup with the wordmark.
 *
 * The mark is now a transparent PNG (`public/logo.png`), so it renders on any
 * surface without the `mix-blend-screen` hack the JPEG needed. The JPEG had a
 * black field that only disappeared against a black background; the PNG carries
 * its own alpha and the component stops reasoning about what is behind it.
 *
 * One component, three sizes, for the same reason the navigation has one table: a
 * mark hand-written into a header, a rail and a welcome card is three chances to
 * end up with three different crops of the same brand, and nobody notices until
 * the sizes disagree on screen.
 *
 * The `alt` is the wordmark rather than a description, because the lockup already
 * renders "CRONOS" beside the image and anything longer is read aloud twice.
 */

import type { CSSProperties } from "react";
import { MOTION } from "@/design/tokens";
import { BRAND_LABELS } from "@/lib/i18n";

export interface BrandLockupProps {
  /**
   * Height of the mark in px. The image scales with it, so 32 in the rail and 36
   * in a header cost the caller nothing but a number.
   */
  size?: number;
  /** Renders the "CRONOS" wordmark beside the mark. */
  showWordmark?: boolean;
  /** Sizes or positions the row without touching the children's own sizing. */
  style?: CSSProperties;
  className?: string;
}

/** Where the mark is served from. `public/logo.png`, copied verbatim by Vite. */
export const BRAND_LOGO_SRC = "/logo.png";

/** The row: the mark, then the wordmark, on one baseline. */
const ROW_CLASS = "flex items-center gap-3";

export function BrandLockup({
  size = 36,
  showWordmark = true,
  style,
  className,
}: BrandLockupProps = {}) {
  return (
    <div
      className={className ? `${ROW_CLASS} ${className}` : ROW_CLASS}
      style={{ minHeight: MOTION.minTouchTarget, ...style }}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt={BRAND_LABELS.logoAlt}
        // Above the fold in every chrome surface, so lazy loading would only add
        // a frame of empty header.
        loading="eager"
        decoding="async"
        className="w-auto object-contain"
        style={{ height: `${size}px` }}
      />
      {showWordmark && (
        <span
          className="font-bold tracking-wider text-white"
          style={{ fontSize: size >= 40 ? "22px" : "20px" }}
        >
          CRONOS
        </span>
      )}
    </div>
  );
}