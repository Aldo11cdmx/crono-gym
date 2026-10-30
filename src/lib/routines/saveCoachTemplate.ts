/**
 * saveCoachTemplate.ts — guarda una plantilla base global del coach.
 *
 * Misma estructura de dos inserciones que `saveCoachRoutine`, pero la rutina
 * se escribe con `user_id = coachId` (el coach es el dueño de la plantilla),
 * `is_template: true` y `source: "human_coach"`. Así cualquier coach puede
 * leerla (política `routines_select_templates`) y asignarla a cualquier atleta
 * desde `AthleteDetailView`.
 *
 * Nunca lanza. El llamador es un botón.
 */

import { supabase } from "@lib/supabase";
import type { CoachRoutineDraft } from "./coachRoutineDraft";

export async function saveCoachTemplate(
  coachId: string,
  draft: CoachRoutineDraft,
): Promise<boolean> {
  let routineId: string | null = null;

  try {
    const inserted = await supabase
      .from("routines")
      .insert({
        user_id: coachId,
        title: draft.title,
        source: "human_coach",
        authored_by_coach: coachId,
        is_template: true,
      })
      .select("id")
      .single();

    if (inserted.error || !inserted.data) return false;
    routineId = inserted.data.id;

    const rows = draft.days.flatMap((day, dayIndex) =>
      day.exercises
        .filter((exercise) => exercise.exerciseId !== "")
        .map((exercise, index) => ({
          routine_id: routineId as string,
          exercise_id: exercise.exerciseId,
          target_sets: exercise.sets,
          rest_seconds: exercise.restSeconds,
          order_index: index,
          day_index: dayIndex,
          day_label: day.label,
          target_reps_min: exercise.repsMin,
          target_reps_max: exercise.repsMax,
        })),
    );

    if (rows.length === 0) return false;

    const exercises = await supabase.from("routine_exercises").insert(rows);
    if (exercises.error) {
      await deleteTemplate(routineId);
      return false;
    }

    return true;
  } catch {
    if (routineId !== null) await deleteTemplate(routineId);
    return false;
  }
}

async function deleteTemplate(routineId: string): Promise<void> {
  try {
    await supabase.from("routines").delete().eq("id", routineId);
  } catch {
    // Nothing useful to do.
  }
}
