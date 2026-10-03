/**
 * useCoachAuth.ts — the coach PIN, held in memory and nowhere else.
 *
 * The PIN is a second factor inside an already-authenticated app: the coach signs in
 * with their ordinary account, then proves it is them again with a PIN before the portal
 * opens. That makes it a gate on a *session*, not an identity -- and it is why this
 * module's whole design goal is to be easy to forget.
 *
 * **Nothing is persisted.** Not the PIN, not its hash, not the issued token, not the
 * lockout countdown. There is no `localStorage` key and no `sessionStorage` key, and that
 * is the entire argument, because `localStorage` is readable by any script on the origin
 * for as long as the value survives: a single third-party dependency with a typo, an
 * analytics tag, a browser extension. A coach session written there outlives the tab and
 * is handed to whatever reads it next. In memory it dies with the page, and the cost of
 * that is a coach typing their PIN again after a reload -- which is the cost the security
 * model is buying on purpose.
 *
 * The consequence, stated plainly so it is not rediscovered as a bug: **a reload locks
 * the coach out.** That is the design. Every mechanism below is about making the *tab*
 * behave -- re-arming on activity, expiring on idle -- while making the *machine* forget.
 *
 * The lockout budget is server-side, in `coach_login_attempts`, counted by the
 * `coach-auth` function with the service role. A client-side attempt counter is a
 * suggestion; the guesses land on the server, so that is where the count has to live. This
 * module's job on a 429 is only to say so, and to carry the instant the server gave back.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * How long the portal stays unlocked without activity.
 *
 * Thirty minutes is a coaching session, not a coffee break: long enough to read an
 * athlete's history, write a programme and answer a message, short enough that a device
 * left unlocked over lunch is not a device anyone else can use. The timer is reset by
 * `touch()`, which the portal calls on interaction.
 *
 * Not a JWT lifetime. The token the function issues outlives this -- four hours -- because
 * it may be used by requests that are not user-initiated. This is the belt to that
 * suspenders, and it is the one that runs when nobody is looking.
 */
export const COACH_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** What can go wrong unlocking or changing a PIN. */
export type CoachAuthErrorCode =
  /** The PIN did not match. Deliberately indistinguishable from an unknown coach. */
  | "INVALID_PIN"
  /** Too many failures; `lockedUntil` says when it lifts. */
  | "TOO_MANY_ATTEMPTS"
  /** The new PIN was refused -- same length as the old, too short, or already used. */
  | "PIN_CHANGE_REJECTED"
  /** The request never reached the function. */
  | "NETWORK_ERROR"
  /** The function answered, but could not. */
  | "SERVICE_UNAVAILABLE";

/**
 * A failure, as a code plus the one piece of data the server owns.
 *
 * No message: the function's body is never surfaced, because a body that distinguishes
 * "no such coach" from "wrong PIN" is free reconnaissance. The copy comes from
 * `COACH_ACCESS_LABELS.pinErrors`, keyed by this code, so every message an athlete sees
 * is one the app chose rather than one a server dictated.
 */
export interface CoachAuthError {
  code: CoachAuthErrorCode;
  /** ISO instant the lockout lifts, when the server said so. Null otherwise. */
  lockedUntil: string | null;
}

/** What the function returns on success. */
interface CoachSession {
  token: string;
  coachId: string;
  /** ISO instant the issued token stops being accepted. */
  expiresAt: string | null;
}

/** The externally-visible shared state. Reference-stable; see {@link emit}. */
interface SharedState {
  isUnlocked: boolean;
  requiresPinChange: boolean;
  error: CoachAuthError | null;
  lockedUntil: string | null;
}

const LOCKED: SharedState = {
  isUnlocked: false,
  requiresPinChange: false,
  error: null,
  lockedUntil: null,
};

let state: SharedState = LOCKED;
let session: CoachSession | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The immutable snapshot `useSyncExternalStore` reads.
 *
 * The module keeps one object and replaces it wholesale, never mutating in place. That
 * is the contract `useSyncExternalStore` requires: a snapshot that changed identity
 * without changing content would re-render forever, and one that changed content in place
 * would re-render never.
 */
