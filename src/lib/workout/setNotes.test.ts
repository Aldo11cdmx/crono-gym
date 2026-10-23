/**
 * setNotes.test.ts — the trim, the empty-to-null collapse and the
 * bound, as pure functions.
 *
 * The empty case matters most: `""` and `null` mean different things
 * in the column, so a whitespace-only draft has to become `null` (the
 * "no note" claim) and never `""` (which would read as a deliberate
 * empty note). The clamp matters second: an attribute on the textarea
 * is not a promise, because paste bypasses attributes.
 */

import { describe, expect, it } from "vitest";
import {
  appendNoteChip,
  normaliseSetNote,
  SET_NOTES,
} from "./setNotes";

describe("normaliseSetNote", () => {
  it("trims, because a whitespace-only note is not a note", () => {
    expect(normaliseSetNote("  rodilla protestó  ")).toBe("rodilla protestó");
    expect(normaliseSetNote("   ")).toBeNull();
    expect(normaliseSetNote("\n\t")).toBeNull();
  });

  it("maps null and undefined to null, never to an empty string", () => {
    // The column distinguishes null from "". Clearing the field is the
    // "no note" claim, and it has to be stored as null so the history
    // query that filters on `notes is not null` stays honest.
    expect(normaliseSetNote(null)).toBeNull();
    expect(normaliseSetNote(undefined)).toBeNull();
    expect(normaliseSetNote("")).toBeNull();
  });

  it("clamps to the logger's bound, after trimming", () => {
    const atLimit = "a".repeat(SET_NOTES.MAX_LENGTH);
    const overLimit = "a".repeat(SET_NOTES.MAX_LENGTH + 1);

    expect(normaliseSetNote(atLimit)).toBe(atLimit);
    expect(normaliseSetNote(overLimit)).toBe(atLimit);
    // Checked after the trim: a note that fits plus a stray trailing
    // space is a note that fits.
    expect(normaliseSetNote(`${atLimit} `)).toBe(atLimit);
  });

  it("keeps the logger's bound tighter than the column's 2000", () => {
    // A note written mid-set is a reminder, not a journal. If this ever
    // drifts up to the column's limit, the inline reminder stops being
    // inline and the field should have been a journal instead.
    expect(SET_NOTES.MAX_LENGTH).toBeLessThan(2000);
  });
});

describe("appendNoteChip", () => {
  it("appends as a new word, never replacing what was typed", () => {
    // The chips are shorthand for words, not a second editor: an athlete
    // who typed "rodilla" and taps "Técnica" wants both.
    expect(appendNoteChip("rodilla", "Técnica")).toBe("rodilla Técnica");
    expect(appendNoteChip(null, "Técnica")).toBe("Técnica");
    expect(appendNoteChip(undefined, "Técnica")).toBe("Técnica");
  });

  it("does not add the same chip twice", () => {
    expect(appendNoteChip("rodilla Técnica", "Técnica")).toBe(
      "rodilla Técnica",
    );
  });

  it("stays within the bound, because the paste clamp cannot be relied on", () => {
    const long = "a".repeat(SET_NOTES.MAX_LENGTH);
    expect(appendNoteChip(long, "Fácil")).toBe(long);
  });
});
