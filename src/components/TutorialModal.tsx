/**
 * TutorialModal.tsx — step-by-step instructions for one exercise.
 *
 * Kept as a modal rather than an inline panel so it does not shift the set
 * rows when dismissed; during a workout a layout jump costs a rep.
 */

import { X } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

interface TutorialModalProps {
  exercise: Exercise;
  onClose: () => void;
}

export function TutorialModal({ exercise, onClose }: TutorialModalProps) {
  const steps = exercise.instructions ?? [];
  const media = resolveMedia("exercise-gif", exercise.id, exercise.gif_url);
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  const displayName = getExerciseDisplayName(exercise);


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial de ${displayName}`}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900/95 p-5 shadow-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{displayName}</h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {exercise.body_part} · {exercise.target}
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

        <div className="mb-4 aspect-video w-full overflow-hidden rounded-xl bg-neutral-950">
          {media.url && !failed && (
            <img
              src={src}
              alt={`Animación de ${displayName}`}
              className="h-full w-full object-contain"
              onLoad={onLoad}
              onError={onError}
            />
          )}
        </div>

        {steps.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Este ejercicio no tiene instrucciones en el catálogo.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
                  {index + 1}
                </span>
                <span className="text-[13px] leading-relaxed text-neutral-300">{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}