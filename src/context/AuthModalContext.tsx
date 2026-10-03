/**
 * AuthModalContext.tsx — how a screen deep in the tree asks for the sign-in modal.
 *
 * Why this exists: `AuthModal` lives in `AuthGate` and its open state is local to
 * that component, so nothing below it can reach the modal. Outlet context cannot help
 * either -- it carries *down* from the gate, and an `open` callback has to travel the
 * other way.
 *
 * Why a prop rather than the provider owning the state: `AuthGate` already renders the
 * modal and already has the `setIsAuthModalOpen` used by the locked tabs. Moving that
 * state into the provider would mean `AuthGate` consuming it to drive the very same
 * modal, for no gain. The provider here is only a conduit.
 *
 * This exists because the app has no `/login` route: sign-in happens through
 * `AuthModal` (email and password), so a "sign in again" affordance anywhere else in
 * the app has to open that modal rather than navigate somewhere.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface AuthModalValue {
  /** Opens the app's sign-in modal. */
  open: () => void;
}

const AuthModalContext = createContext<AuthModalValue | null>(null);

export function AuthModalProvider({
  open,
  children,
}: {
  open: () => void;
  children: ReactNode;
}) {
  // Memoised so the value identity is stable across renders; a fresh object each time
  // would re-render every consumer in the tree for no reason.
  const value = useMemo<AuthModalValue>(() => ({ open }), [open]);
  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

const NOOP: AuthModalValue = { open: () => undefined };

/**
 * Reads the modal opener.
 *
 * Returns a no-op outside a provider rather than throwing, unlike `useActiveSession`.
 * The difference matters: a missing session context has to be caught loudly because a
 * silent `null` would impersonate "not training", a state that must never be faked.
 * Here the worst a missing provider can do is a button that does nothing, and the
 * component still renders correctly -- which is what lets the chat screen be tested
 * and mounted in the dev catalog without a provider wrapper.
 */
export function useAuthModal(): AuthModalValue {
  return useContext(AuthModalContext) ?? NOOP;
}
