import { MoreHorizontal, Play, Star } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { TYPE } from "@/design/tokens";

interface RoutineCardProps {
  routine: RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" };
  onTrain: () => void;
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

  // E5: Iniciar entrenamiento aún no implementado; el botón primario se muestra deshabilitado.
  const trainingDisabled = true;

  const statusLabel = incomplete ? "Guardado incompleto" : null;
  const statusHint = incomplete
    ? "Tiene días de entrenamiento sin ejercicios. Ábrela para reconstruirla."
    : isLegacy
      ? "Rutina sin plan. Ábrela para clasificarla."
      : null;

  return (
    <div onClick={onEdit} className="cursor-pointer">
      <GlassCard raised className="hover:border-white/20 transition-colors">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2
                className="text-neutral-100 truncate"
                style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}
                title={routine.title}
              >
                {routine.title}
              </h2>
              {isWeekly && (
                <span className="text-xs px-2 py-0.5 rounded-full text-accent bg-accent/10" style={{ fontSize: "10px" }}>
                  Semanal
                </span>
              )}
              {isLegacy && (
                <span className="text-xs px-2 py-0.5 rounded-full text-neutral-400 bg-neutral-800/50" style={{ fontSize: "10px" }}>
                  Sin clasificar
                </span>
              )}
            </div>
            <GlassButton
              variant="ghost"
              icon={<Star />}
              disabled
              aria-label="Favoritos (no disponible en esta versión)"
            />
          </div>
          {(routine.description ?? "") && (
            <p
              className="text-neutral-400 line-clamp-2"
              style={{ fontSize: TYPE.subhead.size, lineHeight: TYPE.subhead.lineHeight }}
            >
              {routine.description}
            </p>
          )}
          {statusLabel && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <p className="font-medium">{statusLabel}</p>
              <p className="text-red-400/70 mt-1">{statusHint}</p>
            </div>
          )}
          {!incomplete && !isLegacy && (
            <div className="flex items-center gap-3 text-neutral-500" style={{ fontSize: TYPE.caption.size }}>
              <span>{dayCount} {dayCount === 1 ? "día" : "días"}</span>
              <span>·</span>
              <span>{exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"}</span>
            </div>
          )}
          <div className="flex gap-2">
            <GlassButton
              variant="primary"
              icon={<Play />}
              onClick={(e) => {
                e.stopPropagation();
                onTrain();
              }}
              disabled={trainingDisabled}
              block
              aria-label="Entrenar (próximamente)"
            >
              Entrenar
            </GlassButton>
            {onPlan && isWeekly && (
              <GlassButton variant="ghost" onClick={(e) => { e.stopPropagation(); onPlan(); }} aria-label={`Planificar ${routine.title}`}>
                Planificar
              </GlassButton>
            )}
            <GlassButton
              variant="ghost"
              icon={<MoreHorizontal />}
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
