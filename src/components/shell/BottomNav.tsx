/**
 * BottomNav.tsx — the thumb-zone navigation.
 *
 * A bottom bar rather than a header because every action in this app is performed
 * one-handed, often while holding a weight in the other hand. The top of the
 * screen is the worst place to put a control you need mid-set.
 *
 * The active item shows its label; the inactive ones do not. Five permanent labels
 * turn the bar into a wall of text and make the bar a third taller, and the icon
 * plus `aria-label` already carry the meaning for anyone not reading the pixels.
 */

import type { CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ACCENT, GLASS, MOTION, TEXT, TYPE } from "@/design/tokens";
import { SHELL_LABELS } from "@/lib/i18n";
import { THUMB_DESTINATIONS, type NavDestination } from "./navItems";
import { NAV_CONTENT_HEIGHT } from "./AppShell";

export function BottomNav() {
  const { pathname } = useLocation();

  // Drives the sliding indicator. Position rather than opacity, because the
  // indicator's job is to say *where* in the bar you are, and it cannot say that
  // by being visible alone.
  const match = THUMB_DESTINATIONS.findIndex(
    (destination) => pathname === destination.path,
  );
  const activeIndex = match === -1 ? 0 : match;

  return (
    <nav
      aria-label={SHELL_LABELS.navAriaLabel}
      className="cronos-bottom-nav"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        // Above the sheet (50) and the sticky header (40): the navigation is the
        // one thing that must stay reachable while an overlay is open.
        zIndex: 60,
        height: `calc(${NAV_CONTENT_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backgroundColor: GLASS.fill,
        borderTop: `1px solid ${GLASS.border}`,
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
      }}
    >
      <span
        aria-hidden="true"
        data-testid="bottom-nav-indicator"
        style={{
          position: "absolute",
          top: 0,
          left: `${(activeIndex * 100) / THUMB_DESTINATIONS.length}%`,
          width: `${100 / THUMB_DESTINATIONS.length}%`,
          height: 2,
          backgroundColor: ACCENT.base,
          borderRadius: "0 0 2px 2px",
          transition: `left ${MOTION.base} ${MOTION.ease}`,
        }}
      />
      <ul
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${THUMB_DESTINATIONS.length}, 1fr)`,
          height: NAV_CONTENT_HEIGHT,
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {THUMB_DESTINATIONS.map((destination) => (
          <NavItem key={destination.path} destination={destination} />
        ))}
      </ul>
    </nav>
  );
}

function NavItem({ destination }: { destination: NavDestination }) {
  const Icon = destination.icon;

  return (
    <li style={{ display: "flex" }}>
      <NavLink
        to={destination.path}
        // NavLink owns `aria-current="page"`; setting it here too would be a
        // second source of truth for the same fact. `end` unconditionally: every
        // destination is a literal with no children, so prefix matching can only
        // ever light up the wrong row.
        end
        aria-label={destination.ariaLabel}
        className="cronos-nav-item"
        style={
          {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            flex: 1,
            // WCAG 2.5.5. Declared inline rather than in a class so the value
            // stays tied to the MOTION token that documents it.
            minHeight: MOTION.minTouchTarget,
            minWidth: MOTION.minTouchTarget,
            // The centre action sits proud of the bar.
            transform: destination.primary ? "translateY(-8px)" : undefined,
            color: TEXT.tertiary,
            transition: `color ${MOTION.base} ${MOTION.ease}`,
          } satisfies CSSProperties
        }
      >
        {({ isActive }) => (
          <>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: destination.primary ? 52 : 24,
                height: destination.primary ? 52 : 24,
                borderRadius: destination.primary ? 26 : undefined,
                backgroundColor: destination.primary ? ACCENT.base : undefined,
                color: destination.primary ? TEXT.onAccent : undefined,
                boxShadow: destination.primary ? GLASS.shadow : undefined,
                // A ring only on the active item, so the two never both read as
                // "you are here".
                border: `1px solid ${isActive ? ACCENT.border : "transparent"}`,
              }}
            >
              <Icon aria-hidden="true" size={destination.primary ? 24 : 22} strokeWidth={2} />
            </span>
            {/*
              The centre action has no visible label: the raised fill already says
              "this one", and a fifth word under the icon would break the row the
              other four sit in. Its name is on `aria-label` above.
            */}
            {!destination.primary && (
              <span
                style={{
                  fontSize: TYPE.label.size,
                  fontWeight: 600,
                  letterSpacing: TYPE.label.tracking,
                  lineHeight: 1.2,
                  // Kept in the layout at zero height when inactive so the bar
                  // does not resize as the user moves between items.
                  height: isActive ? undefined : 0,
                  opacity: isActive ? 1 : 0,
                  overflow: "hidden",
                }}
              >
                {destination.label}
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}