/**
 * types.ts — the Coach module's data contracts.
 *
 * Two rules govern everything in this file, and both exist because of what these
 * shapes are *for*:
 *
 *  1. **Serializable.** The Step 2 assistant turns the training context into a
 *     system prompt, and that prompt has to cross a network boundary to a proxy
 *     that holds the OpenRouter key. A shape carrying a React element, a `Date`
 *     or a function would not survive the trip, so timestamps are ISO strings and
 *     nothing here is a class instance.
 *
 *  2. **Derived, never stored.** The training context is assembled on read from
 *     tables that already exist -- `profiles`, `bodyweight_entries`,
 *     `workout_logs`, `completed_sets` -- plus the rank engine. Persisting a
 *     snapshot would duplicate a truth that keeps moving and then disagree with it
 *     silently, which is the failure mode this module cannot afford: a coach that
 *     quotes a stale bodyweight is worse than no coach.
 *
 * What is *authored* rather than derived -- notes and recommendations -- does
 * live behind {@link CoachContextSource}, because that is the one thing here whose
 * value cannot be recomputed from a training log.
 */

import type { Slug } from "react-muscle-highlighter";
import type { RankId } from "../ranks/rankConfig";

// ------------------------------------------------------------------ data gaps

/**
 * A fact the context wanted and could not get.
 *
 * Modelled as a list rather than as a boolean per field because the UI has to be
 * able to say *which* input is missing, and "we could not build your context" is
 * not a useful thing to tell someone. A muscle scored as unranked because their
 * bodyweight is unknown is a different situation from one with no sessions logged,
 * and the fix is different too.
 */
export type CoachDataGap =
  | "no_profile"
  | "no_bodyweight"
  | "no_profile_energy"
  | "no_workouts"
  | "no_classified_muscles"
  /**
   * `session_checkins` has a table, types and a reader, but no writer: there is no
   * readiness form anywhere in the app. So the subjective inputs a coach would
   * most want -- sleep, soreness, motivation -- are structurally absent, and the
   * context says so rather than pretending an empty array means "fine".
   */
  | "no_readiness_checkins";

// ------------------------------------------------------------ training context

/** The athlete as the profile knows them. */
export interface CoachProfileFact {
  sex: "male" | "female" | "other" | null;
  weightKg: number | null;
  heightCm: number | null;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  activityLevel: string;
  goal: "lose_weight" | "maintain" | "gain_muscle" | "strength" | "endurance";
  unitSystem: "metric" | "imperial";
}

/** Bodyweight and its recent direction, which is what a bulk or a cut turns on. */
export interface CoachBodyweightFact {
  latestKg: number | null;
  /** Net change over the trailing 30 days, or null with too few weigh-ins. */
  changeLast30Days: number | null;
  /** How many weigh-ins the trend is computed from. */
  seriesCount: number;
}

/** Training load, aggregated. Deliberately not per-muscle: that is `muscles`. */
export interface CoachVolumeFact {
  totalWorkouts: number;
  workoutsThisMonth: number;
  monthlyVolume: number;
  /** Per-week session counts, oldest first, for spotting frequency trends. */
  weeklyPoints: { label: string; date: string; count: number }[];
}

/** Daily calorie and protein targets, or null when Mifflin-St Jeor cannot run. */
export interface CoachEnergyFact {
  targetKcal: number;
  proteinGrams: number | null;
}

/** One exercise's contribution to a muscle, for naming the movement. */
export interface CoachExerciseFact {
  name: string;
  estimatedOneRepMax: number;
}

/** One muscle, flattened from the rank map into what a coach would talk about. */
export interface CoachMuscleFact {
  slug: Slug;
  label: string;
  classified: boolean;
  rankId: RankId;
  rankLabel: string;
  /** 0-100, or 0 when unranked. Never inferred. */
  score: number;
  /**
   * Why this muscle has no rank, as the scorer's own reason code. Null when
   * classified. The reason is carried rather than flattened to a boolean because
   * "no data yet" and "we cannot tell without your bodyweight" call for different
   * next steps from the athlete.
   */
  unrankedReason: string | null;
  confidence: "low" | "medium" | "high";
  /** Exercises that drove the score, strongest first. */
  topExercises: CoachExerciseFact[];
}

