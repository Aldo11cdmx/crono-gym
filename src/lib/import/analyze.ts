/**
 * analyze.ts — rows in, sessions out, and a log explaining everything dropped.
 *
 * This is the whole import in one pure function, deliberately. It is what the
 * Web Worker runs off the main thread and what the tests run directly, so the
 * code under test is the code that ships -- a worker wrapper with its own parsing
 * logic would let the tests pass and the import still be wrong.
 *
 * Two rules shape everything here:
 *
 * 1. **Nothing is dropped silently.** Every rejected row produces an
 *    {@link ImportIssue} with its source line. An importer that reports "4.000 de
 *    4.312 filas" without saying which 312 and why is indistinguishable from one
 *    that is quietly broken.
 * 2. **Nothing is invented.** A row with no date is an issue, not "today". A row
 *    whose weight will not parse becomes `null`, which the caller renders as a
 *    bodyweight set, rather than a zero, which would be a real measurement.
 */

import { lbToKg } from "@/lib/profile";
import type {
  AnalyzeOptions,
  CanonicalField,
  ColumnMapping,
  ImportAnalysis,
  ImportIssue,
  ImportIssueCode,
  ImportSession,
  ImportSet,
} from "./types";
import { IMPORT_LABELS as T } from "@/lib/i18n";

/** A row as the parser hands it over. */
export interface RawRow {
  cells: string[];
  /** 1-based source line. */
  line: number;
}

/** Header index per canonical field, resolved once instead of per row. */
type Index = Record<CanonicalField, number>;

/**
 * Weight above which a value is treated as a typo rather than a lift.
 *
 * The heaviest thing a human lifts is a bit over 500 kg, and the app's own stepper
 * caps at 999. A `5000` in a weight column is a shifted column or a stray digit;
 * accepting it would write a set that the plate calculator cannot build and that
 * no 1RM estimate should ever see.
 */
export const MAX_IMPORT_WEIGHT_KG = 500;

/** RPE is a 3-10 scale. Anything else is a shifted column. */
export const MIN_IMPORT_RPE = 1;
export const MAX_IMPORT_RPE = 10;

function resolveIndex(headers: readonly string[], mapping: ColumnMapping): Index {
  const position = new Map(headers.map((header, i) => [header, i]));
  const index = {} as Index;
  for (const [field, header] of Object.entries(mapping) as [CanonicalField, string | null][]) {
    index[field] = header === null ? -1 : (position.get(header) ?? -1);
  }
  return index;
}

function cell(row: RawRow, index: Index, field: CanonicalField): string {
  const at = index[field];
  return at < 0 ? "" : (row.cells[at] ?? "").trim();
}

/**
 * A tolerant date reader.
 *
 * Both sources write local wall-clock time with no zone, and Strong sometimes
 * writes a bare date. `new Date("2024-01-15 09:30:00")` is a syntax error in
 * Safari and a local-time parse everywhere else, which is a bug that only shows
 * up on one browser -- so the string is taken apart here instead.
 *
 * The result is a local-time ISO string. That is deliberate: a session that
 * started at 09:30 belongs at 09:30 in the user's own history, and shifting it to
 * UTC because the file had no zone would put every afternoon workout in the
 * previous day's bucket.
 */
export function parseImportDate(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;

  // Unix seconds or milliseconds, as some manual exports carry.
  if (/^\d{10}$/.test(value)) return new Date(Number(value) * 1000).toISOString();
  if (/^\d{13}$/.test(value)) return new Date(Number(value)).toISOString();

  const match =
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
  if (!match) return null;

  const [, y, m, d, hh = "0", mm = "0", ss = "0"] = match;
  const date = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
  );
  // Round-tripping catches 2024-02-31, which `new Date` would roll into March.
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1) return null;
  if (date.getDate() !== Number(d)) return null;
  return date.toISOString();
}

/**
 * Parses a weight in the file's own unit.
 *
 * Returns `null` for an empty cell -- a genuinely bodyweight set, which is a real
 * thing and is imported as one -- and `null` for a value that is not a number or
 * is out of range. The caller cannot tell those two apart, which is intentional:
 * both end up as a set with no weight, and the issue log is where the difference
 * is reported.
 */
