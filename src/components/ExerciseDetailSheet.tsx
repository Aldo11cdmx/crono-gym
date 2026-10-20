/**
 * ExerciseDetailSheet.tsx — a bottom sheet showing a single exercise in detail.
 *
 * Displays the GIF, name, attributes, and the full instruction list. Slides up
 * from the bottom and supports swipe-to-dismiss via a drag handle.
 */

import { X, Dumbbell } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import {
  translateBodyPart,
  translateTarget,
  translateEquipment,
} from "@/lib/i18n";
import {
  GLASS,
  RADIUS,
  SCRIM,
  SOLID,
  SURFACE_ROLE,
  TEXT,
} from "@/design/tokens";

export interface ExerciseDetailSheetProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExerciseDetailSheet({
  exercise,
  isOpen,
  onClose,
}: ExerciseDetailSheetProps) {
  const media = resolveMedia("exercise-gif", exercise?.id ?? "", exercise?.gif_url ?? "");
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  if (!exercise || !isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: SCRIM.modal }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col gap-4 overflow-y-auto p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: SURFACE_ROLE.popover,
          border: `1px solid ${GLASS.border}`,
          borderRadius: RADIUS.sheet,
          boxShadow: GLASS.shadow,
          maxHeight: "80vh",
        }}
      >
        {/* Drag handle */}
        <div
          className="mx-auto h-1.5 w-12 rounded-full"
          style={{ backgroundColor: GLASS.border }}
        />

        <div className="flex items-center justify-between">
          <h2 style={{ color: TEXT.primary }} className="text-xl font-semibold">
            {exercise.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-xl p-1.5"
            style={{ color: TEXT.tertiary }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative mb-4 aspect-video w-full overflow-hidden rounded-xl"
          style={{ backgroundColor: SURFACE_ROLE.well }}
        >
          {!failed && media.url ? (
            <img
              src={src}
              alt={`Animación de ${exercise.name}`}
              className="h-full w-full object-contain"
              onLoad={onLoad}
              onError={onError}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ color: TEXT.tertiary }}
            >
              <Dumbbell className="h-10 w-10" />
            </div>
          )}
          <div
            className="absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10px]"
            style={{
              backgroundColor: SOLID.card,
              color: TEXT.secondary,
            }}
          >
            GIF de referencia
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <span
            className="rounded-md px-2 py-1 text-xs"
            style={{
              backgroundColor: GLASS.fill,
              color: TEXT.tertiary,
            }}
          >
            {translateBodyPart(exercise.body_part)}
          </span>
          <span
            className="rounded-full px-2 py-1 text-xs"
            style={{
              backgroundColor: GLASS.fill,
              color: TEXT.tertiary,
            }}
          >
            {translateTarget(exercise.target)}
          </span>
          <span
            className="rounded-md px-2 py-1 text-xs"
            style={{
              backgroundColor: GLASS.fill,
              color: TEXT.tertiary,
            }}
          >
            {translateEquipment(exercise.equipment)}
          </span>
        </div>

        {exercise.instructions && exercise.instructions.length > 0 && (
          <div className="mb-2">
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: TEXT.tertiary }}
            >
              Instrucciones
            </h3>
            <ol
              className="space-y-1.5 pl-4 text-sm"
              style={{ color: TEXT.secondary }}
            >
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
