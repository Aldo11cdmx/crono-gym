/**
 * @vitest-environment jsdom
 *
 * ProgressChart.test.tsx — what the chart claims, and that it does not invent numbers.
 *
 * The tests are mostly about the things a chart can silently get wrong:
 *
 *   - a smoothing that overshoots a spike and draws a record the athlete never set, which
 *     is the failure the clamped control points exist to prevent;
 *   - an axis that does not start at zero, which makes 5kg look like 40kg;
 *   - marks that disappear when there are more than a dozen points, taking a personal record
 *     with them.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgressChart, type ProgressPoint } from "./ProgressChart";
import { ACCENT, DIAGRAM, TEXT } from "../../design/tokens";

afterEach(cleanup);

/** `days` before a fixed date, in ms. */
const BASE = Date.UTC(2026, 2, 1);
const day = (n: number) => BASE + n * 86_400_000;

function point(over: Partial<ProgressPoint> & { id: string }): ProgressPoint {
  return { at: day(0), value: 100, ...over };
}

/** Every `d` attribute in the rendered svg, as a string. */
function paths(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll("path")] as SVGPathElement[];
}

/**
 * The y coordinates in a path, in order.
 *
 * Parsed by walking the commands rather than by taking every second number. These paths
 * mix `M`, `C` and `L`, and `C` takes six numbers per segment, so "every other number" picks
 * x's and y's in a pattern that only lines up for one command -- which is how this file's
 * first version of the overshoot test reported a curve escaping the plot that was actually
 * sitting inside it, and would have hidden a real one.
 */
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

describe("drawing the series", () => {
  it("draws one path for the line and one for the area, and the area is closed", () => {
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 100 }), point({ id: "b", value: 110 }), point({ id: "c", value: 105 })]}
      />,
    );

    const [area, line] = paths(container);
    expect(line).toBeDefined();
    expect(area).toBeDefined();
    // The area closes with `Z` and comes back to the baseline; without that it is an open
    // path and the fill fills nothing.
    expect(area!.getAttribute("d")).toMatch(/Z$/);
    expect(line!.getAttribute("d")).not.toMatch(/Z$/);
  });

  it("puts the line's own path at the front of the area", () => {
    // The fill's top edge must *be* the line, character for character. Computing the two
    // separately is how a chart ends up with an area that does not match its curve, and the
    // mismatch is invisible until someone renders it at a wide viewport.
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 100 }), point({ id: "b", value: 120 })]}
      />,
    );
    const [area, line] = paths(container);
    expect(area!.getAttribute("d")!.startsWith(line!.getAttribute("d")!)).toBe(true);
  });

  it("draws nothing for a single point, rather than a dot pretending to be a series", () => {
    // A Bézier needs two distinct neighbours to have a direction. With one point there is
    // no line, and a path that says "M 100 50" is a claim about a series of one.
    const { container } = render(
      <ProgressChart label="Sentadilla" points={[point({ id: "a", value: 100 })]} />,
    );
    expect(paths(container)).toHaveLength(0);
  });

  it("draws nothing at all for no points, and says so", () => {
    render(<ProgressChart label="Sentadilla" points={[]} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Sentadilla: sin datos");
  });

  it("sorts the points, so a caller passing newest-first gets a chart", () => {
    // `sessionHistory` returns newest-first. A line that doubles back on itself is the
    // result of not sorting, and it is a silent failure -- the chart still renders.
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[
          point({ id: "c", at: day(20), value: 120 }),
          point({ id: "b", at: day(10), value: 110 }),
          point({ id: "a", at: day(0), value: 100 }),
        ]}
      />,
    );
    const ys = ysIn(paths(container)[1].getAttribute("d")!);
    // Oldest first means the first y sits on the *lowest* value's row, i.e. lower down the
    // chart, so y increases as the value climbs. Newest-first would start high and fall.
    expect(ys[0]).toBeGreaterThan(ys[ys.length - 1]);
  });
});

