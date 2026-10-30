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

/**
 * The muscle groups the coverage card names.
 *
 * These are the slugs the muscle map counts sets by (`countMuscleSets`), not
 * the catalog's `body_part`/`target` strings: they are a vocabulary of their
 * own, and the coverage card was showing them raw -- "upper-back",
 * "lower-back" -- in the middle of a Spanish screen.
 *
 * The names are the neutral ones an athlete would use: "Lumbares" and not
 * "Zona lumbar", "Espalda Alta" and not "Espalda alta", because the card lists
 * groups in a column and the capital reads as the start of a name.
 */
export const MUSCLE_LABELS_ES: Record<string, string> = {
  chest: "Pecho",
  deltoids: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearm: "Antebrazos",
  "upper-back": "Espalda Alta",
  trapezius: "Trapecios",
  "lower-back": "Lumbares",
  abs: "Abdominales",
  obliques: "Oblicuos",
  gluteal: "Glúteos",
  quadriceps: "Cuádriceps",
  hamstring: "Isquiotibiales",
  adductors: "Aductores",
  calves: "Pantorrillas",
  neck: "Cuello",
  knees: "Rodillas",
  ankles: "Tobillos",
  tibialis: "Tibial Anterior",
  feet: "Pies",
  hands: "Manos",
  head: "Cabeza",
  hair: "Cabello",
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
  noRankFilterMatch: "No hay músculos con este rango. Prueba otro filtro.",
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

  // ---- anatomical ranks premium (AnatomicalRanksPage) ----------------------
  bodyMapLegend: "Rango por músculo",
  pendingMuscles: (count: number): string => `${count} músculos sin clasificar todavía`,
  dataQuality: "Calidad de los datos",
  dataQualityAvailable: "Evaluación disponible",
  dataQualityPartial: "Datos parciales",
  dataQualityNone: "Sin información suficiente",
  sortBy: "Ordenar por",
  sortScoreDesc: "Puntaje (mayor primero)",
  sortScoreAsc: "Puntaje (menor primero)",
  sortName: "Nombre",
  sortSessions: "Sesiones",
  sortLastActivity: "Última actividad",
  sortChange: "Cambio de rango",
  filterByRank: "Filtrar por rango",
  filterAll: "Todos",
  searchPlaceholder: "Buscar músculo...",
  clearFilters: "Limpiar filtros",
  noResults: "No se encontraron músculos",
  noResultsHint: "Intenta ajustar los filtros o la búsqueda",
  coverage: "Cobertura",
  metricsUpdate: (date: string): string => `Actualizado ${date}`,
  sessionsLabel: "Sesiones",
  lastActivity: "Última actividad",
  trendUp: "Mejora",
  trendDown: "Declive",
  trendFlat: "Estable",
  newMuscle: "Nuevo",
  deltaPoints: (points: number): string => `${points} pts`,
  viewRange: "Rango",
  viewScore: "Puntuación",
  viewVolume: "Volumen",
  viewCoverage: "Cobertura",
  qualityLow: "Datos limitados",
  qualityMedium: "Confianza media",
  qualityHigh: "Confianza alta",
  confidenceLabel: (level: string): string => {
    const labels = { low: "Datos limitados", medium: "Confianza media", high: "Confianza alta" } as const;
    return labels[level as "low" | "medium" | "high"] ?? level;
  },
  strongestHint: "Tu músculo con más margen de mejora.",
  weakestHint: "Tu músculo más fuerte.",
  rankDistribution: (rank: string, count: number): string => `${count} en ${rank}`,
  improvedMuscles: (count: number): string =>
    `${count} músculo${count === 1 ? "" : "s"} mejoraron su rango`,
  promotionCount: (count: number): string =>
    `${count} ${count === 1 ? "músculo subió de rango" : "músculos subieron de rango"}`,

   // ---- anatomical map modes ----------------------------------------------
  setMapMode: "Cambiar vista del mapa",
  mapModeRank: "Rango atómico",
  mapModeHeatmap: "Volumen semanal",
  heatmapMaintenance: "Mantenimiento",
  heatmapOptimal: "Hipertrofia óptima",
  heatmapFatigue: "Límite de fatiga",
  heatmapInactive: "Inactivo",
  heatmapSets: (n: number): string => `${n} series esta semana`,
  heatmapOptimalHint: "Volumen óptimo · Haz clic para ver el PR",
  heatmapFatigueHint: "Demasiado volumen · Reduce el estímulo",
  heatmapInactiveHint: "Sin entrenar recientemente",

  // ---- symmetry radar ----------------------------------------------------
  symmetryTitle: "Simetría de fuerza",
  symmetryCollapse: "Colapsar simetría",
  symmetryExpand: "Ver simetría corporal",
  symmetryBalance: "Balance",
  symmetryImbalance: (block: string, rank: string, comparedTo: string, compRank: string): string =>
    `Atención: ${block} en ${rank} vs. ${comparedTo} en ${compRank}`,
  symmetryBlockChest: "Pecho",
  symmetryBlockBack: "Espalda",
  symmetryBlockShoulders: "Hombros",
  symmetryBlockArms: "Brazos",
  symmetryBlockLegs: "Piernas",
  symmetryBlockCore: "Core",

  // ---- muscle drawer -----------------------------------------------------
  prTitle: "Récord personal",
  prExercise: (name: string, estimate: string): string => `${name} · 1RM ${estimate}`,
   nearlyThere: "A un solo entrenamiento del siguiente rango.",
   fatigueTitle: "Fatiga y carga",
  fatigueOptimal: "Volumen óptimo",
  fatigueLow: "Sesiones insuficientes",
  fatigueRecovery: "En recuperación",
  fatigueOverload: "Sobrecarga",
  fatigueSets: (n: number): string => `${n} series efectivas esta semana`,
  fatigueDays: (days: number): string => `${days} días sin entrenar`,
  fatigueDecay: (percent: number): string => `Volumen al ${percent}% (inactividad)`,
  ascentTitle: "Proyección de ascenso",
  ascentPoints: (points: number): string => `Te faltan ${points} puntos para el siguiente rango`,
  ascentNext: "Siguiente:",
  recommendedTitle: "Ejercicios clave recomendados",
  recommendedCount: (n: number): string => `Top ${n} ejercicios que más aportan`,
  viewMuscleExercises: "Ver todos mis ejercicios",
} as const;

/**
 * UI copy for the app shell: the bottom navigation and the active-session pill.
 *
 * Two labels per destination, not one. The visible text is shortened to fit under
 * an icon, and the accessible name has to survive being read aloud in a list
 * where five items all start with the same verb -- so the icon's label is a full
 * instruction and the visible one is a noun.
 */
export const NAV_LABELS = {
  home: "Inicio",
  routines: "Rutinas",
  train: "Entrenar",
  profile: "Perfil",
  more: "Más",
  moreOptions: "Más opciones",
  ranges: "Rangos",
  progress: "Progreso",
  settings: "Ajustes",
  close: "Cerrar",
  continueTraining: "Continuar entrenamiento",
} as const;

