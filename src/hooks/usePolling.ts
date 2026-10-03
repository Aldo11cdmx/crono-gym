/**
 * usePolling.ts — repeats an async task on an interval, without overlapping itself.
 *
 * Two components in the coach portal need the same thing (`RequestQueue` and
 * `HumanCoachChat` both watch the server every ten seconds), and the plan calls for one
 * hook rather than two `setInterval`s: written twice, it is the same bug twice.
 *
 * Four properties are the whole reason this exists, and each is a bug the naive version
 * has:
 *
 * **The next tick is armed after the previous one settles.** A fixed `setInterval` fires
 * on schedule regardless of whether the last request came back, so a slow query -- and
 * `workout_logs` paginates two years of history -- stacks requests on top of each other.
 * Worse, it lets a slow response resolve *after* a faster later one and paint stale rows
 * over fresh ones. The real period here is `intervalMs + latency`, which at ten seconds is
 * not a number a user can tell from the number they asked for.
 *
 * **It stops while the tab is hidden.** A portal left open on a second monitor is ten
 * seconds of traffic forever for nobody who is looking at it. The run on mount is the one
 * exception -- a caller that mounted wants its first data, and there is no prior run to
 * have wasted.
 *
 * **It restarts when the tab comes back, and exactly once.** Ten seconds is a long time to
 * wait for the thing you came back to look at. "Exactly once" is the hard part: the
 * visibility handler cannot simply call the runner again, because the loop is usually
 * already alive with a timer pending and a naive restart leaves two chains running, each
 * scheduling its own next tick.
 *
 * **A request in flight cannot write state after the caller has moved on.** Changing
 * `userId`, or unmounting, mid-flight is the normal case in a portal where the coach
 * clicks from one athlete to another. The generation counter makes the stale response a
 * no-op instead of the previous athlete's rows arriving one frame late.
 */

import { useEffect, useRef } from "react";

/**
 * Polls `task` every `intervalMs`, starting immediately.
 *
 * `task` is intentionally a loose `() => Promise<void>` rather than a typed Supabase
 * query: the hook knows nothing about what is being fetched, and typing it more tightly
 * would only push a cast to the caller.
 *
 * `enabled` exists so a caller can stop polling without unmounting. The chat polls only
 * while a session is selected; wrapping that in `enabled` rather than a conditional
 * component keeps the selected-session state in one place.
 *
 * Errors are swallowed deliberately. A poller that throws into a `setTimeout` reaches
 * the window's error handler and, depending on the host, takes the whole tree down for a
 * failed refresh. The component's own `task` already renders whatever went wrong; this
 * hook's only job is to decide *when* to call it again -- and a failed refresh must not
 * stop the loop, or one dropped packet would silently end all polling.
 *
 * An `intervalMs` of zero or less disables the loop rather than spinning: a caller
 * computing a period from a preference that resolved to nothing should not get a busy
 * loop as the result.
 */
export function usePolling(task: () => Promise<void>, intervalMs: number, enabled = true): void {
  // The task is read through a ref so a caller passing an inline arrow does not restart
  // the loop on every render. Restarting on each render would fire `task` immediately
  // every time, which is a busy loop wearing a timer as a disguise.
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;
    if (intervalMs <= 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    /**
     * Bumped on teardown, and captured by each run.
     *
     * A `cancelled` flag alone would not be enough to be correct here: the response can
     * land in the same tick the effect tears down, and reading a closure boolean at that
     * moment is a race the tests would only catch intermittently. Comparing generations
     * makes it a value, not a timing question.
     */
    let generation = 0;

    const scheduleNext = (): void => {
      if (cancelled) return;
      // Hidden: run once more when the tab comes back instead of on a timer nobody is
      // looking at. `onVisibility` is what restarts it.
      if (typeof document !== "undefined" && document.hidden) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        // Checked here as well as in `scheduleNext`, and the two checks are not
        // redundant: `scheduleNext` stops arming, but a timer armed *before* the tab was
        // hidden still fires, and running the task then is one wasted request per hide.
        // Skipping leaves the loop with no timer, which is exactly the state
        // `onVisibility` knows how to restart.
        if (typeof document !== "undefined" && document.hidden) return;
        void run();
      }, intervalMs);
    };

    const run = async (): Promise<void> => {
      const mine = generation;
      inFlight = true;
      try {
        await taskRef.current();
      } catch {
        // Swallowed on purpose -- see the note on the exported signature. The loop
        // continues either way.
      } finally {
        inFlight = false;
      }

      // Stopped, or the effect restarted: this response belongs to a loop that no longer
      // exists, and scheduling a timer here would keep a dead loop alive.
      if (cancelled || mine !== generation) return;

      scheduleNext();
    };

    /**
     * Hidden -> visible only; going hidden needs no work here, because the next settled
     * run checks `document.hidden` before arming a timer.
     *
     * Guards on `inFlight` rather than only on a pending timer: when the tab was hidden
     * while a request was in flight, that request resolved, declined to arm a timer and
     * left nothing pending. A handler that waited for a timer to fire would find none and
     * leave the loop dead for the rest of the session.
     */
    const onVisibility = (): void => {
      if (typeof document === "undefined" || document.hidden) return;
      if (inFlight) return;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      void run();
    };

    void run();

    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      generation += 1;
      if (timer !== undefined) clearTimeout(timer);
      if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [intervalMs, enabled]);
}