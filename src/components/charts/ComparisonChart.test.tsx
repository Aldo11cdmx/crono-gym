/**
 * @vitest-environment jsdom
 *
 * ComparisonChart.test.tsx — the properties that make a comparison honest.
 *
 * The chart has one job: show two periods so the gap between them can be read. Three ways
 * to break that, all of them plausible-looking, are covered here.
 *
 *   - **Two scales.** If each series is scaled to its own maximum, a period that went from
 *     40kg to 45kg and a period that went from 100kg to 140kg both fill the plot, and the
 *     chart says they improved identically. The whole point is lost.
 *   - **A date axis.** Indexed by date, two sessions a week apart stretch across the plot
 *     and two sessions three months apart are crushed together, so the visual gap stops
 *     matching the real one.
 *   - **Two fills.** Two translucent areas overlap, and the intersection reads as a third
 *     quantity that means nothing.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  ComparisonChart,
  type ComparisonSeries,
} from "./ComparisonChart";
import { ACCENT, DIAGRAM } from "../../design/tokens";

afterEach(cleanup);

const series = (...values: number[]): ComparisonSeries[] =>
  values.map((value, i) => ({ id: `s${i}`, value }));

/** The three paths, found by what they are rather than by their position in the DOM. */
function parts(container: HTMLElement) {
  const paths = [...container.querySelectorAll("path")];
  return {
    previous: paths.find((p) => p.getAttribute("stroke") === DIAGRAM.figureStroke),
    current: paths.find((p) => p.getAttribute("stroke") === ACCENT.base),
    area: paths.find((p) => p.getAttribute("fill")?.startsWith("url(")),
  };
}

/** The x coordinates of a path, walking its commands. */
function xsIn(d: string): number[] {
  const xs: number[] = [];
  const tokens = d.match(/[MLCZ]|-?\d+(?:\.\d+)?/g) ?? [];
  let expectX = true;

  for (const token of tokens) {
    if (/^[MLCZ]$/.test(token)) {
      expectX = true;
      continue;
    }
    if (expectX) xs.push(Number.parseFloat(token));
    expectX = !expectX;
  }

  return xs;
}

/** The y coordinates of a path. */
function ysIn(d: string): number[] {
  const ys: number[] = [];
  const tokens = d.match(/[MLCZ]|-?\d+(?:\.\d+)?/g) ?? [];
  let expectY = false;

  for (const token of tokens) {
    if (/^[MLCZ]$/.test(token)) {
      expectY = false;
      continue;
    }
    if (expectY) ys.push(Number.parseFloat(token));
    expectY = !expectY;
  }

  return ys;
}

