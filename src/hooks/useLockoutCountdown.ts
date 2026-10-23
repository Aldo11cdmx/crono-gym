/**
 * useLockoutCountdown.ts — how long is left of a PIN lockout, counting down on screen.
 *
 * The lockout itself lives in `useCoachAuth` as an *instant*: `lockedUntil` is the moment the
 * server said the block lifts, and it is the right shape for a value that has to survive
 * being stored in memory and read back after a reload. What it is not is something a person
 * can act on. "Puedes volver a intentarlo a las 15:42" is a clock time, and a coach who
 * failed their PIN three times and is locked out for fifteen minutes is not going to work out
 * how long that is from a clock time -- especially one that was written once, when the error
 * first arrived, and never moved again.
 *
 * **The countdown can end before the server's block does, and that is safe.** It falls back
 * to enabling the form, which lets the coach submit a PIN that `coach-auth` will refuse if
 * the block is genuinely still up. The reverse -- showing "0 minutos" and leaving the form
 * disabled -- is the failure worth avoiding: it tells the coach to wait, tells them they are
 * waiting, and never releases them. So the local countdown is a courtesy about *when to try*,
 * and the server is the authority on *whether they may*.
 *
 * **An unparseable instant counts as expired, for the same reason.** `lockedUntil` is
 * produced by our own function from our own server response, so an unparseable value is a bug
 * in that serialisation rather than a fact about the coach's lockout; and treating it as
 * "still locked forever" would brick the form with no way back but a reload.
 *
 * Ticks once a second, and only while there is a lockout. A minute's granularity would make
 * the last minute read as "1" for its whole duration, and the label already rounds up so the
 * coach is never told to try at a moment that has already passed.
 */

import { useEffect, useState } from "react";

/**
 * Milliseconds left, or null when nothing is locked.
 *
 * Null rather than 0 for "expired" so a caller cannot confuse the two: 0 is a number that a
 * `remainingMs <= 0` check and a truthiness check disagree about, and the second of those is
 * the mistake that leaves a form disabled forever.
 */
export function useLockoutCountdown(lockedUntil: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(() => remainingMs(lockedUntil));

  useEffect(() => {
    // Recomputed on the instant itself, not kept: a `lockedUntil` that changes has to
    // re-read, and deriving it in state is one source of truth rather than two.
    setRemaining(remainingMs(lockedUntil));

    if (lockedUntil === null) return;
    const target = new Date(lockedUntil).getTime();
    // Unparseable: `remainingMs` already reported "expired", so there is nothing to tick.
    if (Number.isNaN(target)) return;

    const id = setInterval(() => {
      const left = target - Date.now();
      if (left <= 0) {
        setRemaining(null);
        clearInterval(id);
        return;
      }
      setRemaining(left);
    }, 1000);

    return () => clearInterval(id);
  }, [lockedUntil]);

  return remaining;
}

/** Milliseconds from now until `iso`, or null when it is absent, past, or unreadable. */
function remainingMs(iso: string | null): number | null {
  if (iso === null || iso === "") return null;

  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;

  const left = target - Date.now();
  return left > 0 ? left : null;
}