export const SHELL_LABELS = {
  navAriaLabel: "Navegación principal",
  sidebarAriaLabel: "Navegación lateral",
  sidebarPlaceholder: "Barra lateral",
  /** Collapsed to icons only. */
  sidebarCollapse: "Contraer la barra lateral",
  sidebarExpand: "Expandir la barra lateral",
  /** Names a destination, both as a visible label and as an accessible name. */
  destinations: {
    home: { label: "Inicio", aria: "Ir al inicio" },
    // "Rutinas", not "Biblioteca". The library is where routines are built and
    // started; the noun an athlete uses for it is the routine, and the two labels
    // the header and the bar used to disagree about is exactly the drift this
    // unification exists to end.
    library: { label: "Rutinas", aria: "Ir a tus rutinas" },
    train: { label: "Entrenar", aria: "Ir a entrenar" },
    profile: { label: "Perfil", aria: "Ir a tu perfil" },
    // Rail-only. These are places an athlete arrives *from* a muscle on the map or a
    // number on the dashboard, never by aiming at the bottom of a phone.
    ranks: { label: "Rangos", aria: "Ir a tus rangos" },
    progress: { label: "Progreso", aria: "Ir a tu progreso" },
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
  bodyweightLabel: "Corporal",
  bodyweightAddKg: "+kg",
  setBadgeAriaLabel: (kindLabel: string, n: number): string =>
    `Serie ${n}, tipo ${kindLabel}`,
} as const;

/**
 * Copy for the exercise picker modal (`ExerciseSelectorModal`).
 *
 * Los textos del buscador, el modo multi-selección y la sección de ejercicios
 * frecuentes viven aquí para que todo el vocabulario del selector esté en un
 * solo lugar y sea traducible.
 */
export const PICKER_LABELS = {
  title: "Seleccionar ejercicio",
  searchPlaceholder: "Buscar ejercicio…",
  onlyCronos: "Solo Cronos Gym",
  frequentTitle: "Frecuentes",
  multiSelect: "Multi-selección",
  multiSelectAriaLabel: (active: boolean): string =>
    active
      ? "Desactivar la multi-selección"
      : "Activar la multi-selección",
  addSelected: (n: number): string =>
    `Agregar ${n} ejercicio${n !== 1 ? "s" : ""}`,
  close: "Cerrar",
  loading: "Cargando…",
  retry: "Reintentar",
  noResults: "No se encontró ningún ejercicio con esos filtros.",
  loadMore: "Desplázate para cargar más ejercicios…",
} as const;

/**
 * Copy for the rest timer.
 *
 * Every control has a spoken label as well as a visible one,
 * because the timer is the screen a blind athlete uses with
 * the phone in their pocket: the countdown is announced as it
 * changes, and each adjustment says what it does.
 */
export const REST_TIMER_LABELS = {
  title: "Tiempo de descanso",
  /** The clock face, spoken: "Quedan 42 segundos". */
  remainingAriaLabel: (seconds: number): string =>
    seconds === 1 ? "Queda 1 segundo" : `Quedan ${seconds} segundos`,
  closeAriaLabel: "Cerrar el temporizador de descanso",
  minimizeAriaLabel: "Minimizar el temporizador",
  expandAriaLabel: "Ver el temporizador de descanso",
  pauseAriaLabel: "Pausar el descanso",
  resumeAriaLabel: "Reanudar el descanso",
  pauseLabel: "Pausar",
  resumeLabel: "Reanudar",
  /** The shared step of the two adjustment controls, e.g. "15 s". */
  stepLabel: "15 s",
  subtractAriaLabel: "Quitar 15 segundos al descanso",
  addAriaLabel: "Añadir 15 segundos al descanso",
  skipLabel: "Saltar",
} as const;

/**
 * Copy for the fatigue verdict.
 *
 * The badge names the shortfall in reps, because "tired" is not
 * a fact and "two reps short" is. The summary counts only the
 * sets that showed fatigue, so its sentence is a claim about
 * the session rather than about the table.
 */
export const FATIGUE_LABELS = {
  /** The chip on a fatigued set: "−2 reps". */
  shortfallText: (shortfall: number): string => `−${shortfall} reps`,
  badgeAriaLabel: (level: "mild" | "high", shortfall: number): string =>
    level === "high"
      ? `Fatiga alta: ${shortfall} repeticiones menos de lo planeado`
      : `Fatiga: ${shortfall} repeticiones menos de lo planeado`,
  /** The exercise-level summary: "2 de 4 series con fatiga". */
  summary: (fatigued: number, total: number): string =>
    `${fatigued} de ${total} series con fatiga`,
  summaryAriaLabel: (fatigued: number, total: number): string =>
    `${fatigued} de ${total} series quedaron por debajo de lo planeado`,
  restMoreLabel: "Probar 30 s más",
  restMoreAriaLabel: (seconds: number): string =>
    `Descansar ${seconds} segundos más en este ejercicio`,
  dismissAriaLabel: "Descartar el aviso de fatiga",
} as const;

/**
 * Copy for the superset badges.
 *
 * The visible chip says three things at once -- which group, which exercise of
 * it, and how many there are -- because the athlete reads it mid-set and has
 * one glance to spend. The spoken label says the same thing in words, since the
 * bullet between them is punctuation a screen reader has to guess at.
 */
export const SUPERSET_LABELS = {
  /** The chip under the bubble: "SUPERSET A • 1/2". */
  badgeText: (label: string, position: number, total: number): string =>
    `SUPERSET ${label} • ${position}/${total}`,
  /** The same, read out: "Superset A: ejercicio 1 de 2". */
  badgeAriaLabel: (label: string, position: number, total: number): string =>
    `Superset ${label}: ejercicio ${position} de ${total}`,
  /** What the bubble's accessible name adds when the exercise is in a group. */
  tabAriaLabel: (label: string, position: number, total: number): string =>
    `superset ${label}, ${position} de ${total}`,
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
 * Copy for the sign-in modal and the post-login role selector.
 *
 * Kept separate from `SHELL_LABELS` because these strings only appear when the
 * athlete is not yet in the app, and separate from `PROFILE_LABELS` because
 * the role selector is a *choice between identities* rather than a description
 * of one. Un solo vocabulario: "Atleta", "Coach" and "Administrador" are the
 * same words `ROLE_LABELS` uses, and reusing them here is the point.
 */
export const AUTH_LABELS = {
  title: "Bienvenido a Cronos",
  subtitle: "Entrena, progresa y supera tus l\u00edmites.",
  google: "Continuar con Google",
  emailToggle: "Iniciar con correo electr\u00f3nico",
  emailPlaceholder: "tu@correo.com",
  passwordPlaceholder: "........",
  namePlaceholder: "Tu nombre",
  login: "Iniciar Sesi\u00f3n",
  signup: "Registrar Cuenta",
  loginHint: "\u00bfNo tienes cuenta? Crear una",
  signupHint: "\u00bfYa tienes cuenta? Iniciar sesi\u00f3n",
  guest: "Explorar como invitado",
  logout: "Bellir",
  loading: "Cargando...",
  errorPrefix: "Error inesperado",
  accountCreated: "Cuenta creada. Inicia sesi\u00f3n.",
  /** Greeting line in the role selector: the name comes from the profile. */
  roleSelectorTitle: (name: string): string => `Hola, ${name}`,
  roleSelectorSubtitle: "\u00bfC\u00f3mo quieres acceder hoy?",
  /** aria-label for the close button. */
  close: "Bellir",
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
  quickActionsTitle: "Acceso rápido",
  loading: "Cargando tu perfil…",
  notLoaded: "No hemos podido cargar tu perfil.",
  retry: "Reintentar",
  signOut: "Cerrar sesión",

  /** Hero header badges */
  badgeAthlete: "Atleta",
  badgePro: "CRONOS PRO",
  badgeIntermediate: "Intermedio",
  badgeBeginner: "Principiante",
  badgeAdvanced: "Avanzado",
  badgeDeveloper: "Desarrollador",
  badgeCoach: "Coach",

  /**
   * The three-tab command center that ProfilePage renders.
   *
   * Each tab is a pair of `label` / `aria`: the label is what is drawn on the
   * tab button, the `aria` names the destination for a screen reader so a tab
   * called "Preferencias" and a heading called "Preferencias" are not the same
   * word twice in a row in the reading order.
   */
  tabsAriaLabel: "Pestañas del perfil",
  tabs: {
    biometric: { label: "Biometría y metas", aria: "Ver biometría y metas" },
    gym: { label: "Mi gimnasio", aria: "Ver mi gimnasio" },
    preferences: { label: "Preferencias y sistema", aria: "Ver preferencias y sistema" },
  } as Record<string, { label: string; aria: string }>,

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

  energyCarbs: "Carbohidratos",
  energyFats: "Grasas",
  energyMacroSummary: (target: number, protein: number, carbs: number, fats: number): string =>
    `${target} kcal · ${protein}g Prot · ${carbs}g Carb · ${fats}g Grasas`,
  energyHudBmr: "Metabolismo basal",
  energyHudTdee: "Gasto energético total",
  energyHudBmi: "Índice de masa corporal",
  bmiBandNormal: "Normal",
  bmiBandUnderweight: "Delgada",
  bmiBandOverweight: "Sobrepeso",
  bmiBandObese: "Obesidad",

  /**
   * The weight-history strip on the biometría tab of ProfilePage.
   *
   * Shown only when the user has at least one weigh-in; the empty label is
   * what the athlete sees when they have not logged weight yet, so it has to
   * name the reason rather than just saying "vacío".
   */
  weightTrendTitle: "Tu evolución de peso",
  weightTrendEmpty: "Aún no has registrado ningún peso.",

  /** The gym-settings entry point on this screen, as opposed to the logger's. */
  gymSettingsLabel: "Tu gimnasio",
  gymSettingsHint:
    "Barra y discos disponibles. Lo que pongas aquí es lo que el paso de peso te va a ofrecer.",
  gymSettingsOpen: "Abrir ajustes del gimnasio",

  importLabel: "Tus datos de otros sitios",
  importHint:
    "Trae el historial de Hevy o Strong para no empezar de cero.",
  importOpen: "Importar desde Hevy o Strong",

  /**
   * The premium-services card.
   *
   * The coach left the thumb bar and arrived here, which is where a pitch belongs: the
   * destination is a person deciding whether this is worth paying for, not a tab they
   * open mid-set. The card lists what the workspace actually contains rather than
   * promising a subscription -- three concrete things an athlete can look for in the
   * screen they are about to enter.
   */
  premiumLabel: "Servicios premium",
  premiumCoachName: "Coach con IA",
  premiumCoachHint:
    "Lee tu entrenamiento y tu contexto, y te dice qué conviene cambiar.",
  premiumFeatures: [
    "Tu contexto de entrenamiento, al día",
    "Chat con el coach sobre tus datos",
    "Notas y recomendaciones pendientes",
  ] as const,
  premiumOpen: "Abrir el coach",

  /**
   * The developer surface, reached from this screen.
   *
   * Behind `DeveloperGate` because it is the one panel here that can touch
   * device-local state and the role itself. A gate that renders nothing while
   * loading is the only honest way to show it: an athlete seeing a developer
   * panel for one frame is a leak, and the frame is invisible in review.
   */
  devLabel: "Modo desarrollador",
  devHint: "Herramientas para depurar esta cuenta: cambiar rol, ver flags y resetar estado local.",
  devOpen: "Abrir panel de desarrollador",

  /**
   * The God Mode panel itself.
   *
   * Everything here is developer tooling, so the copy is short and specific:
   * it names what each control does rather than what it is, because a
   * developer reading their own debug screen does not need "toggle" -- they
   * need "la IA ya no contesta".
   */
  godTitle: "Cueva de Batman",
  godSubtitle: "Estado de esta cuenta y de este dispositivo.",
  godMetricActive: " Usuarios activos",
  godMetricTokens: "Tokens consumidos",
  godMetricHint: "Sin conectar",
  godMetricValue: "—",
  godFlagsTitle: "Features",
  godFlagsHint: "Cambios locales. No afectan a otros dispositivos.",
  godFlagMaintenance: "Mantenimiento",
  godFlagMaintenanceHint: "Banner en toda la app.",
  godFlagAi: "IA habilitada",
  godFlagAiHint: "Coach responde; apagado, dice que no está disponible.",
  godFlagPreamble: "Mostrar preámbulo de IA",
  godFlagPreambleHint: "Debug: texto que se envía a OpenRouter.",
  godFlagVerbose: "Modo verbose",
  godFlagVerboseHint: "Logs del módulo coach.",
  godRoleTitle: "Rol local",
  godRoleHint: "Cambia cómo se ve esta cuenta. No es seguridad: la protección real es el servidor.",
  godRoleConfirm: "¿Confirmar cambio de rol?",
  godRoleWarning: "Al salir de `developer` pierdes el acceso a esta sección.",
  godRoleCancel: " Cancelar",
  godRoleApply: "Confirmar",
  godResetTitle: "Restablecer estado local",
  godResetHint: "Borra rol, flags, contexto y consentimiento. El perfil central (peso, altura, objetivo) no se toca.",
  godResetButton: "Borrar estado local",
  godResetConfirm: "¿Borrar el estado local de esta cuenta?",
   godResetDone: "Estado local restablecido.",

  /** Export for the preferencias tab of ProfilePage. */
  exportTitle: "Exportar tus datos",
  exportHint:
    "Descarga tu perfil y tu contexto local como JSON para guardarlos o importarlos después.",
  exportButton: "Exportar datos",

  godVersionTitle: "Versiones",
  godVersionApp: "App",
  godVersionDb: "Base local",
  godVersionSchema: "Esquema",

  /**
   * The athlete-context form, reached from this screen.
   *
   * This is the one place the athlete tells the app what they are training
   * towards and how their body is doing, and it is the data the coach reads.
   * The labels are short and specific: the form is filled once, not browsed.
   */
  contextTitle: "Tu contexto",
  contextSubtitle: "Lo que el coach IA lee antes de responder.",
  contextLoading: "Cargando tu contexto…",
  contextEmpty: "Aún no has guardado contexto. Rellena lo que quieras.",
  contextError: "No se pudo guardar tu contexto. Reintenta más tarde.",
  contextSaved: "Guardado",
  contextGoal: "Objetivo",
  contextGoalHint: "Toque el seleccionado lo deselecciona.",
  contextWeight: "Peso",
  contextWeightUnit: "kg",
  contextWeightLb: "lb",
  contextHeight: "Altura",
  contextHeightUnit: "cm",
  contextHeightFtIn: "ft in",
  contextWeightRange: (min: number, max: number): string =>
    `Entre ${min} y ${max} kg`,
  contextHeightRange: (min: number, max: number): string =>
    `Entre ${min} y ${max} cm`,
  contextWeightInvalid: "Peso: introduce un número válido.",
  contextHeightInvalid: "Altura: introduce un número válido.",
  contextExperience: "Nivel",
  contextDays: "Días por semana",
  contextDaysHint: "1 a 7",
  contextEquipment: "Equipo disponible",
  contextEquipmentStatic: "Equipo de tu gimnasio (fijo)",
  contextInjury: "Molestia actual",
  contextInjuryHint: "Opcional. Máximo 200 caracteres.",
  contextInjuryChars: (n: number): string => `${n}/200`,
  contextInjuryQuick: [
    "Hombro",
    "Rodilla",
    "Espalda baja",
    "Codo",
    "Muñeca",
  ] as const,
  contextClear: "Borrar mi contexto",
  contextClearConfirm: "¿Borrar solo el contexto (días, lesiones)? El perfil central no se toca.",
  contextClearDone: "Contexto borrado.",
  contextConsent: "Compartir mi contexto con el coach IA",
  contextConsentHint:
    "Se envía objetivo, biometría, nivel, frecuencia, equipo y molestias a OpenRouter. " +
    "Nunca se envía tu nombre, correo ni identificador. En producción pediremos tu consentimiento explícito.",
  contextConsentProdNote: "Producción: apagado por defecto; se pedirá consentimiento explícito.",
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
 * Copy for role management and role badges.
 *
 * Un solo vocabulario para los roles de cuenta: el rol se muestra en el perfil,
 * en los chips de la tabla de gestión y en el simulador de vista del desarrollador.
 */
export const ROLE_LABELS = {
  title: "Gestión de roles",
  subtitle: "Asciende o degrada a cualquier usuario registrado por su correo.",
  emailLabel: "Correo del usuario",
  emailPlaceholder: "usuario@ejemplo.com",
  roleLabel: "Nuevo rol",
  athlete: "Atleta",
  coach: "Coach",
  admin: "Administrador",
  developer: "Desarrollador",
  grant: "Asignar rol",
  granting: "Asignando…",
  success: "Rol asignado",
  successMsg: (role: string): string => `Rol actualizado a ${role}.`,
  error: "Error al asignar el rol",
  listTitle: "Coaches y administradores actuales",
  listEmpty: "No hay coaches ni administradores registrados.",
  userId: "Usuario",
  roleCol: "Rol",
  grantedAt: "Concedido",
  edit: "Editar",
  save: "Guardar",
  cancel: "Cancelar",
  previewTitle: "Simulador de vista",
  previewHint: "Solo afecta esta sesión local; no cambia la base de datos.",
  previewAs: "Ver como",
} as const;

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

/**
 * UI copy for the exercise hub — the screen at `/ejercicio/:exerciseId`.
 *
 * Grouped by tab rather than by component, because the three tabs share vocabulary
 * ("sesión", "peso", "repeticiones") and a translator reviewing the hub should see that
 * shared vocabulary once rather than three times.
 */
export const HUB_LABELS = {
  /** Names the whole screen, for the landmark. */
  regionLabel: (exercise: string): string => `Ficha de ${exercise}`,

  /** The way back. Present only when there is a session to go back to. */
  backToSession: "Volver a la sesión",
  backToSessionAriaLabel: (title: string): string => `Volver a la sesión ${title}`,

  /**
   * The tab strip.
   *
   * `aria` names the destination ("Ver la progresión") while `label` names the thing on
   * screen ("Progresión"): a tab called just "Progresión" and a heading called "Progresión"
   * are the same word twice in a row in a screen reader's reading, and the extra verb is
   * what makes them distinguishable out of context.
   */
  tabsAriaLabel: "Datos del ejercicio",
  tabs: {
    demo: { label: "Demo", aria: "Ver la demo y el calentamiento" },
    progress: { label: "Progresión", aria: "Ver la progresión" },
    records: { label: "Récords", aria: "Ver los récords personales" },
  } as Record<string, { label: string; aria: string }>,

  /** Shown in the header while a session runs, next to its clock. */
  sessionRunning: "Sesión en curso",
  sessionRunningAriaLabel: (title: string, elapsed: string): string =>
    `Sesión en curso: ${title}, ${elapsed}. Sigue contando mientras miras esta ficha.`,

  /** The clock itself, for when it is the only thing describing the session. */
  sessionClockAriaLabel: (elapsed: string): string => `${elapsed} de sesión en curso`,

  /** No session: the way back goes elsewhere. */
  noSession: "Sin sesión activa",
  backToTrain: "Ir a entrenar",

  notFound: "No encontramos ese ejercicio",
  notFoundHint: "Puede que el enlace apunte a un ejercicio que ya no está en el catálogo.",
  loading: "Cargando ficha…",

  /** Skeleton screen shown while the lazy hub chunk streams in. */
  skeleton: {
    title: "Cargando ficha de ejercicio",
    content: "Contenido de la ficha",
  },

  /** The dynamic chips: what the athlete has actually got going for this movement. */
  chipsAriaLabel: "Resumen rápido del ejercicio",
} as const;

/** Copy for the demo tab: the media, the muscles, and the warm-up ramp. */
export const HUB_DEMO_LABELS = {
  primaryMuscles: "Músculos principales",
  secondaryMuscles: "Músculos secundarios",
  musclesAriaLabel: (exercise: string): string => `Músculos que trabaja ${exercise}`,

  warmup: "Rampa de calentamiento",
  warmupOpen: "Generar calentamiento",
  warmupOpenAriaLabel: (exercise: string): string =>
    `Generar una rampa de calentamiento para ${exercise}`,
  warmupWorkingWeight: (exercise: string): string => `Peso de trabajo de ${exercise}`,
  warmupWorkingWeightHint: "La rampa se calcula sobre el peso con el que vas a trabajar.",
  warmupInsert: "Añadir a la sesión",
  warmupInsertAriaLabel: (weights: string): string =>
    `Añadir ${weights} a la sesión como calentamiento`,
  warmupNoSession: "Inicia una sesión para añadirlas",
  warmupEmpty: "No hace falta calentamiento para ese peso",
  warmupRampAriaLabel: (weights: string): string => `Rampa: ${weights}`,
  warmupQueued: (n: number): string =>
    n === 1
      ? "1 serie de calentamiento añadida a la sesión"
      : `${n} series de calentamiento añadidas a la sesión`,

    /** Not in the rack: the ramp snapped to what the gym can actually build. */
    warmupNote: "Cada paso se ajusta a los discos que tienes en el gimnasio.",

    /** Technique tips, below the muscle map. */
    tipsTitle: "Tips de técnica",
    tipsAriaLabel: (exercise: string): string => `Tips de técnica de ${exercise}`,
    /** The list of official tips. */
    tipsOfficialAriaLabel: "Instrucciones del catálogo",
    /** The athlete's own tips, kept apart from the official ones. */
    tipsMine: "Mis tips",
    tipsMineAriaLabel: "Tus tips para este ejercicio",
    tipsMinePlaceholder: "Añade tu propio tip…",
    tipsMineAdd: "Guardar tip",
    tipsMineEmpty: "Aún no tienes tips propios para este ejercicio.",
    tipsMineDeleteAriaLabel: (tip: string): string => `Borrar tip: ${tip}`,
  } as const;

/** Copy for the progression tab. */
export const HUB_PROGRESS_LABELS = {
  /** Metric choice. Each entry names the series it draws. */
  metricsAriaLabel: "Métrica",
  metrics: {
    topWeight: "Peso máx.",
    estimate: "1RM est.",
    volume: "Volumen",
  } as Record<string, string>,

  /** Period choice, in days. `null` would mean "everything", which is not a choice. */
  periodAriaLabel: "Periodo",
  periods: {
    m1: "1M",
    m3: "3M",
    y1: "1A",
  } as Record<string, string>,

  /** Fewer than this many sessions in range: the chart draws but says why it is thin. */
  thinData: (n: number): string =>
    n === 1 ? "Solo hay 1 sesión registrada" : `Solo hay ${n} sesiones registradas`,

  /** Nothing at all, ever. Different from thin: there is no line to draw. */
  empty: "Todavía no hay sesiones de este ejercicio",

  /**
   * Sessions exist but none inside the selected window.
   *
   * A separate string from `empty` because the two need different actions. "Never trained
   * this" sends someone to their first session; "nothing in the last month" sends someone
   * to switch the period back, and telling them the exercise has no history when they
   * trained it in March is simply a bug wearing a sentence.
   */
  emptyInPeriod: (period: string): string =>
    `No hay sesiones en los últimos ${period}. Prueba con un periodo más largo.`,

  unitVolume: "kg·rep",
  unitKg: "kg",

  history: "Historial de sesiones",
  historyCollapseAriaLabel: (exercise: string, open: boolean): string =>
    open
      ? `Ocultar el historial de ${exercise}`
      : `Ver el historial de ${exercise}`,
  historyEmpty: "Sin sesiones",

  /** The plateau verdict, in the athlete's words rather than the engine's. */
  plateauInsufficientFew: "Muy pocas sesiones para saber si te has estancado",
  plateauInsufficientTime: (days: number): string =>
    days === 1
      ? "Solo llevas 1 día con este ejercicio: demasiado pronto para saberlo"
      : `Solo llevas ${days} días con este ejercicio: demasiado pronto para saberlo`,
  plateau: (shortfall: string, sessions: number): string =>
    `Sin gains desde hace ${sessions} ${sessions === 1 ? "sesión" : "sesiones"}. Te faltan unos ${shortfall}.`,
  plateauSuggestionUp: "Prueba a subir un poco el peso o las repeticiones",
  plateauSuggestionDeload: "Considera una semana de descarga antes de volver a intentarlo",
  progressing: (gain: string): string => `Vas ganando: ${gain} desde la última vez`,

  /** How the chart should name itself for a screen reader. */
  chartAriaLabel: (exercise: string, metric: string): string =>
    `${metric} de ${exercise}`,
} as const;

/**
 * UI copy for the progreso view: the four KPI cards, the weekly bar chart and
 * the recent-session list.
 */
export const PROGRESS_LABELS = {
  title: "Tu progreso",
  subtitle: (count: number): string => `Resumen de tus últimas ${count || 0} sesiones.`,
  metrics: {
    workouts: "Entrenamientos",
    bestWeight: "Peso máximo",
    volume: "Volumen",
    total: "Sesiones totales",
  } as const,
  hints: {
    thisMonth: "este mes",
    validSet: "en serie válida",
    completed: "completadas",
  } as const,
  week: "Últimos 7 días",
  history: "Sesiones recientes",
  historyEmpty: "Cuando termines tu primera sesión aparecerá aquí.",
  sessionSets: (sets: number): string => `${sets} series`,
  /** Sesión sin nombre asignado: "Sesión de Viernes". */
  sessionFallback: (weekday: string): string => `Sesión de ${weekday}`,
  loading: "Calculando…",
} as const;

/** Copy for the records tab. */
export const HUB_RECORDS_LABELS = {
  gridAriaLabel: (exercise: string): string => `Récords de ${exercise}`,

  maxWeight: "Peso máximo",
  estimate: "1RM estimado",
  maxReps: "Máx. repeticiones",
  sessionVolume: "Volumen de sesión",

  /** Never reached. The honest report of "no record" is "no record", not a zero. */
  noRecord: "Sin marca",

  rankAriaLabel: (rank: string, exercise: string): string => `Rango ${rank} en ${exercise}`,
  standardAriaLabel: (percent: string, exercise: string): string =>
    `${percent} del estándar de fuerza en ${exercise}`,
  noStandard: "Este movimiento no tiene un estándar de fuerza definido",

  /** The floating notification that fires when a record breaks during the session. */
  badgeAriaLabel: (title: string): string => `Nuevo récord: ${title}`,
  badgeDismissAriaLabel: "Cerrar el aviso de récord",

  /** How long the notification stays before it clears itself. */
  badgeAutoDismissMs: 4000,
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

  /** Sugerencias de un toque para arrancar la conversación con una mano. */
  chatSuggestions: [
    "¿Qué peso uso?",
    "Sugerir descanso",
    "Analizar racha",
    "Reemplazar ejercicio",
  ] as readonly string[],

  /** One classified failure, per `CoachError` code. */
  chatErrors: {
    RATE_LIMITED: "Has preguntado demasiado rápido. Espera un momento.",
    NETWORK_ERROR: "No se pudo conectar. Revisa tu conexión.",
    AUTH_ERROR: "Tu sesión ha caducado. Vuelve a entrar.",
    INPUT_TOO_LONG: "Tu pregunta es demasiado larga.",
    SERVICE_UNAVAILABLE: "El Coach no está disponible ahora mismo.",
    INVALID_REQUEST: "La solicitud no es válida.",
    AI_DISABLED: "El asistente de IA está deshabilitado en este dispositivo.",
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

  // ---- multichat ---------------------------------------------------------
  /**
   * Gestión de varias conversaciones con el asistente IA.
   */
  chatNewSession: "Nueva conversación",
  chatHistory: "Historial",
  chatSessionsTitle: "Tus conversaciones",
  chatUntitled: "Conversación sin título",
  chatNoSessions: "Aún no tienes conversaciones.",
  chatDeleteSession: "Eliminar conversación",
  chatDeleteConfirm:
    "¿Eliminar esta conversación? Se borrarán todos sus mensajes y no se puede deshacer.",
  chatDeleteYes: "Eliminar",
  chatDeleteNo: "Cancelar",
} as const;

/**
 * Copy for the two-tier coach: the free AI assistant and the paid human coach.
 *
 * Separate from {@link COACH_LABELS} on purpose. That object describes the existing hub,
 * which knows about neither tier; mixing the two would make it impossible to tell which
 * strings a free athlete can ever see. Everything here that a free athlete can reach is
 * about the assistant, and everything about tiers is behind a gate.
 *
 * Every refusal names what to do next. "Necesitas Premium" alone leaves the reader with
 * nothing to act on and reads as a bug rather than a step, which is the same rule the
 * data-gap messages in `COACH_LABELS` already follow.
 */
export const COACH_ACCESS_LABELS = {
  // ---- the free assistant (Vía A) ---------------------------------------
  /**
   * The assistant's name.
   *
   * A name rather than "Coach", because "Coach" is also the paid tier's word and the two
   * appear on the same screen. Naming the free one separately is what lets a screen say
   * "this is free" without a disclaimer paragraph.
   */
  assistantName: "Cronos",
  assistantOpen: "Abrir Cronos",
  assistantAriaLabel: "Abrir el asistente de entrenamiento Cronos",

  // ---- shifts -----------------------------------------------------------
  /**
   * Shift names, keyed by the English `CoachShiftId`.
   *
   * The keys are the wire format -- they come out of `COACH_SHIFTS` and travel in the
   * status -- so a rename here cannot break the schedule, and a new shift forces a key
   * that does not exist yet.
   */
  shifts: {
    morning: "Turno de mañana",
    evening: "Turno de tarde",
  } as Record<"morning" | "evening", string>,

  /** "06:00 - 14:00", the hours a shift is worked. */
  shiftHours: (start: number, end: number): string =>
    `${pad2(start)}:00 – ${pad2(end)}:00`,

  // ---- gates ------------------------------------------------------------
  /**
   * Shown when the athlete is not premium.
   *
   * Says what the tier is and what it unlocks, rather than only what is missing: the
   * reader has to be able to tell whether it is worth anything to them, and a bare
   * refusal is indistinguishable from a bug.
   */
  premiumRequiredTitle: "Coach humano",
  premiumRequiredBody:
    "El coach en persona es la parte premium. Cronos, el asistente de IA, es gratis y sigue disponible para ti ahora mismo.",

  /**
   * Shown between shifts.
   *
   * Leads with the time rather than the refusal: the athlete is not being turned away, and
   * the useful fact is when to come back.
   */
  offShiftTitle: "Ahora no hay turno",
  offShiftBody: (opensAt: string): string =>
    `El próximo turno abre a las ${opensAt}. Tu conversación sigue aquí cuando vuelvas.`,
  offShiftNoTime:
    "El próximo turno todavía no está anunciado. Tus mensajes se guardan mientras tanto.",

  // ---- the PIN form -----------------------------------------------------
  pinTitle: "Desbloquear el panel del coach",
  pinSubtitle: "Este paso es solo para el coach. Si eres atleta, no necesitas nada de esto.",
  pinLabel: "PIN",
  pinInputAriaLabel: "PIN del coach",
  pinSubmit: "Desbloquear",
  pinSubmitting: "Comprobando…",
  /** Announced after the idle timeout closes the session. */
  pinLockedNotice:
    "Tu sesión se cerró por inactividad. Vuelve a introducir el PIN para continuar.",

  // ---- changing a provisional PIN ---------------------------------------
  pinChangeTitle: "Cambia tu PIN",
  pinChangeSubtitle:
    "Este PIN fue asignado por el equipo y tiene que cambiarse antes de usar el panel.",
  pinCurrentLabel: "PIN actual",
  pinCurrentAriaLabel: "PIN actual del coach",
  pinNewLabel: "PIN nuevo",
  pinNewAriaLabel: "PIN nuevo del coach",
  pinChangeSubmit: "Cambiar PIN y continuar",
  pinChangeSubmitting: "Cambiando…",

  /**
   * Requirements for the new PIN, shown under the field.
   *
   * Length and "not the one you are replacing" rather than a character-class rule. A PIN
   * is typed from memory and often read aloud, so symbols and case-sensitivity turn a
   * numeric pad into a coin flip; the only rule that measurably helps against guessing is
   * length.
   */
  pinRequirements: "Mínimo 4 dígitos. No puede ser el PIN que estás reemplazando.",

  // ---- errors -----------------------------------------------------------
  /**
   * One line per `CoachAuthErrorCode`.
   *
   * Keyed by the code rather than carrying a message on the error object, so no server
   * response can put text in front of a coach. `INVALID_PIN` is deliberately identical to
   * what an unknown coach would be told -- the function does not distinguish them either,
   * and a client that did would leak which accounts exist.
   */
  pinErrors: {
    INVALID_PIN: "Ese PIN no es correcto.",
    TOO_MANY_ATTEMPTS: "Demasiados intentos. Espera un momento antes de volver a probar.",
    PIN_CHANGE_REJECTED: "No se pudo cambiar el PIN. Revisa ambos campos.",
    NETWORK_ERROR: "No se pudo conectar. Revisa tu conexión.",
    SERVICE_UNAVAILABLE: "El servicio no está disponible ahora mismo.",
  } as Record<string, string>,

  /**
   * The lockout countdown, given the instant the server said it lifts.
   *
   * Falls back to a statement without a time when the instant is missing or unreadable:
   * "vuelve en NaN minutos" is worse than not saying when, and the coach still needs to
   * know they are locked out.
   */
  lockedUntil: (iso: string | null): string => {
    if (!iso) return "Espera unos minutos antes de volver a probar.";
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "Espera unos minutos antes de volver a probar.";
    return `Puedes volver a intentarlo a las ${pad2(at.getHours())}:${pad2(at.getMinutes())}.`;
  },

  // ---- the portal -------------------------------------------------------
  portalTitle: "Panel del coach",
  portalUnlockCta: "Abrir panel",
  portalLock: "Bloquear",

  /** Where a routine came from. Keyed by `RoutineAuthor`, which is nullable in the column. */
  routineSources: {
    user: "Tu rutina",
    human_coach: "Rutina del coach",
    ai: "Rutina generada por IA",
  } as Record<string, string>,

  // ---- the hub's five states ---------------------------------------------
  /**
   * The upgrade screen. `benefits` is a list rather than one blob of prose so the markup
   * can mark each item up as a list item, which is what makes a screen of three claims
   * scannable instead of a paragraph.
   */
  upgradeTitle: "Coach en persona",
  upgradeBody:
    "Cronos, el asistente de IA, ya es tuyo gratis. El coach en persona es el siguiente paso.",
  upgradeBenefits: [
    "Revisa tu técnica con vídeo y ajusta tus Loads.",
    "Te escribe una rutina para tus fechas y tu nivel.",
    "Responde tus preguntas entre sesiones, no solo en consulta.",
  ] as const,
  upgradeCta: "Ver planes",

  /** Between shifts, premium. Leads with the time, because the athlete is not refused. */
  backAtTitle: "Ahora no hay turno",
  backAt: (hour: number, minute: number): string =>
    `Tu coach vuelve a las ${pad2(hour)}:${pad2(minute)}. Mientras tanto, Cronos está disponible.`,
  backAtUnknown:
    "Tu coach todavía no tiene turno anunciado. Cronos está disponible mientras tanto.",

  requestTitle: "Coach disponible",
  requestBody: "Tu coach está en turno ahora mismo.",
  requestCta: "Solicitar sesión",
  requestNotesLabel: "¿Qué quieres trabajar?",
  requestNotesPlaceholder: "Opcional. Cuéntale el objetivo de esta sesión.",
  requestSubmit: "Enviar solicitud",
  requestSending: "Enviando…",

  requestPendingTitle: "Tu solicitud está en revisión",
  requestPendingBody:
    "Tu coach la verá al empezar su turno y te escribirá por aquí.",

  /** Placeholder until the portal ships. Says so, rather than showing a dead chat. */
  activeSessionTitle: "Sesión activa",
  activeSessionBody:
    "Tu coach te está escribiendo. El chat en vivo llega en la próxima actualización.",
} as const;

/**
 * Copy for the Cronos sheet and the routine wizard.
 *
 * Separate from {@link COACH_ACCESS_LABELS} because that object is about *tiers* -- who
 * may use what -- and every string in it is a gate. This one is about the interface a
 * free athlete uses every day, and mixing them would make the gate copy impossible to
 * find again.
 */
export const CRONOS_LABELS = {
  fabAriaLabel: "Abrir Cronos",
  sheetAriaLabel: "Cronos, asistente de entrenamiento",
  sheetTitle: "Cronos",
  close: "Cerrar",
  closeAriaLabel: "Cerrar Cronos",
  tabChat: "Chat",
  tabGenerate: "Generar rutina",

  /**
   * The standing disclaimer under the assistant.
   *
   * Says what it is for, not what it is not, and names both real limits: a model cannot
   * see a bar and cannot diagnose. "Es una IA" alone is the version nobody reads.
   */
  disclaimer:
    "Cronos es una IA de apoyo. No ve tu técnica ni sustituye a un médico o un entrenador.",

  // ---- wizard ------------------------------------------------------------
  goalLabel: "Objetivo",
  /** Keyed by the wire values in `RoutineGoal`. */
  goals: {
    volume: "Volumen",
    definition: "Definición",
    maintenance: "Mantenimiento",
  } as Record<string, string>,

  daysLabel: "Días por semana",
  daysValue: (n: number): string => `${n} ${n === 1 ? "día" : "días"}`,
  daysDecrease: "Quitar un día de entrenamiento",
  daysIncrease: "Añadir un día de entrenamiento",

  durationLabel: "Duración de sesión",
  durationMinutes: (n: number): string => `${n} min`,

  next: "Siguiente",
  back: "← Editar parámetros",

  generating: "Cronos está diseñando tu rutina…",
  cancel: "Cancelar",

  /** Shown inline when generation fails. Paired with `retry`. */
  generateError: "No se pudo generar la rutina.",
  retry: "Reintentar",

  nameLabel: "Nombre de la rutina",
  namePlaceholder: "Mi rutina de 4 días",
  dayHeading: (n: number): string => `Día ${n}`,
  dayExerciseCount: (n: number): string => `${n} ${n === 1 ? "ejercicio" : "ejercicios"}`,
  prescription: (sets: number, repsMin: number, repsMax: number): string => {
    const reps = repsMin === repsMax ? `${repsMin}` : `${repsMin}–${repsMax}`;
    return `${sets}×${reps}`;
  },
  emptyDay: "Sin ejercicios.",
  unknownExercise: "Ejercicio no disponible",

  /**
   * The substitution notice. Split into two strings rather than one with a count because
   * "1 ejercicios se sustituyeron" is a visible bug in a sentence whose whole job is to
   * build trust.
   */
  substitutedOne: "1 ejercicio se sustituyó por uno disponible.",
  substitutedMany: (n: number): string =>
    `${n} ejercicios se sustituyeron por movimientos disponibles.`,

  save: "Guardar rutina",
  saving: "Guardando…",
  saveError: "No se pudo guardar la rutina.",
  saved: "Rutina guardada.",
  regenerate: "Regenerar",
} as const;

/**
 * Copy for the coach portal -- the screen a signed-in coach sees at `/coach/portal`.
 *
 * A fourth block, and separate from all three above on purpose. `COACH_ACCESS_LABELS` is
 * about *tiers*: what an athlete is allowed. `CRONOS_LABELS` is the free assistant. This
 * one is a work surface, used by a coach and not by an athlete, and it is the only one of
 * the four whose audience is a member of staff.
 *
 * That difference drives two choices in here. Error copy is explicit about what went wrong
 * and never blames the coach for a server problem -- the same rule `useCoachAuth` follows
 * when it refuses to report a dropped connection as a wrong PIN. And the wording is
 * imperative and short, because it is read at a glance during a session rather than
 * composed into a sentence.
 */
export const COACH_PORTAL_LABELS = {
  // ---- header ------------------------------------------------------------
  title: "Portal del entrenador",
  /**
   * The one action that throws the session away.
   *
   * Named "sign out of the portal" rather than "sign out", because signing out of the app
   * would end the athlete-facing session too and this does not. A coach closing a laptop
   * for lunch and a coach who has finished for the day are doing the same thing here, and
   * neither of them means to lock themselves out of their account.
   */
  closeSession: "Cerrar sesión del portal",
  closeSessionConfirm: "¿Cerrar la sesión del portal? Tendrás que escribir el PIN otra vez.",

  // ---- shift panel -------------------------------------------------------
  availabilityTitle: "Mi turno",
  availabilityOn: "Estoy disponible",
  availabilityOff: "No disponible",
  availabilityHint:
    "Aparece como disponible para que los atletas premium puedan pedirte sesión.",

  /**
   * The shift being worked right now, from `CoachShift`.
   *
   * Takes both hours because the closing hour belongs to the *next* shift: printing the
   * end as a constant here would make the morning say 06:00 and the evening say 06:00
   * too, which is a fact about the schedule hardcoded into a string that does not know
   * about the schedule.
   */
  shiftHours: (startHour: number, endHour: number): string =>
    `Turno de ${pad2(startHour)}:${pad2(0)} a ${pad2(endHour)}:${pad2(0)}`,

  /** When no shift covers the current local time, as an ISO instant from `startsAt`. */
  nextShiftAt: (when: string): string => `Tu turno abre ${when}`,

  /**
   * Shown when the local clock is outside both shifts *and* `startsAt` is unavailable.
   *
   * Its own string rather than the "next shift" one with an empty argument, because
   * "Tu turno abre " with nothing after it is exactly the kind of half-sentence this file
   * exists to prevent.
   */
  noShift: "Ahora mismo no hay turno.",

  // ---- request queue -----------------------------------------------------
  queueTitle: "Solicitudes",
  queueEmptyTitle: "No hay solicitudes",
  queueEmptyBody: "Cuando un atleta premium te escriba, aparecerá aquí.",

  /**
   * The five states a request can be in, keyed by the wire value.
   *
   * Complete against `coach_session_requests_status_check`, which is
   * `('pending','active','declined','closed','cancelled')`. An incomplete map does not
   * throw -- it renders the raw enum value, which is how a coach ends up reading
   * "cancelled" in the middle of a Spanish screen. Asserted in `i18n.test.ts` so a
   * migration that widens the constraint fails a test rather than a demo.
   */
  requestStatus: {
    pending: "Por responder",
    active: "Sesión activa",
    declined: "Rechazada",
    closed: "Cerrada",
    cancelled: "Cancelada",
  } as Record<string, string>,

  requestNotesLabel: "Nota del atleta",
  requestNotesEmpty: "No dejó ninguna nota.",
  requestSentAt: (when: string): string => `Enviada ${when}`,

  /**
   * Shown when `profiles.display_name` is null.
   *
   * `display_name` is nullable and an athlete is never asked to fill it, so this is a
   * state the queue will genuinely meet. A raw uuid would be worse than nothing: it is
   * something the coach cannot act on, and it is something they would have to read aloud
   * to find the right account.
   */
  athleteUnnamed: "Atleta sin nombre",

  accept: "Aceptar",
  accepting: "Aceptando…",
  decline: "Rechazar",
  declining: "Rechazando…",
  openConversation: "Ver conversación",

  queueError: "No se pudo actualizar la solicitud.",
  queueLoadError: "No se pudieron cargar las solicitudes.",

  /**
   * Shown when an athlete sends their *second* request while one is already active.
   *
   * Says what the button will do rather than only that it is unavailable. A disabled
   * control with no explanation is the thing this file keeps trying to avoid.
   */
  alreadyActive: "Este atleta ya tiene una sesión activa contigo.",

  // ---- chat --------------------------------------------------------------
  chatTitle: "Conversación",
  /**
   * The chat's own "no athlete chosen yet" line.
   *
   * Deliberately not `crmSelectPrompt`. The portal stacks the chat, the CRM and the builder in
   * one column and all three are empty at the same moment, so a shared sentence printed the
   * same sentence three times in a row -- once per card -- which reads as a bug rather than a
   * reminder. Each card now says what that card is waiting for.
   */
  chatSelectPrompt: "Abre una solicitud para hablar con el atleta.",
  chatPlaceholder: "Escribe un mensaje…",
  chatSend: "Enviar",
  chatEmpty: "Todavía no hay mensajes. Escribe el primero.",
  chatError: "No se pudo enviar el mensaje.",
  chatLoadError: "No se pudieron cargar los mensajes.",

  // ---- athlete CRM -------------------------------------------------------
  crmTitle: "Ficha del atleta",
  crmSelectPrompt: "Elige una solicitud para ver la ficha del atleta.",
  crmLoading: "Cargando la ficha…",
  crmLoadError: "No se pudo cargar la ficha.",

  /** Section headings inside the CRM, in the order they are rendered. */
  crmRanksSection: "Rangos por músculo",
  crmVolumeSection: "Volumen semanal",
  crmPrsSection: "Records personales",
  crmHistorySection: "Rutinas anteriores",
  crmCheckinsSection: "Molestias y readiness",

  prsNone: "Todavía no hay registros de fuerza.",
  prsAchievedOn: (when: string): string => `Logrado ${when}`,
  prsRecentOnly: "Sin datos de peso registrados",

  historyEmpty: "No tiene rutinas guardadas.",
  historyAuthoredByCoach: "Tu rutina",
  historyAuthoredByAthlete: "Rutina del atleta",
  historyAuthoredByAi: "Rutina generada con Cronos",

  /** The check-in section has no table behind it yet; see the Block 5 TODO. */
  checkinsPending:
    "Sin registro de molestias. La sección se activa cuando el atleta empiece a anotar check-ins.",

  // ---- VIP routine builder ----------------------------------------------
  builderTitle: "Rutina para el atleta",
  /** The builder's own "no athlete chosen yet" line -- see `chatSelectPrompt`. */
  builderSelectPrompt: "Elige una solicitud para preparar su rutina.",
  builderRoutineTitleLabel: "Nombre de la rutina",
  builderRoutineTitlePlaceholder: "Fuerza 4 días",
  /** Shown when the coach reaches for the save button with no name typed. */
  builderNoTitle: "Ponle un nombre a la rutina antes de guardarla.",
  builderEmpty: "Sin días todavía.",
  builderAddDay: "Añadir día",
  builderRemoveDay: (n: number): string => `Quitar el día ${n}`,
  builderDayNameLabel: "Nombre del día",
  builderDayNamePlaceholder: "Pecho y espalda",
  builderAddExercise: "Añadir ejercicio",
  builderExerciseSearchLabel: "Buscar ejercicio",
  builderExerciseSearchPlaceholder: "Press de banca",
  builderNoExerciseChosen: "Sin ejercicio elegido.",
  builderNoExercisesFound: "Ningún ejercicio coincide.",
  builderExerciseSets: "Series",
  builderExerciseRepsMin: "Reps mínimo",
  builderExerciseRepsMax: "Reps máximo",
  builderExerciseRest: "Descanso (s)",
  builderRemoveExercise: "Quitar ejercicio",
  builderSave: "Guardar rutina",
  builderSaving: "Guardando…",
  builderSaveError: "No se pudo guardar la rutina.",
  builderSaved: (title: string): string => `«${title}» guardada en la biblioteca del atleta.`,
  builderSavedToast: "¡Rutina guardada correctamente!",
  builderOfflineToast: "Guardado localmente. Se sincronizará al reconectar.",
  builderNeedsDay: "Añade al menos un día con un ejercicio antes de guardar.",
  builderNeedsExerciseChoice: "Elige el ejercicio de cada fila antes de guardar.",
  builderNeedsCoach: "Tu sesión de entrenador no tiene id. Recarga la página.",

  // ---- shared ------------------------------------------------------------
  close: "Cerrar",
  loading: "Cargando…",
  /** Announced by the queue and the chat when their polling finds nothing new. */
  nothingNew: "Nada nuevo",

  // ---- request routine modal -----------------------------------------------
  requestRoutineTitle: "Pedir rutina al coach",
  requestRoutineGoalLabel: "Objetivo",
  requestRoutineGoalHipertrofia: "Hipertrofia",
  requestRoutineGoalFuerza: "Ganar fuerza",
  requestRoutineGoalGrasa: "Perder grasa",
  requestRoutineGoalRecomposicion: "Recomposición",
  requestRoutineDaysLabel: "Días a la semana",
  requestRoutineDays: (n: number): string => `${n} días`,
  requestRoutineNotesLabel: "Notas para el coach",
  requestRoutineNotesPlaceholder:
    "Ej. Tengo molestia en el hombro derecho, evita press de banca.",
  requestRoutineEquipment: "Gym completo",
  requestRoutineSubmit: "Enviar solicitud",
  requestRoutineSending: "Enviando…",
  requestRoutineSuccess:
    "Tu coach recibió la solicitud. Te escribirá cuando la rutina esté lista.",
  requestRoutineError: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
  requestRoutineClose: "Cerrar",

  // ---- portal empty state ------------------------------------------------
  portalEmptyTitle: "Elige una solicitud",
  portalEmptyBody:
    "Abre una conversación con un atleta para ver su ficha, hablar y preparar su rutina.",

  // ---- live gym feed -------------------------------------------------------
  liveFeedTitle: "Entrenando ahora",
  liveFeedEmpty: "Nadie está entrenando en este momento.",
  liveFeedStarted: (when: string): string => `desde ${when}`,
  liveFeedNoAthlete: "Atleta sin nombre",

  // ---- coach notes ---------------------------------------------------------
  coachNotesTitle: "Notas privadas del coach",
  coachNotesPlaceholder: "Observaciones internas: lesiones, preferencias, horario…",
  coachNotesSaving: "Guardando…",
  coachNotesSaved: "Guardado.",
  coachNotesSaveError: "No se pudo guardar la nota.",
  coachNotesOnlyCoach: "Solo tú puedes leer estas notas.",
  coachNotesDictate: "Dictar notas",
  coachNotesListening: "Escuchando…",

  // ---- fase e intensidad ---------------------------------------------------
  phaseTitle: "Fase de entrenamiento",
  phaseLabel: "Fase actual",
  phaseDeload: "Descarga",
  phaseMaintenance: "Mantenimiento",
  phaseOverload: "Sobrecarga",
  phaseSaving: "Guardando…",
  phaseSaved: "Fase actualizada.",
  phaseSaveError: "No se pudo actualizar la fase.",

  // ---- sustituto de ejercicios ---------------------------------------------
  substituteTitle: "Sustituir ejercicio",
  substituteByMuscle: "Alternativas por grupo muscular",
  substituteCurrent: "Actual: {name}",
  substituteNoAlternatives: "No hay alternativas para este grupo muscular.",
  substituteReplace: "Reemplazar",

  // ---- coach banner ----------------------------------------------------------
  coachBannerTitle: "Tu coach",
  coachBannerAvailable: "Disponible",
  coachBannerUnavailable: "No disponible ahora",
  coachBannerRequestRoutine: "Pedir nueva rutina",
  coachBannerExerciseHelp: "Consultar sobre un ejercicio",

  // ---- athlete detail view -------------------------------------------------
  athleteDetailTitle: "Ficha del atleta",
  athleteDetailBack: "Volver",
  athleteDetailGoal: "Objetivo",
  athleteDetailDays: "Días a la semana",
  athleteDetailEquipment: "Equipo",
  athleteDetailPhase: "Fase actual",
  athleteDetailNotes: "Notas privadas",
  athleteDetailNoNotes: "Sin notas privadas todavía.",
athleteDetailUnknown: "Sin dato",

   // ---- activación VIP (efectivo) -------------------------------------------
   athleteVipBadge: "VIP Activo (Efectivo)",
   athleteVipActivate: "Activar Suscripción VIP (Efectivo)",
   athleteVipActivated: "Atleta activado como VIP correctamente.",
   athleteVipActivateError: "No se pudo activar al atleta como VIP.",
   athleteVipStatus: "Estado VIP",
   athleteVipActivatedAt: "Activado el",

   // ---- avatar del atleta ----------------------------------------------------
   athleteDetailAvatarAlt: "Foto de perfil del atleta",
   athleteDetailAvatarFallback: "Avatar de Cronos",

   // ---- gestión de ejercicios por el coach -----------------------------------
   exerciseMenu: "Más opciones",
   exerciseRename: "Renombrar",
   exerciseRenameLabel: "Nuevo nombre",
   exerciseRenamePlaceholder: "Nombre del ejercicio",
   exerciseSave: "Guardar",
   exerciseCancel: "Cancelar",
   exerciseHide: "Ocultar del catálogo",
   exerciseHidden: "Ocultado del catálogo",
   exerciseRenameError: "No se pudo renombrar el ejercicio.",
   exerciseHideError: "No se pudo ocultar el ejercicio del catálogo.",

   // ---- plantillas de rutina -------------------------------------------------
   templateSectionTitle: "Asignar plantilla base",
   templateAssign: "Asignar al atleta",
   templateAssigned: "Plantilla asignada al plan del atleta.",
   templateAssignError: "No se pudo asignar la plantilla.",
   templateFullbody: "Principiante - Fullbody 3 Días",
   templatePushPullLegs: "Push / Pull / Legs",
   templateNoCatalog: "No hay plantillas disponibles todavía.",

   // ---- plantillas base globales (coach) -----------------------------------
   templateBaseTitle: "Plantillas Base",
   templateCreate: "Crear plantilla",
   templateCreating: "Creando…",
   templateEdit: "Editar",
   templateLoadError: "No se pudieron cargar las plantillas.",
   templateLoading: "Cargando plantillas…",
   templateEmpty: "No hay plantillas base todavía.",
   templateBy: "Creada por {coachId}",
   templateBuilderTitle: "Creador de plantilla base",
   templateSave: "Guardar plantilla",
   templateSaving: "Guardando…",
   templateSaved: "Plantilla guardada.",

   // ---- catálogo de ejercicios del coach -----------------------------------
   exerciseCatalogTitle: "Ejercicios",
   exerciseCreate: "Crear ejercicio",
   exerciseCreating: "Creando…",
   exerciseLoadError: "No se pudieron cargar los ejercicios.",
   exerciseLoading: "Cargando ejercicios…",
   exerciseSearchPlaceholder: "Buscar ejercicio…",
   exerciseEmpty: "No hay ejercicios disponibles.",
   exerciseNewTitle: "Nuevo ejercicio",
   exerciseNamePlaceholder: "Nombre del ejercicio",
   exerciseNameEsPlaceholder: "Nombre en español",
   exerciseBodyPartPlaceholder: "Grupo muscular",
   exerciseTargetPlaceholder: "Músculo objetivo",
   exerciseEquipmentPlaceholder: "Equipamiento",
   exerciseInstructionsPlaceholder: "Instrucciones",
   exerciseCreateError: "No se pudo crear el ejercicio.",

   // ---- IA routine generation ----------------------------------------------
   builderGenerateAiButton: "Sugerir rutina con IA",
  builderGeneratingAi: "Generando rutina…",
  builderAiSaved: "Rutina generada con IA guardada en la biblioteca del atleta.",

  /**
   * Minutes remaining in a PIN lockout, for the live countdown in `CoachAccessGate`.
   *
   * Takes a rounded-up count so "1" shows for the whole final minute rather than flipping
   * to "0" at 59 seconds -- a lockout that says zero minutes while still active tells the
   * coach to try again immediately and spend another attempt.
   */
  lockedUntilMinutes: (minutes: number): string => {
    const n = Math.max(1, Math.ceil(minutes));
    return n === 1 ? "1 minuto" : `${n} minutos`;
  },
} as const;

/** Zero-padded so a single-digit hour reads as `06:00` and not `6:00`. */
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

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

/**
 * The name of a muscle group, for the weekly coverage card.
 *
 * Falls back to the raw slug, like every other translation here: a muscle the
 * dictionary does not know yet shows its slug rather than an empty row.
 */
export function translateMuscle(value: string): string {
  return lookup(MUSCLE_LABELS_ES, value);
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