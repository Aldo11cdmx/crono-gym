/**
 * BrandLockup.tsx — the official mark, as a lockup with the wordmark.
 *
 * `mix-blend-screen` is not decoration. The logo is a JPEG with a black field
 * around it, and on an OLED panel that field has to disappear rather than sit on
 * top of `SURFACE.base` as a slightly-different black rectangle. Screen blending
 * multiplies the backdrop into the image, so the black resolves to whatever is
 * behind it and only the mark survives -- which is the whole point of shipping a
 * black-canvas logo in the first place.
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

/** Where the mark is served from. `public/logo.jpg`, copied verbatim by Vite. */
export const BRAND_LOGO_SRC = "/logo.jpg";

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
        className="w-auto object-contain mix-blend-screen"
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
