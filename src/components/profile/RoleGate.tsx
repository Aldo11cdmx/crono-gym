import { type ReactNode } from "react";
import { useRole } from "@/hooks/useRole";
import type { Role } from "@/lib/localSession";

export interface RoleGateProps {
  allow: readonly Role[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({ allow, fallback = null, children }: RoleGateProps) {
  const { role, loading } = useRole();
  if (loading) return null;
  if ((allow as readonly string[]).includes(role)) return <>{children}</>;
  return <>{fallback}</>;
}