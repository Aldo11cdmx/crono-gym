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

/**
 * UI copy for the app shell: the bottom navigation and the active-session pill.
 *
 * Two labels per destination, not one. The visible text is shortened to fit under
 * an icon, and the accessible name has to survive being read aloud in a list
 * where five items all start with the same verb -- so the icon's label is a full
 * instruction and the visible one is a noun.
 */
export const SHELL_LABELS = {
  navAriaLabel: "Navegación principal",
  sidebarAriaLabel: "Navegación lateral",
  sidebarPlaceholder: "Barra lateral",
  /** Names a destination, both as a visible label and as an accessible name. */
  destinations: {
    home: { label: "Inicio", aria: "Ir al inicio" },
    library: { label: "Biblioteca", aria: "Ir a la biblioteca" },
    train: { label: "Entrenar", aria: "Ir a entrenar" },
    ranks: { label: "Rangos", aria: "Ir a tus rangos" },
    profile: { label: "Perfil", aria: "Ir a tu perfil" },
  },
  /**
   * Announced when the pill appears.
   *
   * Takes the *untruncated* name on purpose: a screen reader user should not have
   * to hear a name cut mid-word to fit a 20-character budget chosen for pixels.
   */
  pillAriaLabel: (name: string, elapsed: string): string =>
    `Sesión activa: ${name}, ${elapsed}`,
  /** Shown instead of the accent once a session runs long. */
  longSession: "Sesión larga",
} as const;

/**
 * UI copy for the weight stepper.
 *
 * Every string the stepper can show lives here rather than inline, for the reason
 * the rest of this file exists: these are the words a Spanish speaker reads mid-set,
 * and they should be reviewable in one place instead of scattered through JSX.
 *
 * The templates take values as arguments rather than being assembled at the call
 * site, so word order stays a translator's decision.
 */
export const STEPPER_LABELS = {
  /** Accessible name for the whole control. */
  groupAriaLabel: "Peso",
  increaseAriaLabel: "Subir peso",
  decreaseAriaLabel: "Bajar peso",
  /** The editable field. Its accessible name is the current value plus unit. */
  inputAriaLabel: (weight: string, unit: string): string => `Peso: ${weight} ${unit}`,
  /** Header for the plate breakdown. */
  platesLabel: "Discos por lado",
  /** When the bar is carrying nothing but itself. */
  emptyBarPlates: "Solo la barra",
  /**
   * When the requested weight cannot be built exactly.
   *
   * `shortfall` is the weight left on the rack, so the phrasing is "faltan" rather
   * than "sobran": the user asked for more than the plates can give.
   */
  shortfall: (missing: string, unit: string): string => `Faltan ${missing} ${unit}`,
  suggestionLabel: "Sugerido",
  /** Tapping the suggestion chip applies it. */
  applySuggestionAriaLabel: (weight: string, unit: string): string =>
    `Usar el peso sugerido de ${weight} ${unit}`,
  previousSet: (weight: string, reps: string): string => `${weight} × ${reps}`,
  /**
   * The reference becomes a one-tap autofill.
   *
   * The reason this is a button and not a caption: "80 × 5" is a fact the user
   * already knows and does not need to read twice, but re-entering those two
   * numbers for the first set of every session is the single most repeated piece
   * of typing in the whole app.
   */
  applyPreviousAriaLabel: (weight: string, reps: string): string =>
    `Repetir la última vez: ${weight} kilos por ${reps} repeticiones`,
  applyPreviousAriaLabelWithoutReps: (weight: string): string =>
    `Repetir el peso de la última vez: ${weight} kilos`,
  warmupLabel: "Rampa de calentamiento",
  /** Tapping a ramp chip loads that warm-up set. */
  applyWarmupAriaLabel: (weight: string, unit: string): string =>
    `Cargar el calentamiento de ${weight} ${unit}`,
} as const;

/** Unit suffixes. Short because they sit hard against the number. */
export const WEIGHT_UNIT_LABELS = {
  kg: "kg",
  lb: "lb",
} as const;

/**
 * Copy for the set logger.
 *
 * Two separate blocks because they answer different questions: `SET_TYPE_LABELS`
 * names the four kinds a row can be, and everything else describes one row or
 * the undo banner that follows it.
 */
export const SET_TYPE_LABELS: Record<"normal" | "warmup" | "failure" | "drop", string> = {
  normal: "Normal",
  warmup: "Calentamiento",
  failure: "Al fallo",
  // Left in English on purpose: "drop set" is the technique name, and a Spanish
  // lifter reads it as such rather than as a translation.
  drop: "Drop set",
};

