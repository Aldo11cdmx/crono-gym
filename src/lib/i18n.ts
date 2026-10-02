/**
 * i18n.ts — Spanish labels for the exercise catalog.
 *
 * The catalog stores `body_part`, `target` and `equipment` in English because
 * that is the upstream dataset. Those raw values are what the database queries
 * filter on, so they must never be mutated: translation happens here, at the
 * presentation edge only.
 *
 * Every value present in the seeded catalog is covered. Unknown values fall
 * back to the original string instead of rendering blank, so a future dataset
 * addition degrades to English rather than breaking the UI.
 */

export const BODY_PART_LABELS: Record<string, string> = {
  chest: "Pecho",
  back: "Espalda",
  "upper arms": "Bíceps y Tríceps",
  "lower arms": "Antebrazos",
  shoulders: "Hombros",
  "upper legs": "Cuádriceps",
  "lower legs": "Pantorrillas",
  waist: "Abdomen y Cintura",
  cardio: "Cardio",
  neck: "Cuello",
  // Alternate spellings some catalog revisions use.
  abductors: "Abductores",
  abs: "Abdominales",
  adductors: "Aductores",
  calves: "Pantorrillas",
  "cardiovascular system": "Sistema Cardiovascular",
  forearms: "Antebrazos",
  glutes: "Glúteos",
  hamstrings: "Isquiotibiales",
  lats: "Dorsales",
  pectorals: "Pectorales",
  quads: "Cuádriceps",
  "serratus anterior": "Serrato anterior",
};

export const TARGET_LABELS: Record<string, string> = {
  abs: "Abdominales",
  abductors: "Abductores",
  adductors: "Aductores",
  biceps: "Bíceps",
  calves: "Pantorrillas",
  "cardiovascular system": "Sistema Cardiovascular",
  delts: "Deltoides",
  forearms: "Antebrazos",
  glutes: "Glúteos",
  hamstrings: "Isquiotibiales",
  lats: "Dorsales",
  pectorals: "Pectorales",
  quads: "Cuádriceps",
  "serratus anterior": "Serrato anterior",
  triceps: "Tríceps",
  "upper back": "Espalda alta",
  spine: "Columna vertebral",
  traps: "Trapecios",
  "levator scapulae": "Elevador de la escápula",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  assisted: "Asistido",
  band: "Bandas de resistencia",
  barbell: "Barra",
  "body weight": "Peso corporal",
  "bosu ball": "Balón Bosu",
  cable: "Polea",
  dumbbell: "Mancuernas",
  "ez barbell": "Barra Z",
  hammer: "Martillo",
  kettlebell: "Kettlebell",
  "leverage machine": "Máquina de palanca",
  "medicine ball": "Balón medicinal",
  "olympic barbell": "Barra olímpica",
  rope: "Soga",
  "sled machine": "Trineo",
  "smith machine": "Máquina Smith",
  "stability ball": "Balón de estabilidad",
  "trap bar": "Barra hexagonal",
  weighted: "Con peso añadido",
  "wheel roller": "Rueda abdominal",
  // Present in the catalog but hidden by the "Solo mi gym" filter.
  roller: "Rodillo",
  "resistance band": "Banda de resistencia",
  "stationary bike": "Bici estática",
  "skierg machine": "Máquina SkiErg",
  tire: "Llanta",
  "upper body ergometer": "Remoergómetro",
  "stepmill machine": "Escaladora",
  "elliptic machine": "Elíptica",
  "elliptical machine": "Elíptica",
};

/** All Spanish uppercase labels, for the unit-weight display in the header. */
export const UNITS_LABELS: Record<string, string> = {
  all: "Todos",
};

// -------------------------------------------------------- anatomy filtering

/**
 * UI copy for the anatomy filter.
 *
 * Kept here rather than inline so the browser and the ranks view phrase the same
 * concept the same way, and so tests can assert against stable constants.
 */