export function parseImportWeight(
  raw: string,
  unit: "kg" | "lb",
): { kg: number | null; invalid: boolean } {
  const value = raw.trim();
  if (value === "") return { kg: null, invalid: false };

  // Hevy writes an empty string, but hand-edited files carry "-", "n/a" and
  // "bodyweight". All of them mean "no external load".
  if (/^(-|—|n\/?a|body ?weight|peso ?corporal)$/i.test(value)) {
    return { kg: null, invalid: false };
  }

  // Comma as a decimal separator, which is what a Spanish Excel writes.
  const normalised = value.replace(",", ".").replace(/\s*(kg|lbs?|kilos?)$/i, "");
  const parsed = Number.parseFloat(normalised);
  if (!Number.isFinite(parsed) || parsed < 0) return { kg: null, invalid: true };

  const kg = unit === "lb" ? lbToKg(parsed) : Math.round(parsed * 100) / 100;
  if (kg > MAX_IMPORT_WEIGHT_KG) return { kg: null, invalid: true };
  return { kg, invalid: false };
}

function parseReps(raw: string): { reps: number | null; invalid: boolean } {
  const value = raw.trim();
  if (value === "") return { reps: null, invalid: false };
  if (/^(-|—|n\/?a)$/i.test(value)) return { reps: null, invalid: false };

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000) {
    return { reps: null, invalid: true };
  }
  return { reps: parsed, invalid: false };
}

function parseRpe(raw: string): { rpe: number | null; invalid: boolean } {
  const value = raw.trim();
  if (value === "") return { rpe: null, invalid: false };
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < MIN_IMPORT_RPE || parsed > MAX_IMPORT_RPE) {
    return { rpe: null, invalid: true };
  }
  return { rpe: parsed, invalid: false };
}

/**
 * Whether a row is a warm-up.
 *
 * Hevy writes the literal strings; Strong leaves the column out. "Al fallo" and
 * "drop" are *not* warm-ups -- they are hard work, and `completed_sets.is_warmup`
 * is what the progression engine reads to decide whether to count a set at all.
 */
export function isWarmupSetType(raw: string): boolean {
  return /^(warm[\s-]?up|calentamiento)$/i.test(raw.trim());
}

/**
 * What identifies a session.
 *
 * The instant plus the title, not the sets: a re-export of the same workout with
 * one extra set is still the same workout, and treating it as a new one is how a
 * history ends up with every session twice. The sets are left out of the
 * fingerprint for exactly that reason.
 */
export function sessionFingerprint(startedAt: string, title: string): string {
  return `${startedAt}::${title.trim().toLowerCase()}`;
}

/**
 * Identifies one set row within a file.
 *
 * Includes the file's own set number, which is what makes this *possible*: two
 * rows are the same row only if the file claims the same set number for the same
 * exercise in the same session. Without that column the caller skips the check
 * entirely, because "same exercise, same weight, same reps" describes two
 * perfectly ordinary sets about as often as it describes a repeat.
 */
export function setFingerprint(
  sessionKey: string,
  exerciseName: string,
  set: Pick<ImportSet, "weightKg" | "reps" | "rpe" | "isWarmup"> & { setNumber: string },
): string {
  const parts = [
    sessionKey,
    exerciseName.trim().toLowerCase(),
    set.setNumber.trim(),
    set.weightKg ?? "",
    set.reps ?? "",
    set.rpe ?? "",
    set.isWarmup ? "w" : "n",
  ];
  return parts.join("|");
}

/** Sort key for chronological review: oldest session first. */
function byStart(a: ImportSession, b: ImportSession): number {
  return a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0;
}

/**
 * Reads a file's rows into sessions.
 *
 * Takes an iterable rather than an array so the worker can hand it rows as they
 * stream off disk and never hold the file and the result at the same time.
 *
 * Sessions are grouped by fingerprint in a map and assembled at the end rather
 * than closed when the key changes, because neither source guarantees its rows
 * are grouped by session. A file sorted by date instead of by workout would
 * otherwise produce one session per alternating row.
 */
