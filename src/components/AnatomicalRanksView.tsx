/**
 * AnatomicalRanksView.tsx — the rank map.
 *
 * Reads everything from `useMuscleRanks`, which already owns loading, caching and
 * hysteresis. This component is presentation: summary card, body map, legend and
 * the per-muscle detail modal.
 *
 * Two decisions worth stating
 * ---------------------------
 * The map is `aria-hidden` and the legend below it carries every muscle as a real
 * button. Roughly 1 in 12 men has a colour vision deficiency and the map *is*
 * colour-coded, so the text path is the primary one and the body is the redundant
 * enhancement. Each legend button carries its rank glyph as text, which keeps the
 * ladder legible in monochrome.
 *
 * The empty state is a real state, not an error: it is what a new user sees, and
 * it is the most important screen for the first week. It therefore says how many
 * sessions are missing rather than refusing to render.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, ChevronRight, Flame, TrendingUp } from "lucide-react";
import type { Slug } from "react-muscle-highlighter";
import { MuscleSelector } from "./MuscleSelector";
import { MuscleRankDetail } from "./MuscleRankDetail";
import { useMuscleRanks } from "../hooks/useMuscleRanks";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { RANK_LABELS as T, UNRANKED_REASONS } from "../lib/i18n";
import { colorByMuscle, type MuscleRank, type RankMap } from "../lib/ranks/buildRankMap";
import { RANKS, ELIGIBILITY } from "../lib/ranks/rankConfig";
import type { RankHistoryRecord } from "../lib/ranks/rankHistory";

/**
 * Ranks listed in the legend, highest first.
 *
 * The user cares about the top of the ladder first, and reading Bronze-to-top
 * requires scrolling past six rows that are usually empty. `unranked` is excluded:
 * it is the absence of a rank, and it is already explained in the empty state and
 * in each muscle's detail panel.
 */
const LEGEND_RANKS = RANKS.filter((rank) => rank.id !== "unranked");

interface AnatomicalRanksViewProps {
  userId: string | null;
  /** Sends the user to the catalog filtered by a muscle, from the detail modal. */
  onBrowseMuscle?: (slug: Slug) => void;
  /**
   * Opens this muscle's detail panel on mount.
   *
   * Set when the user arrived from the catalog, so "see the rank" and "see the
   * exercises" become two ends of one trip.
   */
  initialDetail?: string | null;
  /**
   * Compute this person's ranks without touching the shared hysteresis store.
   *
   * For the coach portal, which shows the map for an athlete who is not the signed-in
   * user. The ranks, the distribution and the promotion banner are all still computed and
   * still shown -- what stops is the persistence, because that store is keyed by muscle
   * alone and shared by every account on the origin.
   *
   * Named the same as the hook's option and forwarded to it verbatim. Not re-derived here:
   * this component does not know whether `userId` is the signed-in user, and a guess would
   * be wrong in exactly the case that matters.
   *
   * Distinct from the `readOnly` passed to `MuscleSelector` below, which means something
   * narrower -- the selector cannot be used to change the selection. Two props of the same
   * name at different depths for different reasons is a little unfortunate; renaming the
   * hook's option to match would have meant touching every existing caller to avoid it.
   */
  readOnly?: boolean;
}

