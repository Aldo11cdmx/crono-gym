/**
 * rankConfig.ts — every tunable number for the progression ranks.
 *
 * Kept out of the scoring code on purpose. These values encode judgement about
 * what "Gold" means, and judgement changes with product feedback; the maths that
 * consumes them should not have to change with it. A future A/B test on
 * thresholds is an edit to this file and nothing else.
 *
 * Nothing here is a physics constant. The ratios are an editorial ladder derived
 * from published strength standards (see STANDARD_RATIOS below) and are meant to
 * be tuned by someone who trains, not derived from first principles.
 */

// ------------------------------------------------------------------- ranks

export type RankId =
  | "unranked"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "elite"
  | "obsidian";

export interface RankDefinition {
  id: RankId;
  /** Spanish name shown in the badge and legend. */
  label: string;
  /** Minimum score (0-100) to hold this rank. Ascending. */
  minScore: number;
  /**
   * Fill colour for the body map.
   *
   * Chosen for contrast against true-black OLED (`neutral.950 = #000000`) rather
   * than for hue prettiness. Every value clears 4.5:1 against black for the
   * label text drawn on top of it.
   */
  color: string;
  /** Lighter variant for strokes and glows on a black background. */
  borderColor: string;
  /**
   * Shape glyph, so rank is legible without colour.
   *
   * This is not decoration. Roughly 1 in 12 men has some form of colour vision
   * deficiency, and a rank ladder is exactly the kind of information that must
   * survive being printed in monochrome.
   */
  glyph: string;
  /** Short Spanish description for the legend tooltip. */
  description: string;
}

/**
 * Score thresholds for the seven ranks.
 *
 * The ladder is weighted toward the lower end: the jump from Bronze to Silver
 * is narrow because that is where a new lifter's first real progress lands, and
 * the gaps widen as the ratios become harder to move. Obsidian starts at 95
 * rather than 100 so a genuinely exceptional muscle is reachable but rare.
 */
export const RANKS: RankDefinition[] = [
  {
    id: "unranked",
    label: "Sin clasificar",
    minScore: 0,
    // Deliberately recessive: this is the *absence* of a rank, and a muscle with
    // no data should not compete for attention with one the user earned. It is
    // the only fill allowed below the 4.5:1 floor the earned ranks all clear.
    color: "#3f3f46",
    borderColor: "#7a7a80",
    glyph: "—",
    description: "Faltan datos para clasificar este músculo.",
  },
  {
    id: "bronze",
    label: "Bronce",
    minScore: 12,
    color: "#c2660a",
    borderColor: "#d97706",
    glyph: "●",
    description: "Primeros meses de trabajo constante.",
  },
  {
    id: "silver",
    label: "Plata",
    minScore: 28,
    color: "#9ca3af",
    borderColor: "#d1d5db",
    glyph: "◆",
    description: "Base sólida y fuerza en progresión.",
  },
  {
    id: "gold",
    label: "Oro",
    minScore: 46,
    color: "#e8b923",
    borderColor: "#ffd27a",
    glyph: "★",
    description: "Fuerza notable y volumen bien programado.",
  },
  {
    id: "platinum",
    label: "Platino",
    minScore: 64,
    color: "#0ea5e9",
    borderColor: "#7dd3fc",
    glyph: "⬟",
    description: "Rendimiento alto y muy constante.",
  },
  {
    id: "diamond",
    label: "Diamante",
    minScore: 80,
    color: "#a5b4fc",
    borderColor: "#c7d2fe",
    glyph: "⬢",
    description: "Fuerza avanzada, cerca de Elite.",
  },
  {
    id: "elite",
    label: "Élite",
    minScore: 88,
    color: "#fb7185",
    borderColor: "#fecdd3",
    glyph: "✦",
    description: "Nivel comparativo alto, propio de competición.",
  },
  {
    id: "obsidian",
    label: "Obsidiana",
    minScore: 95,
    color: "#a855f7",
    borderColor: "#d8b4fe",
    glyph: "✷",
    description: "Nivel excepcional en ese músculo.",
  },
];

