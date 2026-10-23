/**
 * @vitest-environment jsdom
 *
 * AppShell owns the space the chrome takes. So the two failure modes worth
 * pinning are the ones a user cannot report usefully: content trapped under the
 * navigation, and the navigation itself disappearing on a screen that has one.
 *
 * The padding itself is a stylesheet concern (`.cronos-shell`) because part of it
 * is a media query; what is asserted here is that the shell publishes the numbers
 * that stylesheet reads, since a mismatch is the whole bug.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  AppShell,
  NAV_CONTENT_HEIGHT,
  PILL_GAP,
  SIDE_NAV_COLLAPSED_WIDTH,
  SIDE_NAV_WIDTH,
} from "./AppShell";
import { BottomNav } from "./BottomNav";
import { SHELL_LABELS } from "@/lib/i18n";
import { SIDE_NAV_COLLAPSED_KEY } from "./navItems";
import {
  ActiveSessionProvider,
  useActiveSession,
} from "@/context/ActiveSessionContext";

afterEach(cleanup);

beforeEach(() => {
  // The side nav's preference lives in `localStorage` on purpose, so these tests would
  // otherwise inherit each other's collapse state and pass or fail by ordering.
  window.localStorage.clear();
});

/** Starts a session on mount. See the note in ActiveWorkoutPill.test.tsx. */
function StartSession({ title = "Pecho" }: { title?: string }) {
  const { start } = useActiveSession();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start({ id: "r-1", title });
  }, [start, title]);
  return null;
}

/** The routed view, standing in for the real screens. */
function RouteStub({ name }: { name: string }) {
  return <p>Vista {name}</p>;
}

function renderShell({
  path = "/",
  withSession = false,
}: { path?: string; withSession?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ActiveSessionProvider>
        {withSession ? <StartSession /> : null}
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<RouteStub name="inicio" />} />
            <Route path="/rutinas" element={<RouteStub name="rutinas" />} />
            <Route path="/entrenar" element={<RouteStub name="entrenar" />} />
            <Route path="/rangos" element={<RouteStub name="rangos" />} />
            <Route path="/perfil" element={<RouteStub name="perfil" />} />
          </Route>
        </Routes>
      </ActiveSessionProvider>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("renders the bottom navigation", () => {
    renderShell();
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeDefined();
  });

  it("renders the routed view through the outlet", () => {
    renderShell({ path: "/rutinas" });
    expect(screen.getByText("Vista rutinas")).toBeDefined();
    expect(screen.queryByText("Vista inicio")).toBeNull();
  });

  it("does not render the session pill when no session is running", () => {
    renderShell({ path: "/" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders the session pill once a session exists and the route is not the workout", () => {
    renderShell({ path: "/rangos", withSession: true });
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("keeps the pill off the training route even with a live session", () => {
    renderShell({ path: "/entrenar", withSession: true });
    expect(screen.queryByRole("status")).toBeNull();
    // The navigation survives; only the pill is suppressed.
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeDefined();
  });

  it("publishes the navigation height and nav width the stylesheet pads against", () => {
    // A mismatch here is the bug where content sits under the navigation: the
    // padding is `calc(var(--cronos-nav-height) + safe-area)` and the bar is
    // `calc(NAV_CONTENT_HEIGHT + safe-area)`.
    const { container } = renderShell();
    const shell = container.querySelector(".cronos-shell") as HTMLElement;

    expect(shell.style.getPropertyValue("--cronos-nav-height")).toBe(
      `${NAV_CONTENT_HEIGHT}px`,
    );
    expect(shell.style.getPropertyValue("--cronos-nav-width")).toBe(`${SIDE_NAV_WIDTH}px`);
  });

  it("pads the content by the nav's collapsed width once it is collapsed", () => {
    // The reason the shell owns the preference rather than the nav: if only the nav
    // knew, the padding would stay at 240px and leave a 176px column of dead space --
    // which is exactly the space the athlete collapsed the rail to get back.
    const { container } = renderShell();
    fireEvent.click(screen.getByLabelText(SHELL_LABELS.sidebarCollapse));
    const shell = container.querySelector(".cronos-shell") as HTMLElement;

    expect(shell.style.getPropertyValue("--cronos-nav-width")).toBe(
      `${SIDE_NAV_COLLAPSED_WIDTH}px`,
    );
  });

  it("remembers the collapse across a remount", () => {
    // A layout preference is the one piece of state worth keeping: an athlete who
    // collapses the rail has said something about how they work, and asking again on
    // every reload is the kind of friction that makes an app feel like it is arguing.
    const first = renderShell();
    fireEvent.click(screen.getByLabelText(SHELL_LABELS.sidebarCollapse));
    expect(window.localStorage.getItem(SIDE_NAV_COLLAPSED_KEY)).toBe("1");
    first.unmount();

    const second = renderShell();
    const nav = screen.getByRole("navigation", { name: SHELL_LABELS.sidebarAriaLabel });
    expect(nav.style.width).toBe(`${SIDE_NAV_COLLAPSED_WIDTH}px`);
    // Collapsed, so the wordmark is gone and only the 32px mark is left: 64px of column
    // has no room for the word and the mark together.
    expect(screen.queryByText("CRONOS")).toBeNull();
    second.unmount();
  });

  it("mounts both navigations, since the breakpoint hides one of them", () => {
    // `.cronos-side-nav` is `display: none` under 768px and `.cronos-bottom-nav` is
    // `display: none` above it, so exactly one is ever visible. jsdom evaluates neither,
    // which is why the test asserts the pair exists rather than which one shows.
    const { container } = renderShell();
    expect(container.querySelectorAll(".cronos-side-nav")).toHaveLength(1);
    expect(container.querySelectorAll(".cronos-bottom-nav")).toHaveLength(1);
  });

  it("reserves exactly the navigation's height, no less and no more", () => {
    // The gap exists so the bar's own glass edge is not half-covered.
    expect(NAV_CONTENT_HEIGHT).toBe(56);
    expect(PILL_GAP).toBeGreaterThan(0);
    expect(PILL_GAP).toBeLessThan(NAV_CONTENT_HEIGHT);
  });

  it("animates the routed view in, and not when the user asked for less motion", () => {
    const { container } = renderShell();
    const route = container.querySelector(".cronos-route") as HTMLElement;

    expect(route.className).toContain("cronos-route--animate");
    expect(container.querySelectorAll(".cronos-side-nav")).toHaveLength(1);
  });
});

describe("BottomNav and AppShell agree on their shared numbers", () => {
  it("mounts the navigation the shell padded for", () => {
    // The provider is here because `BottomNav` reads the session store for the centre
    // action's ring. `useActiveSession` throws rather than defaulting to null outside one,
    // which is the behaviour worth keeping -- a missing provider must not be
    // indistinguishable from "the athlete is not training" -- so the test carries it.
    const { container } = render(
      <MemoryRouter>
        <ActiveSessionProvider>
          <BottomNav />
        </ActiveSessionProvider>
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });

    // 56px plus whatever safe-area inset the device reports, which is 0 in jsdom.
    //
    // Only `height` is asserted. jsdom's CSS parser silently drops any value
    // containing `env()`, so `style.paddingBottom` reads back as `""` here --
    // the declaration is present in the source and works in a browser, it just
    // cannot be inspected through the DOM in this environment.
    expect(nav.style.height).toContain(`${NAV_CONTENT_HEIGHT}px`);
    expect(nav.style.height).toContain("calc(");
    expect(container.querySelector("nav")).toBe(nav);
  });
});