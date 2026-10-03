/**
 * analyze.ts — every property an importer can get quietly wrong.
 *
 * The dangerous outcomes are all silent. A dropped row still leaves a plausible
 * session. A weight read from the wrong column still looks like a weight. So the
 * assertions here are about what the user is *told* as much as what is stored,
 * and the duplicate and error-log tests carry most of the weight.
 */

import { describe, expect, it } from "vitest";
import {
  analyzeImport,
  isWarmupSetType,
  MAX_IMPORT_WEIGHT_KG,
  parseImportDate,
  parseImportWeight,
  sessionFingerprint,
  setFingerprint,
  type RawRow,
} from "./analyze";
import { parseCsvRows } from "./csv";
import { suggestMapping } from "./sources";
import type { ColumnMapping, ImportIssueCode } from "./types";

const HEVY_HEADER = [
  "title",
  "start_time",
  "end_time",
  "description",
  "exercise_name",
  "set_index",
  "set_type",
  "weight_kg",
  "reps",
  "rpe",
];

const MAPPING: ColumnMapping = suggestMapping(HEVY_HEADER, "hevy");

/** A Hevy-shaped row. Positional, so the fixtures read like the file does. */
function hevyRow(
  title: string,
  start: string,
  exercise: string,
  weight: string,
  reps: string,
  setIndex = "1",
  setType = "normal",
  rpe = "",
): string[] {
  return [title, start, "", "", exercise, setIndex, setType, weight, reps, rpe];
}

/** Parses a whole file, header included, into the rows the analysis expects. */
function rowsFrom(text: string): RawRow[] {
  return parseCsvRows(text).map(({ cells, line }) => ({ cells, line }));
}

/** Builds a small Hevy file and analyses it in one go. */
function analyzeHevy(
  data: string[][],
  options: { source?: "hevy" | "strong" | "generic"; existing?: Set<string>; weightUnit?: "kg" | "lb" } = {},
) {
  const text = [
    HEVY_HEADER.join(","),
    ...data.map((row) =>
      row
        // Quotes the fields most likely to hold a comma, so the fixtures go
        // through the same parser as a real export rather than a shortcut.
        .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(","),
    ),
  ].join("\n");

  const parsed = rowsFrom(text);
  const headers = parsed[0].cells;
  return analyzeImport(headers, parsed.slice(1), {
    mapping: MAPPING,
    source: options.source ?? "hevy",
    existing: options.existing,
    weightUnit: options.weightUnit,
    now: () => 1_700_000_000_000,
  });
}

function codesOf(issues: { code: ImportIssueCode }[]): ImportIssueCode[] {
  return issues.map((i) => i.code);
}

// ------------------------------------------------------------------ dates

describe("parseImportDate", () => {
  it("reads the space-separated local time both sources write", () => {
    const iso = parseImportDate("2024-03-05 18:30:00");
    expect(iso).toBe(new Date(2024, 2, 5, 18, 30, 0).toISOString());
  });

  it("keeps the local wall-clock time rather than shifting it to UTC", () => {
    // A session that started at 09:30 belongs at 09:30 in the user's own
    // history. Reading it as UTC puts every afternoon workout in the previous
    // day's bucket, which quietly corrupts every "last time" reference.
    const parsed = new Date(parseImportDate("2024-03-05 09:30:00") as string);
    expect(parsed.getHours()).toBe(9);
  });

  it("accepts a bare date, for an export that omits the time", () => {
    expect(parseImportDate("2024-03-05")).toBe(new Date(2024, 2, 5).toISOString());
  });

  it("accepts an ISO separator as well as a space", () => {
    expect(parseImportDate("2024-03-05T09:30:00")).toBe(new Date(2024, 2, 5, 9, 30).toISOString());
  });

  it("accepts Unix seconds and milliseconds", () => {
    expect(parseImportDate("1709646600")).toBe(new Date(1_709_646_600_000).toISOString());
    expect(parseImportDate("1709646600000")).toBe(new Date(1_709_646_600_000).toISOString());
  });

  it("rejects a date the calendar does not have", () => {
    // `new Date("2024-02-31")` silently rolls into March, which would file the
    // session a month early with no error anywhere.
    expect(parseImportDate("2024-02-31")).toBeNull();
    expect(parseImportDate("2024-13-01")).toBeNull();
  });

  it("rejects what it cannot read", () => {
    for (const value of ["", "ayer", "not a date", "05/03/2024"]) {
      expect(parseImportDate(value), value).toBeNull();
    }
  });
});