/** The one rank above `unranked`, i.e. the first rank a muscle can earn. */
export const FIRST_RANK: RankDefinition = RANKS[1];

/** Ranks in ascending order, excluding `unranked`. */
export const EARNABLE_RANKS: RankDefinition[] = RANKS.filter((r) => r.id !== "unranked");

export function rankById(id: RankId): RankDefinition {
  const found = RANKS.find((r) => r.id === id);
  if (!found) throw new Error(`Rango desconocido: ${id}`);
  return found;
}

// ------------------------------------------------------------- scoring mix

export const SCORE_WEIGHTS = {
  /** Share of the score earned by estimated strength. */
  strength: 0.7,
  /** Share earned by volume and consistency. */
  volume: 0.3,
} as const;

// -------------------------------------------------------------- strength

/**
 * Estimated-one-rep-max rules.
 *
 * Reuses the project's existing Epley window rather than defining a second one:
 * `overload.ts` already documents that Epley is only validated to ~10 reps, and
 * two disagreeing thresholds in one codebase is how a "best 1RM" silently starts
 * meaning two different things.
 */
export const STRENGTH_RULES = {
  /** Sets above this rep count are ignored for strength. */
  maxRepsForEstimate: 10,
  /** Warm-up sets never count toward anything. */
  ignoreWarmups: true,
  /**
   * Seconds of bodyweight treated as one kilo of load.
   *
   * Pull-ups and dips are scored on added weight rather than on raw bodyweight,
   * because "the biggest number you lifted" is not the same as "the most you
   * moved": someone who weighs 110 kg out-pulls a 60 kg lifter without being
   * stronger. 1 rep of bodyweight is treated as equivalent to ~5 kg of
   * resistance, the usual estimate for a strict bodyweight pulling movement.
   */
  bodyweightRepsAsKg: 5,
  /** Minimum load for a movement to count as a strength signal, in kg. */
  minLoadKg: 1,
} as const;

// ------------------------------------------------------- standard tables

export type ExerciseKey =
  | "squat"
  | "deadlift"
  | "bench"
  | "overheadPress"
  | "row"
  | "pullup"
  | "dip";

export type SexKey = "male" | "female" | "other";

/**
 * Ratio benchmarks: estimated 1RM divided by bodyweight.
 *
 * `male` / `female` are the Gold-level ratio for that movement; the ladder for
 * each movement is derived from the rank thresholds so the seven ranks stay
 * consistent across movements. Sex-specific because published strength standards
 * differ substantially, and because a single unisex table would rate most women
 * who lift as unranked.
 *
 * These are editorial starting points, not measurements. The honest limitation:
 * they encode one lifter's experience of what each ratio feels like, and they
 * ignore lever length, technique and training age, all of which move a real
 * 1RM without moving capability.
 */
export const STANDARD_RATIOS: Record<ExerciseKey, { male: number; female: number }> = {
  squat: { male: 1.75, female: 1.5 },
  deadlift: { male: 2.0, female: 1.65 },
  bench: { male: 1.25, female: 0.8 },
  overheadPress: { male: 0.85, female: 0.55 },
  row: { male: 1.35, female: 1.0 },
  pullup: { male: 0.9, female: 0.5 },
  dip: { male: 0.85, female: 0.5 },
};

/**
 * Which standard ratio a logged exercise should be compared against.
 *
 * Keyed by catalog `target` because the dataset does not name movements, and
 * target is the only stable handle. The mapping is deliberately coarse: within
 * one target the load varies far more between variations than between targets,
 * so a finer mapping would be false precision.
 */
