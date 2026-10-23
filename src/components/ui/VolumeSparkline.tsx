/**
 * VolumeSparkline.tsx — the shape of the last seven days' volume.
 *
 * A single polyline, no axis and no grid: it is a trend shape, and a
 * trend shape is the smallest thing worth drawing. The number beside it
 * owns the magnitude and the delta owns the direction; this owns the
 * shape, which neither of them can say. Warm-up sets are excluded
 * upstream and rest days are zero-filled, so the line is a continuous
 * baseline rather than a broken one.
 *
 * Deliberately not animated. A shimmer belongs to a placeholder, not
 * to a number that has already arrived.
 */

import { ACCENT } from "@/design/tokens";

/** The only field a trend shape needs. Structural, so this stays a
 *  presentational component and not a dashboard-model dependency. */
export interface VolumeSparklinePoint {
  volumeKg: number;
}

const WIDTH = 60;
const HEIGHT = 32;
const PADDING = 4;

export function VolumeSparkline({
  points,
}: {
  points: readonly VolumeSparklinePoint[];
}) {
  // `1` as the floor keeps a flat, empty week from dividing by zero;
  // a zero baseline draws as a flat line, which is what it is.
  const max = Math.max(...points.map((point) => point.volumeKg), 1);
  const stepX = (WIDTH - PADDING * 2) / Math.max(points.length - 1, 1);

  const path = points
    .map((point, index) => {
      const x = PADDING + index * stepX;
      const y =
        HEIGHT - PADDING - (point.volumeKg / max) * (HEIGHT - PADDING * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Tendencia de volumen de los últimos 7 días"
      style={{ overflow: "visible", display: "block" }}
    >
      <polyline
        points={path}
        fill="none"
        stroke={ACCENT.text}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
