/**
 * ActiveSessionContext.tsx — the workout in progress, readable from anywhere.
 *
 * Why this is a context and not outlet context: the session has to be visible to
 * chrome that is *not* a descendant of the view that owns it. The bottom-nav pill
 * sits in `AppShell`, which is the parent of the routed view, so no amount of
 * outlet plumbing reaches it -- only context does.
 *
 * `startedAt` lives here rather than inside `ActiveWorkout` for the same reason:
 * the pill counts elapsed time, and two independently captured start times are
 * two answers to "how long have I been training" that disagree by however long
 * the user spent on the start screen. One clock, set once, on `start()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface ActiveSession {
  routineId: string | null;
  /** Spanish routine name, or the free-session label. */
  title: string;
  /** ISO timestamp captured once when the session starts. */
  startedAt: string;
}

export interface ActiveSessionValue {
  /** The session in progress, or null when the user is not training. */
  session: ActiveSession | null;
  /** True when there is something to go back to. */
  isActive: boolean;
  /**
   * Starts a session.
   *
   * `routineId` null means a free session, which is a real session with a real
   * start time -- not a placeholder for "nothing running". The distinction
   * matters because the pill counts from `startedAt` either way.
   */
  start: (routine: { id: string; title: string } | null) => void;
  /** Ends the session. Idempotent, so a double finish cannot resurrect state. */
  end: () => void;
  /**
   * Warm-up sets another screen has asked to be added to the running session.
   *
   * Unread requests, newest last. `ActiveWorkout` drains these; nothing else does.
   */
  warmups: readonly WarmupRequest[];
  /** Asks for a warm-up ramp to be inserted into the running session. */
  enqueueWarmup: (request: Omit<WarmupRequest, "id">) => void;
  /** Marks one request as handled. Called by the workout, never by the requester. */
  resolveWarmup: (id: string) => void;
}

/**
 * A warm-up ramp someone asked for from another screen.
 *
 * Named by the exercise rather than keyed by its id on purpose: the hub is opened for one
 * movement and the session may well not contain it, so an id-keyed request would be a
 * lookup that can legitimately miss. The name is also what the confirmation says.
 */
export interface WarmupRequest {
  id: string;
  exerciseName: string;
  /** Weights in kg, in ramp order. */
  weights: readonly number[];
}

const FREE_SESSION_TITLE = "Sesión libre";

const ActiveSessionContext = createContext<ActiveSessionValue | null>(null);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [warmups, setWarmups] = useState<readonly WarmupRequest[]>([]);

  const start = useCallback((routine: { id: string; title: string } | null) => {
    setSession({
      routineId: routine?.id ?? null,
      title: routine?.title ?? FREE_SESSION_TITLE,
      startedAt: new Date().toISOString(),
    });
  }, []);

  const end = useCallback(() => {
    setSession(null);
    // Ending the session drops any pending request with it. A ramp asked for thirty
    // seconds before the workout was saved has nowhere to land, and applying it to the
    // *next* session would be a set appearing out of nowhere with no user action.
    setWarmups([]);
  }, []);

  const enqueueWarmup = useCallback((request: Omit<WarmupRequest, "id">) => {
    // A monotonic counter rather than a random id or the index: two ramps asked for in the
    // same millisecond are two requests, and the workout resolves them one at a time.
    setWarmups((previous) => [
      ...previous,
      { ...request, id: `warmup-${previous.length + 1}-${Date.now()}` },
    ]);
  }, []);

  const resolveWarmup = useCallback((id: string) => {
    setWarmups((previous) => previous.filter((request) => request.id !== id));
  }, []);

  // Memoised so the pill's one-second tick does not re-render the whole tree
  // just because a new object identity came out of the provider.
  const value = useMemo<ActiveSessionValue>(
    () => ({
      session,
      isActive: session !== null,
      start,
      end,
      warmups,
      enqueueWarmup,
      resolveWarmup,
    }),
    [session, start, end, warmups, enqueueWarmup, resolveWarmup],
  );

  return (
    <ActiveSessionContext.Provider value={value}>{children}</ActiveSessionContext.Provider>
  );
}

/**
 * Reads the active session.
 *
 * Throws outside a provider rather than returning a permissive default: a
 * missing provider is a wiring bug, and a silent `null` here would look exactly
 * like "the user is not training", which is the one state that must never be
 * faked.
 */
export function useActiveSession(): ActiveSessionValue {
  const value = useContext(ActiveSessionContext);
  if (!value) {
    throw new Error(
      "useActiveSession debe usarse dentro de <ActiveSessionProvider>. Añádelo en main.tsx.",
    );
  }
  return value;
}