describe("one shared scale", () => {
  it("scales both periods against one domain, not one each", () => {
    /*
     * The decisive case. A period that tripled and a period that moved 5kg would look
     * identical under per-series scaling; the lower half of the plot belongs to whichever
     * series is genuinely lower.
     */
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(40, 45)} current={series(100, 140)} />,
    );
    const { previous, current } = parts(container);

    const previousYs = ysIn(previous!.getAttribute("d")!);
    const currentYs = ysIn(current!.getAttribute("d")!);

    // Domain is 140 * 1.1 = 154, so 100 is well above the midpoint and the earlier,
    // lighter period has to sit in the *lower* part of the plot. Under per-series scaling
    // both series would span the full height and these would be equal.
    expect(Math.max(...previousYs)).toBeGreaterThan(Math.min(...currentYs) + 20);
  });

  it("puts the midpoint of the domain at the midpoint of the plot", () => {
    /*
     * Exact, not approximate. The domain is `max * 1.1`, so the value that lands halfway up
     * the plot is `max * 0.55` -- not `max / 2`. Worth pinning down precisely: it is the
     * property that makes the vertical gap between the two lines mean something, and a
     * per-series domain would put both series' maxima at the same height and destroy the
     * reading entirely.
     */
    const height = 160;
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(55, 55)} current={series(100, 100)} height={height} />,
    );
    const { previous, current } = parts(container);

    const top = 16;
    const baseline = 16 + (height - 16 - 26);
    const midpoint = (top + baseline) / 2;

    // Flat series, so both segments share a y and the first is the point's row.
    expect(ysIn(previous!.getAttribute("d")!)[0]).toBeCloseTo(midpoint, 1);
    // 100 against a domain of 110 sits near the top but not on it: the 10% headroom is what
    // stops the highest point touching the edge of the plot.
    expect(ysIn(current!.getAttribute("d")!)[0]).toBeLessThan(midpoint);
    expect(ysIn(current!.getAttribute("d")!)[0]).toBeGreaterThan(top);
  });

  it("does not divide by zero when both periods are empty or zero", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(0, 0)} current={series(0, 0)} />,
    );
    for (const y of ysIn(parts(container).current!.getAttribute("d")!)) {
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe("indexed by session", () => {
  it("puts both periods' first session at the same x", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20, 30, 40)} current={series(12, 22)} />,
    );
    const { previous, current } = parts(container);

    // Four sessions against two. Indexed by date these would start at different places and
    // the lines would not be comparable at all; indexed by session they both start at the
    // y-axis and "session 1 to 2" sits directly above "session 1 to 2".
    expect(xsIn(previous!.getAttribute("d")!)[0]).toBe(40);
    expect(xsIn(current!.getAttribute("d")!)[0]).toBe(40);
  });

  it("ends the shorter period early instead of extrapolating it", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20, 30, 40)} current={series(12, 22)} />,
    );
    const { previous, current } = parts(container);

    const previousXs = xsIn(previous!.getAttribute("d")!);
    const currentXs = xsIn(current!.getAttribute("d")!);

    // Four points give four x's and two give two -- the lines are straight segments here, not
    // curves. Extending the shorter line to the right edge would claim sessions that were
    // never done, and comparing "4 sessions" against "4 sessions" would be a different
    // comparison from the one the reader asked for.
    expect(previousXs).toHaveLength(4);
    expect(currentXs).toHaveLength(2);
    expect(previousXs[previousXs.length - 1]).toBeGreaterThan(currentXs[currentXs.length - 1]);
  });

  it("labels the x axis with session counts, not dates", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20)} current={series(12, 22, 25)} />,
    );
    const ticks = [...container.querySelectorAll("text")].map((t) => t.textContent);

    // The longest period sets the count, and nothing in the axis names a month -- a date
    // here would imply a time scale the chart does not have.
    expect(ticks).toEqual(expect.arrayContaining(["1", "2", "3"]));
    expect(ticks.some((t) => /ene|seg|mar|\/\d/.test(t ?? ""))).toBe(false);
  });
});

describe("the paint", () => {
  it("draws the earlier period first, so the current one lands on top", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20)} current={series(12, 22)} />,
    );
    const { previous, current } = parts(container);

    // Document order is paint order in SVG. The other way round the accent line is hidden
    // under the grey one wherever they cross, and "current" becomes invisible exactly where
    // the two periods converge.
    expect(
      previous!.compareDocumentPosition(current!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("fills only the current period", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20)} current={series(12, 22)} />,
    );
    const { previous, area } = parts(container);

    expect(area).toBeTruthy();
    // Two overlapping translucent fills would make the intersection read as a third value.
    expect(previous!.getAttribute("fill")).toBe("none");
  });

  it("uses the diagram's own grey for the earlier period, not an invented one", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20)} current={series(12, 22)} />,
    );
    // A fourth grey invented for this chart would be exactly the drift the Block D guards
    // exist to stop. `figureStroke` is already "a drawn line on this surface".
    expect(parts(container).previous!.getAttribute("stroke")).toBe(DIAGRAM.figureStroke);
  });

  it("fades the current period's fill from the accent to nothing", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20)} current={series(12, 22)} />,
    );
    const gradientId = parts(container).area!.getAttribute("fill")!.match(/url\(#(.+)\)/)![1];
    const stops = [...container.querySelector(`#${gradientId}`)!.querySelectorAll("stop")];

    for (const stop of stops) expect(stop.getAttribute("stop-color")).toBe(ACCENT.base);
    expect(stops[stops.length - 1].getAttribute("stop-opacity")).toBe("0");
  });

  it("scopes the gradient id per instance", () => {
    // SVG gradient ids are document-global. Two comparisons on one screen sharing an id
    // would mean the second filled with the first's gradient, and nothing would say so.
    const { container } = render(
      <>
        <ComparisonChart label="A" previous={series(10, 20)} current={series(12, 22)} />
        <ComparisonChart label="B" previous={series(30, 40)} current={series(32, 42)} />
      </>,
    );
    const ids = [...container.querySelectorAll("path")]
      .map((p) => p.getAttribute("fill"))
      .filter((f) => f?.startsWith("url("))
      .map((f) => f!.slice(5, -1));

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("draws an end dot for each period, so the last reading is locatable", () => {
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20)} current={series(12, 22)} />,
    );
    const circles = [...container.querySelectorAll("circle")];

    expect(circles).toHaveLength(2);
    const strokes = circles.map((c) => c.getAttribute("fill")).sort();
    expect(strokes).toEqual([ACCENT.base, DIAGRAM.figureStroke].sort());
  });
});

