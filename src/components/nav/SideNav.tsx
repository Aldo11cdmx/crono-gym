/**
 * SideNav.tsx — the desktop navigation.
 *
 * Replaces the bottom bar from 768px up, because four targets along the bottom edge are
 * unusable with a pointer: they are at thumb distance on a phone and nowhere near the
 * hand on a laptop.
 *
 * Renamed from `SideRail`, along with `SIDE_RAIL_WIDTH` and `.cronos-side-rail`.
 *
 * A rename rather than an alias, which is the opposite of what the design tokens got.
 * A token is referenced by two dozen files and renaming it would have changed no pixel;
 * this component had exactly one caller, so keeping a `SideRail` export would have left
 * a name in the codebase for no benefit and two words for "rail" and "nav" meaning the
 * same thing.
 *
 * It reads the same `NAV_DESTINATIONS` as `BottomNav`, deliberately. A sidebar that
 * re-listed its own four destinations would be free to drift from the router and from
 * the mobile bar, and the failure would be a link to a route that does not exist —
 * invisible until someone taps it.
 *
 * Unlike the bottom bar, every item shows its label while the nav is expanded. There is
 * room in 240px, and the rail is used with a cursor: the icon-plus-underscore trick that
 * keeps the mobile bar short would make a desktop menu harder to scan for no gain.
 *
 * Collapsible, because 240px is a fifth of a laptop screen
 * -------------------------------------------------------
 * The expanded nav holds four destinations, four secondary ones, and a brand. That fits
 * comfortably -- and then the athlete opens a workout, a log sheet, or anything else that
 * wants width, and 240px of mostly-empty column is 240px of column not being used.
 *
 * Collapsed it is 64px of icons, which keeps every target at 44px and gives the content
 * 176px back. The preference is remembered, because an athlete who collapses it has said
 * something about how they work (see `useSideNavCollapsed`).
 *
 * Collapsed, the items lose their labels and gain a `title`. `title` is not an
 * accessibility feature -- it does not reliably reach a keyboard or a screen reader --
 * which is why `aria-label` stays on every item in both states and `title` is only there
 * for the sighted mouse user. The labels are removed from the layout rather than hidden
 * with opacity, so they cannot be read aloud twice.
 *
 * The secondary group
 * -------------------
 * `/rangos` and `/progreso` are real destinations that never belonged in a thumb zone.
 * They are listed here in a rail-only group because with a pointer there is room and no
 * reason to hide them -- and they never take an accent fill, so arriving at `/progreso`
 * from a dashboard tile does not put a second "this is the action" cue next to the
 * training button.
 *
 * It is also where the brand lives on a desktop, for the same reason as before: the nav
 * and the bottom bar swap at one breakpoint, and so do the two places the mark is
 * rendered, so a screen never shows the logo twice.
 */

