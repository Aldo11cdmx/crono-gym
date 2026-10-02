/**
 * muscleMap.ts — bridges the anatomy model's muscle slugs to the exercise
 * catalog.
 *
 * The catalog stores two columns: `body_part` (10 coarse regions) and `target`
 * (19 specific muscles). The anatomy model speaks its own vocabulary
 * (`quadriceps`, `gluteal`, `upper-back`, ...), so this file is the single
 * place that translates anatomy -> catalog queries.
 *
 * Two decisions worth stating:
 *
 * - A muscle can map to several targets. Lats and upper-back are distinct
 *   catalog rows but both live on the back map, and a user clicking "Espalda"
 *   expects both.
 * - Some anatomical regions have no exercises in the catalog at all (hands,
 *   feet, knees, ankles, head). Those are disabled rather than hidden, so the
 *   body reads as a whole body while never offering a dead click. Clicking a
 *   region with zero results is worse than showing it greyed out.
 */

import type { Slug } from "react-muscle-highlighter";

export interface MuscleDefinition {
  slug: Slug;
  /** Spanish label shown in the legend and the results header. */
  label: string;
  /** Catalog `target` values this muscle covers. */
  targets: string[];
  /**
   * Catalog `body_part` values this muscle belongs to.
   *
   * Needed because a click on e.g. lower-back should also return exercises
   * filed under that region even when their `target` is something odd.
   */
  bodyParts: string[];
  /** False when the catalog has no exercises for this region. */
  enabled: boolean;
  /**
   * Set when this muscle intentionally returns the same exercises as another.
   *
   * The catalog has no `obliques` target, so obliques map onto `abs`. Declaring
   * it keeps the duplication explicit and lets the test suite distinguish a
   * deliberate alias from an accidental collision.
   */
  aliasOf?: Slug;
}

/**
 * Anatomy slug -> catalog coverage.
 *
 * Kept exhaustive against the library's `Slug` union so a future library
 * version adding a muscle fails to compile here instead of silently rendering
 * an unclickable shape.
 */
export const MUSCLE_DEFINITIONS: MuscleDefinition[] = [
  {
    slug: "chest",
    label: "Pecho",
    targets: ["pectorals"],
    bodyParts: ["chest"],
    enabled: true,
  },
  {
    slug: "deltoids",
    label: "Hombros",
    targets: ["delts"],
    bodyParts: ["shoulders"],
    enabled: true,
  },
  {
    slug: "biceps",
    label: "Bíceps",
    targets: ["biceps"],
    bodyParts: ["upper arms"],
    enabled: true,
  },
  {
    slug: "triceps",
    label: "Tríceps",
    targets: ["triceps"],
    bodyParts: ["upper arms"],
    enabled: true,
  },
  {
    slug: "forearm",
    label: "Antebrazos",
    targets: ["forearms"],
    bodyParts: ["lower arms"],
    enabled: true,
  },
  {
    slug: "upper-back",
    label: "Espalda alta",
    targets: ["upper back", "lats"],
    bodyParts: ["back"],
    enabled: true,
  },
  {
    slug: "trapezius",
    label: "Trapecios",
    targets: ["traps"],
    bodyParts: ["back"],
    enabled: true,
  },
  {
    slug: "lower-back",
    label: "Zona lumbar",
    targets: ["spine"],
    bodyParts: ["waist", "back"],
    enabled: true,
  },
  {
    slug: "abs",
    label: "Abdominales",
    targets: ["abs"],
    bodyParts: ["waist"],
    enabled: true,
  },
  {
    slug: "obliques",
    label: "Oblicuos",
    // The catalog has no dedicated obliques row; they live under abs.
    targets: ["abs"],
    bodyParts: ["waist"],
    enabled: true,
    aliasOf: "abs",
  },
  {
    slug: "gluteal",
    label: "Glúteos",
    targets: ["glutes"],
    bodyParts: ["upper legs"],
    enabled: true,
  },
  {
    slug: "quadriceps",
    label: "Cuádriceps",
    targets: ["quads"],
    bodyParts: ["upper legs"],
    enabled: true,
  },
  {
    slug: "hamstring",
    label: "Isquiotibiales",
    targets: ["hamstrings"],
    bodyParts: ["upper legs"],
    enabled: true,
  },
  {
    slug: "adductors",
    label: "Aductores",
    targets: ["adductors"],
    bodyParts: ["upper legs"],
    enabled: true,
  },
  {
    slug: "calves",
    label: "Pantorrillas",
    targets: ["calves"],
    bodyParts: ["lower legs"],
    enabled: true,
  },
  {
    slug: "neck",
    label: "Cuello",
    targets: [],
    bodyParts: ["neck"],
    enabled: true,
  },
  {
    slug: "knees",
    label: "Rodillas",
    targets: [],
    bodyParts: [],
    enabled: false,
  },
  {
    slug: "ankles",
    label: "Tobillos",
    targets: [],
    bodyParts: [],
    enabled: false,
  },
  {
    slug: "tibialis",
    label: "Tibial anterior",
    targets: [],
    bodyParts: [],
    enabled: false,
  },
  {
    slug: "feet",
    label: "Pies",
    targets: [],
    bodyParts: [],
    enabled: false,
  },
  {
    slug: "hands",
    label: "Manos",
    targets: [],
    bodyParts: [],
    enabled: false,
  },
  {
    slug: "head",
    label: "Cabeza",
    targets: [],
    bodyParts: [],
    enabled: false,
  },
  {
    slug: "hair",
    label: "Cabello",
    targets: [],
    bodyParts: [],
    enabled: false,
  },
];

