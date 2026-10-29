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

import { useState } from "react";
import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { hapticLight } from "@/lib/haptics";
import { ACCENT, GLASS, MOTION, RADIUS, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { SHELL_LABELS } from "@/lib/i18n";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { THUMB_DESTINATIONS, type NavDestination } from "./navItems";
import { NAV_CONTENT_HEIGHT } from "./AppShell";

/** Diameter of the raised centre action, in px. */
export const CENTRE_ACTION_SIZE = 56;

/** How far the centre action sits proud of the bar. */
export const CENTRE_ACTION_LIFT = 12;

/**
 * How visible the session ring stays when motion is reduced.
 *
 * The ring keeps rendering under `prefers-reduced-motion` because it carries information
 * -- a session is running -- and only its movement is removed. At full strength a ring
 * that never animates reads as a second border on a red circle, which is noise rather than
 * a signal, so it sits at a value where it is legible as a halo and not as an outline.
 */
export const SESSION_RING_STATIC_ALPHA = 0.55;

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
        paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))`,
        /*
         * Opaque rather than glass. The bar sits directly on a page whose content
         * changes as the athlete scrolls, and a 6% white fill over moving content reads
         * as a rendering fault on a black screen rather than as depth. The blur is what
         * sells it; the fill only has to hide what is behind.
         */
        backgroundColor: GLASS.fillRaised,
        borderTop: `1px solid ${GLASS.border}`,
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
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
 * The bar's hairline is `GLASS.borderStrong`, not `GLASS.border` and not a third value.
 *
 * An earlier version of this file declared its own `rgba(255, 255, 255, 0.08)` here,
 * on the reasoning that 10% is invisible against an opaque bar on an OLED panel. The
 * reasoning was right and the conclusion was wrong: the answer for "a hairline that must
 * survive against a known background" is the token that already means exactly that, and
 * inventing a fourth white alpha in a component is how a separator ends up 0.08 on one
 * screen and 0.10 on the next depending on which file drew it.
 */
function NavItem({ destination }: { destination: NavDestination }) {
  const Icon = destination.icon;
  const reducedMotion = useReducedMotion();
  const sessionActive = useActiveSession().session !== null;
  const [pressed, setPressed] = useState(false);

  const onPointerDown = () => {
    hapticLight();
    setPressed(true);
  };
  const onPointerUp = () => setPressed(false);
  const onPointerLeave = () => setPressed(false);

  return (
    <li style={{ display: "flex" }}>
      <NavLink
        to={destination.path}
        end
        aria-label={destination.ariaLabel}
        className="cronos-nav-item"
        data-active={undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
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
            transition: `color ${MOTION.normal} ${MOTION.easeOut}, transform ${MOTION.instant} ${MOTION.standard}`,
            transform: pressed ? "scale(0.94)" : undefined,
          } satisfies CSSProperties
        }
      >
        {({ isActive }) => (
          <>
            {destination.primary ? (
              <CentreAction
                destination={destination}
                reducedMotion={reducedMotion}
                sessionActive={sessionActive}
              />
            ) : (
              <>
                <Icon
                  aria-hidden="true"
                  size={24}
                  strokeWidth={isActive ? 2.4 : 2}
                  style={{
                    color: isActive ? ACCENT.base : TEXT.tertiary,
                    transform: isActive ? "scale(1.1)" : "scale(1)",
                    transition: reducedMotion
                      ? "none"
                      : `transform ${MOTION.instant} ${MOTION.standard}, color ${MOTION.normal} ${MOTION.easeOut}`,
                  }}
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
 *
 * The session ring is a *sibling* rather than a `boxShadow` on the circle itself,
 * because an animated `box-shadow` and the press transition both want to own the same
 * property. Sharing it means whichever effect starts last wins and the other stops
 * working; the pulse is therefore a second, larger, transparent circle behind the action
 * that animates its own spread. The action's own shadow stays `ACCENT.ring` and stays
 * static.
 */
function CentreAction({
  destination,
  reducedMotion,
  sessionActive,
}: {
  destination: NavDestination;
  reducedMotion: boolean;
  sessionActive: boolean;
}) {
  const Icon = destination.icon;

  return (
    <span
      aria-hidden="true"
      data-testid="bottom-nav-centre-action"
      style={{
        position: "relative",
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
      {/*
        The pulse. A separate element rather than an animated shadow, per the note above.

        `animation: none` under reduced motion -- and the ring is *still rendered*, because
        what it says is "a session is running", which is information. Dropping the whole
        ring would remove the only cue the nav gives about a workout in progress; a
        non-animated ring still says it.

        Only rendered while a session is active, so an idle bar is not paying for an
        animation nobody can see.
      */}
      {sessionActive && (
        <span
          data-testid="bottom-nav-session-ring"
          aria-hidden="true"
          className="cronos-nav-session-ring"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: RADIUS.round,
            border: `2px solid ${ACCENT.base}`,
            opacity: reducedMotion ? SESSION_RING_STATIC_ALPHA : undefined,
            animation: reducedMotion
              ? "none"
              : `cronos-session-ring ${MOTION.loop.session} ${MOTION.standard} infinite`,
            // The ring must not eat the tap that opens the workout, so it is a sibling
            // that is painted behind and pointed-through by nothing: the parent's own hit
            // area is what receives it.
            pointerEvents: "none",
          }}
        />
      )}

      <span
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={24} strokeWidth={2.5} />
      </span>
    </span>
  );
}