import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { ACCENT, GLASS, MOTION, RADIUS, SPACE, SURFACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { SHELL_LABELS } from "@/lib/i18n";
import { BrandLockup } from "../shell/BrandLockup";
import {
  NAV_DESTINATIONS,
  SECONDARY_DESTINATIONS,
  SIDE_NAV_COLLAPSED_WIDTH,
  SIDE_NAV_WIDTH,
  type NavDestination,
} from "../shell/navItems";

export interface SideNavProps {
  /** Icon-only when true. Controlled by `AppShell`, which owns the persisted preference. */
  collapsed?: boolean;
  /** Flips the collapsed state. */
  onToggleCollapsed?: () => void;
  /** Called after a destination is chosen, so a host drawer can close itself. */
  onNavigate?: () => void;
}

export function SideNav({
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: SideNavProps = {}) {
  const width = collapsed ? SIDE_NAV_COLLAPSED_WIDTH : SIDE_NAV_WIDTH;

  return (
    <nav
      aria-label={SHELL_LABELS.sidebarAriaLabel}
      className="cronos-side-nav"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: `${width}px`,
        /*
         * The bottom bar's own index, not the modal's. This used to be 60 and the
         * number was pinned by a test that read it as a guarantee the navigation
         * stayed reachable over an overlay -- which is exactly backwards: a dialog
         * summoned *from* the navigation has to paint over it, or the athlete taps
         * the bar instead of the dialog they just opened.
         */
        zIndex: Z_INDEX.nav,
        backgroundColor: SURFACE.raised,
        borderRight: `1px solid ${GLASS.border}`,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        transition: `width ${MOTION.normal} ${MOTION.easeOut}`,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/*
        The brand sits in the nav's own top slot rather than in a separate header,
        because on a desktop the rail *is* the left edge of the app: a full-width
        header would either float over the content column or push it down, and neither
        buys anything the rail's padding does not.

        Hidden below 768px, where the rail is `display: none` and `App.tsx`'s header
        carries the mark instead. Same rule as the navigation itself -- exactly one of
        the two is ever on screen.
      */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          // Matches the item padding, so the mark's left edge lines up with the
          // labels' left edge instead of sitting inside them.
          padding: `${SPACE.lg} ${collapsed ? SPACE.sm : SPACE.md} ${SPACE.md}`,
          minHeight: 64,
          flexShrink: 0,
        }}
      >
        {collapsed ? <BrandLockup size={32} showWordmark={false} /> : <BrandLockup size={32} />}
      </div>

      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.xs,
          margin: 0,
          padding: `0 ${SPACE.sm}`,
          listStyle: "none",
        }}
      >
        {NAV_DESTINATIONS.map((destination) => (
          <NavItem
            key={destination.path}
            destination={destination}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </ul>

      {/*
        The divider is a real `<hr>`, styled rather than a `<div>` with a border.
        It is what separates "where I go" from "things worth looking at", and an
        element that means that is cheaper to understand than a margin.
      */}
      <hr
        aria-hidden="true"
        style={{
          border: 0,
          borderTop: `1px solid ${GLASS.border}`,
          margin: `${SPACE.md} ${SPACE.sm}`,
        }}
      />

      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.xs,
          margin: 0,
          padding: `0 ${SPACE.sm}`,
          listStyle: "none",
        }}
      >
        {SECONDARY_DESTINATIONS.map((destination) => (
          <NavItem
            key={destination.path}
            destination={destination}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </ul>

      {/*
        The toggle is last and pinned to the bottom, because it is a preference about
        the whole column rather than a destination. Putting it at the top would make
        it the first thing reached for, and it is the control an athlete uses
        deliberately, maybe twice a session.
      */}
      <div
        style={{
          // Pushed down rather than `position: absolute`, so it stays reachable when
          // the destinations are tall enough to need the scroll container.
          marginTop: "auto",
          padding: `${SPACE.sm}`,
          position: "sticky",
          bottom: 0,
          backgroundColor: SURFACE.raised,
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          // `aria-expanded` on the control that changes it, which is the whole
          // contract. The `aria-label` swaps with the state so the button says what
          // it will *do*, not what it currently is -- a screen reader user pressing
          // "Contraer" on an already-collapsed nav hears nothing wrong either way.
          aria-expanded={!collapsed}
          aria-label={collapsed ? SHELL_LABELS.sidebarExpand : SHELL_LABELS.sidebarCollapse}
          title={collapsed ? SHELL_LABELS.sidebarExpand : SHELL_LABELS.sidebarCollapse}
          className="cronos-side-nav-toggle"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: SPACE.sm,
            width: "100%",
            minHeight: MOTION.minTouchTarget,
            padding: `0 ${SPACE.md}`,
            border: `1px solid ${GLASS.border}`,
            borderRadius: RADIUS.control,
            backgroundColor: "transparent",
            color: TEXT.tertiary,
            cursor: "pointer",
            transition: `color ${MOTION.fast} ${MOTION.standard}`,
          }}
        >
          {/*
            Drawn rather than imported: the chevron has to point *away* from the
            direction the nav will move, so it flips with the state. An icon from the
            set would need a second entry for the same glyph, and the rotation is the
            whole meaning.
          */}
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              transition: `transform ${MOTION.normal} ${MOTION.easeOut}`,
              transform: collapsed ? "rotate(180deg)" : "none",
            }}
          >
            <ChevronLeft />
          </span>
          {!collapsed && (
            <span style={{ fontSize: TYPE.label.size, fontWeight: 600, letterSpacing: TYPE.label.tracking }}>
              {SHELL_LABELS.sidebarCollapse}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}

/** The 16px chevron, inlined so the direction is derived from one source. */
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function NavItem({
  destination,
  collapsed,
  onNavigate,
}: {
  destination: NavDestination;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = destination.icon;
  // The thumb bar's one accent fill. A rail item that is not the current destination
  // shows no tint at all, so this stays the only place the training action is filled.
  const primaryFill = destination.primary === true;

  return (
    <li>
      <NavLink
        to={destination.path}
        // NavLink owns `aria-current="page"`. `end` unconditionally: every destination
        // is a literal with no children, so prefix matching can only ever light up the
        // wrong row -- and with the home route no longer `/` there is no path for which
        // a prefix match was ever the right answer.
        end
        aria-label={destination.ariaLabel}
        // `title` only when collapsed, where it is the only way a sighted pointer user
        // can read the item. In both states `aria-label` above is the name assistive
        // technology uses.
        title={collapsed ? destination.ariaLabel : undefined}
        onClick={onNavigate}
        className="cronos-side-nav-item"
        style={({ isActive }) => {
          const highlighted = isActive && !destination.secondary;
          return {
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: SPACE.sm,
            minHeight: MOTION.minTouchTarget,
            padding: `0 ${collapsed ? SPACE.xs : SPACE.md}`,
            borderRadius: RADIUS.control,
            fontSize: TYPE.body.size,
            fontWeight: 600,
            textDecoration: "none",
            // Position rather than colour alone: the accent bar is what says "you are
            // here", and a tint alone would say it twice over in the row when the eye
            // is already tracking position.
            boxShadow: highlighted ? `inset 2px 0 0 0 ${ACCENT.base}` : "none",
            color: isActive ? TEXT.primary : TEXT.secondary,
            backgroundColor: highlighted ? ACCENT.muted : "transparent",
            transition: `background-color ${MOTION.fast} ${MOTION.standard}, color ${MOTION.fast} ${MOTION.standard}, width ${MOTION.normal} ${MOTION.easeOut}`,
          } satisfies CSSProperties;
        }}
      >
        {/*
          The primary destination keeps its accent fill in the rail too. The accent
          means "this is the action" on every screen, and dropping it here because the
          layout is vertical would spend the brand on decoration.
        */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Fills to a full circle rather than a squircle: the thumb bar's centre
            // action is round, and the same control drawn two ways on two layouts is
            // two things to remember.
            width: primaryFill ? 32 : 24,
            height: primaryFill ? 32 : 24,
            borderRadius: primaryFill ? RADIUS.round : undefined,
            backgroundColor: primaryFill ? ACCENT.base : "transparent",
            color: primaryFill ? TEXT.onAccent : undefined,
            boxShadow: primaryFill ? ACCENT.ring : undefined,
            flexShrink: 0,
          }}
        >
          <Icon size={20} strokeWidth={2} />
        </span>
        {!collapsed && (
          <span
            style={{
              fontSize: TYPE.subhead.size,
              lineHeight: TYPE.subhead.lineHeight,
              fontWeight: TYPE.subhead.weight,
              letterSpacing: TYPE.subhead.tracking,
              // Fixed width so the column does not shuffle as the user moves between
              // items of different name lengths.
              flex: 1,
              // Never clipped: the longest secondary label is "Progreso", and truncating
              // it to fit 240px would cost the whole column more than the eight
              // characters it saved.
              whiteSpace: "nowrap",
            }}
          >
            {destination.label}
          </span>
        )}
      </NavLink>
    </li>
  );
}