// ---------------------------------------------------------------- weights

describe("parseImportWeight", () => {
  it("reads a plain number", () => {
    expect(parseImportWeight("60", "kg")).toEqual({ kg: 60, invalid: false });
  });

  it("reads a comma decimal, which a Spanish Excel writes", () => {
    expect(parseImportWeight("62,5", "kg")).toEqual({ kg: 62.5, invalid: false });
  });

  it("strips a unit suffix a user typed", () => {
    expect(parseImportWeight("60 kg", "kg")).toEqual({ kg: 60, invalid: false });
    expect(parseImportWeight("60lbs", "kg")).toEqual({ kg: 60, invalid: false });
  });

  it("converts pounds to the metric this app stores", () => {
    // Strong writes whatever the account is configured for; `completed_sets`
    // only ever holds kg.
    expect(parseImportWeight("135", "lb").kg).toBeCloseTo(61.2, 1);
  });

  it("treats an empty cell as a bodyweight set, not an error", () => {
    // A pull-up is a real set with no external load. Reporting it as an error
    // would fill the log with noise about sets that are perfectly fine.
    expect(parseImportWeight("", "kg")).toEqual({ kg: null, invalid: false });
  });

  it("treats the words people write for bodyweight the same way", () => {
    for (const value of ["-", "—", "n/a", "Bodyweight", "peso corporal"]) {
      expect(parseImportWeight(value, "kg"), value).toEqual({ kg: null, invalid: false });
    }
  });

  it("flags a value that is not a number", () => {
    expect(parseImportWeight("pesado", "kg")).toEqual({ kg: null, invalid: true });
  });

  it("flags an implausible weight rather than storing it", () => {
    // A shifted column lands here. Accepting it would write a set no plate
    // calculator can build and no 1RM estimate should ever see.
    expect(parseImportWeight(String(MAX_IMPORT_WEIGHT_KG + 1), "kg")).toEqual({
      kg: null,
      invalid: true,
    });
  });

  it("rejects a negative weight", () => {
    expect(parseImportWeight("-20", "kg")).toEqual({ kg: null, invalid: true });
  });
});

// -------------------------------------------------------------- set kinds

describe("isWarmupSetType", () => {
  it("recognises both spellings", () => {
    for (const value of ["warmup", "warm-up", "Warm Up", "calentamiento"]) {
      expect(isWarmupSetType(value), value).toBe(true);
    }
  });

  it("does not call a failure or drop set a warm-up", () => {
    // `is_warmup` is what the progression engine reads to decide whether a set
    // counts at all; a failure set is the hardest work in the session.
    for (const value of ["failure", "al fallo", "drop set", "normal"]) {
      expect(isWarmupSetType(value), value).toBe(false);
    }
  });
});

// -------------------------------------------------------------- grouping

describe("analyzeImport grouping", () => {
  it("groups every row of one session under one entry", () => {
    const analysis = analyzeHevy([
      hevyRow("Fuerza A", "2024-03-05 18:30:00", "Sentadilla", "100", "5", "1"),
      hevyRow("Fuerza A", "2024-03-05 18:30:00", "Sentadilla", "100", "5", "2"),
      hevyRow("Fuerza A", "2024-03-05 18:30:00", "Press banca", "60", "8", "1"),
    ]);

    expect(analysis.sessions).toHaveLength(1);
    expect(analysis.sessions[0].sets).toHaveLength(3);
    expect(analysis.stats.importedSets).toBe(3);
  });

  it("separates sessions by date and title", () => {
    const analysis = analyzeHevy([
      hevyRow("Fuerza A", "2024-03-05 18:30:00", "Sentadilla", "100", "5"),
      hevyRow("Fuerza B", "2024-03-06 18:30:00", "Sentadilla", "100", "5"),
      // Same title, different day: a different session.
      hevyRow("Fuerza A", "2024-03-07 18:30:00", "Sentadilla", "100", "5"),
    ]);
    expect(analysis.sessions).toHaveLength(3);
  });

  it("regroups rows that are not already adjacent", () => {
    // A file sorted by date rather than by workout interleaves two sessions. A
    // parser that closed a session when the key changed would produce four
    // sessions from four rows.
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
      hevyRow("B", "2024-03-06 18:00:00", "Press banca", "60", "8"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "2"),
      hevyRow("B", "2024-03-06 18:00:00", "Press banca", "60", "8", "2"),
    ]);
    expect(analysis.sessions.map((s) => s.title).sort()).toEqual(["A", "B"]);
    expect(analysis.sessions.every((s) => s.sets.length === 2)).toBe(true);
  });

  it("orders sessions oldest first", () => {
    const analysis = analyzeHevy([
      hevyRow("B", "2024-03-06 18:00:00", "Press banca", "60", "8"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
    ]);
    expect(analysis.sessions.map((s) => s.title)).toEqual(["A", "B"]);
  });

  it("numbers sets per exercise, closing any gap in the file", () => {
    // A file that skipped from 2 to 5 would leave `set_number` with a hole, and
    // every consumer that assumes "the last set is the highest number" breaks.
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "2"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "5"),
      hevyRow("A", "2024-03-05 18:00:00", "Press banca", "60", "8", "4"),
    ]);
    const squat = analysis.sessions[0].sets.filter((s) => s.exerciseName === "Sentadilla");
    expect(squat.map((s) => s.setNumber)).toEqual([1, 2]);
    const bench = analysis.sessions[0].sets.filter((s) => s.exerciseName === "Press banca");
    expect(bench.map((s) => s.setNumber)).toEqual([1]);
  });

  it("records where each session started, for the error log", () => {
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
    ]);
    expect(analysis.sessions[0].firstLine).toBe(2);
  });

  it("gives a stable id to the run, for undoing it as one batch", () => {
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
    ]);
    expect(analysis.batchId).toBe("import-1700000000000");
  });
});

