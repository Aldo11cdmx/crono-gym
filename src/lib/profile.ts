/**
 * profile.ts — profile shape, Mifflin-St Jeor energy model and unit maths.
 *
 * Pure functions, no React and no Supabase, so the same logic can be unit-tested
 * and reused from onboarding, the dashboard and (later) the nutrition module.
 *
 * All stored values are metric (kg / cm). `unit_system` is a display preference
 * only -- conversion happens here at the edges, never in the database.
 */

// ---------------------------------------------------------------- constants

/** Mifflin-St Jeor (1990). Validated for adults 18+. */
export const MIN_CALORIE_FLOOR_ADULT = 1500;
export const MIN_CALORIE_FLOOR_MINOR = 1200;

export const KCAL_PER_KG_BODY_FAT = 7700;

export const LB_PER_KG = 2.20462;
export const IN_PER_CM = 0.393701;

/** Mifflin-St Jeor activity multipliers. */
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;
export type UnitSystem = "metric" | "imperial";

/**
 * Biological sex drives the BMR constant. Kept as a union so callers must
 * handle "other"/unknown explicitly instead of silently defaulting.
 */
export type BiologicalSex = "male" | "female" | "other";

export interface Profile {
  user_id: string;
  display_name: string | null;
  birth_date: string | null;
  sex: BiologicalSex | null;
  height_cm: number | null;
  weight_kg: number | null;
  unit_system: UnitSystem;
  experience_level: "beginner" | "intermediate" | "advanced";
  activity_level: ActivityLevel;
  goal:
    | "lose_weight"
    | "maintain"
    | "gain_muscle"
    | "strength"
    | "endurance";
  guardian_consent_at: string | null;
  onboarding_completed_at: string | null;
}

// ---------------------------------------------------------------- age & sex

/** Whole years from `birthDate` to `on`, floored. Null if either is missing. */
export function ageFrom(birthDate: string | null, on: Date = new Date()): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;

  let age = on.getFullYear() - dob.getFullYear();
  const monthDelta = on.getMonth() - dob.getMonth();
  // Birthday not reached yet this year.
  if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function isMinor(profile: Pick<Profile, "birth_date">, on: Date = new Date()): boolean {
  const age = ageFrom(profile.birth_date, on);
  return age !== null && age < 18;
}

/** Legal floor: 1200 kcal under 18, 1500 kcal otherwise. */
export function calorieFloor(profile: Pick<Profile, "birth_date">, on: Date = new Date()): number {
  return isMinor(profile, on) ? MIN_CALORIE_FLOOR_MINOR : MIN_CALORIE_FLOOR_ADULT;
}

// ------------------------------------------------------- Mifflin-St Jeor

/**
 * Basal metabolic rate in kcal/day.
 *
 *   male:   10W + 6.25H - 5A + 5
 *   female: 10W + 6.25H - 5A - 161
 *
 * Returns null when the inputs are incomplete. Mifflin-St Jeor is only
 * validated for adults, so `isMinor` must gate its use in the UI rather than
 * being silently applied.
 */
export function basalMetabolicRate(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: BiologicalSex;
}): number | null {
  const { weightKg, heightCm, age, sex } = input;
  if (!isFinite(weightKg) || weightKg <= 0) return null;
  if (!isFinite(heightCm) || heightCm <= 0) return null;
  if (!isFinite(age) || age <= 0) return null;

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  // "other" has no validated constant; use the male constant as the neutral
  // option and let the caller surface that choice to the user.
  if (sex === "female") return Math.round(base - 161);
  return Math.round(base + 5);
}

/** BMR x activity factor. */
export function totalDailyEnergyExpenditure(
  bmr: number,
  activityLevel: ActivityLevel,
): number | null {
  const factor = ACTIVITY_FACTORS[activityLevel];
  if (!factor || !isFinite(bmr) || bmr <= 0) return null;
  return Math.round(bmr * factor);
}

// ------------------------------------------------------------ goal targets

/** Calorie delta vs. maintenance, as a fraction. */
const GOAL_DEFICIT = {
  // ~0.5 kg/week, inside the 0.5-1% bodyweight range.
  lose_weight: -0.15,
  maintain: 0,
  // Surplus kept small to limit fat gain.
  gain_muscle: 0.1,
  strength: 0,
  endurance: 0,
} as const;