describe("not inventing a record", () => {
  it("never draws above the highest logged value", () => {
    /*
     * The spike is the whole test. An unclamped Catmull-Rom overshoots here and draws a
     * peak above 120 -- on a chart whose only job is to say what the athlete's best is.
     */
    const spike = [
      point({ id: "a", at: day(0), value: 100 }),
      point({ id: "b", at: day(7), value: 105 }),
      point({ id: "c", at: day(14), value: 120 }),
      point({ id: "d", at: day(21), value: 105 }),
      point({ id: "e", at: day(28), value: 100 }),
    ];
    const { container } = render(<ProgressChart label="Sentadilla" points={spike} />);

    const line = paths(container)[1].getAttribute("d")!;
    // y increases downward, so the smallest y is the topmost pixel the curve reaches.
    const topmost = Math.min(...ysIn(line));

    // PADDING.top. The domain is max*1.1, so the highest data point lands strictly below
    // this line; the curve must never reach it.
    expect(topmost).toBeGreaterThan(16);
  });

  it("keeps every drawn y inside the plot area", () => {
    const values = [100, 105, 120, 105, 100, 118, 96, 124];
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={values.map((value, i) => point({ id: `p${i}`, at: day(i * 3), value }))}
      />,
    );
    const ys = ysIn(paths(container)[1].getAttribute("d")!);

    // PADDING.top is the ceiling and the baseline the floor. This is the property the
    // control-point clamp exists to provide: with every control point inside its own
    // segment's y-range, a cubic Bézier -- a convex combination of its four control points
    // -- cannot leave it, so no segment can invent a peak or dive below the axis.
    const baseline = 16 + (180 - 16 - 26);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(16);
      expect(y).toBeLessThanOrEqual(baseline);
    }
  });
});

describe("the axis", () => {
  it("starts at zero, so 5kg does not look like 40kg", () => {
    // The domain is 0..max*1.1. A non-zero baseline is the single most common way a
    // progress chart flatters an athlete.
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 80 }), point({ id: "b", value: 85 })]}
        unit="kg"
      />,
    );
    const label = [...container.querySelectorAll("text")].map((t) => t.textContent).join(" ");
    // 85 * 1.1 = 93.5
    expect(label).toContain("93.5");
  });

  it("labels only the maximum, because a grid is furniture on a chart this small", () => {
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[
          point({ id: "a", value: 80 }),
          point({ id: "b", value: 90 }),
          point({ id: "c", value: 100 }),
        ]}
      />,
    );
    expect(container.querySelectorAll("text")).toHaveLength(1);
  });

  it("draws the baseline in the diagram's own stroke colour", () => {
    const { container } = render(
      <ProgressChart label="Sentadilla" points={[point({ id: "a" }), point({ id: "b", value: 90 })]} />,
    );
    const baseline = [...container.querySelectorAll("line")].find((l) => !l.getAttribute("stroke-dasharray"))!;

    // Same reasoning as the comparison chart: a grey invented for one chart is exactly the
    // drift the Block D guards exist to stop, and `figureStroke` is already this.
    expect(baseline.getAttribute("stroke")).toBe(DIAGRAM.figureStroke);
  });

  it("does not divide by zero when every value is zero", () => {
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 0 }), point({ id: "b", value: 0 })]}
      />,
    );
    const ys = ysIn(paths(container)[1].getAttribute("d")!);
    for (const y of ys) expect(Number.isFinite(y)).toBe(true);
  });
});

