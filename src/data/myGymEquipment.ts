/**
 * myGymEquipment.ts — inventory for the "Mi Gym" filter.
 *
 * Maps the catalog's generic `equipment` tags onto the specific machines
 * available at this gym, so the exercise browser can hide movements that are
 * impossible to perform here.
 *
 * The mapping is a judgement call for the free-weight tags: a rack implies
 * barbell + plates, so barbell/dumbbell/kettlebell exercises are treated as
 * available. Adjust AVAILABLE_EQUIPMENT if that is wrong.
 */

export interface GymMachine {
  name: string;
  group: string;
  /** Catalog equipment tags this machine can perform. */
  tags: string[];
}

/**
 * Free weights implied by the squat rack (plates + bar) plus the free-weight
 * area. This is a judgement call, so it is a single explicit switch:
 * set to false to make the "Mi Gym" filter drop all dumbbell/kettlebell work.
 */
export const FREE_WEIGHTS_AVAILABLE = true;

export const MY_GYM_MACHINES: GymMachine[] = [
  // --- Pierna / Glúteo (13) ---
  { name: "Extensión de cuádriceps", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Curl femoral acostado", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Press de pierna", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Máquina de abducción y aducción", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Sentadilla Hack", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Patada para glúteo", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Sentadilla perfecta", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Press para pierna vertical", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Sentadilla Smith", group: "Pierna / Glúteo", tags: ["smith machine"] },
  { name: "Rack para sentadilla", group: "Pierna / Glúteo", tags: ["barbell", "olympic barbell", "ez barbell"] },
  { name: "Máquina hip thrust", group: "Pierna / Glúteo", tags: ["leverage machine"] },
  { name: "Sentadilla Sissi", group: "Pierna / Glúteo", tags: ["body weight"] },
  { name: "Banca para pantorrilla sentado", group: "Pierna / Glúteo", tags: ["leverage machine"] },

  // --- Espalda / Torso (6) ---
  { name: "Remo sentado para espalda", group: "Espalda / Torso", tags: ["leverage machine"] },
  { name: "Remo sentado en polea baja", group: "Espalda / Torso", tags: ["cable"] },
  { name: "Polea alta", group: "Espalda / Torso", tags: ["cable"] },
  { name: "Polea alta para dorsales", group: "Espalda / Torso", tags: ["cable"] },
  { name: "Máquina para asistencia en tríceps y espalda", group: "Espalda / Torso", tags: ["assisted"] },
  { name: "Banca de hiperextensiones", group: "Espalda / Torso", tags: ["body weight"] },

  // --- Pecho / Hombro (6) ---
  { name: "Máquina flyes", group: "Pecho / Hombro", tags: ["leverage machine"] },
  { name: "Máquina press para pecho", group: "Pecho / Hombro", tags: ["leverage machine"] },
  { name: "Banco declinado para pecho", group: "Pecho / Hombro", tags: ["body weight"] },
  { name: "Máquina press para hombro", group: "Pecho / Hombro", tags: ["leverage machine"] },
  { name: "Banca horizontal para pecho", group: "Pecho / Hombro", tags: ["body weight"] },
  { name: "Banco inclinado para pecho", group: "Pecho / Hombro", tags: ["body weight"] },

  // --- Brazos (3) ---
  { name: "Banco Scott", group: "Brazos", tags: ["body weight"] },
  { name: "Máquina para bíceps y tríceps", group: "Brazos", tags: ["leverage machine"] },
  { name: "Máquina curl Scott", group: "Brazos", tags: ["leverage machine"] },

  // --- General / Core (4) ---
  { name: "Poleas de posiciones en estación", group: "General / Core", tags: ["cable"] },
  { name: "Máquina para abdomen", group: "General / Core", tags: ["leverage machine"] },
  { name: "Bancas para abdominales", group: "General / Core", tags: ["body weight"] },
  { name: "Banca multifuncional", group: "General / Core", tags: ["leverage machine"] },
];

/** Every catalog equipment tag this gym can perform. */
export const MY_GYM_EQUIPMENT_TAGS: ReadonlySet<string> = new Set([
  ...MY_GYM_MACHINES.flatMap((m) => m.tags),
  // Free-weight area / plates implied by the rack.
  ...(FREE_WEIGHTS_AVAILABLE ? ["dumbbell", "kettlebell", "weighted"] : []),
]);

/** Catalog tags present in the dataset but absent from this gym. */
export const UNAVAILABLE_EQUIPMENT: ReadonlySet<string> = new Set([
  "band",
  "resistance band",
  "bosu ball",
  "elliptic machine",
  "hammer",
  "roller",
  "rope",
  "skierg machine",
  "sled machine",
  "stability ball",
  "stationary bike",
  "stepmill machine",
  "tire",
  "trap bar",
  "upper body ergometer",
  "wheel roller",
]);

export const MY_GYM_GROUPS: string[] = [...new Set(MY_GYM_MACHINES.map((m) => m.group))];

export function isAvailableInMyGym(equipment: string): boolean {
  return MY_GYM_EQUIPMENT_TAGS.has(equipment);
}