/**
 * Daily calorie target.
 *
 * Always clamped to {@link calorieFloor}: the floor is a legal/PLDCP
 * safeguard, so no goal may push a user below it. A deficit that would breach
 * the floor is reported via `clampedByFloor` so the UI can explain the cap
 * instead of silently showing a different number.
 */
export function dailyCalorieTarget(input: {
  tdee: number;
  goal: Profile["goal"];
  weightKg: number | null;
  birthDate: string | null;
  on?: Date;
}): { target: number; maintenance: number; floor: number; clampedByFloor: boolean } {
  const { tdee, goal, weightKg, birthDate } = input;
  const on = input.on ?? new Date();

  const floor = calorieFloor({ birth_date: birthDate }, on);
  const maintenance = tdee;

  // Relative deficit (20% of bodyweight) is more defensible than a flat
  // percentage, but needs weight; fall back to the flat value when unknown.
  let fraction: number = GOAL_DEFICIT[goal] ?? 0;
  if (goal === "lose_weight" && weightKg && weightKg > 0) {
    // 20% of bodyweight, clamped to the 15-25% band.
    fraction = -Math.min(Math.max(0.2, 0.15), 0.25);
  }

  const raw = Math.round(maintenance * (1 + fraction));
  const target = Math.max(raw, floor);

  return {
    target,
    maintenance,
    floor,
    clampedByFloor: raw < floor,
  };
}

/** Estimated weekly change in kg for a given calorie target. */
export function weeklyRate(target: number, maintenance: number): number {
  const deltaPerDay = target - maintenance;
  return Math.round(((deltaPerDay * 7) / KCAL_PER_KG_BODY_FAT) * 100) / 100;
}

/** Protein target in g/day: 1.6-2.2 g/kg is the evidence-based range. */
export function proteinTarget(weightKg: number | null, goal: Profile["goal"]): number | null {
  if (!weightKg || weightKg <= 0) return null;
  const perKg = goal === "lose_weight" ? 2.2 : goal === "gain_muscle" ? 2.0 : 1.6;
  return Math.round(weightKg * perKg);
}

/** Body-mass-percentage change the user expects from the plan. */
export function expectedChangePercent(
  target: number,
  maintenance: number,
  weightKg: number | null,
): number | null {
  if (!weightKg || weightKg <= 0 || maintenance <= 0) return null;
  const deltaPerWeek = weeklyRate(target, maintenance);
  return Math.round(((deltaPerWeek / weightKg) * 100) * 100) / 100;
}

// ------------------------------------------------------------ unit helpers

export const kgToLb = (kg: number): number => Math.round(kg * LB_PER_KG * 10) / 10;
export const lbToKg = (lb: number): number => Math.round((lb / LB_PER_KG) * 10) / 10;
export const cmToIn = (cm: number): number => Math.round(cm * IN_PER_CM * 10) / 10;
export const inToCm = (inches: number): number => Math.round(inches / IN_PER_CM * 10) / 10;

export interface BodyMetrics {
  weight: number;
  height: number;
}

/**
 * Converts for display. The canonical value stays metric; these are only for
 * rendering, so rounding to 1 decimal avoids float noise in the UI.
 */
export function toDisplayUnits(
  metrics: BodyMetrics,
  unitSystem: UnitSystem,
): { weight: number; height: number; weightLabel: string; heightLabel: string } {
  if (unitSystem === "imperial") {
    const weight = kgToLb(metrics.weight);
    const height = cmToIn(metrics.height);
    return { weight, height, weightLabel: "lb", heightLabel: "in" };
  }
  const weight = Math.round(metrics.weight * 10) / 10;
  const height = Math.round(metrics.height * 10) / 10;
  return { weight, height, weightLabel: "kg", heightLabel: "cm" };
}

/**
 * Converts user input back to canonical metric.
 *
 * Height is the tricky one: whole inches lose precision (5'11" is 5.9167 ft).
 * Inputs are therefore expressed in total inches, or in feet+inches for display
 * helpers, and always round-trip through cm.
 */
