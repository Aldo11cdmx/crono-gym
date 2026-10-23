/**
 * ShiftPanel.tsx — where the coach is, and whether they are taking requests.
 *
 * Information plus one switch. It is explicitly *not* a gate (plan decision D8), and the
 * reason is worth stating because the surrounding code invites the opposite reading.
 *
 * `useCoachAccess` and `ShiftGate` are the athlete's side: they read `profiles.is_premium`
 * and the coach's local clock to decide whether an athlete may use Cronos right now.
 * Nothing here consults either. A shift belongs to the *desk*, not to a coach -- no column
 * in `coaches` assigns one to a person -- so at 03:00 this coach may be perfectly on duty
 * on a roster nobody has modelled, and a clock saying otherwise must not lock them out of
 * their own portal. The clock is drawn here so the coach can see the same arithmetic the
 * athletes see, not to hold it against them.
 *
 * **`is_available` is not `is_active`.** The roster question ("is this person staff?") is
 * not the coach's to answer and has no reason to change for an afternoon. The availability
 * question ("am I on the desk today?") is entirely theirs, and it is the column the
 * migration added. Nothing in the athlete-facing product reads it yet -- that is recorded
 * as a Block 5 TODO -- so this write currently changes nothing observable, which is
 * exactly why it is the switch most likely to rot if it goes untested.
 *
 * The write is one column on the coach's own row, scoped by `user_id` rather than by an id
 * the client supplies. The column-level grant is what makes that safe: RLS is row-level and
 * would otherwise have let this same toggle rewrite the coach's `pin_hash`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCENT, TEXT, TYPE } from "@/design/tokens";
import { GlassCard } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { localOffsetMinutes, shiftAt, startsAt } from "@/lib/coach/access";
import { supabase } from "@lib/supabase";

/** How often the panel recomputes its own clock. */
const CLOCK_MS = 60_000;

export interface ShiftPanelProps {
  /** The signed-in coach. Scopes both the read and the write to their own row. */
  userId: string;
}

export function ShiftPanel({ userId }: ShiftPanelProps) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The clock, re-read once a minute.
   *
   * A minute because the panel shows a shift boundary and, off shift, when the next one
   * opens. A coach watching "06:00" sit still for two hours is a coach who cannot tell
   * whether the screen is broken. Cheap too: this is arithmetic on one date, not a request.
   */
  const [now, setNow] = useState(() => new Date());

  /** Guards a state write after unmount; the toggle's await can outlive the panel. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    const { data, error: readError } = await supabase
      .from("coaches")
      .select("is_available")
      .eq("user_id", userId)
      .maybeSingle();

    if (!mounted.current) return;
    if (readError) return;

    /*
     * Stays null for a signed-in user with no `coaches` row, which is somebody who is not a
     * coach. The switch renders disabled rather than off, because "off" is a decision and
     * this is an absence -- the same rule the queue follows for a null athlete name.
     */
    setIsAvailable(typeof data?.is_available === "boolean" ? data.is_available : null);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async () => {
    if (isAvailable === null || saving) return;

    const next = !isAvailable;
    setSaving(true);
    setError(null);

    const { error: writeError } = await supabase
      .from("coaches")
      .update({ is_available: next })
      .eq("user_id", userId);

    if (!mounted.current) return;

    setSaving(false);

    if (writeError) {
      // The switch keeps its old value rather than flipping optimistically. The column
      // grant is the only thing making this write legal, so a refusal means the row is not
      // the one we thought it was -- and a toggle that shows the wrong state is worse than
      // one that does not move.
      setError(T.queueError);
      return;
    }

    setIsAvailable(next);
  }, [isAvailable, saving, userId]);

  const tzOffset = localOffsetMinutes(now);
  const shift = shiftAt(now, tzOffset);

  return (
    <GlassCard>
      <div className="flex flex-col gap-3">
        <h3 style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary }}>
          {T.availabilityTitle}
        </h3>

        {/*
         * Derived from the same helpers the athlete's tier gate uses, so the panel and the
         * athlete's screen cannot disagree about what time it is where the coach is.
         */}
        <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
          {shift
            ? T.shiftHours(shift.startHour, shift.endHour)
            : T.nextShiftAt(formatClock(startsAt(now, tzOffset).isoString))}
        </p>

        <label
          className="flex items-center gap-3"
          style={{
            fontSize: TYPE.subhead.size,
            color: TEXT.primary,
            cursor: isAvailable === null || saving ? "not-allowed" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={isAvailable === true}
            disabled={isAvailable === null || saving}
            onChange={() => void toggle()}
            style={{ width: 18, height: 18, accentColor: ACCENT.base }}
          />
          {isAvailable ? T.availabilityOn : T.availabilityOff}
        </label>

        <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{T.availabilityHint}</p>

        {error && (
          <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
            {error}
          </p>
        )}
      </div>
    </GlassCard>
  );
}

/**
 * `HH:MM` in the coach's own zone.
 *
 * Local rather than UTC because the number next to it is a civil time. Falls back to the
 * raw string when it will not parse: `toLocaleTimeString` renders an unparseable date as
 * "Invalid Date", which is worse than showing the instant the server gave.
 */
function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}