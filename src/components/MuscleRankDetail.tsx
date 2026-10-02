/**
 * MuscleRankDetail.tsx — the per-muscle explanation panel.
 *
 * A rank the user cannot interrogate is a rank they will not trust, so this shows
 * the whole derivation: the score, the split between strength and volume, the
 * exercises that produced it, and what is missing when the muscle is unranked.
 *
 * Accessibility
 * -------------
 * Modal rather than inline because the map is the anchor; replacing it would lose
 * the user's position. Focus moves in on open, Escape closes, Tab is trapped
 * inside, and focus returns to the element that opened it. Backdrop clicks close;
 * clicks inside do not.
 */

import { useCallback, useEffect, useRef } from "react";
import { ArrowUpRight, Dumbbell, X } from "lucide-react";
import type { MuscleRank } from "../lib/ranks/buildRankMap";
import type { RankHistoryRecord } from "../lib/ranks/rankHistory";
import { CONFIDENCE_LABELS, RANKS } from "../lib/ranks/rankConfig";
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
            aria-label="Cerrar"
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

            <div className="mt-4 grid grid-cols-2 gap-3">
              {detail.strength && (
                <Stat
                  label="Fuerza"
                  value={`${Math.round(detail.strength.volumePercent)}%`}
                  hint="1RM estimado sobre estándar"
                />
              )}
              <Stat
                label="Volumen"
                value={`${Math.round(detail.volume.volumePercent)}%`}
                hint={`${detail.volume.effectiveSets} series · ${detail.volume.activeWeeks} semanas`}
              />
            </div>

            <Sparkline history={history} color={entry.rank.borderColor} />

            <p className="mt-4 text-xs text-neutral-500">
              {entry.progress.next
                ? `Te faltan ${entry.progress.pointsToNext} puntos para ${entry.progress.next.label}.`
                : "Estás en el rango más alto."}
            </p>
          </>
        )}

        {detail.contributions.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-semibold">Ejercicios que más aportan</h3>
            <ul className="mt-2 space-y-1.5">
              {detail.contributions.slice(0, 5).map((c) => (
                <li
                  key={c.exerciseId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs">{c.name}</span>
                    <span className="block text-[11px] text-neutral-500">
                      {c.counted ? "Contado" : "No contado"} ·{" "}
                      {c.contributionWeight === 1
                        ? "principal"
                        : "secundario"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] tabular-nums text-neutral-400">
                    {c.estimatedOneRepMax > 0
                      ? `${c.estimatedOneRepMax.toFixed(1)} kg 1RM`
                      : `${c.workingSets} series`}
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
            Ver ejercicios para {entry.label}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

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
        aria-label={`Progreso hacia ${progress.next?.label ?? "el rango más alto"}`}
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
        <span>{progress.next?.label ?? "Máximo"}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] text-neutral-600">{hint}</p>
    </div>
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
        {history.length === 1
          ? "Primer rango registrado. Aquí verás tu evolución."
          : "Aún no hay historial de rangos."}
      </p>
    );
  }

  return (
    <ol aria-label="Historial de rangos" className="mt-4 space-y-1.5">
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