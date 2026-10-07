/**
 * RoleGate.tsx — render conditional on the local role.
 *
 * The local role is a UX switch, not a security boundary. This component does
 * not decide what a user may *do*; it decides what chrome to show. The real
 * enforcement is the server: RLS on `profiles.role`, the coach's own
 * authenticated account, and whatever the Edge Functions check. When real
 * auth with roles ships, this file is the only thing that changes.
 *
 * Two rules, in the order they are applied:
 *
 *   1. While the session is loading, render nothing. The alternative -- a
 *      flash of the fallback or of the children -- is the thing this exists to
 *      prevent: a developer gate that shows its contents to an athlete for one
 *      frame is a leak, and the frame is invisible in review.
 *   2. Once loaded, render `children` only when the role is in `allow`.
 *      Anything else renders `fallback`, which defaults to `null` -- i.e. the
 *      element is not in the DOM at all, not a visibly empty card.
 *
 * `allow` is an array because a gate may legitimately admit more than one
 * role, and naming that as a set rather than "not athlete" keeps the intent
 * explicit: a gate that says `allow={["developer", "coach"]}` is readable as
 * "this is for developers and coaches", while `allow={!["athlete"]}` would be
 * a negation that invites a future edit to flip it the wrong way.
 */

import { type ReactNode } from "react";
import { useLocalSession, type Role } from "@/lib/localSession";

export interface RoleGateProps {
  /** Roles that may see `children`. */
  allow: readonly Role[];
  /** Rendered when the role is not in `allow`. Defaults to nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders `children` only for a loaded session whose role is in `allow`.
 *
 * While loading, renders nothing -- not the fallback, not a spinner. A gate
 * that flashes its contents before the session resolves is the failure this
 * component exists to prevent, and the frame is one no review catches.
 */
export function RoleGate({ allow, fallback = null, children }: RoleGateProps) {
  const { role, loading } = useLocalSession();

  if (loading) return null;
  if ((allow as readonly string[]).includes(role)) return <>{children}</>;
  return <>{fallback}</>;
}