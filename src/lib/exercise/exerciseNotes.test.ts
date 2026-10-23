/**
 * exerciseNotes.test.ts — the prose path: validation, collection, search.
 *
 * The accent folding in {@link searchNotes} gets the most attention here because it is the
 * part that is easy to write incorrectly and impossible to notice. A search that fails on
 * accented Spanish looks like "the feature does not work" rather than like a bug, and this
 * app's users are typing "rodilla" and "press de pecho" into a field next to a note they
 * wrote as "la rodilla protestó".
 */

import { describe, expect, it } from "vitest";
import {
  EXERCISE_NOTES,
  collectNotes,
  fold,
  isLongNote,
  normaliseNote,
  noteCoverage,
  recentNotes,
  searchNotes,
} from "./exerciseNotes";
import type { ExerciseSetRecord } from "./exerciseHistory";

function set(over: Partial<ExerciseSetRecord> = {}): ExerciseSetRecord {
  return {
    id: "set-1",
    log_id: "log-1",
    exercise_id: "sentadilla",
    set_number: 1,
    weight: 100,
    reps: 5,
    rpe: null,
    notes: null,
    started_at: "2026-03-01T10:00:00.000Z",
    ...over,
  };
}

const session = (logId: string, startedAt: string, sets: ExerciseSetRecord[]) => ({
  logId,
  startedAt,
  sets,
});

