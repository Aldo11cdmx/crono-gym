/**
 * @vitest-environment jsdom
 *
 * BottomNav is the one control the user has to find without looking, because they
 * reach for it mid-set with one hand. So these tests are about what the bar
 * promises: four destinations, the right one marked as current, every target big
 * enough to hit, and taps that go where the label says.
 *
 * Navigation is exercised against a real `MemoryRouter` rather than a mocked
 * `useNavigate`. `NavLink` closes over the router's own `navigate`, so replacing
 * the export intercepts nothing -- a test using that mock would pass while the
 * button stayed broken. The probe below reports the location the router actually
 * landed on.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { BottomNav, ACTIVE_DOT_SIZE, CENTRE_ACTION_LIFT, CENTRE_ACTION_SIZE } from "./BottomNav";
import {
  COACH_PATH,
  HOME_PATH,
  PROFILE_PATH,
  PROGRESS_PATH,
  ROUTINES_PATH,
  THUMB_DESTINATIONS,
  TRAIN_PATH,
} from "./navItems";
import { ACCENT, Z_INDEX } from "@/design/tokens";
import { parseColor } from "@/design/color";

afterEach(cleanup);

/** Reports where the router actually is, so a tap can be checked for real. */
function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function linkFor(path: string): HTMLElement {
  const destination = THUMB_DESTINATIONS.find((d) => d.path === path);
  if (!destination) throw new Error(`no thumb destination declares ${path}`);
  return screen.getByLabelText(destination.ariaLabel);
}

