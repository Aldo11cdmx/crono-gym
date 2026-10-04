/**
 * @vitest-environment jsdom
 *
 * `SideRail` exists to replace the bottom bar from 768px up, so the two things
 * worth pinning are that it offers the *same* destinations (a rail with its own
 * hand-written list would drift from the router and produce dead links) and that
 * it is reachable rather than decorative. Visibility across the breakpoint is
 * stylesheet behaviour, so what is asserted here is the class the stylesheet
 * keys on, not a media query jsdom cannot evaluate.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SideRail } from "./SideRail";
import {
  COACHES_PATH,
  HOME_PATH,
  NAV_DESTINATIONS,
  PROFILE_PATH,
  ROUTINES_PATH,
  SIDE_RAIL_WIDTH,
  TRAIN_PATH,
} from "../shell/navItems";
import { SHELL_LABELS, BRAND_LABELS } from "@/lib/i18n";
import { ACCENT } from "@/design/tokens";
import { parseColor } from "@/design/color";

afterEach(cleanup);

function renderRail(path = HOME_PATH, onNavigate?: () => void) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SideRail onNavigate={onNavigate} />
    </MemoryRouter>,
  );
}

/** The rail item for a path, looked up rather than hardcoded, so a relabel cannot silently skip it. */
function itemFor(path: string): HTMLElement {
  const destination = NAV_DESTINATIONS.find((d) => d.path === path);
  if (!destination) throw new Error(`no destination declares ${path}`);
  return screen.getByLabelText(destination.ariaLabel);
}

describe("SideRail destinations", () => {
  it("is a navigation landmark under its own name", () => {
    renderRail();
    expect(screen.getByRole("navigation", { name: SHELL_LABELS.sidebarAriaLabel })).toBeTruthy();
  });

  it("reads the same destination list as the bottom bar", () => {
    renderRail();
    const rail = screen.getByRole("navigation", { name: SHELL_LABELS.sidebarAriaLabel });
    const labels = [...rail.querySelectorAll("a")].map((a) => a.textContent?.trim());
    expect(labels).toEqual(NAV_DESTINATIONS.map((d) => d.label));
  });

  it("links to every declared path", () => {
    renderRail();
    const rail = screen.getByRole("navigation", { name: SHELL_LABELS.sidebarAriaLabel });
    const hrefs = [...rail.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(NAV_DESTINATIONS.map((d) => d.path));
  });

  it("names every item for assistive technology", () => {
    renderRail();
    for (const destination of NAV_DESTINATIONS) {
      expect(
        screen.getByLabelText(destination.ariaLabel),
        destination.path,
      ).toBeTruthy();
    }
  });

  it("shows a visible label on every item, unlike the bottom bar", () => {
    // There is room in a vertical rail, and the mobile bar's icon-plus-underscore
    // trick would only make a desktop menu harder to scan.
    renderRail();
    for (const destination of NAV_DESTINATIONS) {
      expect(screen.getByText(destination.label), destination.path).toBeTruthy();
    }
  });

  it("keeps the training destination first among equals in meaning", () => {
    renderRail();
    expect(NAV_DESTINATIONS.some((d) => d.path === TRAIN_PATH && d.primary)).toBe(true);
  });
});

describe("SideRail active state", () => {
  it("marks the current destination as the page", () => {
    renderRail(COACHES_PATH);
    expect(itemFor(COACHES_PATH).getAttribute("aria-current")).toBe("page");
  });

  it("marks only one destination at a time", () => {
    const { container } = renderRail(ROUTINES_PATH);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("does not mark the home entry on another destination", () => {
    // Without `end`, "/" would match every path and two items would light up.
    renderRail(ROUTINES_PATH);
    expect(itemFor(ROUTINES_PATH).getAttribute("aria-current")).toBe("page");
    expect(itemFor(HOME_PATH).getAttribute("aria-current")).toBeNull();
  });

  it("gives the active item the accent, and only the active item", () => {
    renderRail(COACHES_PATH);
    const active = itemFor(COACHES_PATH);
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
});

describe("SideRail responsiveness and motion", () => {
  it("carries the class the stylesheet hides below 768px", () => {
    // `.cronos-side-rail` is `display: none` under 768px, where `BottomNav` is
    // the navigation. jsdom does not evaluate media queries, so the class is the
    // contract, not a computed display value.
    const { container } = renderRail();
    expect(container.querySelector(".cronos-side-rail")).toBeTruthy();
  });

  it("carries the item class the reduced-motion rule keys on", () => {
    const { container } = renderRail();
    expect(container.querySelectorAll(".cronos-rail-item")).toHaveLength(
      NAV_DESTINATIONS.length,
    );
  });

  it("fills the width the shell pads the content by", () => {
    const { container } = renderRail();
    const rail = container.querySelector(".cronos-side-rail") as HTMLElement;
    expect(rail.style.width).toBe(`${SIDE_RAIL_WIDTH}px`);
  });

  it("transitions on colour, which survives reduced motion", () => {
    renderRail();
    const item = itemFor(HOME_PATH);
    // Colour feedback is not motion. Removing it under `prefers-reduced-motion`
    // would leave the active destination with nothing but a 2px bar.
    expect(item.style.transition).toContain("color");
  });

  it("stays above the bottom bar's stacking level", () => {
    const { container } = renderRail();
    const rail = container.querySelector(".cronos-side-rail") as HTMLElement;
    // The navigation must remain reachable while an overlay is open.
    expect(rail.style.zIndex).toBe("60");
  });
});

describe("SideRail brand", () => {
  it("carries the mark above the destinations", () => {
    // The rail is the left edge of a desktop app, and before this there was no
    // brand anywhere in it at all. It has to sit *above* the list: a logo under
    // five nav items reads as the fifth item's icon.
    renderRail();
    const rail = screen.getByRole("navigation", { name: SHELL_LABELS.sidebarAriaLabel });
    const mark = within(rail).getByAltText(BRAND_LABELS.logoAlt);
    const list = rail.querySelector("ul") as HTMLElement;
    // `compareDocumentPosition` rather than a child selector, because the brand
    // is a sibling of the list, not inside it.
    expect(mark.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the wordmark, so the rail identifies the app and not just a gym", () => {
    renderRail();
    const rail = screen.getByRole("navigation", { name: SHELL_LABELS.sidebarAriaLabel });
    expect(within(rail).getByText("CRONOS")).toBeTruthy();
  });

  it("adds no link, so the brand cannot become a sixth destination", () => {
    // A logo wrapped in a `NavLink` would be a link to `/` that the destination
    // tests above would silently start counting.
    renderRail();
    const rail = screen.getByRole("navigation", { name: SHELL_LABELS.sidebarAriaLabel });
    expect(rail.querySelectorAll("a")).toHaveLength(NAV_DESTINATIONS.length);
  });
});

describe("SideRail navigation", () => {
  it("reports a chosen destination so a host drawer can close itself", () => {
    const onNavigate = vi.fn();
    renderRail(HOME_PATH, onNavigate);
    itemFor(PROFILE_PATH).click();
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("works without a handler", () => {
    // The rail is not always inside a drawer, and an optional callback must not
    // become a required one.
    expect(() => renderRail(HOME_PATH, undefined)).not.toThrow();
  });
});
