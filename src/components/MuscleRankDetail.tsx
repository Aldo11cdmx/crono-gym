/**
 * MuscleRankDetail.tsx — the per-muscle explanation panel.
 *
 * A rank the user cannot interrogate is a rank they will not trust, so this shows
 * the whole derivation: the score, the split between strength and volume, the
 * exercises that produced it, what is missing when the muscle is unranked, and
 * now -- the volume fatigue signal and an ascent projection that names what
 * stands between the current score and the next rank.
 *
 * Accessibility
 * -------------
 * Modal rather than inline because the map is the anchor; replacing it would lose
 * the user's position. Focus moves in on open, Escape closes, Tab is trapped
 * inside, and focus returns to the element that opened it. Backdrop clicks close;
 * clicks inside do not.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowUpRight, Dumbbell, TrendingDown, X } from "lucide-react";
import type { MuscleRank } from "../lib/ranks/buildRankMap";
import { bucketForEntry } from "../lib/ranks/heatmapColors";
import type { MuscleScoreResult } from "../lib/ranks/muscleScore";
import type { RankHistoryRecord } from "../lib/ranks/rankHistory";
import { CONFIDENCE_LABELS, RANKS, VOLUME_RULES } from "../lib/ranks/rankConfig";
import { HEATMAP } from "../design/tokens";
import { RANK_LABELS as T, UNRANKED_REASONS } from "../lib/i18n";

interface MuscleRankDetailProps {
  entry: MuscleRank;
  /** Rank timeline for this muscle, oldest first. */
  history: RankHistoryRecord[];
  onClose: () => void;
  /** Opens the catalog filtered to this muscle. */
  onBrowseExercises?: () => void;
}

/** Selectors for the focus trap. Kept tiny so there is nothing to get wrong. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function MuscleRankDetail({
  entry,
  history,
  onClose,
  onBrowseExercises,
}: MuscleRankDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Remember the opener before the panel exists, so the effect does not see the
  // button it is replacing.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => restoreFocusRef.current?.focus?.();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const detail = entry.detail;
  const ranked = entry.classified;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="muscle-rank-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-neutral-900/95 p-5 shadow-glass focus:outline-none sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="muscle-rank-title"
              className="flex items-center gap-2 text-base font-semibold"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                style={{ backgroundColor: entry.rank.color }}
              >
                {entry.rank.glyph}
              </span>
              {entry.label}
            </h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {entry.rank.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={T.close}
            className="shrink-0 rounded-lg p-1 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!ranked ? (
          <p className="rounded-xl border border-white/10 bg-neutral-950/50 px-4 py-3 text-sm text-neutral-400">
            {UNRANKED_REASONS[entry.unrankedReason ?? "no_data"]}
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <p className="text-3xl font-semibold tabular-nums">
                {entry.score}
                <span className="text-sm font-normal text-neutral-500"> /100</span>
              </p>
              <p className="text-[11px] text-neutral-500">
                {T.confidence}: {CONFIDENCE_LABELS[entry.confidence]}
              </p>
            </div>

            <ProgressBar entry={entry} />

            <AscentProjection entry={entry} />

            <div className="mt-4 grid grid-cols-2 gap-3">
              {detail.strength && (
                <Stat
                  label={T.strength}
                  weight={T.strengthWeight}
                  value={`${Math.round(detail.strength.volumePercent)}%`}
                  hint={T.strengthHint(
                    detail.strength.effectiveSets,
                    detail.strength.activeWeeks,
                  )}
                />
              )}
              <Stat
                label={T.volume}
                weight={T.volumeWeight}
                value={`${Math.round(detail.volume.volumePercent)}%`}
                hint={T.volumeHint(detail.volume.effectiveSets, detail.volume.activeWeeks)}
              />
            </div>

            <OneRepMax entry={entry} />

            <FatigueBar entry={entry} />

            <DecayNotice volume={detail.volume} />

            <Sparkline history={history} color={entry.rank.borderColor} />
          </>
        )}

        {detail.contributions.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-semibold">{T.contributionsTitle}</h3>
            <ul className="mt-2 space-y-1.5">
              {detail.contributions.slice(0, 5).map((c) => (
                <li
                  key={c.exerciseId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs">{c.name}</span>
                    <span className="block text-[11px] text-neutral-500">
                      {c.counted ? T.contributionCounted : T.contributionNotCounted} ·{" "}
                      {c.contributionWeight === 1
                        ? T.contributionPrimary
                        : T.contributionSecondary}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] tabular-nums text-neutral-400">
                    {c.estimatedOneRepMax > 0
                      ? `${c.estimatedOneRepMax.toFixed(1)} kg 1RM`
                      : T.contributionSets(c.workingSets)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {onBrowseExercises && (
          <button
            type="button"
            onClick={onBrowseExercises}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-xs text-neutral-300 transition hover:border-accent/50 hover:text-accent"
          >
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            {T.browseExercises(entry.label)}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/** The progress bar from the current rank toward the next one. */
function ProgressBar({ entry }: { entry: MuscleRank }) {
  const { progress } = entry;
  const percent = Math.round(progress.percent * 100);
  return (
    <div className="mt-3">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={T.progressAria(progress.next?.label ?? T.atMaxLabel)}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percent}%`,
            backgroundColor: entry.rank.borderColor,
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-600">
        <span>{progress.current.label}</span>
        <span>{progress.next?.label ?? T.atMaxLabel}</span>
      </div>
    </div>
  );
}

/**
 * Ascent projection: the gap to the next rank, stated as points and a bar,
 * plus a highlight when a single session can plausibly close it.
 */
function AscentProjection({ entry }: { entry: MuscleRank }) {
  const { progress } = entry;

  if (!progress.next) {
    return (
      <p className="mt-3 text-[11px] text-neutral-500">{T.atTopRank}</p>
    );
  }

  const points = progress.pointsToNext;
  const label = progress.next.label;
  const percent = Math.round(progress.percent * 100);
  const nearlyThere = progress.nearlyThere;

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-neutral-950/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {T.ascentTitle}
      </h3>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="text-lg font-semibold tabular-nums">
          {T.ascentPoints(points)}
        </p>
        <p className="text-[11px] text-neutral-500">
          {T.ascentNext} {label}
        </p>
      </div>

      <div className="mt-2">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${percent}%`,
              backgroundColor: entry.rank.borderColor,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-neutral-600">
          <span>{progress.current.label}</span>
          <span>{label}</span>
        </div>
      </div>

      {nearlyThere && (
        <p className="mt-2 text-[11px] text-amber-300/90">
          <TrendingDown className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {T.nearlyThere}
        </p>
      )}
    </section>
  );
}

