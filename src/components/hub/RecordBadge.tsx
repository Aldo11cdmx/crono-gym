/**
 * RecordBadge.tsx — the "you just beat your record" notice.
 *
 * Four seconds, then it is gone, with a spring on the way in.
 *
 * Why it is a spring
 * ------------------
 * `MOTION.spring` overshoots, and this is the one notification in the app that is *good
 * news*, arriving at the exact moment somebody is mid-set. A fade would be flat and a
 * linear slide would be mechanical; the overshoot is the vocabulary for "picked up and
 * confirmed", and it is the same token `SetTable`'s completion tick uses, so the two
 * animations agree.
 *
 * Why it is not an `AudioContext` beep
 * ------------------------------------
 * The brief allowed one, optionally. Not shipping it is a decision, not an omission: an
 * `AudioContext` has to be constructed after a user gesture and resumed on every browser's
 * own schedule, and a PR is the one moment where a surprise noise out of a phone in a gym
 * is worse than no confirmation at all. The visual is enough, and it works with the
 * screen silent -- which is how most people train.
 *
 * The dismissal is timed, not conditional
 * ---------------------------------------
 * The timer starts when the record arrives, not when the component settles, so a re-render
 * mid-animation cannot restart the four seconds and leave the badge on screen indefinitely.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Sparkles, X } from "lucide-react";
import { HUB_RECORDS_LABELS } from "@/lib/i18n";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { GLASS, MOTION, RADIUS, SPACE, STATUS, TEXT, TYPE, Z_INDEX } from "@/design/tokens";

export interface RecordNotice {
  /** Stable id so the same record does not fire twice. */
  id: string;
  title: string;
}

export interface RecordBadgeProps {
  /** The record that was just broken. Null shows nothing at all. */
  notice: RecordNotice | null;
  /** Overridable for tests. Defaults to the label's four seconds. */
  autoDismissMs?: number;
}

export function RecordBadge({ notice, autoDismissMs }: RecordBadgeProps) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);

  /*
   * Keyed on `notice?.id`, not on `notice`.
   *
   * The object identity changes on every parent render that spells the notice out
   * inline -- `{ ...pr }`, a fresh literal in a map -- and depending on the object would
   * restart the four-second timer each time. The badge would then never leave: not because
   * the timer is wrong but because there is always a newer one. `id` is the stable thing
   * about a record, and `RecordNotice.id` exists for exactly this.
   */
  const noticeId = notice?.id ?? null;
  const noticeTitle = notice?.title ?? "";

  useEffect(() => {
    if (noticeId === null) return;

    // The dismiss runs first and unmounts the badge itself. A parent that had to clear the
    // notice would be a second thing to get right, and the usual result of forgetting is a
    // badge that never goes away.
    setLeaving(false);
    setVisible(true);

    const ms = autoDismissMs ?? HUB_RECORDS_LABELS.badgeAutoDismissMs;
    timer.current = window.setTimeout(() => {
      setLeaving(true);
      // The leaving badge keeps rendering for the length of its own exit. Unmounting on the
      // same tick would make it blink rather than leave, which reads as a glitch.
      timer.current = window.setTimeout(() => setVisible(false), reducedMotion ? 0 : EXIT_MS);
    }, ms);

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [noticeId, autoDismissMs, reducedMotion]);

  if (!notice || !visible) return null;

  return (
    <div
      // `alert` rather than `status`: this is interrupting information the athlete did not
      // ask for, and it is the only thing in the app that earns interrupting them.
      role="alert"
      aria-label={HUB_RECORDS_LABELS.badgeAriaLabel(noticeTitle)}
      data-leaving={leaving ? "true" : "false"}
      className={reducedMotion ? undefined : "cronos-record-pop"}
      style={{
        ...card,
        opacity: leaving ? 0 : 1,
        transform: leaving ? "translateY(8px) scale(0.96)" : "translateY(0) scale(1)",
        transition: reducedMotion
          ? "none"
          : // `MOTION.easeIn`, not `easeOut`: this is the badge leaving the screen, and
            // easeIn is the token for that -- it starts slow and accelerates away, which
            // reads as dismissing. `easeOut` here would make the badge linger, which reads
            // as the app hesitating.
            `opacity ${MOTION.normal} ${MOTION.easeIn}, transform ${MOTION.normal} ${MOTION.easeIn}`,
      }}
    >
      <Sparkles
        size={20}
        aria-hidden="true"
        style={{ color: STATUS.pr.text, flexShrink: 0 }}
      />

      <span style={title}>{noticeTitle}</span>

      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={HUB_RECORDS_LABELS.badgeDismissAriaLabel}
        style={close}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * How long the exit transition runs, in ms.
 *
 * Parsed out of `MOTION.normal` rather than written as a literal. The two have to be the
 * same number or the badge is either unmounted mid-fade (a blink) or held invisible for a
 * beat after it has gone, and a hand-written `240` next to a `250ms` token is exactly the
 * kind of pair that drifts the first time someone tunes the token.
 */
const EXIT_MS = Number.parseInt(MOTION.normal, 10);

/*
   * `STATUS.pr` violet, not `STATUS.warning` amber.
   *
   * The token refuses amber on purpose -- amber is this product's warning hue, so a record
   * shown in it reads as a caution, which is the opposite of the news. The purple also
   * cannot be confused with the cyan "the load went up" signal, so "you got stronger" and
   * "you set a record" stay two distinct pieces of information rather than one vague glow.
   *
   * `Sparkles` rather than a trophy, for the same reason as the colour: `STATUS.pr` names
   * `icon: "sparkle"`, and the glyph is what carries the tone on a glance.
   *
   * `Z_INDEX.toast` rather than a literal: a confirmation that a bottom bar can cover is not
   * a confirmation, and the token exists so that this is settled in one place.
   */
  const card: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
  transform: "translateX(-50%) translateY(0) scale(1)",
  zIndex: Z_INDEX.toast,
  display: "flex",
  alignItems: "center",
  gap: SPACE.sm,
  maxWidth: "min(92vw, 420px)",
  padding: "10px 12px",
  borderRadius: RADIUS.card,
  background: GLASS.fillRaised,
  border: `1px solid ${STATUS.pr.border}`,
  color: TEXT.primary,
  backdropFilter: "blur(24px) saturate(140%)",
  WebkitBackdropFilter: "blur(24px) saturate(140%)",
  boxShadow: GLASS.shadow,
};

const title: CSSProperties = {
  flex: 1,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.subhead.weight,
};

const close: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 28,
  minHeight: 28,
  border: "none",
  background: "transparent",
  color: TEXT.tertiary,
  cursor: "pointer",
};