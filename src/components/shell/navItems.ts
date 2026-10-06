/**
 * navItems.ts — the destinations in the navigation.
 *
 * Data, not components, so the list can be asserted on without rendering anything.
 * Keeping it here also means the bar, the rail and any future deep link all read the
 * same entries instead of repeating the same paths.
 *
 * `path` values are the single source of truth for routing; `router.tsx` declares the
 * same paths, and a mismatch shows up as a `<NavLink>` that navigates to a route the
 * table does not have.
 *
 * Four destinations, and the bar is the reason
 * ------------------------------------------------
 * This used to be five, with `/coach` in the thumb zone. `/coach` is now an upsell
 * inside the profile rather than a screen of its own, so it is gone from here. That
 * matters for more than tidiness: `navItems.ts` derives the bar's grid columns and its
 * sliding-indicator geometry from this list's length, and the raised centre action only
 * stays centred while the bar renders an even number of items either side of it. Five
 * destinations put two on one side and one on the other, and the "Entrenar" button was
 * off-centre by half a column.
 *
 * `/rangos` and `/progreso` are public but unlisted. They were never thumb-zone
 * destinations -- they are places an athlete arrives *from* somewhere else, through a
 * muscle on the map or a number on the dashboard. The desktop rail lists them in a
 * secondary group, because with a pointer there is room and no reason to hide them.
 */

import { Award, Dumbbell, Home, Layers, User, Zap, type LucideIcon } from "lucide-react";
import { SHELL_LABELS } from "@/lib/i18n";

/**
 * The paths, declared before the list that reads them.
 *
 * A `const` referenced by a module-level array above it is a temporal dead zone
 * error at import time, not an `undefined` that shows up later -- so the order of
 * this file is load-bearing, which is the least pleasant kind of load-bearing.
 * These are `const` for exactly that reason: a literal path in a component is how
 * `/coach` and `/` drifted apart in the first place.
 */

/**
 * The route the active-session pill sends the user to.
 */
export const TRAIN_PATH = "/entrenar";

/**
 * The dashboard's own address.
 *
 * `/inicio` and not `/`. The route should say what it is, and this one is a
 * dashboard rather than the app's root -- which `/` claims to be while being only
 * one of seven screens. `/` survives as a redirect so old links and bookmarks land
 * on the dashboard instead of a 404.
 *
 * The redesign's route table writes this one as `/`. It is left as `/inicio` because
 * the redirect already makes `/` work, and moving the canonical path would invalidate
 * bookmarks for no gain in behaviour.
 *
 * Not a prefix match anywhere: `NavLink` is given `end` so the item does not read
 * as active under some future `/inicio/whatever`.
 */
export const HOME_PATH = "/inicio";

/**
 * `/rutinas` and not `/biblioteca`.
 *
 * Same screen, and the old name is now a redirect rather than a route. "Biblioteca"
 * describes where routines are *kept*; the athlete goes there to run one, and every
 * label in the product already said "Rutinas".
 */
export const ROUTINES_PATH = "/rutinas";

/** The address `/biblioteca` used to be. Kept so the redirect can name it. */
export const LEGACY_ROUTINES_PATH = "/biblioteca";

export const PROFILE_PATH = "/perfil";

/**
 * The coach workspace's own address.
 *
 * A route, but not a destination: `COACH_PATH` is deliberately absent from
 * `NAV_DESTINATIONS` and `SECONDARY_DESTINATIONS`, which is what keeps it out of both
 * the thumb bar and the desktop rail.
 *
 * The redesign asked for this screen to leave the navigation and for the premium pitch
 * to move into the profile, which is right about the pitch and was written on the
 * assumption that `/coach` was a coach marketplace. It is not: it is the AI coach's
 * actual workspace -- the context briefing, the chat, the notes and the pending
 * recommendations. Redirecting the address would have left all of that with no route
 * into it, so the route stays and the *pitch* moves to the profile, which is where a
 * person deciding whether to pay actually looks.
 *
 * Being unlisted is also why the coach's own vault at `/coach/portal` is safe: a coach's
 * inbox one thumb-tap from every free user's home screen was never acceptable, and
 * `COACH_PATH` being out of the navigation is what keeps that from being an accident
 * someone later fixes by adding it back.
 */
export const COACH_PATH = "/coach";

/**
 * The ranks route, as a constant.
 *
 * Exported because `/perfil` links to the ranks screen, and a path written out again
 * at the call site is a path that can drift from the router without anything noticing.
 * The ranks view itself reads `MUSCLE_PARAM` off this route, so a mismatch would not
 * even 404 -- it would apply a muscle filter to nothing.
 */
export const RANGES_PATH = "/rangos";

export const PROGRESS_PATH = "/progreso";

/**
 * The exercise hub's prefix.
 *
 * A prefix and not a function returning a path, because `router.tsx` declares the same
 * string as a pattern and the two have to stay in step. A helper here would compute the
 * route and the router would compute it differently, which is exactly the drift this file
 * was written to stop -- only for a screen that did not exist when it was written.
 */
export const EXERCISE_PATH = "/ejercicio";

