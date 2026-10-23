import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/localSession";

/**
 * useRole â€” server-authoritative role (my_roles RPC). Fail-closed: loading/error/offline => athlete.
 */
export function useRole(): { role: Role; roles: Role[]; loading: boolean } {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("my_roles");
        if (!mounted) return;
        if (error || !Array.isArray(data)) {
          setRoles([]);
          return;
        }
        const mapped = (data as string[]).filter((r): r is Role =>
          ["athlete", "coach", "admin", "developer"].includes(r),
        );
        setRoles(mapped);
      } catch {
        if (mounted) setRoles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // priority: developer > admin > coach > athlete
  const prioritized: Role = roles.includes("developer")
    ? "developer"
    : roles.includes("admin")
      ? "admin"
      : roles.includes("coach")
        ? "coach"
        : "athlete";
  return { role: loading ? "athlete" : prioritized, roles, loading };
}