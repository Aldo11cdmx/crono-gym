/**
 * SymmetryRadar.tsx — a collapsible body-symmetry radar chart.
 *
 * Renders a six-axis polygon radar showing the athlete's strongest rank score
 * per major body block (Pecho, Espalda, Hombros, Brazos, Piernas, Core).
 * When the spread between the strongest and weakest block exceeds a threshold
 * the widget surfaces a colour-blind-safe alert naming the imbalanced pair.
 *
 * All colour comes from design tokens. The radar grid is drawn in DIAGRAM
 * neutrals; the value polygon is edged with STATUS.progression so it reads as
 * a training signal, not a second accent.
 */

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Flame } from "lucide-react";
import type { Slug } from "react-muscle-highlighter";
import type { RankMap } from "@/lib/ranks/buildRankMap";
import {
  DIAGRAM,
  GLASS,
  MOTION,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { RANK_LABELS as T } from "@/lib/i18n";

/** The six body blocks the radar visualises, clockwise from top. */
export interface BodyBlock {
  key: string;
  label: string;
  slugs: Slug[];
}

/** Map of anatomy slugs to the six major body blocks. */
export const BODY_BLOCKS: BodyBlock[] = [
  { key: "chest", label: "Pecho", slugs: ["chest" as Slug] },
  {
    key: "back",
    label: "Espalda",
    slugs: ["upper-back" as Slug, "trapezius" as Slug, "lower-back" as Slug],
  },
  { key: "shoulders", label: "Hombros", slugs: ["deltoids" as Slug] },
  {
    key: "arms",
    label: "Brazos",
    slugs: ["biceps" as Slug, "triceps" as Slug, "forearm" as Slug],
  },
  {
    key: "legs",
    label: "Piernas",
    slugs: ["gluteal" as Slug, "quadriceps" as Slug, "hamstring" as Slug, "adductors" as Slug, "calves" as Slug],
  },
  {
    key: "core",
    label: "Core",
    slugs: ["abs" as Slug, "obliques" as Slug],
  },
];

/** Minimum score spread (0-100) before the symmetry alert fires. */
const IMBALANCE_THRESHOLD = 15;

interface SymmetryRadarProps {
  map: RankMap;
  defaultExpanded?: boolean;
}

export function SymmetryRadar({ map, defaultExpanded = false }: SymmetryRadarProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const reducedMotion = useReducedMotion();

  const data = useMemo(() => computeBlockScores(map), [map]);

  const toggle = () => setExpanded((v) => !v);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2
          style={{
            fontSize: TYPE.title2.size,
            lineHeight: TYPE.title2.lineHeight,
            fontWeight: TYPE.title2.weight,
            letterSpacing: TYPE.title2.tracking,
            color: TEXT.primary,
          }}
        >
          {T.symmetryTitle}
        </h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={expanded ? T.symmetryCollapse : T.symmetryExpand}
          className="rounded-lg p-1 outline-none transition"
          style={{
            color: expanded ? TEXT.primary : TEXT.tertiary,
          }}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {data.imbalanceWarning && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border p-3"
              style={{
                backgroundColor: STATUS.warning.muted,
                borderColor: STATUS.warning.border,
              }}
            >
              <Flame className="mt-0.5 h-4 w-4 shrink-0" style={{ color: STATUS.warning.text }} />
              <p
                style={{
                  fontSize: TYPE.caption.size,
                  lineHeight: TYPE.caption.lineHeight,
                  color: STATUS.warning.text,
                }}
              >
                {data.imbalanceWarning}
              </p>
            </div>
          )}

          <RadarChart data={data} reducedMotion={reducedMotion} />
        </div>
      )}
    </section>
  );
}

interface SymmetryBlock {
  key: string;
  label: string;
  score: number;
  rankColor: string;
  muscleLabel: string;
  rankLabel: string;
}

interface SymmetryData {
  blocks: SymmetryBlock[];
  maxScore: number;
  minScore: number;
  spread: number;
  imbalanceWarning: string | null;
}