describe("the delta", () => {
  it("shows it, with a sign", () => {
    render(
      <ComparisonChart label="Sentadilla" previous={series(100, 100)} current={series(110, 110)} />,
    );
    // +10, and named as an improvement in the accent. The number is the reason to look at
    // this chart at all, so it does not stay hidden in the accessible description.
    expect(screen.getByText("+10 kg")).toBeTruthy();
  });

  it("shows a drop as a negative, without dressing it up", () => {
    render(
      <ComparisonChart label="Sentadilla" previous={series(110, 110)} current={series(100, 100)} />,
    );
    expect(screen.getByText("-10 kg")).toBeTruthy();
  });

  it("says nothing when the two periods are level", () => {
    render(
      <ComparisonChart label="Sentadilla" previous={series(100, 100)} current={series(100, 100)} />,
    );
    // A "+0 kg" would be a number that looks like a result and is not one.
    expect(screen.queryByText(/kg$/)).toBeNull();
  });

  it("says nothing rather than showing NaN when a period is missing", () => {
    render(<ComparisonChart label="Sentadilla" previous={[]} current={series(100, 110)} />);

    // The important half: no NaN anywhere, and no delta. A "baja NaN kg" would be read as a
    // result. The current period is still described, because its data is real.
    expect(screen.queryByText(/NaN/)).toBeNull();
    const label = screen.getByRole("img").getAttribute("aria-label")!;
    expect(label).toContain("periodo actual 105 kg");
    expect(label).not.toContain("periodo anterior");
  });

  it("says 'sin datos' only when neither period has anything", () => {
    render(<ComparisonChart label="Sentadilla" previous={[]} current={[]} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Sentadilla: sin datos");
  });

  it("omits the legend key for a period that has no line", () => {
    // A key pointing at a line that is not drawn sends the reader looking for one.
    render(<ComparisonChart label="Sentadilla" previous={[]} current={series(100, 110)} />);
    expect(screen.queryByText("Anterior")).toBeNull();
    expect(screen.getByText("Actual")).toBeTruthy();
  });
});

describe("the accessible description", () => {
  it("names the periods, and does not name a date", () => {
    render(
      <ComparisonChart label="Sentadilla" previous={series(100, 100)} current={series(110, 110)} />,
    );
    const label = screen.getByRole("img").getAttribute("aria-label")!;

    expect(label).toContain("Sentadilla");
    expect(label).toContain("periodo anterior 100 kg");
    expect(label).toContain("periodo actual 110 kg");
    expect(label).toContain("sube 10 kg");
    expect(label.endsWith(".")).toBe(true);
  });

  it("describes both periods and the difference in one sentence", () => {
    render(
      <ComparisonChart label="Press banca" previous={series(60, 65, 70)} current={series(72, 78)} />,
    );
    const label = screen.getByRole("img").getAttribute("aria-label")!;

    // Means, not every value: "65 kg to 72 kg" is useful, six numbers is not.
    expect(label).toContain("periodo anterior 65 kg");
    expect(label).toContain("periodo actual 75 kg");
    expect(label).toContain("sube 10 kg");
  });

  it("reports the lower period too", () => {
    render(
      <ComparisonChart label="Sentadilla" previous={series(110, 110)} current={series(100, 100)} />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("baja 10 kg");
  });
});

describe("reduced motion", () => {
  function withReducedMotion(prefers: boolean) {
    const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: prefers && query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    return () => {
      if (original) Object.defineProperty(window, "matchMedia", original);
    };
  }

  it("draws both lines already complete", () => {
    const restore = withReducedMotion(true);
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20)} current={series(12, 22)} />,
    );
    const { previous, current } = parts(container);

    // Both series are information. A nonzero offset with no animation would leave them
    // invisible -- the chart would be empty, not still.
    expect(previous!.getAttribute("stroke-dashoffset")).toBe("0");
    expect(current!.getAttribute("stroke-dashoffset")).toBe("0");
    restore();
  });

  it("keeps the fill, without the fade", () => {
    const restore = withReducedMotion(true);
    const { container } = render(
      <ComparisonChart label="Sentadilla" previous={series(10, 20)} current={series(12, 22)} />,
    );
    expect(parts(container).area!.getAttribute("style") ?? "").toBe("");
    restore();
  });
});
