/**
 * tools.ts — OpenRouter tool definitions for the exercise coach.
 *
 * These are the three tools the model can invoke when answering exercise
 * questions. They are declared as OpenAI-compatible function specs (the shape
 * OpenRouter's tool-calling API accepts), so a provider change stays a single
 * constant swap rather than a rewrite.
 *
 * The tools are pure declarations here: they describe what the model *can* ask
 * for. The actual execution lives in the client — see {@link executeToolCall}.
 * This split exists because the model names a tool in its reply, but the data
 * behind it (PRs, catalog, gym inventory) is the client's to own, read from the
 * Supabase session it already holds. A model must never be trusted to fetch
 * what the client already has.
 */

import type { Exercise } from "@/types/supabase";
import { estimateOneRepMax } from "@/lib/exercise/exerciseMetrics";
import { MY_GYM_EQUIPMENT_TAGS, MY_GYM_MACHINES, type GymMachine } from "@/data/myGymEquipment";

// ------------------------------------------------------------------ types

/**
 * A single PR entry for one exercise, derived from the athlete's logged sets.
 *
 * Mirrors `AthletePR` from `useAthletePRs` but is stripped to what the model
 * needs: the name (not the uuid), the weight, the reps, and when it was set.
 * The uuids are not sent — a model will try to invent them.
 */
export interface PRSummary {
  exerciseName: string;
  weightKg: number;
  reps: number | null;
  estimatedOneRepMax: number | null;
  achievedAt: string;
}

/**
 * An exercise proposed by the model for a new routine.
 *
 * The `exerciseId` is validated by the caller against the catalog before
 * anything is persisted: a model confidently produces row ids that do not exist.
 * The name travels as a label only.
 */