/**
 * `/ejercicio/:exerciseId`, the hub for one movement.
 *
 * Not a navigation destination. It is somewhere an athlete arrives *from* the carousel
 * strip or an exercise chip, never by aiming at the bottom of a phone, and it is absent
 * from both `NAV_DESTINATIONS` and `SECONDARY_DESTINATIONS` for that reason. Adding it to
 * `navItems` would also break the grid arithmetic `BottomNav` derives from the count.
 */
export function exercisePath(exerciseId: string): string {
  // `encodeURIComponent`, not a template literal: catalog ids are free text in the schema,
  // and one containing a slash would otherwise produce a path that matches no route while
  // looking like it does.
  return `${EXERCISE_PATH}/${encodeURIComponent(exerciseId)}`;
}

export interface NavDestination {
  /** Router path. */
  path: string;
  /** Visible label. Only the active item shows it on the bar. */
  label: string;
  /** Accessible name. Required for the centre item, which has no visible label. */
  ariaLabel: string;
  icon: LucideIcon;
  /**
   * The raised centre action.
   *
   * Exactly one item, and it is the one the user came to do: training. It sits
   * above the bar with an accent fill, so the primary action is reachable with a
   * thumb without the user having to aim at a row of four equal targets.
   *
   * `label` is allowed to be `""` here. The centre item shows no text by design --
   * there is room for exactly four targets across a phone, and a label under the
   * raised button would make it the only item with two lines and read as broken.
   * Its `ariaLabel` is what names it.
   */
  primary?: boolean;
  /**
   * Listed in the desktop rail's secondary group, never in the thumb bar.
   *
   * `SECONDARY_DESTINATIONS` filters on this rather than the thumb bar re-listing its
   * own subset: a hand-written bar list is exactly the duplicate this file stopped
   * having.
   */
  secondary?: boolean;
}

/**
 * The four thumb-zone destinations, in bar order.
 *
 * Order is load-bearing. The centre item has to be third, which means an even number of
 * items either side of it, and `BottomNav` asserts both.
 */
export const NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    path: HOME_PATH,
    label: SHELL_LABELS.destinations.home.label,
    ariaLabel: SHELL_LABELS.destinations.home.aria,
    icon: Home,
  },
  {
    path: ROUTINES_PATH,
    label: SHELL_LABELS.destinations.library.label,
    ariaLabel: SHELL_LABELS.destinations.library.aria,
    icon: Layers,
  },
  {
    path: TRAIN_PATH,
    // No visible label. The glyph is a lightning bolt rather than a dumbbell: the
    // dumbbell is what the old `Dumbbell` icon drew, and at 24px inside a red circle
    // it read as a badge. `Zap` reads as the action itself at that size.
    label: "",
    ariaLabel: SHELL_LABELS.destinations.train.aria,
    icon: Zap,
    primary: true,
  },
  {
    path: PROFILE_PATH,
    label: SHELL_LABELS.destinations.profile.label,
    ariaLabel: SHELL_LABELS.destinations.profile.aria,
    icon: User,
  },
];

/** Everything the bar renders, which is currently everything. */
export const THUMB_DESTINATIONS: readonly NavDestination[] = NAV_DESTINATIONS;

/**
 * The rail's secondary group: real destinations that are not thumb-zone.
 *
 * They get no accent fill even when active. One highlight per screen is the rule, and
 * an athlete who lands on `/progreso` from a dashboard tile should see the rail
 * confirm where they are without also being handed a second "this is the action" cue
 * next to the training button.
 */
export const SECONDARY_DESTINATIONS: readonly NavDestination[] = [
  {
    path: RANGES_PATH,
    label: SHELL_LABELS.destinations.ranks.label,
    ariaLabel: SHELL_LABELS.destinations.ranks.aria,
    icon: Award,
    secondary: true,
  },
  {
    path: PROGRESS_PATH,
    label: SHELL_LABELS.destinations.progress.label,
    ariaLabel: SHELL_LABELS.destinations.progress.aria,
    icon: Dumbbell,
    secondary: true,
  },
];

/**
 * Width of the desktop side nav when expanded, in px.
 *
 * Lives here rather than in `AppShell` because the shell pads the content by this
 * number and `SideNav` occupies it, and a nav that imports the width from the
 * component that renders it closes an import cycle for no gain.
 */
export const SIDE_NAV_WIDTH = 240;

/**
 * Width of the desktop side nav collapsed, in px.
 *
 * Icon-only. 64 rather than a rounder number because 48px of icon plus two 8px
 * gutters is the smallest width that keeps a 44px touch target without the icon
 * crowding the edge.
 */
export const SIDE_NAV_COLLAPSED_WIDTH = 64;

/**
 * The collapse preference's key in `localStorage`.
 *
 * Exported so the dev catalog and the test can name it. A layout preference is the one
 * piece of state here that is worth keeping across sessions: an athlete who collapses
 * the rail has said something about how they work, and asking again every reload is
 * the kind of small friction that makes an app feel like it is arguing.
 */
export const SIDE_NAV_COLLAPSED_KEY = "cronos:sideNavCollapsed";