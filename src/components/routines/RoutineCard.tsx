import { MoreHorizontal, Play, Star } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import type { RoutineWithExercises } from "@/hooks/useGymData";

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
  const incomplete = routineIsIncomplete(routine);
  const trainingDisabled = incomplete;

  return (
    <div onClick={onEdit} className="cursor-pointer">
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="text-xs text-neutral-500">{modeLabel(routine.routineMode)}</span>
            <h2 className="truncate text-neutral-100" title={routine.title}>
              {routine.title}
            </h2>
          </div>
          <GlassButton
            variant="ghost"
            icon={<Star size={16} />}
            disabled
            aria-label="Favoritos (no disponible en esta versión)"
            className="shrink-0"
          />
        </div>

        <div className="flex items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          <span>{dayCount} {dayCount === 1 ? "día" : "días"}</span>
          <span aria-hidden="true">·</span>
          <span>{exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"}</span>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <GlassButton
            variant="primary"
            icon={<Play size={16} />}
            onClick={(e) => {
              e.stopPropagation();
              onTrain(routine);
            }}
            disabled={trainingDisabled}
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
    </div>
  );
}