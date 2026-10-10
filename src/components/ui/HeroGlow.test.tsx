/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HeroGlow } from "./HeroGlow";

describe("HeroGlow", () => {
  it("renders an aria-hidden layer", () => {
    const { container } = render(<HeroGlow />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("has pointer-events none", () => {
    const { container } = render(<HeroGlow />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.pointerEvents).toBe("none");
  });

  it("uses LOGO_GRADIENT light and ACCENT.glow in its background", () => {
    const { container } = render(<HeroGlow />);
    const el = container.firstChild as HTMLElement;
    const bg = el.style.backgroundImage;
    expect(bg).toContain("radial-gradient");
    // ACCENT.glow is "rgba(255, 59, 48, 0.20)" → jsdom serialises to rgb
    expect(bg).toContain("255, 59, 48");
  });

  it("sets a backgroundColor so the surface stays solid", () => {
    const { container } = render(<HeroGlow />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.backgroundColor).toBeTruthy();
    expect(el.style.backgroundImage).toContain("radial-gradient");
  });
});
