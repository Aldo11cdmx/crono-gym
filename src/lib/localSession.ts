/**
 * localSession.ts — the single owner of the local role.
 *
 * This module wraps the real Supabase session and adds one thing the server does
 * not yet provide: a *local* role. It reads that role from Dexie (`localState`),
 * never from the JWT, and the contract is explicit about what that means:
 *
 *   The local role is NOT security. It is a UX switch — it decides which
 *   developer-only chrome renders. The real boundary is the server: RLS on
 *   `profiles.role`, the coach's own authenticated account, and whatever the
 *   Edge Functions enforce. When real auth with roles ships, this file is the
 *   only place that changes; every gate below it keeps working because they
 *   ask "is this user allowed to see this?" and the answer still comes from
 *   the row in `localState`.
 *
 * A corrupt or unknown value falls back to `"athlete"`, never to
 * `"developer"`: an athlete sees the athlete app, and a developer who has
 * lost their flag is still an athlete until they set it again. The only route
 * to `"developer"` from a missing row is the dev build itself, which is the
 * point of `import.meta.env.DEV`.
 */

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { LOCAL_STATE_STORE, tx } from "./idb";

export type Role = "athlete" | "developer" | "coach";

/** The key under which the role row is stored. */
export const LOCAL_STATE_KEY = "cronos-local-state-v1";

/** Valid role values, in the order the selector renders them. */
const VALID_ROLES: readonly Role[] = ["athlete", "developer", "coach"];

/**
 * Reads the local role from Dexie, falling back through the chain documented
 * above. Never throws: a missing database is the same as "no role stored".
 */
async function readLocalRole(): Promise<Role> {
  const row = await tx<{ role?: unknown; key?: string }>(
    LOCAL_STATE_STORE,
    "readonly",
    (store) => store.get(LOCAL_STATE_KEY),
  );

  const rawRole = row?.role;
  if (rawRole && typeof rawRole === "string" && (VALID_ROLES as readonly string[]).includes(rawRole)) {
    return rawRole as Role;
  }

  // No stored role, or a corrupt one. In a dev build a developer is the
  // default, because the panel that sets this lives behind a developer gate
  // and a brand-new install would otherwise never reach it.
  if (import.meta.env.DEV || import.meta.env.VITE_DEFAULT_ROLE === "developer") {
    return "developer";
  }
  return "athlete";
}

/**
 * The local session: the real user id from Supabase plus the local role.
 *
 * `userId` is `null` when signed out; the role is still readable in that case
 * because it is device-local, not user-local, and a developer who is signed
 * out may still want the dev chrome.
 */
export async function getLocalSession(): Promise<{ userId: string | null; role: Role }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || null;
  const role = await readLocalRole();
  return { userId, role };
}

/**
 * Reactive version of {@link getLocalSession}.
 *
 * Re-reads on every auth state change so a sign-in or sign-out updates the
 * role alongside the user id. `loading` starts `true` and flips once.
 */
export function useLocalSession() {
  const [session, setSession] = useState<{
    userId: string | null;
    role: Role;
    loading: boolean;
  }>({
    userId: null,
    role: "athlete",
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { userId, role } = await getLocalSession();
      if (mounted) {
        setSession({ userId, role, loading: false });
      }
    }

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return session;
}