describe("personal records", () => {
  it("marks the ones it is told about, and only those", () => {
    // Detection is the caller's job: "is this a PR" is a question about the athlete's
    // whole history, and this component sees a window of it. A local maximum inside the
    // visible range would mark every dip-and-recover.
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[
          point({ id: "a", value: 100 }),
          point({ id: "b", value: 120, isRecord: true }),
          point({ id: "c", value: 110 }),
        ]}
      />,
    );
    expect(container.querySelectorAll("[data-testid='progress-chart-record']")).toHaveLength(1);
  });

  it("keeps the marks past twelve points, when the ordinary dots are dropped", () => {
    // The dots stop being legible around twelve; a record must not go with them, because it
    // is a specific claim about a specific day.
    const many = Array.from({ length: 30 }, (_, i) =>
      point({ id: `p${i}`, at: day(i), value: 100 + i, isRecord: i === 29 }),
    );
    const { container } = render(<ProgressChart label="Sentadilla" points={many} />);

    // The ordinary dots, not the record's expanding ring: both carry
    // `cronos-chart-scalable`, so the record has to be excluded by where it sits.
    const dots = [...container.querySelectorAll("circle.cronos-chart-scalable")].filter(
      (c) => !c.closest("[data-testid='progress-chart-record']"),
    );
    expect(dots).toHaveLength(0);
    expect(container.querySelectorAll("[data-testid='progress-chart-record']")).toHaveLength(1);
  });

  it("counts the records in the accessible description", () => {
    render(
      <ProgressChart
        label="Sentadilla"
        points={[
          point({ id: "a", value: 100, isRecord: true }),
          point({ id: "b", value: 120, isRecord: true }),
          point({ id: "c", value: 110 }),
        ]}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("2 récords");
  });
});

describe("the colours", () => {
  it("paints the line in the accent and the area in a fade of the same colour", () => {
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 100 }), point({ id: "b", value: 110 })]}
      />,
    );
    const [area, line] = paths(container);

    expect(line!.getAttribute("stroke")).toBe(ACCENT.base);
    // The area references the gradient rather than declaring a colour, and the gradient's
    // stops are alphas of `ACCENT.base` -- one accent faded, not a second colour.
    const gradientId = area!.getAttribute("fill")!.match(/url\(#(.+)\)/)![1];
    const gradient = container.querySelector(`#${gradientId}`)!;
    const stops = [...gradient.querySelectorAll("stop")];
    expect(stops).toHaveLength(2);
    for (const stop of stops) {
      expect(stop.getAttribute("stop-color")).toBe(ACCENT.base);
    }
    expect(stops[1].getAttribute("stop-opacity")).toBe("0");
  });

  it("uses a gradient id scoped to the instance, so two charts on a screen do not collide", () => {
    // SVG gradient ids are document-global. Two ProgressCharts with a shared id would mean
    // the second chart's area filled with the first's gradient -- and if they were on
    // different surfaces with different alphas, the wrong one wins silently.
    const { container } = render(
      <>
        <ProgressChart label="A" points={[point({ id: "a" }), point({ id: "b", value: 110 })]} />
        <ProgressChart label="B" points={[point({ id: "c" }), point({ id: "d", value: 90 })]} />
      </>,
    );
    const fills = [...container.querySelectorAll("path")].map((p) => p.getAttribute("fill"));
    const ids = fills.filter((f) => f?.startsWith("url(")).map((f) => f!.slice(5, -1));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the trend line", () => {
  it("draws dashed and in the tertiary text colour, because it is not data", () => {
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 100 }), point({ id: "b", value: 110 })]}
        trend={{ from: 98, to: 112 }}
      />,
    );
    const trend = [...container.querySelectorAll("line")].find((l) => l.getAttribute("stroke-dasharray"))!;
    expect(trend).toBeTruthy();
    expect(trend.getAttribute("stroke-dasharray")).toBe("4 4");
    // Tertiary text, not the accent: the trend is an interpretation of the series, and
    // painting it in the data's own colour would make it look like another reading. Same
    // weight as the baseline, so neither of them competes with the line.
    expect(trend.getAttribute("stroke")).toBe(TEXT.tertiary);
    expect(trend.getAttribute("stroke")).not.toBe(ACCENT.base);
    expect(trend.getAttribute("stroke-width")).toBe("1");
  });

  it("draws nothing for a trend with fewer than two points", () => {
    // A trend across one point has no direction, and drawing one would invent it.
    const { container } = render(
      <ProgressChart label="Sentadilla" points={[point({ id: "a" })]} trend={{ from: 100, to: 100 }} />,
    );
    expect([...container.querySelectorAll("line")].filter((l) => l.getAttribute("stroke-dasharray"))).toHaveLength(0);
  });
});