export const SET_LOGGER_LABELS = {
  setNumber: (n: number): string => `Serie ${n}`,
  repsLabel: "Repeticiones",
  rpeLabel: "RPE",
  setTypeGroupAriaLabel: "Tipo de serie",
  setTypeAriaLabel: (kind: string, n: number): string => `Serie ${n} de tipo ${kind}`,
  removeAriaLabel: (n: number): string => `Eliminar la serie ${n}`,
  duplicateAriaLabel: (n: number): string => `Duplicar la serie ${n}`,
  complete: "Marcar completada",
  completed: "Serie completada",
  completeAriaLabel: (n: number, completed: boolean): string =>
    completed ? `Marcar la serie ${n} como no completada` : `Marcar la serie ${n} como completada`,
  /**
   * The load delta the overload engine recommends, e.g. "+2.5 kg".
   *
   * Rendered as a chip because it is the *change*, which is the thing worth
   * noticing at a glance; the stepper already shows the resulting weight.
   */
  deltaChip: (delta: string): string => `Ajuste ${delta}`,
  lowConfidence: "El 1RM estimado no es fiable con este número de reps.",
  /**
   * The exercise's reference to the previous session.
   *
   * Deliberately *not* the same wording as the stepper's autofill chip. The
   * header is a metric standing on its own -- a permanent caption on the exercise
   * -- while the chip is an action. Two identical sentences on one screen would
   * read as a mistake, and only one of them is clickable.
   */
  lastSession: (weight: string, unit: string, reps: string): string =>
    `Última sesión: ${weight} ${unit} × ${reps}`,
  lastSessionAriaLabel: (weight: string, unit: string, reps: string): string =>
    `Última sesión: ${weight} ${unit} por ${reps} repeticiones`,
} as const;

/**
 * Copy for the gym settings panel.
 *
 * "Pares por lado" is spelled out rather than left to a bare number, because a
 * count of 2 next to a plate size is ambiguous in a way that matters: it is two
 * on each end of the bar, not two plates total. It is stated twice on purpose --
 * as a column header and on the number itself -- because the header is read once
 * and the number is read on every change.
 */
export const GYM_LABELS = {
  title: "Ajustes del gimnasio",
  barLabel: "Barra",
  bars: {
    olympic: "Olímpica",
    standard: "Estándar",
    ez: "EZ",
    hex: "Hexagonal",
    custom: "Propia",
  } as Record<string, string>,
  customBarLabel: "Peso de tu barra (kg)",
  barWeightSummary: (kg: number): string => `Esta barra pesa ${kg} kg.`,
  unitLabel: "Unidades",
  platesLabel: "Discos disponibles",
  halfPlatesLabel: "Tengo discos de 1,25 y 0,5 kg",
  addPairAriaLabel: (size: number): string => `Añadir un par de discos de ${size} kg`,
  removePairAriaLabel: (size: number): string => `Quitar un par de discos de ${size} kg`,
  previewLabel: "Vista previa de la barra",
  previewSummary: (barKg: number, sizes: readonly number[]): string =>
    sizes.length === 0
      ? `Barra de ${barKg} kg sin discos.`
      : `Barra de ${barKg} kg con ${sizes.join(", ")} kg por lado.`,
  done: "Listo",
  /**
   * Header for the counter column.
   *
   * Deliberately long and lowercase, and deliberately *not* a caption above the
   * list: "pares por lado" only disambiguates the digits next to it, so it has to
   * be in the same row as those digits. A hint floating at the top of the section
   * is read once, by nobody, and forgotten by the time the eye reaches a `2`.
   */
  pairsColumnLabel: "pares por lado",
  /** Left column of the inventory table: the plate size. */
  plateColumnLabel: "disco",
  /**
   * Read once per counter, alongside the number, for the same reason.
   *
   * `2 pares` is a better standalone answer than `2` when the rows are scanned
   * vertically, and it costs nothing on a screen that already spends a column on
   * a 44px stepper.
   */
  pairsSuffix: (n: number): string => `${n} ${n === 1 ? "par" : "pares"}`,
  /** Tooltip on the gear. */
  triggerTitle: "Ajustes del gimnasio",
  /**
   * Accessible name of the gear, qualified by screen.
   *
   * "Ajustes del gimnasio" on its own is indistinguishable from the profile's own
   * settings if both are open at once, and the two panels are genuinely
   * different: this one is about the rack in front of the user, not about them.
   */
  triggerAriaLabel: (context: string): string => `Ajustes del gimnasio: ${context}`,
  defaultTriggerContext: "durante el entrenamiento",
} as const;

export const UNDO_LABELS = {
  removed: (n: number): string => `Serie ${n} eliminada`,
  undo: "Deshacer",
  undoAriaLabel: (n: number): string => `Deshacer la eliminación de la serie ${n}`,
  dismissAriaLabel: "Cerrar aviso de eliminación",
  /**
   * Announced when the window closes on its own, so a screen-reader user learns
   * that the undo they were reaching for is gone.
   */
  expired: (n: number): string => `La eliminación de la serie ${n} ya no se puede deshacer`,
} as const;


/** Shown by a route whose screen has not been built yet. */
export const COMING_SOON_LABEL = "Próximamente";

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