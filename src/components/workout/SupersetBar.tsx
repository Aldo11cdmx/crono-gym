/**
 * SupersetBar.tsx — the vertical strip that marks a bubble as part of a group.
 *
 * The strip is the *shape* of the grouping: the same colour down the side of
 * every bubble that belongs to the same superset, so the athlete sees which
 * bubbles go together before reading a single word.
 *
 * Why a strip and not a coloured bubble
 * -------------------------------------
 * The bubble's border already carries the three states of the strip itself --
 * accent for the exercise on screen, success for a finished one, an inert
 * hairline for a pending one. A fourth meaning painted on the same border
 * would make one of the four unreadable, and the one that would lose is the
 * state the athlete is looking for: which exercise am I on.
 *
 * So the group's colour goes somewhere the states do not reach: a 3px strip
 * down the left edge, exactly as tall as the bubble, rounded at the top of the
 * group and at the bottom of it and flat in between, which is how a bracket
 * reads when it is broken into pieces.
 *
 * The geometry is deliberately tight. The strip is anchored to the bubble's own
 * box, so it cannot drift when the bubble scales up, and it stops short of the
 * strip's scroll container -- whose vertical overflow is clipped whether it
 * asks for it or not -- so it is never cut off at the top.
 *
 * Decorative: it is `aria-hidden`, because the badge beside it already says
 * what the strip shows.
 */

import type { SupersetTone } from "../../design/tokens";
import { RADIUS } from "../../design/tokens";

export interface SupersetBarProps {
  /** The colour the group is painted in. */
  tone: SupersetTone;
  /** True for the first exercise of the group: the strip starts with a cap. */
  isFirst: boolean;
  /** True for the last one: the strip ends with a cap. */
  isLast: boolean;
  /** True when this group is the one on screen. */
  active: boolean;
}

export function SupersetBar({ tone, isFirst, isLast, active }: SupersetBarProps) {
  return (
    <span
      aria-hidden="true"
      data-testid="superset-bar"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 3,
        height: 56,
        // The cap: rounded where the group starts and where it ends, flat
        // between, so a run of strips reads as one broken bracket.
        borderRadius: isFirst && isLast
          ? RADIUS.pill
          : isFirst
            ? `${RADIUS.pill} ${RADIUS.pill} 0 0`
            : isLast
              ? `0 0 ${RADIUS.pill} ${RADIUS.pill}`
              : "0",
        // The group on screen is painted in full; the others are dimmed but
        // still there, because "not the one you are doing" is not "not in a
        // group".
        background: active ? tone.base : tone.border,
        pointerEvents: "none",
      }}
    />
  );
}