// -------------------------------------------------------------- duplicates

describe("analyzeImport duplicates", () => {
  it("keeps a session the database already has out of the import", () => {
    const startedAt = new Date(2024, 2, 5, 18, 0, 0).toISOString();
    const existing = new Set([sessionFingerprint(startedAt, "Fuerza A")]);

    const analysis = analyzeHevy(
      [
        hevyRow("Fuerza A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
        hevyRow("Fuerza B", "2024-03-06 18:00:00", "Sentadilla", "100", "5"),
      ],
      { existing },
    );

    expect(analysis.sessions.map((s) => s.title)).toEqual(["Fuerza B"]);
    expect(analysis.stats.duplicateSessions).toBe(1);
    expect(codesOf(analysis.issues)).toContain("duplicate_session");
  });

  it("drops the whole overlapping session, not just its colliding sets", () => {
    // A partial import leaves two copies of the sets that did not collide and no
    // way to tell which is which.
    const startedAt = new Date(2024, 2, 5, 18, 0, 0).toISOString();
    const analysis = analyzeHevy(
      [
        hevyRow("Fuerza A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "1"),
        hevyRow("Fuerza A", "2024-03-05 18:00:00", "Press banca", "60", "8", "1"),
      ],
      { existing: new Set([sessionFingerprint(startedAt, "Fuerza A")]) },
    );
    expect(analysis.sessions).toHaveLength(0);
    expect(analysis.stats.importedSets).toBe(0);
  });

  it("counts a session pasted twice in one file once", () => {
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "1"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "2"),
      // The whole session again, from a double-paste.
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "1"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "2"),
    ]);
    expect(analysis.sessions).toHaveLength(1);
    expect(analysis.sessions[0].sets).toHaveLength(2);
    expect(analysis.stats.duplicateSets).toBe(2);
    expect(codesOf(analysis.issues)).toContain("duplicate_set");
  });

  it("reports a duplicate once, not once per row", () => {
    // Five identical rows would otherwise produce five identical log lines.
    const analysis = analyzeHevy([
      ...Array.from({ length: 5 }, () =>
        hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
      ),
    ]);
    const duplicates = analysis.issues.filter((i) => i.code === "duplicate_session");
    expect(duplicates).toHaveLength(0);
    expect(analysis.issues.filter((i) => i.code === "duplicate_set")).toHaveLength(1);
  });

  it("matches on instant and title, so a re-export is not a new session", () => {
    const a = sessionFingerprint("2024-03-05T18:00:00.000Z", "Fuerza A");
    const b = sessionFingerprint("2024-03-05T18:00:00.000Z", "  fuerza a  ");
    expect(a).toBe(b);
  });

  it("does not guess at repeats when the file does not number its sets", () => {
    // "Same exercise, same weight, same reps" describes two ordinary sets about
    // as often as it describes a double-paste. Without a set-number column there
    // is nothing to tell them apart, so both are imported.
    const mapping = { ...MAPPING, setNumber: null };
    const analysis = analyzeImport(
      HEVY_HEADER,
      [
        { cells: hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"), line: 2 },
        { cells: hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"), line: 3 },
      ],
      { mapping, source: "hevy" },
    );
    expect(analysis.sessions[0].sets).toHaveLength(2);
    expect(analysis.sessions[0].sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(analysis.stats.duplicateSets).toBe(0);
  });

  it("does not confuse a same-titled session on another day", () => {
    const a = sessionFingerprint("2024-03-05T18:00:00.000Z", "Fuerza A");
    const b = sessionFingerprint("2024-03-06T18:00:00.000Z", "Fuerza A");
    expect(a).not.toBe(b);
  });
});

// -------------------------------------------------------------- error log

describe("analyzeImport error log", () => {
  it("reports a row with no date and names the line", () => {
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
      hevyRow("A", "", "Press banca", "60", "8"),
    ]);
    const issue = analysis.issues.find((i) => i.code === "missing_date");
    expect(issue?.line).toBe(3);
    expect(analysis.sessions[0].sets).toHaveLength(1);
  });

  it("reports a date it cannot read, with the offending value", () => {
    const analysis = analyzeHevy([hevyRow("A", "ayer", "Sentadilla", "100", "5")]);
    const issue = analysis.issues.find((i) => i.code === "unparseable_date");
    expect(issue?.detail).toBe("ayer");
  });

  it("reports a row with no exercise", () => {
    const analysis = analyzeHevy([hevyRow("A", "2024-03-05 18:00:00", "", "100", "5")]);
    expect(codesOf(analysis.issues)).toContain("missing_exercise");
    expect(analysis.sessions).toHaveLength(0);
  });

  it("imports the set anyway when only the weight is unreadable", () => {
    // Better than dropping a completed set over a mistyped cell: the weight is
    // nullable, and a null is "bodyweight" rather than a zero.
    const analysis = analyzeHevy([hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "pesado", "5")]);
    expect(analysis.sessions[0].sets[0]).toMatchObject({ weightKg: null, reps: 5 });
    expect(codesOf(analysis.issues)).toContain("unparseable_weight");
  });

  it("reports a row whose cell count does not match the header", () => {
    const analysis = analyzeHevy([
      ["A", "2024-03-05 18:00:00", "", "", "Sentadilla", "1", "normal", "100", "5", ""],
      // One column short.
      ["A", "2024-03-05 18:00:00", "", "", "Press banca", "1", "normal", "60"],
    ]);
    expect(codesOf(analysis.issues)).toContain("ragged_row");
    // The row still lands in the right columns rather than shifting.
    expect(analysis.sessions[0].sets[1]).toMatchObject({ exerciseName: "Press banca" });
  });

  it("reports a session that ended up with nothing importable", () => {
    // Every row of this session has no weight and no reps.
    const analysis = analyzeHevy([hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "", "")]);
    expect(codesOf(analysis.issues)).toContain("no_sets");
    expect(analysis.stats.emptySessions).toBe(1);
    expect(analysis.sessions).toHaveLength(0);
  });

  it("says nothing when there is nothing to say", () => {
    const analysis = analyzeHevy([hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5")]);
    expect(analysis.issues).toEqual([]);
  });

  it("reports a headerless file instead of returning an empty success", () => {
    const analysis = analyzeImport([], [], { mapping: MAPPING, source: "hevy" });
    expect(codesOf(analysis.issues)).toEqual(["no_header"]);
    expect(analysis.stats.totalRows).toBe(0);
  });

  it("reports an unmapped exercise column, which is why nothing imported", () => {
    const analysis = analyzeImport(HEVY_HEADER, [], {
      mapping: { ...MAPPING, exercise: null },
      source: "hevy",
    });
    expect(codesOf(analysis.issues)).toContain("no_exercises_mapped");
  });
});

