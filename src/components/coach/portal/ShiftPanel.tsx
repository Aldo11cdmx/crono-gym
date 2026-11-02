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
import { Clock } from "lucide-react";
import { GLASS, MOTION, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";
import { GlassCard } from "@/components/ui/GlassCard";
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
    // Optimistic: flip immediately.
    setIsAvailable(next);
    setSaving(true);
    setError(null);

    const { error: writeError } = await supabase
      .from("coaches")
      .update({ is_available: next })
      .eq("user_id", userId);

    if (!mounted.current) return;

    setSaving(false);

    if (writeError) {
      // Revert on failure.
      setIsAvailable(!next);
      setError(T.queueError);
      return;
    }
  }, [isAvailable, saving, userId]);

  const tzOffset = localOffsetMinutes(now);
  const shift = shiftAt(now, tzOffset);

  let shiftLabel = "";
  if (shift) {
    shiftLabel = T.shiftHours(shift.startHour, shift.endHour);
  } else {
    shiftLabel = `Tu turno abre ${formatClock(startsAt(now, tzOffset).isoString)}`;
  }

  return (
    <GlassCard
      raised={isAvailable === true}
      style={{
        padding: SPACE.card,
        borderColor: isAvailable === true ? STATUS.success.border : GLASS.border,

      }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{
backgroundColor: isAvailable === true ? STATUS.success.base : GLASS.borderStrong,
boxShadow: isAvailable === true ? `0 0 10px ${STATUS.success.muted}` : "none",
            }}
          />
          <div>
            <h3
              style={{
                fontSize: TYPE.headline.size,
                lineHeight: TYPE.headline.lineHeight,
                fontWeight: TYPE.headline.weight,
                color: TEXT.primary,
              }}
            >
              {T.availabilityTitle}
            </h3>
            <p
              style={{
                fontSize: TYPE.caption.size,
                lineHeight: TYPE.caption.lineHeight,
                fontWeight: TYPE.caption.weight,
                color: TEXT.secondary,
                marginTop: SPACE.xs,
              }}
            >
              {isAvailable === true ? T.availabilityOn : T.availabilityOff}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {shiftLabel && (
            <span
              className="flex items-center gap-1 truncate text-xs tabular-nums"
              style={{ color: TEXT.secondary, minWidth: 0 }}
            >
              <Clock size={12} aria-hidden="true" />
              {shiftLabel}
            </span>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={isAvailable === true}
            disabled={isAvailable === null || saving}
            onClick={() => void toggle()}
            className="relative"
            style={{
              width: 51,
              height: 31,
              borderRadius: 9999,
              border: "none",
              background: isAvailable === true ? STATUS.success.base : GLASS.fill,
              position: "relative",
              cursor: isAvailable === null || saving ? "not-allowed" : "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 2,
                left: isAvailable === true ? 22 : 2,
                width: 27,
                height: 27,
                borderRadius: 9999,
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                transition: `left ${MOTION.fast} ${MOTION.easeOut}`,
              }}
            />
          </button>
        </div>

        {error && (
          <p role="alert" style={{ margin: 0, fontSize: TYPE.caption.size, color: STATUS.error.text }}>
            {error}
          </p>
        )}
      </div>

      <p
        style={{
          fontSize: TYPE.caption.size,
          color: TEXT.tertiary,
          marginTop: SPACE.sm,
        }}
      >
        {T.availabilityHint}
      </p>
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
