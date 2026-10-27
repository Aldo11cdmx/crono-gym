import { type ReactNode } from "react";
import { useRole } from "@/hooks/useRole";
import type { Role } from "@/lib/localSession";
import { Skeleton } from "@/components/ui";
import { SPACE, TYPE, TEXT } from "@/design/tokens";

export interface RoleGateProps {
  allow: readonly Role[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({ allow, fallback = null, children }: RoleGateProps) {
  const { role, loading } = useRole();
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, padding: SPACE.lg }}>
        <h2 style={{ fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary, margin: 0 }}>
          Panel de Administración
        </h2>
        <Skeleton variant="block" height="80px" />
      </div>
    );
  }
  if ((allow as readonly string[]).includes(role)) return <>{children}</>;
  return <>{fallback}</>;
}
