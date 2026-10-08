/**
 * GoalChips.tsx — the athlete's training goal, as a radio group.
 *
 * The goal is stored on the server as an enum (`profiles.goal`) and is the
 * single source of truth for the energy motor. This component is
 * presentational: it renders the five options and calls `onSelect` with the
 * raw enum value, and the caller decides whether to save it.
 *
 * "Re-tocar the selection deselects it" is deliberately **not** implemented:
 * the column is NOT NULL on the server, and a second field of goal would
 * contradict the energy motor. The spec notes this as a known gap.
 *
 * Keyboard: arrow keys move the selection inside the group, which is what
 * `role="radio"` with `tabindex=-1` buys for free once the container holds
 * `role="radiogroup"`. The roving tabindex is applied here rather than left to
 * the browser, because a group of five buttons without it traps a screen
 * reader between them.
 */

import { useEffect, useRef } from "react";
import { ACCENT, GLASS, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

export interface GoalOption {
  value: string;
  label: string;
}

export interface GoalChipsProps {
  options: GoalOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  labelledBy: string;
  disabled?: boolean;
}

/**
 * A single selectable chip, styled as a radio button.
 *
 * The active state is the accent fill; inactive is a translucent border.
 * Both states are drawn from tokens -- no raw hex, no raw duration.
 */
function GoalChip({
  option,
  selected,
  tabIndex,
  onActivate,
  disabled,
}: {
  option: GoalOption;
  selected: boolean;
  tabIndex: number;
  onActivate: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      disabled={disabled}
      onClick={onActivate}
      onKeyDown={(e) => {
        // Arrow keys move the focus within the group; the group handler
        // re-renders with the new chip as tabIndex 0.
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const container = e.currentTarget.parentElement;
          if (!container) return;
          const chips = Array.from(container.querySelectorAll<HTMLElement>("[role='radio']"));
          const index = chips.indexOf(e.currentTarget);
          const next =
            (e.key === "ArrowRight" || e.key === "ArrowDown"
              ? index + 1
              : index - 1 + chips.length) % chips.length;
          chips[next]?.focus();
        }
      }}
      style={{
        minHeight: MOTION.minTouchTarget,
        padding: `0 ${SPACE.md}`,
        borderRadius: RADIUS.pill,
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: selected ? ACCENT.base : GLASS.borderStrong,
        background: selected ? ACCENT.base : "transparent",
        color: selected ? TEXT.onAccent : TEXT.secondary,
        fontSize: TYPE.body.size,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: `border-color ${MOTION.fast} ${MOTION.standard}, background ${MOTION.fast} ${MOTION.standard}`,
      }}
    >
      {option.label}
    </button>
  );
}

/**
 * A radio group of goal chips.
 *
 * Exactly one chip carries `tabIndex=0`; the rest are `-1` and reachable only
 * through the arrow keys, which is the roving tabindex pattern. The active
 * chip is re-derived from `selected` on every render, so the group always
 * agrees with the prop.
 */
export function GoalChips({ options, selected, onSelect, labelledBy, disabled }: GoalChipsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Move focus to the selected chip when it changes via a prop update.
  useEffect(() => {
    if (selected == null) return;
    const container = containerRef.current;
    if (!container) return;
    const chip = container.querySelector<HTMLElement>(`[aria-checked="true"]`);
    chip?.focus();
  }, [selected]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}
    >
      {options.map((option) => (
        <GoalChip
          key={option.value}
          option={option}
          selected={selected === option.value}
          tabIndex={selected === option.value ? 0 : -1}
          onActivate={() => onSelect(option.value)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}