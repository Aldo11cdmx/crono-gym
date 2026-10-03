/**
 * sources.ts — the alias tables are the contract, so they are tested as data.
 *
 * Both Hevy and Strong have changed their headers before. A mapping that guesses
 * wrong is not a visible bug: the import "succeeds", the numbers land in the
 * wrong columns, and the only symptom is a history full of impossible weights
 * weeks later. So the failures pinned here are wrong-column assignments, not
 * missing ones.
 */

import { describe, expect, it } from "vitest";
import {
  detectSource,
  isMappingEmpty,
  missingRequired,
  normaliseHeader,
  suggestMapping,
  unmappedHeaders,
} from "./sources";
import { CANONICAL_FIELDS } from "./types";

const HEVY_HEADER = [
  "title",
  "start_time",
  "end_time",
  "description",
  "exercise_name",
  "superset_id",
  "exercise_notes",
  "set_index",
  "set_type",
  "weight_kg",
  "reps",
  "distance_km",
  "duration_seconds",
  "rpe",
  "rest_seconds",
];

const STRONG_HEADER = [
  "Date",
  "Workout Name",
  "Duration",
  "Exercise Name",
  "Set Order",
  "Weight",
  "Reps",
  "Distance",
  "Seconds",
  "Notes",
  "Workout Notes",
  "Workout Weight",
  "Workout Reps",
  "RPE",
  "Workout RPE",
];

describe("normaliseHeader", () => {
  it("collapses the spellings one export and the other use", () => {
    for (const header of ["Set Order", "set_order", "  set order  "]) {
      expect(normaliseHeader(header), header).toBe("set_order");
    }
  });

  it("cannot invent a separator that was not there", () => {
    // `SETORDER` has nothing to split on. Both spellings are in the alias tables
    // precisely because normalisation cannot reconcile them.
    expect(normaliseHeader("SETORDER")).toBe("setorder");
  });

  it("strips accents, so a Spanish file still matches the English aliases", () => {
    expect(normaliseHeader("Repeticiones")).toBe("repeticiones");
  });

  it("trims the underscores a leading or trailing separator leaves", () => {
    expect(normaliseHeader("__Weight__")).toBe("weight");
  });
});

describe("detectSource", () => {
  it("recognises a Hevy export", () => {
    expect(detectSource(HEVY_HEADER)).toBe("hevy");
  });

  it("recognises a Strong export", () => {
    expect(detectSource(STRONG_HEADER)).toBe("strong");
  });

  it("recognises a Hevy export trimmed to the columns this app uses", () => {
    // The exclusive columns are gone, so only the pair is left. Without it a
    // cleaned-up Hevy file is offered the generic mapping, which maps `weight_kg`
    // correctly but leaves `set_index` to be guessed -- and a guess there is how
    // set numbering silently restarts mid-session.
    expect(
      detectSource(["title", "start_time", "exercise_name", "set_index", "weight_kg", "reps"]),
    ).toBe("hevy");
  });

  it("falls back to generic rather than guessing", () => {
    // Two Hevy-only signals and one Strong-only signal are what the detection
    // uses; a file with neither is the generic case and must be offered the
    // generic mapping, not whichever one happens to match more aliases.
    expect(detectSource(["date", "exercise", "weight", "reps"])).toBe("generic");
  });

  it("does not mistake Strong's `Workout Name` column for a Hevy header", () => {
    // Hevy wins on `exercise_notes`, Strong on `workout_name`; a file carrying
    // both signals is Hevy because it is the stricter signature.
    expect(detectSource([...HEVY_HEADER, "Workout Name"])).toBe("hevy");
  });

  it("returns generic for an empty header", () => {
    expect(detectSource([])).toBe("generic");
  });
});

describe("suggestMapping", () => {
  it("maps a Hevy export to the columns this app expects", () => {
    const mapping = suggestMapping(HEVY_HEADER, "hevy");
    expect(mapping.date).toBe("start_time");
    expect(mapping.exercise).toBe("exercise_name");
    expect(mapping.weight).toBe("weight_kg");
    expect(mapping.reps).toBe("reps");
    expect(mapping.rpe).toBe("rpe");
    expect(mapping.setNumber).toBe("set_index");
    expect(mapping.setType).toBe("set_type");
    expect(mapping.title).toBe("title");
  });

  it("maps a Strong export, preferring the set's own columns over the session's", () => {
    const mapping = suggestMapping(STRONG_HEADER, "strong");
    expect(mapping.date).toBe("Date");
    expect(mapping.exercise).toBe("Exercise Name");
    // The header carries both `RPE` and `Workout RPE`, and both `Weight` and
    // `Workout Weight`. A substring match would hand the session averages to the
    // per-set columns; exact matching plus alias order is what keeps them apart.
    expect(mapping.rpe).toBe("RPE");
    expect(mapping.weight).toBe("Weight");
    expect(mapping.reps).toBe("Reps");
    expect(mapping.notes).toBe("Notes");
    expect(mapping.setNumber).toBe("Set Order");
    expect(mapping.title).toBe("Workout Name");
  });

  it("never lets a longer column name capture a shorter field", () => {
    // The regression this exists for: `workout_rpe` contains `rpe`, `weight_kg`
    // contains `weight`, `set_type` contains `type`.
    const mapping = suggestMapping(STRONG_HEADER, "strong");
    expect(mapping.rpe).not.toBe("Workout RPE");
    expect(mapping.weight).not.toBe("Workout Weight");
    expect(mapping.notes).not.toBe("Workout Notes");

    const hevy = suggestMapping(HEVY_HEADER, "hevy");
    expect(hevy.weight).not.toBe("Workout Weight");
    expect(hevy.setType).toBe("set_type");
  });

  it("never maps two fields onto the same column", () => {
    // The classic collision: a header matching two aliases. One column cannot be
    // both the weight and the reps, and if it is, one of the two is a lie.
    for (const source of ["hevy", "strong", "generic"] as const) {
      const mapping = suggestMapping(HEVY_HEADER, source);
      const used = CANONICAL_FIELDS.map((f) => mapping[f]).filter(
        (h): h is string => h !== null,
      );
      expect(new Set(used).size, source).toBe(used.length);
    }
  });

  it("returns null for a field the file does not have, rather than guessing", () => {
    const mapping = suggestMapping(["date", "exercise", "weight", "reps"], "generic");
    expect(mapping.rpe).toBeNull();
    expect(mapping.setNumber).toBeNull();
    expect(mapping.setType).toBeNull();
    expect(mapping.notes).toBeNull();
  });

  it("leaves nothing mapped for a header it cannot read at all", () => {
    const mapping = suggestMapping(["col1", "col2"], "generic");
    expect(isMappingEmpty(mapping)).toBe(true);
    expect(missingRequired(mapping)).toEqual(["date", "exercise"]);
  });

  it("reports the columns the mapping does not use", () => {
    // Hevy writes ten columns this app has no use for; saying so is what stops
    // a user concluding the import dropped their supersets.
    const unused = unmappedHeaders(HEVY_HEADER, suggestMapping(HEVY_HEADER, "hevy"));
    expect(unused).toContain("superset_id");
    expect(unused).toContain("rest_seconds");
    expect(unused).not.toContain("weight_kg");
  });

  it("reports a usable mapping as complete", () => {
    expect(missingRequired(suggestMapping(HEVY_HEADER, "hevy"))).toEqual([]);
    expect(isMappingEmpty(suggestMapping(HEVY_HEADER, "hevy"))).toBe(false);
  });
});