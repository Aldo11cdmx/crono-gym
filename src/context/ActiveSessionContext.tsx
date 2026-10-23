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
 *
 * The unfinished session lives here too, for the same reason in reverse: the
 * session outlives the screen, so the screen cannot be the thing that finds
 * it. A reload used to land on the dashboard with a session still running on
 * the device, because the lookup happened inside the workout -- a component
 * that only mounts once the app has already decided there is no session. The
 * lookup is here, one level up, and the answer is a session the rest of the
 * app can read.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { deleteDraft, loadRecoverableDraft, type SessionDraft } from "../lib/offlineStore";

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
  /**
   * The unfinished session found on this device, offered for recovery.
   *
   * `null` when there is nothing to recover, and also while the lookup is
   * still running -- which is why {@link ActiveSessionValue.rehydrating} exists.
   */
  recoverableDraft: SessionDraft | null;
  /**
   * True until the lookup has answered.
   *
   * It starts `true` on purpose: "is there an unfinished session?" is unknown
   * until it is asked, and a screen that renders "no session" before the
   * question has been asked sends the athlete home with a session still
   * running.
   */
  rehydrating: boolean;
  /**
   * Looks for an unfinished session to recover.
   *
   * Idempotent per user: the same id twice looks once. The user id is an
   * argument rather than something the provider reads itself, because the
   * provider sits above the router and the router is what knows who is
   * signed in -- one source of truth for the session, not two.
   */
  rehydrate: (userId: string) => void;
  /**
   * Continues the unfinished session under its own id.
   *
   * The draft's id becomes the session's id: the row on the server and the
   * record on the device are the same session, not a new one that happens to
   * look like it. A second id would leave the first one behind as an orphan
   * that gets offered again after the workout ends.
   */
  restoreDraft: () => void;
  /** Throws the unfinished session away. */
  discardDraft: () => void;
  /** Desecha y limpia por completo la sesión activa y cualquier borrador huérfano. */
  discardSession?: () => void;
  /** The id a recovered session writes under; null before the recovery. */
  recoveredLogId: string | null;
  /**
   * When the rest that was running when the session was interrupted ends.
   *
   * `null` when there was no rest, and also when the rest has already ended:
   * a rest that expired while the app was closed is not a rest to resume,
   * it is a rest that is over. The deadline is a moment, not a count, so
   * the countdown it restores is the one the athlete was actually in.
   */
  pendingRestEndsAt: number | null;
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
  const [recoverableDraft, setRecoverableDraft] = useState<SessionDraft | null>(null);
  const [recoveredLogId, setRecoveredLogId] = useState<string | null>(null);
  const [pendingRestEndsAt, setPendingRestEndsAt] = useState<number | null>(null);
  const [rehydrating, setRehydrating] = useState(true);
  /** The user the lookup is for. `null` until somebody asks for one. */
  const [rehydrateFor, setRehydrateFor] = useState<string | null>(null);
  /** The draft as it is right now, for the callbacks that read it later. */
  const draftRef = useRef<SessionDraft | null>(null);
  draftRef.current = recoverableDraft;
  /** The session as it is right now, for the lookup that resolves later. */
  const sessionRef = useRef<ActiveSession | null>(null);
  sessionRef.current = session;

  /**
   * The lookup.
   *
   * In an effect rather than inside `rehydrate` so the cancellation is
   * React's: an unmount mid-lookup must not set state on a dead provider.
   */
  useEffect(() => {
    if (!rehydrateFor) return undefined;
    let alive = true;
    void loadRecoverableDraft(rehydrateFor).then((draft) => {
      if (!alive) return;
      setRehydrating(false);
      if (!draft) return;
      // A session that is already running wins. It is the live one, and the
      // draft belongs to a session nobody has chosen to continue: offering
      // it would put two sessions in the same app.
      if (sessionRef.current) return;
      setRecoverableDraft(draft);
      // The rest that was running is resumed where it was, if it is still
      // running: the deadline is a moment, so a rest that expired while the
      // app was closed is over, not something to count down.
      setPendingRestEndsAt(
        typeof draft.restEndsAt === "number" && draft.restEndsAt > Date.now()
          ? draft.restEndsAt
          : null,
      );
      // The session is created from the draft, so the clock starts when the
      // interrupted session started -- not now, and not on a second screen.
      setSession({
        routineId: draft.routineId,
        title: draft.routineTitle,
        startedAt: draft.startedAt,
      });
    });
    return () => {
      alive = false;
    };
  }, [rehydrateFor]);

  const rehydrate = useCallback((userId: string) => {
    // The same id twice is the same state twice: React drops the update and
    // the effect does not run again.
    setRehydrateFor(userId);
  }, []);

  const restoreDraft = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return;
    setRecoveredLogId(draft.logId);
    setRecoverableDraft(null);
  }, []);

  const discardSession = useCallback(() => {
    const draft = draftRef.current;
    if (draft) {
      void deleteDraft(draft.logId);
    }
    if (recoveredLogId) {
      void deleteDraft(recoveredLogId);
    }
    setSession(null);
    setRecoverableDraft(null);
    setRecoveredLogId(null);
    setPendingRestEndsAt(null);
    setWarmups([]);
    try {
      localStorage.removeItem("cronos_active_session");
      localStorage.removeItem("active_workout");
      localStorage.removeItem("active_session");
      localStorage.removeItem("cronos_workout_draft");
    } catch {
      // ignore
    }
  }, [recoveredLogId]);

  const discardDraft = useCallback(() => {
    const draft = draftRef.current;
    if (draft) {
      void deleteDraft(draft.logId);
    }
    if (recoveredLogId) {
      void deleteDraft(recoveredLogId);
    }
    setRecoverableDraft(null);
    setPendingRestEndsAt(null);
    setSession(null);
    setRecoveredLogId(null);
    try {
      localStorage.removeItem("cronos_active_session");
      localStorage.removeItem("active_workout");
      localStorage.removeItem("active_session");
      localStorage.removeItem("cronos_workout_draft");
    } catch {
      // ignore
    }
  }, [recoveredLogId]);

  const start = useCallback((routine: { id: string; title: string } | null) => {
    setSession({
      routineId: routine?.id ?? null,
      title: routine?.title ?? FREE_SESSION_TITLE,
      startedAt: new Date().toISOString(),
    });
    // A new session is a new identity: the recovered id belongs to the
    // session that was recovered, not to this one. The pending draft goes
    // with it -- the athlete is starting something else, so it is not
    // offered while this session runs.
    setRecoveredLogId(null);
    setRecoverableDraft(null);
    setPendingRestEndsAt(null);
  }, []);

  const end = useCallback(() => {
    const draft = draftRef.current;
    if (draft) {
      void deleteDraft(draft.logId);
    }
    if (recoveredLogId) {
      void deleteDraft(recoveredLogId);
    }
    setSession(null);
    setWarmups([]);
    setRecoverableDraft(null);
    setRecoveredLogId(null);
    setPendingRestEndsAt(null);
    try {
      localStorage.removeItem("cronos_active_session");
      localStorage.removeItem("active_workout");
      localStorage.removeItem("active_session");
      localStorage.removeItem("cronos_workout_draft");
    } catch {
      // ignore
    }
  }, [recoveredLogId]);

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
      recoverableDraft,
      rehydrating,
      rehydrate,
      restoreDraft,
      discardDraft,
      discardSession,
      recoveredLogId,
      pendingRestEndsAt,
    }),
    [
      session,
      start,
      end,
      warmups,
      enqueueWarmup,
      resolveWarmup,
      recoverableDraft,
      rehydrating,
      rehydrate,
      restoreDraft,
      discardDraft,
      recoveredLogId,
      pendingRestEndsAt,
    ],
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
