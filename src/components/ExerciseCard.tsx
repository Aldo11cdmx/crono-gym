/**
 * ExerciseCard.tsx — a single exercise in the picker grid.
 *
 * Renders a thumbnail GIF, the exercise name and attribute chips, plus a
 * checkbox overlay for multi-select. Tapping the card toggles selection;
 * tapping the star toggles favorite status.
 */

import { Dumbbell, Star, Check } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import {
  translateBodyPart,
  translateTarget,
  translateEquipment,
} from "@/lib/i18n";
import { ACCENT, GLASS, SOLID, SURFACE_ROLE, TEXT } from "@/design/tokens";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

export interface ExerciseCardProps {
  exercise: Exercise;
  selected: boolean;
  alreadyAdded?: boolean;
  favorite?: boolean;
  oneRepMax?: number;
  onToggleSelect: (id: string) => void;
  onToggleFavorite?: () => void;
  onOpenDetail: () => void;
  view?: "grid" | "list";
}

export function ExerciseCard({
  exercise,
  selected,
  alreadyAdded = false,
  favorite = false,
  oneRepMax,
  onToggleSelect,
  onToggleFavorite,
  onOpenDetail,
  view = "grid",
}: ExerciseCardProps) {
  const media = resolveMedia("exercise-gif", exercise.id, exercise.gif_url);
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  const displayName = getExerciseDisplayName(exercise);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-all duration-fast ${
        view === "list" ? "flex items-center gap-3 p-2" : "p-0"
      }`}
      style={{
        backgroundColor: SURFACE_ROLE.card,
        borderColor: selected ? ACCENT.base : GLASS.border,
        boxShadow: selected ? ACCENT.ring : GLASS.shadow,
      }}
    >
      <div
        className={`relative ${
          view === "list" ? "h-16 w-28 flex-shrink-0" : "aspect-video w-full"
        }`}
      >
        {!failed && media.url ? (
          <img
            src={src}
            alt={`Animación de ${displayName}`}
            loading="lazy"
            onLoad={onLoad}
            onError={onError}
            className="h-full w-full object-contain"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ color: TEXT.tertiary }}
          >
            <Dumbbell className="h-8 w-8" />
          </div>
        )}
        {alreadyAdded && (
          <span
            className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px]"
            style={{
              backgroundColor: SOLID.card,
              color: TEXT.secondary,
            }}
          >
            Añadido
          </span>
        )}
      </div>

      {view === "list" && (
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-medium"
            style={{ color: TEXT.primary }}
          >
            {displayName}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
            <span
              className="rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: GLASS.fill, color: TEXT.tertiary }}
            >
              {translateBodyPart(exercise.body_part)}
            </span>
            <span
              className="rounded-md px-1.5 py-0.5"
              style={{
                backgroundColor: GLASS.fill,
                color: TEXT.tertiary,
              }}
            >
              {translateTarget(exercise.target)}
            </span>
          </div>
        </div>
      )}

      {view === "grid" && (
        <div className="p-3">
          <h3
            className="truncate text-sm font-medium"
            style={{ color: TEXT.primary }}
          >
            {displayName}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
            <span
              className="rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: GLASS.fill, color: TEXT.tertiary }}
            >
              {translateBodyPart(exercise.body_part)}
            </span>
            <span
              className="rounded-md px-1.5 py-0.5"
              style={{
                backgroundColor: GLASS.fill,
                color: TEXT.tertiary,
              }}
            >
              {translateEquipment(exercise.equipment)}
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggleSelect(exercise.id)}
        aria-label={selected ? "Deseleccionar" : "Seleccionar"}
        className="relative z-20 absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all"
        style={{
          borderColor: selected ? ACCENT.base : TEXT.disabled,
          backgroundColor: selected ? ACCENT.base : SOLID.card,
          color: TEXT.onAccent,
        }}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          className="relative z-20 absolute top-2 left-2 rounded-full p-1"
          style={{
            color: favorite ? ACCENT.text : TEXT.tertiary,
          }}
        >
          <Star className="h-4 w-4" fill={favorite ? "currentColor" : "none"} />
        </button>
      )}

      {oneRepMax !== undefined && (
        <div
          className="relative z-10 absolute bottom-2 right-2 rounded-md px-1.5 py-0.5 text-[10px]"
          style={{
            backgroundColor: SOLID.card,
            color: TEXT.secondary,
          }}
        >
          1RM: {Math.round(oneRepMax)}
        </div>
      )}

      <button
        type="button"
        onClick={onOpenDetail}
        className="absolute inset-0 rounded-xl"
        aria-label="Ver detalles"
      />
    </div>
  );
}
