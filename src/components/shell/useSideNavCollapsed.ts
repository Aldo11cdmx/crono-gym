/**
 * useSideNavCollapsed.ts — the desktop side nav's open/closed preference.
 *
 * Owns three things that have to agree and are easy to get wrong separately: the
 * state, the `localStorage` key, and the fact that `localStorage` can throw.
 *
 * Why the preference is remembered at all
 * ---------------------------------------
 * Collapsing the side nav is not a view toggle, it is a statement about how someone
 * works: they want the screen. Asking again on every reload -- which is what an
 * in-memory `useState` does -- makes the app argue with them once per session, and
 * an app that argues is an app people stop trusting with their numbers.
 *
 * Why the read is not the default `useState` initialiser
 * ------------------------------------------------------
 * It looks like it should be:
 *
 *     const [collapsed, setCollapsed] = useState(() => localStorage.getItem(KEY) === "1")
 *
 * and that version is wrong twice. It throws during SSR, where `localStorage` does not
 * exist, and it throws in Safari's private mode, where the property exists and reading
 * it throws `QuotaExceededError`. A navigation bar that takes the whole app down because
 * a browser declined to store a boolean is not a failure anyone would accept, so both
 * failures are caught and resolve to "expanded" -- the safe direction, since an expanded
 * rail shows every destination and a collapsed one hides them behind tooltips.
 *
 * The consequence is worth stating plainly: the rail renders expanded on the first paint
 * and corrects itself if storage disagrees. For one frame on a desktop, that is the right
 * trade for never crashing on load.
 */

import { useCallback, useEffect, useState } from "react";
import { SIDE_NAV_COLLAPSED_KEY } from "./navItems";

/** The stored value. `"1"` rather than `true`, because `localStorage` only has strings. */
const STORED_TRUE = "1";

/**
 * Reads the stored preference.
 *
 * Returns `false` on any failure -- missing `localStorage`, a browser that throws on
 * access, or an unparsable value -- so the caller never has to think about it.
 */
export function readStoredCollapsed(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return window.localStorage.getItem(SIDE_NAV_COLLAPSED_KEY) === STORED_TRUE;
  } catch {
    return false;
  }
}

export interface SideNavCollapsed {
  /** Whether the nav is icon-only. */
  collapsed: boolean;
  /** Flips it and persists the new value. */
  toggle: () => void;
}

export function useSideNavCollapsed(): SideNavCollapsed {
  // Seeded expanded, then corrected after mount. See the note above on why the
  // initialiser cannot be the storage read.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = readStoredCollapsed();
    // Only correct when storage actually says something. Writing `false` back on
    // every mount would mean a first visit persists "expanded" before the user has
    // expressed any preference at all, and the storage would then be full of
    // preferences nobody made.
    if (stored) setCollapsed(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(SIDE_NAV_COLLAPSED_KEY, next ? STORED_TRUE : "0");
        }
      } catch {
        /*
         * A preference that cannot be remembered is still a preference for this
         * session, so the state change stands and only the persistence is lost.
         * Failing loudly here would take the navigation down over a cache.
         */
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}