export function AnatomicalRanksView({
  userId,
  onBrowseMuscle,
  initialDetail = null,
  readOnly = false,
}: AnatomicalRanksViewProps) {
  const ranks = useMuscleRanks(userId, { readOnly });
  const reducedMotion = useReducedMotion();
  const [detailSlug, setDetailSlug] = useState<string | null>(initialDetail);
  const [seenPromotions, setSeenPromotions] = useState<string[]>([]);

  const map = ranks.map;

  const colors = useMemo(() => (map ? colorByMuscle(map) : new Map<Slug, string>()), [map]);

  /**
   * Promotion banner.
   *
   * Drawn from `promotions` rather than kept in local state, because the hook
   * recomputes them on every load and they would otherwise replay on reload.
   * `seenPromotions` remembers which ones have already been announced, and the
   * banner is simply not rendered at all under reduced motion -- CSS cannot
   * remove an element, only its animation.
   */
  const banner = useMemo(() => {
    if (reducedMotion || ranks.promotions.length === 0) return null;
    const fresh = ranks.promotions.filter((m) => !seenPromotions.includes(m.slug));
    return fresh.length > 0 ? fresh : null;
  }, [ranks.promotions, seenPromotions, reducedMotion]);

  useEffect(() => {
    if (ranks.promotions.length === 0) return;
    setSeenPromotions((current) => {
      const known = new Set(current);
      const missing = ranks.promotions.map((m) => m.slug).filter((slug) => !known.has(slug));
      if (missing.length === 0) return current;
      return [...current, ...missing];
    });
  }, [ranks.promotions]);

  const openDetail = useCallback((slug: Slug) => setDetailSlug(slug), []);
  const closeDetail = useCallback(() => setDetailSlug(null), []);

  const detail = detailSlug && map ? map.muscles.get(detailSlug as Slug) ?? null : null;
  const detailHistory = detailSlug ? ranks.historyFor(detailSlug) : [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          {T.title}
        </h2>
        <p className="text-xs text-neutral-500">{T.subtitle}</p>
      </header>

      {banner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5"
        >
          <TrendingUp className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p className="text-xs text-accent">
            {banner.map((m) => T.promoted(m.label, m.rank.label)).join(" · ")}
          </p>
        </div>
      )}

      {ranks.initialLoading && (
        <p className="text-sm text-neutral-500">{T.loading}</p>
      )}

      {ranks.error && !map && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">{T.loadError}</p>
          <button
            type="button"
            onClick={() => void ranks.refresh()}
            className="mt-2 rounded-lg border border-red-500/40 px-3 py-1 text-[11px] text-red-200 transition hover:bg-red-500/10"
          >
            {T.retry}
          </button>
        </div>
      )}

      {map && ranks.empty && (
        <EmptyState
          sessionsNeeded={ranks.sessionsNeeded}
          bodyweightKg={ranks.bodyweightKg}
        />
      )}

      {map && !ranks.empty && (
        <>
          <Summary map={map} onSelectMuscle={openDetail} />

          <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass">
            <MuscleSelector
              selected={[]}
              onChange={() => undefined}
              readOnly
              onSelectMuscle={openDetail}
              colorByMuscle={colors}
              legendLabel="Rango por músculo"
              className=""
              renderBadge={(slug) => {
                const entry = map.muscles.get(slug);
                if (!entry) return null;
                return (
                  <span aria-hidden="true" className="text-[10px] text-neutral-500">
                    {entry.rank.glyph}
                  </span>
                );
              }}
            />
          </section>

          <Legend map={map} onSelectMuscle={openDetail} />
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
    </div>
  );
}

// ----------------------------------------------------------------- summary

