/**
 * CoachAccessGate.tsx — the three refusals, as three components.
 *
 * The premium tier and the shift schedule are three independent conditions -- you pay,
 * you are a coach, somebody is working -- and they are three separate refusals with three
 * different fixes. So they are three components rather than one gate with a `requires`
 * prop.
 *
 * That is not a style preference. A `requires="premium" | "coach_pin" | "on_shift"` prop
 * makes every call site a string literal at a distance from the logic, so the set of
 * possible states becomes combinations of three things: which prop, in which order, and
 * who supplies the state. The order matters and is invisible. Render the PIN gate outside
 * the premium gate and a free athlete is asked for a coach's PIN to reach a screen they
 * cannot use; render the shift gate outside the premium gate and someone who does not pay
 * is told when the coach is next on duty. Composing the gates as components makes the
 * order the order of the JSX, which is the thing a reader can actually see.
 *
 * All three share one shape, and it is the shape that matters:
 *
 *   - `children` renders only when the condition holds.
 *   - `fallback` replaces it when it does not, and defaults to the message here.
 *
 * A `fallback` prop rather than a hardcoded block, because a refusal is not always the end
 * of the story. The coach portal wants its own lock button inside the message; a marketing
 * surface wants a link to the plans. Copying the message into the prop to change one line
 * of it would fork it, and the two would drift.
 */

import { useId, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useCoachAuth } from "./useCoachAuth";
import { isPremiumActive, type CoachProfile, type HumanCoachStatus } from "./access";
import { COACH_ACCESS_LABELS, COACH_PORTAL_LABELS } from "../i18n";
import { useLockoutCountdown } from "../../hooks/useLockoutCountdown";
import {
  DANGER,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SOLID,
  SPACE,
  SURFACE_ROLE,
  TEXT,
  TYPE,
} from "../../design/tokens";

// ---------------------------------------------------------------- premium gate

export interface PremiumGateProps {
  /**
   * The athlete's entitlement, or null while it is unknown.
   *
   * Null is read as not-premium. A gate cannot render "probably yes" -- there is no
   * version of this that shows paid surfaces on an unconfirmed row and then takes them
   * away a frame later.
   */
  profile: CoachProfile | null;
  children: ReactNode;
  /** Replaces the default message. */
  fallback?: ReactNode;
}

/**
 * Renders `children` only for an athlete with the premium tier active.
 *
 * Wrapped around the *human* coach surfaces and never around Symmetry. Vía A is free, and
 * a free athlete who cannot open the assistant has been shipped a paywall by accident.
 */
export function PremiumGate({ profile, children, fallback }: PremiumGateProps) {
  if (profile !== null && isPremiumActive(profile)) return <>{children}</>;
  return <>{fallback ?? <PremiumNotice />}</>;
}

/** The default refusal: what the tier is, and what stays available without it. */
function PremiumNotice() {
  return (
    <NoticeCard
      title={COACH_ACCESS_LABELS.premiumRequiredTitle}
      body={COACH_ACCESS_LABELS.premiumRequiredBody}
    />
  );
}

// ------------------------------------------------------------------ shift gate

