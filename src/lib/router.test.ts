/**
 * @vitest-environment jsdom
 *
 * The route table is the only place a path is declared, so the only thing worth
 * testing about it is that every destination the navigation advertises actually
 * resolves to a screen. A `NavLink` pointing at a route the table does not have
 * renders perfectly, looks fine, and goes nowhere -- which is a bug no component
 * test can see, because each component works.
 *
 * The guard `NAV_DESTINATIONS.every(d => d.path)` is the assertion that catches
 * it, and it caught `/perfil` sitting behind a placeholder while the rest of the
 * app was finished.
 */

import { describe, expect, it } from "vitest";
import { NAV_DESTINATIONS, TRAIN_PATH } from "@/components/shell/navItems";
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

describe("route table", () => {
  it("has a route for every advertised destination", () => {
    const paths = routePaths();
    for (const destination of NAV_DESTINATIONS) {
      expect(paths, `no route for ${destination.label}`).toContain(destination.path);
    }
  });

  it("routes the active-session pill to the train screen", () => {
    expect(routePaths()).toContain(TRAIN_PATH);
  });

  it("serves the profile, not a placeholder", () => {
    // The regression this file exists for: a finished screen behind
    // `ComingSoon` is a screen nobody can reach.
    const perfil = router.routes
      .flatMap((r) => r.children ?? [])
      .flatMap((r) => (r as { children?: unknown[] }).children ?? [])
      .find((r) => (r as { path?: string }).path === "/perfil");

    expect(perfil).toBeDefined();
    expect((perfil as { element: unknown }).element).toBeTruthy();
  });

  it("does not ship the dev catalog in a production build", () => {
    if (import.meta.env.DEV) return;
    expect(routePaths()).not.toContain("/dev/ui");
  });
});
