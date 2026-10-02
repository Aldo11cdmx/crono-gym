/**
 * CronosLogo.tsx — brand mark for Cronos.
 *
 * The name is the product promise: time (Cronos, the Titan who ate his
 * children) plus training. The mark combines an hourglass with a dumbbell whose
 * bar passes through the hourglass neck, so the symbol reads as both at a
 * glance and holds up as a 16px favicon-sized chip.
 *
 * Inline SVG rather than an asset file: no extra request, no icon-font
 * dependency, and the gradient follows the theme automatically.
 */

import { useId } from "react";

interface CronosLogoProps {
  /** Rendered size in pixels; the mark is square. */
  size?: number;
  /** Renders the "CRONOS" wordmark beside the mark. */
  showWordmark?: boolean;
  className?: string;
}

export function CronosLogo({ size = 32, showWordmark = false, className = "" }: CronosLogoProps) {
  // useId keeps the gradient ids unique when the mark is rendered more than
  // once on a page, otherwise the second instance paints with the first's stops.
  const raw = useId();
  const gradientId = `cronos-gold-${raw.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        role="img"
        aria-label="Cronos"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd27a" />
            <stop offset="45%" stopColor="#ff9f0a" />
            <stop offset="100%" stopColor="#e07407" />
          </linearGradient>
        </defs>

        {/* Outer ring: the dial face. */}
        <circle
          cx="24"
          cy="24"
          r="21"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.75"
          opacity="0.55"
        />

        {/* Dumbbell: bar through the neck, plates at each end. */}
        <g stroke={`url(#${gradientId})`} strokeWidth="2.25" strokeLinecap="round">
          <line x1="11" y1="24" x2="37" y2="24" />
        </g>
        <g fill={`url(#${gradientId})`}>
          <rect x="9.5" y="17.5" width="3.6" height="13" rx="1.8" />
          <rect x="34.9" y="17.5" width="3.6" height="13" rx="1.8" />
        </g>

        {/* Hourglass: the body sits on the bar. */}
        <g stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round">
          <line x1="17" y1="12.5" x2="31" y2="12.5" />
          <line x1="17" y1="35.5" x2="31" y2="35.5" />
        </g>
        <g stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinejoin="round">
          <path d="M17.8 13.5 L24 23.4 L30.2 13.5" />
          <path d="M17.8 34.5 L24 24.6 L30.2 34.5" />
        </g>

        {/* Sand: the last grain falling. */}
        <circle cx="24" cy="22.4" r="1.5" fill={`url(#${gradientId})`} />
      </svg>

      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[0.22em] text-neutral-50">
            CRONOS
          </span>
          <span className="mt-1 text-[9px] font-medium tracking-[0.3em] text-accent/80">
            GYM
          </span>
        </span>
      )}
    </span>
  );
}