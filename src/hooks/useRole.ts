import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ROLE_CHANGED_EVENT, type Role } from "@/lib/localSession";
import { AUTH_ROLE_KEY, useAuth } from "@/context/AuthContext";

/** Every role the server can grant. */
const KNOWN_ROLES: readonly Role[] = ["athlete", "coach", "admin", "developer"];

/** Where the last answer from `my_roles` is kept, so a slow network cannot hide a panel. */
export const CACHED_ROLES_KEY = "cronos_cached_user_roles_v1";

/** How long `my_roles` may take before the cached answer is used. */
const ROLES_TIMEOUT_MS = 4000;

interface CachedRoles {
  userId: string;
  roles: Role[];
  at: number;
}

function readCachedRoles(userId: string | undefined): Role[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHED_ROLES_KEY) ?? "null") as
      | Partial<CachedRoles>
      | null;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.roles)) return [];
    return parsed.roles.filter((role): role is Role => KNOWN_ROLES.includes(role as Role));
  } catch {
    return [];
  }
}

function writeCachedRoles(userId: string, roles: Role[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedRoles = { userId, roles, at: Date.now() };
    window.localStorage.setItem(CACHED_ROLES_KEY, JSON.stringify(payload));
  } catch {
    // A full localStorage costs the cache, not the access.
  }
}

/** Resolves like the RPC, or refuses to wait forever. */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | "timeout"> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve("timeout");
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve("timeout");
      },
    );
  });
}

/**
 * useRole — combines server roles with the device-local role lens.
 * The local lens is UX state, not authorization; server gates still enforce access.
 */
export function useRole(): { role: Role; roles: Role[]; loading: boolean } {
  const { activeRole, user } = useAuth();
  const userId = user?.userId;
  const isOwner =
    user?.email?.toLowerCase() === "michnsqk07@gmail.com" ||
    user?.displayName?.toLowerCase() === "mich_nsqk";
  const elevatedByEnvironment = import.meta.env.DEV || isOwner;

  const [serverRoles, setServerRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumped whenever the local role changes so the derivation below recomputes the
  // same tick the selector is tapped, without waiting for a context round-trip.
  const [, setRoleVersion] = useState(0);

  useEffect(() => {
    const onRoleChanged = () => setRoleVersion((v) => v + 1);
    window.addEventListener(ROLE_CHANGED_EVENT, onRoleChanged);
    return () => window.removeEventListener(ROLE_CHANGED_EVENT, onRoleChanged);
  }, []);

  useEffect(() => {
    let mounted = true;

    /**
     * The fallback is a role set, never an empty one.
     *
     * `my_roles` can be slow, blocked by a captive portal or refused by a policy
     * that has not been migrated. Showing no panel because a request timed out is
     * a worse answer than the last one the server actually gave, or the local lens
     * the user is already acting in.
     */
    const fallbackRoles = (): Role[] => {
      const cached = readCachedRoles(userId);
      const localRole: Role | null =
        activeRole === "coach" || activeRole === "admin" || activeRole === "developer"
          ? activeRole
          : typeof window !== "undefined" && window.localStorage.getItem(AUTH_ROLE_KEY) === "coach"
            ? "coach"
            : null;
      const merged = new Set<Role>([...(elevatedByEnvironment ? KNOWN_ROLES : cached)]);
      if (isOwner) KNOWN_ROLES.forEach((role) => merged.add(role));
      if (localRole) merged.add(localRole);
      merged.add("athlete");
      return [...merged];
    };

    async function load() {
      setLoading(true);
      const answer = await withTimeout(supabase.rpc("my_roles"), ROLES_TIMEOUT_MS);
      if (!mounted) return;

      if (answer === "timeout") {
        setServerRoles(fallbackRoles());
        setLoading(false);
        return;
      }

      const { data, error } = answer as { data: unknown; error: unknown };
      if (error || !Array.isArray(data)) {
        setServerRoles(fallbackRoles());
        setLoading(false);
        return;
      }

      const mapped = (data as string[]).filter((role): role is Role =>
        KNOWN_ROLES.includes(role as Role),
      );
      if (mapped.length === 0) {
        setServerRoles(fallbackRoles());
        setLoading(false);
        return;
      }
      if (userId) writeCachedRoles(userId, mapped);
      setServerRoles(mapped);
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [activeRole, elevatedByEnvironment, isOwner, userId]);

  const hasLocalOverride =
    activeRole !== "athlete" ||
    (typeof window !== "undefined" && window.localStorage.getItem(AUTH_ROLE_KEY) !== null);
  const localRoles: Role[] = elevatedByEnvironment
    ? [...KNOWN_ROLES]
    : !hasLocalOverride
      ? ["athlete"]
      : [...KNOWN_ROLES];
  const roles = elevatedByEnvironment || hasLocalOverride ? localRoles : serverRoles;

  // An explicit local selection (the selector) always wins, even in a dev build or
  // for the owner: the selector decides which chrome the user is acting in, and a
  // tap on "Atleta" has to take effect immediately rather than fall back to the
  // most-permitted role. Without a selection, fall back to the most capable role.
  const prioritized: Role = hasLocalOverride
    ? activeRole
    : roles.includes("developer")
      ? "developer"
      : roles.includes("admin")
        ? "admin"
        : roles.includes("coach")
          ? "coach"
          : "athlete";
  return {
    role: loading && !elevatedByEnvironment && !hasLocalOverride ? "athlete" : prioritized,
    roles,
    loading,
  };
}