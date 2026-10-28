/**
 * saveCoachRoutine.ts — the coach writing a routine straight into an athlete's library.
 *
 * The same two-insert shape as `saveGeneratedRoutine`, and for the same reason: there is no
 * transaction available from the browser client, so the second insert can fail after the
 * first has landed. The compensating delete is the whole design, and it is legal here for a
 * reason it would not have been six migrations ago -- see below.
 *
 * **The delete is scoped by `authored_by_coach`, and that column is why the migration
 * exists.** The coach has no DELETE policy on `routines` at all: an athlete's routines are
 * not theirs to delete. `20261003030000_coach_portal.sql` adds
 * `for delete using (authored_by_coach = <the calling coach>)`, so a coach can clean up the
 * half-routine they just started writing and cannot delete anything an athlete wrote. That
 * is also the whole reason the column is not optional metadata: without it there is no
 * cleanup, and a failed save would leave a routine the athlete can see, open, and find
 * empty.
 *
 * **`source` and `authored_by_coach` are both required, and neither defaults.** `source`
 * answers "whose plan is this" on the athlete's own library screen, and `authored_by_coach`
 * is the only thing that makes the delete above possible. A routine saved from this screen
 * with either one defaulted would be a coach's plan the athlete sees as unattributed and the
 * coach cannot clean up.
 */

import { supabase } from "@lib/supabase";
import type { CoachRoutineDraft } from "./coachRoutineDraft";

/**
 * Persists a coach's routine for an athlete and returns whether it worked.
 *
 * Never throws. The caller is a button, and a rejected promise on a click handler leaves the
 * spinner running forever.
 */
export async function saveCoachRoutine(
  athleteId: string,
  coachId: string,
  draft: CoachRoutineDraft,
): Promise<boolean> {
  let routineId: string | null = null;

  try {
    const inserted = await supabase
      .from("routines")
      .insert({
        user_id: athleteId,
        title: draft.title,
        source: "human_coach",
        authored_by_coach: coachId,
      })
      .select("id")
      .single();

    if (inserted.error || !inserted.data) return false;
    routineId = inserted.data.id;

    /*
     * Flattened with `order_index` counting *within* the day.
     *
     * `order_index` used to be the only ordering column and therefore counted across the
     * routine; `20261003030000_coach_portal.sql` added `day_index` and redefined this one as
     * the within-day position. A counter that restarts at each day is what makes
     * `(day_index, order_index)` a total order -- which is the index the migration added.
     *
     * `filledDays` first: a day with no exercises has no row to point at, and since
     * `day_index` is positional, leaving one in the middle would punch a hole in the
     * sequence the reader groups by.
     */
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
          /*
           * The reps, which `saveGeneratedRoutine` has to drop because the columns did not
           * exist when it was written. This path writes them: a coach prescribing "8-10" and
           * the athlete only being able to see "4 series" is a plan that lost its point on the
           * way to the database.
           */
          target_reps_min: exercise.repsMin,
          target_reps_max: exercise.repsMax,
        })),
    );

    /*
     * A routine with no exercises is refused outright rather than inserted and then deleted.
     *
     * The UI already blocks this, so reaching it means the two disagree -- and the cheaper
     * repair is to never write the row than to write it and roll it back.
     */
    if (rows.length === 0) return false;

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

/**
 * Best-effort cleanup of a routine whose exercises did not land.
 *
 * Filtered by id alone, and that is not an oversight. The DELETE policy reads
 * `using (authored_by_coach = <the calling coach>)`, and "the calling coach" is derived from
 * `auth.uid()` on the server -- there is no client-supplied value to compare, and passing one
 * would be a filter the policy has no use for. If the policy refuses, this delete does
 * nothing, which is the correct outcome: it means the row is not one this coach authored.
 *
 * The failure is swallowed rather than surfaced. By this point the athlete can already see
 * the row and delete it from their own library, so a second error here would replace one
 * honest failure with a less useful one.
 */
async function deleteRoutine(routineId: string): Promise<void> {
  try {
    await supabase.from("routines").delete().eq("id", routineId);
  } catch {
    // Nothing useful to do; see the note above.
  }
}