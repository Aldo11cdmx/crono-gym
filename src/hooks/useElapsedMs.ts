/**
 * useElapsedMs.ts — one clock for the whole app.
 *
 * The session does not pause when the athlete opens the exercise hub, and the way it
 * manages that is worth stating plainly because it is the answer to "does the timer
 * survive navigation":
 *
 * **Nothing needs to be persisted.** `ActiveSessionContext` holds `startedAt` as an ISO
 * timestamp captured once, in a provider mounted *above* the router, so navigating from
 * `/entrenar` to `/ejercicio/:id` unmounts the workout screen but not the session. Elapsed
 * time is then derived, never accumulated -- `now - startedAt` -- so there is no counter to
 * lose, no interval to clear, and no way for the two to disagree.
 *
 * The only thing that has to exist is a tick to re-render on, and this is the *only* place
 * one is created. Two components each running their own `setInterval` would both read the
 * same `startedAt` and land within a second of each other, which is exactly the kind of
 * drift nobody notices until the pill says `12:04` and the header says `12:05`.
 *
 * `formatElapsed` moved here from `ActiveWorkoutPill` for the same reason: a time format is
 * not a property of the pill, and the header has to render the identical string or the two
 * readings of the same session look like two sessions.
 */

import { useEffect, useState } from "react";

/**
 * Elapsed time as `MM:SS`. Minutes are not capped: a 3-hour session is `180:00`.
 *
 * Floored rather than rounded. A clock that rounds 59.7s to `01:00` shows a minute that
 * has not happened, and the athlete is counting on it to decide whether to take another
 * set.
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Milliseconds since an ISO timestamp, ticking once a second.
 *
 * Returns `0` for a missing timestamp rather than throwing or going negative: a component
 * that renders the header has to survive the frame where the session has not started.
 */
export function useElapsedMs(startedAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // No tick until there is something to count. A header on a screen the athlete opened to
    // browse exercises should not hold a timer alive for a session that is not running.
    if (!startedAt) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  if (!startedAt) return 0;

  const started = new Date(startedAt).getTime();
  // An unparseable timestamp would make this NaN, and a NaN rendered as a clock reads
  // "NaN:NaN". Zero is the safe answer: it looks like a session that just began.
  if (!Number.isFinite(started)) return 0;

  return Math.max(0, now - started);
}