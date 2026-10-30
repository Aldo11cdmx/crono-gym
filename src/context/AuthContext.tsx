/**
 * AuthContext.tsx — the signed-in user and the role they are acting as.
 *
 * Why this exists alongside `useAuthSession` in `App.tsx`: the session hook
 * answers "who is this browser", and it answers it once, at mount. The role
 * selector answers "how should this browser look", and that answer changes
 * without a reload -- a coach who also trains switches to athlete mid-session,
 * and the chrome has to follow. Outlet context cannot carry that: it travels
 * *down* from the gate, and the selector has to be reachable from screens that
 * are not descendants of the gate (the modal that offers the switch lives in
 * the gate itself, and a screen that asks to switch needs the setter).
 *
 * The active role is device-local, not account-local. It is the lens, not the
 * identity: the server still decides what the user can do, and `usePermissions`
 * reads the *server* roles through `my_roles`. The local role is a UX switch
 * that decides which chrome renders, exactly as `localSession.ts` already
 * documented. What this context adds is that the switch is shared: before it,
 * `ProfileView` kept `activeRolePreview` in component state, so a change there
 * was invisible everywhere else.
 *
 * Storage: `localStorage`, not IndexedDB. The role is read on the first paint
 * of every screen, and async storage would mean a frame where the coach chrome
 * flickers into athlete chrome before the read resolves. It is namespaced with
 * the product so it cannot collide with the Supabase client's own token keys.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/localSession";

export const AUTH_ROLE_KEY = "cronos:activeRole";

/** The four roles the app understands, in the order the selector renders them. */
export const AUTH_ROLES: readonly Role[] = ["athlete", "coach", "admin", "developer"];

function readActiveRole(): Role {
  if (typeof window === "undefined") return "athlete";
  try {
    const raw = window.localStorage.getItem(AUTH_ROLE_KEY);
    if (raw && (AUTH_ROLES as readonly string[]).includes(raw)) {
      return raw as Role;
    }
  } catch {
    // A full localStorage is an edge case, not a failure: default to athlete.
  }
  return "athlete";
}

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string | null;
}

export interface AuthValue {
  /** The signed-in user, or null when signed out. */
  user: AuthUser | null;
  /** Whether the session has been resolved from Supabase yet. */
  ready: boolean;
  /** The role this device is currently acting as. */
  activeRole: Role;
  roles: string[];
  hasAnyRole: (required: string[]) => boolean;
  /**
   * Switch the active role.
   *
   * Persists to localStorage so it survives a reload, and updates the context
   * so every consumer re-renders. No server call: this is a UX switch, not an
   * identity change.
   */
  setActiveRole: (role: Role) => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const NOOP: AuthValue = {
  user: null,
  ready: false,
  activeRole: "athlete",
  roles: [],
  hasAnyRole: () => false,
  setActiveRole: () => undefined,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [activeRole, setActiveRoleState] = useState<Role>(readActiveRole);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const session = data.session;
      setUser(
        session?.user
          ? {
              userId: session.user.id,
              email: session.user.email ?? "",
              displayName:
                (session.user.user_metadata?.display_name as string | undefined) ?? null,
            }
          : null,
      );
      if (session?.user) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
        if (alive) setRoles((r ?? []).map((x: { role: string }) => x.role));
      } else {
        setRoles([]);
      }
      setReady(true);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setUser(
        next?.user
          ? {
              userId: next.user.id,
              email: next.user.email ?? "",
              displayName:
                (next.user.user_metadata?.display_name as string | undefined) ?? null,
            }
          : null,
      );
      if (next?.user) {
        void supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", next.user.id)
          .then(({ data: r }) => {
            if (alive) setRoles((r ?? []).map((x: { role: string }) => x.role));
          });
      } else {
        setRoles([]);
      }
      setReady(true);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const setActiveRole = useCallback((role: Role) => {
    if (!(AUTH_ROLES as readonly string[]).includes(role)) return;
    setActiveRoleState(role);
    try {
      window.localStorage.setItem(AUTH_ROLE_KEY, role);
    } catch {
      // A full localStorage is an edge case, not a failure.
    }
  }, []);

  const hasAnyRole = useCallback((required: string[]) => required.some((r) => roles.includes(r)), [roles]);

  const value = useMemo<AuthValue>(
    () => ({ user, ready, activeRole, roles, hasAnyRole, setActiveRole }),
    [user, ready, activeRole, roles, hasAnyRole, setActiveRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads the auth state.
 *
 * Returns a no-op value outside a provider rather than throwing, so a screen
 * mounted in the dev catalog without a provider still renders. The worst a
 * missing provider can do is show the athlete chrome to a user who is not
 * signed in -- visible, and recoverable by mounting the provider.
 */
export function useAuth(): AuthValue {
  return useContext(AuthContext) ?? NOOP;
}