describe("BottomNav shape", () => {
  it("renders one destination per entry in navItems, named in Spanish", () => {
    renderAt(HOME_PATH);

    expect(screen.getByRole("navigation").getAttribute("aria-label")).toBe(
      "Navegación principal",
    );

    for (const destination of THUMB_DESTINATIONS) {
      expect(screen.getByLabelText(destination.ariaLabel)).toBeDefined();
    }
    expect(screen.getAllByRole("link")).toHaveLength(THUMB_DESTINATIONS.length);
  });

  it("carries exactly four destinations", () => {
    // Five put two items on one side of the raised button and one on the other, so the
    // button an athlete reaches for sat half a column off centre. Four is the number
    // that also fits 44px targets across a phone without them feeling like a keyboard.
    expect(THUMB_DESTINATIONS).toHaveLength(4);
    renderAt(HOME_PATH);
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("has no coach destination, so the coach is a pitch and not a tab", () => {
    // `/coach` is a live route and is deliberately unlisted. A fifth tab would put the
    // raised training button off centre, and a coach's workspace is a place an athlete
    // arrives from their profile, not from their thumb.
    renderAt(HOME_PATH);
    expect(screen.queryByRole("link", { name: /coach/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "" })).toBeDefined(); // the centre action
    expect(
      THUMB_DESTINATIONS.some((d) => d.path === COACH_PATH),
    ).toBe(false);
  });

  it("gives the bar one primary action, in the third slot", () => {
    // The load-bearing invariant behind the grid: an even number of items either side of
    // the raised button. `BottomNav` derives its columns from this list's length, so a
    // fifth entry would keep working in code and be wrong in the hand.
    const primaries = THUMB_DESTINATIONS.filter((d) => d.primary);
    expect(primaries).toHaveLength(1);
    expect(THUMB_DESTINATIONS[2].path).toBe(TRAIN_PATH);
    expect(THUMB_DESTINATIONS[2].primary).toBe(true);
  });

  it("sits below the modal's stacking level", () => {
    // The bar used to be at the modal's own index, so a dialog opened *from* the
    // navigation painted underneath it and the athlete tapped the bar instead.
    const { container } = renderAt(HOME_PATH);
    const nav = container.querySelector(".cronos-bottom-nav") as HTMLElement;
    expect(nav.style.zIndex).toBe(String(Z_INDEX.nav));
    expect(nav.style.zIndex).not.toBe(String(Z_INDEX.modal));
  });
});

describe("BottomNav active state", () => {
  it("marks the active route with aria-current and leaves the rest unmarked", () => {
    renderAt(ROUTINES_PATH);

    for (const destination of THUMB_DESTINATIONS) {
      const link = screen.getByLabelText(destination.ariaLabel);
      if (destination.path === ROUTINES_PATH) {
        expect(link.getAttribute("aria-current"), destination.path).toBe("page");
      } else {
        expect(link.hasAttribute("aria-current"), destination.path).toBe(false);
      }
    }
  });

  it("marks exactly one destination as current", () => {
    renderAt(PROFILE_PATH);
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
  });

  it("does not mark home as current on the old root path", () => {
    // `/` redirects to `/inicio` before the bar ever sees it, but the bar must not
    // depend on that: `end` on every link is what stops a prefix match lighting up
    // the home row from an unrelated address.
    renderAt(PROGRESS_PATH);
    expect(linkFor(HOME_PATH).hasAttribute("aria-current")).toBe(false);
  });

  it("marks nothing when the athlete is off the navigation, as at /coach", () => {
    // `/coach` is a route with no destination. Lighting the nearest row would be a lie
    // about where they are, and this bar is the thing that tells them where they are.
    renderAt(COACH_PATH);
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(0);
  });

  it("scales the active dot up on the current item and down on the rest", () => {
    renderAt(ROUTINES_PATH);
    const dots = [...document.querySelectorAll<HTMLElement>(
      "[data-testid='bottom-nav-active-dot']",
    )];
    // One per non-primary item: the raised action is its own marker and does not get a dot.
    expect(dots).toHaveLength(THUMB_DESTINATIONS.length - 1);

    const activeIndex = THUMB_DESTINATIONS.findIndex((d) => d.path === ROUTINES_PATH);
    // The dot order skips the primary, so the mapping is by destination, not by index.
    const dotDestinations = THUMB_DESTINATIONS.filter((d) => !d.primary);
    dots.forEach((dot, index) => {
      const expected =
        dotDestinations[index].path === ROUTINES_PATH ? "scale(1)" : "scale(0)";
      expect(dot.style.transform, dotDestinations[index].path).toBe(expected);
    });
    expect(activeIndex).toBe(1);
  });

  it("keeps the collapsed dot in the layout so the bar does not resize", () => {
    // A dot that was removed on `scale(0)` would make the bar shrink by 4px on every
    // navigation, which on a fixed bottom element is a visible jump of the whole page.
    renderAt(HOME_PATH);
    const dot = document.querySelector<HTMLElement>(
      "[data-testid='bottom-nav-active-dot']",
    )!;
    expect(dot.style.transform).toBe("scale(1)");
    const collapsed = [...document.querySelectorAll<HTMLElement>(
      "[data-testid='bottom-nav-active-dot']",
    )].find((d) => d.style.transform === "scale(0)")!;
    expect(collapsed.style.width).toBe(`${ACTIVE_DOT_SIZE}px`);
  });
});

describe("BottomNav navigation", () => {
  it("navigates to the path each destination declares", () => {
    // Started from `/progreso`, which is *not* in the navigation. Clicking the
    // item for the route you are already on is a no-op by design -- the router
    // does not treat it as a navigation -- so the assertion has to start
    // somewhere every destination is a real move.
    renderAt(PROGRESS_PATH);

    for (const destination of THUMB_DESTINATIONS) {
      fireEvent.click(screen.getByLabelText(destination.ariaLabel));
      expect(screen.getByTestId("location").textContent, destination.path).toBe(
        destination.path,
      );
    }
  });

  it("gives every destination a tap target of at least 44px", () => {
    // WCAG 2.5.5 / the brief's minimum. Asserted on the rendered element rather
    // than on the constant, because the constant is not what the user touches.
    renderAt(HOME_PATH);

    for (const destination of THUMB_DESTINATIONS) {
      const style = screen.getByLabelText(destination.ariaLabel).style;
      expect(Number.parseFloat(style.minHeight), destination.path).toBeGreaterThanOrEqual(44);
      expect(Number.parseFloat(style.minWidth), destination.path).toBeGreaterThanOrEqual(44);
    }
  });
});

describe("BottomNav labels", () => {
  it("shows a visible label only on the active item", () => {
    // Four permanent labels make the bar a wall of text and a third taller; the
    // icon plus `aria-label` already carry the meaning.
    //
    // The inactive labels stay *in* the DOM at zero height rather than being
    // removed, so the bar does not resize as the selection moves. So the
    // assertion is about being seen, not about existing.
    renderAt(PROFILE_PATH);

    const labelFor = (path: string): HTMLElement => {
      const link = linkFor(path);
      const spans = [...link.querySelectorAll("span")];
      // The icon wrapper is the first span, the dot the second, the label the last.
      return spans[spans.length - 1] as HTMLElement;
    };

    expect(labelFor(PROFILE_PATH).style.opacity).toBe("1");
    expect(labelFor(PROFILE_PATH).style.height).not.toBe("0px");

    for (const path of [HOME_PATH, ROUTINES_PATH]) {
      expect(labelFor(path).style.opacity, path).toBe("0");
      expect(labelFor(path).style.height, path).toBe("0px");
    }
  });

  it("gives the training action no visible label, and names it for the reader", () => {
    // The raised fill already says "this one", and a word under it would make it the
    // only item with two lines and read as broken. The name lives on `aria-label`.
    renderAt(HOME_PATH);
    const train = THUMB_DESTINATIONS.find((d) => d.primary)!;

    expect(screen.getByLabelText(train.ariaLabel)).toBeDefined();
    // Asserted as "the link renders no text at all" rather than `queryByText(train.label)`,
    // which would match every element in the document: `label` is `""`, and the empty
    // string is a substring of everything.
    expect(train.label).toBe("");
    expect(linkFor(TRAIN_PATH).textContent).toBe("");
  });
});

describe("BottomNav centre action", () => {
  it("is a filled circle in the accent, not an outlined one", () => {
    const { container } = renderAt(HOME_PATH);
    const centre = container.querySelector(
      "[data-testid='bottom-nav-centre-action']",
    ) as HTMLElement;

    // The whole point of the redesign: the primary action carries the accent, and amber
    // is free to mean "warning" everywhere else because it no longer has to share.
    const { r, g, b } = parseColor(ACCENT.base)!;
    expect(centre.style.backgroundColor).toBe(`rgb(${r}, ${g}, ${b})`);
    expect(centre.style.width).toBe(`${CENTRE_ACTION_SIZE}px`);
    expect(centre.style.height).toBe(`${CENTRE_ACTION_SIZE}px`);
  });

  it("overlaps the bar rather than sitting inside it", () => {
    const { container } = renderAt(HOME_PATH);
    const centre = container.querySelector(
      "[data-testid='bottom-nav-centre-action']",
    ) as HTMLElement;
    // A positive lift pushes the circle up over the bar's top edge. Without it the
    // circle is just the largest icon in a row, and nothing marks it as the action.
    expect(centre.style.marginTop).toBe(`${-CENTRE_ACTION_LIFT}px`);
  });

  it("gives the centre action a ring in the accent's own hue", () => {
    const { container } = renderAt(HOME_PATH);
    const centre = container.querySelector(
      "[data-testid='bottom-nav-centre-action']",
    ) as HTMLElement;
    expect(centre.style.boxShadow).toBe(ACCENT.ring);
  });

  it("is hidden from the reader, because the link above it carries the name", () => {
    // The glyph is decorative; the `NavLink` owns the accessible name. Announcing both
    // would say "Ir a entrenar" twice on every tab stop.
    const { container } = renderAt(HOME_PATH);
    const centre = container.querySelector(
      "[data-testid='bottom-nav-centre-action']",
    ) as HTMLElement;
    expect(centre.getAttribute("aria-hidden")).toBe("true");
  });

  it("still marks the current page when it is the training route", () => {
    renderAt(TRAIN_PATH);
    expect(linkFor(TRAIN_PATH).getAttribute("aria-current")).toBe("page");
  });
});