export function analyzeImport(
  headers: readonly string[],
  rows: Iterable<RawRow>,
  options: AnalyzeOptions,
): ImportAnalysis {
  const now = options.now ?? (() => Date.now());
  const unit = options.weightUnit ?? "kg";
  const existing = options.existing ?? new Set<string>();
  const index = resolveIndex(headers, options.mapping);

  const issues: ImportIssue[] = [];
  const grouped = new Map<string, ImportSession>();
  const names = new Set<string>();
  /** Set signatures already imported, for the within-file duplicate check. */
  const seenSets = new Set<string>();
  /** Sessions whose repeats have already been reported, so the log stays short. */
  const reportedDuplicateRuns = new Set<string>();

  let totalRows = 0;
  let duplicateSets = 0;

  const log = (code: ImportIssueCode, line: number | null, message: string, detail?: string) =>
    issues.push({ code, line, message, detail });

  // ---- the header itself -------------------------------------------------
  if (headers.length === 0) {
    log("no_header", null, T.issue.noHeader);
    return emptyAnalysis(options.source, issues, now());
  }

  if (headers.some((h) => h === "")) {
    // Not fatal -- an unnamed column is simply unmappable -- but it is worth
    // saying out loud, because it usually means the delimiter was guessed wrong
    // and every value below is in the wrong field.
    log("no_header", 1, T.issue.blankHeader);
  }

  // ---- the rows ----------------------------------------------------------
  for (const row of rows) {
    totalRows += 1;
    if (row.cells.length !== headers.length) {
      log(
        "ragged_row",
        row.line,
        T.issue.raggedRow,
        T.issue.raggedDetail(`${row.cells.length}`, `${headers.length}`),
      );
    }

    const dateRaw = cell(row, index, "date");
    const exercise = cell(row, index, "exercise");

    if (dateRaw === "") {
      log("missing_date", row.line, T.issue.missingDate);
      continue;
    }

    const startedAt = parseImportDate(dateRaw);
    if (startedAt === null) {
      log("unparseable_date", row.line, T.issue.unparseableDate, dateRaw);
      continue;
    }

    if (exercise === "") {
      log("missing_exercise", row.line, T.issue.missingExercise);
      continue;
    }
    names.add(exercise);

    // ---- the set, and whether it survives ---------------------------
    const weight = parseImportWeight(cell(row, index, "weight"), unit);
    const reps = parseReps(cell(row, index, "reps"));
    const rpe = parseRpe(cell(row, index, "rpe"));

    if (weight.invalid) {
      log("unparseable_weight", row.line, T.issue.unparseableWeight, cell(row, index, "weight"));
    }
    if (reps.invalid) {
      log("unparseable_reps", row.line, T.issue.unparseableReps, cell(row, index, "reps"));
    }
    if (rpe.invalid) {
      // Not fatal: RPE is the one field a session can be complete without, and
      // dropping the row over a mistyped 11 would be a worse answer than
      // importing the set with no RPE.
      log("unparseable_reps", row.line, T.issue.unparseableRpe, cell(row, index, "rpe"));
    }

    const title = cell(row, index, "title") || T.defaultSessionTitle;
    const fingerprint = sessionFingerprint(startedAt, title);

    // The session is created before the set is judged, so a session whose rows
    // are all comments still exists here and can be reported in the log. The
    // alternative -- skipping the row outright -- produces no session at all,
    // and a file that silently imports nothing looks exactly like a file the
    // user picked the wrong columns for.
    let session = grouped.get(fingerprint);
    if (!session) {
      session = {
        key: fingerprint,
        title,
        startedAt,
        notes: firstNonEmpty(cell(row, index, "notes")),
        sets: [],
        firstLine: row.line,
      };
      grouped.set(fingerprint, session);
    }

    // A row with no weight and no reps is a comment, not a set. Hevy writes
    // those as `notes` on an otherwise empty row, and importing them would put
    // phantom bodyweight sets into the history.
    if (weight.kg === null && reps.reps === null) continue;

    // ---- within-file duplicate ---------------------------------------
    // Only possible when the file numbers its sets, and that condition is the
    // point: two identical 60x10 sets in one session are two real sets, and
    // without a set number there is nothing that tells a repeat apart from a
    // second set. Guessing here would delete work.
    if (options.mapping.setNumber !== null) {
      const signature = setFingerprint(fingerprint, exercise, {
        setNumber: cell(row, index, "setNumber"),
        weightKg: weight.kg,
        reps: reps.reps,
        rpe: rpe.rpe,
        isWarmup: isWarmupSetType(cell(row, index, "setType")),
      });
      if (seenSets.has(signature)) {
        // One line for the whole run of repeats, not one per row: a
        // double-pasted five-set session is five identical log entries otherwise.
        if (!reportedDuplicateRuns.has(fingerprint)) {
          reportedDuplicateRuns.add(fingerprint);
          log("duplicate_set", row.line, T.issue.duplicateSet, cell(row, index, "exercise"));
        }
        duplicateSets += 1;
        continue;
      }
      seenSets.add(signature);
    }

    const set: ImportSet = {
      exerciseName: exercise,
      weightKg: weight.kg,
      reps: reps.reps,
      rpe: rpe.invalid ? null : rpe.rpe,
      // Renumbered on insert, not from the file: see ImportSet.setNumber.
      setNumber: session.sets.filter((s) => s.exerciseName === exercise).length + 1,
      isWarmup: isWarmupSetType(cell(row, index, "setType")),
      completed: true,
      durationSec: null,
      distanceM: null,
    };
    session.sets.push(set);
  }

  // ---- assemble ----------------------------------------------------------
  const sessions: ImportSession[] = [];
  let duplicateSessions = 0;
  let emptySessions = 0;

  for (const session of grouped.values()) {
    if (existing.has(session.key)) {
      duplicateSessions += 1;
      // The whole session goes, not just the overlapping sets. A partial import
      // would leave the user with two copies of the parts that did not collide
      // and no way to tell which is which.
      log("duplicate_session", session.firstLine, T.issue.duplicateSession, session.title);
      continue;
    }
    if (session.sets.length === 0) {
      emptySessions += 1;
      log("no_sets", session.firstLine, T.issue.noSets, session.title);
      continue;
    }
    sessions.push(renumber(session));
  }
  sessions.sort(byStart);

  // Counted here, not as the rows are read: a session dropped as a duplicate
  // never lands, and "we imported 4.000 series" must not include them. The same
  // number drives `skippedRows`, which is why it is computed once and reused.
  const importedSets = sessions.reduce((total, session) => total + session.sets.length, 0);

  if (options.mapping.exercise === null) {
    log("no_exercises_mapped", null, T.issue.exerciseNotMapped);
  }

  return {
    source: options.source,
    sessions,
    issues,
    stats: {
      totalRows,
      importedSets,
      skippedRows: Math.max(0, totalRows - importedSets),
      sessions: sessions.length,
      distinctExercises: names.size,
      duplicateSessions,
      duplicateSets,
      emptySessions,
    },
    exerciseNames: [...names].sort((a, b) => a.localeCompare(b, "es")),
    batchId: `import-${now()}`,
  };
}

/** Gaps closed: sets are renumbered 1..n per exercise, in file order. */
function renumber(session: ImportSession): ImportSession {
  const counters = new Map<string, number>();
  return {
    ...session,
    sets: session.sets.map((set) => {
      const next = (counters.get(set.exerciseName) ?? 0) + 1;
      counters.set(set.exerciseName, next);
      return { ...set, setNumber: next };
    }),
  };
}

function firstNonEmpty(value: string): string | null {
  return value === "" ? null : value;
}

function emptyAnalysis(
  source: ImportAnalysis["source"],
  issues: ImportIssue[],
  now: number,
): ImportAnalysis {
  return {
    source,
    sessions: [],
    issues,
    stats: {
      totalRows: 0,
      importedSets: 0,
      skippedRows: 0,
      sessions: 0,
      distinctExercises: 0,
      duplicateSessions: 0,
      duplicateSets: 0,
      emptySessions: 0,
    },
    exerciseNames: [],
    batchId: `import-${now}`,
  };
}
