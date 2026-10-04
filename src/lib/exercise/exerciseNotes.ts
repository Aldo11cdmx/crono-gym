/**
 * exercise/exerciseNotes.ts — the prose an athlete wrote about a set.
 *
 * `completed_sets.notes` (`20261003040000_exercise_hub_notes.sql`) is the only part of the
 * exercise hub that is not a number, and it is the part an athlete is most likely to have
 * written for their own eyes. So this module treats it as data rather than as a string to
 * display: it bounds what came in, keeps it findable, and never invents one.
 *
 * Why notes are per *set* and not per exercise
 * -------------------------------------------
 * A note about a squat is about that squat, at that weight, that week. An athlete who
 * works up to a pain, stops, and comes back lighter months later needs to read what made
 * it stop *that time*. A single field per exercise is overwritten by the newest attempt,
 * which destroys precisely the record the hub exists to surface. This is the same reason
 * the local store is keyed by `setId` and the same reason the column sits on
 * `completed_sets`.
 *
 * Where this runs
 * ---------------
 * On the write path, before the queue. The bound is duplicated from the SQL `check`
 * constraint on purpose: the constraint is the backstop for a client that is not this one,
 * and enforcing it here as well means an over-long note is rejected with a message the
 * athlete can act on instead of a failed sync they cannot see.
 */

import type { ExerciseSetRecord } from "./exerciseHistory";

export const EXERCISE_NOTES = {
  /**
   * The maximum length, in characters.
   *
   * Equal to the SQL `check (char_length(notes) <= 2000)`. Duplicated rather than imported
   * because Postgres is not reachable from a form; if the two drift, the app either rejects
   * notes the database would have accepted or vice versa, and the second one surfaces as a
   * sync failure on a workout the athlete thought was saved.
   */
  MAX_LENGTH: 2000,

  /**
   * Length at which a note is collapsed behind a "show more".
   *
   * Shorter than the maximum because most notes are one sentence, and the hub shows them
   * inline with the set they belong to. A note that takes over the row hides the weight and
   * reps it was written about.
   */
  INLINE_LENGTH: 280,
} as const;

/** Why a note was not accepted. */
export type NoteRejection = "too_long" | "empty";

export type NoteResult =
  | { ok: true; note: string }
  | { ok: false; reason: NoteRejection };

/**
 * Validates and normalises a note before it is queued.
 *
 * Trims, because a note that is only whitespace is not a note -- and an empty string in
 * this column means "someone deliberately blanked this", which is a different claim from
 * "no note" and is worth being deliberate about. `null` for that case rather than `''`.
 *
 * Length is checked *after* trimming, so a note of 2000 characters plus a trailing newline
 * is accepted. Checking first would reject text the athlete can see fits.
 */
export function normaliseNote(raw: string | null | undefined): NoteResult {
  if (raw === null || raw === undefined) return { ok: true, note: "" };

  const note = raw.trim();

  if (note.length === 0) return { ok: false, reason: "empty" };
  if (note.length > EXERCISE_NOTES.MAX_LENGTH) return { ok: false, reason: "too_long" };

  return { ok: true, note };
}

/** Whether a note would be collapsed inline. */
export function isLongNote(note: string | null | undefined): boolean {
  return typeof note === "string" && note.trim().length > EXERCISE_NOTES.INLINE_LENGTH;
}

/** One set's note, with the set it belongs to. */
export interface NotedSet {
  setId: string;
  logId: string;
  startedAt: string;
  setNumber: number;
  weight: number;
  reps: number | null;
  note: string;
  /** True when the note should be collapsed behind a control. */
  truncated: boolean;
}

/**
 * Every noted set in a history, newest session first.
 *
 * Only sets that *have* a note. The alternative -- returning all sets with a nullable note
 * -- hands every caller a filter to remember, and the one that forgets it renders the whole
 * history as prose.
 *
 * A whitespace-only note is treated as no note, for the reason {@link normaliseNote} treats
 * it as one: the column distinguishes null from empty string, and neither of them is
 * something to show.
 */
export function collectNotes(
  sessions: readonly {
    logId: string;
    startedAt: string;
    sets: readonly ExerciseSetRecord[];
  }[],
): NotedSet[] {
  const noted: NotedSet[] = [];

  for (const session of sessions) {
    for (const set of session.sets) {
      const note = set.notes?.trim();
      if (!note || set.weight === null) continue;

      noted.push({
        setId: set.id,
        logId: session.logId,
        startedAt: session.startedAt,
        setNumber: set.set_number,
        weight: set.weight,
        reps: set.reps,
        note,
        truncated: isLongNote(note),
      });
    }
  }

  return noted;
}

/**
 * The notes from the most recent sessions, newest first.
 *
 * A limit in sessions rather than in notes, because the useful question is "what did I
 * write about this lately" and a note count would let one heavily-annotated session
 * monopolise the list.
 */
export function recentNotes(
  sessions: readonly {
    logId: string;
    startedAt: string;
    sets: readonly ExerciseSetRecord[];
  }[],
  sessionLimit = 5,
): NotedSet[] {
  return collectNotes(sessions.slice(0, Math.max(0, sessionLimit)));
}

/**
 * Every note that mentions a term, case- and accent-insensitively.
 *
 * Accent folding is the part that matters here and the part a naive `.toLowerCase()` gets
 * wrong. An athlete writes "rodilla" in Spanish and searches "rodilla"; but they also write
 * "RÓDILLA" in a shout and search "rodilla", and more importantly a search for "press"
 * has to find "press" and not "Press" while still matching "biceps" against "BÍCEPS". The
 * fold is applied to *both* sides, so the comparison is genuinely accent-blind rather than
 * accidentally so.
 *
 * `String.prototype.normalize` is used rather than a hand-rolled map because the Unicode
 * decomposition tables are the correct answer and they are already in the engine.
 */
export function searchNotes(notes: readonly NotedSet[], term: string): NotedSet[] {
  // Trimmed, not just folded: a box holding only spaces is a cleared box, and treating it as
  // a search for spaces would make the whole list disappear the moment the field is focused
  // and emptied.
  const needle = fold(term.trim());
  if (needle === "") return [...notes];

  return notes.filter((entry) => fold(entry.note).includes(needle));
}

/** Lowercases and strips diacritics, so a search matches across accents. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * How many sets in a history carry a note, and how many could.
 *
 * The ratio is what tells an athlete whether the hub has anything to show them: a
 * percentage of a hundred means the feature is on and being ignored, which is different
 * information from "you have no notes" and worth saying differently.
 */
export interface NoteCoverage {
  noted: number;
  total: number;
  /** 0..1. Exactly 1 when nothing is counted, so it never divides by zero downstream. */
  ratio: number;
}

export function noteCoverage(
  sessions: readonly { sets: readonly ExerciseSetRecord[] }[],
): NoteCoverage {
  let noted = 0;
  let total = 0;

  for (const session of sessions) {
    for (const set of session.sets) {
      total += 1;
      if (set.notes?.trim()) noted += 1;
    }
  }

  return { noted, total, ratio: total === 0 ? 1 : noted / total };
}
