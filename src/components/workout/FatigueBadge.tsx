/**
 * FatigueBadge.tsx — "this set fell short", in reps.
 *
 * Why a number and not a word
 * -------------------------------
 * "Tired" is not a fact; "two reps short of the plan" is. The
 * badge carries the shortfall itself, so the athlete reading a
 * row of sets sees *how much* each set missed by, not a verdict
 * they would have to trust. The level -- mild or high -- is
 * carried by the chip's weight (outlined versus filled) and by
 * the spoken label ("Fatiga" versus "Fatiga alta"), so the two
 * levels are told apart without colour alone.
 *
 * Why amber
 * ------------
 * Fatigue is a warning about the session, not an error in it,
 * and not a record: it takes the warning token, which exists
 * for exactly this register, and leaves the accent free for
 * actions and the success green for completed work.
 *
 * Deliberately read-only: it describes a set that already
 * happened, and nothing about it can be tapped into.
 */

import { TrendingDown } from "lucide-react";
import { FATIGUE_LABELS } from "../../lib/i18n";
import type { FatigueLevel } from "../../lib/workout/fatigue";
import {
  RADIUS,
  SPACE,
  STATUS,
  TYPE,
} from "../../design/tokens";

export interface FatigueBadgeProps {
  /** How far the set fell short, in reps. Always at least 1. */
  shortfall: number;
  /** The level, which the chip's weight and label both carry. */
  level: Extract<FatigueLevel, "mild" | "high">;
}

export function FatigueBadge({ shortfall, level }: FatigueBadgeProps) {
  const high = level === "high";
  return (
    <span
      role="img"
      aria-label={FATIGUE_LABELS.badgeAriaLabel(level, shortfall)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: SPACE.xs,
        minHeight: "24px",
        padding: `0 ${SPACE.sm}`,
        borderRadius: RADIUS.pill,
        // High fatigue is a filled chip, mild an outline: the
        // two levels differ in weight, not only in hue.
        background: high ? STATUS.warning.muted : "transparent",
        border: `1px solid ${STATUS.warning.border}`,
        color: STATUS.warning.text,
        fontSize: TYPE.label.size,
        fontWeight: TYPE.label.weight,
        letterSpacing: TYPE.label.tracking,
      }}
    >
      <TrendingDown size={12} aria-hidden="true" />
      {FATIGUE_LABELS.shortfallText(shortfall)}
    </span>
  );
}
