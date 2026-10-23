import { useRole } from "@/hooks/useRole";
import type { Role } from "@/lib/localSession";

export type Permission =
  | "admin:users"
  | "admin:roles"
  | "admin:announcements"
  | "admin:coaches"
  | "admin:audit"
  | "admin:config"
  | "dev:diagnostics"
  | "dev:flags"
  | "dev:tools"
  | "dev:ui"
  | "coach:portal"
  | "coach:athletes"
  | "coach:routines"
  | "coach:messages"
  | "athlete:own";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  athlete: ["athlete:own"],
  coach: ["athlete:own", "coach:portal", "coach:athletes", "coach:routines", "coach:messages"],
  admin: [
    "athlete:own",
    "admin:users",
    "admin:roles",
    "admin:announcements",
    "admin:coaches",
    "admin:audit",
    "admin:config",
  ],
  developer: [
    "athlete:own",
    "dev:diagnostics",
    "dev:flags",
    "dev:tools",
    "dev:ui",
  ],
};

export function usePermissions() {
  const { role, roles, loading } = useRole();

  const hasRole = (r: Role | Role[]): boolean => {
    if (Array.isArray(r)) {
      return r.some((rr) => roles.includes(rr));
    }
    return roles.includes(r);
  };

  const hasAnyRole = hasRole;

  const hasPermission = (p: Permission): boolean => {
    if (roles.length === 0) return false;
    return roles.some((r) => ROLE_PERMISSIONS[r].includes(p));
  };

  const canAccessRoute = (route: string): boolean => {
    if (route.startsWith("/admin")) return hasRole("admin");
    if (route.startsWith("/developer")) return hasRole("developer");
    if (route.startsWith("/coach/portal") || route === "/coach") {
      return hasRole(["coach", "admin", "developer"]);
    }
    if (route.startsWith("/dev/")) {
      return hasRole("developer") || import.meta.env.DEV;
    }
    return true;
  };

  const canPerform = (action: string, _resource?: string): boolean => {
    // Basic mapping for common actions
    if (action === "assign_role" || action === "revoke_role") return hasPermission("admin:roles");
    if (action === "create_announcement" || action === "edit_announcement") return hasPermission("admin:announcements");
    if (action === "manage_coaches") return hasPermission("admin:coaches");
    if (action === "access_dev_tools") return hasPermission("dev:tools");
    if (action === "access_coach_portal") return hasPermission("coach:portal");
    return false;
  };

  return {
    role,
    roles,
    loading,
    hasRole,
    hasAnyRole,
    hasPermission,
    canAccessRoute,
    canPerform,
  };
}
