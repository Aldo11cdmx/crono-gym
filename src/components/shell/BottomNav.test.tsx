/**
 * @vitest-environment jsdom
 *
 * BottomNav is the one control the user has to find without looking, because they
 * reach for it mid-set with one hand. So these tests are about what the bar
 * promises: five destinations, the right one marked as current, every target big
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
import { BottomNav } from "./BottomNav";
import { NAV_DESTINATIONS } from "./navItems";

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

describe("BottomNav", () => {
  it("renders one destination per entry in navItems, named in Spanish", () => {
    renderAt("/");

    expect(screen.getByRole("navigation").getAttribute("aria-label")).toBe(
      "Navegación principal",
    );

    for (const destination of NAV_DESTINATIONS) {
      expect(screen.getByLabelText(destination.ariaLabel)).toBeDefined();
    }
    expect(screen.getAllByRole("link")).toHaveLength(NAV_DESTINATIONS.length);
  });

  it("marks the active route with aria-current and leaves the rest unmarked", () => {
    renderAt("/biblioteca");

    for (const destination of NAV_DESTINATIONS) {
      const link = screen.getByLabelText(destination.ariaLabel);
      if (destination.path === "/biblioteca") {
        expect(link.getAttribute("aria-current"), destination.path).toBe("page");
      } else {
        expect(link.hasAttribute("aria-current"), destination.path).toBe(false);
      }
    }
  });

  it("marks exactly one destination as current", () => {
    renderAt("/rangos");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
  });

  it("navigates to the path each destination declares", () => {
    // Started from `/progreso`, which is *not* in the navigation. Clicking the
    // item for the route you are already on is a no-op by design -- the router
    // does not treat it as a navigation -- so the assertion has to start
    // somewhere every destination is a real move.
    renderAt("/progreso");

    for (const destination of NAV_DESTINATIONS) {
      fireEvent.click(screen.getByLabelText(destination.ariaLabel));
      expect(screen.getByTestId("location").textContent, destination.path).toBe(
        destination.path,
      );
    }
  });

  it("gives every destination a tap target of at least 44px", () => {
    // WCAG 2.5.5 / the brief's minimum. Asserted on the rendered element rather
    // than on the constant, because the constant is not what the user touches.
    renderAt("/");

    for (const destination of NAV_DESTINATIONS) {
      const style = screen.getByLabelText(destination.ariaLabel).style;
      expect(Number.parseFloat(style.minHeight), destination.path).toBeGreaterThanOrEqual(44);
      expect(Number.parseFloat(style.minWidth), destination.path).toBeGreaterThanOrEqual(44);
    }
  });

  it("shows a visible label only on the active item", () => {
    // Five permanent labels make the bar a wall of text and a third taller; the
    // icon plus `aria-label` already carry the meaning.
    //
    // The inactive labels stay *in* the DOM at zero height rather than being
    // removed, so the bar does not resize as the selection moves. So the
    // assertion is about being seen, not about existing.
    renderAt("/perfil");

    const labelFor = (path: string): HTMLElement => {
      const link = screen.getByLabelText(
        NAV_DESTINATIONS.find((d) => d.path === path)!.ariaLabel,
      );
      const spans = [...link.querySelectorAll("span")];
      // The icon wrapper is the first span; the label is the last.
      return spans[spans.length - 1] as HTMLElement;
    };

    expect(labelFor("/perfil").style.opacity).toBe("1");
    expect(labelFor("/perfil").style.height).not.toBe("0px");

    for (const path of ["/", "/biblioteca", "/rangos"]) {
      expect(labelFor(path).style.opacity, path).toBe("0");
      expect(labelFor(path).style.height, path).toBe("0px");
    }
  });

  it("gives the training action no visible label, and names it for the reader", () => {
    // The raised fill already says "this one", and a fifth word would break the
    // row the other four sit in. The name lives on `aria-label` instead.
    renderAt("/");
    const train = NAV_DESTINATIONS.find((d) => d.primary)!;

    expect(screen.getByLabelText(train.ariaLabel)).toBeDefined();
    expect(screen.queryByText(train.label)).toBeNull();
  });

  it("slides the indicator to the active destination's slot", () => {
    const { container } = renderAt("/rangos");
    const indicator = container.querySelector(
      "[data-testid='bottom-nav-indicator']",
    ) as HTMLElement;

    // Three slots of five, as a percentage of the bar's width.
    expect(indicator.style.left).toBe(`${(3 * 100) / NAV_DESTINATIONS.length}%`);
    expect(indicator.style.width).toBe(`${100 / NAV_DESTINATIONS.length}%`);
  });
});