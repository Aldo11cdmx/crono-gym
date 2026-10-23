/**
 * useCoachAccess.ts — what this athlete can reach, resolved once and cached.
 *
 * Two facts are needed to render the coach surfaces: whether the athlete is premium,
 * and what time it is where they are. The second is free and always correct; the first
 * costs a query. This hook pays for the query once, holds it for five minutes, and
 * recomputes the shift from the clock -- so the two halves age differently and
 * deliberately. An entitlement does not change because the athlete waited, but a shift
 * boundary is an event that happens while the app is open.
 *
 * The free tier is the reason the shape is odd.
 *
 * Vía A -- the AI assistant -- is available to every signed-in athlete. So
 * `canChat` and `canGenerateAiRoutine` depend on authentication alone and are `true` on
 * the very first render, before the profile query has resolved. They do not wait on
 * `isLoading` and they do not consult `isPremium`, and no gate is allowed to infer
 * otherwise: a paywall that flickers while a profile loads is a paywall that shows
 * itself to the people paying for it.
 *
 * This hook never polls the database. Entitlement changes are rare and always
 * user-initiated -- a purchase, a renewal -- so whoever performs the change calls
 * {@link CoachAccess.refresh} rather than the clock watching for it. What *is* scheduled
 * is a single timer aimed at the next shift boundary, which is the only moment the
 * rendered answer can change without anyone asking.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@lib/supabase";
import {
  COACH_SHIFTS,
  humanCoachStatus,
  isPremiumActive,
  localMinutesSinceMidnight,
  localOffsetMinutes,
  type CoachAccess,
  type CoachProfile,
  type HumanCoachStatus,
} from "./access";

/**
 * How long a read of the athlete's entitlement stays good for.
 *
 * Five minutes is chosen against the only cost that matters: how long a wrong answer
 * would be on screen. Nothing changes an entitlement on its own -- a purchase sets it, a
 * term lapses on a date -- so the real question is how long after an upgrade the UI
 * still looks wrong, and that is zero, because an upgrade calls `refresh()` instead of
 * waiting for the cache to expire. The TTL bounds the damage from a change made
 * * elsewhere, not the cost of the happy path.
 *
 * Not a background poll. A poll keeps a query running forever to watch for a change
 * that is announced by whatever made it.
 */
export const ACCESS_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  userId: string;
  readAt: number;
  profile: CoachProfile;
}

/**
 * Module-scope, so the cache outlives the components that filled it.
 *
 * Deliberately not React state and not context. The entitlement is a property of the
 * account, not of a screen: `/coach`, `/entrenar` and the floating assistant all ask,
 * and each mounts and unmounts as the athlete navigates. A cache that died with its
 * first component would re-query on every navigation; a cache in context would have to
 * be lifted above the router to be reachable from all of them.
 *
 * The price of module scope is that a test needs `vi.resetModules()` for a clean cache,
 * the same trade `useGymData` already makes. {@link clearAccessCache} is the explicit
 * seam for a test that would rather not reload the module.
 */
let cache: CacheEntry | null = null;

/** The cached entitlement for `userId`, or null when absent, another user, or stale. */
function readCache(userId: string, now: number): CoachProfile | null {
  if (!cache) return null;
  // Keyed by user: a signed-out sign-in as somebody else must not read the previous
  // account's entitlement, and the TTL alone would let it for five minutes.
  if (cache.userId !== userId) return null;
  if (now - cache.readAt >= ACCESS_CACHE_TTL_MS) return null;
  return cache.profile;
}

/** The status before anything is known. `not_premium` is the safe reading of "unknown". */
const UNKNOWN_STATUS: HumanCoachStatus = {
  state: "not_premium",
  shift: null,
  nextShiftStart: null,
};

