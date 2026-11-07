import { MoreHorizontal, Play, Star } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { TYPE } from "@/design/tokens";

interface RoutineCardProps {
  routine: RoutineWithExercises;
  onTrain: () => void;
  onEdit: () => void;
}

export function RoutineCard({ routine, onTrain, onEdit }: RoutineCardProps) {
  const exerciseCount = routine.exercises.length;
  const dayCount = new Set(
    routine.exercises.map((e) => e.dayIndex ?? 0),
  ).size;

  return (
    <div onClick={onEdit} className="cursor-pointer">
      <GlassCard raised className="hover:border-white/20 transition-colors">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              className="text-neutral-100 truncate"
              style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}
              title={routine.title}
            >
              {routine.title}
            </h2>
            <GlassButton
              variant="ghost"
              icon={<Star />}
              aria-label={routine.is_favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            />
          </div>
          {routine.description && (
            <p
              className="text-neutral-400 line-clamp-2"
              style={{ fontSize: TYPE.subhead.size, lineHeight: TYPE.subhead.lineHeight }}
            >
              {routine.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-neutral-500" style={{ fontSize: TYPE.caption.size }}>
            <span>{dayCount} {dayCount === 1 ? "día" : "días"}</span>
            <span>·</span>
            <span>{exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"}</span>
          </div>
          <div className="flex gap-2">
            <GlassButton
              variant="primary"
              icon={<Play />}
              onClick={(e) => {
                e.stopPropagation();
                onTrain();
              }}
              block
            >
              Entrenar
            </GlassButton>
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
