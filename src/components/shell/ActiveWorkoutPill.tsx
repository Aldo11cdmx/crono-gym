/**
 * ActiveWorkoutPill.tsx — "your workout is still running" from anywhere.
 *
 * This exists because the session outlives the screen. A user who starts a
 * workout, taps a link, and lands on the ranks view has not stopped training, but
 * without this they either cannot tell that or have to navigate back blind to find
 * out. One tap resumes.
 *
 * Hidden on the training route itself: there the workout is already the whole
 * screen, so the pill would be a second copy of the answer to a question the user
 * just asked.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { useActiveSession, type ActiveSession } from "@/context/ActiveSessionContext";
import { useElapsedMs, formatElapsed } from "@/hooks/useElapsedMs";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ACCENT, GLASS, MOTION, RADIUS, TEXT, Z_INDEX } from "@/design/tokens";
import { SHELL_LABELS } from "@/lib/i18n";
import { TRAIN_PATH } from "./navItems";
import { NAV_CONTENT_HEIGHT, PILL_GAP } from "./AppShell";

/** Maximum visible characters of a routine name, ellipsis included. */
export const ROUTINE_NAME_MAX = 20;

/** Past this, the pill shifts to the warmer accent. */
export const LONG_SESSION_MS = 2 * 60 * 60 * 1000;

/** Matches `MOTION.slow`, which is the token the exit is timed against. */
const EXIT_MS = 320;

/**
 * Clips a routine name to {@link ROUTINE_NAME_MAX} *total* characters.
 *
 * The ellipsis is counted inside the budget, not added to it, so the pill's width
 * does not change shape between a name that just fits and one that does not.
 */
export function truncateRoutineName(name: string): string {
  if (name.length <= ROUTINE_NAME_MAX) return name;
  return `${name.slice(0, ROUTINE_NAME_MAX - 1)}…`;
}

/** Elapsed time as `MM:SS`. Minutes are not capped: a 3-hour session is `180:00`. */
export { formatElapsed };

type Phase = "idle" | "enter" | "leave";

export function ActiveWorkoutPill() {
  const { session } = useActiveSession();
  const reducedMotion = useReducedMotion();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // The exiting pill keeps rendering for the length of its own fade. Unmounting
  // on the same tick the session clears would make the element disappear rather
  // than leave, which reads as a glitch instead of a dismissal.
  const [shown, setShown] = useState<ActiveSession | null>(session);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (session) {
      setShown(session);
      setPhase("enter");
      return;
    }
    setPhase((current) => (current === "enter" ? "leave" : current));
  }, [session]);

  useEffect(() => {
    if (phase !== "leave") return;
    if (reducedMotion) {
      setShown(null);
      setPhase("idle");
      return;
    }
    const timer = window.setTimeout(() => {
      setShown(null);
      setPhase("idle");
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  // One clock, owned by one hook. An interval that is not cleared is the leak that keeps a
  // jsdom test file open; an interval that *is* created twice is the drift nobody sees until
  // two readings of one session disagree.
  const elapsedMs = useElapsedMs(shown?.startedAt);

  if (!shown) return null;
  // The screen the user is on *is* the workout, so the pill would repeat it.
  if (pathname === TRAIN_PATH) return null;

const elapsed = formatElapsed(elapsedMs);
  const isLong = elapsedMs > LONG_SESSION_MS;
  const accent = isLong ? ACCENT.secondary : ACCENT.base;

  return (
    <button
      type="button"
      // `status` rather than `alert`: this is a persistent state announcement,
      // not something that interrupts. `polite` so it waits for a pause instead
      // of cutting across whatever the screen reader is currently saying.
      role="status"
      aria-live="polite"
      // Recomputed every second but only *changes* once a minute, because the
      // string does: a screen reader re-announces an attribute only when its
      // value differs, so a per-second aria-label would still be one word a
      // minute rather than one announcement a second.
      aria-label={SHELL_LABELS.pillAriaLabel(shown.title, elapsed)}
      onClick={() => navigate(TRAIN_PATH)}
      className="cronos-pill"
      style={
        {
          position: "fixed",
          left: "50%",
          transform: `translateX(-50%) translateY(${phase === "enter" && !reducedMotion ? 8 : 0}px)`,
          bottom: `calc(${NAV_CONTENT_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${PILL_GAP}px)`,
          zIndex: Z_INDEX.pill,
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: "min(92vw, 420px)",
          minHeight: MOTION.minTouchTarget,
          padding: "8px 16px",
          borderRadius: RADIUS.pill,
          backgroundColor: GLASS.fillRaised,
          border: `1px solid ${accent}`,
          color: TEXT.primary,
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          boxShadow: GLASS.shadow,
          cursor: "pointer",
          opacity: phase === "leave" ? 0 : 1,
          transition: reducedMotion
            ? "none"
            : `opacity ${MOTION.slow} ${MOTION.standard}, transform ${MOTION.slow} ${MOTION.standard}`,
        } satisfies CSSProperties
      }
    >
      <Zap
        aria-hidden="true"
        size={16}
        color={accent}
        fill={accent}
        className="shrink-0"
      />
      <span
        style={{
          // Both children are capped rather than the row, so the clock never gets
          // squeezed to nothing by a long routine name.
          maxWidth: ROUTINE_NAME_MAX + "ch",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        {truncateRoutineName(shown.title)}
      </span>
      {/* Numeric, so the digits must not shift as they change. */}
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontSize: "13px",
          fontWeight: 500,
          color: accent,
        }}
      >
        {elapsed}
      </span>
    </button>
  );
}