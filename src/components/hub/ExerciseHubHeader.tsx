/**
 * ExerciseHubHeader.tsx — the exercise's name, and proof the session is still running.
 *
 * Why this header earns its own file
 * ----------------------------------
 * The hub is the first screen an athlete opens *after* starting a workout, so the first
 * thing they need answered is "did I break my session by looking at this?". The answer
 * has to be on the screen before they can go looking for it, which means three things
 * here that the rest of the hub does not do:
 *
 *   1. **The way back, whenever there is one.** Always visible while a session runs, and
 *      absent otherwise -- a "back to session" button pointing at nothing is a dead
 *      control that looks like the screen's main action.
 *   2. **The session's clock, still counting.** Read from `ActiveSessionContext`, which
 *      lives above the router, so opening this screen did not pause anything. See
 *      `useElapsedMs` for why nothing needs persisting and why there is exactly one
 *      interval in the app.
 *   3. **Chips about this exercise, not about the app.** The quick read -- where this
 *      movement sits, how it is trending -- in one scrollable row, because an athlete who
 *      opened the hub mid-set wants the answer without descending into a tab.
 *
 * The chips scroll rather than wrap. Wrapping makes the header taller every time an
 * exercise gains a fact, and the tab strip below it moves; a header that resizes while
 * someone is reading it is worse than one that scrolls.
 */

import type { CSSProperties } from "react";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useElapsedMs, formatElapsed } from "@/hooks/useElapsedMs";
import { GLASS, MOTION, RADIUS, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";
import { HUB_LABELS } from "@/lib/i18n";

/** One chip in the header's scroll row. */
export interface HubChip {
  id: string;
  label: string;
  /** Optional glyph. The brief's `[🥇 Platino]` is a rank badge with an emoji in front. */
  glyph?: string;
  /**
   * Tints the chip.
   *
   * `neutral` for facts, `up` for progress, `down` for a warning. Deliberately not a
   * colour parameter: a caller passing a raw hex would put a literal in the tree, and the
   * token guard would (correctly) fail.
   */
  tone?: "neutral" | "up" | "down";
}

export interface ExerciseHubHeaderProps {
  exerciseName: string;
  /** The quick facts. Rendered in order; empty renders no row at all. */
  chips?: readonly HubChip[];
  /** Where "back" goes. Only rendered when `showBack` is true. */
  onBack?: () => void;
}

export function ExerciseHubHeader({ exerciseName, chips, onBack }: ExerciseHubHeaderProps) {
  const { session, isActive } = useActiveSession();
  const elapsedMs = useElapsedMs(session?.startedAt);
  const elapsed = formatElapsed(elapsedMs);

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.sm,
        paddingBottom: SPACE.sm,
        borderBottom: `1px solid ${GLASS.border}`,
      }}
    >
      <div style={topRow}>
        {/*
          The way back is a button and not a bare arrow, and it sits before the title rather
          than after: the athlete arrived here from the strip, so "back" is where they are
          pointing and the title is what they are reading. Title second means the arrow is
          the first thing under their thumb on the way in.
        */}
        {isActive && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="cronos-hub-back"
            aria-label={HUB_LABELS.backToSessionAriaLabel(session?.title ?? "")}
            style={backButton}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {HUB_LABELS.backToSession}
          </button>
        ) : (
          <span style={{ flex: 1 }} />
        )}

        {isActive && session ? (
          <SessionChip title={session.title} elapsed={elapsed} />
        ) : (
          <span style={{ flex: 1 }} />
        )}
      </div>

      <h1 style={title}>{exerciseName}</h1>

      {chips && chips.length > 0 ? <ChipRow chips={chips} /> : null}
    </header>
  );
}

/**
 * The session's own clock, in miniature.
 *
 * `role="status"` with `aria-live="polite"`, and the clock is *outside* the live region:
 * a per-second announcement would be a screen reader talking over the athlete for as long
 * as they are on this screen. The label carries the time and updates as one string, which
 * means a screen reader re-announces it once a minute -- when the minute actually changes
 * -- rather than once a second.
 */
