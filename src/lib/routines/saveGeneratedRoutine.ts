/**
 * saveGeneratedRoutine.ts — writes a generated routine to the two tables that hold one.
 *
 * Its own module because the wizard must be testable without a database, and because the
 * write is the one part of the wizard that is not presentation. The wizard takes a `save`
 * prop and this is the default.
 *
 * Two inserts, and the order is not interchangeable: `routine_exercises.routine_id` is a
 * foreign key, so the routine has to exist first. There is no transaction available from
 * the client, so a failure on the second insert leaves a routine with no exercises -- a
 * row the athlete can see, open, and find empty. The alternative order is worse: exercises
 * pointing at nothing are invisible *and* orphaned.
 *
 * So a partial write is possible and is cleaned up: on failure the routine row is deleted,
 * because a routine that silently has no exercises is worse than no routine at all. That
 * delete is itself allowed by RLS -- the athlete owns the row they just created -- so no
 * service role is involved.
 */

import { supabase } from "@lib/supabase";
import type { GeneratedRoutine } from "@/lib/ai/routineGenerator";

/** True when the write landed. False covers every failure, and says nothing about which. */
export type SaveResult = boolean;

/**
 * Persists a generated routine and returns whether it worked.
 *
 * `source: "ai"` is not optional and not a default: the column exists to answer "is this
 * plan the AI's, mine, or a coach's", and an unattributed row is a row no screen can
 * label. A routine that arrived from a model and then got saved must still say so.
 *
 * Never throws. The caller is a button, and a rejected promise on a click handler leaves
 * the spinner running forever.
 */
export async function saveGeneratedRoutine(
  userId: string,
  routine: GeneratedRoutine,
): Promise<SaveResult> {
  let routineId: string | null = null;

  try {
    const inserted = await supabase
      .from("routines")
      .insert({ user_id: userId, title: routine.name, source: "ai" })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) return false;
    routineId = inserted.data.id;

    /*
     * Flattened with a running index rather than nested, because the column is flat.
     *
     * `order_index` counts within the whole routine, not within the day: a routine is
     * stored as one ordered list, and the day grouping is a property of the generator's
     * output rather than of the schema. Restoring the day grouping on read would need a
     * column that does not exist, which is a TODO and not something to fake here.
     *
     * Reps are dropped, and that is a real gap rather than an omission to be tidied away:
     * `routine_exercises` has no reps columns, so a generated 8-10 becomes a routine that
     * records only the sets. Recorded as a TODO in the wizard's save path comment.
     */
    const rows = routine.days.flatMap((day) =>
      day.exercises.map((exercise, index) => ({
        routine_id: routineId as string,
        exercise_id: exercise.exerciseId,
        target_sets: exercise.sets,
        rest_seconds: exercise.restSeconds,
        order_index: index,
      })),
    );

    if (rows.length === 0) {
      await deleteRoutine(routineId);
      return false;
    }

    const exercises = await supabase.from("routine_exercises").insert(rows);
    if (exercises.error) {
      await deleteRoutine(routineId);
      return false;
    }

    return true;
  } catch {
    if (routineId !== null) await deleteRoutine(routineId);
    return false;
  }
}

/** Best-effort cleanup of a routine whose exercises did not land. Never throws. */
async function deleteRoutine(routineId: string): Promise<void> {
  try {
    await supabase.from("routines").delete().eq("id", routineId);
  } catch {
    // Nothing useful to do. The row is visible to the athlete and deletable from the
    // routines list, so the worst case is an empty routine they can remove.
  }
}