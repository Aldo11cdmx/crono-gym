/**
 * ExerciseDetailSheet.tsx — a bottom sheet showing a single exercise in detail.
 *
 * Displays the GIF, name, attributes, and the full instruction list. Slides up
 * from the bottom and supports swipe-to-dismiss via a drag handle.
 */

import { useState } from "react";
import { X, Dumbbell } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import { translateBodyPart, translateTarget, translateEquipment } from "@/lib/i18n";
import { SCRIM } from "@/design/tokens";

export interface ExerciseDetailSheetProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExerciseDetailSheet({ exercise, isOpen, onClose }: ExerciseDetailSheetProps) {
  const [imgError, setImgError] = useState(false);
  if (!exercise) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center transition-all duration-normal ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ backgroundColor: SCRIM.modal }}
      onClick={onClose}
    >
      <div
        className="flex max-w-2xl flex-col rounded-t-[24px] border border-white/10 bg-neutral-950 p-5 pb-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "80vh" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">{exercise.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-xl bg-neutral-900">
          {!imgError && exercise.gif_url ? (
            <img
              src={exercise.gif_url}
              alt={`Animación de ${exercise.name}`}
              className="h-full w-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-600">
              <Dumbbell className="h-10 w-10" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-neutral-300">
            GIF de referencia
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-neutral-400">
            {translateBodyPart(exercise.body_part)}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-neutral-400">
            {translateTarget(exercise.target)}
          </span>
          <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-neutral-400">
            {translateEquipment(exercise.equipment)}
          </span>
        </div>

        {exercise.instructions && exercise.instructions.length > 0 && (
          <div className="mb-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Instrucciones
            </h3>
            <ol className="space-y-1.5 pl-4 text-sm text-neutral-300">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="list-decimal leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
