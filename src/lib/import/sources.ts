/**
 * sources.ts — what Hevy and Strong call things, and what we call them.
 *
 * Both apps export one row per set, with the session repeated on every row, which
 * is the shape this app's `workout_logs` + `completed_sets` already has. So an
 * import is mostly renaming: the work is entirely in deciding which column is
 * which, and that decision is data rather than logic.
 *
 * The alias tables are therefore the contract, not an implementation detail. Both
 * apps have changed their headers before and will again; adding a spelling to a
 * set here is the whole fix, and a new column that is not in a set is reported to
 * the user in the mapping step instead of being silently dropped.
 *
 * Matching is done on a normalised header -- lowercased, accents stripped,
 * non-alphanumerics collapsed to a single underscore -- because "Set Order",
 * "set_order" and "SETORDER" are the same column in practice and three
 * possibilities in a literal comparison.
 */

import type { CanonicalField, ColumnMapping, ImportSource } from "./types";
import { CANONICAL_FIELDS } from "./types";

/** `"Press, hold"` -> `"press_hold"`. */
export function normaliseHeader(header: string): string {
  return header
    .normalize("NFD")
    // Strip the combining marks NFD just split out, so "Repeticiones" and
    // "repetitions" collapse to the same key.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Header -> canonical field, per source. First match wins, so order matters. */
const ALIASES: Record<ImportSource, Partial<Record<CanonicalField, readonly string[]>>> = {
  hevy: {
    date: ["start_time", "starttime", "date", "workout_date"],
    title: ["title", "workout_name", "routine"],
    exercise: ["exercise_name", "exercise", "movement"],
    weight: ["weight_kg", "weight", "load_kg"],
    reps: ["reps", "repetitions"],
    rpe: ["rpe"],
    setNumber: ["set_index", "set_number", "set_order", "setorder", "set"],
    setType: ["set_type", "type", "set_kind"],
    notes: ["description", "exercise_notes", "notes", "workout_notes"],
  },
  strong: {
    date: ["date", "start_time", "starttime", "workout_date"],
    title: ["workout_name", "title", "routine", "workout"],
    exercise: ["exercise_name", "exercise", "movement"],
    // Strong writes `Weight` in the unit the account is configured for, which is
    // why the analysis step has a unit to convert from rather than assuming kg.
    weight: ["weight", "weight_kg", "load_kg"],
    reps: ["reps", "repetitions"],
    rpe: ["rpe", "workout_rpe", "set_rpe"],
    setNumber: ["set_order", "setorder", "set_index", "set_number", "set"],
    setType: ["set_type", "type", "set_kind"],
    notes: ["exercise_notes", "notes", "workout_notes", "description"],
  },
  generic: {
    date: ["date", "start_time", "starttime", "workout_date", "fecha"],
    title: ["title", "workout_name", "routine", "workout", "sesion"],
    exercise: ["exercise_name", "exercise", "movement", "ejercicio"],
    weight: ["weight_kg", "weight", "load_kg", "peso"],
    reps: ["reps", "repetitions", "repeticiones"],
    rpe: ["rpe"],
    setNumber: ["set_index", "set_number", "set_order", "set", "serie"],
    setType: ["set_type", "type", "set_kind", "tipo"],
    notes: ["description", "exercise_notes", "notes", "workout_notes", "notas"],
  },
};

/**
 * Guesses the source from the header alone.
 *
 * Hevy writes `set_index` and `weight_kg`; Strong writes `set_order` and a bare
 * `Weight`. Both signals are checked before the fallback, because a file that
 * only has `Date,Exercise,Weight,Reps` is the generic case and must be offered
 * the generic mapping rather than Hevy's.
 */
export function detectSource(headers: readonly string[]): ImportSource {
  const keys = new Set(headers.map(normaliseHeader));
  const has = (...names: string[]): boolean => names.some((n) => keys.has(n));

  // Columns only one of the two apps writes. Checked before the pair tests
  // because a single exclusive column is more certain than a pair of common ones,
  // and because these are what a user would recognise on sight if they ever had
  // to pick manually.
  if (has("superset_id") || has("rest_seconds") || has("exercise_notes")) return "hevy";
  if (has("set_order") || has("workout_name")) return "strong";
  // The pair, for exports trimmed down to the columns this app can use.
  // `weight_kg` is the strong signal -- Strong writes a bare `Weight` -- and
  // `set_index` is what separates it from the generic case.
  if (has("weight_kg") && has("set_index")) return "hevy";
  return "generic";
}

/** Fields that must resolve for a file to be importable at all. */
export const REQUIRED_FIELDS: readonly CanonicalField[] = ["date", "exercise"];

/**
 * A best-guess mapping for a source.
 *
 * Matching is **exact** against the normalised header, never a substring. This is
 * the single most important line in the file: `workout_rpe` *contains* `rpe`,
 * `weight_kg` contains `weight`, and `set_type` contains `type`. A substring
 * match hands Strong's session-average RPE to the per-set RPE column and Strong's
 * session total weight to the per-set weight column, and neither mistake is
 * visible -- the import succeeds and every set is wrong.
 *
 * So an unrecognised column resolves to `null`, which the wizard shows as "elige
 * una columna". A wrong guess is far more expensive than a question.
 */
export function suggestMapping(
  headers: readonly string[],
  source: ImportSource,
): ColumnMapping {
  const normalised = headers.map(normaliseHeader);
  const aliases = ALIASES[source];
  const mapping = {} as ColumnMapping;

  for (const field of CANONICAL_FIELDS) {
    // `findIndex` over the candidates, not over the headers: two sources spell
    // the same column differently and one of them writes both (`RPE` and
    // `Workout RPE`), so the alias list has to be the authority on priority.
    const match = (aliases[field] ?? []).find((alias) => normalised.includes(alias));
    mapping[field] = match === undefined ? null : headers[normalised.indexOf(match)];
  }

  return mapping;
}

/** Headers a mapping leaves unclaimed, for the "no usamos esta columna" note. */
export function unmappedHeaders(
  headers: readonly string[],
  mapping: ColumnMapping,
): string[] {
  const used = new Set(Object.values(mapping).filter((h): h is string => h !== null));
  return headers.filter((h) => !used.has(h));
}

/** True when nothing is mapped, i.e. the wizard cannot proceed. */
export function isMappingEmpty(mapping: ColumnMapping): boolean {
  return CANONICAL_FIELDS.every((field) => mapping[field] === null);
}

/** The required fields the user still has to choose. */
export function missingRequired(mapping: ColumnMapping): CanonicalField[] {
  return REQUIRED_FIELDS.filter((field) => mapping[field] === null);
}
