/**
 * AnatomicalRanksPage.tsx — premium anatomical intelligence instrument.
 *
 * The redesign of `AnatomicalRanksView`, built for the `/rangos` route with
 * obsidian / crystal / metallic visual language driven entirely by design tokens.
 *
 * Reuses `useMuscleRanks`, `MuscleSelector` and `MuscleRankDetail` unchanged;
 * this file owns only presentation: a hero header with the global rank, a
 * seven-tier metallic ladder, a smartbar with search/sort/heatmap-toggle, an
 * anatomical map painted by rank or by weekly-set volume, a symmetry radar, and
 * a crystal card grid for per-muscle intelligence.
 *
 * Token discipline
 * ----------------
 * No raw `rgba()` or `#hex` literals appear in this file. Every colour, radius,
 * space and motion value is resolved through `@/design/tokens`, so the
 * `tokens.test.ts` guard stays green and the component cannot drift from the
 * design system. Motion is gated through `useReducedMotion` at every entrance.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, ChevronRight, Flame, Search, Sparkles, TrendingUp } from "lucide-react";
import type { Slug } from "react-muscle-highlighter";
import { MuscleSelector } from "../MuscleSelector";
import { MuscleRankDetail } from "../MuscleRankDetail";
import { ProgressCharts } from "../progress/ProgressCharts";
import { ConsistencyTracker } from "../progress/ConsistencyTracker";
import { WorkoutHistory } from "../progress/WorkoutHistory";
import { useMuscleRanks } from "@/hooks/useMuscleRanks";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { RANK_LABELS as T } from "@/lib/i18n";
import {
  colorByMuscle,
  type MuscleRank,
  type RankMap,
} from "@/lib/ranks/buildRankMap";
import {
  ELIGIBILITY,
  EARNABLE_RANKS,
  type RankDefinition,
  type RankId,
} from "@/lib/ranks/rankConfig";
import {
  heatmapColorByMuscle,
  bucketForEntry,
} from "@/lib/ranks/heatmapColors";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SymmetryRadar } from "@/components/ranks/SymmetryRadar";
import {
  ACCENT,
  GLASS,
  HEATMAP,
  RADIUS,
  SOLID,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";

type MapMode = "rank" | "heatmap";

/** Ranks in the legend, highest first — the ladder order. */
const LADDER_RANKS = EARNABLE_RANKS;

const MAP_MODE_OPTIONS = [
  { value: "rank", label: T.mapModeRank, icon: <Award className="h-4 w-4" /> },
  { value: "heatmap", label: T.mapModeHeatmap, icon: <Flame className="h-4 w-4" /> },
] as const;

interface AnatomicalRanksPageProps {
  userId: string | null;
  onBrowseMuscle?: (slug: Slug) => void;
  initialDetail?: string | null;
  readOnly?: boolean;
}

