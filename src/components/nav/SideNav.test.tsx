/**
 * @vitest-environment jsdom
 *
 * `SideNav` exists to replace the bottom bar from 768px up, so the things worth
 * pinning are that it offers the *same* destinations (a rail with its own
 * hand-written list would drift from the router and produce dead links), that it is
 * reachable rather than decorative, and that collapsing it does not quietly drop the
 * labels it was the only place to show. Visibility across the breakpoint is stylesheet
 * behaviour, so what is asserted here is the class the stylesheet keys on, not a media
 * query jsdom cannot evaluate.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SideNav } from "./SideNav";
import {
  HOME_PATH,
  NAV_DESTINATIONS,
  PROFILE_PATH,
  RANGES_PATH,
  ROUTINES_PATH,
  SECONDARY_DESTINATIONS,
  SIDE_NAV_COLLAPSED_WIDTH,
  SIDE_NAV_WIDTH,
  TRAIN_PATH,
} from "../shell/navItems";
import { SIDE_NAV_COLLAPSED_KEY } from "../shell/navItems";
import { readStoredCollapsed } from "../shell/useSideNavCollapsed";
import { SHELL_LABELS, BRAND_LABELS } from "@/lib/i18n";
import { ACCENT, Z_INDEX } from "@/design/tokens";
import { parseColor } from "@/design/color";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderRail(
  path = HOME_PATH,
  onNavigate?: () => void,
  collapsed = false,
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SideNav onNavigate={onNavigate} collapsed={collapsed} />
    </MemoryRouter>,
  );
}

/** The nav item for a path, looked up rather than hardcoded, so a relabel cannot silently skip it. */
function itemFor(path: string): HTMLElement {
  const destination = [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS].find(
    (d) => d.path === path,
  );
  if (!destination) throw new Error(`no destination declares ${path}`);
  return screen.getByLabelText(destination.ariaLabel);
}

function rail(): HTMLElement {
  return screen.getByRole("navigation", { name: SHELL_LABELS.sidebarAriaLabel });
}

describe("SideNav destinations", () => {
  it("is a navigation landmark under its own name", () => {
    renderRail();
    expect(rail()).toBeTruthy();
  });

  it("reads the same destination list as the bottom bar", () => {
    renderRail();
    const labels = [...rail().querySelectorAll("a")].map((a) => a.textContent?.trim());
    // The first list, in order, then the secondary group. A rail that re-listed its
    // own destinations would be free to drift from the router and the mobile bar, and
    // the failure would be a dead link nobody sees until they tap it.
    expect(labels).toEqual([
      ...NAV_DESTINATIONS.map((d) => d.label),
      ...SECONDARY_DESTINATIONS.map((d) => d.label),
    ]);
  });

  it("links to every declared path", () => {
    renderRail();
    const hrefs = [...rail().querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      ...NAV_DESTINATIONS.map((d) => d.path),
      ...SECONDARY_DESTINATIONS.map((d) => d.path),
    ]);
  });

  it("names every item for assistive technology", () => {
    renderRail();
    for (const destination of [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS]) {
      expect(screen.getByLabelText(destination.ariaLabel), destination.path).toBeTruthy();
    }
  });

  it("shows a visible label on every item, unlike the bottom bar", () => {
    // There is room in a 240px vertical rail, and the mobile bar's icon-plus-underscore
    // trick would only make a desktop menu harder to scan.
    //
    // The primary is skipped because its `label` is `""` by design -- the bar hides its
    // labels, the rail shows them, and the raised action has none to show either way.
    renderRail();
    for (const destination of [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS]) {
      if (destination.label === "") continue;
      expect(screen.getByText(destination.label), destination.path).toBeTruthy();
    }
  });

  it("keeps the training destination first among equals in meaning", () => {
    expect(NAV_DESTINATIONS.some((d) => d.path === TRAIN_PATH && d.primary)).toBe(true);
  });

  it("leaves /coach out of the rail entirely", () => {
    // The coach module is an upsell inside the profile now, not a screen of its own.
    // If it ever comes back it comes back as a link from `/perfil`, not as a
    // thumb-zone destination.
    renderRail();
    expect(rail().querySelector('a[href="/coach"]')).toBeNull();
  });
});

