/**
 * AppShell.tsx — the chrome every route renders inside.
 *
 * Composition only. No data fetching, no auth, no workout logic: this component's
 * whole job is to own the space the chrome occupies, so that content can never be
 * trapped underneath it.
 *
 * The padding lives in CSS (`.cronos-shell`) rather than in a style prop because
 * part of it is responsive -- at desktop width the bottom bar is replaced by a
 * side nav -- and inline styles cannot express a media query. The numbers both
 * sides need, the navigation's height and the nav's width, are published here as
 * custom properties so the stylesheet and the components cannot disagree about
 * them.
 */

import type { CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SURFACE } from "@/design/tokens";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BottomNav } from "./BottomNav";
import { ActiveWorkoutPill } from "./ActiveWorkoutPill";
import { SideNav } from "../nav/SideNav";
import { CoachFloatingButton } from "../coach/CoachFloatingButton";
import { SIDE_NAV_COLLAPSED_WIDTH, SIDE_NAV_WIDTH } from "./navItems";
import { useSideNavCollapsed } from "./useSideNavCollapsed";

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
 * Widths of the desktop side nav, re-exported from `navItems.ts`, which is where the
 * numbers are decided: the shell pads the content by one of them and `SideNav`
 * occupies the other, so a nav importing its own width from the component that renders
 * it would close an import cycle. The re-export keeps the names available from the
 * shell for existing callers.
 */
export { SIDE_NAV_WIDTH, SIDE_NAV_COLLAPSED_WIDTH } from "./navItems";

/** Gap between the navigation and the active-session pill, in px. */
export const PILL_GAP = 8;

export function AppShell() {
  const { pathname } = useLocation();
  const reducedMotion = useReducedMotion();
  const { isActive } = useActiveSession();
  /*
    The bottom dock (FAB always on mobile; pill when a session runs) floats over the
    bottom bar. The *amount* of space to reserve is a layout question the stylesheet
    can answer from a single flag, so the breakpoint lives in `index.css` rather than
    here: an inline `style` always beats a media query, so asking React for the width
    would fight the stylesheet instead of cooperating with it. The component only
    signals "a session is running" via a class.
  */
  /*
    Owned here, not inside `SideNav`, because the shell pads the content by the width
    the nav is actually occupying. If the nav kept its own copy the two would disagree
    the moment it collapsed, and the content would sit under a 64px bar with a 240px
    gap beside it.
  */
  const { collapsed, toggle } = useSideNavCollapsed();

  return (
    <div
      className={`cronos-shell${isActive ? " cronos-dock--active" : ""}`}
      style={
        {
          backgroundColor: SURFACE.base,
          // Read by the stylesheet for the shell's own padding. Set here because
          // this is the only place the navigation height and the nav width are decided.
          "--cronos-nav-height": `${NAV_CONTENT_HEIGHT}px`,
          "--cronos-nav-width": `${collapsed ? SIDE_NAV_COLLAPSED_WIDTH : SIDE_NAV_WIDTH}px`,
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

      <SideNav collapsed={collapsed} onToggleCollapsed={toggle} />
      <BottomNav />
      <ActiveWorkoutPill />

      {/*
        Last, so it stacks over the navigation and the pill, and after the outlet so that
        opening the assistant never re-mounts the screen underneath it. It renders nothing
        without a signed-in athlete and nothing on the coach portal; both are its own
        rules, tested there.
      */}
      <CoachFloatingButton />
    </div>
  );
}