export const MUSCLE_FILTER_LABELS = {
  open: "Filtrar por músculo",
  openWithSelection: (count: number): string =>
    count === 1 ? "1 músculo seleccionado" : `${count} músculos seleccionados`,
  front: "Frontal",
  back: "Posterior",
  viewLabel: "Vista del cuerpo",
  removeSelection: "Quitar filtro",
  clearAll: "Limpiar todo",
  alternateList: "Músculos",
  resultsMany: (n: number): string => (n === 1 ? "1 ejercicio" : `${n} ejercicios`),
  hint: "Toca un músculo para filtrar por esa zona.",
  hintActive: (labels: string): string =>
    `Filtrando por ${labels}. Las zonas apagadas no tienen movimientos en el catálogo.`,
  /** Unavailable-region note, named so the empty state can explain itself. */
  inert: "Zonas apagadas",
  chipRemove: (label: string): string => `Quitar filtro ${label}`,
  /** Tells the user which active filter is responsible for an empty result. */
  emptyWithMuscle: (muscleLabel: string): string =>
    `Sin resultados para ${muscleLabel}.`,
  suggestDropEquipment: "¿Quitar filtro de equipo?",
  suggestDropSearch: "¿Quitar la búsqueda?",
  suggestDropMuscle: "¿Quitar el filtro de músculo?",
  suggestDropEverything: "Limpiar todos los filtros",
} as const;

/**
 * UI copy for the anatomical ranks view.
 *
 * The rank names themselves live in `rankConfig.ts` next to their colours and
 * glyphs, because a rank is one concept and splitting its name from its
 * presentation would let them drift apart.
 */
export const RANK_LABELS = {
  title: "Rangos anatómicos",
  subtitle: "Tu nivel por músculo, según fuerza y constancia.",
  globalRank: "Rango global",
  strongest: "Más fuerte",
  weakest: "Enfoque",
  focusHint: "Tu músculo con más margen de mejora.",
  legend: "Leyenda",
  score: "Puntaje",
  ofMax: (score: number): string => `${score} de 100`,
  loading: "Calculando tus rangos…",
  loadError: "No se pudieron calcular los rangos",
  retry: "Reintentar",
  classifiedOf: (classified: number, total: number): string =>
    `${classified} de ${total} músculos clasificados`,
  /** New-user state. */
  emptyTitle: "Registra 3 sesiones para ver tus rangos",
  emptyBody: (needed: number): string =>
    `Necesitamos al menos 3 sesiones del mismo músculo para compararte con los estándares de fuerza. Te ${needed === 1 ? "falta" : "faltan"} ${needed}.`,
  emptyNoBodyweight:
    "Añade tu peso a tu perfil para medir tu fuerza en relación a tu peso corporal.",
  promoted: (muscle: string, rank: string): string => `¡${muscle} subió a ${rank}!`,
  confidence: "Confianza",
  legendHint: "Cada rango tiene color y símbolo, para leerlo sin depender del color.",
} as const;

/** Labels for why a muscle is unranked, keyed by the scorer's reason code. */
export const UNRANKED_REASONS: Record<string, string> = {
  no_data: "Sin datos todavía",
  insufficient_sessions: "Faltan sesiones",
  unknown_bodyweight: "Falta tu peso corporal",
  no_strength_signal: "Sin referencia de fuerza",
};

/** Case-insensitive lookup with a graceful fallback to the raw value. */
function lookup(dictionary: Record<string, string>, value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return trimmed;
  return dictionary[trimmed] ?? dictionary[trimmed.toLowerCase()] ?? trimmed;
}

export function translateBodyPart(value: string): string {
  return lookup(BODY_PART_LABELS, value);
}

export function translateTarget(value: string): string {
  return lookup(TARGET_LABELS, value);
}

export function translateEquipment(value: string): string {
  return lookup(EQUIPMENT_LABELS, value);
}

/** Label for a `FilterSelect` option; "all" is the pseudo-option. */
export function translateOption(value: string): string {
  if (value === "all") return "Todos";
  return translateEquipment(value);
}

/** Body-part options for the browser filter, in the catalog's own order. */
export const BODY_PART_FILTER_VALUES: string[] = [
  "all",
  "upper arms",
  "upper legs",
  "lower arms",
  "lower legs",
  "back",
  "chest",
  "shoulders",
  "waist",
  "cardio",
  "neck",
];

/**
 * Sorts a list of raw catalog values by their Spanish label.
 *
 * Sorting the raw English values would give an English order; sorting by the
 * translated label is what makes the dropdown read naturally in Spanish.
 */
export function sortBySpanishLabel(
  values: string[],
  translate: (value: string) => string,
): string[] {
  return [...values].sort((a, b) =>
    translate(a).localeCompare(translate(b), "es"),
  );
}