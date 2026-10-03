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

import type { CanonicalField, ImportSource } from "./import/types";

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

  // ---- score breakdown -------------------------------------------------
  /**
   * The two halves of the score, each carrying its own weight.
   *
   * The weight is part of the answer, not a detail: "Fuerza 68%" invites the
   * reader to think 68% of the score came from strength, which is not what the
   * engine computes. Showing `70% del puntaje` next to the percentage is the
   * difference between a breakdown the user can check and one they have to trust.
   */
  strength: "Fuerza",
  strengthWeight: "70% del puntaje",
  strengthHint: (sets: number, weeks: number): string =>
    `1RM estimado · ${sets} series · ${weeks} semanas`,
  volume: "Volumen y constancia",
  volumeWeight: "30% del puntaje",
  volumeHint: (sets: number, weeks: number): string => `${sets} series · ${weeks} semanas`,

  // ---- estimated 1RM ---------------------------------------------------
  oneRepMaxTitle: "Cómo se estima tu fuerza",
  /**
   * Names the formula, because the number is otherwise unverifiable.
   *
   * A user told "1RM 116.7 kg" has no way to know it came from a 100 kg set of
   * five and not from a 116 kg single. Showing the formula and the set it came
   * from turns an assertion into something they can re-derive.
   */
  oneRepMaxFormula: "Epley: 1RM = peso × (1 + repeticiones ÷ 30)",
  oneRepMaxFormulaHint: (weight: number, reps: number, estimate: number): string =>
    `${weight} kg × (1 + ${reps} ÷ 30) = ${estimate} kg`,
  oneRepMaxBestSet: (weight: number, reps: number): string =>
    `Tu mejor serie: ${weight} kg × ${reps}`,
  oneRepMaxNoSet: "Ninguna serie con carga suficiente para estimar un 1RM.",
  oneRepMaxSessions: (sessions: number, sets: number): string =>
    `${sessions} sesiones · ${sets} series que cuentan`,

  // ---- inactivity decay ------------------------------------------------
  /**
   * The decay indicator.
   *
   * A muscle that has not been trained in four months looks identical to a fresh
   * one unless the panel says otherwise, and the user has no other way to tell
   * that the number on screen is quietly shrinking. The multiplier is shown as a
   * percentage of what it would be with no layoff, because "0.62" on its own is
   * not a fact about anything.
   */
  decayTitle: "Inactividad",
  decayNone: "Al día: entrenaste este músculo hace poco.",
  decayLost: (percent: number): string =>
    `Tu volumen está al ${percent}% por no entrenar este músculo desde hace tiempo.`,
  decayDays: (days: number): string => `Última serie hace ${days} días`,
  decayNever: "Sin registro de ninguna serie.",

  // ---- next rank -------------------------------------------------------
  progressTitle: "Siguiente rango",
  pointsToNext: (points: number, rank: string): string =>
    `Te faltan ${points} ${points === 1 ? "punto" : "puntos"} para ${rank}.`,
  atTopRank: "Estás en el rango más alto. No queda nada por delante.",
  progressAria: (rank: string): string => `Progreso hacia ${rank}`,
  atMaxLabel: "Máximo",

  // ---- contributions ---------------------------------------------------
  contributionsTitle: "Ejercicios que más aportan",
  contributionCounted: "Contado",
  contributionNotCounted: "No contado",
  contributionPrimary: "principal",
  contributionSecondary: "secundario",
  contributionSets: (sets: number): string => `${sets} series`,
  browseExercises: (muscle: string): string => `Ver ejercicios para ${muscle}`,
  close: "Cerrar",
  historyLabel: "Historial de rangos",
  historyFirst: "Primer rango registrado. Aquí verás tu evolución.",
  historyEmpty: "Aún no hay historial de rangos.",
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
  /**
   * One sentence naming the rack, for surfaces that show it without the panel.
   *
   * Shares `previewSummary`'s wording so the profile page and the settings panel
   * cannot describe the same rack differently.
   */
  platesSummary: (sizes: readonly number[]): string =>
    sizes.length === 0
      ? "Sin discos configurados."
      : `Discos por lado: ${sizes.join(", ")} kg.`,
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
  /** The profile screen's gear, which names a different context on purpose. */
  profileTriggerContext: "en tu perfil",
} as const;

/**
 * Copy for the brand itself.
 *
 * The logo image already contains the mark, and the wordmark beside it says the
 * name, so the only string here is the accessible one. Kept separate from
 * `SHELL_LABELS` because it describes the brand rather than the chrome: it does
 * not change with the navigation or the session.
 */
