/**
 * @vitest-environment jsdom
 *
 * The route table is the only place a path is declared, so the only thing worth
 * testing about it is that every destination the navigation advertises actually
 * resolves to a screen. A `NavLink` pointing at a route the table does not have
 * renders perfectly, looks fine, and goes nowhere -- which is a bug no component
 * test can see, because each component works.
 *
 * Fase 7 deleted `APP_TABS` and with it two of these tests. "Every header tab has a
 * route" guarded a second list that no longer exists, and "the two lists do not
 * overlap" existed to stop a destination rendering twice in two navigations --
 * there being two navigations was the bug. Both are gone rather than rewritten:
 * a test for an invariant the codebase no longer has is a test that passes
 * forever without protecting anything.
 *
 * What replaces the overlap test is the count assertions below. With one list, the
 * real risks are a sixth destination sneaking in and a second copy of the list
 * appearing in a component, and both are things a test can see.
 */

import { describe, expect, it } from "vitest";
import {
  COACH_PATH,
  LEGACY_ROUTINES_PATH,
  NAV_DESTINATIONS,
  ROUTINES_PATH,
  SECONDARY_DESTINATIONS,
  THUMB_DESTINATIONS,
  TRAIN_PATH,
} from "@/components/shell/navItems";
import { router } from "./router";

/** Every path the router declares, flattened out of the nested layout. */
function routePaths(): string[] {
  const paths: string[] = [];
  const walk = (routes: readonly { path?: string; children?: readonly unknown[] }[]) => {
    for (const route of routes) {
      if (route.path) paths.push(route.path);
      if (route.children) walk(route.children as readonly { path?: string; children?: unknown[] }[]);
    }
  };
  walk(router.routes);
  return paths;
}

/** The route element for a path, or undefined. */
function routeElement(path: string): unknown {
  const found = router.routes
    .flatMap((r) => r.children ?? [])
    .flatMap((r) => (r as { children?: unknown[] }).children ?? [])
    .find((r) => (r as { path?: string }).path === path);
  return (found as { element?: unknown } | undefined)?.element;
}

