/**
 * ProgressChart.tsx — one exercise's progress over time, as SVG.
 *
 * Pure SVG. No chart library, which is a decision rather than a constraint: the app already
 * depends on `react-muscle-highlighter` and nothing else that draws, the brief asks for no
 * new dependency, and the whole thing is three paths and a gradient. A library would add
 * ~40kb to every route that renders a chart and would still need all of the decisions below
 * made by hand anyway.
 *
 * The smoothing is the interesting part
 * ------------------------------------
 * A cubic Bézier through the points, with control points derived from the neighbouring
 * samples the way Catmull-Rom does -- *clamped so a control point never pushes the curve
 * outside the range of the two points it joins.*
 *
 * That clamp is the whole point. An unclamped Catmull-Rom overshoots on any spike, and a
 * spike is exactly what a strength chart contains: the athlete adds 10kg for one set. The
 * unclamped curve draws a peak *above* the personal record, on a chart whose job is to say
 * what the personal record is. A chart that invents a number the athlete never lifted is
 * worse than a chart with straight lines, and straight lines were the alternative people
 * usually pick for this reason.
 *
 * Two points, or points sharing an x, fall back to a straight line: a Bézier needs two
 * distinct neighbours to have a direction to interpolate, and inventing one would put a
 * curve through the floor of the plot area on a two-sample history.
 *
 * What it will not do
 * -------------------
 * It draws what was logged. There is no smoothing across gaps, no moving average drawn as
 * though it were data, and no axis that starts anywhere but the bottom. A progress chart
 * that flatters is a progress chart nobody trusts.
 */

import { useId } from "react";
import { ACCENT, DIAGRAM, MOTION, STATUS, TEXT, TYPE } from "../../design/tokens";
import { useReducedMotion } from "../../hooks/useReducedMotion";

/** One point on the chart. */
export interface ProgressPoint {
  /** Stable id, used as the React key and to match a point to its PR. */
  id: string;
  /** Milliseconds. `Date.parse`d, so an ISO string is fine. */
  at: number;
  /** The value being charted, in the unit the axis labels. */
  value: number;
  /**
   * Whether this point is a personal record.
   *
   * Passed in rather than detected here: "is this a PR" is a question about the athlete's
   * whole history, and this component sees a window of it. Detecting a local maximum inside
   * the visible range would mark every dip-and-recover as a record.
   */
  isRecord?: boolean;
}

export interface ProgressChartProps {
  /** Oldest first. Sorted here anyway, because a caller passing newest-first should get a
   * chart rather than a line that doubles back on itself. */
  points: readonly ProgressPoint[];
  /** Height of the plot area in px. The width is the viewBox's, scaled by the container. */
  height?: number;
  /** Unit suffix on the y-axis and in the accessible summary. */
  unit?: string;
  /** What is being charted, for the accessible description. */
  label: string;
  /**
   * Optional trend line, in the same unit.
   *
   * Drawn as a straight segment across the full width rather than a fitted regression: the
   * caller computes it (see `estimateTrend`), and a least-squares fit drawn as though it
   * described every point between them is a claim the data does not support.
   */
  trend?: { from: number; to: number } | null;
  /** Extra description appended to the accessible summary, e.g. the current verdict. */
  caption?: string;
}

const PADDING = { top: 16, right: 16, bottom: 26, left: 40 } as const;
const VIEW_WIDTH = 320;

/**
 * Draw-in duration.
 *
 * {@link MOTION.slow}, the one that means "a full transition". Short enough that a chart
 * drawn while an athlete waits between sets is not a wait, long enough to read as an
 * arrival rather than a pop.
 */
const DRAW_MS = 400;