function SessionChip({ title, elapsed }: { title: string; elapsed: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={HUB_LABELS.sessionRunningAriaLabel(title, elapsed)}
      style={sessionChip}
    >
      <span aria-hidden="true" style={{ opacity: 0.7 }}>
        {HUB_LABELS.sessionRunning}
      </span>
      <span aria-hidden="true" style={clock}>
        {elapsed}
      </span>
    </span>
  );
}

function ChipRow({ chips }: { chips: readonly HubChip[] }) {
  return (
    <div
      role="group"
      aria-label={HUB_LABELS.chipsAriaLabel}
      style={{
        display: "flex",
        gap: SPACE.xs,
        // Horizontal scroll rather than wrap: a header that grows with the data moves the
        // tab strip underneath it, and the athlete is reading that strip.
        overflowX: "auto",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {chips.map((chip) => (
        <HubChipPill key={chip.id} chip={chip} />
      ))}
    </div>
  );
}

/** One pill. Exported so the chips can be asserted on without rendering the whole header. */
export function HubChipPill({ chip }: { chip: HubChip }) {
  const tone = chip.tone ?? "neutral";
  return (
    <span style={{ ...pillStyle, ...toneFor(tone) }}>
      {chip.glyph ? (
        <span aria-hidden="true" style={{ fontSize: TYPE.caption.size }}>
          {chip.glyph}
        </span>
      ) : null}
      {tone === "up" ? (
        <TrendingUp size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
      ) : tone === "down" ? (
        <TrendingDown size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
      ) : null}
      <span style={{ whiteSpace: "nowrap" }}>{chip.label}</span>
    </span>
  );
}

function toneFor(tone: HubChip["tone"]): CSSProperties {
  if (tone === "up") {
    // `STATUS.success` rather than a literal green, for the reason `tokens.ts` gives: a
    // saturated green next to `STATUS.warning`'s amber collapses for a deuteranope, and
    // the chips put progress and warnings side by side.
    return { borderColor: STATUS.success.border, color: STATUS.success.text };
  }
  if (tone === "down") {
    return { borderColor: STATUS.warning.border, color: STATUS.warning.text };
  }
  return { borderColor: GLASS.border, color: TEXT.secondary };
}

const topRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.sm,
  minHeight: MOTION.minTouchTarget,
};

const backButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: MOTION.minTouchTarget,
  padding: "0 12px 0 8px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${GLASS.border}`,
  background: GLASS.fill,
  color: TEXT.primary,
  fontSize: TYPE.caption.size,
  fontWeight: TYPE.subhead.weight,
  cursor: "pointer",
  // A child of the top row that can shrink. Without this a long Spanish label plus the
  // session chip overflows a 320px phone, and the clock is what gets pushed off.
  minWidth: 0,
};

const sessionChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: SPACE.xs,
  padding: "4px 10px",
  borderRadius: RADIUS.pill,
  // Glass, not the accent. The tab strip below already wears the accent to say "you are
  // here", and a second accent next to it turns two different questions -- "is my session
  // alive" and "which view am I on" -- into a contest the athlete has to adjudicate.
  border: `1px solid ${GLASS.borderStrong}`,
  background: GLASS.fill,
  color: TEXT.secondary,
  fontSize: TYPE.caption.size,
  flexShrink: 0,
};

const clock: CSSProperties = {
  // The digits change every second. A proportional digit would make the chip breathe,
  // which on a header the athlete glances at looks like something is loading.
  fontFamily: TYPE.mono.font,
  fontVariantNumeric: "tabular-nums",
  color: TEXT.primary,
  fontWeight: TYPE.mono.weight,
};

const title: CSSProperties = {
  margin: 0,
  fontSize: TYPE.title2.size,
  lineHeight: TYPE.title2.lineHeight,
  fontWeight: TYPE.title2.weight,
  letterSpacing: TYPE.title2.tracking,
  color: TEXT.primary,
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  flexShrink: 0,
  padding: "4px 10px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${GLASS.border}`,
  background: GLASS.fill,
  fontSize: TYPE.caption.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
};