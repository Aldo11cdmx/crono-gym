/**
 * DeveloperGate.tsx — a thin alias over {@link RoleGate}.
 *
 * The intent is "this is developer-only", and spelling that out at every call
 * site as `allow={["developer"]}` would mean the set of roles a gate admits
 * is repeated inline in twelve places, which is exactly how a gate that
 * should also admit coaches ends up admitting only developers after a
 * refactor that never touched it. This file is the one place that says which
 * roles the developer surface is for, so changing it later is one edit.
 *
 * It is an alias rather than a wrapper that calls `RoleGate` with a default,
 * because a default would be invisible at the call site and the reviewer
 * would have to read the implementation to know the gate's policy. The
 * component name is the policy.
 */

import { type ReactNode } from "react";
import { RoleGate } from "./RoleGate";

export interface DeveloperGateProps {
  children: ReactNode;
  /** Replaces the default refusal. */
  fallback?: ReactNode;
}

/** Renders `children` only for a loaded session whose role is `developer`. */
export function DeveloperGate({ children, fallback }: DeveloperGateProps) {
  return (
    <RoleGate allow={["developer"]} fallback={fallback}>
      {children}
    </RoleGate>
  );
}