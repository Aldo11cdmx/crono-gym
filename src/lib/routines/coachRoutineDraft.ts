/**
 * coachRoutineDraft.ts — what a coach has built, and whether it is worth saving.
 *
 * Its own module because the shape is shared between the builder that edits it and the
 * function that persists it, and because the validation is the only part of this feature
 * that is not presentation. Neither should have to import the other to agree on what a
 * finished routine looks like.
 *
 * Nothing here talks to a database, so it can be tested against a literal -- which matters
 * more than usual here, because the rule below is the one that keeps a half-written plan out
 * of an athlete's library.
 */

export interface CoachRoutineExercise {
  /** A row that exists in `exercises`. Never invented: see {@link isSavableDraft}. */
  exerciseId: string;
  /**
   * The name shown for `exerciseId`, remembered when the coach picks it.
   *
   * Not persisted -- `saveCoachRoutine` builds its insert rows field by field, so this never
   * reaches a column. It is here because a coach who has just built a four-day split should
   * see the same names when they come back to this screen, and re-deriving them would mean
   * trusting a search over 1,300 rows to return the same answer twice.
   */
  exerciseName?: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

export interface CoachRoutineDay {
  /** The coach's own name for the day. May be empty; the reader falls back to "Día n". */
  label: string;
  exercises: CoachRoutineExercise[];
}

export interface CoachRoutineDraft {
  title: string;
  days: CoachRoutineDay[];
}

/** A draft with a real title and at least one day holding one exercise. */
export type DraftProblem =
  | "noTitle"
  | "noExercises"
  | "unpickedExercise"
  | "noCoachId";

/**
 * Why this draft cannot be saved, or null when it can.
 *
 * Four reasons and no others, each with a message that names the fix rather than the
 * failure:
 *
 *  - `noTitle` -- a routine with no name is a list of movements, and the athlete's library
 *    shows this column as the routine's identity.
 *  - `noExercises` -- an empty routine is refused outright rather than written and then
 *    deleted, so this is checked before the first insert and not after it.
 *  - `unpickedExercise` -- a day has an exercise *row* whose catalogue entry was never
 *    chosen. Distinct from `noExercises` because the coach has clearly started building and
 *    the fix is one tap on a search result, and telling them to "add an exercise" would send
 *    them off to write a second row instead. Without this check the save is merely refused
 *    by the foreign key and the button reports a server error for something the coach can
 *    fix on screen.
 *  - `noCoachId` -- `authored_by_coach` is what makes the compensating delete legal, so a
 *    save without it would write a row nobody can clean up if the second insert failed.
 *    `getCoachId()` returns null in exactly one situation worth naming: a coach session
 *    held before this build, on a page loaded before the id was stored.
 *
 * Returning a code rather than a boolean so the caller can show the specific message; the
 * labels for all four are already written in `COACH_PORTAL_LABELS`.
 */
export function draftProblem(
  draft: CoachRoutineDraft,
  coachId: string | null,
): DraftProblem | null {
  if (coachId === null || coachId === "") return "noCoachId";
  if (draft.title.trim() === "") return "noTitle";

  const chosen = draft.days.flatMap((day) => day.exercises).filter((e) => e.exerciseId !== "");
  if (chosen.length === 0) {
    // No row at all, or rows whose exercise was never picked. Which of the two decides what
    // the coach is told, so it is decided here rather than in the caller's JSX.
    const rows = draft.days.reduce((total, day) => total + day.exercises.length, 0);
    return rows === 0 ? "noExercises" : "unpickedExercise";
  }

  return null;
}

/**
 * The exercises that would actually be written.
 *
 * Days with nothing in them are dropped rather than sent as an empty row: `routine_exercises`
 * has no notion of an empty day, so a day with no exercises can only be represented by
 * absence -- and `day_index` is positional, so an empty day in the middle would leave a hole
 * that the reader has to guess at. Dropping them keeps the indices contiguous.
 */
export function filledDays(draft: CoachRoutineDraft): CoachRoutineDay[] {
  return draft.days
    .map((day) => ({ ...day, exercises: day.exercises.filter((e) => e.exerciseId !== "") }))
    .filter((day) => day.exercises.length > 0);
}