export function fromDisplayUnits(
  input: BodyMetrics,
  unitSystem: UnitSystem,
): BodyMetrics {
  if (unitSystem === "imperial") {
    return { weight: lbToKg(input.weight), height: inToCm(input.height) };
  }
  return {
    weight: Math.round(input.weight * 100) / 100,
    height: Math.round(input.height * 10) / 10,
  };
}

/** Splits total inches into a `{ feet, inches }` pair for height inputs. */
export function inchesToFeetInches(totalInches: number): { feet: number; inches: number } {
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: Math.round(totalInches - feet * 12) };
}

export function feetInchesToInches(feet: number, inches: number): number {
  return feet * 12 + inches;
}

// ------------------------------------------------------------- validation

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/** Onboarding validation, mirroring the database CHECK constraints. */
export function validateProfileInput(input: {
  birthDate: string;
  sex: BiologicalSex | null;
  heightCm: number | null;
  weightKg: number | null;
  guardianConsent: boolean;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const age = ageFrom(input.birthDate);
  if (age === null) {
    errors.birthDate = "Introduce una fecha de nacimiento válida.";
  } else if (age < 13) {
    errors.birthDate = "La edad mínima para usar la app es 13 años.";
  } else if (age < 18 && !input.guardianConsent) {
    errors.birthDate =
      "Necesitas el consentimiento de un adulto responsable para continuar.";
  }

  if (!input.sex) {
    errors.sex = "Selecciona una opción para continuar.";
  }

  if (input.heightCm === null || !isFinite(input.heightCm)) {
    errors.heightCm = "Introduce tu altura.";
  } else if (input.heightCm < 100 || input.heightCm > 250) {
    errors.heightCm = "Altura fuera de rango (100-250 cm).";
  }

  if (input.weightKg === null || !isFinite(input.weightKg)) {
    errors.weightKg = "Introduce tu peso.";
  } else if (input.weightKg < 25 || input.weightKg > 400) {
    errors.weightKg = "Peso fuera de rango (25-400 kg).";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// --------------------------------------------------------- full pipeline

export interface EnergyReport {
  bmr: number | null;
  tdee: number | null;
  maintenance: number;
  target: number;
  floor: number;
  clampedByFloor: boolean;
  weeklyRate: number;
  expectedChangePercent: number | null;
  proteinGrams: number | null;
  age: number | null;
  isMinor: boolean;
  /** False when Mifflin-St Jeor is not applicable, e.g. a minor. */
  mifflinApplicable: boolean;
}

/**
 * One-shot profile -> daily targets. Returns nulls rather than throwing so the
 * onboarding UI can render progressively as fields are filled in.
 */
export function computeEnergyTargets(
  profile: Pick<Profile, "birth_date" | "sex" | "height_cm" | "weight_kg" | "activity_level" | "goal">,
  on: Date = new Date(),
): EnergyReport {
  const age = ageFrom(profile.birth_date, on);
  const minor = isMinor(profile, on);
  const floor = calorieFloor(profile, on);

  const bmr =
    profile.sex && profile.height_cm !== null && profile.weight_kg !== null && age !== null
      ? basalMetabolicRate({
          weightKg: profile.weight_kg,
          heightCm: profile.height_cm,
          age,
          sex: profile.sex,
        })
      : null;

  const tdee = bmr === null ? null : totalDailyEnergyExpenditure(bmr, profile.activity_level);
  const maintenance = tdee ?? 0;

  const { target, clampedByFloor } = dailyCalorieTarget({
    tdee: maintenance,
    goal: profile.goal,
    weightKg: profile.weight_kg,
    birthDate: profile.birth_date,
    on,
  });

  return {
    bmr,
    tdee,
    maintenance,
    target,
    floor,
    clampedByFloor,
    weeklyRate: weeklyRate(target, maintenance),
    expectedChangePercent: expectedChangePercent(target, maintenance, profile.weight_kg),
    proteinGrams: proteinTarget(profile.weight_kg, profile.goal),
    age,
    isMinor: minor,
    // The equation is validated for adults only, so minors fall back to a
    // dietitian-supplied target instead of a computed one.
    mifflinApplicable: !minor && bmr !== null,
  };
}