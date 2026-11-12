import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/localSession";
import { AUTH_ROLE_KEY, useAuth } from "@/context/AuthContext";

/**
 * useRole — combines server roles with the device-local role lens.
 * The local lens is UX state, not authorization; server gates still enforce access.
 */
export function useRole(): { role: Role; roles: Role[]; loading: boolean } {
  const { activeRole, user } = useAuth();
  const [serverRoles, setServerRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("my_roles");
        if (!mounted) return;
        if (error || !Array.isArray(data)) {
          setServerRoles([]);
          return;
        }
        const mapped = (data as string[]).filter((r): r is Role =>
          ["athlete", "coach", "admin", "developer"].includes(r),
        );
        setServerRoles(mapped);
      } catch {
        if (mounted) setServerRoles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const isOwner =
    user?.email?.toLowerCase() === "michnsqk07@gmail.com" ||
    user?.displayName?.toLowerCase() === "mich_nsqk";
  const elevatedByEnvironment = import.meta.env.DEV || isOwner;
  const hasLocalOverride =
    activeRole !== "athlete" ||
    (typeof window !== "undefined" && window.localStorage.getItem(AUTH_ROLE_KEY) !== null);
  const localRoles: Role[] = elevatedByEnvironment
    ? ["athlete", "coach", "admin", "developer"]
    : !hasLocalOverride
      ? ["athlete"]
      : ["athlete", "coach", "admin", "developer"];
  const roles = elevatedByEnvironment || hasLocalOverride
    ? localRoles
    : serverRoles;

  const prioritized: Role = hasLocalOverride && !elevatedByEnvironment
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