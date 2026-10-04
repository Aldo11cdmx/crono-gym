/**
 * BottomNav.tsx — the thumb-zone navigation.
 *
 * A bottom bar rather than a header because every action in this app is performed
 * one-handed, often while holding a weight in the other hand. The top of the
 * screen is the worst place to put a control you need mid-set.
 *
 * Four targets, one of them raised
 * --------------------------------
 * The bar used to carry five equal items with a raised centre button. Five put two
 * items on one side of the button and one on the other, so the button the athlete is
 * reaching for sat half a column off centre -- and the grid arithmetic below still
 * worked, which is the worst part: it looked correct in code and was wrong in the hand.
 *
 * Four fixes the geometry, because two sit either side of the button. It is also the
 * number the bar can hold at 44px without the targets feeling like a keyboard.
 *
 * The active item shows its label; the inactive ones do not. Four permanent labels turn
 * the bar into a wall of text and make it a third taller, and the icon plus `aria-label`
 * already carry the meaning for anyone not reading the pixels.
 *
 * Two things this component deliberately does not own: the active-session pulse, which
 * lives in `ActiveWorkoutPill`'s store rather than here, and the haptics on the centre
 * button, which are `navigator.vibrate` and belong with the press feedback in
 * `GlassButton` so that every button in the app buzzes the same amount.
 */

import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { ACCENT, GLASS, MOTION, RADIUS, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { SHELL_LABELS } from "@/lib/i18n";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { THUMB_DESTINATIONS, type NavDestination } from "./navItems";
import { NAV_CONTENT_HEIGHT } from "./AppShell";

/** Diameter of the raised centre action, in px. */
export const CENTRE_ACTION_SIZE = 56;

/** How far the centre action sits proud of the bar. */
export const CENTRE_ACTION_LIFT = 12;

/** Diameter of the dot under the active item's icon, in px. */
export const ACTIVE_DOT_SIZE = 4;

export function BottomNav() {
  return (
    <nav
      aria-label={SHELL_LABELS.navAriaLabel}
      className="cronos-bottom-nav"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        /*
         * Below every surface the user summoned on purpose. This used to be 60, the
         * modal's own index, which meant a modal opened *from* the navigation painted
         * underneath it and the athlete tapped the bar instead of the dialog.
         */
        zIndex: Z_INDEX.nav,
        height: `calc(${NAV_CONTENT_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        /*
         * Opaque rather than glass. The bar sits directly on a page whose content
         * changes as the athlete scrolls, and a 6% white fill over moving content reads
         * as a rendering fault on a black screen rather than as depth. The blur is what
         * sells it; the fill only has to hide what is behind.
         */
        backgroundColor: GLASS.fillRaised,
        borderTop: `1px solid ${SURFACE_HAIRLINE}`,
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
      }}
    >
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

/**
 * The bar's own hairline.
 *
 * `GLASS.border` at 10% white is invisible against an opaque bar at the top edge on an
 * OLED panel, which is where the bar most often is -- over the black end of a list. One
 * step stronger so the bar reads as a separate surface rather than as content that
 * happens to stop.
 */
const SURFACE_HAIRLINE = "rgba(255, 255, 255, 0.08)";

function NavItem({ destination }: { destination: NavDestination }) {
  const Icon = destination.icon;
  const reducedMotion = useReducedMotion();

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
        data-active={undefined}
        style={
          {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 4,
            flex: 1,
            // WCAG 2.5.5. Declared inline rather than in a class so the value
            // stays tied to the MOTION token that documents it.
            minHeight: MOTION.minTouchTarget,
            minWidth: MOTION.minTouchTarget,
            paddingTop: destination.primary ? 0 : 8,
            transition: `color ${MOTION.normal} ${MOTION.easeOut}`,
          } satisfies CSSProperties
        }
      >
        {({ isActive }) => (
          <>
            {destination.primary ? (
              <CentreAction destination={destination} reducedMotion={reducedMotion} />
            ) : (
              <>
                <Icon
                  aria-hidden="true"
                  size={24}
                  strokeWidth={isActive ? 2.4 : 2}
                  style={{ color: isActive ? TEXT.primary : TEXT.tertiary }}
                />
                {/*
                  The active marker is a dot, not a border or a fill.

                  The bar's whole job is "where am I", and a dot under the icon is the
                  one marker that fits under a 24px glyph at 4px without reading as an
                  underline, a badge or a notification. It slides rather than appearing,
                  so the bar has a continuous sense of position instead of four
                  independent blinks.
                */}
                <span
                  aria-hidden="true"
                  data-testid="bottom-nav-active-dot"
                  style={{
                    width: ACTIVE_DOT_SIZE,
                    height: ACTIVE_DOT_SIZE,
                    borderRadius: RADIUS.round,
                    backgroundColor: ACCENT.base,
                    /*
                     * Kept in the layout at scale 0 rather than removed. Collapsing it
                     * instead would make the bar resize on every navigation, which on a
                     * fixed bottom element is a visible jump of the whole page.
                     */
                    transform: isActive ? "scale(1)" : "scale(0)",
                    transition: reducedMotion
                      ? "none"
                      : `transform ${MOTION.normal} ${MOTION.easeOut}`,
                  }}
                />
                <span
                  style={{
                    fontSize: TYPE.caption.size,
                    lineHeight: TYPE.caption.lineHeight,
                    fontWeight: TYPE.subhead.weight,
                    letterSpacing: TYPE.caption.tracking,
                    color: isActive ? TEXT.primary : TEXT.tertiary,
                    // Kept at zero height when inactive so the bar does not resize as
                    // the user moves between items.
                    height: isActive ? TYPE.caption.lineHeight : 0,
                    opacity: isActive ? 1 : 0,
                    overflow: "hidden",
                  }}
                >
                  {destination.label}
                </span>
              </>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}

/**
 * The raised centre action.
 *
 * Split out because it is the one item that is not "an icon in a row": it is a circle
 * that overlaps the bar, has its own press physics, and is the only element in the
 * chrome that may be larger than the bar's own height.
 *
 * The press is a scale rather than a colour change. On a filled circle the fill cannot
 * darken much before the glyph loses contrast, and a scale reads as "pushed" from
 * across a gym floor.
 */
function CentreAction({
  destination,
  reducedMotion,
}: {
  destination: NavDestination;
  reducedMotion: boolean;
}) {
  const Icon = destination.icon;

  return (
    <span
      aria-hidden="true"
      data-testid="bottom-nav-centre-action"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: CENTRE_ACTION_SIZE,
        height: CENTRE_ACTION_SIZE,
        marginTop: -CENTRE_ACTION_LIFT,
        borderRadius: RADIUS.round,
        backgroundColor: ACCENT.base,
        color: TEXT.onAccent,
        boxShadow: ACCENT.ring,
        transition: reducedMotion
          ? "none"
          : `transform ${MOTION.instant} ${MOTION.standard}`,
      }}
      className="cronos-nav-centre"
    >
      <Icon size={24} strokeWidth={2.5} />
    </span>
  );
}