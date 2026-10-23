import { type ReactNode } from "react";
import { RoleGate } from "./RoleGate";

export interface AdminGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminGate({ children, fallback }: AdminGateProps) {
  return (
    <RoleGate allow={["admin"]} fallback={fallback}>
      {children}
    </RoleGate>
  );
}