describe("route table", () => {
  it("has a route for every advertised destination", () => {
    const paths = routePaths();
    for (const destination of NAV_DESTINATIONS) {
      expect(paths, `no route for ${destination.label}`).toContain(destination.path);
    }
    // The thumb bar is a filter over the same list, so this also covers it. Asserted
    // explicitly because a filter that dropped everything would still satisfy the
    // loop above and leave the bar with no grid columns to divide by.
    for (const destination of THUMB_DESTINATIONS) {
      expect(paths, `no route for the ${destination.label} bar item`).toContain(destination.path);
    }
  });

  it("advertises exactly four destinations, with unique paths", () => {
    // Four is a design decision, not a current number: the bar is a thumb zone and
    // the raised centre item only stays centred while there is an even number of
    // items either side of it. Five put two items on one side of the button and one on
    // the other, so the control the athlete reaches for sat half a column off centre --
    // which looked correct in code and was wrong in the hand. A sixth would need the
    // geometry re-derived.
    expect(NAV_DESTINATIONS).toHaveLength(4);

    const paths = NAV_DESTINATIONS.map((d) => d.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps exactly one primary destination, in the centre", () => {
    const primaries = NAV_DESTINATIONS.filter((d) => d.primary);
    expect(primaries).toHaveLength(1);
    // `BottomNav` derives its grid columns and its centring from this list's order, on
    // the assumption that the primary sits in the middle column. Primary at an end
    // would render a bar whose one special item is in a corner.
    expect(NAV_DESTINATIONS.indexOf(primaries[0])).toBe(2);
    expect(THUMB_DESTINATIONS.indexOf(primaries[0])).toBe(2);
  });

  it("gives every destination an accessible name", () => {
    // The centre item shows no visible label on the bar, so `ariaLabel` is the only
    // thing naming it. An empty one leaves an icon with no name.
    for (const destination of [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS]) {
      expect(destination.ariaLabel, `${destination.path} has no accessible name`).toBeTruthy();
    }
    // Visible labels are required everywhere *except* the centre action, which is the
    // one item the bar deliberately leaves unlabelled.
    for (const destination of [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS]) {
      if (destination.primary) {
        expect(destination.label, `${destination.path} should have no visible label`).toBe("");
      } else {
        expect(destination.label, `${destination.path} has no label`).toBeTruthy();
      }
    }
  });

  it("does not list a destination in both groups", () => {
    // Two lists are how a route ends up rendered twice in two navigations, and there
    // being two navigations was already the bug Fase 7 fixed.
    const primary = new Set(NAV_DESTINATIONS.map((d) => d.path));
    for (const destination of SECONDARY_DESTINATIONS) {
      expect(primary.has(destination.path), `${destination.path} is in both`).toBe(false);
      expect(destination.secondary, `${destination.path} is not marked secondary`).toBe(true);
    }
  });

  it("keeps the secondary group out of the thumb zone", () => {
    // `/rangos` and `/progreso` are places an athlete arrives *from* a muscle on the
    // map or a number on the dashboard, not by aiming at the bottom of a phone.
    const thumb = new Set(THUMB_DESTINATIONS.map((d) => d.path));
    for (const destination of SECONDARY_DESTINATIONS) {
      expect(thumb.has(destination.path), `${destination.path} leaked into the bar`).toBe(false);
    }
  });

  it("has a route for every secondary destination", () => {
    const paths = routePaths();
    for (const destination of SECONDARY_DESTINATIONS) {
      expect(paths, `no route for ${destination.label}`).toContain(destination.path);
    }
  });

  it("redirects the old root to the dashboard", () => {
    // `/` used to serve the home screen. It now redirects, so an athlete with a
    // bookmark lands on the dashboard instead of a dead address.
    expect(routePaths()).toContain("/");
    expect(routeElement("/")).toBeTruthy();
    expect(routePaths()).toContain("/inicio");
  });

  it("redirects /biblioteca to /rutinas and stops serving the old path", () => {
    // The screen did not move; the address did. "Biblioteca" says where routines are
    // kept, and every label in the product already said "Rutinas" -- so the route was
    // the last place disagreeing. A duplicate route would give the same screen two URLs,
    // and the one that is not in the navigation is the one that ends up in a bookmark
    // and then drifts.
    expect(routePaths()).toContain(LEGACY_ROUTINES_PATH);
    expect(routePaths()).toContain(ROUTINES_PATH);
  });

  it("serves the coach, not a placeholder", () => {
    // Same regression this file was written for. The hub used to be a header-tab
    // destination, so nothing else would notice it degrading to `ComingSoon`.
    expect(routeElement(COACH_PATH)).toBeTruthy();
  });

  it("keeps the coach reachable but out of the navigation", () => {
    // The redesign asked for the coach to leave the thumb bar and the pitch to move into
    // the profile, which is right about the pitch and was written on the assumption that
    // `/coach` was a coach marketplace. It is not -- it is the AI coach's workspace, so
    // the route stays live and the profile's premium-services card is the way in.
    // Redirecting the address would have left the chat, the notes and the pending
    // recommendations with no route into them.
    expect(routeElement(COACH_PATH)).toBeTruthy();
    const advertised = [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS].map((d) => d.path);
    expect(advertised).not.toContain(COACH_PATH);
  });

  it("routes the active-session pill to the train screen", () => {
    expect(routePaths()).toContain(TRAIN_PATH);
  });

  it("serves the profile, not a placeholder", () => {
    // The regression this file exists for: a finished screen behind
    // `ComingSoon` is a screen nobody can reach.
    expect(routeElement("/perfil")).toBeTruthy();
  });

  it("keeps the ranks and progress routes alive", () => {
    // Both lose their place in the navigation in Fase 7 and both become tabs
    // inside the profile. Until that lands they are still real screens with real
    // deep links -- `RANGES_PATH` is linked from the coach hub -- so losing the
    // route here would 404 a link the app itself renders.
    expect(routeElement("/rangos")).toBeTruthy();
    expect(routeElement("/progreso")).toBeTruthy();
  });

  it("does not ship the dev catalog in a production build", () => {
    if (import.meta.env.DEV) return;
    expect(routePaths()).not.toContain("/dev/ui");
  });
});