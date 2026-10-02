/**
 * @vitest-environment jsdom
 *
 * `BrandLockup` is three properties and a file path, and each of them fails
 * silently. A `src` that 404s leaves an invisible gap next to the wordmark; a
 * lost `mix-blend-screen` leaves a black rectangle sitting on the OLED black,
 * which reads as a rendering bug rather than as a missing class; a duplicated
 * lockup puts the brand on screen twice at one breakpoint.
 *
 * The class-order assertion is the load-bearing one. `hidden` beating the
 * component's own `flex` is a property of *Tailwind's* emission order, not of
 * the class attribute, so nothing in this file's own output would notice if a
 * Tailwind upgrade moved `hidden` above `flex` -- the test has to say so out
 * loud instead of trusting it to stay true.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BrandLockup, BRAND_LOGO_SRC } from "./BrandLockup";
import { BRAND_LABELS } from "@/lib/i18n";
import { MOTION } from "@/design/tokens";

afterEach(cleanup);

function mark(): HTMLImageElement {
  return screen.getByAltText(BRAND_LABELS.logoAlt) as HTMLImageElement;
}

describe("BrandLockup", () => {
  it("serves the shipped jpg from the site root, not an import", () => {
    // Vite copies `public/` verbatim, so the path is absolute and unhashed. An
    // imported asset would come back with a build-time hash instead, which is
    // what makes this assertion able to catch a refactor to `import logo from`.
    render(<BrandLockup />);
    expect(mark().getAttribute("src")).toBe("/logo.jpg");
    expect(BRAND_LOGO_SRC).toBe("/logo.jpg");
  });

  it("blends the black canvas away instead of pasting a black box", () => {
    // The single most important class in the file. Without it the jpg's black
    // field shows as a rectangle against `SURFACE.base`.
    render(<BrandLockup />);
    expect(mark().className).toContain("mix-blend-screen");
  });

  it("keeps the aspect ratio instead of squashing the mark", () => {
    render(<BrandLockup />);
    expect(mark().className).toContain("w-auto");
    expect(mark().className).toContain("object-contain");
  });

  it("names the brand for assistive tech without describing it twice", () => {
    render(<BrandLockup />);
    // "Cronos", not "logo de Cronos": the wordmark is already on screen.
    expect(mark().alt).toBe("Cronos");
    expect(screen.getByText("CRONOS")).toBeTruthy();
  });

  it("can drop the wordmark for a mark-only placement", () => {
    render(<BrandLockup showWordmark={false} />);
    expect(mark()).toBeTruthy();
    expect(screen.queryByText("CRONOS")).toBeNull();
  });

  it("scales the mark without the row growing shorter than a touch target", () => {
    // A 30px mark inside a 44px row: the row is what makes the header feel
    // tappable and stops the mark from crowding the tab strip beside it.
    const { container } = render(<BrandLockup size={30} />);
    const row = container.firstElementChild as HTMLElement;
    expect(mark().style.height).toBe("30px");
    expect(row.style.minHeight).toBe(MOTION.minTouchTarget);
  });

  it("keeps the default layout classes ahead of a caller's, for the breakpoint swap", () => {
    // `App.tsx` hides the header lockup from 768px up with `hidden max-md:flex`.
    // That only works because Tailwind emits `hidden` after `flex`; if the
    // component ever stopped putting its own `flex` first, the two would both be
    // present in the attribute and the win would depend on emission order alone.
    const { container } = render(<BrandLockup className="hidden max-md:flex" />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toBe("flex items-center gap-3 hidden max-md:flex");
  });

  it("lets a caller position the row without losing its own classes", () => {
    const { container } = render(<BrandLockup className="opacity-70" style={{ marginTop: "4px" }} />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("opacity-70");
    expect(row.className).toContain("items-center");
    expect(row.style.marginTop).toBe("4px");
  });
});