function getSnapshot(): SharedState {
  return state;
}

function emit(next: SharedState): void {
  state = next;
  for (const listener of listeners) listener();
}

// --------------------------------------------------------------------- timer

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/**
 * (Re)arm the idle countdown. Fires {@link lock}, which drops the session.
 *
 * Cleared and re-set rather than left running, so the deadline is always thirty minutes
 * from the last action instead of thirty from the unlock.
 */
function armIdleTimer(): void {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    lock();
  }, COACH_IDLE_TIMEOUT_MS);
}

// ------------------------------------------------------------------ session

/**
 * Drop the coach session.
 *
 * Also clears a lockout countdown, which is right: the countdown is a message for the
 * next attempt, and discarding it along with the session means a coach who signs out
 * during a lockout gets a clean attempt rather than an error about one they are no longer
 * subject to.
 *
 * Deliberately does not call `requiresPinChange: false`. That flag means "this coach is
 * on a seeded PIN", which is a fact about the account rather than about the session; it
 * is cleared by a successful change and by the next unlock response, and leaving it set
 * across a sign-out would show a coach on a fresh PIN the form for changing one.
 */
function lock(): void {
  clearIdleTimer();
  session = null;
  emit({ ...LOCKED, requiresPinChange: state.requiresPinChange });
}

/**
 * Extend the unlocked session by thirty minutes.
 *
 * Called by the portal on interaction. Separate from `lock` because "the coach is still
 * working" and "the coach has finished" are different events and only one of them may
 * throw away the session.
 */
function touch(): void {
  if (session !== null) armIdleTimer();
}

/**
 * The bearer token for the issued session, or null when locked. For the portal's fetches.
 *
 * The `get` prefix rather than a bare noun is the convention worth keeping: it says the
 * caller receives a value rather than a handle they might mutate, and it distinguishes
 * this from the `useCoachAuth` hook that owns the session it comes from.
 */
export function getCoachToken(): string | null {
  return session?.token ?? null;
}

// ----------------------------------------------------------------- requests

/** The slice of the auth client this module uses. */
interface SupabaseAuth {
  getSession(): Promise<{ data: { session: { access_token: string } | null } }>;
}

/**
 * The caller's own access token, for authenticating to `coach-auth`.
 *
 * The **session access token**, not the anon key -- the gateway accepts both, but the
 * function resolves the caller with `auth.getUser(token)`, which only takes a user token.
 * Imported lazily for the same reason as in `coachAssistant.ts`: `@/lib/supabase` throws
 * at module scope when the env vars are absent, and a static import would take this module
 * down with it.
 */
async function callerAccessToken(): Promise<string> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const auth = supabase.auth as unknown as SupabaseAuth;
    const { data } = await auth.getSession();
    return data.session?.access_token ?? "";
  } catch {
    return "";
  }
}

interface FunctionResponse {
  token?: string;
  coachId?: string;
  expiresAt?: string | null;
  requiresPinChange?: boolean;
  lockedUntil?: string;
}

/**
 * POST to `coach-auth` and classify the answer.
 *
 * Never throws. Every outcome is one of an {@link UnlockResult}, because a gate that has
 * to handle a thrown error and a returned code has two paths to keep in step and only
 * one of them will be tested.
 */
