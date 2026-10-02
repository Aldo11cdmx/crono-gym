/**
 * SideRail.tsx — the desktop navigation.
 *
 * Replaces the bottom bar from 768px up, because five targets along the bottom
 * edge are unusable with a pointer: they are at thumb distance on a phone and
 * nowhere near the hand on a laptop.
 *
 * It reads the same `NAV_DESTINATIONS` as `BottomNav`, deliberately. A sidebar
 * that re-listed its own five destinations would be free to drift from the router
 * and from the mobile bar, and the failure would be a link to a route that does
 * not exist — invisible until someone taps it.
 *
 * Unlike the bottom bar, **every** item shows its label. There is room here, and
 * the rail is used with a cursor: the icon-plus-underscore trick that keeps the
 * mobile bar short would make a desktop menu harder to scan for no gain.
 *
 * The rail has no open/closed state. Below 768px `BottomNav` is the navigation
 * and `.cronos-side-rail` is `display: none`, so the two are never visible
 * together and there is nothing to collapse.
 */

import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { ACCENT, GLASS, MOTION, RADIUS, SPACE, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { SHELL_LABELS } from "@/lib/i18n";
import { NAV_DESTINATIONS, SIDE_RAIL_WIDTH, type NavDestination } from "../shell/navItems";

export interface SideRailProps {
  /** Called after a destination is chosen, so a host drawer can close itself. */
  onNavigate?: () => void;
}

export function SideRail({ onNavigate }: SideRailProps = {}) {
  return (
    <nav
      aria-label={SHELL_LABELS.sidebarAriaLabel}
      className="cronos-side-rail"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: SIDE_RAIL_WIDTH,
        // Matches the bottom bar: the navigation stays reachable above an open
        // sheet (50) and above the sticky header (40).
        zIndex: 60,
        backgroundColor: SURFACE.raised,
        borderRight: `1px solid ${GLASS.border}`,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        transition: `transform ${MOTION.base} ${MOTION.ease}`,
        overflowY: "auto",
      }}
    >
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.xs,
          margin: 0,
          padding: `${SPACE.lg} ${SPACE.sm}`,
          listStyle: "none",
        }}
      >
        {NAV_DESTINATIONS.map((destination) => (
          <RailItem key={destination.path} destination={destination} onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  );
}

function RailItem({
  destination,
  onNavigate,
}: {
  destination: NavDestination;
  onNavigate?: () => void;
}) {
  const Icon = destination.icon;

  return (
    <li>
      <NavLink
        to={destination.path}
        // NavLink owns `aria-current="page"`.
        end={destination.path === "/"}
        aria-label={destination.ariaLabel}
        onClick={onNavigate}
        className="cronos-rail-item"
        style={({ isActive }) =>
          ({
            display: "flex",
            alignItems: "center",
            gap: SPACE.sm,
            minHeight: MOTION.minTouchTarget,
            padding: `0 ${SPACE.md}`,
            borderRadius: RADIUS.control,
            fontSize: TYPE.body.size,
            fontWeight: 600,
            textDecoration: "none",
            // Position rather than colour alone: the accent bar is what says
            // "you are here", and a tint alone would say it twice over in the
            // row when the eye is already tracking position.
            boxShadow: isActive ? `inset 2px 0 0 0 ${ACCENT.base}` : "none",
            color: isActive ? TEXT.primary : TEXT.secondary,
            backgroundColor: isActive ? ACCENT.muted : "transparent",
            transition: `background-color ${MOTION.fast} ${MOTION.ease}, color ${MOTION.fast} ${MOTION.ease}`,
          }) satisfies CSSProperties
        }
      >
        {/*
          The primary destination keeps its accent fill in the rail too. The
          accent means "this is the action" on every screen, and dropping it here
          because the layout is vertical would spend the brand on decoration.
        */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: destination.primary ? 32 : 24,
            height: destination.primary ? 32 : 24,
            borderRadius: destination.primary ? RADIUS.pill : undefined,
            backgroundColor: destination.primary ? ACCENT.base : "transparent",
            color: destination.primary ? TEXT.onAccent : undefined,
            boxShadow: destination.primary ? GLASS.shadow : undefined,
          }}
        >
          <Icon size={destination.primary ? 20 : 20} strokeWidth={2} />
        </span>
        <span
          style={{
            fontSize: TYPE.label.size,
            fontWeight: 600,
            letterSpacing: TYPE.label.tracking,
            // Fixed width so the column does not shuffle as the user moves
            // between items of different name lengths.
            flex: 1,
          }}
        >
          {destination.label}
        </span>
      </NavLink>
    </li>
  );
}