/**
 * Fatigue and load state: a one-bar verdict on the volume half.
 *
 * Shows the weekly-set bucket, the raw set count, how long the muscle has been
 * idle, and the inactivity decay multiplier, all so "your score includes decay" is
 * actionable rather than a statement.
 */
function FatigueBar({ entry }: { entry: MuscleRank }) {
  const { volume } = entry.detail;
  const bucket = bucketForEntry(entry);

  const volumeColor = useMemo(() => {
    switch (bucket) {
      case "optimal":
        return HEATMAP.optimal;
      case "fatigue":
        return HEATMAP.fatigue;
      case "maintenance":
        return HEATMAP.maintenance;
      case "inactive":
        return HEATMAP.inactive;
    }
  }, [bucket]);

  const setsPerWeek = Math.round(volume.setsPerWeek);
  const daysSince = volume.daysSinceLastSet;
  const decayPct = Math.round(volume.decayFactor * 100);

  let statusLabel: string;
  let statusHint: string;
  if (setsPerWeek === 0) {
    statusLabel = T.fatigueLow;
    statusHint = T.heatmapInactiveHint;
  } else if (bucket === "optimal") {
    statusLabel = T.fatigueOptimal;
    statusHint = T.heatmapOptimalHint;
  } else if (bucket === "fatigue") {
    statusLabel = T.fatigueOverload;
    statusHint = T.heatmapFatigueHint;
  } else {
    statusLabel = T.fatigueRecovery;
    statusHint = T.heatmapInactiveHint;
  }

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-neutral-950/40 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {T.fatigueTitle}
        </h3>
        <span
          className="text-[10px] font-medium"
          style={{ color: volumeColor }}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-2">
        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="img"
          aria-label={T.fatigueSets(setsPerWeek)}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (setsPerWeek / 14) * 100)}%`,
              backgroundColor: volumeColor,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-neutral-600">
          <span>{T.fatigueSets(setsPerWeek)}</span>
          <span>{statusHint}</span>
        </div>
      </div>

      <div className="mt-2 flex justify-between gap-2 text-[11px]">
        <span className="text-neutral-500">
          {daysSince !== null ? T.fatigueDays(daysSince) : T.decayNever}
        </span>
        {volume.decayFactor < 1 && daysSince !== null && (
          <span className="text-neutral-500">
            {T.fatigueDecay(decayPct)}
          </span>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  weight,
  value,
  hint,
}: {
  label: string;
  /** How much of the final score this half is worth, stated next to it. */
  weight?: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/40 p-3">
      <p className="flex items-baseline justify-between gap-1">
        <span className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</span>
        {weight && (
          // Not decoration: without it the reader assumes the percentage shown is
          // the share of the score, which it is not.
          <span className="text-[10px] tabular-nums text-neutral-600">{weight}</span>
        )}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] text-neutral-600">{hint}</p>
    </div>
  );
}

/**
 * The estimated 1RM, with the arithmetic that produced it.
 *
 * Renders only the strongest exercise, because the muscle's score is driven by its
 * best movements and a table of every 1RM would bury the one the user cares about
 * under the ones that did not count. The `bestSet` it names is the same set the
 * scorer used, so the figure on screen and the figure behind the rank are the same
 * number rather than two that happen to agree.
 */
function OneRepMax({ entry }: { entry: MuscleRank }) {
  const best = useMemo(
    () =>
      entry.detail.contributions
        .filter((c) => c.estimatedOneRepMax > 0)
        .sort((a, b) => b.estimatedOneRepMax - a.estimatedOneRepMax)[0] ?? null,
    [entry.detail.contributions],
  );

  if (!best) {
    return (
      <section className="mt-4 rounded-xl border border-white/10 bg-neutral-950/40 p-3">
        <h3 className="text-sm font-semibold">{T.oneRepMaxTitle}</h3>
        <p className="mt-1 text-[11px] text-neutral-500">{T.oneRepMaxNoSet}</p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-neutral-950/40 p-3">
      <h3 className="text-sm font-semibold">{T.oneRepMaxTitle}</h3>

      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {best.estimatedOneRepMax.toFixed(1)} kg
        </span>
        <span className="text-[11px] text-neutral-500">{best.name}</span>
      </p>

      {best.bestSet && (
        <>
          <p className="mt-1.5 text-[10px] text-neutral-600">{T.oneRepMaxFormula}</p>
          {/*
            The formula, worked through with this user's own numbers. A user who
            cannot re-derive the figure has to take it on faith, and a rank they
            cannot check is a rank they stop trusting.
          */}
          <p className="mt-0.5 text-[10px] tabular-nums text-neutral-500">
            {T.oneRepMaxFormulaHint(
              best.bestSet.weight,
              best.bestSet.reps,
              best.estimatedOneRepMax,
            )}
          </p>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            {T.oneRepMaxBestSet(best.bestSet.weight, best.bestSet.reps)}
          </p>
        </>
      )}

      <p className="mt-1.5 text-[10px] text-neutral-600">
        {T.oneRepMaxSessions(best.sessions, best.workingSets)}
      </p>
    </section>
  );
}

/**
 * Inactivity decay, stated only when it is doing something.
 *
 * A panel that always showed a decay line would be noise on a muscle trained
 * yesterday. The indicator appears at the threshold rather than at any loss, and
 * says both the multiplier and how long the muscle has been idle, so "your score is
 * lower than last week" has a stated cause the user can act on.
 */
function DecayNotice({ volume }: { volume: MuscleScoreResult["volume"] }) {
  const decaying =
    volume.decayFactor < 1 &&
    volume.daysSinceLastSet !== null &&
    volume.daysSinceLastSet > VOLUME_RULES.decayAfterDays;

  if (!decaying) {
    return (
      <p className="mt-3 text-[11px] text-neutral-600">{T.decayNone}</p>
    );
  }

  const percent = Math.round(volume.decayFactor * 100);

  // Both facts ride in one sentence rather than two: a multiplier without the
  // duration is unreadable, and a duration without the multiplier is a guilt trip.
  // One line, one thing to take away.
  return (
    <p className="mt-3 text-[11px] text-amber-300/90">
      <TrendingDown className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
      {T.decayDays(volume.daysSinceLastSet as number)} · {T.decayLost(percent)}
    </p>
  );
}

/**
 * Spanish label for a stored rank id.
 *
 * History rows keep the id (`"bronze"`), not the label, because ids are what the
 * persistence layer and the hysteresis buffer speak. Rendering the raw id would
 * put an English slug in the middle of a Spanish timeline.
 *
 * Falls back to the raw value for an id this build does not know, so a timeline
 * written by a newer version still renders instead of throwing.
 */
function rankLabel(id: string): string {
  const known = RANKS.find((rank) => rank.id === id);
  return known ? known.label : id;
}

/**
 * Rank timeline.
 *
 * Deliberately plots recorded rank *changes*, not scores: a score drifting from 44
 * to 46 produces no event, and plotting it would put dozens of meaningless points
 * on a chart whose whole job is to show milestones.
 */
function Sparkline({
  history,
  color,
}: {
  history: RankHistoryRecord[];
  color: string;
}) {
  if (history.length < 2) {
    return (
      <p className="mt-4 text-[11px] text-neutral-600">
        {history.length === 1 ? T.historyFirst : T.historyEmpty}
      </p>
    );
  }

  return (
    <ol aria-label={T.historyLabel} className="mt-4 space-y-1.5">
      {[...history].reverse().map((record) => (
        <li key={record.id} className="flex items-center gap-2 text-[11px]">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {/* The stored value is a rank id; the label is what a person reads. */}
          <span className="text-neutral-400">{rankLabel(record.rank)}</span>
          <span className="text-neutral-600">{record.score} pts</span>
          <span className="ml-auto text-neutral-600 tabular-nums">{record.day}</span>
        </li>
      ))}
    </ol>
  );
}