async function callFunction(
  body: { action: "verify" | "change"; pin: string; newPin?: string },
):Promise<UnlockResult> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-auth`;

  let response: Response;
  try {
    const token = await callerAccessToken();
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // A rejected fetch is DNS, TLS, CORS or a dropped connection. None of them is the
    // coach's fault and none of them says anything about the PIN, so this must not be
    // reported as a wrong PIN -- telling someone their PIN is wrong when the network is
    // down sends them to retype a PIN that was always right.
    return { kind: "error", error: { code: "NETWORK_ERROR", lockedUntil: null } };
  }

  const payload = await readJson(response);

  if (response.status === 429) {
    return {
      kind: "error",
      error: {
        code: "TOO_MANY_ATTEMPTS",
        lockedUntil: lockedUntilFrom(response, payload),
      },
    };
  }

  if (!response.ok) {
    /*
     * 400, 401 and 404 all mean the PIN did not verify, and are reported identically.
     *
     * 404 is the odd one and the reason it belongs here: the function answers a signed-in
     * user who owns no active `coaches` row with 404 rather than 401. It has to, because
     * a retired coach and a user who was never a coach are indistinguishable to the
     * function on purpose -- collapsing them into 401 would be fine too, but a distinct
     * status per case would let anyone with an account enumerate the coaching staff.
     *
     * So the function refuses to say *which* of the three reasons applies, and the client
     * must not invent the distinction either. Folding 404 into `INVALID_PIN` rather than
     * letting it fall through to `SERVICE_UNAVAILABLE` is what stops a signed-in athlete
     * who is not a coach from being told the server is broken when they simply typed a PIN
     * that does not exist.
     *
     * Everything else is the function's problem: 5xx, a gateway error, a response with
     * no body. Reporting those as a wrong PIN would send a coach to retype a PIN that was
     * always correct, which is both useless and a good way to burn the attempt budget.
     */
    return {
      kind: "error",
      error: {
        code:
          response.status === 400 || response.status === 401 || response.status === 404
            ? "INVALID_PIN"
            : "SERVICE_UNAVAILABLE",
        lockedUntil: null,
      },
    };
  }

  /*
   * A provisional coach -- still on a seeded PIN -- is not an error and not a success.
   * The function declines to issue a token and says so, and the client has to represent
   * that as its own state rather than folding it into either: rendering it as a failure
   * would tell a coach their correct PIN was refused, and rendering it as success would
   * open the portal behind a PIN the coach chose for them.
   */
  if (payload?.requiresPinChange === true) {
    return { kind: "requires_pin_change" };
  }

  if (!payload?.token) {
    return {
      kind: "error",
      error: { code: "SERVICE_UNAVAILABLE", lockedUntil: null },
    };
  }

  return {
    kind: "unlocked",
    session: {
      token: payload.token,
      coachId: payload.coachId ?? "",
      expiresAt: payload.expiresAt ?? null,
    },
  };
}

type UnlockResult =
  | { kind: "unlocked"; session: CoachSession }
  | { kind: "requires_pin_change" }
  | { kind: "error"; error: CoachAuthError };

/**
 * The body as an object, whatever arrives.
 *
 * A 500 from the gateway is HTML and a 200 from a proxy in front of nothing is JSON that
 * is not the shape we asked for. Neither should become a thrown `SyntaxError` on a code
 * path whose job is to classify a failure.
 */
async function readJson(response: Response): Promise<FunctionResponse | null> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === "object" && parsed !== null ? (parsed as FunctionResponse) : null;
  } catch {
    return null;
  }
}

/**
 * When the lockout lifts, from the body or from `Retry-After`.
 *
 * The body wins because it is exact; the header is a fallback for a gateway that
 * answered on the function's behalf and knows only the cooldown. A `Retry-After` that will
 * not parse yields null rather than `NaN`, because this value is rendered as a time and
 * "NaN" is worse than no time.
 */
function lockedUntilFrom(response: Response, payload: FunctionResponse | null): string | null {
  if (payload?.lockedUntil) return payload.lockedUntil;

  const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return new Date(Date.now() + retryAfter * 1000).toISOString();
  }
  return null;
}

// ---------------------------------------------------------------------- hook

export interface CoachAuth {
  /** True while a `verify` or `change` is in flight. Local, so an unmount cannot strand it. */
  isLoading: boolean;
  /** True while a coach session is held. */
  isUnlocked: boolean;
  /** The coach is on a seeded PIN and must change it before the portal opens. */
  requiresPinChange: boolean;
  error: CoachAuthError | null;
  /** ISO instant a lockout lifts, when the server reported one. */
  lockedUntil: string | null;
  /**
   * Verify a PIN. Returns true when the session is now unlocked.
   *
   * False covers every failure and the reason is in `error`; the boolean exists so a
   * form can branch without inspecting the code, and it is never used to decide whether
   * the portal is open -- that is `isUnlocked`, which only a token sets.
   */
  unlock: (pin: string) => Promise<boolean>;
  /** Replace the PIN. Returns true when the session is now unlocked. */
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  /** Throw the session away now. */
  lock: () => void;
  /** Report activity, extending the idle countdown. */
  touch: () => void;
}

/**
 * Reads the shared coach session and exposes the actions that change it.
 *
 * `useSyncExternalStore` rather than `useState` plus an effect, because the state is not
 * owned by any component: the idle timer fires with no component mounted, `lock()` can be
 * called from a header on a different route, and two gates may be on screen at once.
 * Module-local `useState` would leave each copy disagreeing with the truth, and the one
 * that mattered would be whichever was mounted.
 *
 * `isLoading` is the one piece kept local. It describes this component's request, so it
 * must not survive into a hook that never made one -- otherwise an unmount mid-unlock
 * would leave the next gate reporting a spinner forever.
 */
export function useCoachAuth(): CoachAuth {
  const shared = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [isLoading, setIsLoading] = useState(false);

  // Guards a state update after unmount. React 18 no longer warns about this, but the
  // update is still a no-op on a dead component and the flag costs one boolean.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const unlock = useCallback(async (pin: string) => {
    const trimmed = pin.trim();
    if (trimmed === "") {
      emit({ ...LOCKED, requiresPinChange: state.requiresPinChange });
      return false;
    }

    setIsLoading(true);
    const result = await callFunction({ action: "verify", pin: trimmed });
    if (!mounted.current) return false;

    setIsLoading(false);
    applyResult(result);
    return result.kind === "unlocked";
  }, []);

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    const current = currentPin.trim();
    const next = newPin.trim();

    setIsLoading(true);
    const result = await callFunction({ action: "change", pin: current, newPin: next });
    if (!mounted.current) return false;

    setIsLoading(false);

    if (result.kind === "unlocked") {
      // A change that also issues a session is the normal path: the coach does not get
      // bounced back to the PIN form having just proved who they are. `is_provisional`
      // is cleared server-side by the same transaction, so nothing else is needed here.
      applyResult(result);
      return true;
    }

    // Refused. Reported as `PIN_CHANGE_REJECTED` rather than reusing `INVALID_PIN`, so
    // the form can name the field at fault without parsing a string: "that PIN does not
    // match" and "the new PIN is too short" are different instructions to the person
    // typing, and lumping them together is how somebody ends up retrying the wrong one.
    if (result.kind === "error") {
      emit({
        isUnlocked: false,
        requiresPinChange: state.requiresPinChange,
        error:
          result.error.code === "INVALID_PIN"
            ? { code: "PIN_CHANGE_REJECTED", lockedUntil: result.error.lockedUntil }
            : result.error,
        lockedUntil: result.error.lockedUntil,
      });
      return false;
    }

    applyResult(result);
    return false;
  }, []);

  return {
    isLoading,
    isUnlocked: shared.isUnlocked,
    requiresPinChange: shared.requiresPinChange,
    error: shared.error,
    lockedUntil: shared.lockedUntil,
    unlock,
    changePin,
    lock,
    touch,
  };
}

/**
 * Turn a function answer into shared state.
 *
 * One place, because "what the state is after an answer" is where the two easy bugs live:
 * clearing `requiresPinChange` on failure (so a coach on a seeded PIN who mistypes is told
 * to change a PIN they have not yet proven they can) and keeping it on success (so a coach
 * who has just changed their PIN is still asked to).
 */
function applyResult(result: UnlockResult): void {
  if (result.kind === "unlocked") {
    session = result.session;
    emit({ isUnlocked: true, requiresPinChange: false, error: null, lockedUntil: null });
    armIdleTimer();
    return;
  }

  if (result.kind === "requires_pin_change") {
    session = null;
    emit({ isUnlocked: false, requiresPinChange: true, error: null, lockedUntil: null });
    return;
  }

  session = null;
  emit({
    isUnlocked: false,
    // Preserved across a failure: the last thing the function said about this coach was
    // that they are on a seeded PIN, and a mistyped PIN does not make that untrue.
    requiresPinChange: state.requiresPinChange,
    error: result.error,
    lockedUntil: result.error.lockedUntil,
  });
}