describe("setFingerprint", () => {
  const base = { weightKg: 100, reps: 5, rpe: null, isWarmup: false };

  it("separates two sets of one session by their set number", () => {
    expect(setFingerprint("s", "Sentadilla", { ...base, setNumber: "1" })).not.toBe(
      setFingerprint("s", "Sentadilla", { ...base, setNumber: "2" }),
    );
  });

  it("treats the same row twice as one row", () => {
    expect(setFingerprint("s", "Sentadilla", { ...base, setNumber: "1" })).toBe(
      setFingerprint("s", "Sentadilla", { ...base, setNumber: "1" }),
    );
  });

  it("ignores the case and padding of the exercise name", () => {
    expect(setFingerprint("s", "Sentadilla", { ...base, setNumber: "1" })).toBe(
      setFingerprint("s", "  sentadilla ", { ...base, setNumber: "1" }),
    );
  });

  it("separates a warm-up from a working set at the same number", () => {
    expect(setFingerprint("s", "Sentadilla", { ...base, setNumber: "1" })).not.toBe(
      setFingerprint("s", "Sentadilla", { ...base, setNumber: "1", isWarmup: true }),
    );
  });

  it("keeps a null weight distinct from the empty string", () => {
    // A bodyweight set and an unparsed one are both null here, but the log has
    // already told them apart; the fingerprint must not conflate them with a
    // value that was never read at all.
    expect(setFingerprint("s", "Dominadas", { ...base, weightKg: null, setNumber: "1" })).not.toBe(
      setFingerprint("s", "Dominadas", { ...base, weightKg: 0, setNumber: "1" }),
    );
  });
});