function computeBlockScores(map: RankMap): SymmetryData {
  const blocks: SymmetryBlock[] = [];

  for (const block of BODY_BLOCKS) {
    let bestScore = 0;
    let rankColor: string = DIAGRAM.inertFill;
    let bestLabel = "";
    let bestRank = "";

    for (const slug of block.slugs) {
      const entry = map.muscles.get(slug);
      if (entry && entry.classified && entry.score > bestScore) {
        bestScore = entry.score;
        rankColor = entry.rank.color;
        bestLabel = entry.label;
        bestRank = entry.rank.label;
      }
    }

    blocks.push({
      key: block.key,
      label: block.label,
      score: Math.round(bestScore),
      rankColor,
      muscleLabel: bestLabel,
      rankLabel: bestRank,
    });
  }

  const scores = blocks.map((b) => b.score);
  const maxScore = Math.max(...scores, 0);
  const minScore = Math.min(...scores);
  const spread = maxScore - minScore;

  let imbalanceWarning: string | null = null;
  if (spread >= IMBALANCE_THRESHOLD) {
    const weakest = blocks.find((b) => b.score === minScore);
    const strongest = blocks.find((b) => b.score === maxScore);
    if (weakest && strongest) {
      imbalanceWarning = T.symmetryImbalance(
        weakest.label,
        weakest.rankLabel || "Sin clasificar",
        strongest.label,
        strongest.rankLabel || "Sin clasificar",
      );
    }
  }

  return {
    blocks,
    maxScore,
    minScore,
    spread,
    imbalanceWarning,
  };
}

function RadarChart({ data, reducedMotion }: { data: SymmetryData; reducedMotion: boolean }) {
  const size = 200;
  const center = size / 2;
  const outerRadius = size / 2 - 24;
  const valueMax = 100;

  const points = data.blocks.map((b, i) => {
    const angle = (Math.PI * 2 * i) / data.blocks.length - Math.PI / 2;
    const r = (b.score / valueMax) * outerRadius;
    const x = center + Math.cos(angle) * r;
    const y = center + Math.sin(angle) * r;
    return { x, y };
  });

  const polygonPoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const animationStyle = reducedMotion
    ? undefined
    : {
        animation: `radar-draw ${MOTION.normal} ${MOTION.easeOut}`,
      };

  return (
    <div
      className="relative mx-auto"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`Radar de simetría: ${data.blocks.map((b) => `${b.label} ${b.score}`).join(", ")}`}
      >
        <g id="radar-grid">
          {[0.25, 0.5, 0.75, 1].map((frac, i) => {
            const r = frac * outerRadius;
            return (
              <polygon
                key={i}
                points={data.blocks
                  .map((_, j) => {
                    const a = (Math.PI * 2 * j) / data.blocks.length - Math.PI / 2;
                    const x = center + Math.cos(a) * r;
                    const y = center + Math.sin(a) * r;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ")}
                fill="none"
                stroke={DIAGRAM.inert}
                strokeWidth="1"
                opacity="0.3"
              />
            );
          })}

          {data.blocks.map((b, i) => {
            const a = (Math.PI * 2 * i) / data.blocks.length - Math.PI / 2;
            const x2 = center + Math.cos(a) * outerRadius;
            const y2 = center + Math.sin(a) * outerRadius;
            return (
              <line
                key={b.key}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke={DIAGRAM.inert}
                strokeWidth="1"
                opacity="0.2"
              />
            );
          })}
        </g>

        <polygon
          points={polygonPoints}
          fill={STATUS.progression.base}
          fillOpacity="0.25"
          stroke={STATUS.progression.base}
          strokeWidth="1.5"
          style={animationStyle}
        />

        {points.map((p, i) => (
          <circle
            key={data.blocks[i].key}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={data.blocks[i].rankColor}
            stroke={GLASS.border}
            strokeWidth="1"
          />
        ))}
      </svg>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ pointerEvents: "none" }}
      >
        <span
          className="tabular-nums"
          style={{
            fontSize: TYPE.display.size,
            lineHeight: TYPE.display.lineHeight,
            fontWeight: TYPE.display.weight,
            color: TEXT.primary,
          }}
        >
          {data.maxScore}
        </span>
        <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          {T.symmetryBalance}
        </span>
      </div>
    </div>
  );
}