describe("accepting a note", () => {
  it("trims, because a whitespace-only note is not a note", () => {
    // The column distinguishes null from empty string: empty is "someone deliberately
    // blanked this". A field of spaces is nobody's decision and must not become one.
    const result = normaliseNote("  elbow hurt  ");
    expect(result).toEqual({ ok: true, note: "elbow hurt" });
    expect(normaliseNote("   ")).toEqual({ ok: false, reason: "empty" });
    expect(normaliseNote("\n\t")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects nothing at all as an empty note rather than an error", () => {
    // Clearing a field is a normal thing to do, not a validation failure. Returning ok with
    // an empty note lets the caller write null and move on.
    expect(normaliseNote(null)).toEqual({ ok: true, note: "" });
    expect(normaliseNote(undefined)).toEqual({ ok: true, note: "" });
  });

  it("bounds the length after trimming, matching the SQL constraint", () => {
    const atLimit = "a".repeat(EXERCISE_NOTES.MAX_LENGTH);
    const overLimit = "a".repeat(EXERCISE_NOTES.MAX_LENGTH + 1);

    expect(normaliseNote(atLimit).ok).toBe(true);
    expect(normaliseNote(overLimit)).toEqual({ ok: false, reason: "too_long" });

    // Checked after the trim, so 2000 characters plus a trailing newline is accepted.
    // Checking first would reject text the athlete can see fits.
    expect(normaliseNote(`${atLimit}\n`).ok).toBe(true);
    expect(normaliseNote(`  ${overLimit}  `)).toEqual({ ok: false, reason: "too_long" });
  });

  it("collapses only what is long enough to hide the numbers it describes", () => {
    expect(isLongNote("a".repeat(EXERCISE_NOTES.INLINE_LENGTH))).toBe(false);
    expect(isLongNote("a".repeat(EXERCISE_NOTES.INLINE_LENGTH + 1))).toBe(true);
    // A note that takes over the row hides the weight and reps it was written about.
    expect(isLongNote(null)).toBe(false);
  });
});

describe("collecting notes", () => {
  it("returns only the sets that have one", () => {
    // Returning all sets with a nullable note hands every caller a filter to remember, and
    // the one that forgets renders the whole history as prose.
    const result = collectNotes([
      session("log-1", "2026-03-01T10:00:00.000Z", [
        set({ id: "a", notes: "grip gave out" }),
        set({ id: "b", notes: null }),
        set({ id: "c", notes: "   " }),
      ]),
    ]);
    expect(result.map((entry) => entry.setId)).toEqual(["a"]);
    expect(result[0].note).toBe("grip gave out");
  });

  it("skips an unweighted set, because there is no weight to attach the note to", () => {
    const result = collectNotes([
      session("log-1", "2026-03-01T10:00:00.000Z", [
        set({ id: "a", weight: null, notes: "band felt loose" }),
        set({ id: "b", weight: 20, notes: "band felt tight" }),
      ]),
    ]);
    expect(result.map((entry) => entry.setId)).toEqual(["b"]);
  });

  it("carries the set's number and the session it belongs to", () => {
    const result = collectNotes([
      session("log-1", "2026-03-01T10:00:00.000Z", [
        set({ id: "a", set_number: 3, weight: 100, reps: 5, notes: "hard" }),
      ]),
    ]);
    expect(result[0]).toMatchObject({
      setId: "a",
      logId: "log-1",
      setNumber: 3,
      weight: 100,
      reps: 5,
      truncated: false,
    });
  });

  it("limits by session rather than by note count", () => {
    // One heavily-annotated session would monopolise a note-count limit. The useful
    // question is "what did I write about this lately".
    const heavilyAnnotated = session("log-1", "2026-03-01T10:00:00.000Z", [
      set({ id: "a", notes: "one" }),
      set({ id: "b", notes: "two" }),
      set({ id: "c", notes: "three" }),
    ]);
    const recent = session("log-2", "2026-02-01T10:00:00.000Z", [set({ id: "d", notes: "four" })]);

    const result = recentNotes([heavilyAnnotated, recent], 1);
    expect(result.map((entry) => entry.setId)).toEqual(["a", "b", "c"]);
    expect(recentNotes([heavilyAnnotated, recent], 2)).toHaveLength(4);
    expect(recentNotes([heavilyAnnotated, recent], 0)).toEqual([]);
  });
});

describe("searching notes", () => {
  it("matches regardless of case", () => {
    const notes = collectNotes([
      session("log-1", "2026-03-01T10:00:00.000Z", [
        set({ id: "a", notes: "Press de pecho" }),
        set({ id: "b", notes: "sentadilla al fondo" }),
      ]),
    ]);
    expect(searchNotes(notes, "press").map((n) => n.setId)).toEqual(["a"]);
    expect(searchNotes(notes, "PRESS").map((n) => n.setId)).toEqual(["a"]);
  });

  it("matches regardless of accents, in both directions", () => {
    // The point of the fold: this app's notes are written in Spanish and typed by hand, so
    // "rodilla" has to find "RODILLA" and "Ródilla". A plain lowercase would fail the
    // accented case in one direction or the other.
    const notes = collectNotes([
      session("log-1", "2026-03-01T10:00:00.000Z", [
        set({ id: "a", notes: "La rodilla protestó" }),
        set({ id: "b", notes: "Bíceps muy fino" }),
        set({ id: "c", notes: "sin notas raras" }),
      ]),
    ]);

    expect(searchNotes(notes, "rodilla").map((n) => n.setId)).toEqual(["a"]);
    expect(searchNotes(notes, "RODILLA").map((n) => n.setId)).toEqual(["a"]);
    expect(searchNotes(notes, "bíceps").map((n) => n.setId)).toEqual(["b"]);
    expect(searchNotes(notes, "BICEPS").map((n) => n.setId)).toEqual(["b"]);
  });

  it("folds marks the plain lowercase would leave behind", () => {
    // The diacritic class includes marks that are not accents in the everyday sense: an
    // athlete's name with a tilde, or a note typed with an ñ, has to be findable too.
    expect(fold("mañana")).toBe("manana");
    expect(fold("Ñandú")).toBe("nandu");
    expect(fold("árbol")).toBe("arbol");
  });

  it("returns everything for an empty search term, rather than nothing", () => {
    // An empty box is a cleared box, not a search for the empty string. Returning nothing
    // would make the list vanish as soon as the field is focused and emptied.
    const notes = collectNotes([
      session("log-1", "2026-03-01T10:00:00.000Z", [set({ id: "a", notes: "one" })]),
    ]);
    expect(searchNotes(notes, "")).toHaveLength(1);
    expect(searchNotes(notes, "   ")).toHaveLength(1);
  });

  it("finds a match in the middle of a note, not only at the start", () => {
    const notes = collectNotes([
      session("log-1", "2026-03-01T10:00:00.000Z", [
        set({ id: "a", notes: "se me fue la técnica al final" }),
      ]),
    ]);
    expect(searchNotes(notes, "técnica").map((n) => n.setId)).toEqual(["a"]);
  });
});

describe("coverage", () => {
  it("reports what share of sets carry a note", () => {
    const result = noteCoverage([
      session("log-1", "2026-03-01T10:00:00.000Z", [
        set({ id: "a", notes: "noted" }),
        set({ id: "b", notes: null }),
        set({ id: "c", notes: "  " }),
        set({ id: "d", notes: "noted too" }),
      ]),
    ]);
    expect(result.noted).toBe(2);
    expect(result.total).toBe(4);
    expect(result.ratio).toBe(0.5);
  });

  it("is 1, not NaN, when there is nothing to cover", () => {
    // Never a divide by zero downstream. "You have annotated everything" is wrong for an
    // empty history, but the number has to be a number.
    expect(noteCoverage([])).toEqual({ noted: 0, total: 0, ratio: 1 });
    expect(noteCoverage([session("l", "2026-03-01T10:00:00.000Z", [])]).ratio).toBe(1);
  });
});
