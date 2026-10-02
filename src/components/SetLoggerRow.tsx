import { TrendingDown, TrendingUp, Undo2 } from "lucide-react";
import type { OverloadDecision, OverloadTarget } from "../lib/overload";

export interface SetEntry {
  set_number: number;
  weight: string;
  reps: string;
  rpe: string;
  is_warmup: boolean;
  completed: boolean;
}

interface SetLoggerRowProps {
  entry: SetEntry;
  index: number;
  onChange: (entry: SetEntry) => void;
  onRemove: () => void;
  /** "Última vez: 80 kg x 8 @8" — shown on the opening set only. */
  previousLabel?: string;
  /** Progressive-overload target, or null when there is nothing to suggest. */
  suggestion?: OverloadTarget | null;
  onApplySuggestion?: () => void;
}

/**
 * Visual treatment per decision.
 *
 * A load increase and a deload both change the weight, but they mean opposite
 * things, so they must not share a colour: green reads as "go harder" and amber
 * as "back off". A flat chip would make the advice ambiguous.
 */
const DECISION_STYLE: Record<
  Exclude<OverloadDecision, "first_time">,
  { icon: typeof TrendingUp; chip: string; border: string; label: string }
> = {
  increase: {
    icon: TrendingUp,
    chip: "text-emerald-300",
    border: "border-emerald-500/30 bg-emerald-500/10",
    label: "Progresión",
  },
  double_progression: {
    icon: TrendingUp,
    chip: "text-accent",
    border: "border-accent/25 bg-accent/5",
    label: "Suma una rep",
  },
  hold: {
    icon: TrendingUp,
    chip: "text-neutral-300",
    border: "border-white/10 bg-white/[0.03]",
    label: "Mantén",
  },
  deload: {
    icon: TrendingDown,
    chip: "text-amber-300",
    border: "border-amber-500/30 bg-amber-500/10",
    label: "Descanso activo",
  },
  stalled: {
    icon: TrendingDown,
    chip: "text-amber-300",
    border: "border-amber-500/30 bg-amber-500/10",
    label: "Estancado",
  },
  return_from_break: {
    icon: Undo2,
    chip: "text-sky-300",
    border: "border-sky-500/30 bg-sky-500/10",
    label: "Vuelta tras pausa",
  },
};

export function SetLoggerRow({
  entry,
  index,
  onChange,
  onRemove,
  previousLabel,
  suggestion,
  onApplySuggestion,
}: SetLoggerRowProps) {
  const decision =
    suggestion && suggestion.decision !== "first_time" ? suggestion.decision : null;
  const style = decision ? DECISION_STYLE[decision] : null;
  const Icon = style?.icon ?? TrendingUp;

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-accent">Serie {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-neutral-500 hover:text-red-400"
        >
          Eliminar
        </button>
      </div>

      {previousLabel && (
        <p className="mt-1.5 text-[11px] text-neutral-500">{previousLabel}</p>
      )}

      {suggestion && decision && style && (
        <div className={`mt-2 rounded-lg border px-3 py-2 ${style.border}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Icon className="h-3 w-3" />
              <span className={style.chip}>{suggestion.delta}</span>
              <span className="font-normal text-neutral-500">{style.label}</span>
            </span>
            {onApplySuggestion && (
              <button
                type="button"
                onClick={onApplySuggestion}
                className="rounded-md bg-accent/20 px-2.5 py-1 text-[10px] font-semibold text-accent transition hover:bg-accent/30"
              >
                Usar objetivo
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">
            {suggestion.reason}
          </p>
          {!suggestion.estimateConfident && (
            <p className="mt-1 text-[10px] text-amber-400/80">
              El 1RM estimado no es fiable con este número de reps.
            </p>
          )}
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field
          label="Peso (kg)"
          value={entry.weight}
          onChange={(v) => onChange({ ...entry, weight: v })}
        />
        <Field
          label="Repeticiones"
          value={entry.reps}
          onChange={(v) => onChange({ ...entry, reps: v })}
        />
        <Field
          label="RPE"
          value={entry.rpe}
          onChange={(v) => onChange({ ...entry, rpe: v })}
        />
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={entry.is_warmup}
            onChange={(e) => onChange({ ...entry, is_warmup: e.target.checked })}
            className="accent-accent"
          />
          Calentamiento
        </label>
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...entry, completed: !entry.completed })}
        className={`mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          entry.completed ? "bg-emerald-500/20 text-emerald-300" : "bg-accent text-neutral-950"
        } hover:brightness-110`}
      >
        {entry.completed ? "Serie completada" : "Marcar completada"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-neutral-400">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

