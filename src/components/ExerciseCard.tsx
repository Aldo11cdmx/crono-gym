/**
 * ExerciseCard.tsx — a single exercise in the picker grid.
 *
 * Renders a thumbnail GIF, the exercise name and attribute chips, plus a
 * checkbox overlay for multi-select. Tapping the card toggles selection;
 * tapping the star toggles favorite status.
 */

import { useState } from "react";
import { Dumbbell, Star, Check } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import { translateBodyPart, translateTarget, translateEquipment } from "@/lib/i18n";

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
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-neutral-950/40 transition-all duration-fast ${
        selected
          ? "border-accent ring-2 ring-accent/30"
          : "border-white/10 hover:border-white/20"
      } ${view === "list" ? "flex items-center gap-3 p-2" : "p-0"}`}
    >
      <div
        className={`relative ${
          view === "list" ? "h-16 w-28 flex-shrink-0" : "aspect-video w-full"
        }`}
      >
        {!imgError && exercise.gif_url ? (
          <img
            src={exercise.gif_url}
            alt={`Animación de ${exercise.name}`}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">
            <Dumbbell className="h-8 w-8" />
          </div>
        )}
        {alreadyAdded && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-neutral-300">
            Añadido
          </span>
        )}
      </div>

      {view === "list" && (
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-neutral-100">{exercise.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-neutral-400">
            <span className="rounded-md bg-white/5 px-1.5 py-0.5">
              {translateBodyPart(exercise.body_part)}
            </span>
            <span className="rounded-md bg-white/5 px-1.5 py-0.5">
              {translateTarget(exercise.target)}
            </span>
          </div>
        </div>
      )}

      {view === "grid" && (
        <div className="p-3">
          <h3 className="truncate text-sm font-medium text-neutral-100">{exercise.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-neutral-400">
            <span className="rounded-md bg-white/5 px-1.5 py-0.5">
              {translateBodyPart(exercise.body_part)}
            </span>
            <span className="rounded-md bg-white/5 px-1.5 py-0.5">
              {translateEquipment(exercise.equipment)}
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggleSelect(exercise.id)}
        aria-label={selected ? "Deseleccionar" : "Seleccionar"}
        className={`relative z-20 absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
          selected
            ? "border-accent bg-accent text-neutral-950"
            : "border-neutral-500 bg-neutral-900/60 hover:border-neutral-400"
        }`}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          className={`relative z-20 absolute top-2 left-2 rounded-full p-1 ${
            favorite
              ? "text-accent"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Star className="h-4 w-4" fill={favorite ? "currentColor" : "none"} />
        </button>
      )}

      {oneRepMax !== undefined && (
        <div className="relative z-10 absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-neutral-300">
          1RM: {Math.round(oneRepMax)}
        </div>
      )}

      <button
        type="button"
        onClick={onOpenDetail}
        className="absolute inset-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Ver detalles"
      />
    </div>
  );
}
