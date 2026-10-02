/**
 * AppShell.tsx — the chrome every route renders inside.
 *
 * Composition only. No data fetching, no auth, no workout logic: this component's
 * whole job is to own the space the chrome occupies, so that content can never be
 * trapped underneath it.
 *
 * The padding lives in CSS (`.cronos-shell`) rather than in a style prop because
 * part of it is responsive -- at desktop width the bottom bar is replaced by a
 * side rail -- and inline styles cannot express a media query. The one number both
 * sides need, the navigation's height, is published here as a custom property so
 * the stylesheet and the components cannot disagree about it.
 */

import type { CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SURFACE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BottomNav } from "./BottomNav";
import { ActiveWorkoutPill } from "./ActiveWorkoutPill";
import { SideRail } from "../nav/SideRail";
import { SIDE_RAIL_WIDTH } from "./navItems";

/**
 * Content height of the bottom navigation, in px, excluding the safe-area inset.
 *
 * Exported because three things have to agree on it: the shell's bottom padding,
 * the navigation's own height, and the pill's offset above it. Duplicating the
 * number in three stylesheets is how content ends up permanently half-hidden
 * behind the navigation.
 */
export const NAV_CONTENT_HEIGHT = 56;

/**
 * Width of the desktop side rail, in px.
 *
 * Re-exported from `navItems.ts`, which is where the number is decided: the
 * shell pads the content by it and `SideRail` occupies it, so a rail importing
 * the width from the component that renders it would close an import cycle. The
 * re-export keeps the name available from the shell for existing callers.
 */
export { SIDE_RAIL_WIDTH } from "./navItems";

/** Gap between the navigation and the active-session pill, in px. */
export const PILL_GAP = 8;

export function AppShell() {
  const { pathname } = useLocation();
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="cronos-shell"
      style={
        {
          backgroundColor: SURFACE.base,
          // Read by the stylesheet for the shell's own padding. Set here because
          // this is the only place the navigation height is decided.
          "--cronos-nav-height": `${NAV_CONTENT_HEIGHT}px`,
          "--cronos-rail-width": `${SIDE_RAIL_WIDTH}px`,
        } as CSSProperties
      }
    >
      {/*
        Keyed by pathname, so React unmounts the old subtree and mounts the new one
        and the entry animation runs for each route. The alternative -- a single
        persistent node -- would mean the transition has to be driven by a class
        toggling, which cannot re-run on a second navigation to the same route.
      */}
      <div
        key={pathname}
        className={reducedMotion ? "cronos-route" : "cronos-route cronos-route--animate"}
      >
        <Outlet />
      </div>

      <SideRail />
      <BottomNav />
      <ActiveWorkoutPill />
    </div>
  );
}