describe("reduced motion", () => {
  /**
   * `matchMedia` is stubbed rather than the hook mocked, because the chart branches on
   * `reducedMotion` in six places and a mock would hide whether the *stylesheet* half of the
   * reduced-motion handling is also present -- which is where the keyframes live.
   */
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

  it("draws the line already complete rather than animating it in", () => {
    const restore = withReducedMotion(true);
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 100 }), point({ id: "b", value: 110 })]}
      />,
    );
    const line = paths(container)[1];
    // Offset 0 means "nothing left to draw". A nonzero offset with no animation would leave
    // the line invisible, which is the failure this branch has to avoid.
    expect(line.getAttribute("stroke-dashoffset")).toBe("0");
    expect(line.getAttribute("style") ?? "").not.toContain("cronos-chart-draw");
    restore();
  });

  it("keeps the record visible, without the animation", () => {
    // The ring says "you set a record", which is information. Only the movement goes.
    const restore = withReducedMotion(true);
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 100 }), point({ id: "b", value: 110, isRecord: true })]}
      />,
    );
    const record = container.querySelector("[data-testid='progress-chart-record']")!;
    expect(record).toBeTruthy();
    // No animation anywhere inside it, and the steady ring held at full strength so the
    // mark still reads.
    for (const ring of record.querySelectorAll("circle")) {
      expect(ring.getAttribute("style") ?? "").not.toContain("animation");
    }
    expect([...record.querySelectorAll("circle")].some((c) => c.getAttribute("opacity") === "0.9")).toBe(true);
    restore();
  });

  it("scales the expanding ring about its own centre, not the chart's", () => {
    /*
     * The regression this guards. `transform-box` is not inherited, so a class on the
     * wrapping `<g>` would leave the ring on the default `view-box` and it would slide
     * towards the chart's top-left corner as it grew -- a record near the right edge would
     * visibly travel across the chart on every loop.
     */
    const restore = withReducedMotion(false);
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 100 }), point({ id: "b", value: 110, isRecord: true })]}
      />,
    );
    const record = container.querySelector("[data-testid='progress-chart-record']")!;
    const expanding = [...record.querySelectorAll("circle")].find((c) =>
      (c.getAttribute("style") ?? "").includes("cronos-chart-ring-out"),
    )!;

    expect(expanding).toBeTruthy();
    // On the shape that actually scales, not on its ancestor.
    expect(expanding.getAttribute("class")).toBe("cronos-chart-scalable");
    expect(record.getAttribute("class")).toBeNull();
    restore();
  });

  it("animates when motion is allowed", () => {
    const restore = withReducedMotion(false);
    const { container } = render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a", value: 100 }), point({ id: "b", value: 110 })]}
      />,
    );
    const line = paths(container)[1];
    expect(line.getAttribute("stroke-dashoffset")).toBe("1");
    expect(line.getAttribute("style")).toContain("cronos-chart-draw");
    restore();
  });
});

describe("the accessible description", () => {
  it("reads as direction and endpoints, not as a list of numbers", () => {
    render(
      <ProgressChart
        label="Sentadilla"
        points={[
          point({ id: "a", at: day(0), value: 42 }),
          point({ id: "b", at: day(7), value: 48 }),
          point({ id: "c", at: day(14), value: 51 }),
        ]}
        unit="kg"
      />,
    );
    const label = screen.getByRole("img").getAttribute("aria-label")!;
    expect(label).toContain("Sentadilla");
    expect(label).toContain("42 kg a 51 kg");
    expect(label).toContain("3 sesiones");
    expect(label.endsWith(".")).toBe(true);
  });

  it("uses the singular for one session", () => {
    render(<ProgressChart label="Sentadilla" points={[point({ id: "a", value: 42 })]} unit="kg" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("1 sesión.");
  });

  it("appends the caption", () => {
    render(
      <ProgressChart
        label="Sentadilla"
        points={[point({ id: "a" }), point({ id: "b", value: 110 })]}
        caption="Sube 4 kg por sesión"
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Sube 4 kg por sesión");
    expect(screen.getByText("Sube 4 kg por sesión")).toBeTruthy();
  });
});
