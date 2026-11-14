import { useId } from "react";
import { Gem, X } from "lucide-react";
import {
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
import type { ExerciseRankResult } from "@/lib/workout/cronosSmartEngine";

export interface ExerciseRankSheetProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  rank: ExerciseRankResult;
  /** 1-based number of the set the goal will be written into. */
  pendingSetNumber: number;
  isBodyweight: boolean;
  onUseTarget: (weightKg: number, reps: number) => void;
}

/**
 * The next rank, priced in kilograms and repetitions.
 *
 * A rank nobody can act on is a badge, not a goal. This sheet exists to turn
 * "Esmeralda III" into a number the athlete can load on the bar before the
 * next set, which is why the only primary action writes the target into that
 * set instead of merely closing the sheet.
 */
export function ExerciseRankSheet({
  isOpen,
  onClose,
  exerciseName,
  rank,
  pendingSetNumber,
  isBodyweight,
  onUseTarget,
}: ExerciseRankSheetProps) {
  const titleId = useId();
  if (!isOpen) return null;

  const { currentRank, nextRank } = rank;
  const goalWeight = isBodyweight ? 0 : nextRank.targetWeightKg;
  const goalReps = nextRank.targetReps;

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
          <h3
            id={titleId}
            style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, color: TEXT.primary }}
          >
            Tu siguiente rango
          </h3>
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

        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: RADIUS.card,
            border: `1px solid ${GLASS.border}`,
            background: SURFACE.sunken,
            padding: SPACE.lg,
          }}
        >
          {/* The glow is a layer, not a gradient literal: the tier brings its own
              colour and the surface stays a token. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: nextRank.colorHex,
              opacity: 0.16,
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: SPACE.sm }}>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: nextRank.colorHex, color: TEXT.onAccent }}
              >
                <Gem size={20} strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary, overflowWrap: "break-word" }}>
                  {exerciseName}
                </p>
                <p
                  className="truncate"
                  style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 700, color: TEXT.primary }}
                  title={nextRank.tier}
                >
                  {nextRank.tier}
                </p>
              </div>
            </div>

            <p
              className="font-mono font-extrabold tabular-nums"
              style={{ margin: 0, fontSize: "40px", lineHeight: 1.05, color: TEXT.primary, letterSpacing: "-0.02em" }}
            >
              {isBodyweight ? "0" : goalWeight} <span style={{ color: TEXT.tertiary }}>×</span> {goalReps}
            </p>

            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary, lineHeight: 1.45 }}>
              {nextRank.maxed
                ? "Estás en el rango más alto: mantén la carga y afina las repeticiones."
                : "Elige estos kg × reps en tu próxima serie o mejóralos para obtener el siguiente rango."}
            </p>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px]" style={{ color: TEXT.tertiary }} title={`${currentRank.tier} · hoy`}>
                  {currentRank.tier} · hoy
                </span>
                <span
                  className="shrink-0 text-[11px] font-semibold"
                  style={{ color: nextRank.colorHex }}
                  title={nextRank.tier}
                >
                  {nextRank.tier}
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={currentRank.progressPct}
                aria-label={`Progreso de ${currentRank.tier} a ${nextRank.tier}`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, currentRank.progressPct))}%`,
                    background: currentRank.colorHex,
                    transition: `width ${MOTION.slow} ${MOTION.easeOut}`,
                  }}
                />
              </div>
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                {currentRank.progressPct}% del camino
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onUseTarget(goalWeight, goalReps);
              onClose();
            }}
            className="w-full whitespace-nowrap"
            style={{
              minHeight: 48,
              borderRadius: RADIUS.control,
              border: "none",
              background: TEXT.primary,
              color: TEXT.onAccent,
              fontSize: TYPE.subhead.size,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Usar en la serie {pendingSetNumber}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.secondary,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}