export interface ShiftGateProps {
  status: HumanCoachStatus;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders `children` only while a coach is on shift.
 *
 * A premium athlete between shifts is not refused and is not forgotten: the fallback
 * names the time the coach returns and says the conversation is kept. The alternative --
 * showing nothing, or hiding the screen -- reads as being logged out of something they
 * paid for, which is the specific impression this product cannot afford.
 *
 * Note what the fallback is *not* told: the athlete's tier. A non-premium athlete should
 * never reach this gate, and if one does the shift message is still the truthful thing to
 * show rather than a second paywall stacked on top of the first.
 */
export function ShiftGate({ status, children, fallback }: ShiftGateProps) {
  if (status.state === "available") return <>{children}</>;
  return <>{fallback ?? <OffShiftNotice status={status} />}</>;
}

function OffShiftNotice({ status }: { status: HumanCoachStatus }) {
  const opensAt = status.nextShiftStart;
  return (
    <NoticeCard
      title={COACH_ACCESS_LABELS.offShiftTitle}
      body={
        opensAt === null
          ? COACH_ACCESS_LABELS.offShiftNoTime
          : COACH_ACCESS_LABELS.offShiftBody(formatClock(opensAt.isoString))
      }
    />
  );
}

// ------------------------------------------------------------------- pin gate

export interface CoachPinGateProps {
  children: ReactNode;
  /** Replaces the whole PIN form, not just the message. */
  fallback?: ReactNode;
}

/**
 * Renders `children` only while a coach session is held.
 *
 * The only gate that knows about the PIN, and the only one that renders a form -- which
 * is why it is also the only one that reads `useCoachAuth` itself. The other two take
 * their state as a prop, so a test can drive them with a literal and this one cannot be
 * tested that way; it is exercised through a mocked function instead, which is the price
 * of being the gate that owns a request.
 */
export function CoachPinGate({ children, fallback }: CoachPinGateProps) {
  const auth = useCoachAuth();

  if (auth.isUnlocked) return <>{children}</>;
  return <>{fallback ?? <CoachPinForm />}</>;
}

/**
 * The PIN form, and the change-PIN form when one is required.
 *
 * One component for both because they share everything except the field count and the
 * label on the submit button, and two components would duplicate the error rendering, the
 * lockout notice and the disabled-while-submitting rule -- all of which are the parts most
 * likely to be wrong.
 *
 * `type="password"` with `inputMode="numeric"`: the field must mask a credential, and the
 * numeric keypad is a convenience rather than a constraint -- `maxLength` and the
 * length rule in {@link COACH_ACCESS_LABELS.pinRequirements} do the enforcing, so a PIN
 * that somehow arrives with a letter is refused by the server rather than silently
 * mangled here.
 */
function CoachPinForm() {
  const auth = useCoachAuth();
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const titleId = useId();
  const errorId = useId();

  const changing = auth.requiresPinChange;
  const lockedUntil = auth.lockedUntil;
  const message = auth.error ? COACH_ACCESS_LABELS.pinErrors[auth.error.code] : null;
  const wasLockedOut = auth.error?.code === "TOO_MANY_ATTEMPTS";

  /*
   * The live countdown, and the reason the form is disabled from *this* rather than from
   * `lockedUntil`.
   *
   * `lockedUntil` is an instant that never changes, so `lockedUntil !== null` stayed true for
   * the whole fifteen minutes: the form was disabled until the coach reloaded the page, and
   * the notice showed the one clock time it would ever show. Ticking locally releases the
   * form when the countdown ends; if the server's block is genuinely still up, `coach-auth`
   * refuses the PIN and reports the lockout again. A coach who is told to wait and then never
   * released is a far worse failure than one who is told to wait, waits, and is told no.
   */
  const remainingMs = useLockoutCountdown(wasLockedOut ? lockedUntil : null);
  const locked = remainingMs !== null;
  const disabled = auth.isLoading || locked;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if (changing) await auth.changePin(pin, newPin);
    else await auth.unlock(pin);
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby={titleId}
      aria-describedby={message ? errorId : undefined}
      style={cardStyle}
    >
      <h2 id={titleId} style={titleStyle}>
        {changing ? COACH_ACCESS_LABELS.pinChangeTitle : COACH_ACCESS_LABELS.pinTitle}
      </h2>
      <p style={bodyStyle}>
        {changing ? COACH_ACCESS_LABELS.pinChangeSubtitle : COACH_ACCESS_LABELS.pinSubtitle}
      </p>

      <label style={fieldStyle}>
        <span style={fieldLabelStyle}>
          {changing ? COACH_ACCESS_LABELS.pinCurrentLabel : COACH_ACCESS_LABELS.pinLabel}
        </span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          maxLength={12}
          disabled={disabled}
          aria-label={
            changing
              ? COACH_ACCESS_LABELS.pinCurrentAriaLabel
              : COACH_ACCESS_LABELS.pinInputAriaLabel
          }
          onChange={(event) => {
            setPin(event.target.value);
          }}
          style={inputStyle}
        />
      </label>

      {changing && (
        <>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>{COACH_ACCESS_LABELS.pinNewLabel}</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={newPin}
              maxLength={12}
              disabled={disabled}
              aria-label={COACH_ACCESS_LABELS.pinNewAriaLabel}
              onChange={(event) => {
                setNewPin(event.target.value);
              }}
              style={inputStyle}
            />
          </label>
          <p style={hintStyle}>{COACH_ACCESS_LABELS.pinRequirements}</p>
        </>
      )}

      {/*
        `role="alert"` rather than `aria-live="polite"`. The message replaces a submitted
        form's outcome, and a screen-reader user needs it announced the moment it appears;
        a polite region queues behind whatever else is speaking and the coach is left
        looking at a form that apparently did nothing.
      */}
      {message && (
        <p id={errorId} role="alert" style={errorStyle}>
          {message}
          {/*
           * Both halves of the notice, because they answer different questions. The sentence
           * says *what happened* and stays put after the countdown ends, so the coach still
           * knows why they were bounced; the line beneath is the part that has to move, and
           * it disappears rather than freezing at "1 minuto" when the wait is over.
           */}
          {wasLockedOut && <span style={lockNoticeStyle}>{COACH_ACCESS_LABELS.lockedUntil(lockedUntil)}</span>}
          {locked && (
            <span style={countdownStyle} aria-live="off">
              {COACH_PORTAL_LABELS.lockedUntilMinutes(remainingMs / 60_000)}
            </span>
          )}
        </p>
      )}

      <button type="submit" disabled={disabled} style={submitStyle(disabled)}>
        {changing
          ? auth.isLoading
            ? COACH_ACCESS_LABELS.pinChangeSubmitting
            : COACH_ACCESS_LABELS.pinChangeSubmit
          : auth.isLoading
            ? COACH_ACCESS_LABELS.pinSubmitting
            : COACH_ACCESS_LABELS.pinSubmit}
      </button>
    </form>
  );
}