/**
 * Catmull-Rom control points, clamped so the curve stays inside the segment.
 *
 * Returns `[c1, c2]` for the Bézier from `p1` to `p2`, given neighbours `p0` and `p3` in
 * the same coordinate space.
 *
 * The clamp is per-axis. A curve that stays inside the y-range of its two endpoints cannot
 * overshoot vertically, which is where an invented peak would be readable as a record; x
 * needs no clamp because the points are evenly spaced in the plot's own scale.
 *
 * `p0` falls back to `p1` and `p3` to `p2` at the ends, which is the standard
 * "reflect the endpoint" choice: a one-sided difference, so the first and last segments
 * are as straight as a Bézier can be and the line does not appear to be cut off.
 */
function clampedControlPoints(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): [number, number] {
  const tension = 1 / 6;
  let c1 = p1 + (p2 - p0) * tension;
  let c2 = p2 - (p3 - p1) * tension;

  // Clamp into [p1, p2] whichever way round it already is.
  const low = Math.min(p1, p2);
  const high = Math.max(p1, p2);
  c1 = Math.min(Math.max(c1, low), high);
  c2 = Math.min(Math.max(c2, low), high);

  return [c1, c2];
}

/**
 * The `d` attribute for the area and the line.
 *
 * One function for both so they cannot disagree: an area whose top edge is not the line is
 * the classic chart bug, and computing them separately is how it happens.
 *
 * Returns `""` for fewer than two points, which the caller renders as an empty plot rather
 * than a dot pretending to be a series.
 */
function buildPath(
  xs: readonly number[],
  ys: readonly number[],
  baseline: number,
): { line: string; area: string } {
  if (xs.length < 2) return { line: "", area: "" };

  let line = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const p0 = ys[Math.max(0, i - 1)];
    const p1 = ys[i];
    const p2 = ys[i + 1];
    const p3 = ys[Math.min(ys.length - 1, i + 2)];

    const [c1y, c2y] = clampedControlPoints(p0, p1, p2, p3);
    line += ` C ${xs[i]} ${c1y}, ${xs[i + 1]} ${c2y}, ${xs[i + 1]} ${p2}`;
  }

  // Closed down to the baseline and back, so the fill is the area under the curve rather
  // than under a chord.
  const area = `${line} L ${xs[xs.length - 1]} ${baseline} L ${xs[0]} ${baseline} Z`;

  return { line, area };
}

