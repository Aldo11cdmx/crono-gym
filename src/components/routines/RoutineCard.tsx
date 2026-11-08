import { MoreHorizontal, Play, Star } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { ACCENT, GLASS, STATUS, TEXT, TYPE } from "@/design/tokens";

type RoutineCardRoutine = RoutineWithExercises & {
  routineMode: "single" | "weekly" | "legacy";
  is_favorite?: boolean;
};

interface RoutineCardProps {
  routine: RoutineCardRoutine;
  onTrain: (routine: RoutineCardRoutine) => void;
  onEdit: () => void;
  onPlan?: () => void;
}

function routineIsIncomplete(routine: RoutineWithExercises): boolean {
  const desc = routine.description ?? "";
  const hasBridge = desc.startsWith("{");
  const hasExercises = routine.exercises.length > 0;
  return hasBridge && !hasExercises;
}

function dayCountFromExercises(routine: RoutineWithExercises): number {
  return new Set(routine.exercises.map((e) => e.dayIndex ?? 0)).size;
}

function modeLabel(mode: RoutineCardRoutine["routineMode"]): string {
  if (mode === "weekly") return "Semanal";
  if (mode === "legacy") return "Sin clasificar";
  return "Individual";
}

export function RoutineCard({
  routine,
  onTrain,
  onEdit,
  onPlan,
}: RoutineCardProps) {
  const exerciseCount = routine.exercises.length;
  const dayCount = dayCountFromExercises(routine);
  const isWeekly = routine.routineMode === "weekly";
  const isLegacy = routine.routineMode === "legacy";
  const incomplete = routineIsIncomplete(routine);
  const trainingDisabled = incomplete;

  const statusLabel = incomplete ? "Guardado incompleto" : null;
  const statusHint = incomplete
    ? "Tiene días de entrenamiento sin ejercicios. Ábrela para reconstruirla."
    : isLegacy
      ? "Rutina sin plan. Ábrela para clasificarla."
      : null;

  const modeTone = isWeekly
    ? { color: ACCENT.text, background: ACCENT.subtle, border: ACCENT.border }
    : isLegacy
      ? { color: TEXT.secondary, background: GLASS.fillSubtle, border: GLASS.border }
      : { color: TEXT.secondary, background: GLASS.fillSubtle, border: GLASS.border };

  return (
    <div onClick={onEdit} className="cursor-pointer">
      <GlassCard raised className="h-full transition-colors" style={{ minHeight: 196 }}>
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full border px-2 py-0.5"
                  style={{
                    fontSize: TYPE.label.size,
                    fontWeight: TYPE.label.weight,
                    letterSpacing: TYPE.label.tracking,
                    textTransform: "uppercase",
                    color: modeTone.color,
                    background: modeTone.background,
                    borderColor: modeTone.border,
                  }}
                >
                  {modeLabel(routine.routineMode)}
                </span>
                {routine.is_favorite ? (
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5"
                    style={{
                      fontSize: TYPE.label.size,
                      fontWeight: TYPE.label.weight,
                      letterSpacing: TYPE.label.tracking,
                      textTransform: "uppercase",
                      color: STATUS.warning.text,
                      background: STATUS.warning.muted,
                      borderColor: STATUS.warning.border,
                    }}
                  >
                    Favorita
                  </span>
                ) : null}
              </div>
              <h2
                className="text-neutral-100"
                style={{
                  fontSize: TYPE.headline.size,
                  fontWeight: TYPE.headline.weight,
                  lineHeight: TYPE.headline.lineHeight,
                  overflowWrap: "anywhere",
                }}
                title={routine.title}
              >
                {routine.title}
              </h2>
            </div>
            <GlassButton
              variant="ghost"
              icon={<Star size={16} fill={routine.is_favorite ? "currentColor" : "none"} />}
              disabled
              aria-label="Favoritos (no disponible en esta versión)"
              className="shrink-0"
            />
          </div>

          {(routine.description ?? "") && !routine.description?.startsWith("{") ? (
            <p
              className="line-clamp-2 text-neutral-400"
              style={{ fontSize: TYPE.subhead.size, lineHeight: TYPE.subhead.lineHeight }}
            >
              {routine.description}
            </p>
          ) : null}

          {statusLabel ? (
            <div
              className="rounded-2xl border px-3 py-2"
              style={{
                borderColor: STATUS.error.border,
                background: STATUS.error.muted,
                color: STATUS.error.text,
              }}
            >
              <p style={{ fontSize: TYPE.caption.size, fontWeight: 600 }}>{statusLabel}</p>
              <p className="mt-1 opacity-90" style={{ fontSize: TYPE.caption.size }}>
                {statusHint}
              </p>
            </div>
          ) : !incomplete ? (
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-500"
              style={{ fontSize: TYPE.caption.size }}
            >
              <span>
                {dayCount} {dayCount === 1 ? "día" : "días"}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"}
              </span>
            </div>
          ) : null}

          <div className="mt-auto flex items-center gap-2 pt-1">
            <GlassButton
              variant="primary"
              icon={<Play size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onTrain(routine);
              }}
              disabled={trainingDisabled}
              block
              aria-label={`Entrenar ${routine.title}`}
            >
              Entrenar
            </GlassButton>
            {onPlan && isWeekly ? (
              <GlassButton
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlan();
                }}
                aria-label={`Planificar ${routine.title}`}
              >
                Planificar
              </GlassButton>
            ) : null}
            <GlassButton
              variant="ghost"
              icon={<MoreHorizontal size={16} />}
              aria-label="Más opciones"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