function Summary({
  map,
  onSelectMuscle,
}: {
  map: RankMap;
  onSelectMuscle: (slug: Slug) => void;
}) {
  const rank = map.globalRank;
  const strongest = map.strongest;
  // `weakest` is null with a single classified muscle: calling one muscle both
  // the strongest and the weakest would be a claim, not a fact.
  const weakest = map.weakest;

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass">
        <div className="flex items-center gap-2 text-accent">
          <Award className="h-4 w-4" aria-hidden="true" />
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {T.globalRank}
          </p>
        </div>
        {rank && map.globalScore !== null ? (
          <>
            <p className="mt-3 text-2xl font-semibold">
              <span aria-hidden="true" className="mr-1.5 text-accent">
                {rank.glyph}
              </span>
              {rank.label}
            </p>
            <p className="mt-1 text-xs tabular-nums text-neutral-500">
              {T.ofMax(map.globalScore)}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">Sin clasificar</p>
        )}
      </div>

      <Metric
        icon={<Flame className="h-4 w-4" />}
        label={T.strongest}
        entry={strongest}
        empty={!strongest}
        onSelect={onSelectMuscle}
      />

      <Metric
        icon={<TrendingUp className="h-4 w-4" />}
        label={T.weakest}
        entry={weakest}
        empty={!weakest}
        hint={weakest ? T.focusHint : "Entrena un segundo músculo para comparar."}
        onSelect={onSelectMuscle}
      />

      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Músculos</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">
          {map.classifiedCount}
          <span className="text-base font-normal text-neutral-500">
            /{map.muscles.size}
          </span>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {T.classifiedOf(map.classifiedCount, map.muscles.size)}
        </p>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  entry,
  empty,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  entry: MuscleRank | null;
  empty: boolean;
  hint?: string;
  onSelect: (slug: Slug) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      </div>
      {empty || !entry ? (
        <p className="mt-3 text-sm text-neutral-500">
          {hint ?? "Aún sin datos suficientes."}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onSelect(entry.slug)}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded text-left text-lg font-semibold transition hover:text-accent"
          >
            <span>{entry.label}</span>
            <ChevronRight className="h-4 w-4 text-neutral-600" aria-hidden="true" />
          </button>
          <p className="mt-1 text-xs text-neutral-500">
            <span aria-hidden="true" className="mr-1">
              {entry.rank.glyph}
            </span>
            {entry.rank.label}
          </p>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ legend

function Legend({ map, onSelectMuscle }: { map: RankMap; onSelectMuscle: (slug: Slug) => void }) {
  // Classified muscles, strongest first, so the legend doubles as a leaderboard.
  const ranked = [...map.muscles.values()]
    .filter((m) => m.classified)
    .sort((a, b) => b.score - a.score);

  const pending = [...map.muscles.values()].filter((m) => !m.classified);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass">
        <h3 className="text-sm font-semibold">{T.legend}</h3>
        <p className="mt-0.5 text-[11px] text-neutral-500">{T.legendHint}</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGEND_RANKS.map((rank) => (
            <li key={rank.id} className="flex items-center gap-1.5 text-[11px]">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: rank.color }}
              />
              <span className="tabular-nums text-neutral-600" aria-hidden="true">
                {rank.glyph}
              </span>
              <span className="text-neutral-400">
                {rank.label}
                <span className="text-neutral-600"> · {rank.minScore}+</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {ranked.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ranked.map((entry) => (
            <li key={entry.slug}>
              <button
                type="button"
                onClick={() => onSelectMuscle(entry.slug)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2.5 text-left transition hover:border-white/25"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                  style={{ backgroundColor: entry.rank.color }}
                >
                  {entry.rank.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {entry.label}
                  </span>
                  <span className="block text-[11px] text-neutral-500">
                    {entry.rank.label} · {entry.score} pts
                  </span>
                </span>
                {entry.delta > 0 && (
                  <span className="shrink-0 text-[11px] text-accent">
                    +{entry.delta}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <details className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 shadow-glass">
          <summary className="cursor-pointer text-xs text-neutral-400">
            {pending.length} músculos sin clasificar todavía
          </summary>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {pending.map((entry) => (
              <li key={entry.slug}>
                <button
                  type="button"
                  onClick={() => onSelectMuscle(entry.slug)}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-neutral-500 transition hover:border-white/25 hover:text-neutral-300"
                >
                  {entry.label}
                  <span className="ml-1 text-neutral-700">
                    {UNRANKED_REASONS[entry.unrankedReason ?? "no_data"]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// ------------------------------------------------------------ empty state

function EmptyState({
  sessionsNeeded,
  bodyweightKg,
}: {
  sessionsNeeded: number;
  bodyweightKg: number | null;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-8 text-center shadow-glass">
      <Flame className="mx-auto mb-3 h-7 w-7 text-neutral-600" aria-hidden="true" />
      <h3 className="text-base font-semibold text-neutral-100">{T.emptyTitle}</h3>
      <p className="mx-auto mt-2 max-w-sm text-xs text-neutral-500">
        {T.emptyBody(sessionsNeeded || ELIGIBILITY.minSessions)}
      </p>
      {bodyweightKg === null && (
        <p className="mx-auto mt-3 max-w-sm text-xs text-amber-300/80">
          {T.emptyNoBodyweight}
        </p>
      )}
    </section>
  );
}

/** Re-exported so tests can build a map without importing the hook. */
export type { RankHistoryRecord };