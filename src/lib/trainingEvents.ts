/**
 * trainingEvents.ts — a tiny signal that written training data changed.
 *
 * Why this exists
 * ---------------
 * The rank map reads `workout_logs` + `completed_sets`, but a session is written
 * from two unrelated places: `ActiveWorkout` when the user finishes, and
 * `sessionSync` when a queued offline session finally reaches the server. Without
 * a shared signal the ranks view has to poll, which either shows stale numbers or
 * burns requests on an interval.
 *
 * A module-level emitter is the right size for the problem. It is synchronous,
 * has no dependencies, and dies with the tab. The alternative -- Supabase realtime
 * on `completed_sets` -- is the correct answer for multi-device updates and is
 * left as the documented TODO, because it needs the tables added to the
 * publication and a reconnect path that this app does not have yet.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Announces that training data was written.
 *
 * Called after a session reaches the server, never before: announcing on enqueue
 * would make the ranks view refetch before the rows exist and settle on the old
 * numbers.
 */
export function notifyTrainingDataChanged(): void {
  // Copied first so a listener that unsubscribes during dispatch cannot skip a
  // sibling, which `Set.forEach` over the live set would do.
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (err) {
      // One bad subscriber must not stop the others from being told.
      console.error("Error en un suscriptor de trainingEvents", err);
    }
  }
}

/**
 * Subscribes to the change signal.
 *
 * Returns an unsubscribe function so callers can use it directly as the cleanup
 * returned from `useEffect`.
 */
export function subscribeTrainingData(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam: drops every subscriber. */
export function resetTrainingEventListeners(): void {
  listeners.clear();
}

/** Current subscriber count, so a test can assert it cleaned up after itself. */
export function trainingListenerCount(): number {
  return listeners.size;
}