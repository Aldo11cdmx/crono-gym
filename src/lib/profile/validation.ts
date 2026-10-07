/**
 * validation.ts — pure validators for the athlete context fields.
 *
 * These functions exist because the context form is the one place in the app where
 * a user types a number that becomes part of a prompt to a model, and a prompt
 * that contains `NaN` or an unbounded weight is a prompt the model cannot reason
 * about. Every check here is a predicate that returns a message, never throws:
 * the form collects the first failing field and shows it inline rather than
 * crashing the render.
 *
 * Bounds are training-sane rather than medical: a 700 kg deadlift is a data-entry
 * error, and rejecting it costs one keystroke; accepting it costs the coach a
 * number it cannot coach from.
 */

/** Range a bodyweight in kg may occupy and still be a real human. */
export const BODY_WEIGHT_RANGE_KG = { min: 20, max: 320 } as const;

/** Range a height in cm may occupy and still be a real human. */
export const HEIGHT_RANGE_CM = { min: 90, max: 250 } as const;

/** Range a days-per-week count may occupy. */
export const DAYS_PER_WEEK_RANGE = { min: 1, max: 7 } as const;

/** A free-text injury note, capped so a prompt cannot balloon. */
export const INJURY_MAX_CHARS = 200;

export type ValidationError = string;

/**
 * Validates one bodyweight value.
 *
 * Empty is not an error here: the field is optional and the caller decides whether
 * an unset weight is a gap worth surfacing. What *is* an error is a value that is
 * not a number or that falls outside the human range.
 */
export function validateBodyWeightKg(value: string): ValidationError {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return "Peso corporal: introduce un número.";
  if (n < BODY_WEIGHT_RANGE_KG.min || n > BODY_WEIGHT_RANGE_KG.max) {
    return `Peso corporal: entre ${BODY_WEIGHT_RANGE_KG.min} y ${BODY_WEIGHT_RANGE_KG.max} kg.`;
  }
  return "";
}

/**
 * Validates one height value, in cm.
 *
 * Same contract as {@link validateBodyWeightKg}: optional, range-checked, never
 * throws. The unit is fixed to cm because the form is metric-only and the
 * conversion happens at the edge in `profile.ts`.
 */
export function validateHeightCm(value: string): ValidationError {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return "Altura: introduce un número.";
  if (n < HEIGHT_RANGE_CM.min || n > HEIGHT_RANGE_CM.max) {
    return `Altura: entre ${HEIGHT_RANGE_CM.min} y ${HEIGHT_RANGE_CM.max} cm.`;
  }
  return "";
}

/**
 * Validates the days-per-week context field.
 *
 * Unlike weight and height this one is required when the athlete has not yet
 * completed onboarding, so the form can ask for it without ambiguity. The check
 * here is only about range; presence is the caller's concern.
 */
export function validateDaysPerWeek(value: string): ValidationError {
  const trimmed = value.trim();
  if (trimmed === "") return "Días por semana: elige entre 1 y 7.";
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Días por semana: introduce un número entero.";
  if (n < DAYS_PER_WEEK_RANGE.min || n > DAYS_PER_WEEK_RANGE.max) {
    return `Días por semana: entre ${DAYS_PER_WEEK_RANGE.min} y ${DAYS_PER_WEEK_RANGE.max}.`;
  }
  return "";
}

/**
 * Validates the free-text injury note.
 *
 * Only length, on purpose: there is nothing to type that is *wrong*, and a
 * validator that tried to guess intent would teach the athlete to write around
 * it. The cap exists so a paste of a medical record cannot bloat a prompt.
 */
export function validateInjuries(value: string): ValidationError {
  if (value.length > INJURY_MAX_CHARS) {
    return `Lesiones: máximo ${INJURY_MAX_CHARS} caracteres.`;
  }
  return "";
}

/** Runs every field validator and returns the first message, or "" if all pass. */
export function validateAthleteContext(input: {
  bodyWeightKg: string;
  heightCm: string;
  daysPerWeek: string;
  injuries: string;
}): ValidationError {
  return (
    validateBodyWeightKg(input.bodyWeightKg) ||
    validateHeightCm(input.heightCm) ||
    validateDaysPerWeek(input.daysPerWeek) ||
    validateInjuries(input.injuries) ||
    ""
  );
}