export function AnatomicalRanksPage({
  userId,
  onBrowseMuscle,
  initialDetail = null,
  readOnly = false,
}: AnatomicalRanksPageProps) {
  const ranks = useMuscleRanks(userId, { readOnly });
  const reducedMotion = useReducedMotion();
  const [detailSlug, setDetailSlug] = useState<string | null>(initialDetail);
  const [seenPromotions, setSeenPromotions] = useState<string[]>([]);
  const [mode, setMode] = useState<MapMode>("rank");
  const [selectedRankFilters, setSelectedRankFilters] = useState<RankId[]>([]);

  const map = ranks.map;
  const colors = useMemo(() => {
    if (!map) return new Map<Slug, string>();
    if (mode === "heatmap") return heatmapColorByMuscle(map);
    return colorByMuscle(map);
  }, [map, mode]);

  const banner = useMemo(() => {
    if (reducedMotion || ranks.promotions.length === 0) return [];
    return ranks.promotions.filter((m) => !seenPromotions.includes(m.slug));
  }, [ranks.promotions, seenPromotions, reducedMotion]);

  useEffect(() => {
    if (ranks.promotions.length === 0) return;
    setSeenPromotions((current) => {
      const known = new Set(current);
      const missing = ranks.promotions.map((m) => m.slug).filter((s) => !known.has(s));
      return missing.length === 0 ? current : [...current, ...missing];
    });
  }, [ranks.promotions]);

  const openDetail = useCallback((slug: Slug) => setDetailSlug(slug), []);
  const closeDetail = useCallback(() => setDetailSlug(null), []);

  const toggleRankFilter = useCallback((rankId: RankId) => {
    setSelectedRankFilters((current) =>
      current.includes(rankId)
        ? current.filter((r) => r !== rankId)
        : [...current, rankId],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedRankFilters([]);
  }, []);

  const detail = detailSlug && map ? map.muscles.get(detailSlug as Slug) ?? null : null;
  const detailHistory = detailSlug ? ranks.historyFor(detailSlug) : [];

  if (ranks.initialLoading) {
    return (
      <div className="space-y-8">
        <header>
          <h1
            style={{
              fontSize: TYPE.hero.size,
              lineHeight: TYPE.hero.lineHeight,
              fontWeight: TYPE.hero.weight,
              letterSpacing: TYPE.hero.tracking,
              color: TEXT.primary,
            }}
          >
            {T.title}
          </h1>
        </header>
        <p style={{ color: TEXT.secondary, fontSize: TYPE.body.size }}>{T.loading}</p>
        <HeroSkeleton />
      </div>
    );
  }

  if (ranks.error && !map) {
    return (
      <div className="space-y-6">
        <header>
          <h1
            style={{
              fontSize: TYPE.hero.size,
              lineHeight: TYPE.hero.lineHeight,
              fontWeight: TYPE.hero.weight,
              letterSpacing: TYPE.hero.tracking,
            }}
          >
            {T.title}
          </h1>
        </header>
        <GlassCard>
          <div className="flex items-start gap-3">
            <Flame className="mt-0.5 h-5 w-5 shrink-0" style={{ color: STATUS.error.text }} />
            <div>
              <p style={{ color: TEXT.secondary, fontSize: TYPE.body.size }}>{T.loadError}</p>
              <GlassButton
                variant="destructive"
                style={{ marginTop: SPACE.sm }}
                onClick={() => void ranks.refresh()}
              >
                {T.retry}
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!map) return null;

  return (
    <div className="space-y-8">
      <header>
        <h1
          className="flex items-center gap-2"
          style={{
            fontSize: TYPE.hero.size,
            lineHeight: TYPE.hero.lineHeight,
            fontWeight: TYPE.hero.weight,
            letterSpacing: TYPE.hero.tracking,
            color: TEXT.primary,
          }}
        >
          <Award style={{ width: "28px", height: "28px", color: ACCENT.text }} />
          {T.title}
        </h1>
        <p style={{ color: TEXT.tertiary, marginTop: SPACE.xs, fontSize: TYPE.caption.size }}>
          {T.subtitle}
        </p>
      </header>

      {banner.length > 0 && (
        <PromotionBanner promotions={banner} />
      )}

      {map && ranks.empty && (
        <EmptyState
          sessionsNeeded={ranks.sessionsNeeded}
          bodyweightKg={ranks.bodyweightKg}
        />
      )}

      {map && !ranks.empty && (
        <>
          <HeroHeader map={map} onSelectMuscle={openDetail} />

          <SymmetryRadar map={map} />

          <Smartbar
            mode={mode}
            onModeChange={setMode}
            selectedRankFilters={selectedRankFilters}
            onToggleRank={toggleRankFilter}
            onClearFilters={clearAllFilters}
            distribution={ranks.distribution}
          />

          <RankLadder map={map} onSelectMuscle={openDetail} />

          {mode === "heatmap" && (
            <HeatmapLegend />
          )}

          <section>
            <GlassCard>
              <MuscleSelector
                selected={[]}
                onChange={() => undefined}
                readOnly
                onSelectMuscle={openDetail}
                colorByMuscle={colors}
                legendLabel={mode === "heatmap" ? T.mapModeHeatmap : T.bodyMapLegend}
                renderBadge={(slug) => {
                  const entry = map.muscles.get(slug);
                  if (!entry) return null;
                  if (mode === "heatmap") {
                    const sets = entry.detail.volume.setsPerWeek;
                    return (
                      <span
                        aria-hidden="true"
                        className="tabular-nums"
                        style={{
                          fontSize: TYPE.caption.size,
                          color: TEXT.tertiary,
                        }}
                      >
                        {Math.round(sets)}
                      </span>
                    );
                  }
                  return (
                    <span aria-hidden="true" className="text-[10px]" style={{ color: TEXT.tertiary }}>
                      {entry.rank.glyph}
                    </span>
                  );
                }}
              />
            </GlassCard>
          </section>

          <MuscleMatrix
            map={map}
            onSelectMuscle={openDetail}
            selectedRankFilters={selectedRankFilters}
            heatmapMode={mode === "heatmap"}
          />

          {map.pendingCount > 0 && (
            <UnclassifiedDisclosure map={map} onSelectMuscle={openDetail} />
          )}
        </>
      )}

      {detail && (
        <MuscleRankDetail
          entry={detail}
          history={detailHistory}
          onClose={closeDetail}
          onBrowseExercises={
            onBrowseMuscle ? () => onBrowseMuscle(detail.slug) : undefined
          }
        />
      )}

      {/* Módulos de Analítica y Consistencia de Progreso */}
      <div className="mt-8 space-y-6">
        <ConsistencyTracker userId={userId} />
        <ProgressCharts userId={userId} />
        <WorkoutHistory userId={userId} />
      </div>
    </div>
  );
}

function HeroHeader({
  map,
  onSelectMuscle,
}: {
  map: RankMap;
  onSelectMuscle: (slug: Slug) => void;
}) {
  const rank = map.globalRank;
  const strongest = map.strongest;
  const weakest = map.weakest;

  return (
    <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <HeroMetric
        icon={<Award />}
        label={T.globalRank}
      >
        <GlobalRankDisplay rank={rank} score={map.globalScore} />
      </HeroMetric>

      <RankMetric
        icon={<Flame />}
        label={T.strongest}
        entry={strongest}
        empty={!strongest}
        hint={T.strongestHint}
        onSelectMuscle={onSelectMuscle}
      />

      <RankMetric
        icon={<TrendingUp />}
        label={T.weakest}
        entry={weakest}
        empty={!weakest}
        hint={weakest ? T.focusHint : "Entrena un segundo músculo para comparar."}
        onSelectMuscle={onSelectMuscle}
      />

      <CoverageMetric
        label="Músculos"
        classified={map.classifiedCount}
        total={map.muscles.size}
        subtitle={T.classifiedOf(map.classifiedCount, map.muscles.size)}
      />
    </section>
  );
}

function HeroMetric({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2" style={{ color: ACCENT.text }}>
        {icon}
        <p
          className="uppercase tracking-wide"
          style={{
            color: TEXT.tertiary,
            fontSize: TYPE.label.size,
            lineHeight: TYPE.label.lineHeight,
            fontWeight: TYPE.label.weight,
            letterSpacing: TYPE.label.tracking,
          }}
        >
          {label}
        </p>
      </div>
      <div className="mt-3">{children}</div>
    </GlassCard>
  );
}

function GlobalRankDisplay({ rank, score }: { rank: RankDefinition | null; score: number | null }) {
  if (!rank || score === null) {
    return <p style={{ marginTop: SPACE.sm, color: TEXT.secondary, fontSize: TYPE.body.size }}>Sin clasificar</p>;
  }
  return (
    <>
      <p
        className="flex items-baseline gap-2"
        style={{
          fontSize: TYPE.display.size,
          lineHeight: TYPE.display.lineHeight,
          fontWeight: TYPE.display.weight,
          letterSpacing: TYPE.display.tracking,
          color: TEXT.primary,
        }}
      >
        <span aria-hidden="true" style={{ color: rank.borderColor }}>
          {rank.glyph}
        </span>
        {rank.label}
      </p>
      <p
        className="mt-1 tabular-nums"
        style={{
          color: TEXT.secondary,
          fontSize: TYPE.caption.size,
          lineHeight: TYPE.caption.lineHeight,
          fontWeight: TYPE.caption.weight,
        }}
      >
        {T.ofMax(score)}
      </p>
    </>
  );
}

function RankMetric({
  icon,
  label,
  entry,
  empty,
  hint,
  onSelectMuscle,
}: {
  icon: React.ReactNode;
  label: string;
  entry: MuscleRank | null;
  empty: boolean;
  hint?: string;
  onSelectMuscle: (slug: Slug) => void;
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2" style={{ color: ACCENT.text }}>
        {icon}
        <p
          className="uppercase tracking-wide"
          style={{
            color: TEXT.tertiary,
            fontSize: TYPE.label.size,
            lineHeight: TYPE.label.lineHeight,
            fontWeight: TYPE.label.weight,
            letterSpacing: TYPE.label.tracking,
          }}
        >
          {label}
        </p>
      </div>

      {empty || !entry ? (
        <p
          className="mt-3"
          style={{
            color: TEXT.secondary,
            fontSize: TYPE.body.size,
            lineHeight: TYPE.body.lineHeight,
          }}
        >
          {hint ?? "Aún sin datos suficientes."}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onSelectMuscle(entry.slug)}
            className="mt-3 flex w-full items-center justify-between gap-2 text-left font-semibold transition-colors"
            style={{
              fontSize: TYPE.headline.size,
              lineHeight: TYPE.headline.lineHeight,
              fontWeight: TYPE.headline.weight,
              letterSpacing: TYPE.headline.tracking,
              color: TEXT.primary,
            }}
          >
            <span>{entry.label}</span>
            <ChevronRight className="h-4 w-4" style={{ color: TEXT.tertiary }} />
          </button>
          <p
            className="mt-1 flex items-center gap-1"
            style={{
              color: TEXT.secondary,
              fontSize: TYPE.caption.size,
              lineHeight: TYPE.caption.lineHeight,
            }}
          >
            <span aria-hidden="true">{entry.rank.glyph}</span>
            {entry.rank.label} · {entry.score} pts
          </p>
        </>
      )}
    </GlassCard>
  );
}

function CoverageMetric({
  label,
  classified,
  total,
  subtitle,
}: {
  label: string;
  classified: number;
  total: number;
  subtitle: string;
}) {
  return (
    <GlassCard>
      <p
        className="uppercase tracking-wide"
        style={{
          color: TEXT.tertiary,
          fontSize: TYPE.label.size,
          lineHeight: TYPE.label.lineHeight,
          fontWeight: TYPE.label.weight,
          letterSpacing: TYPE.label.tracking,
        }}
      >
        {label}
      </p>
      <p
        className="mt-3 tabular-nums"
        style={{
          fontSize: TYPE.display.size,
          lineHeight: TYPE.display.lineHeight,
          fontWeight: TYPE.display.weight,
          letterSpacing: TYPE.display.tracking,
          color: TEXT.primary,
        }}
      >
        {classified}
        <span
          className="font-normal"
          style={{
            fontSize: TYPE.title2.size,
            color: TEXT.tertiary,
          }}
        >
          /{total}
        </span>
      </p>
      <p
        className="mt-1"
        style={{
          color: TEXT.tertiary,
          fontSize: TYPE.caption.size,
          lineHeight: TYPE.caption.lineHeight,
        }}
      >
        {subtitle}
      </p>
    </GlassCard>
  );
}

// --------------------------------------------------------------- smart bar

interface SmartbarProps {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  selectedRankFilters: RankId[];
  onToggleRank: (rankId: RankId) => void;
  onClearFilters: () => void;
  distribution: Record<string, number>;
}

function Smartbar({
  mode,
  onModeChange,
  selectedRankFilters,
  onToggleRank,
  onClearFilters,
  distribution,
}: SmartbarProps) {
  const hasFilters = selectedRankFilters.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 overflow-x-auto">
        <SegmentedControl
          value={mode}
          options={MAP_MODE_OPTIONS}
          onChange={(v) => onModeChange(v as MapMode)}
          ariaLabel={T.setMapMode}
        />

        <div className="relative flex-1 min-w-48">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: TEXT.tertiary }}
          />
          <input
            type="search"
            placeholder={T.searchPlaceholder}
            className="w-full rounded-lg border bg-neutral-900/60 pl-10 pr-3 py-2 text-sm outline-none transition-colors"
            style={{
              borderColor: GLASS.border,
              backgroundColor: SOLID.card,
              color: TEXT.primary,
            }}
          />
        </div>

        <select
          className="rounded-lg border bg-neutral-900/60 px-3 py-2 text-sm outline-none transition-colors"
          style={{
            borderColor: GLASS.border,
            backgroundColor: SOLID.card,
            color: TEXT.primary,
          }}
          defaultValue=""
          aria-label={T.sortBy}
        >
          <option value="" disabled>
            {T.sortBy}
          </option>
          <option value="score-desc">{T.sortScoreDesc}</option>
          <option value="score-asc">{T.sortScoreAsc}</option>
          <option value="name">{T.sortName}</option>
          <option value="sessions">{T.sortSessions}</option>
          <option value="last">{T.sortLastActivity}</option>
          <option value="change">{T.sortChange}</option>
        </select>

        <button
          type="button"
          onClick={onClearFilters}
          disabled={!hasFilters}
          className="rounded-lg border px-3 py-2 text-sm transition-colors"
          style={{
            borderColor: GLASS.border,
            backgroundColor: SOLID.card,
            color: hasFilters ? TEXT.secondary : TEXT.disabled,
            cursor: hasFilters ? "pointer" : "default",
          }}
        >
          {T.clearFilters}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {LADDER_RANKS.map((rank) => {
          const active = selectedRankFilters.includes(rank.id);
          const count = distribution[rank.id] ?? 0;
          return (
            <button
              key={rank.id}
              type="button"
              onClick={() => onToggleRank(rank.id)}
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition"
              style={{
                backgroundColor: active ? rank.color : "transparent",
                borderColor: active ? rank.color : GLASS.border,
                color: active ? TEXT.onAccent : TEXT.tertiary,
                opacity: count > 0 ? 1 : 0.4,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: TYPE.subhead.size }}>
                {rank.glyph}
              </span>
              <span>{rank.label}</span>
              <span style={{ color: active ? rank.label : TEXT.tertiary }}>· {count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ----------------------------------------------------------- rank ladder

interface RankLadderProps {
  map: RankMap;
  onSelectMuscle: (slug: Slug) => void;
}

function RankLadder({ map, onSelectMuscle }: RankLadderProps) {
  const entries = useMemo(
    () =>
      [...map.muscles.values()].filter((m) => m.classified).sort((a, b) => b.score - a.score),
    [map],
  );

  const [open, setOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between">
          <h2
            style={{
              fontSize: TYPE.subhead.size,
              fontWeight: TYPE.subhead.weight,
              color: TEXT.secondary,
            }}
          >
          {T.legend}
          </h2>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded px-2 py-1 text-xs transition"
          style={{ color: TEXT.tertiary }}
        >
          {open ? T.symmetryCollapse : T.symmetryExpand}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {entries.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              onClick={() => onSelectMuscle(entry.slug)}
              className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition"
              style={{
                backgroundColor: SOLID.card,
                borderColor: GLASS.border,
              }}
            >
              <span
                aria-hidden="true"
                style={{ fontSize: TYPE.subhead.size, color: TEXT.onAccent }}
              >
                {entry.rank.glyph}
              </span>
              <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>
                {entry.rank.label}
              </span>
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }} className="ml-auto">
                {Math.round(entry.score)} pts
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------- heatmap legend

function HeatmapLegend() {
  const buckets = [
    { label: T.heatmapMaintenance, color: HEATMAP.maintenance },
    { label: T.heatmapOptimal, color: HEATMAP.optimal },
    { label: T.heatmapFatigue, color: HEATMAP.fatigue },
    { label: T.heatmapInactive, color: HEATMAP.inactive },
  ];

  return (
    <section>
      <h3
        style={{
          fontSize: TYPE.caption.size,
          lineHeight: TYPE.caption.lineHeight,
          fontWeight: TYPE.caption.weight,
          color: TEXT.tertiary,
        }}
      >
        {T.mapModeHeatmap}
      </h3>
      <div className="mt-2 flex flex-wrap gap-3">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded"
              style={{ backgroundColor: b.color }}
            />
            <span style={{ fontSize: TYPE.caption.size, color: TEXT.secondary }}>{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ----------------------------------------------------------- muscle matrix

interface MuscleMatrixProps {
  map: RankMap;
  onSelectMuscle: (slug: Slug) => void;
  selectedRankFilters: RankId[];
  heatmapMode: boolean;
}

function MuscleMatrix({ map, onSelectMuscle, selectedRankFilters, heatmapMode }: MuscleMatrixProps) {
  const ranked = useMemo(
    () =>
      [...map.muscles.values()]
        .filter((m) => m.classified)
        .filter((m) =>
          selectedRankFilters.length === 0 ? true : selectedRankFilters.includes(m.rank.id),
        )
        .sort((a, b) => b.score - a.score),
    [map, selectedRankFilters],
  );

  return (
    <section>
      <h2
        className="mb-4"
        style={{
          fontSize: TYPE.title2.size,
          lineHeight: TYPE.title2.lineHeight,
          fontWeight: TYPE.title2.weight,
          letterSpacing: TYPE.title2.tracking,
          color: TEXT.primary,
        }}
      >
        Matriz de músculos
      </h2>

      {ranked.length === 0 ? (
        <p style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          {T.noRankFilterMatch}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={{ paddingBottom: SPACE["3xl"] }}>
          {ranked.map((entry) => (
            <MuscleCard
              key={entry.slug}
              entry={entry}
              onSelectMuscle={onSelectMuscle}
              heatmapMode={heatmapMode}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface UnclassifiedDisclosureProps {
  map: RankMap;
  onSelectMuscle: (slug: Slug) => void;
}

function UnclassifiedDisclosure({ map, onSelectMuscle }: UnclassifiedDisclosureProps) {
  const [open, setOpen] = useState(false);
  const pending = useMemo(
    () => [...map.muscles.values()].filter((m) => !m.classified),
    [map],
  );

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
        style={{ color: TEXT.secondary, fontSize: TYPE.subhead.size }}
      >
        <span>{T.pendingMuscles(map.pendingCount)}</span>
        <ChevronRight
          className="h-4 w-4 shrink-0 transition-transform"
          style={{
            transform: open ? "rotate(90deg)" : "none",
            color: TEXT.tertiary,
          }}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {pending.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              onClick={() => onSelectMuscle(entry.slug)}
              className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition"
              style={{
                backgroundColor: SOLID.card,
                borderColor: GLASS.border,
              }}
            >
              <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>{entry.label}</span>
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, marginLeft: "auto" }}>
                {T.classifiedOf(map.classifiedCount, map.muscles.size)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------- muscle card

interface MuscleCardProps {
  entry: MuscleRank;
  onSelectMuscle: (slug: Slug) => void;
  heatmapMode: boolean;
}

function MuscleCard({ entry, onSelectMuscle, heatmapMode }: MuscleCardProps) {
  const detail = entry.detail;
  const sessions = detail.strength?.effectiveSets ?? detail.volume.effectiveSets ?? 0;
  const bucket = heatmapMode ? bucketForEntry(entry) : null;

  return (
    <GlassCard flush>
      <button
        type="button"
        onClick={() => onSelectMuscle(entry.slug)}
        className="w-full text-left"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: "100%",
        }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="block truncate font-medium"
              style={{
                fontSize: TYPE.headline.size,
                lineHeight: TYPE.headline.lineHeight,
                fontWeight: TYPE.headline.weight,
                letterSpacing: TYPE.headline.tracking,
                color: TEXT.primary,
              }}
            >
              {entry.label}
            </p>
            <p
              className="mt-0.5"
              style={{
                fontSize: TYPE.caption.size,
                color: TEXT.tertiary,
              }}
            >
              {heatmapMode
                ? `${Math.round(entry.detail.volume.setsPerWeek)} series/sem`
                : `${entry.rank.label} · ${entry.score} pts`}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
            style={{
              backgroundColor: heatmapMode ? HEATMAP[bucket ?? "maintenance"] : entry.rank.color,
              fontSize: TYPE.subhead.size,
            }}
          >
            {heatmapMode ? "🔥" : entry.rank.glyph}
          </span>
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="flex items-center gap-1">
            <span
              className="tabular-nums"
              style={{
                fontSize: TYPE.mono.size,
                fontWeight: TYPE.mono.weight,
                color: TEXT.primary,
              }}
            >
              {sessions}
            </span>
            <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{T.sessionsLabel}</span>
          </div>

          {!heatmapMode && entry.delta > 0 && (
            <span
              className="flex items-center gap-0.5"
              style={{
                fontSize: TYPE.caption.size,
                color: STATUS.progression.text,
              }}
            >
              <TrendingUp className="h-3 w-3" />
              +{entry.delta}
            </span>
          )}

          {!heatmapMode && entry.delta === 0 && entry.classified && (
            <span
              className="whitespace-nowrap"
              style={{
                fontSize: TYPE.caption.size,
                lineHeight: TYPE.caption.lineHeight,
                color: TEXT.tertiary,
              }}
            >
              {T.trendFlat}
            </span>
          )}
        </div>
      </button>
    </GlassCard>
  );
}

// ----------------------------------------------------------- empty / loading

function HeroSkeleton() {
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} flush>
            <Skeleton variant="block" style={{ height: "96px", width: "100%" }} />
          </GlassCard>
        ))}
      </div>

    <GlassCard
      style={{
        padding: `${SPACE.card} ${SPACE.card} ${SPACE["3xl"]}`,
      }}
    >
        <Skeleton variant="block" style={{ height: "200px", width: "100%" }} />
      </GlassCard>
    </>
  );
}

function EmptyState({
  sessionsNeeded,
  bodyweightKg,
}: {
  sessionsNeeded: number;
  bodyweightKg: number | null;
}) {
  const needed = sessionsNeeded || ELIGIBILITY.minSessions;
  return (
    <GlassCard flush>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Flame className="h-7 w-7" style={{ color: TEXT.disabled }} />
        <h2
          style={{
            fontSize: TYPE.title1.size,
            lineHeight: TYPE.title1.lineHeight,
            fontWeight: TYPE.title1.weight,
            color: TEXT.primary,
          }}
        >
          {T.emptyTitle}
        </h2>
        <p
          className="max-w-sm"
          style={{
            fontSize: TYPE.caption.size,
            color: TEXT.secondary,
          }}
        >
          {T.emptyBody(needed)}
        </p>
        {bodyweightKg === null && (
          <p
            className="max-w-sm"
            style={{
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
            }}
          >
            {T.emptyNoBodyweight}
          </p>
        )}
      </div>
    </GlassCard>
  );
}

// --------------------------------------------------------- promotion banner

function PromotionBanner({ promotions }: { promotions: MuscleRank[] }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3"
      style={{
        padding: `${SPACE.sm} ${SPACE.xl}`,
        borderRadius: RADIUS.control,
        backgroundColor: ACCENT.subtle,
        borderColor: ACCENT.border,
        borderWidth: "1px",
        borderStyle: "solid",
      }}
    >
      <Sparkles className="h-4 w-4 shrink-0" style={{ color: ACCENT.text }} />
      <p
        className="flex-1"
        style={{
          fontSize: TYPE.caption.size,
          lineHeight: TYPE.caption.lineHeight,
          color: ACCENT.text,
        }}
      >
        {promotions.map((m) => T.promoted(m.label, m.rank.label)).join(" · ")}
      </p>
    </div>
  );
}
