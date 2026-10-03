/**
 * types.ts — the assistant's wire contracts, and the mapper onto them.
 *
 * The `AssistantContext` here is **not** the `CoachContext` from `@/lib/coach`. The
 * two answer different questions: `CoachContext` is the app's full derived record,
 * allowed to grow as the product does, while `AssistantContext` is the small, flat,
 * budgeted object that crosses the network to a model that will never see a Supabase
 * row or a React component. Conflating them is how a prompt starts outgrowing its
 * window, so they are separate types and the projection between them is explicit.
 *
 * Everything crossing this boundary is serializable. No `Date`, no class instance, no
 * `undefined` where the model would need to know whether a value is missing.
 */

import type { GymSettings } from "@/context/GymSettingsContext";
import type { CoachContext } from "@/lib/coach/types";
import { BAR_WEIGHTS } from "@/lib/workout/weightUtils";

// ------------------------------------------------------------------ actions

/**
 * A concrete change the coach proposes, machine-readable.
 *
 * The union exists so the UI can offer "Aplicar" only where applying is defined. A
 * single loose object with optional fields would make every consumer handle four
 * shapes it cannot act on, and the discriminated case is what lets a component
 * exhaustively branch without a default that silently swallows a new kind.
 */
export type CoachAction =
  | { type: "exercise_swap"; fromExercise: string; toExercise: string; reason: string }
  | {
      type: "training_adjustment";
      field: "weight" | "reps" | "sets" | "rest";
      delta: number;
      exerciseId?: string;
      reason: string;
    }
  | { type: "calorie_adjustment"; deltaKcal: number; reason: string }
  | { type: "deload_suggestion"; durationWeeks: number; reason: string };

/** The four kinds, for validating a model-produced `type` at runtime. */
export const COACH_ACTION_TYPES = [
  "exercise_swap",
  "training_adjustment",
  "calorie_adjustment",
  "deload_suggestion",
] as const;

/** Narrows an untrusted value to a {@link CoachAction}. Never throws. */
export function isCoachAction(value: unknown): value is CoachAction {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    (COACH_ACTION_TYPES as readonly string[]).includes(type)
  );
}

// ------------------------------------------------------------------- chat

/**
 * One bubble in the conversation.
 *
 * `role: "error"` is part of the transcript rather than a toast: a rate-limit notice
 * that vanishes after four seconds is not something the athlete can act on, and
 * putting it in the scroll means the history of what the coach could and could not
 * answer stays readable next to what it did.
 */
export interface ChatMessage {
  /** `crypto.randomUUID()`. No nanoid dependency for one call. */
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  action?: CoachAction;
  timestamp: number;
  /** True while tokens are still arriving for this message. */
  isStreaming?: boolean;
  /**
   * The failure behind an error bubble, when there is a code for it.
   *
   * Carried so the bubble can offer the *right* way out. An expired session has a
   * button that reopens sign-in; a rate limit has none, because there is nothing for
   * the athlete to do about it. Re-deriving this from the message text would make the
   * UI depend on Spanish copy staying in sync with the classifier.
   */
  errorCode?: CoachError["code"];
}

// ---------------------------------------------------------------- requests

/**
 * What the model is told about the athlete.
 *
 * Flat and small on purpose. Every field here is either something the athlete told
 * us or something we measured; there is no field for the model's opinion of the
 * model, and no "notes" field carrying free text a user might not expect to be sent.
 */
export interface AssistantContext {
  userName?: string;
  /**
   * Training focus, not life goal.
   *
   * Distinct from `profiles.goal`, which records an outcome the athlete is working
   * towards ("gain muscle"). This records what to prioritise *now*: the same athlete
   * can be cutting for definition while needing to keep volume on the lift that
   * matters. Collapsing the two would make a cut look like an instruction to stop
   * progressing.
   */
  currentGoal: "volume" | "definition" | "maintenance";
  experienceLevel: "beginner" | "intermediate" | "advanced";
  /** Best logged set per exercise, strongest first. */
  recentPRs: { exercise: string; weightKg: number; reps: number }[];
  /** Muscle slug to working sets per active week. */
  weeklyVolume: Record<string, number>;
  /** Plate sizes actually on the rack, in kg. */
  availablePlates: number[];
  barWeightKg: number;
  bodyWeightKg?: number;
  /** Muscle slug to its Spanish rank label. */
  currentMuscleRanks?: Record<string, string>;
}

/** The prior turns sent with a question. Capped by the client before sending. */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachRequest {
  userMessage: string;
  context: AssistantContext;
  conversationHistory: ConversationTurn[];
}

export interface CoachResponse {
  message: string;
  action?: CoachAction;
  /** Reported when the upstream provider returns a usage block. */
  tokensUsed?: number;
}

