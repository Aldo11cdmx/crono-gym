/**
 * navItems.ts — the destinations in the bottom navigation.
 *
 * Data, not components, so the list can be asserted on without rendering
 * anything. Keeping it here also means the nav, the dev catalog and any future
 * deep link all read the same five entries instead of repeating five paths.
 *
 * `path` values are the single source of truth for routing; `router.tsx` declares
 * the same paths, and a mismatch shows up as a `<NavLink>` that navigates to a
 * route the table does not have.
 */

import { Award, Dumbbell, Home, Library, User, type LucideIcon } from "lucide-react";
import { SHELL_LABELS } from "@/lib/i18n";

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
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    path: "/",
    label: SHELL_LABELS.destinations.home.label,
    ariaLabel: SHELL_LABELS.destinations.home.aria,
    icon: Home,
  },
  {
    path: "/biblioteca",
    label: SHELL_LABELS.destinations.library.label,
    ariaLabel: SHELL_LABELS.destinations.library.aria,
    icon: Library,
  },
  {
    path: "/entrenar",
    label: SHELL_LABELS.destinations.train.label,
    ariaLabel: SHELL_LABELS.destinations.train.aria,
    icon: Dumbbell,
    primary: true,
  },
  {
    path: "/rangos",
    label: SHELL_LABELS.destinations.ranks.label,
    ariaLabel: SHELL_LABELS.destinations.ranks.aria,
    icon: Award,
  },
  {
    path: "/perfil",
    label: SHELL_LABELS.destinations.profile.label,
    ariaLabel: SHELL_LABELS.destinations.profile.aria,
    icon: User,
  },
];

/** The route the active-session pill sends the user to. */
export const TRAIN_PATH = "/entrenar";

/**
 * The ranks route, as a constant.
 *
 * Exported for the same reason `TRAIN_PATH` is: `/coach` links to the ranks screen,
 * and a path written out again at the call site is a path that can drift from the
 * router without anything noticing. The ranks view itself reads `MUSCLE_PARAM` off
 * this route, so a mismatch would not even 404 -- it would apply a muscle filter to
 * nothing.
 */
export const RANGES_PATH = "/rangos";

/**
 * Width of the desktop side rail, in px.
 *
 * Lives here rather than in `AppShell` because the shell pads the content by
 * this number and `SideRail` occupies it, and a rail that imports the width from
 * the component that renders it closes an import cycle for no gain.
 */
export const SIDE_RAIL_WIDTH = 232;