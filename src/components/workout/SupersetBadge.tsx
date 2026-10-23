/**
 * SupersetBadge.tsx — the chip that says which group an exercise belongs to.
 *
 * "SUPERSET A • 1/2"
 *
 * Three facts in one chip, because the athlete reads it mid-set and has one
 * glance to spend: which group this is ("A"), where the exercise sits in it
 * ("1") and how big the group is ("2"). The strip shows the *shape* of the
 * group -- the coloured bar that joins the bubbles -- and the badge says what
 * that shape means in words, so the information survives a monochrome screen.
 *
 * The chip is not the accent, and it is not a status: a superset is a
 * relationship between exercises, not something the athlete did and not
 * something that went wrong. It wears the group's own colour instead, which is
 * the only thing on the strip that is allowed to change hue.
 *
 * Read-only, like every other description of the session: nothing here can be
 * tapped into.
 */

import { SUPERSET_LABELS } from "../../lib/i18n";
import type { SupersetTone } from "../../design/tokens";
import { RADIUS, SPACE, TYPE } from "../../design/tokens";

export interface SupersetBadgeProps {
  /** The letter the group is labelled with: "A", "B", "C"... */
  label: string;
  /** Where this exercise sits in the group, counting from 1. */
  position: number;
  /** How many exercises the group holds. */
  total: number;
  /** The colour the group is painted in. */
  tone: SupersetTone;
}

export function SupersetBadge({ label, position, total, tone }: SupersetBadgeProps) {
  return (
    <span
      role="img"
      aria-label={SUPERSET_LABELS.badgeAriaLabel(label, position, total)}
      data-testid="superset-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.xs,
        maxWidth: "100%",
        padding: `0 ${SPACE.sm}`,
        borderRadius: RADIUS.pill,
        background: tone.muted,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        fontFamily: TYPE.mono.font,
        fontSize: TYPE.label.size,
        lineHeight: TYPE.label.lineHeight,
        fontWeight: TYPE.label.weight,
        letterSpacing: TYPE.label.tracking,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {SUPERSET_LABELS.badgeText(label, position, total)}
    </span>
  );
}
