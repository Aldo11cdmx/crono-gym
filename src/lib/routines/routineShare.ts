/**
 * routineShare.ts — pure-logic view model for sharing a routine.
 *
 * The share text exposes only the information a teammate needs to recreate the
 * workout: the routine title, a one-line summary (exercise count + duration),
 * and each exercise with its sets/reps.
 *
 * STRICT PRIVACY RULE: no personal data is ever emitted. The `Routine` row and
 * `Exercise` row do not carry personal data, but the share formatter is written
 * against a deliberately narrow input type (`ShareableRoutine`) so a future
 * schema change that adds a personal column can never leak it through this path.
 */

import type { Exercise } from "@/types/supabase";
import { getExerciseName, getRepLabel, estimateRoutineDuration } from "./routineDraftModel";
import type { DraftExercise } from "./routineDraftModel";

export interface ShareableRoutine {
  title: string;
  description: string | null;
  items: DraftExercise[];
}

export const DUPLICATE_SUFFIX = " (copia)";

/**
 * Produces a plain-text summary of a routine for the share / clipboard path.
 *
 * Format:
 * ```
 * Rutina: Push Day
 * 5 ejercicios • ~45 min
 *
 * 1. Press Inclinado (4 series × 8-10 reps)
 * 2. Press de Banca (3 series × 10 reps)
 * ...
 * ```
 *
 * Personal data (user_id, bodyweight, height, goals, notes, injuries) is never
 * part of `ShareableRoutine`, so it cannot appear in the output.
 */
export function formatShareText(routine: ShareableRoutine): string {
  const lines: string[] = [];
  lines.push(`Rutina: ${routine.title}`);

  const exerciseCount = routine.items.length;
  const countLabel =
    exerciseCount === 1 ? "1 ejercicio" : `${exerciseCount} ejercicios`;
  const duration = estimateRoutineDuration({
    id: null,
    title: routine.title,
    description: routine.description ?? "",
    dayIndex: 0,
    dayLabel: "",
    items: routine.items,
  });
  lines.push(`${countLabel} • ~${duration} min`);

  if (routine.description && routine.description.trim() !== "") {
    lines.push(``);
    lines.push(routine.description.trim());
  }

  if (routine.items.length > 0) {
    lines.push(``);
    for (let i = 0; i < routine.items.length; i++) {
      const item = routine.items[i];
      const label = getRepLabel(item);
      lines.push(`${i + 1}. ${getExerciseName(item.exercise)} (${label})`);
    }
  }

  return lines.join("\n");
}

/**
 * Sanitises a routine for sharing by projecting it onto the narrow
 * `ShareableRoutine` shape, which omits every personal-data field.
 *
 * Only `title`, `description`, exercise names, sets, reps and rest are
 * carried forward — never `user_id`, bodyweight, height, notes or injuries.
 */
export function sanitizeForShare(routine: ShareableRoutine): ShareableRoutine {
  return {
    title: routine.title,
    description: routine.description,
    items: routine.items.map((item) => ({
      exercise: {
        id: item.exercise.id,
        name: item.exercise.name,
        body_part: item.exercise.body_part,
        target: item.exercise.target,
        equipment: item.exercise.equipment,
        gif_url: item.exercise.gif_url,
        instructions: item.exercise.instructions,
      } as Exercise,
      target_sets: item.target_sets,
      rest_seconds: item.rest_seconds,
      order_index: item.order_index,
      target_reps_min: item.target_reps_min,
      target_reps_max: item.target_reps_max,
    })),
  };
}

/**
 * Attempts to share `text` via the Web Share API.
 *
 * Falls back to writing to the clipboard when `navigator.share` is unavailable
 * or rejects. Returns `true` when shared natively, `false` when the clipboard
 * fallback was used.
 */
export async function shareRoutineText(
  title: string,
  text: string,
): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      /* Fall through to clipboard fallback. */
    }
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(text);
    return false;
  }

  return false;
}