// ------------------------------------------------------------------ stats

describe("analyzeImport stats", () => {
  it("adds up to the rows it read", () => {
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "2"),
      hevyRow("A", "", "Press banca", "60", "8"),
    ]);
    expect(analysis.stats.totalRows).toBe(3);
    expect(analysis.stats.importedSets).toBe(2);
    expect(analysis.stats.skippedRows).toBe(1);
    expect(analysis.stats.sessions).toBe(1);
  });

  it("counts distinct exercise names for the mapping step", () => {
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "2"),
      hevyRow("A", "2024-03-05 18:00:00", "Press banca", "60", "8"),
    ]);
    expect(analysis.stats.distinctExercises).toBe(2);
    expect(analysis.exerciseNames).toEqual(["Press banca", "Sentadilla"]);
  });

  it("returns nothing for an empty file, with the stats saying so", () => {
    const analysis = analyzeImport(HEVY_HEADER, [], { mapping: MAPPING, source: "hevy" });
    expect(analysis.sessions).toEqual([]);
    expect(analysis.stats.sessions).toBe(0);
    expect(analysis.stats.totalRows).toBe(0);
  });
});

// ------------------------------------------------------------------ shapes

describe("analyzeImport output shape", () => {
  it("converts pounds to kilograms on the way in", () => {
    const analysis = analyzeHevy(
      [hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "135", "5")],
      { weightUnit: "lb" },
    );
    expect(analysis.sessions[0].sets[0].weightKg).toBeCloseTo(61.2, 1);
  });

  it("flags warm-ups without touching the other kinds", () => {
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "20", "10", "1", "warmup"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "20", "10", "2", "warm-up"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "3", "failure"),
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "4", "normal"),
    ]);
    expect(analysis.sessions[0].sets.map((s) => s.isWarmup)).toEqual([true, true, false, false]);
  });

  it("marks every imported set completed", () => {
    // These rows are the record of work that happened; an incomplete set would
    // be excluded from the progression engine and lose the session's history.
    const analysis = analyzeHevy([hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5")]);
    expect(analysis.sessions[0].sets[0].completed).toBe(true);
  });

  it("keeps a body-weight-only set, which is a real set", () => {
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Dominadas", "", "8"),
    ]);
    expect(analysis.sessions[0].sets[0]).toMatchObject({ weightKg: null, reps: 8 });
  });

  it("names an untitled session rather than leaving it blank", () => {
    const analysis = analyzeHevy([
      ["", "2024-03-05 18:00:00", "", "", "Sentadilla", "1", "normal", "100", "5", ""],
    ]);
    expect(analysis.sessions[0].title).toBe("Sesión importada");
  });

  it("survives a quoted comma in the exercise name", () => {
    // The parser is the only thing standing between a file and a column shift.
    const analysis = analyzeHevy([
      ["A", "2024-03-05 18:00:00", "", "", 'Press militar, "pecho"', "1", "normal", "40", "10", ""],
    ]);
    expect(analysis.sessions[0].sets[0].exerciseName).toBe('Press militar, "pecho"');
  });

  it("keeps an RPE outside 1-10 out, without dropping the set", () => {
    // RPE is the one field a session can be complete without; losing the set over
    // a mistyped 11 would be the worse answer.
    const analysis = analyzeHevy([
      hevyRow("A", "2024-03-05 18:00:00", "Sentadilla", "100", "5", "1", "normal", "11"),
    ]);
    expect(analysis.sessions[0].sets[0]).toMatchObject({ rpe: null, weightKg: 100 });
    expect(codesOf(analysis.issues)).toContain("unparseable_reps");
  });
});