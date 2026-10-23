/**
 * PlateauAlert.tsx — what `detectPlateau` concluded, in the athlete's words.
 *
 * The engine returns a discriminated union with four cases and precise numbers. This
 * component's whole job is to translate without losing the honesty of them, which is why
 * the "not enough data" cases get their own branch instead of being folded into "you're
 * fine": telling someone they have not plateaued after two sessions would be inventing a
 * result.
 *
 * The suggestion is not the verdict
 * ---------------------------------
 * `PLATEAU_RULES` decides *whether* something has stalled. What to do about it is a coaching
 * judgement, and there are two defensible ones that point opposite ways -- add weight, or
 * back off. Both are offered, because a screen that picks one is making a decision the
 * product has not made. Which one is right depends on whether the stall is fatigue or a
 * ceiling, and nothing in the data says which.
 */

import { AlertTriangle, TrendingUp } from "lucide-react";
import { detectPlateau, type PlateauVerdict } from "@/lib/exercise/exercisePlateau";
import type { ExerciseSession } from "@/lib/exercise/exerciseHistory";
import { HUB_PROGRESS_LABELS } from "@/lib/i18n";
import { GLASS, RADIUS, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";
import type { CSSProperties } from "react";

export interface PlateauAlertProps {
  sessions: readonly ExerciseSession[];
  /** Display formatter for a kg value, so the shortfall reads in the user's unit. */
  formatWeight: (kg: number) => string;
  /**
   * Injected rather than read from the clock.
   *
   * `detectPlateau` already takes `now`, and letting a component reach for `Date.now()`
   * would make the same three sessions say "too little time" in March and "plateau" in
   * June -- which is exactly the bug that was fixed in the engine and would come straight
   * back through the UI.
   */
  now: number;
}

export function PlateauAlert({ sessions, formatWeight, now }: PlateauAlertProps) {
  const verdict = detectPlateau(sessions, now);

  if (verdict.status === "insufficient_data") {
    return (
      <Notice
        icon={<AlertTriangle size={14} aria-hidden="true" />}
        tone="neutral"
        title={
          verdict.reason === "too_few_sessions"
            ? HUB_PROGRESS_LABELS.plateauInsufficientFew
            : HUB_PROGRESS_LABELS.plateauInsufficientTime(verdict.daysSinceFirst)
        }
      />
    );
  }

  if (verdict.status === "progressing") {
    return (
      <Notice
        icon={<TrendingUp size={14} aria-hidden="true" />}
        tone="up"
        title={HUB_PROGRESS_LABELS.progressing(formatWeight(verdict.gainKg))}
      />
    );
  }

  return (
    <Notice
      icon={<AlertTriangle size={14} aria-hidden="true" />}
      tone="down"
      title={HUB_PROGRESS_LABELS.plateau(
        formatWeight(verdict.shortfallKg),
        verdict.sessionsSinceProgress,
      )}
    >
      <p style={suggestionText}>
        {HUB_PROGRESS_LABELS.plateauSuggestionUp}
      </p>
      <p style={suggestionText}>
        {HUB_PROGRESS_LABELS.plateauSuggestionDeload}
      </p>
    </Notice>
  );
}

function Notice({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "neutral" | "up" | "down";
  children?: React.ReactNode;
}) {
  return (
    // A `div`, not a `section`. An unnamed `<section>` is an ARIA landmark with no name,
    // which puts a phantom "region" in the accessibility tree for every notice on the screen
    // and gives a screen-reader user nothing to navigate to. This is a paragraph with a
    // border, and it should say as much.
    //
    // `role="status"` would be worse still: it announces a verdict the athlete did not ask
    // for while they are scrolling a chart. The plateau case is the one worth announcing,
    // and it is the one that carries a change -- so this is silent and the athlete reads it
    // when they read it.
    <div style={{ ...notice, ...toneFor(tone) }}>
      <p style={titleRow}>
        {icon}
        <span>{title}</span>
      </p>
      {children}
    </div>
  );
}

function toneFor(tone: "neutral" | "up" | "down"): CSSProperties {
  if (tone === "up") return { borderColor: STATUS.success.border };
  if (tone === "down") return { borderColor: STATUS.warning.border };
  return { borderColor: GLASS.border };
}

const notice: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.xs,
  padding: SPACE.md,
  borderRadius: RADIUS.card,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
};

const titleRow: CSSProperties = {
  margin: 0,
  display: "flex",
  alignItems: "flex-start",
  gap: "6px",
  fontSize: TYPE.subhead.size,
  lineHeight: TYPE.subhead.lineHeight,
  fontWeight: TYPE.subhead.weight,
  color: TEXT.primary,
};

const suggestionText: CSSProperties = {
  margin: 0,
  paddingLeft: "20px",
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  color: TEXT.tertiary,
};

export type { PlateauVerdict };