export const TARGET_STANDARD: Record<string, ExerciseKey> = {
  glutes: "squat",
  quads: "squat",
  hamstrings: "deadlift",
  "lower back": "deadlift",
  spine: "deadlift",
  pectorals: "bench",
  "upper back": "row",
  lats: "row",
  traps: "row",
  delts: "overheadPress",
  triceps: "overheadPress",
  biceps: "row",
  forearms: "row",
  abs: "squat",
  obliques: "squat",
  adductors: "squat",
  calves: "squat",
};

/**
 * Ratio table for "other" / undisclosed sex.
 *
 * Deliberately the midpoint of the two published tables rather than either one.
 * Picking male would systematically rate a non-binary or undisclosed lifter as
 * under-ranked, which is the failure mode a default is supposed to avoid. The
 * consequence is that this table is the most generous and the least calibrated;
 * `confidence` reports lower for it so the UI can say so.
 */
export function standardRatioFor(key: ExerciseKey, sex: SexKey): number {
  const table = STANDARD_RATIOS[key];
  if (sex === "male") return table.male;
  if (sex === "female") return table.female;
  return (table.male + table.female) / 2;
}

/** True when the sex key has its own calibrated table rather than the midpoint. */
export function hasCalibratedStandard(sex: SexKey): boolean {
  return sex === "male" || sex === "female";
}

// ------------------------------------------------- exercise contribution

/**
 * Weight given to an exercise when it contributes to a muscle's score.
 *
 * Primary work counts fully; a synergist counts for 0.4. That ratio is not
 * arbitrary precision -- it is the point at which a secondary movement stops
 * being evidence of capability for that muscle and starts being evidence of
 * effort. A pull-up set is real bicep work, but it is not the same signal as a
 * curl, and letting it count equally would let a back-focused lifter rank as a
 * strong arm specialist on 40kg of curls.
 */
export const CONTRIBUTION_WEIGHTS = {
  primary: 1.0,
  secondary: 0.4,
  /** At most this many exercises are allowed to drive a muscle's score. */
  maxContributingExercises: 3,
} as const;

// ------------------------------------------------------- volume & decay

export const VOLUME_RULES = {
  /** Working sets in the lookback window that count toward the score. */
  windowDays: 90,
  /** Weekly set count treated as the full mark for the volume component. */
  targetSetsPerWeek: 14,
  /** Distinct training weeks with at least one working set. */
  targetWeeks: 13,
  /**
   * Days without a working set after which volume starts decaying.
   *
   * Six weeks is where detraining becomes measurable in trained lifters; the
   * decay is gradual rather than a cliff because nothing is lost on day 43.
   */
  decayAfterDays: 42,
  /** Fraction of the volume component retained after a long layoff. */
  decayFloor: 0.4,
  /** Days over which the decay plays out once past `decayAfterDays`. */
  decayRampDays: 56,
} as const;

// ------------------------------------------------------------ eligibility

export const ELIGIBILITY = {
  /**
   * Distinct sessions before a muscle can be ranked.
   *
   * Three, because two sessions cannot distinguish "trained twice" from
   * "trained consistently", and a rank that claims otherwise is a rank the user
   * will learn to distrust.
   */
  minSessions: 3,
  /** Distinct sessions for high confidence. */
  highConfidenceSessions: 10,
  /** Distinct sessions for medium confidence; below that is low. */
  mediumConfidenceSessions: 5,
  /** Days after which confidence degrades even with many sessions. */
  stalenessDays: 45,
} as const;

// ------------------------------------------------------------- hysteresis

export const HYSTERESIS = {
  /**
   * Points below the rank's floor required before a demotion.
   *
   * Without this the map flickers: one session where the user felt tired drags
   * the score under the threshold, the rank drops, and the next good session
   * brings it back. Three points is wide enough to absorb a bad day and narrow
   * enough that real decline still shows.
   */
  demotionBuffer: 3,
  /** Promotions apply immediately; only demotions are damped. */
  dampenPromotions: false,
} as const;

// ------------------------------------------------------------ confidence

export type ConfidenceLevel = "low" | "medium" | "high";

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: "Datos limitados",
  medium: "Confianza media",
  high: "Confianza alta",
};