/**
 * Everything the coach knows, assembled for one moment in time.
 *
 * Read-only by construction: every field is either derived or a fact the athlete
 * supplied. Nothing here is a suggestion, because a suggestion has to be able to
 * cite why.
 */
export interface CoachContext {
  generatedAt: string;
  profile: CoachProfileFact | null;
  bodyweight: CoachBodyweightFact;
  volume: CoachVolumeFact;
  energy: CoachEnergyFact | null;
  muscles: CoachMuscleFact[];
  /** What could not be assembled. Empty is a real state, not a default. */
  dataGaps: CoachDataGap[];
}

// -------------------------------------------------------------------- notes

/**
 * A dated note in the coach log.
 *
 * `author` is a discriminant from the first commit even though only `"user"` is
 * possible today. The Step 2 assistant writes into the same list, and a note whose
 * provenance is inferred from a `source` field at render time is a note that will
 * eventually be rendered as the AI's when the user wrote it. The type says who
 * wrote it; the UI is not allowed to guess.
 */
export interface CoachNote {
  id: string;
  author: "coach" | "user";
  body: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Optional muscle this note is about, so the log can be filtered by anatomy. */
  muscleSlug: Slug | null;
}

// ----------------------------------------------------------- recommendations

/**
 * "Swap this exercise out."
 *
 * Aimed at the Step 3 injury map: `blockedBy` names the physical restriction that
 * makes the original movement unavailable, so a recommendation can be traced to
 * the thing that caused it and a resolved restriction can withdraw it. A
 * replacement with no stated cause is a suggestion the athlete has to evaluate
 * cold, which is exactly the friction a coach is supposed to remove.
 */
export interface ExerciseSwapRecommendation {
  kind: "exercise_swap";
  id: string;
  /** The exercise being replaced. */
  exerciseId: string;
  exerciseName: string;
  /** The proposed substitute, absent while the catalog has no candidate. */
  suggestedExerciseId: string | null;
  reason: string;
  blockedBy: {
    muscleSlug: Slug | null;
    /** Set once Step 3 has injury records to point at. */
    restrictionId: string | null;
  };
}

/** "Change how much or how often you train." */
export interface TrainingAdjustmentRecommendation {
  kind: "training_adjustment";
  id: string;
  area: "volume" | "frequency" | "deload" | "technique";
  /** The advice itself, already phrased for the athlete. */
  change: string;
  reason: string;
  /** Null when the advice is about the whole program rather than one muscle. */
  muscleSlug: Slug | null;
}

/**
 * The discriminated union that keeps both kinds addressable.
 *
 * Split at the type level rather than carried as one object with optional fields:
 * an `exercise_swap` without `blockedBy` would be unusable, and a union makes that
 * a compile error instead of a runtime undefined.
 */
export type Recommendation = ExerciseSwapRecommendation | TrainingAdjustmentRecommendation;

// --------------------------------------------------------------- persistence

/** The shape a note or a recommendation has to have before it can be stored. */
export type CoachNoteDraft = Omit<CoachNote, "id" | "createdAt">;

/** What {@link CoachContextSource.save} is handed. Both fields are whole-list. */
export interface CoachStorePatch {
  notes?: CoachNote[];
  recommendations?: Recommendation[];
}

/**
 * The persistence seam.
 *
 * Step 1 implements it in memory, so the hub is a working screen without a schema.
 * Step 2 and Step 3 add the Supabase tables behind the same three functions and
 * nothing above this line changes. That is the whole reason it is an interface with
 * three methods rather than a set of exported functions: when the real store lands,
 * the swap happens in exactly one file.
 */
export interface CoachContextSource {
  /** Notes and recommendations for a user, oldest note first. */
  load(userId: string): Promise<{ notes: CoachNote[]; recommendations: Recommendation[] }>;
  /** Whole-list writes. A list, not a diff: these sets are small and rewriting them
   *  avoids the class of bug where a partial update drops a concurrent write. */
  save(userId: string, patch: CoachStorePatch): Promise<void>;
}