export function useCoachAccess(userId: string | null): CoachAccess {
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The instant the shift status is evaluated against, in epoch milliseconds.
   *
   * State rather than `new Date()` in the render body, because the point is to be able
   * to re-evaluate the status on a *scheduled* basis. Read inline it would only be as
   * current as somebody's last re-render, and an athlete who opened the portal at 13:50
   * and sat on it would still be told a coach was available at 15:00.
   */
  const [clock, setClock] = useState<number>(() => Date.now());

  const load = useCallback(
    async (force: boolean) => {
      if (!userId) {
        cache = null;
        setProfile(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      const at = Date.now();
      const cached = force ? null : readCache(userId, at);
      if (cached) {
        // A cache hit is not a loading state. Spinning here would blank the coach
        // surfaces on every navigation for a read that took no time at all.
        setProfile(cached);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error: err } = await supabase
        .from("profiles")
        .select("is_premium,premium_expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      setIsLoading(false);

      if (err) {
        // A failed read is reported as "not premium" with the error attached rather
        // than as its own state, because gating on the error would strand a paying
        // athlete behind a spinner every time their connection blipped. The message
        // is kept so the surface can offer a retry.
        setError(err.message);
        setProfile(null);
        return;
      }

      const read: CoachProfile = {
        is_premium: data?.is_premium ?? false,
        premium_expires_at: data?.premium_expires_at ?? null,
      };
      // Only a successful read is cached. Caching the failure would turn a transient
      // network error into a settled answer for the next five minutes.
      cache = { userId, readAt: at, profile: read };
      setError(null);
      setProfile(read);
    },
    [userId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  /*
   * Re-evaluate exactly when the shift status could change.
   *
   * One timer, re-armed after each fire -- not an interval over the database, and not
   * an interval at all. The entitlement is deliberately excluded: nothing about a clock
   * changes whether someone pays.
   */
  useEffect(() => {
    const timer = setTimeout(() => setClock(Date.now()), msUntilNextShiftBoundary(new Date()));
    return () => clearTimeout(timer);
  }, [clock]);

  const isPremium = profile !== null && isPremiumActive(profile);

  const status = useMemo(
    () =>
      profile === null
        ? UNKNOWN_STATUS
        : humanCoachStatus(new Date(clock), localOffsetMinutes(), isPremium),
    [profile, clock, isPremium],
  );

  return useMemo(
    () => ({
      isLoading,
      error,
      isPremium,
      // Vía A. `userId !== null` *is* authentication, and it is the whole condition --
      // no `isPremium`, no `isLoading`, no clock. If the free tier is ever withdrawn
      // this is the one line to change, and the gates reading it already exist.
      canChat: userId !== null,
      canGenerateAiRoutine: userId !== null,
      humanCoachStatus: status,
      refresh: async () => {
        await load(true);
      },
    }),
    [isLoading, error, isPremium, userId, status, load],
  );
}

/**
 * Milliseconds until the local clock next reaches a boundary of the shift schedule.
 *
 * Every opening *and* every closing, because the status flips to `off_shift` at a close
 * as well as to `available` at an open. Arming on openings alone would leave the screen
 * claiming a coach was available for up to eight hours after they went home.
 *
 * Capped at one minute. Without the cap, a boundary sixteen hours away leaves a timer
 * parked on a laptop past a sleep, a suspend or a clock change, and the answer goes
 * stale for as long as the machine is closed. Re-arming every minute costs nothing and
 * turns an unbounded staleness into a bounded one -- this is not polling the database,
 * which is what the five-minute cache above is about.
 */
const MAX_BOUNDARY_WAIT_MS = 60_000;

function msUntilNextShiftBoundary(now: Date): number {
  const minutes = localMinutesSinceMidnight(now, localOffsetMinutes(now));

  // Derived from the schedule rather than hardcoded, so a changed shift table does not
  // leave this timer aiming at a boundary that no longer exists.
  const boundaries = COACH_SHIFTS.flatMap((shift) => [shift.startHour, shift.endHour])
    .map((hour) => hour * 60)
    // Already passed today, so not the next event. The overnight gap has no boundaries
    // left and falls through to the first one, which is tomorrow's.
    .filter((at) => at > minutes);

  const nextBoundary = boundaries.length > 0 ? Math.min(...boundaries) : COACH_SHIFTS[0].startHour * 60;

  return Math.max(0, Math.min((nextBoundary - minutes) * 60_000, MAX_BOUNDARY_WAIT_MS));
}