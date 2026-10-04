/**
 * ComparisonChart.tsx — two periods on one axis, so they can be compared directly.
 *
 * Same drawing rules as `ProgressChart` and for the same reasons, but the chart answers a
 * different question. A progress chart shows one thing over time; this shows "this block
 * against the last one", which is the question an athlete actually asks when comparing
 * programs or coming back from a break.
 *
 * The one thing that matters here
 * ------------------------------
 * Both series are indexed **by session, not by date**, and both axes are shared.
 *
 * Two sessions a week apart and two sessions three weeks apart are different stories, and a
 * shared *date* axis turns the first into a long flat line and the second into a
 * compressed one -- so the visual comparison no longer matches the real one. Indexing by
 * session means "session 1 to 4" lines up with "session 1 to 4" and the vertical distance
 * between the lines is the actual difference in training.
 *
 * The consequence is that the x axis is *not* a calendar and the chart must not imply it
 * is: there are no date labels, only session counts, and the accessible description says
 * "sesiones" rather than naming a month.
 */

import { useId } from "react";
import { ACCENT, DIAGRAM, MOTION, TEXT, TYPE } from "../../design/tokens";
import { useReducedMotion } from "../../hooks/useReducedMotion";

/** One session's reading in a period. */
export interface ComparisonSeries {
  /** Stable id. */
  id: string;
  /** The reading, in the unit the axis labels. */
  value: number;
}

export interface ComparisonChartProps {
  /** The period being compared against. Grey, and behind. */
  previous: readonly ComparisonSeries[];
  /** The period being judged. Accent, and in front. */
  current: readonly ComparisonSeries[];
  unit?: string;
  /** What is being compared, for the accessible description. */
  label: string;
  height?: number;
}

const PADDING = { top: 16, right: 16, bottom: 26, left: 40 } as const;
const VIEW_WIDTH = 320;

/**
 * The grey for the earlier period.
 *
 * `DIAGRAM.figureStroke` rather than a new token: it is already the "a drawn line on this
 * surface" colour, it is already contrast-checked against `SURFACE.base`, and a fourth
 * grey invented here would be exactly the drift the Block D guards exist to stop.
 */
const PREVIOUS_STROKE = DIAGRAM.figureStroke;

/** Straight segments. See below. */
function buildLine(xs: readonly number[], ys: readonly number[]): string {
  if (xs.length === 0) return "";
  if (xs.length === 1) return `M ${xs[0]} ${ys[0]}`;

  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i += 1) {
    d += ` L ${xs[i]} ${ys[i]}`;
  }
  return d;
}

