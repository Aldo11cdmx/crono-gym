/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HeroChip } from "./HeroChip";
import { Zap } from "lucide-react";

describe("HeroChip", () => {
  afterEach(cleanup);

  it("renders the label text", () => {
    render(<HeroChip label="5 ejercicios" />);
    expect(screen.getByText("5 ejercicios")).toBeTruthy();
  });

  it("renders an icon when provided", () => {
    const { container } = render(<HeroChip label="30 min" icon={<Zap size={16} />} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("sets aria-label when provided", () => {
    render(<HeroChip label="30 min" aria-label="Duración estimada" />);
    expect(screen.getByLabelText("Duración estimada")).toBeTruthy();
  });

  it("truncates long labels with ellipsis", () => {
    const long = "Este es un label muy largo que deberia truncarse";
    render(<HeroChip label={long} />);
    const span = screen.getByText(long);
    expect(span).toBeTruthy();
    // The wrapping span has overflow/ellipsis set — verify style
    const chip = span.closest("span");
    expect(chip?.style.textOverflow).toBe("ellipsis");
  });
});