// --------------------------------------------------------------------- shared

/**
 * A refusal, in the shape every gate's fallback takes.
 *
 * One card for both the tier notice and the shift notice: they are the same kind of
 * object -- a title, an explanation, no action -- and the reason they share a component is
 * the reason they should look the same. A notice that re-styled itself per gate would be
 * two notices to keep in step for no gain.
 */
function NoticeCard({ title, body }: { title: string; body: string }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} style={cardStyle}>
      <h2 id={titleId} style={titleStyle}>
        {title}
      </h2>
      <p style={bodyStyle}>{body}</p>
    </section>
  );
}

/**
 * A clock time in the athlete's own zone, `HH:MM`.
 *
 * Built from `Intl` rather than `toLocaleTimeString` with a fixed pattern so it follows
 * the device's 12- or 24-hour convention. This matters more than it looks: a portal that
 * says "vuelve a las 6:00" to someone whose phone says "6:00 PM" has told them to come
 * back six hours early, which is the exact failure the shift schedule exists to avoid.
 */
function formatClock(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
  maxWidth: "420px",
  padding: SPACE.lg,
  borderRadius: RADIUS.card,
  border: `1px solid ${GLASS.borderStrong}`,
  background: SOLID.popover,
  boxShadow: GLASS.shadow,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.title.size,
  fontWeight: TYPE.title.weight,
  letterSpacing: TYPE.title.tracking,
  color: TEXT.primary,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.body.size,
  lineHeight: TYPE.body.lineHeight,
  color: TEXT.secondary,
};

const fieldStyle: CSSProperties = {
  display: "block",
  marginTop: SPACE.sm,
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: SPACE.xs,
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.tertiary,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: `${SPACE.sm} ${SPACE.md}`,
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.borderStrong}`,
  background: SURFACE_ROLE.well,
  color: TEXT.primary,
  fontSize: TYPE.body.size,
  fontVariantNumeric: NUMERIC.align,
};

const hintStyle: CSSProperties = {
  margin: `${SPACE.xs} 0 0`,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

/**
 * The wine used for a refusal.
 *
 * Not a saturated red, per the palette's rule: protanopes and deuteranopes cannot
 * reliably separate one from a dark neutral. The message text is never coloured to carry
 * the failure on its own either -- it is preceded by a heading, so the state is announced
 * by structure as well as by tone.
 */
const errorStyle: CSSProperties = {
  margin: `${SPACE.sm} 0 0`,
  fontSize: TYPE.body.size,
  color: DANGER.text,
};

const lockNoticeStyle: CSSProperties = {
  display: "block",
  marginTop: SPACE.xs,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

/**
 * The ticking part of the lockout notice.
 *
 * `aria-live="off"` on purpose, and the default is not what is wanted here. The countdown
 * changes once a second for up to fifteen minutes; announcing that would make a screen reader
 * talk over whatever the coach is doing, sixty times a minute. The number is readable on
 * demand by anyone who wants it, and the sentence above it -- which does not change -- is
 * inside the `role="alert"`, so the fact that they are locked out is still announced once.
 */
const countdownStyle: CSSProperties = {
  display: "block",
  marginTop: SPACE.xs,
  fontVariantNumeric: NUMERIC.align,
  fontSize: TYPE.label.size,
  color: DANGER.text,
};

function submitStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: MOTION.minTouchTarget,
    marginTop: SPACE.md,
    borderRadius: RADIUS.control,
    border: "1px solid transparent",
    background: GLASS.fillRaised,
    color: disabled ? TEXT.disabled : TEXT.primary,
    fontSize: TYPE.body.size,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}