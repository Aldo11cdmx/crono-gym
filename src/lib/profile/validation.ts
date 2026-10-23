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

// --------------------------------------------------------------- parsers

/**
 * Parses a weight string into kg.
 *
 * Accepts a comma or a point as the decimal separator, because the form is
 * filled by athletes in multiple locales and a user who typed "67,5" should
 * not be told their weight is invalid. `NaN`, negatives and non-finite values
 * resolve to `null` rather than throwing.
 */
export function parseWeightKg(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalised = trimmed.replace(",", ".");
  const n = Number(normalised);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Parses a height string into cm.
 *
 * Same contract as {@link parseWeightKg}: comma or point, negatives and
 * non-finite resolve to `null`.
 */
export function parseHeightCm(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalised = trimmed.replace(",", ".");
  const n = Number(normalised);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** True when the parsed weight is inside the human range. */
export function isValidWeightKg(kg: number): boolean {
  return kg >= BODY_WEIGHT_RANGE_KG.min && kg <= BODY_WEIGHT_RANGE_KG.max;
}

/** True when the parsed height is inside the human range. */
export function isValidHeightCm(cm: number): boolean {
  return cm >= HEIGHT_RANGE_CM.min && cm <= HEIGHT_RANGE_CM.max;
}

// ----------------------------------------------------------- free text

/**
 * Sanitises a free-text field before it reaches a prompt.
 *
 * The injury note is the one place a user can type arbitrary text, and it is
 * the one place where injection matters. This function does three things:
 *
 *   1. Trims and collapses whitespace, removing control characters and line
 *      breaks so a multi-line paste cannot smuggle a new instruction.
 *   2. Neutralises the sequences that would let a user close the
 *      `<datosUsuario>` delimiter the preamble wraps their text in, or inject
 *      a fake system message: literal `<` and `>`, backticks, and the phrase
 *      "ignora las instrucciones" case-insensitively.
 *   3. Truncates to a hard cap, so a paste of a medical record cannot bloat
 *      the prompt.
 *
 * It does not try to guess intent. A validator that rewrites what the user
 * typed teaches them to write around it.
 */
export const FREE_TEXT_MAX_CHARS = 200;

const FREE_TEXT_NEUTRALISE: { from: RegExp; to: string }[] = [
  { from: /ignora las instrucciones/gi, to: "[ignora las instrucciones]" },
  { from: /system:/gi, to: "[system]" },
  { from: /###/g, to: "[###]" },
];

export function sanitizeFreeText(raw: string): string {
  let out = raw.trim();
  // Strip control characters and line breaks; collapse runs of whitespace.
  out = out.replace(/[\x00-\x1F\x7F]+/g, " ");
  out = out.replace(/\s+/g, " ");
  // Neutralise angle brackets and backticks so the user cannot close the
  // `<datosUsuario>` delimiter or open a code block.
  out = out.replace(/[<>`]/g, " ");
  for (const { from, to } of FREE_TEXT_NEUTRALISE) {
    out = out.replace(from, to);
  }
  if (out.length > FREE_TEXT_MAX_CHARS) out = out.slice(0, FREE_TEXT_MAX_CHARS);
  return out.trim();
}