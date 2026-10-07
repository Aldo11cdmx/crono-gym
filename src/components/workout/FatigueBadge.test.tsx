/**
 * @vitest-environment jsdom
 *
 * FatigueBadge.test.tsx — the chip on a tired set.
 *
 * Two claims: the shortfall is spelled in reps (a fact, not
 * a verdict), and the two levels are told apart by the chip's
 * weight -- filled versus outlined -- so the difference survives
 * a screen that shows no colour at all.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FatigueBadge } from "./FatigueBadge";
import { FATIGUE_LABELS } from "../../lib/i18n";
import { STATUS } from "../../design/tokens";
import { sameColor } from "../../test-support/color";

afterEach(cleanup);

describe("FatigueBadge", () => {
  it("spells the shortfall in reps", () => {
    render(<FatigueBadge shortfall={2} level="mild" />);
    // "Two reps short" is a measurement; "tired" is a guess.
    expect(screen.getByText(FATIGUE_LABELS.shortfallText(2))).toBeTruthy();
  });

  it("names a mild shortfall as fatigue", () => {
    render(<FatigueBadge shortfall={1} level="mild" />);
    expect(
      screen.getByRole("img", {
        name: FATIGUE_LABELS.badgeAriaLabel("mild", 1),
      }),
    ).toBeTruthy();
  });

  it("names a high shortfall as high fatigue", () => {
    render(<FatigueBadge shortfall={3} level="high" />);
    expect(
      screen.getByRole("img", {
        name: FATIGUE_LABELS.badgeAriaLabel("high", 3),
      }),
    ).toBeTruthy();
  });

  it("outlines the chip for mild fatigue and fills it for high", () => {
    // The levels differ in weight, not only in hue: high is a
    // filled chip, mild an outline, so the difference survives
    // greyscale and colour-blindness alike.
    const { rerender } = render(<FatigueBadge shortfall={1} level="mild" />);
    const chip = screen.getByRole("img");
    expect(chip.style.background).toBe("transparent");

    rerender(<FatigueBadge shortfall={1} level="high" />);
    expect(sameColor(chip.style.background, STATUS.warning.muted)).toBe(true);
  });
});
