/**
 * StreakAndVolumeWidget.tsx — the small top-left metrics card.
 *
 * Shows the daily streak, weekly streak, and a 7-day volume sparkline rendered
 * as pure inline SVG (no chart library dependency — see `ProgressChart` precedent).
 */

import { DashboardCard } from "./DashboardCard";
import { formatDelta, formatNumber } from "@/lib/dashboard/formatters";
import type { StreakStats, VolumeTrendResult } from "@/lib/dashboard/dashboardMetrics";
import { ACCENT, MOTION, STATUS, TEXT, TYPE } from "@/design/tokens";
import { useReducedMotion as useReducedMotionHook } from "@/hooks/useReducedMotion";

export interface StreakAndVolumeWidgetProps {
  loading?: boolean;
  streak: StreakStats | null;
  volume: VolumeTrendResult | null;
  /** Display unit: "metric" (kg) or "imperial" (lb). */
  unit?: "metric" | "imperial";
}

/**
 * Inline SVG sparkline: a single polyline over a transparent background.
 *
 * No axis labels, no grid, no tooltip — the card to its right (or the trend
 * detail) owns semantics. This is a trend *shape*, and a trend shape is
 * biggest-worth-least, so it stays 60×32 and never competes for attention.
 */
function VolumeSparkline({ points }: { points: VolumeTrendResult["points"] }) {
  const reduced = useReducedMotionHook();

  const width = 60;
  const height = 32;
  const padding = 4;

  const max = Math.max(...points.map((p) => p.volumeKg), 1);
  const stepX = (width - padding * 2) / Math.max(points.length - 1, 1);

  const path = points
    .map((p, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (p.volumeKg / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{
        overflow: "visible",
      }}
    >
      <polyline
        points={path}
        fill="none"
        stroke={ACCENT.text}
        strokeWidth={reduced ? 1 : 1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={
          reduced
            ? undefined
            : {
                animation: `${MOTION.loop.skeleton} ${MOTION.standard} infinite`,
                transformOrigin: "center",
              }
        }
      />
    </svg>
  );
}

export function StreakAndVolumeWidget({
  loading = false,
  streak,
  volume,
  unit = "metric",
}: StreakAndVolumeWidgetProps) {
  if (loading || !streak || !volume) {
    return (
      <DashboardCard title="Racha" loading>
        <></>
      </DashboardCard>
    );
  }

  const delta = formatDelta(volume.deltaPct);
  const deltaColor: string =
    volume.deltaPct === null
      ? TEXT.tertiary
      : volume.deltaPct >= 0
        ? STATUS.progression.text
        : STATUS.error.text;

  const unitLabel = unit === "imperial" ? "lb" : "kg";

  return (
    <DashboardCard title="Racha">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Streak numbers */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: TYPE.mono.size,
                fontWeight: TYPE.mono.weight,
                color: ACCENT.base,
              }}
            >
              {streak.currentDays}d
            </div>
            <div style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
              Diario
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: TYPE.mono.size,
                fontWeight: TYPE.mono.weight,
                color: ACCENT.base,
              }}
            >
              {streak.currentWeeks}w
            </div>
            <div style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
              Semanal
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: TYPE.mono.size,
                fontWeight: TYPE.mono.weight,
                color: TEXT.primary,
              }}
            >
              {streak.longestWeeks}w
            </div>
            <div style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
              Récord
            </div>
          </div>

          {streak.trainedToday && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: TYPE.caption.size,
                color: STATUS.success.text,
              }}
            >
              ✓ Hoy
            </div>
          )}
        </div>

        {/* Volume sparkline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <VolumeSparkline points={volume.points} />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div
              style={{
                fontSize: TYPE.mono.size,
                fontWeight: TYPE.mono.weight,
                color: TEXT.primary,
              }}
            >
              {formatNumber(volume.points[volume.points.length - 1]?.volumeKg ?? 0)}{" "}
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                {unitLabel}
              </span>
            </div>
            <div
              style={{
                fontSize: TYPE.caption.size,
                color: deltaColor,
              }}
            >
              {delta}
            </div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
