import type { CatalogExercise, StationKey } from "@/lib/catalog/types";

export type SmartLoadMode = "overload" | "cross_transfer" | "biometric_day_0" | "bodyweight";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type SetFeedback = "too_light" | "perfect" | "too_heavy";
export type SmartSetType = "warmup" | "normal" | "dropset" | "failure";

export interface HistoricalCompletion {
  weightKg: number;
  reps: number;
  completed: boolean;
}

export interface SmartLoadParams {
  mode: SmartLoadMode;
  weightKg?: number;
  reps?: number;
  targetReps?: number;
  weightHistory?: readonly HistoricalCompletion[];
  sourceOneRmKg?: number;
  targetStation?: StationKey;
  experienceLevel?: ExperienceLevel;
}

export interface SmartLoadResult {
  weightKg: number;
  suggestedReps: number;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface SmartWorkoutSet {
  weightKg: number;
  reps: number;
  type: SmartSetType;
  completed?: boolean;
}

const TRANSFER_FACTORS: Partial<Record<StationKey, number>> = {
  leg_press_45: 1.5,
  free_weight_area: 1,
  flat_bench: 0.9,
  incline_bench: 0.85,
  squat_rack: 0.9,
  smith_machine: 0.85,
  cable_high_pulley: 0.65,
  cable_low_pulley: 0.65,
  cable_mid_pulley: 0.65,
  cable_seated_row: 0.65,
  cable_lat_pulldown: 0.65,
  cable_triceps_station: 0.65,
};

function finite(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function roundLoad(value: number): number {
  return Math.max(0, Math.round(value * 2) / 2);
}

function epley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

function dayZeroFactor(station: StationKey | undefined, movementPattern?: string): number {
  if (station === "leg_press_45") return 1.2;
  if (station === "squat_rack" || station === "smith_machine") return 0.6;
  if (station === "flat_bench" || station === "incline_bench") return 0.45;
  if (station?.startsWith("cable_")) return 0.4;
  if (movementPattern === "isolation" || station === "free_weight_area") return 0.15;
  return 0.3;
}

/**
 * The machines that only ever host the athlete's own body.
 *
 * A pull-up bar, a decline bench for abdominals or a hyperextension bench are
 * machines, so the catalog maps them to an `CG-EQP-*` id — and a mapped id is
 * exactly what used to make the engine treat a pull-up as a loaded barbell and
 * prescribe "Barra 7kg". The machine is a place, not a load.
 */
const BODYWEIGHT_EQUIPMENT_IDS = new Set(["CG-EQP-0051", "CG-EQP-0028", "CG-EQP-0015"]);

/** What a calisthenics movement is called in the catalog and in a coach's rename. */
const BODYWEIGHT_NAME_HINTS = [
  "elevacion de piernas",
  "elevacion de rodillas",
  "dominada",
  "pull-up",
  "pull up",
  "chin-up",
  "chin up",
  "fondos",
  "flexiones",
  "push-up",
  "push up",
  "dip",
  "plancha",
  "abdominal",
  "crunch",
  "hiperextension",
  "extension lumbar",
  "bicicleta",
  "estiramiento",
];

/**
 * Words that mean the movement does carry something.
 *
 * "Crunch en polea" and "dominadas con lastre" are loaded movements that happen to
 * be named after a calisthenics one: the machine or the added weight decides.
 */
const LOADED_NAME_HINTS = [
  "polea",
  "cable",
  "mancuerna",
  "barra",
  "disco",
  "lastre",
  "kettlebell",
  "pesa rusa",
  "smith",
  "maquina",
  "máquina",
  "hack",
  "hack squat",
  "press",
];

/** The parts of a catalog row the load estimate needs to recognise. */
export interface BodyweightCandidate {
  equipment_id?: string | null;
  equipment?: string | null;
  name?: string | null;
  name_es?: string | null;
  movement_pattern?: string | null;
}

/** The load-free prescription shown instead of a bar breakdown. */
export const BODYWEIGHT_LOAD_HINT = "Peso corporal · Controla el balanceo (lastre opcional)";

/** Case- and accent-insensitive, so "Elevación" and "elevacion" are one movement. */
function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Whether a movement is done with the athlete's own body and nothing else.
 *
 * One rule, in one place: the training screen asks it before estimating a load,
 * and every caller gets the same answer. A bodyweight exercise has no number to
 * estimate, so the engine must not invent one for it.
 */
export function isBodyweightExercise(
  input: BodyweightCandidate | null | undefined,
): boolean {
  if (!input) return false;

  const equipmentId = (input.equipment_id ?? "").trim();
  if (equipmentId === "NONE") return true;
  if (BODYWEIGHT_EQUIPMENT_IDS.has(equipmentId.toUpperCase())) return true;

  const equipment = foldName(input.equipment ?? "");
  if (equipment === "body weight" || equipment === "bodyweight" || equipment === "assisted") {
    return true;
  }

  const name = foldName(`${input.name ?? ""} ${input.name_es ?? ""}`);
  if (!name.trim()) return false;
  if (LOADED_NAME_HINTS.some((hint) => name.includes(hint))) return false;
  return BODYWEIGHT_NAME_HINTS.some((hint) => name.includes(hint));
}

export function estimateSmartLoad(params: SmartLoadParams & {
  movementPattern?: string;
}): SmartLoadResult {
  const targetReps = Math.max(1, Math.round(finite(params.targetReps, 8)));

  // An exercise with no external load has no load to estimate: a push-up is
  // fifteen reps, not "65 kg times a station factor". Inventing a number here is
  // how a first session ends up loaded with a weight the movement never had.
  if (params.mode === "bodyweight") {
    return {
      weightKg: 0,
      suggestedReps: Math.max(targetReps, 15),
      reason: "Peso corporal: la carga la pone el atleta, no una barra.",
      confidence: "high",
    };
  }

  if (params.mode === "biometric_day_0") {
    const rawBodyWeight = finite(params.weightKg, 65);
    if (rawBodyWeight < 0) {
      return {
        weightKg: 0,
        suggestedReps: targetReps,
        reason: "Peso corporal inválido; iniciar sin carga externa.",
        confidence: "low",
      };
    }
    const bodyWeight = rawBodyWeight > 0 ? rawBodyWeight : 65;
    const experienceFactor = {
      beginner: 0.7,
      intermediate: 0.85,
      advanced: 1,
    }[params.experienceLevel ?? "beginner"];

    return {
      weightKg: roundLoad(bodyWeight * experienceFactor * dayZeroFactor(params.targetStation, params.movementPattern)),
      suggestedReps: targetReps,
      reason: "Carga inicial calculada por peso corporal, experiencia y estación.",
      confidence: "medium",
    };
  }

  if (params.mode === "cross_transfer") {
    const sourceOneRm = finite(
      params.sourceOneRmKg,
      epley(finite(params.weightKg), Math.max(1, Math.round(finite(params.reps, targetReps)))),
    );
    const factor = TRANSFER_FACTORS[params.targetStation ?? "free_weight_area"] ?? 0.5;
    return {
      weightKg: roundLoad((sourceOneRm * factor) / (1 + targetReps / 30)),
      suggestedReps: targetReps,
      reason: "Carga transferida mediante 1RM Epley y estación objetivo.",
      confidence: sourceOneRm > 0 ? "high" : "low",
    };
  }

  const completed = (params.weightHistory ?? []).filter(
    (entry) => entry.completed && entry.weightKg > 0 && entry.reps > 0,
  );
  const latest = completed.at(-1);
  if (!latest) {
    return {
      weightKg: roundLoad(finite(params.weightKg)),
      suggestedReps: targetReps,
      reason: "Sin historial suficiente para progresar.",
      confidence: "low",
    };
  }

  const achievedTarget = latest.reps >= targetReps;
  return {
    weightKg: roundLoad(latest.weightKg + (achievedTarget ? 2.5 : 0)),
    suggestedReps: targetReps,
    reason: achievedTarget
      ? "Objetivo completado: incremento progresivo recomendado."
      : "Mantener carga hasta completar el rango objetivo.",
    confidence: "high",
  };
}

export function generateSmartWarmupSets(
  workingWeightKg: number,
  musclePreviouslyWorked: boolean,
): SmartWorkoutSet[] {
  const weight = Math.max(0, finite(workingWeightKg));
  if (musclePreviouslyWorked) {
    return [{ weightKg: roundLoad(weight * 0.5), reps: 8, type: "warmup", completed: false }];
  }
  return [
    { weightKg: roundLoad(weight * 0.4), reps: 12, type: "warmup" },
    { weightKg: roundLoad(weight * 0.6), reps: 8, type: "warmup" },
    { weightKg: roundLoad(weight * 0.8), reps: 4, type: "warmup" },
  ];
}

export function calibratePendingSets<T extends { weightKg: number }>(
  sets: readonly T[],
  index: number,
  feedback: SetFeedback,
): T[] {
  const multiplier = feedback === "too_light" ? 1.05 : feedback === "too_heavy" ? 0.9 : 1;
  return sets.map((set, setIndex) =>
    setIndex <= index ? { ...set } : { ...set, weightKg: roundLoad(set.weightKg * multiplier) },
  );
}

export function getAdaptiveRestSeconds(
  setType: SmartSetType,
  movementPattern?: string,
): number {
  if (setType === "warmup") return 45;
  if (setType === "failure" || setType === "dropset") return 90;
  const compounds = new Set(["squat", "hinge", "horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull"]);
  return compounds.has(movementPattern ?? "") ? 120 : 75;
}

export function getLoadBreakdownHint(
  weightKg: number,
  station: StationKey,
  equipment?: string,
): string {
  const weight = roundLoad(weightKg);
  // A bar and a dip station carry the athlete, not a load: there is no bar
  // breakdown to describe, and inventing one is what put "Barra 7kg" on a pull-up.
  if (station === "pullup_dip_station") return BODYWEIGHT_LOAD_HINT;
  if (station === "free_weight_area" && equipment?.toLowerCase().includes("dumbbell")) {
    return `Mancuerna ${roundLoad(weight / 2)}kg por mano`;
  }
  if (station.startsWith("cable_")) return `Torre ${weight}kg · seleccionar pasador`;
  if (weight <= 20) return `Barra ${weight}kg`;
  return `Barra 20kg + [${roundLoad((weight - 20) / 2)}kg]/lado`;
}

export interface SmartSubstitute {
  exercise: CatalogExercise;
  suggestedWeightKg: number;
  imageUrl: string;
  conversionReason: string;
}

export function findSmartSubstitutes(
  current: CatalogExercise,
  weightKg: number,
  catalog: readonly CatalogExercise[],
): SmartSubstitute[] {
  const eligible = catalog.filter((exercise) =>
    exercise.id !== current.id &&
    exercise.availableInCronosGym !== false &&
    exercise.equipment_id !== current.equipment_id,
  );
  const primary = eligible.filter((exercise) =>
    Boolean(current.movement_pattern) &&
    exercise.movement_pattern === current.movement_pattern,
  );
  const secondary = eligible.filter((exercise) =>
    exercise.muscle_group === current.muscle_group ||
    exercise.target === current.target ||
    exercise.body_part === current.body_part,
  );
  const candidates = [...primary, ...secondary].filter((exercise, index, list) =>
    list.findIndex((item) => item.id === exercise.id) === index,
  );
  return candidates
    .slice(0, 4)
    .map((exercise) => ({
      exercise,
      suggestedWeightKg: roundLoad(weightKg * 0.75),
      imageUrl: exercise.image || exercise.gif_url,
      conversionReason: "Conversión conservadora entre estaciones.",
    }));
}

export const SET_TYPE_GUIDES = {
  warmup: "W · Aproximación: prepara el músculo sin generar fatiga.",
  normal: "1, 2, 3 · Serie efectiva: termina con RIR 1–2.",
  dropset: "D · Drop Set: reduce la carga y continúa sin descanso.",
  failure: "F · Al fallo: detén la serie cuando se pierda la técnica.",
} as const;
