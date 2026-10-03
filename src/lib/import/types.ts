/**
 * types.ts — the shape an import takes, independent of either source.
 *
 * These types are the seam between "a CSV someone exported" and "rows in
 * `workout_logs`". Everything above this line speaks {@link ImportSession};
 * everything below it speaks Hevy or Strong. The import wizard, the worker and
 * the tests all sit on this side, which is why a third source would be an alias
 * table and not a new code path.
 *
 * Weights are **kg** everywhere here, whatever unit the file was in. Both the
 * `profiles` row and `completed_sets` store metric, and a conversion done at the
 * edge is the only one that cannot be forgotten later.
 */

import type { WeightUnit } from "@/context/GymSettingsContext";

/** Apps whose exports we know how to read. */
export const IMPORT_SOURCES = ["hevy", "strong", "generic"] as const;

export type ImportSource = (typeof IMPORT_SOURCES)[number];

/** The things a mapping can point a column at. Order is the wizard's field order. */
export const CANONICAL_FIELDS = [
  "date",
  "title",
  "exercise",
  "weight",
  "reps",
  "rpe",
  "setNumber",
  "setType",
  "notes",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/** Header name -> field. A `null` is a field the user has not chosen yet. */
export type ColumnMapping = Record<CanonicalField, string | null>;

/** One set as read from a file. `weightKg` is metric even if the file was not. */
export interface ImportSet {
  exerciseName: string;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  /**
   * Position within its exercise, 1-based and gapless.
   *
   * Renumbered on the way in: a file that skipped from set 2 to set 5 would
   * otherwise leave `completed_sets.set_number` with a hole, and every consumer
   * that assumes "the last set is the highest number" would read the wrong one.
   */
  setNumber: number;
  isWarmup: boolean;
  completed: boolean;
  durationSec: number | null;
  distanceM: number | null;
}

/** One training session, assembled from every row that shared its key. */
export interface ImportSession {
  /** Fingerprint of the session; also the id used to undo the whole batch. */
  key: string;
  title: string;
  /** ISO 8601. The instant the session started, not when the file was exported. */
  startedAt: string;
  notes: string | null;
  sets: ImportSet[];
  /** 1-based source line of this session's first row, for the error log. */
  firstLine: number;
}

/**
 * Every way a row can fail to become a set.
 *
 * A closed union, not a string, because the error log is the only feedback an
 * importer gets: "se importaron 4.000 series de 4.312 filas" with no way to find
 * the other 312 is the failure mode this whole type exists to prevent.
 */
export type ImportIssueCode =
  | "empty_file"
  | "no_header"
  | "ragged_row"
  | "missing_date"
  | "unparseable_date"
  | "missing_exercise"
  | "unparseable_weight"
  | "unparseable_reps"
  | "no_sets"
  | "duplicate_session"
  | "duplicate_set"
  | "no_exercises_mapped";

export interface ImportIssue {
  code: ImportIssueCode;
  /** 1-based source line, or null for a file-level problem. */
  line: number | null;
  /** Spanish, ready to render. */
  message: string;
  /** The offending value, for the log's expandable detail. */
  detail?: string;
}

export interface ImportStats {
  totalRows: number;
  /** Rows that became a set. */
  importedSets: number;
  /** Rows rejected, for any reason. Always `totalRows - skippedRows`. */
  skippedRows: number;
  sessions: number;
  /** Distinct exercise names in the file, before any catalog matching. */
  distinctExercises: number;
  duplicateSessions: number;
  duplicateSets: number;
  /** A session dropped because nothing in it was importable. */
  emptySessions: number;
}

export interface ImportAnalysis {
  source: ImportSource;
  /** Sorted oldest first, so a user reviewing the preview reads chronologically. */
  sessions: ImportSession[];
  issues: ImportIssue[];
  stats: ImportStats;
  /** Distinct exercise names, for the mapping step. */
  exerciseNames: string[];
  /** A stable id for the whole run, used to undo it as one batch. */
  batchId: string;
}

export interface AnalyzeOptions {
  mapping: ColumnMapping;
  source: ImportSource;
  /** The unit the file's weights are written in. Everything is converted to kg. */
  weightUnit?: WeightUnit;
  /**
   * Fingerprints already in the database, so re-importing a file that was
   * already imported is a no-op rather than a second copy of every session.
   */
  existing?: ReadonlySet<string>;
  /** Injected so the fingerprint is deterministic in tests. */
  now?: () => number;
}
