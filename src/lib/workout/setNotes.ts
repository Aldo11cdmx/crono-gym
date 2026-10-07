/**
 * workout/setNotes.ts — the per-set note, as data rather than as a string.
 *
 * The note is the one field on a set that is prose, and prose is where
 * validation lives or rots: a field that silently truncates at the wrong
 * boundary writes a sentence the athlete never agreed to, and one that
 * saves `"   "` as a note pollutes the history query the hub runs. So the
 * trim, the empty-to-null collapse and the bound are all here, as pure
 * functions, next to the constant the SQL `check` constraint can be
 * compared against.
 *
 * Why 280 and not the column's 2000
 * -----------------------------------
 * `completed_sets.notes` allows 2000 characters; the *logger* allows 280.
 * A note written mid-set is a reminder, not a journal -- the session's
 * own journal (`NotionJournal`) is where the long prose goes, and keeping
 * the per-set field short is what lets it render inline on the row
 * without pushing the weight and reps it was written about off screen.
 * The bound is enforced here, at the input, so the database never has to
 * reject one.
 */

/** The per-set note's rules, with the reasoning attached. */
export const SET_NOTES = {
  /**
   * Maximum length in characters, enforced at the input.
   *
   * Deliberately tighter than the column's 2000: see the module comment.
   */
  MAX_LENGTH: 280,

  /**
   * The quick chips, in order.
   *
   * Appended, never replacing: an athlete who typed "rodilla" and then taps
   * "Técnica" wants "rodilla Técnica", not a field that ate what they wrote.
   */
  QUICK_CHIPS: ["Molestia", "Técnica", "Fácil", "Agarre", "Sin spotter"],
} as const;

/**
 * Normalises a raw note for storage.
 *
 * Trims, collapses whitespace-only and empty input to `null` (the
 * "deliberately no note" claim, rather than an empty string that would
 * mean something different in the column), and clamps to
 * {@link SET_NOTES.MAX_LENGTH} -- the field is `maxLength`-bounded in the
 * UI too, but paste can bypass an attribute, so the bound is enforced
 * where it matters.
 *
 * Pure: no clock, no storage, no DOM. The caller decides when to save.
 */
export function normaliseSetNote(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  return trimmed.slice(0, SET_NOTES.MAX_LENGTH);
}

/**
 * Appends a quick chip to an existing draft note.
 *
 * Adds the chip as a new word -- space-separated, deduplicated so tapping
 * "Técnica" twice does not write it twice -- and returns the result still
 * within {@link SET_NOTES.MAX_LENGTH}. The field is never *replaced*: the
 * chips are a shorthand for words the athlete would otherwise type, not a
 * second editor.
 */
export function appendNoteChip(
  current: string | null | undefined,
  chip: string,
): string {
  const base = (current ?? "").trim();
  if (base.length === 0) return chip;

  const words = base.split(/\s+/);
  if (words.includes(chip)) return base;

  const joined = `${base} ${chip}`;
  return joined.slice(0, SET_NOTES.MAX_LENGTH);
}