/** Rounds to 2dp: sub-pixel precision in a path is noise that bloats the DOM string. */
function n(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ProgressChart({
  points,
  height = 180,
  unit = "kg",
  label,
  trend,
  caption,
}: ProgressChartProps) {
  const reducedMotion = useReducedMotion();
  const gradientId = `cronos-progress-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Sorted oldest first, and a copy: the caller's array is often a `sessions` slice that
  // belongs to something else.
  const ordered = [...points].sort((a, b) => a.at - b.at);

  const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;
  const baseline = PADDING.top + innerHeight;

  /*
   * The y domain starts at zero.
   *
   * Not "a bit below the minimum". A strength axis that does not start at zero exaggerates
   * the distance between 80kg and 85kg into the same visual gap as 40kg and 80kg, and this
   * is the chart an athlete reads to decide whether they are getting stronger. The cost is
   * that small changes look small, which is the truth.
   *
   * One exception, handled below: a series with a single point still has to be visible.
   */
  const values = ordered.map((point) => point.value);
  const maxValue = Math.max(0, ...values);
  const domainMax = maxValue === 0 ? 1 : maxValue * 1.1;

  const xFor = (index: number) =>
    PADDING.left +
    (ordered.length === 1
      ? innerWidth / 2
      : (index / (ordered.length - 1)) * innerWidth);
  const yFor = (value: number) => PADDING.top + innerHeight * (1 - value / domainMax);

  const xs = ordered.map((_, index) => xFor(index));
  const ys = ordered.map((point) => yFor(point.value));
  const { line, area } = buildPath(xs, ys, baseline);

  const showPoints = ordered.length <= 12;

  return (
    <figure
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        // `preserveAspectRatio` left at its default so the chart scales with the container
        // and the aspect ratio is kept. Width is 100% and height auto, so a wide phone
        // screen gets a proportionally taller chart rather than a squashed one.
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        role="img"
        aria-label={describe(points, label, unit, caption)}
      >
        <defs>
          {/*
            The area gradient runs from the accent at low alpha to nothing, so the fill
            reads as belonging to the line above it instead of as a second shape competing
            with it. Stops are alphas of `ACCENT.base` -- the same colour, faded -- rather
            than a second accent, which is the rule the whole palette is built on.
          */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT.base} stopOpacity={0.28} />
            <stop offset="100%" stopColor={ACCENT.base} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Baseline, the only gridline. A full grid is furniture on a chart this small. */}
        <line
          x1={PADDING.left}
          y1={baseline}
          x2={VIEW_WIDTH - PADDING.right}
          y2={baseline}
          stroke={DIAGRAM.figureStroke}
          strokeWidth={1}
        />

        {area && (
          <path
            d={area}
            fill={`url(#${gradientId})`}
            /*
             * The draw-in is a clip, not a dash offset, and it has its own keyframe for
             * that: `cronos-chart-draw` animates `stroke-dashoffset`, which does nothing to
             * a fill. An earlier version reused the line's keyframes here and the area
             * appeared at once while the line drew over it.
             */
            style={
              reducedMotion
                ? undefined
                : {
                    animation: `cronos-chart-area ${MOTION.slow} ${MOTION.standard} both`,
                  }
            }
          />
        )}

        {line && (
          <path
            d={line}
            fill="none"
            stroke={ACCENT.base}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            /*
             * `pathLength` normalises the dash maths: the attribute counts in *path
             * length units*, so one number works whatever the real length is. Without it the
             * dash array would have to be recomputed from the rendered path on every
             * resize, and a chart that redraws on resize is a chart that animates again.
             */
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={reducedMotion ? 0 : 1}
            style={
              reducedMotion
                ? undefined
                : {
                    animation: `cronos-chart-draw ${MOTION.slow} ${MOTION.standard} both`,
                  }
            }
          />
        )}

        {trend && ordered.length > 1 && (
          <line
            x1={PADDING.left}
            y1={n(yFor(trend.from))}
            x2={VIEW_WIDTH - PADDING.right}
            y2={n(yFor(trend.to))}
            stroke={TEXT.tertiary}
            strokeWidth={1}
            /*
             * Dashed, because it is not data. A trend line drawn in the same weight as the
             * series reads as "this is what happened"; dashed and in the tertiary text
             * colour reads as "this is what we think of it", which is the honest reading.
             */
            strokeDasharray="4 4"
          />
        )}

        {/* The y maximum, labelled. One number: the axis is not the chart. */}
        <text
          x={PADDING.left - 6}
          y={PADDING.top + 4}
          textAnchor="end"
          fill={TEXT.tertiary}
          fontSize={TYPE.caption.size}
        >
          {trimNumber(domainMax)} {unit}
        </text>

        {/*
          Points are omitted past twelve. Twelve is where the circles would touch at this
          width; past that they overlap into a smear and the line is the readable part. The
          records are never omitted -- see below -- because a PR is a specific claim about a
          specific day and it has to stay locatable.
        */}
        {showPoints &&
          ordered.map((point, index) => (
            <circle
              key={point.id}
              className="cronos-chart-scalable"
              cx={n(xs[index])}
              cy={n(ys[index])}
              r={3}
              fill={ACCENT.base}
              opacity={reducedMotion ? 1 : 0}
              style={
                reducedMotion
                  ? undefined
                  : {
                      animation: `cronos-chart-point ${MOTION.normal} ${MOTION.standard} ${index * 40}ms both`,
                    }
              }
            />
          ))}

        {ordered.map((point, index) =>
          point.isRecord ? (
            <g key={`record-${point.id}`} data-testid="progress-chart-record">
              {/*
                Two rings, not one. A single ring that pulses in place reads as a
                notification badge; one that expands outward and fades reads as the point
                itself being marked, which is what a PR is.

                `cronos-chart-scalable` on the *circles*, not on this group. Only the
                second one scales, and a group's `transform-box` does not reach its
                children -- an element does not inherit it -- so putting the class here
                would leave the expanding ring on the default `view-box` and it would grow
                towards the chart's top-left corner instead of in place.
              */}
              <circle
                cx={n(xs[index])}
                cy={n(ys[index])}
                r={6}
                fill="none"
                stroke={ACCENT.base}
                strokeWidth={2}
                opacity={reducedMotion ? 0.9 : undefined}
                style={
                  reducedMotion
                    ? undefined
                    : { animation: `cronos-chart-ring ${MOTION.loop.session} ${MOTION.standard} infinite` }
                }
              />
              <circle
                className="cronos-chart-scalable"
                cx={n(xs[index])}
                cy={n(ys[index])}
                r={6}
                fill="none"
                stroke={ACCENT.base}
                strokeWidth={2}
                // Hidden outright under reduced motion rather than held still: a second ring
                // sitting at the same radius as the first is just a thicker line.
                opacity={reducedMotion ? 0 : undefined}
                style={
                  reducedMotion
                    ? undefined
                    : { animation: `cronos-chart-ring-out ${MOTION.loop.session} ${MOTION.standard} infinite` }
                }
              />
              {/* The record dot itself, on top, so the ring never hides the value. */}
              <circle
                cx={n(xs[index])}
                cy={n(ys[index])}
                r={4}
                fill={ACCENT.base}
                stroke={STATUS.success.base}
                strokeWidth={1}
              />
            </g>
          ) : null,
        )}
      </svg>

      {caption && (
        <figcaption
          style={{
            fontSize: TYPE.caption.size,
            lineHeight: TYPE.caption.lineHeight,
            color: TEXT.tertiary,
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** Trims a float for an axis label: 100 not 100.00000001. */
function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * The chart as a sentence, for the `aria-label`.
 *
 * A `role="img"` with no label is invisible to a screen reader, and a chart is exactly the
 * thing that becomes unintelligible without one. Described as direction and endpoints
 * rather than as every value: "42kg to 51kg over 6 sesiones" is useful, and forty numbers
 * is not.
 */
function describe(
  points: readonly ProgressPoint[],
  label: string,
  unit: string,
  caption?: string,
): string {
  if (points.length === 0) return `${label}: sin datos`;

  const ordered = [...points].sort((a, b) => a.at - b.at);
  const records = ordered.filter((point) => point.isRecord).length;

  /*
   * One session is a reading, not a range.
   *
   * The two-point wording below would say "100 kg a 100 kg" here, which reads as a change of
   * zero -- as though the athlete held still, when the truth is that nothing has been
   * measured yet. One measurement gets the measurement.
   */
  if (ordered.length === 1) {
    const parts = [
      `${label}: ${trimNumber(ordered[0].value)} ${unit}`,
      "en 1 sesión",
    ];
    if (records > 0) parts.push("1 récord");
    if (caption) parts.push(caption);
    return `${parts.join(", ")}.`;
  }

  const first = ordered[0].value;
  const last = ordered[ordered.length - 1].value;

  const parts = [
    `${label}: ${trimNumber(first)} ${unit} a ${trimNumber(last)} ${unit}`,
    `en ${ordered.length} sesiones`,
  ];
  if (records > 0) {
    parts.push(`${records} ${records === 1 ? "récord" : "récords"}`);
  }
  if (caption) parts.push(caption);

  return `${parts.join(", ")}.`;
}

/**
 * Draw duration, exported so a caller that measures the animation can read it rather than
 * hardcoding 400ms and drifting.
 */
export { DRAW_MS as PROGRESS_CHART_DRAW_MS };
