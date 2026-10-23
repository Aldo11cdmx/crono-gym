/**
 * FeatureFlagSwitch.tsx — the four toggles the God Mode panel owns.
 *
 * A switch, not a checkbox, because the thing it controls is not a
 * "select this" but a "turn this on or off", and `role="switch"` is what
 * tells a screen reader that. The visual is a track plus a knob, drawn
 * entirely from tokens: no raw white alphas, no raw hex, no raw duration.
 *
 * Keyboard: the element is a `<button>`, so Enter and Space work by
 * default and the focus ring is the global one from `stateRules()`. The
 * visible hit area is `MOTION.minTouchTarget` (44px) even when the drawn
 * track is narrower, because a tap target that is smaller than a thumb is
 * the thing WCAG 2.5.5 exists to catch.
 *
 * Persistence is the caller's job. This component takes `value`,
 * `onChange` and `disabled`, and nothing else: a switch that also reached
 * for IndexedDB would be a switch that could not be tested.
 */

import { type CSSProperties, type ReactNode } from "react";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SOLID,
  SPACE,
  TEXT,
  TYPE,
} from "@/design/tokens";

export interface FeatureFlagSwitchProps {
  /** The flag's current value. */
  value: boolean;
  /** Called with the next value on a toggle. */
  onChange: (next: boolean) => void;
  /** Label shown beside the track; also the accessible name. */
  label: string;
  /** Short line under the label explaining what the flag does. */
  hint?: string;
  /** Disables the toggle without implying the flag is off. */
  disabled?: boolean;
  /** Optional leading icon, decorative. */
  icon?: ReactNode;
  /** Stable id so a label can point at the control. */
  id?: string;
}

/**
 * One on/off toggle.
 *
 * The track is `SOLID.card` when off and `ACCENT.base` when on, with the knob
 * sliding between the two. Both states are drawn from tokens; the only
 * motion is the knob's translate, at `MOTION.fast`, and it is gated behind
 * `prefers-reduced-motion` by the caller through the global rule set.
 */
export function FeatureFlagSwitch({
  value,
  onChange,
  label,
  hint,
  disabled = false,
  icon,
  id,
}: FeatureFlagSwitchProps) {
  const labelId = id ? `${id}-label` : undefined;

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={value}
      aria-labelledby={labelId}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => onChange(!value)}
      style={switchRootStyle}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: SPACE.sm, minWidth: 0 }}>
        {icon && <span aria-hidden="true" style={{ flexShrink: 0, color: TEXT.secondary }}>{icon}</span>}
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span id={labelId} style={{ ...TYPE.label, color: TEXT.primary, textTransform: "none", letterSpacing: "0" }}>
            {label}
          </span>
          {hint && (
            <span style={{ ...TYPE.caption, color: TEXT.tertiary }}>{hint}</span>
          )}
        </span>
      </span>

      <span
        aria-hidden="true"
        style={{
          ...trackStyle,
          backgroundColor: value ? ACCENT.base : SOLID.card,
          borderColor: value ? ACCENT.base : GLASS.border,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: RADIUS.round,
            backgroundColor: value ? TEXT.onAccent : TEXT.secondary,
            transform: value ? "translateX(22px)" : "translateX(0)",
            transition: `transform ${MOTION.fast} ${MOTION.standard}`,
          }}
        />
      </span>
    </button>
  );
}

const switchRootStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACE.md,
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: `${SPACE.xs} ${SPACE.md}`,
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.borderStrong}`,
  backgroundColor: GLASS.fillRaised,
  color: TEXT.primary,
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
};

const trackStyle: CSSProperties = {
  flexShrink: 0,
  width: 46,
  height: 26,
  borderRadius: RADIUS.pill,
  border: `1px solid`,
  padding: 2,
  display: "inline-flex",
  alignItems: "center",
};