describe("SideNav active state", () => {
  it("marks the current destination as the page", () => {
    renderRail(ROUTINES_PATH);
    expect(itemFor(ROUTINES_PATH).getAttribute("aria-current")).toBe("page");
  });

  it("marks only one destination at a time", () => {
    const { container } = renderRail(ROUTINES_PATH);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("does not mark the home entry on another destination", () => {
    // Without `end`, "/" would match every path and two items would light up.
    renderRail(ROUTINES_PATH);
    expect(itemFor(HOME_PATH).getAttribute("aria-current")).toBeNull();
  });

  it("gives the active item the accent, and only the active item", () => {
    renderRail(ROUTINES_PATH);
    const active = itemFor(ROUTINES_PATH);
    expect(active.style.boxShadow).toContain(ACCENT.base);
    expect(active.style.backgroundColor).toBe(ACCENT.muted);

    const inactive = itemFor(HOME_PATH);
    expect(inactive.style.boxShadow).toBe("none");
    expect(inactive.style.backgroundColor).toBe("transparent");
  });

  it("keeps the accent fill on the primary destination", () => {
    renderRail();
    const train = itemFor(TRAIN_PATH);
    // The accent means "this is the action" on every screen; dropping it here
    // because the layout is vertical would spend the brand on decoration.
    const fill = train.querySelector("span")?.style.backgroundColor ?? "";
    // jsdom normalises a hex fill to `rgb()`, so the channels are compared --
    // and the channels are read out of the token through the design system's own
    // parser rather than written out, so this test follows a palette change
    // instead of failing on one.
    const { r, g, b } = parseColor(ACCENT.base)!;
    expect(fill).toBe(`rgb(${r}, ${g}, ${b})`);
  });

  it("never fills a secondary destination, even when it is the current page", () => {
    // An athlete who lands on /progreso from a dashboard tile gets the rail confirming
    // where they are -- without a second "this is the action" cue sitting next to the
    // training button.
    renderRail(RANGES_PATH);
    const ranks = itemFor(RANGES_PATH);
    expect(ranks.getAttribute("aria-current")).toBe("page");
    expect(ranks.style.backgroundColor).toBe("transparent");
    expect(ranks.style.boxShadow).toBe("none");
  });
});

describe("SideNav collapse", () => {
  it("fills the expanded width by default", () => {
    const { container } = renderRail();
    const nav = container.querySelector(".cronos-side-nav") as HTMLElement;
    expect(nav.style.width).toBe(`${SIDE_NAV_WIDTH}px`);
  });

  it("narrows to the icon width when collapsed", () => {
    const { container } = renderRail(HOME_PATH, undefined, true);
    const nav = container.querySelector(".cronos-side-nav") as HTMLElement;
    expect(nav.style.width).toBe(`${SIDE_NAV_COLLAPSED_WIDTH}px`);
  });

  it("keeps a 44px target in the collapsed width", () => {
    // 64px of column holding a 44px target leaves 10px each side. Anything narrower
    // and collapsing the rail would cost accessibility to buy back whitespace.
    renderRail(HOME_PATH, undefined, true);
    expect(SIDE_NAV_COLLAPSED_WIDTH).toBeGreaterThanOrEqual(44 + 20);
    expect(itemFor(HOME_PATH).style.minHeight).toBe("44px");
  });

  it("removes the labels from the layout rather than fading them", () => {
    renderRail(HOME_PATH, undefined, true);
    // Faded-out text is still in the accessibility tree, so the destination would be
    // named twice; leaving it in the layout at zero width would also leave the column
    // reserving space it does not have.
    for (const destination of NAV_DESTINATIONS) {
      if (destination.label === "") continue; // the raised action is icon-only by design
      expect(screen.queryByText(destination.label), destination.path).toBeNull();
    }
  });

  it("keeps every accessible name after collapsing", () => {
    // This is the whole risk of collapsing: an icon-only menu that forgets to keep its
    // names becomes a column of unlabelled glyphs.
    renderRail(HOME_PATH, undefined, true);
    for (const destination of [...NAV_DESTINATIONS, ...SECONDARY_DESTINATIONS]) {
      expect(screen.getByLabelText(destination.ariaLabel), destination.path).toBeTruthy();
    }
  });

  it("titles every collapsed item, for a sighted pointer user", () => {
    // `title` is not the accessible name -- `aria-label` is, above. It is only here so
    // a mouse user can read the icon.
    renderRail(HOME_PATH, undefined, true);
    expect(itemFor(PROFILE_PATH).getAttribute("title")).toBeTruthy();
  });

  it("does not title expanded items, which already show their name", () => {
    renderRail();
    expect(itemFor(PROFILE_PATH).getAttribute("title")).toBeNull();
  });

  it("says what the toggle will do, and flips with the state", () => {
    const { unmount } = renderRail();
    const expandedToggle = screen.getByLabelText(SHELL_LABELS.sidebarCollapse);
    // `aria-expanded` on the control that changes the region it describes.
    expect(expandedToggle.getAttribute("aria-expanded")).toBe("true");
    unmount();

    renderRail(HOME_PATH, undefined, true);
    const collapsedToggle = screen.getByLabelText(SHELL_LABELS.sidebarExpand);
    expect(collapsedToggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("reports a toggle without owning the state itself", () => {
    // `AppShell` owns the preference so the shell can pad the content by the width the
    // nav is actually occupying. If the nav also kept its own copy, the two would
    // disagree and the content would sit under a 64px bar with a 240px gap.
    const onToggle = vi.fn();
    render(
      <MemoryRouter initialEntries={[HOME_PATH]}>
        <SideNav onToggleCollapsed={onToggle} />
      </MemoryRouter>,
    );
    screen.getByLabelText(SHELL_LABELS.sidebarCollapse).click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("reads a remembered preference as collapsed", () => {
    window.localStorage.setItem(SIDE_NAV_COLLAPSED_KEY, "1");
    expect(readStoredCollapsed()).toBe(true);
  });

  it("treats an absent preference as expanded", () => {
    // Not "write false back": a first visit should not persist a preference nobody made.
    expect(readStoredCollapsed()).toBe(false);
    expect(window.localStorage.getItem(SIDE_NAV_COLLAPSED_KEY)).toBeNull();
  });
});

describe("SideNav responsiveness and motion", () => {
  it("carries the class the stylesheet hides below 768px", () => {
    // `.cronos-side-nav` is `display: none` under 768px, where `BottomNav` is the
    // navigation. jsdom does not evaluate media queries, so the class is the contract,
    // not a computed display value.
    const { container } = renderRail();
    expect(container.querySelector(".cronos-side-nav")).toBeTruthy();
  });

  it("carries the item class the reduced-motion rule keys on", () => {
    const { container } = renderRail();
    expect(container.querySelectorAll(".cronos-side-nav-item")).toHaveLength(
      NAV_DESTINATIONS.length + SECONDARY_DESTINATIONS.length,
    );
  });

  it("transitions on colour, which survives reduced motion", () => {
    renderRail();
    // Colour feedback is not motion. Removing it under `prefers-reduced-motion` would
    // leave the active destination with nothing but a 2px bar.
    expect(itemFor(HOME_PATH).style.transition).toContain("color");
  });

  it("transitions its own width, so collapsing is a slide rather than a jump", () => {
    const { container } = renderRail();
    const nav = container.querySelector(".cronos-side-nav") as HTMLElement;
    expect(nav.style.transition).toContain("width");
  });

  it("sits below the modal's stacking level, unlike the old rail", () => {
    const { container } = renderRail();
    const nav = container.querySelector(".cronos-side-nav") as HTMLElement;
    // The nav is chrome. It ranks with the bottom bar, under every surface the user
    // summoned on purpose -- a dialog opened from the navigation has to paint over it,
    // or the athlete taps the rail instead of the dialog.
    expect(nav.style.zIndex).toBe(String(Z_INDEX.nav));
    expect(nav.style.zIndex).not.toBe(String(Z_INDEX.modal));
  });
});

describe("SideNav brand", () => {
  it("carries the mark above the destinations", () => {
    // The rail is the left edge of a desktop app, and before this there was no brand
    // anywhere in it at all. It has to sit *above* the list: a logo under the nav items
    // reads as the last item's icon.
    renderRail();
    const mark = within(rail()).getByAltText(BRAND_LABELS.logoAlt);
    const list = rail().querySelector("ul") as HTMLElement;
    // `compareDocumentPosition` rather than a child selector, because the brand is a
    // sibling of the list, not inside it.
    expect(mark.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the wordmark, so the rail identifies the app and not just a gym", () => {
    renderRail();
    expect(within(rail()).getByText("CRONOS")).toBeTruthy();
  });

  it("drops the wordmark when collapsed, keeping the mark centred", () => {
    // 64px is room for a 32px mark and nothing else; "CRONOS" at 20px would either
    // clip or force the column back open.
    renderRail(HOME_PATH, undefined, true);
    expect(within(rail()).queryByText("CRONOS")).toBeNull();
    expect(within(rail()).getByAltText(BRAND_LABELS.logoAlt)).toBeTruthy();
  });

  it("adds no link, so the brand cannot become a sixth destination", () => {
    // A logo wrapped in a `NavLink` would be a link to `/` that the destination tests
    // above would silently start counting.
    renderRail();
    expect(rail().querySelectorAll("a")).toHaveLength(
      NAV_DESTINATIONS.length + SECONDARY_DESTINATIONS.length,
    );
  });
});

describe("SideNav navigation", () => {
  it("reports a chosen destination so a host drawer can close itself", () => {
    const onNavigate = vi.fn();
    renderRail(HOME_PATH, onNavigate);
    itemFor(PROFILE_PATH).click();
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("works without a handler", () => {
    // The rail is not always inside a drawer, and an optional callback must not become a
    // required one.
    expect(() => renderRail(HOME_PATH, undefined)).not.toThrow();
  });

  it("renders with no props at all", () => {
    expect(() =>
      render(
        <MemoryRouter initialEntries={[HOME_PATH]}>
          <SideNav />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});