/**
 * A failure, classified.
 *
 * A discriminated union rather than an `Error` subclass because the UI's response
 * differs per kind: a rate limit shows a countdown, a network failure shows a retry
 * button, and an auth failure signs the user out. A single message string would
 * collapse those into one generic notice, which is the thing the brief asked to avoid.
 */
export type CoachError =
  | { code: "RATE_LIMITED"; retryAfterMs: number }
  | { code: "NETWORK_ERROR"; message: string }
  | { code: "AUTH_ERROR" }
  | { code: "INPUT_TOO_LONG" }
  | { code: "SERVICE_UNAVAILABLE" };

/** Thrown by `askCoach`. Named so a caller cannot catch it as a bare `Error`. */
export class CoachRequestError extends Error {
  readonly detail: CoachError;

  constructor(detail: CoachError) {
    super(detail.code);
    this.name = "CoachRequestError";
    this.detail = detail;
  }
}

// ------------------------------------------------------------------ mapper

/**
 * `profiles.goal` onto training focus.
 *
 * Two goals collapse to `volume`: bulking to add muscle and lifting for strength are
 * the same instruction to the coach — add load — and treating strength as
 * "maintenance" would have a strong athlete being told to hold still. Endurance maps
 * to `maintenance` because the app tracks no aerobic work at all, so there is nothing
 * to progress.
 */
const GOAL_MAP = {
  gain_muscle: "volume",
  strength: "volume",
  lose_weight: "definition",
  maintain: "maintenance",
  endurance: "maintenance",
} as const satisfies Record<string, AssistantContext["currentGoal"]>;

/** Exposed for the test that pins the mapping of every value the column can hold. */
export const GOAL_TO_FOCUS: Readonly<Record<string, AssistantContext["currentGoal"]>> = GOAL_MAP;

/**
 * Projects the app's training context onto the wire format.
 *
 * Pure and synchronous: the two inputs are already loaded, and a mapper that had to
 * fetch would be a second place where the app decides what it knows about the user.
 *
 * `weeklyVolume` is computed **per muscle** as `effectiveSets / activeWeeks`, and
 * deliberately not read from `context.volume.weeklyPoints` — those are
 * whole-body session counts per week, which say nothing about which muscle is being
 * trained how much. A coach told "4 sessions last week" cannot tell the difference
 * between an athlete who hit legs twice and one who has not touched them in a month,
 * which is the exact question a volume recommendation turns on.
 *
 * Unclassified muscles are omitted from `currentMuscleRanks`: a muscle with no rank
 * has no rank label to report, and inventing `"unranked"` would read to a model as
 * a tier the athlete had been placed in.
 */
export function toAssistantContext(
  context: CoachContext,
  gymSettings: GymSettings,
): AssistantContext {
  const recentPRs: AssistantContext["recentPRs"] = [];
  const weeklyVolume: Record<string, number> = {};
  const currentMuscleRanks: Record<string, string> = {};

  for (const muscle of context.muscles) {
    if (muscle.activeWeeks > 0) {
      weeklyVolume[muscle.slug] =
        Math.round((muscle.effectiveSets / muscle.activeWeeks) * 10) / 10;
    }
    if (muscle.classified) {
      currentMuscleRanks[muscle.slug] = muscle.rankLabel;
    }
    for (const exercise of muscle.topExercises) {
      // A PR without a set behind it is not a PR; it is an estimate with no origin,
      // and quoting it would put an unverifiable number in the conversation.
      if (!exercise.bestSet) continue;
      recentPRs.push({
        exercise: exercise.name,
        weightKg: exercise.bestSet.weight,
        reps: exercise.bestSet.reps,
      });
    }
  }

  // Strongest first, so a truncated prompt still describes the lifts that matter.
  recentPRs.sort((a, b) => b.weightKg - a.weightKg);

  return {
    currentGoal: context.profile
      ? GOAL_MAP[context.profile.goal] ?? "maintenance"
      : "maintenance",
    experienceLevel: context.profile?.experienceLevel ?? "beginner",
    recentPRs,
    weeklyVolume,
    // Sorted so the model sees a clean scale and so two runs over the same rack
    // produce the same prompt.
    availablePlates: Object.keys(gymSettings.inventory)
      .map(Number)
      .filter((kg) => Number.isFinite(kg))
      .sort((a, b) => a - b),
    // `custom` covers a dumbbell, a kettlebell or a smith bar, none of which weigh
    // 20 kg, so the table's zero would be reported to the model as a real bar.
    barWeightKg:
      gymSettings.barType === "custom"
        ? gymSettings.customBarKg
        : BAR_WEIGHTS[gymSettings.barType],
    ...(context.bodyweight.latestKg === null
      ? {}
      : { bodyWeightKg: context.bodyweight.latestKg }),
    currentMuscleRanks,
  };
}