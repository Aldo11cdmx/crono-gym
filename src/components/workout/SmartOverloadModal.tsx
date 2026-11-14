import { useEffect, useId, useState } from "react";
import { Minus, Plus, Sparkles, X } from "lucide-react";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import {
  CALIBRATION_PRESETS,
  type CalibrationPresetId,
} from "@/lib/workout/cronosSmartEngine";

export interface SmartOverloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  /** What the next set is loaded with today. */
  weightKg: number;
  reps: number;
  isBodyweight: boolean;
  /** False on a movement the athlete has never logged: the modal calibrates. */
  hasHistory: boolean;
  /** The transfer estimate, when there is no history of this movement. */
  coldStartReason?: string | null;
  /** Where the numbers came from, said plainly instead of implied. */
  coldStartSourceLabel?: string | null;
  /**
   * Applies a one-tap calibration. Returns the load the engine chose, so the
   * modal can show what was learned rather than a number the athlete typed.
   */
  onCalibrate?: (preset: CalibrationPresetId) => { weightKg: number; reps: number } | null;
  /** Writes the calibration to the model and fills every pending set. */
  onApply: (next: { weightKg: number; reps: number }) => void;
  /** 1-based number of the set the load will land on. */
  pendingSetNumber?: number;
}

/**
 * The load, decided with the athlete instead of for them.
 *
 * Two cases, and the modal never pretends they are the same one. With history
 * it shows the recommendation and lets it be edited. Without history there is
 * nothing to recommend from, so it says so and asks -- one tap, because a
 * question that needs typing is a question nobody answers at the rack.
 */
export function SmartOverloadModal({
  isOpen,
  onClose,
  exerciseName,
  weightKg,
  reps,
  isBodyweight,
  hasHistory,
  coldStartReason,
  coldStartSourceLabel,
  onCalibrate,
  onApply,
  pendingSetNumber,
}: SmartOverloadModalProps) {
  const titleId = useId();
  const [weight, setWeight] = useState(String(weightKg));
  const [repsValue, setRepsValue] = useState(String(reps));
  const [preset, setPreset] = useState<CalibrationPresetId | null>(null);

  // The sheet is mounted once and reused across exercises, so it has to adopt
  // the new exercise's numbers every time it opens.
  useEffect(() => {
    if (!isOpen) return;
    setWeight(String(weightKg));
    setRepsValue(String(reps));
    setPreset(null);
  }, [isOpen, weightKg, reps]);

  if (!isOpen) return null;

  const weightNumber = Number.parseFloat(weight);
  const repsNumber = Number.parseInt(repsValue, 10);
  const weightValid = Number.isFinite(weightNumber) && weightNumber >= 0;
  const repsValid = Number.isFinite(repsNumber) && repsNumber > 0;
  const canApply = weightValid && repsValid;

  const nudge = (setter: (value: string) => void, current: string, delta: number, min: number) => {
    const parsed = Number.parseFloat(current);
    const base = Number.isFinite(parsed) ? parsed : min;
    setter(String(Math.max(min, Math.round((base + delta) * 10) / 10)));
  };

  const choosePreset = (id: CalibrationPresetId) => {
    setPreset(id);
    const next = onCalibrate?.(id) ?? null;
    if (!next) return;
    setWeight(String(next.weightKg));
    setRepsValue(String(next.reps));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.sheet,
        display: "flex",
        alignItems: "flex-end",
        background: SCRIM.modal,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88vh] overflow-y-auto"
        style={{
          width: "100%",
          maxWidth: "560px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
          padding: SPACE.card,
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          border: `1px solid ${GLASS.border}`,
          background: SURFACE.raised,
          boxShadow: GLASS.shadow,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE.sm }}>
          <div style={{ minWidth: 0 }}>
            <h3
              id={titleId}
              style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, color: TEXT.primary, display: "flex", alignItems: "center", gap: SPACE.xs }}
            >
              <Sparkles size={18} strokeWidth={2} aria-hidden="true" style={{ color: ACCENT.text }} />
              Sobrecarga progresiva
            </h3>
            <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary, overflowWrap: "break-word" }}>
              {exerciseName}
              {pendingSetNumber ? ` · serie ${pendingSetNumber}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.pill,
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {!hasHistory && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE.xs,
              padding: SPACE.md,
              borderRadius: RADIUS.control,
              border: `1px solid ${ACCENT.border}`,
              background: ACCENT.subtle,
            }}
          >
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
              Aún no tienes marcas en este ejercicio. ¿Cómo lo calibramos hoy?
            </p>
            {coldStartReason && (
              <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
                {coldStartReason}
                {coldStartSourceLabel ? ` ${coldStartSourceLabel}.` : ""}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
              {CALIBRATION_PRESETS.map((option) => {
                const active = preset === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => choosePreset(option.id)}
                    aria-pressed={active}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      minHeight: MOTION.minTouchTarget,
                      padding: `${SPACE.sm}px ${SPACE.md}`,
                      borderRadius: RADIUS.control,
                      border: `1px solid ${active ? ACCENT.base : GLASS.border}`,
                      background: active ? ACCENT.subtle : SURFACE.sunken,
                      color: TEXT.primary,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>{option.label}</span>
                    <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span style={{ fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT.tertiary }}>
              {isBodyweight ? "Lastre (kg)" : "Peso (kg)"}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Bajar peso"
                onClick={() => nudge(setWeight, weight, -2.5, 0)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                value={weight}
                aria-label={isBodyweight ? "Lastre en kilogramos" : "Peso en kilogramos"}
                onChange={(event) => setWeight(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-neutral-950 text-center font-mono text-lg font-bold text-white outline-none focus-visible:border-white/40"
              />
              <button
                type="button"
                aria-label="Subir peso"
                onClick={() => nudge(setWeight, weight, 2.5, 0)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span style={{ fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT.tertiary }}>
              Repeticiones
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Bajar repeticiones"
                onClick={() => nudge(setRepsValue, repsValue, -1, 1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min={1}
                value={repsValue}
                aria-label="Repeticiones"
                onChange={(event) => setRepsValue(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-neutral-950 text-center font-mono text-lg font-bold text-white outline-none focus-visible:border-white/40"
              />
              <button
                type="button"
                aria-label="Subir repeticiones"
                onClick={() => nudge(setRepsValue, repsValue, 1, 1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </label>
        </div>

        <button
          type="button"
          disabled={!canApply}
          onClick={() => {
            if (!canApply) return;
            onApply({ weightKg: weightNumber, reps: repsNumber });
            onClose();
          }}
          style={{
            minHeight: MOTION.minTouchTarget,
            borderRadius: RADIUS.control,
            border: "none",
            background: canApply ? ACCENT.base : SURFACE.sunken,
            color: canApply ? TEXT.onAccent : TEXT.disabled,
            fontSize: TYPE.subhead.size,
            fontWeight: 700,
            cursor: canApply ? "pointer" : "not-allowed",
          }}
        >
          Aplicar sobrecarga
        </button>
      </div>
    </div>
  );
}