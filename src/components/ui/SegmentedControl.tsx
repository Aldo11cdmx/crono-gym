/**
 * SegmentedControl.tsx — a crystal glass segmented control.
 *
 * Used by the ranks page to toggle between the atomic rank tint and the
 * weekly-volume heatmap. Styled entirely from design tokens: the container
 * is a translucent glass panel, the active segment wears a denser fill,
 * and the whole control respects `prefers-reduced-motion`.
 */

import type { CSSProperties, ReactNode } from "react";
import { GLASS, MOTION, SOLID, TEXT, TYPE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface SegmentedControlProps {
  value: string;
   options: readonly SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: SegmentedControlProps) {
  const reducedMotion = useReducedMotion();

  const glassStyle: CSSProperties = {
    backgroundColor: GLASS.fill,
    borderColor: GLASS.border,
    backdropFilter: "blur(16px) saturate(140%)",
    WebkitBackdropFilter: "blur(16px) saturate(140%)",
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 overflow-hidden rounded-xl border p-1 ${className}`}
      style={glassStyle}
    >
      {options.map((option) => {
        const active = option.value === value;
        const transition = reducedMotion
          ? undefined
          : `background-color ${MOTION.fast} ${MOTION.standard}, color ${MOTION.fast} ${MOTION.standard}`;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-center outline-none transition"
            style={{
              backgroundColor: active ? SOLID.card : "transparent",
              color: active ? TEXT.primary : TEXT.tertiary,
              transition,
              fontSize: TYPE.subhead.size,
              lineHeight: TYPE.subhead.lineHeight,
              fontWeight: TYPE.subhead.weight,
              letterSpacing: TYPE.subhead.tracking,
              border: "none",
              cursor: "pointer",
            }}
          >
            {option.icon}
            <span className="whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