export interface RoutineExerciseInput {
  exerciseId: string;
  exerciseName?: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

export interface RoutineResult {
  routineId: string;
  name: string;
  exerciseCount: number;
}

/**
 * The result of executing one tool call.
 *
 * A discriminated union on `tool`: the client switches on it to render the
 * right shape, and a `tool` the client does not know reads as an error rather
 * than a silent no-op.
 */
export type ToolResult =
  | { tool: "createRoutine"; result: RoutineResult }
  | { tool: "getAthletePRs"; result: PRSummary[] }
  | { tool: "getGymEquipment"; result: GymEquipmentSummary };

export interface GymEquipmentSummary {
  /** Every available equipment tag this gym can perform. */
  tags: string[];
  /** The named machines, grouped by area. */
  machines: GymMachine[];
}

// ----------------------------------------------------------- tool specs

/**
 * The three tool declarations sent to OpenRouter in the `tools` array.
 *
 * Each is a plain object — no function wrapping, no runtime code — because the
 * provider only needs the JSON schema. The descriptions are deliberately
 * specific: a vague description is how a model invents parameters.
 */
export const EXERCISE_TOOLS: ReadonlyArray<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}> = [
  {
    type: "function",
    function: {
      name: "createRoutine",
      description:
        "Creates a new training routine with the given name and list of exercises. " +
        "Each exercise must reference an existing exercise id from the catalog. " +
        "Returns the new routine id and exercise count.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Human-readable name for the routine, e.g. 'Full body A'.",
          },
          exercises: {
            type: "array",
            description: "The exercises to include in the routine.",
            items: {
              type: "object",
              properties: {
                exerciseId: {
                  type: "string",
                  description: "A valid exercise uuid from the catalog.",
                },
                exerciseName: {
                  type: "string",
                  description: "Display name for the exercise.",
                },
                sets: { type: "integer", minimum: 1, description: "Number of sets." },
                repsMin: { type: "integer", minimum: 1, description: "Minimum reps per set." },
                repsMax: { type: "integer", minimum: 1, description: "Maximum reps per set." },
                restSeconds: {
                  type: "integer",
                  minimum: 0,
                  description: "Rest between sets, in seconds.",
                },
              },
              required: ["exerciseId", "sets", "repsMin", "repsMax", "restSeconds"],
            },
          },
        },
        required: ["name", "exercises"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAthletePRs",
      description:
        "Returns the athlete's personal records for a specific exercise, derived " +
        "from their logged sets using the Epley formula (1RM = weight x (1 + reps/30)). " +
        "Only reliable for sets up to 10 reps. Returns empty if the athlete has no " +
        "logged sets for that exercise.",
      parameters: {
        type: "object",
        properties: {
          exerciseId: {
            type: "string",
            description: "The exercise uuid whose PRs to retrieve.",
          },
        },
        required: ["exerciseId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getGymEquipment",
      description:
        "Returns the equipment tags and named machines available at the athlete's gym, " +
        "so exercise recommendations can be scoped to what can actually be performed.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

/**
 * The set of tool names this client recognises when the model asks for them.
 *
 * Used to validate a parsed tool call before dispatching — a name the client
 * does not know is reported as an error, not silently dropped.
 */
export const TOOL_NAMES = new Set(EXERCISE_TOOLS.map((t) => t.function.name));

// --------------------------------------------------------- execution

/**
 * Executes a tool call the model made, dispatching on the tool name.
 *
 * This is the client-side seam: the model names a tool, and the client is the
 * one that actually has the data (PRs from the session, gym inventory from
 * the static file, a catalog the picker already holds). The model never touches
 * a database directly — it asks for data by name and this function supplies it.
 *
 * Unknown tool names throw rather than silently returning null: a tool the
 * model invented is a bug in the integration, and silently returning nothing
 * teaches the model the wrong shape next time.
 *
 * @throws {Error} when the tool name is not one of {@link TOOL_NAMES}.
 */
export async function executeToolCall(
  tool: string,
  args: Record<string, unknown>,
  context: {
    /** The athlete's logged sets, keyed by exercise id. Untyped at the boundary so the filter can reject malformed rows. */
    prs?: Map<string, unknown[]>;
    /** The exercise catalog, for name resolution. */
    catalog?: Pick<Exercise, "id" | "name">[];
    /** Supabase client, when a tool needs to persist data. */
    supabase?: unknown;
    /** Session to derive a user id from. */
    userId?: string;
  },
): Promise<ToolResult> {
  switch (tool) {
    case "getAthletePRs":
      return { tool: "getAthletePRs", result: getAthletePRs(args, context) };

    case "getGymEquipment":
      return getGymEquipment();

    case "createRoutine":
      // Persisted by the caller — a tool result that writes without a
      // authenticated session or a transaction boundary would be an
      // irreversible data write from a stateless function. The result here
      // is the validation and counts; the caller issues the inserts.
      return { tool: "createRoutine", result: validateRoutineCreation(args, context) };

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

/**
 * Reduces the athlete's sets for one exercise into a PR summary.
 *
 * Pure and synchronous: it reads only from the `context` map the caller
 * assembled. The Epley estimate is computed here so the model sees the number
 * it asked to reason about rather than re-deriving it from raw sets.
 */
function getAthletePRs(
  args: Record<string, unknown>,
  context: { prs?: Map<string, unknown[]>; catalog?: Pick<Exercise, "id" | "name">[] },
): PRSummary[] {
  const exerciseId = typeof args.exerciseId === "string" ? args.exerciseId : "";
  const sets = context.prs?.get(exerciseId) ?? [];

  const name =
    context.catalog?.find((e) => e.id === exerciseId)?.name ?? exerciseId;

  return sets
    .filter((set): set is { weight: number; reps: number; achievedAt: string } => {
      const weight = (set as { weight?: unknown }).weight;
      const reps = (set as { reps?: unknown }).reps;
      const achievedAt = (set as { achievedAt?: unknown }).achievedAt;
      return (
        typeof weight === "number" &&
        weight > 0 &&
        typeof reps === "number" &&
        reps > 0 &&
        typeof achievedAt === "string"
      );
    })
    .map((set) => {
      const weight = set.weight;
      const reps = set.reps;
      return {
        exerciseName: name,
        weightKg: weight,
        reps,
        estimatedOneRepMax: estimateOneRepMax(weight, reps),
        achievedAt: set.achievedAt,
      };
    })
    .sort((a, b) => b.weightKg - a.weightKg);
}

/**
 * Returns the gym's equipment summary.
 *
 * The inventory is static (MY_GYM_EQUIPMENT_TAGS) — it is not a per-user
 * preference, so this tool returns the constant set with no I/O.
 */
function getGymEquipment(): ToolResult {
  return {
    tool: "getGymEquipment",
    result: {
      tags: [...MY_GYM_EQUIPMENT_TAGS],
      machines: MY_GYM_MACHINES,
    },
  };
}

/**
 * Validates a model-proposed routine before the caller persists it.
 *
 * Every exercise id is checked against the catalog the caller supplied.
 * An id that does not exist is dropped from the count — it cannot be inserted
 * against a foreign key — and the count reflects only what will actually be
 * written. The model is told the count, so it learns its proposal was partial
 * rather than silently truncated.
 */
function validateRoutineCreation(
  args: Record<string, unknown>,
  context: { catalog?: Pick<Exercise, "id" | "name">[] },
): RoutineResult {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const exerciseInputs = Array.isArray(args.exercises) ? args.exercises : [];

  const catalog = context.catalog ?? [];
  const knownIds = new Set(catalog.map((e) => e.id));

  const valid = exerciseInputs.filter(
    (e): e is RoutineExerciseInput =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as { exerciseId?: unknown }).exerciseId === "string" &&
      knownIds.has((e as { exerciseId: string }).exerciseId),
  );

  return {
    routineId: `routine_${Date.now()}`,
    name: name || "Sin nombre",
    exerciseCount: valid.length,
  };
}
