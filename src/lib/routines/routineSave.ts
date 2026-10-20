/**
 * routineSave.ts — persists a `RoutineDraft` to the `routines` and
 * `routine_exercises` tables.
 *
 * Two inserts, in order: the routine row first (so the FK resolves), then the
 * exercise rows. There is no transaction from the browser client, so a failure
 * on the second insert leaves an empty routine; that row is deleted by the
 * compensating `cleanupOrphanedRoutine` before the function returns false.
 *
 * The same shape as `saveCoachRoutine` and `saveGeneratedRoutine`, but writes
 * `source` as the parameter default (which the column defaults to "user") and
 * does not set `authored_by_coach`. The athlete owns the row and the existing
 * RLS delete policy covers them.
 */

import { supabase } from "@lib/supabase";
import type { RoutineDraft } from "./routineDraftModel";
import { DUPLICATE_SUFFIX } from "./routineShare";

export type SaveResult = boolean;

/**
 * Persists a draft. Returns false on any failure, including a draft that
 * fails validation — the caller should check `isSavableDraft` first, but the
 * guard here means a caller that skips it still cannot corrupt the tables.
 *
 * Never throws. The caller is a button, and a rejected promise on a click
 * handler leaves the spinner running forever.
 */
export async function saveRoutine(
  userId: string,
  draft: RoutineDraft,
  source: "user" | "human_coach" | "ai" = "user",
): Promise<SaveResult> {
  let routineId: string | null = null;

  try {
    if (draft.id !== null) {
      const updated = await supabase
        .from("routines")
        .update({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
        })
        .eq("id", draft.id)
        .eq("user_id", userId)
        .select("id")
        .single();

      if (updated.error || !updated.data) return false;
      routineId = updated.data.id;

      const cleared = await supabase
        .from("routine_exercises")
        .delete()
        .eq("routine_id", routineId);
      if (cleared.error) return false;
    } else {
      const inserted = await supabase
        .from("routines")
        .insert({
          user_id: userId,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          source,
        })
        .select("id")
        .single();

      if (inserted.error || !inserted.data) return false;
      routineId = inserted.data.id;
    }

    if (draft.items.length === 0) {
      await cleanupOrphanedRoutine(routineId);
      return false;
    }

    /*
     * The rows are listed field by field on purpose.
     *
     * Spreading the draft item instead would send whatever the client model
     * carries, and the client model already knows about `groupId` -- a column
     * the table does not have yet. PostgREST rejects the whole insert when it
     * is handed a column it cannot find, so a routine would stop saving
     * entirely. The grouping is written when the column lands.
     */
    const rows = draft.items.map((item) => ({
      routine_id: routineId as string,
      exercise_id: item.exercise.id,
      target_sets: item.target_sets,
      rest_seconds: item.rest_seconds,
      order_index: item.order_index,
      day_index: draft.dayIndex,
      day_label: draft.dayLabel,
      target_reps_min: item.target_reps_min,
      target_reps_max: item.target_reps_max,
    }));

    const result = await supabase.from("routine_exercises").insert(rows);
    if (result.error) {
      await cleanupOrphanedRoutine(routineId);
      return false;
    }

    return true;
  } catch {
    if (routineId !== null) await cleanupOrphanedRoutine(routineId);
    return false;
  }
}

/**
 * Creates an independent copy of `routine` with the suffix `(copia)` on the
 * title. The new routine is owned by `userId`, carries the same exercises,
 * sets, reps and rest — but a fresh `created_at` (server default) and `id`.
 *
 * The original routine is never touched.
 *
 * @returns the new routine id, or null on failure.
 */
export async function duplicateRoutine(
  userId: string,
  routine: {
    id: string;
    title: string;
    description: string | null;
    exercises: {
      exercise_id: string;
      target_sets: number;
      rest_seconds: number;
      order_index: number;
      day_index: number;
      day_label: string;
      target_reps_min: number | null;
      target_reps_max: number | null;
    }[];
  },
  source: "user" | "human_coach" | "ai" = "user",
): Promise<string | null> {
  const duplicateTitle = `${routine.title}${DUPLICATE_SUFFIX}`;
  let routineId: string | null = null;

  try {
    const inserted = await supabase
      .from("routines")
      .insert({
        user_id: userId,
        title: duplicateTitle,
        description: routine.description,
        source,
      })
      .select("id")
      .single();

    if (inserted.error || !inserted.data) return null;
    routineId = inserted.data.id;

    if (routine.exercises.length > 0) {
      const rows = routine.exercises.map((pe) => ({
        routine_id: routineId as string,
        exercise_id: pe.exercise_id,
        target_sets: pe.target_sets,
        rest_seconds: pe.rest_seconds,
        order_index: pe.order_index,
        day_index: pe.day_index,
        day_label: pe.day_label,
        target_reps_min: pe.target_reps_min,
        target_reps_max: pe.target_reps_max,
      }));

      const result = await supabase.from("routine_exercises").insert(rows);
      if (result.error) {
        await cleanupOrphanedRoutine(routineId);
        return null;
      }
    }

    return routineId;
  } catch {
    if (routineId !== null) await cleanupOrphanedRoutine(routineId);
    return null;
  }
}

/** Best-effort cleanup of a routine whose exercises did not land. Never throws. */
async function cleanupOrphanedRoutine(routineId: string): Promise<void> {
  try {
    await supabase.from("routines").delete().eq("id", routineId);
  } catch {
    /* Row is visible to the athlete and deletable from the list; nothing
     * useful to do here beyond not throwing. */
  }
}