export const BRAND_LABELS = {
  /**
   * The wordmark, not "logo de Cronos Gym".
   *
   * The lockup renders "CRONOS" next to the image, so a descriptive alt is read
   * aloud immediately after the name that is already on screen.
   */
  logoAlt: "Cronos",
  /** Names the brand block in the rail and the header. */
  regionAriaLabel: "Cronos",
} as const;

/**
 * Copy for the profile view.
 *
 * The experience-level and goal labels live here rather than in `Onboarding`
 * because both screens offer the same enum values, and a Spanish speaker
 * comparing the two should not find the same option spelled two ways.
 */
export const PROFILE_LABELS = {
  title: "Tu perfil",
  loading: "Cargando tu perfil…",
  notLoaded: "No hemos podido cargar tu perfil.",
  retry: "Reintentar",
  signOut: "Cerrar sesión",

  identityLabel: "Tus datos",
  nameLabel: "Nombre",
  namePlaceholder: "Cómo te llamamos",
  emailLabel: "Correo",
  notSet: "Sin definir",
  memberSince: "En Cronos desde",
  onSince: (iso: string): string => `En Cronos desde ${iso}`,

  bodyLabel: "Cuerpo",
  birthDateLabel: "Fecha de nacimiento",
  ageLabel: "Edad",
  ageYears: (n: number): string => `${n} años`,
  ageMinor: (n: number): string => `${n} años (menor de edad)`,
  sexLabel: "Sexo biológico",
  heightLabel: "Altura",
  weightLabel: "Peso",
  bodyMassIndex: "IMC",

  trainingLabel: "Entrenamiento",
  experienceLabel: "Nivel de experiencia",
  activityLabel: "Nivel de actividad",
  goalLabel: "Objetivo",
  energyLabel: "Energía diaria",
  energyBmr: "Metabolismo basal",
  energyTdee: "Gasto total",
  energyTarget: "Tu objetivo",
  energyProtein: "Proteína diaria",
  energyPerKg: (g: number): string => `${g} g de proteína (${g} g/kg)`,
  energyMaintenanceNote: "Sin datos corporales suficientes para calcularlo.",
  energyFloorNote: (floor: number): string =>
    `Ajustado al mínimo de ${floor} kcal: bajar más no es seguro.`,

  /** The gym-settings entry point on this screen, as opposed to the logger's. */
  gymSettingsLabel: "Tu gimnasio",
  gymSettingsHint:
    "Barra y discos disponibles. Lo que pongas aquí es lo que el paso de peso te va a ofrecer.",
  gymSettingsOpen: "Abrir ajustes del gimnasio",

  importLabel: "Tus datos de otros sitios",
  importHint:
    "Trae el historial de Hevy o Strong para no empezar de cero.",
  importOpen: "Importar desde Hevy o Strong",
} as const;

/** Experience levels, shared by onboarding and the profile. */
export const EXPERIENCE_LABELS: Record<"beginner" | "intermediate" | "advanced", string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

/** Goals, shared by onboarding and the profile. */
export const GOAL_LABELS: Record<
  "lose_weight" | "maintain" | "gain_muscle" | "strength" | "endurance",
  string
> = {
  lose_weight: "Perder peso",
  gain_muscle: "Ganar músculo",
  strength: "Ganar fuerza",
  maintain: "Mantener",
  endurance: "Resistencia",
};

/** Activity levels, shared by onboarding and the profile. */
export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentario",
  light: "Ligera",
  moderate: "Moderada",
  active: "Alta",
  athlete: "Atleta",
};

/** Biological sex, for the profile's read-only summary. */
export const SEX_LABELS: Record<string, string> = {
  male: "Hombre",
  female: "Mujer",
  other: "Otro",
};

/**
 * Copy for the import wizard.
 *
 * Every user-facing string for a four-step flow lives in one object, including
 * the error log, so the whole importer can be read in one place before it ships
 * -- and so a line added by the analysis has a home waiting for it.
 */