function n(value: number): number {
  return Math.round(value * 100) / 100;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function ComparisonChart({
  previous,
  current,
  unit = "kg",
  label,
  height = 160,
}: ComparisonChartProps) {
  const reducedMotion = useReducedMotion();
  const gradientId = `cronos-compare-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  /*
   * Shared domain across both periods.
   *
   * Not per-series. Two charts with two scales would make the gap between the lines mean
   * nothing, which is the only thing this chart is for -- and it is the failure that makes
   * a comparison chart worse than no chart.
   */
  const all = [...previous, ...current].map((point) => point.value);
  const maxValue = Math.max(0, ...all);
  const domainMax = maxValue === 0 ? 1 : maxValue * 1.1;

  const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;
  const baseline = PADDING.top + innerHeight;

  /**
   * x is indexed by session *position*, so the two series share a scale even when the
   * periods are a different length. A series shorter than the longest is padded by leaving
   * its line short -- not extended, not extrapolated.
   */
  const longest = Math.max(previous.length, current.length, 2);
  const xFor = (index: number) => PADDING.left + (index / (longest - 1)) * innerWidth;
  const yFor = (value: number) => PADDING.top + innerHeight * (1 - value / domainMax);

  const previousXs = previous.map((_, i) => xFor(i));
  const previousYs = previous.map((point) => yFor(point.value));
  const currentXs = current.map((_, i) => xFor(i));
  const currentYs = current.map((point) => yFor(point.value));

  const previousPath = buildLine(previousXs, previousYs);
  const currentPath = buildLine(currentXs, currentYs);

  const delta = mean(current.map((p) => p.value)) - mean(previous.map((p) => p.value));

  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        role="img"
        aria-label={describe(previous, current, label, unit, delta)}
      >
        <defs>
          {/* Only the current period is filled. Filling both would make two translucent
              shapes overlap and the intersection read as a third, unaccounted value. */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT.base} stopOpacity={0.24} />
            <stop offset="100%" stopColor={ACCENT.base} stopOpacity={0} />
          </linearGradient>
        </defs>

        <line
          x1={PADDING.left}
          y1={baseline}
          x2={VIEW_WIDTH - PADDING.right}
          y2={baseline}
          stroke={DIAGRAM.figureStroke}
          strokeWidth={1}
        />

        {/* Previous, first: it is the background and the current line draws over it. */}
        {previousPath && (
          <path
            d={previousPath}
            fill="none"
            stroke={PREVIOUS_STROKE}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={reducedMotion ? 0 : 1}
            style={
              reducedMotion
                ? undefined
                : { animation: `cronos-chart-draw ${MOTION.slow} ${MOTION.standard} both` }
            }
          />
        )}

        {currentPath && current.length > 1 && (
          <path
            d={`${currentPath} L ${n(currentXs[currentXs.length - 1])} ${n(baseline)} L ${n(currentXs[0])} ${n(baseline)} Z`}
            fill={`url(#${gradientId})`}
            style={
              reducedMotion
                ? undefined
                : { animation: `cronos-chart-area ${MOTION.slow} ${MOTION.standard} both` }
            }
          />
        )}

        {currentPath && (
          <path
            d={currentPath}
            fill="none"
            stroke={ACCENT.base}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={reducedMotion ? 0 : 1}
            style={
              reducedMotion
                ? undefined
                : { animation: `cronos-chart-draw ${MOTION.slow} ${MOTION.standard} both` }
            }
          />
        )}

        {/* Session-count ticks rather than dates. The axis is not a calendar. */}
        {Array.from({ length: longest }, (_, index) => (
          <text
            key={index}
            x={n(xFor(index))}
            y={height - 8}
            textAnchor="middle"
            fill={TEXT.tertiary}
            fontSize={TYPE.caption.size}
          >
            {index + 1}
          </text>
        ))}

        <text
          x={PADDING.left - 6}
          y={PADDING.top + 4}
          textAnchor="end"
          fill={TEXT.tertiary}
          fontSize={TYPE.caption.size}
        >
          {trimNumber(domainMax)}
        </text>

        {/* End dots, so the last reading of each period is locatable without a label. */}
        {previous.length > 0 && (
          <circle
            cx={n(previousXs[previousXs.length - 1])}
            cy={n(previousYs[previousYs.length - 1])}
            r={3}
            fill={PREVIOUS_STROKE}
          />
        )}
        {current.length > 0 && (
          <circle
            cx={n(currentXs[currentXs.length - 1])}
            cy={n(currentYs[currentYs.length - 1])}
            r={3}
            fill={ACCENT.base}
          />
        )}
      </svg>

      {/* The legend doubles as the delta, because the delta is the reason to look. */}
      <figcaption
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: TYPE.caption.size,
          lineHeight: TYPE.caption.lineHeight,
          color: TEXT.tertiary,
          flexWrap: "wrap",
        }}
      >
        {/*
         * A key only for a period that is actually drawn.
         *
         * With no previous period there is no grey line on the chart, and a legend that
         * still names "Anterior" points at nothing -- the reader looks for a line that is
         * not there and concludes the chart is broken. An empty period is a real state
         * (first block, or a gap in the data) and it is better shown by its absence.
         */}
        {previous.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 2,
                backgroundColor: PREVIOUS_STROKE,
                borderRadius: 1,
              }}
            />
            Anterior
          </span>
        )}
        {current.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden="true"
              style={{ width: 12, height: 2, backgroundColor: ACCENT.base, borderRadius: 1 }}
            />
            Actual
          </span>
        )}
        {delta !== null && Number.isFinite(delta) && Math.abs(delta) > 0.05 && (
          <span style={{ color: ACCENT.text }}>
            {delta > 0 ? "+" : ""}
            {trimNumber(Math.round(delta * 10) / 10)} {unit}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * The comparison as a sentence.
 *
 * Says "periodo anterior" and "periodo actual" rather than naming weeks, because the x
 * axis is sessions and a date here would imply a time scale the chart does not have.
 */
function describe(
  previous: readonly ComparisonSeries[],
  current: readonly ComparisonSeries[],
  label: string,
  unit: string,
  delta: number,
): string {
  if (previous.length === 0 && current.length === 0) return `${label}: sin datos`;

  const previousMean = mean(previous.map((p) => p.value));
  const currentMean = mean(current.map((p) => p.value));

  const parts: string[] = [label];
  if (Number.isFinite(previousMean)) {
    parts.push(`periodo anterior ${trimNumber(Math.round(previousMean * 10) / 10)} ${unit}`);
  }
  if (Number.isFinite(currentMean)) {
    parts.push(`periodo actual ${trimNumber(Math.round(currentMean * 10) / 10)} ${unit}`);
  }
  if (Number.isFinite(delta) && Math.abs(delta) > 0.05) {
    parts.push(`${delta > 0 ? "sube" : "baja"} ${trimNumber(Math.abs(Math.round(delta * 10) / 10))} ${unit}`);
  }

  return `${parts.join(", ")}.`;
}