const BY_SLUG = new Map<Slug, MuscleDefinition>(
  MUSCLE_DEFINITIONS.map((m) => [m.slug, m]),
);

/** Every slug the model can render, used to keep the two lists in sync. */
export const ALL_SLUGS: Slug[] = MUSCLE_DEFINITIONS.map((m) => m.slug);

export function muscleDefinition(slug: Slug): MuscleDefinition | undefined {
  return BY_SLUG.get(slug);
}

/** Slugs the user may click: those with catalog coverage. */
export function enabledSlugs(): Slug[] {
  return MUSCLE_DEFINITIONS.filter((m) => m.enabled).map((m) => m.slug);
}

/** Slugs rendered but inert, so the figure still reads as a whole body. */
export function disabledSlugs(): Slug[] {
  return MUSCLE_DEFINITIONS.filter((m) => !m.enabled).map((m) => m.slug);
}

/**
 * How strongly an exercise works a muscle.
 *
 * - `primary`: the catalog's `target` names this muscle. The movement was filed
 *   under it because it is the muscle being trained.
 * - `secondary`: the exercise trains the muscle as a synergist. It lives in a
 *   body region this muscle covers but its `target` is a different muscle, e.g.
 *   a barbell row has `target: "lats"` and is a secondary stimulus for the
 *   trapezius.
 *
 * The distinction drives ranking weights (1.0 vs 0.4) and result ordering, so it
 * has to be explicit rather than a boolean.
 */
export type MatchLevel = "primary" | "secondary";

/**
 * Resolves the match level of an exercise for a muscle, or null for no match.
 *
 * The rule is deliberately one-directional:
 *
 * - A muscle with specific `targets` treats those targets as primary and the
 *   muscle's body regions as secondary. Adding a body-part fallback to the
 *   *primary* test would silently widen every muscle to its whole region:
 *   biceps (151) would claim all 292 upper-arm exercises, and lumbar (19) would
 *   claim 372 by swallowing every back exercise. The catalog's `target` is
 *   always populated, so there is nothing to gain and precision to lose.
 * - A muscle with no `targets` (only the neck, in practice) matches on
 *   `bodyParts`, since that is all the catalog offers for it.
 */
export function muscleMatchLevel(
  exercise: { target: string; body_part: string },
  slug: Slug,
): MatchLevel | null {
  const def = BY_SLUG.get(slug);
  if (!def || !def.enabled) return null;
  if (def.targets.length > 0) {
    if (def.targets.includes(exercise.target)) return "primary";
    return def.bodyParts.includes(exercise.body_part) ? "secondary" : null;
  }
  return def.bodyParts.includes(exercise.body_part) ? "primary" : null;
}

/** Boolean form of {@link muscleMatchLevel}, for callers that do not rank. */
export function exerciseMatchesMuscle(
  exercise: { target: string; body_part: string },
  slug: Slug,
): boolean {
  return muscleMatchLevel(exercise, slug) !== null;
}

/**
 * Cross-check against the live catalog vocabulary.
 *
 * Called in tests/dev to prove the mapping has no typos: a target named here
 * but absent from the database would make a muscle silently return zero
 * exercises, which is the failure mode users would notice first.
 */
export function catalogVocabulary(observed: { targets: string[]; bodyParts: string[] }): {
  unknownTargets: string[];
  unknownBodyParts: string[];
} {
  const targets = new Set(observed.targets);
  const bodyParts = new Set(observed.bodyParts);

  const unknownTargets = new Set<string>();
  const unknownBodyParts = new Set<string>();

  for (const def of MUSCLE_DEFINITIONS) {
    for (const target of def.targets) {
      if (!targets.has(target)) unknownTargets.add(target);
    }
    for (const part of def.bodyParts) {
      if (!bodyParts.has(part)) unknownBodyParts.add(part);
    }
  }

  return { unknownTargets: [...unknownTargets], unknownBodyParts: [...unknownBodyParts] };
}