export const IMPORT_LABELS = {
  title: "Importar historial",
  open: "Importar desde Hevy o Strong",

  // ---- step 1: source --------------------------------------------------
  stepSource: "Fuente",
  stepPreview: "Vista previa",
  stepMapping: "Mapeo",
  stepConfirm: "Confirmación",
  step: (n: number, total: number, name: string): string => `Paso ${n} de ${total}: ${name}`,

  sourceTitle: "¿De dónde viene el archivo?",
  sourceHint:
    "Cada app exporta un CSV distinto. Elige la tuya y leeremos las columnas por ti; podrás revisarlas antes de importar nada.",
  sources: {
    hevy: "Hevy",
    strong: "Strong",
    generic: "Otro CSV",
  } as Record<ImportSource, string>,
  /** Column names for the mapping step, in `CANONICAL_FIELDS` order. */
  fields: {
    date: "Fecha de la sesión",
    title: "Nombre de la sesión",
    exercise: "Ejercicio",
    weight: "Peso",
    reps: "Repeticiones",
    rpe: "RPE",
    setNumber: "Número de serie",
    setType: "Tipo de serie",
    notes: "Notas",
  } as Record<CanonicalField, string>,
  sourceWeightUnit: "Los pesos del archivo están en",
  sourceAutoDetected: (name: string): string => `Hemos detectado un archivo de ${name}.`,
  sourceManual: "Cambiar",
  fileLabel: "Archivo CSV",
  fileHint:
    "Se lee en segundo plano: puedes elegir un archivo de varios megas sin que la app se congele.",
  fileChoose: "Elegir archivo",
  fileNoChosen: "Ningún archivo elegido",
  fileReading: "Leyendo…",
  fileRead: (name: string, bytes: string): string => `${name} · ${bytes}`,
  fileTooLarge: (limit: string): string => `El archivo supera los ${limit}.`,
  next: "Siguiente",
  back: "Atrás",
  cancel: "Cancelar",
  close: "Cerrar",

  // ---- step 2: preview -------------------------------------------------
  previewTitle: "Esto es lo que hemos leído",
  previewEmpty: "El archivo no tiene filas de datos.",
  previewShowing: (shown: number, total: number): string =>
    shown === total ? `${total} filas` : `Primeras ${shown} de ${total} filas`,
  previewRows: (n: number): string => `${n} filas`,
  previewColumns: (n: number): string => `${n} columnas`,
  previewColumnHeader: "Columna",
  previewMeaningHeader: "Qué es",
  previewUnmapped: "Sin usar",
  previewDuplicated: (name: string): string => `«${name}» está mapeada dos veces`,
  previewTruncated: "Mostramos solo las primeras filas. El resto se analizan igual.",

  // ---- step 3: mapping -------------------------------------------------
  mappingTitle: "Confirma qué es cada columna",
  mappingHint:
    "Detectamos la origen por ti, pero conviene revisarlo: si un peso acaba siendo repeticiones, los datos entran equivocados y no hay forma de saberlo después.",
  mappingField: (name: string): string => name,
  mappingRequired: "Obligatorio",
  mappingOptional: "Opcional",
  mappingNotInFile: "Elige una columna",
  mappingComplete: "Listo para importar.",
  mappingIncomplete: "Falta mapear: {fields}.",
  mappingExerciseToMuscle: "Músculo principal",
  mappingExerciseToMuscleHint:
    "Asignamos cada ejercicio a un músculo para que los rangos y el mapa muscular tengan algo que leer. Los que no reconoces se quedan sin asignar.",
  mappingUnmappedExercise: (name: string): string => `${name}: sin músculo asignado`,
  mappingMappedExercise: (name: string, muscle: string): string => `${name}: ${muscle}`,
  mappingSelectMuscle: "Elegir músculo",
  /** Progress on the muscle step, so a long list is not read as a stall. */
  mappingResolvedCount: (resolved: number, total: number): string =>
    resolved === total
      ? `${total} ejercicios con músculo asignado`
      : `${resolved} de ${total} ejercicios con músculo asignado`,
  mappingUnresolvedCount: (n: number): string =>
    n === 1 ? "1 ejercicio sin asignar" : `${n} ejercicios sin asignar`,
  mappingAssigned: (muscle: string): string => muscle,
  mappingUnassigned: "Sin músculo",
  mappingEditing: (name: string): string => `Músculo de ${name}`,

  // ---- step 4: confirm -------------------------------------------------
  confirmTitle: "Revisa antes de importar",
  confirmStats: {
    sessions: (n: number): string => `${n} sesiones`,
    sets: (n: number): string => `${n} series`,
    exercises: (n: number): string => `${n} ejercicios distintos`,
    skipped: (n: number): string => `${n} filas descartadas`,
  },
  confirmDuplicates: (n: number): string =>
    n === 1 ? "1 sesión ya estaba importada" : `${n} sesiones ya estaban importadas`,
  confirmStart: "Importar",
  confirmWorking: "Importando…",
  confirmDone: (sessions: number, sets: number): string =>
    `Importadas ${sessions} sesiones y ${sets} series.`,
  confirmFailed: "La importación ha fallado.",

  // ---- error log -------------------------------------------------------
  issuesTitle: "Registro de errores",
  issuesEmpty: "Ninguna fila descartada.",
  issuesCount: (n: number): string => (n === 1 ? "1 aviso" : `${n} avisos`),
  issueLine: (n: number): string => `Línea ${n}`,
  issueFileWide: "Todo el archivo",
  issueDismiss: "Ocultar registro",
  issueShow: (n: number): string => `Ver ${n} avisos`,
  issueDownload: "Descargar el log",
  issueCode: (code: string): string => code,

  // ---- duplicates ------------------------------------------------------
  duplicatesTitle: "Sesiones repetidas",
  duplicatesHint:
    "Hemos encontrado sesiones que ya tienes. Si las importas se duplicarán en tu historial.",
  duplicatesImportAnyway: "Importar igualmente",
  duplicatesSkip: "Omitir las repetidas",

  // ---- undo ------------------------------------------------------------
  undoTitle: "Importación deshecha",
  undoSummary: (sessions: number, sets: number): string =>
    `Se han borrado ${sessions} sesiones y ${sets} series de la importación anterior.`,
  undoUnavailable:
    "No hemos podido deshacer la importación: comprueba tu conexión y vuelve a intentarlo.",
  undo: "Deshacer importación",
  undoDone: "Importación deshecha",
  undoFailed: "No se ha podido deshacer",

  defaultSessionTitle: "Sesión importada",
  workerFailed: "No hemos podido leer el archivo en segundo plano.",
  workerFallingBack:
    "Este navegador no admite el procesamiento en segundo plano; leeremos el archivo en la pantalla principal.",
  cancelled: "Importación cancelada",

  /** Every rejection, keyed by the code the analysis emits. */
  issue: {
    noHeader: "El archivo no tiene cabecera. Puede que no sea un CSV.",
    blankHeader:
      "Alguna columna no tiene nombre. Si los valores se ven desplazados, el separador del archivo probablemente no son comas.",
    raggedRow: "La fila no tiene el mismo número de columnas que la cabecera.",
    raggedDetail: (got: string, want: string): string => `${got} columnas, se esperaban ${want}`,
    missingDate: "Falta la fecha de la sesión, así que no sabemos cuándo fue.",
    unparseableDate: "No hemos entendido la fecha.",
    missingExercise: "Falta el nombre del ejercicio.",
    unparseableWeight: "No hemos entendido el peso; la serie se importa sin peso.",
    unparseableReps: "No hemos entendido las repeticiones; la serie se importa sin repeticiones.",
    unparseableRpe: "RPE fuera de 1-10; se importa la serie sin RPE.",
    noSets: "La sesión no tenía ninguna serie importable, así que no se ha creado.",
    duplicateSession: "Esta sesión ya estaba en tu historial y no se ha vuelto a importar.",
    duplicateSet: "Filas repetidas dentro del archivo, contadas una sola vez.",
    noExercisesMapped: "No hemos encontrado ninguna serie importable.",
    exerciseNotMapped: "No has elegido qué columna es el ejercicio, así que no hay nada que importar.",
  },
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

export const COACH_LABELS = {
  title: "Coach",
  subtitle: "Tu contexto de entrenamiento, tus notas y lo que conviene ajustar.",

  // ---- training context ------------------------------------------------
  contextTitle: "Contexto de entrenamiento",
  contextSubtitle: "Lo que sabemos de tu entrenamiento ahora mismo.",
  loading: "Reuniendo tu contexto…",
  goal: "Objetivo",
  experience: "Experiencia",
  bodyweight: "Peso corporal",
  bodyweightChange: (delta: number): string =>
    `${delta > 0 ? "+" : ""}${delta} kg en 30 días`,
  noBodyweight: "Sin peso registrado",
  volumeTitle: "Volumen y frecuencia",
  workouts: (count: number): string => `${count} entrenamientos`,
  thisMonth: (count: number): string => `${count} este mes`,
  monthlyVolume: (kg: number): string => `${Math.round(kg).toLocaleString("es")} kg al mes`,
  noWorkouts: "Todavía no has registrado entrenamientos.",
  nutritionTitle: "Nutrición",
  calories: (kcal: number): string => `${Math.round(kcal)} kcal`,
  protein: (grams: number): string => `${Math.round(grams)} g de proteína`,

  // ---- ranks -----------------------------------------------------------
  ranksTitle: "Tus rangos",
  ranksSubtitle: "El detalle por músculo está en Rangos.",
  openRanks: "Ver todos los rangos",
  noClassifiedMuscles: "Ningún músculo clasificado todavía.",
  unrankedMuscles: (count: number): string =>
    `${count} ${count === 1 ? "músculo sin" : "músculos sin"} rango`,

  // ---- data gaps -------------------------------------------------------
  /**
   * A missing input, named with the thing to do about it.
   *
   * Each one states the consequence and the fix, because "faltan datos" leaves the
   * reader with nothing to act on and reads as a bug rather than a step.
   */
  gapsTitle: "Lo que todavía no sabemos",
  gaps: {
    no_profile: "No hay perfil: no sabemos tu objetivo ni tu nivel.",
    no_bodyweight:
      "Sin peso corporal no podemos comparar tu fuerza con los estándares. Añádelo en tu perfil.",
    no_profile_energy:
      "Sin peso, altura y fecha de nacimiento no podemos calcular calorías ni proteína.",
    no_workouts: "Sin entrenamientos registrados no hay volumen ni frecuencia que analizar.",
    no_classified_muscles:
      "Ningún músculo tiene todavía las 3 sesiones necesarias para recibir un rango.",
    no_readiness_checkins:
      "No registramos cómo te sientes (sueño, dolor, energía). Es la información que más necesita un coach, y todavía no hay forma de introducirla.",
  } as Record<string, string>,

  // ---- notes -----------------------------------------------------------
  notesTitle: "Notas del Coach",
  notesSubtitle: "Tu registro. Lo escribes tú; el Coach todavía no.",
  notesEmpty: "Sin notas todavía. Apunta lo que quieras recordar de tu entrenamiento.",
  notesPlaceholder: "Escribe una nota…",
  notesSave: "Guardar nota",
  notesSaved: "Nota guardada",
  notesAuthorUser: "Tu nota",
  notesAuthorCoach: "Nota del Coach",
  notesDelete: (createdAt: string): string => `Eliminar nota del ${createdAt}`,
  notesCount: (count: number): string => `${count} ${count === 1 ? "nota" : "notas"}`,

  // ---- recommendations -------------------------------------------------
  recommendationsTitle: "Recomendaciones",
  recommendationsSubtitle: "Ajustes que se desprenden de tus datos, no de la semana que acabas de entrenar.",
  recommendationsEmpty:
    "Sin recomendaciones todavía. Aparecerán cuando el Coach tenga suficientes datos.",
  recommendationDismiss: "Descartar",
  recommendationAreas: {
    volume: "Volumen",
    frequency: "Frecuencia",
    deload: "Descarga",
    technique: "Técnica",
  } as Record<string, string>,

  // ---- chat ------------------------------------------------------------
  /**
   * The assistant's transcript.
   *
   * "Hoy" rather than a date, because the store is keyed by day and there is exactly
   * one conversation per day. Naming the day would imply a history the screen does
   * not have.
   */
  chatTitle: "Habla con tu Coach",
  chatSubtitle:
    "Pregunta sobre tu entrenamiento. Solo verá los datos que ya tienes registrados aquí.",
  chatEmpty: "Haz una pregunta para empezar.",
  chatPlaceholder: "¿Cómo debería entrenar esta semana?",
  chatSend: "Enviar",
  chatSending: "Pensando…",
  chatDisclaimer:
    "El Coach es una herramienta de orientación, no un profesional médico. Si algo duele, habla con un profesional.",
  chatNewDay: "Empieza una conversación nueva",
  chatClear: "Borrar la conversación de hoy",
  chatClearConfirm: "¿Borrar la conversación de hoy? No se puede deshacer.",
  chatStop: "Detener",
  chatRetry: "Reintentar",
  chatNotSaved: "Esta conversación no se está guardando en este dispositivo.",
  /**
   * Opens the app's sign-in modal.
   *
   * Not a link to `/login`: this app has no such route. Sign-in happens in `AuthModal`
   * (email and password), so this label opens that.
   */
  chatSignInAgain: "Volver a entrar",

  /** One classified failure, per `CoachError` code. */
  chatErrors: {
    RATE_LIMITED: "Has preguntado demasiado rápido. Espera un momento.",
    NETWORK_ERROR: "No se pudo conectar. Revisa tu conexión.",
    AUTH_ERROR: "Tu sesión ha caducado. Vuelve a entrar.",
    INPUT_TOO_LONG: "Tu pregunta es demasiado larga.",
    SERVICE_UNAVAILABLE: "El Coach no está disponible ahora mismo.",
  } as Record<string, string>,

  /** A structured recommendation, by `CoachAction["type"]`. */
  chatActions: {
    exercise_swap: "Cambio de ejercicio",
    training_adjustment: "Ajuste de entrenamiento",
    calorie_adjustment: "Ajuste calórico",
    deload_suggestion: "Descarga",
  } as Record<string, string>,

  // ---- error -----------------------------------------------------------
  errorTitle: "No se pudo reunir tu contexto",
  retry: "Reintentar",
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