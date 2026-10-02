/**
 * ExercisePanel.tsx — hero GIF plus quick actions for the selected exercise.
 *
 * Sits directly above the set rows so the lifter does not lose their place:
 * seeing the movement and its instructions one tap away is the difference
 * between 5 seconds and a walk to another screen mid-set.
 */

import { useState } from "react";
import { BookOpen, Dumbbell, RefreshCcw, X } from "lucide-react";
import type { Exercise } from "@/types/supabase";

interface ExercisePanelProps {
  exercise: Exercise;
  onOpenTutorial: () => void;
  onOpenNotes: () => void;
  onReplace: () => void;
  onClose: () => void;
}

export function ExercisePanel({
  exercise,
  onOpenTutorial,
  onOpenNotes,
  onReplace,
  onClose,
}: ExercisePanelProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 shadow-glass">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-neutral-50">{exercise.name}</h3>
          <p className="mt-0.5 truncate text-[11px] text-neutral-500">
            {exercise.body_part} · {exercise.target} · {exercise.equipment}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel del ejercicio"
          className="shrink-0 rounded-lg p-1 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative aspect-video w-full bg-neutral-950">
        {!imgError && exercise.gif_url ? (
          <img
            key={exercise.gif_url}
            src={exercise.gif_url}
            alt={`Animación de ${exercise.name}`}
            className="h-full w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-600">
            <Dumbbell className="h-7 w-7" />
            <span className="text-[11px]">Animación no disponible</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <QuickAction
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Tutorial"
          hint={
            exercise.instructions?.length
              ? `${exercise.instructions.length} pasos`
              : "Sin pasos"
          }
          onClick={onOpenTutorial}
        />
        <QuickAction
          icon={<Dumbbell className="h-3.5 w-3.5" />}
          label="Notas"
          hint="Por serie"
          onClick={onOpenNotes}
        />
        <QuickAction
          icon={<RefreshCcw className="h-3.5 w-3.5" />}
          label="Reemplazar"
          hint="Otro ejercicio"
          onClick={onReplace}
        />
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-neutral-950/40 px-2 py-2.5 transition hover:border-accent/50 hover:bg-accent/5"
    >
      <span className="text-accent">{icon}</span>
      <span className="text-[11px] font-medium text-neutral-200">{label}</span>
      <span className="text-[10px] leading-tight text-neutral-500">{hint}</span>
    </button>
  );
}