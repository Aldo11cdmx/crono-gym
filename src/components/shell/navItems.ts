/**
 * navItems.ts — the destinations in the navigation.
 *
 * Data, not components, so the list can be asserted on without rendering anything.
 * Keeping it here also means the nav, the dev catalog and any future deep link all
 * read the same five entries instead of repeating five paths.
 *
 * `path` values are the single source of truth for routing; `router.tsx` declares
 * the same paths, and a mismatch shows up as a `<NavLink>` that navigates to a
 * route the table does not have.
 *
 * Fase 7 collapsed what used to be two lists. `APP_TABS` rendered a header row of
 * four routes *on top of* this bar, so `/` appeared twice under two different names
 * ("Diario de Hoy" and "Inicio"), `/biblioteca` appeared twice under two different
 * names ("Rutinas" and "Biblioteca"), and `/progreso` and `/coach` existed only in
 * the header. One bar, five items, one name each.
 */

import { Dumbbell, Home, Library, Sparkles, User, type LucideIcon } from "lucide-react";
import { SHELL_LABELS } from "@/lib/i18n";

/**
 * The paths, declared before the list that reads them.
 *
 * A `const` referenced by a module-level array above it is a temporal dead zone
 * error at import time, not a `undefined` that shows up later -- so the order of
 * this file is load-bearing, which is the least pleasant kind of load-bearing.
 * These are `const` for exactly that reason: a literal path in a component is how
 * `/coach` and `/` drifted apart in the first place.
 */

/** The route the active-session pill sends the user to. */
export const TRAIN_PATH = "/entrenar";

/**
 * The coaches route, as a constant.
 *
 * Fase 7 promoted the coach from a header tab to a thumb-zone destination, which
 * makes it a path several components now reference rather than one.
 */
export const COACHES_PATH = "/coach";

/**
 * The dashboard's own address.
 *
 * `/inicio` and not `/`. The route should say what it is, and this one is a
 * dashboard rather than the app's root -- which `/` claims to be while being only
 * one of seven screens. `/` survives as a redirect so old links and bookmarks land
 * on the dashboard instead of a 404.
 *
 * Not a prefix match anywhere: `NavLink` is given `end` so the item does not read
 * as active under some future `/inicio/whatever`.
 */
export const HOME_PATH = "/inicio";

export const ROUTINES_PATH = "/biblioteca";

export const PROFILE_PATH = "/perfil";

/**
 * The ranks route, as a constant.
 *
 * Exported for the same reason `TRAIN_PATH` is: `/coach` links to the ranks screen,
 * and a path written out again at the call site is a path that can drift from the
 * router without anything noticing. The ranks view itself reads `MUSCLE_PARAM` off
 * this route, so a mismatch would not even 404 -- it would apply a muscle filter to
 * nothing.
 *
 * Still a real route in Fase 7 even though the profile tab will own the content:
 * the redirect is what keeps this address working for `CoachHub`'s link and for any
 * bookmark, so the path has to keep meaning something.
 */
export const RANGES_PATH = "/rangos";

export const PROGRESS_PATH = "/progreso";

export interface NavDestination {
  /** Router path. */
  path: string;
  /** Visible label. Only the active item shows it. */
  label: string;
  /** Accessible name. Required for the centre item, which has no visible label. */
  ariaLabel: string;
  icon: LucideIcon;
  /**
   * The raised centre action.
   *
   * Exactly one item, and it is the one the user came to do: training. It sits
   * above the bar with an accent fill, so the primary action is reachable with a
   * thumb without the user having to aim at a row of five equal targets.
   */
  primary?: boolean;
  /**
   * Advertised in the rail but not in the thumb bar.
   *
   * Nothing sets this yet. It exists because `BottomNav` and `SideRail` currently
   * read one list, and the day ranks moves behind the profile tab the two will need
   * to differ again -- at which point the difference should be a flag here rather
   * than a second hand-written list, which is the thing this file just stopped
   * having.
   */
  desktopOnly?: boolean;
}

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
    icon: Library,
  },
  {
    path: TRAIN_PATH,
    label: SHELL_LABELS.destinations.train.label,
    ariaLabel: SHELL_LABELS.destinations.train.aria,
    icon: Dumbbell,
    primary: true,
  },
  {
    path: COACHES_PATH,
    label: SHELL_LABELS.destinations.coaches.label,
    ariaLabel: SHELL_LABELS.destinations.coaches.aria,
    icon: Sparkles,
  },
  {
    path: PROFILE_PATH,
    label: SHELL_LABELS.destinations.profile.label,
    ariaLabel: SHELL_LABELS.destinations.profile.aria,
    icon: User,
  },
];

/**
 * Destinations that are advertised in the thumb bar.
 *
 * A filter rather than a second literal list, because a hand-written bar list is
 * exactly the duplicate this file stopped having. `BottomNav` derives both its grid
 * columns and its sliding-indicator geometry from this length, so anything excluded
 * is excluded from that arithmetic too -- which is the point: the raised centre item
 * only stays centred while the bar renders an even number of items either side of
 * it.
 */
export const THUMB_DESTINATIONS: readonly NavDestination[] = NAV_DESTINATIONS.filter(
  (destination) => !destination.desktopOnly,
);

/**
 * Width of the desktop side rail, in px.
 *
 * Lives here rather than in `AppShell` because the shell pads the content by this
 * number and `SideRail` occupies it, and a rail that imports the width from the
 * component that renders it closes an import cycle for no gain.
 */
export const SIDE_RAIL_WIDTH = 232;