/**
 * routineGenerator.ts — turns four parameters into a routine the catalog can hold.
 *
 * The model proposes, this module disposes. That split is the whole design, and it exists
 * because a language model will confidently invent an exercise id: the catalog has 1,324
 * rows, the model has read prose about all of them, and "sentadilla" is a name it knows
 * while a row's uuid is not. A routine is written by reference -- `routine_exercises
 * .exercise_id` is a foreign key to a row that has to exist -- so an invented id is not a
 * wrong suggestion, it is a failed insert and a lost session.
 *
 * So every id the model returns is checked against the catalog before it leaves this
 * module, and one that is not there is replaced by the first exercise sharing its
 * `body_part`. The replacement is deliberately not an error: an unusable row for a single
 * movement is a smaller loss than the whole routine, and an athlete can edit a
 * substitution far more easily than they can re-roll.
 *
 * No `Date`, no class instances, nothing that would not survive the boundary. The wizard
 * that calls this can be cancelled mid-flight, so it takes an `AbortSignal` and honours it
 * before *and* after the network call -- parsing a routine nobody will see is wasted work.
 */

import { CoachRequestError, isCoachAction, type AssistantContext, type CoachError } from "./types";
import type { Exercise } from "@/types/supabase";
import { EXERCISE_TOOLS, executeToolCall } from "./tools";
import type { AssistantResponse } from "./coachAssistant";

// ------------------------------------------------------------------ contracts

/** Training focus. Matches `AssistantContext.currentGoal`, so one vocabulary is in play. */
export type RoutineGoal = "volume" | "definition" | "maintenance";

/** 2-6. Not 1: a weekly plan with one day is a session list, not a routine. */
export type DaysPerWeek = 2 | 3 | 4 | 5 | 6;

/**
 * Session length, as one of three values.
 *
 * A union rather than a number because the wizard offers chips, and a `number` would let
 * it build a 47-minute session the UI has no way to display. The three values are also the
 * three that fit a normal week: 45 is a short heavy day, 90 is the upper end before both
 * attention and form fall off.
 */
export type SessionDuration = 45 | 60 | 90;

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface RoutineGenerationRequest {
  goal: RoutineGoal;
  daysPerWeek: DaysPerWeek;
  sessionDurationMinutes: SessionDuration;
  experienceLevel: ExperienceLevel;
  /** Target muscle slugs the athlete wants to prioritise. May be empty. */
  muscleWeaknesses: string[];
  /**
   * Every exercise id the caller will accept.
   *
   * Passed in rather than fetched: the wizard already holds the catalog, it changes rarely,
   * and re-reading 1,324 rows to build a prompt would make generation feel broken on a
   * slow connection. The list is truncated in the prompt so the model has something
   * copyable to work from, and checked in full on the way back -- a model that ignores the
   * prompt still cannot write a dangling foreign key.
   */
  availableExerciseIds: string[];
}

export interface GeneratedExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

export interface GeneratedDay {
  dayNumber: number;
  focus: string;
  exercises: GeneratedExercise[];
}

export interface GeneratedRoutine {
  name: string;
  days: GeneratedDay[];
}

/**
 * A generation failure, classified.
 *
 * Its own class rather than a reused `CoachRequestError`, because the wizard cannot show
 * the chat's copy: "your message was too long" means nothing next to a flow that sent no
 * message. `detail.code` is what the wizard switches on to decide between "retry" and
 * "give up".
 */
export class RoutineGenerationError extends Error {
  readonly detail: CoachError;

  constructor(detail: CoachError) {
    super(detail.code);
    this.name = "RoutineGenerationError";
    this.detail = detail;
  }
}

/** Output budget asked of the model. Generous enough for six days, not for an essay. */
export const MAX_ROUTINE_TOKENS = 1200;

/** Exercises per day. A cap because a model will happily write twenty if asked for none. */
export const MAX_EXERCISES_PER_DAY = 8;

/** Days a routine may contain, whatever the request asked for. */
export const MAX_ROUTINE_DAYS = 6;

/**
 * How many ids go into the prompt.
 *
 * Every id is a long opaque token, so a full 1,324-row list is tens of thousands of
 * characters that buy nothing: a model does not select from a list that long, it copies.
 * A truncated list still constrains the answer and keeps the prompt inside the model's
 * attention -- and `substituteUnknownExercises` runs against the *untruncated* set, so
 * nothing is lost by truncating here.
 */
const ID_LIST_BUDGET = 300;

// --------------------------------------------------------------------- prompt

/**
 * The shape demanded of the model, as prose.
 *
 * Kept as its own constant because it is the one part of the prompt that is a contract
 * rather than a request, and {@link validateRoutine} enforces exactly this. Anything the
 * constant allows and the validator accepts, and vice versa, is a change to both.
 */
const SHAPE_INSTRUCTION = [
  "Responde solo con un bloque ```json y nada más.",
  'Estructura: {"name":string,"days":[{"dayNumber":number,"focus":string,',
  '"exercises":[{"exerciseId":string,"sets":number,"repsMin":number,',
  '"repsMax":number,"restSeconds":number}]}]}',
].join(" ");

/**
 * The short instruction, sent as the user turn.
 *
 * Separate from {@link buildRoutineContext} because `coach-assistant` refuses a user
 * message over 500 characters, and the parameter list plus the JSON shape fit while the
 * exercise-id list does not. The ids travel in the context instead, which has no such
 * cap and is described to the model as data rather than as an instruction.
 *
 * The *counts* also live in the context rather than here, for the same reason -- the
 * instruction was 566 characters with them in it, which is a request the transport would
 * have rejected outright. They are parameters rather than contract, which is where the
 * schema belongs anyway, and putting them there is what keeps the schema here.
 */
export function buildRoutineInstruction(request: RoutineGenerationRequest): string {
  return [
    "Diseña una rutina de fuerza.",
    `Objetivo: ${GOAL_PROMPTS[request.goal]}.`,
    `Nivel: ${LEVEL_PROMPTS[request.experienceLevel]}.`,
    `${request.daysPerWeek} días por semana, ${request.sessionDurationMinutes} min por sesión.`,
    request.muscleWeaknesses.length > 0
      ? `Prioriza: ${request.muscleWeaknesses.join(", ")}.`
      : "Sin prioridades: reparte el trabajo de forma equilibrada.",
    SHAPE_INSTRUCTION,
  ].join(" ");
}

/** The briefing, sent as the context. `buildSystemContent` stringifies it verbatim. */
export function buildRoutineContext(
  request: RoutineGenerationRequest,
  idBudget = ID_LIST_BUDGET,
): RoutinePromptContext {
  return {
    currentGoal: request.goal,
    experienceLevel: request.experienceLevel,
    recentPRs: [],
    weeklyVolume: {},
    availablePlates: [],
    barWeightKg: 20,
    routineRequest: {
      daysPerWeek: request.daysPerWeek,
      sessionDurationMinutes: request.sessionDurationMinutes,
      muscleWeaknesses: request.muscleWeaknesses,
      // Restated here because they are constraints on the answer, not on the instruction,
      // and because a model that ignores a count will otherwise write one day of nine
      // exercises or nine days of one.
      dayNumbers: `del 1 al ${request.daysPerWeek}`,
      exercisesPerDay: `entre 3 y ${MAX_EXERCISES_PER_DAY}`,
      allowedExerciseIds: request.availableExerciseIds.slice(0, idBudget),
    },
  };
}

/**
 * The briefing plus the instruction, in the order the model reads them.
 *
 * Exported as the canonical answer to "what is this feature actually sending?", which is
 * the question a reviewer asks and the one that is otherwise answered by reading two
 * call sites. The transport sends the two halves separately for the length reason above,
 * and this is what makes that split reviewable rather than surprising.
 */
export function buildRoutinePrompt(request: RoutineGenerationRequest): string {
  return `${buildRoutineContext(request)}\n\n${buildRoutineInstruction(request)}`;
}

const GOAL_PROMPTS: Record<RoutineGoal, string> = {
  volume: "volumen, con carga y repeticiones progresivas",
  definition: "definición, conservando la carga y bajando el descanso",
  maintenance: "mantenimiento, con volumen moderado y sin fatigarse",
};

const LEVEL_PROMPTS: Record<ExperienceLevel, string> = {
  beginner: "principiante, con movimientos básicos y 3-4 series de 10-12 reps",
  intermediate: "intermedio, con 4 series de 6-10 reps y carga progresiva",
  advanced: "avanzado, con 4-5 series de 4-8 reps y carga alta",
};

/**
 * The context a routine generation carries.
 *
 * A real `AssistantContext` plus one key, rather than a new type: `askCoach` is typed
 * against `AssistantContext` and the function serialises whatever it is handed, so this is
 * a superset that reaches the model intact without changing the chat's contract.
 *
 * The base fields are deliberately empty rather than filled from the athlete's real
 * record. The prompt above is self-contained, and putting a training log in front of a
 * message that says "design a routine" invites the model to answer from the log instead
 * of from the parameters.
 */
export interface RoutinePromptContext extends AssistantContext {
  routineRequest: {
    daysPerWeek: DaysPerWeek;
    sessionDurationMinutes: SessionDuration;
    muscleWeaknesses: string[];
    /** Phrased as prose because it reaches the model as JSON data, not as an instruction. */
    dayNumbers: string;
    exercisesPerDay: string;
    allowedExerciseIds: string[];
  };
}

// ---------------------------------------------------------------------- parse

/**
 * Pulls the JSON object out of a model reply.
 *
 * The rule is that nothing here trusts the markdown. A fence is only a hint about where
 * the payload might be, so every candidate is a *place to look* rather than an answer: a
 * fence's body, and each brace-balanced object in the text. Each candidate is handed to
 * `JSON.parse` and the first one that yields a value wins. Asking for "solo un bloque
 * ```json y nada más" does not reliably get "solo un bloque ```json y nada más" -- the
 * model wraps it in an apology, appends a closing remark, or leaves the block unterminated
 * at the cut-off of `max_tokens`, and every one of those used to cost a generation.
 *
 * Objects are located by matching braces rather than by taking the text between the first
 * `{` and the last `}`. The last-`}` version reads to the end of the *reply*, not the end of
 * the object, so a reply carrying an action block after the routine -- the same block the
 * chat hides -- was sliced into two JSON values glued together, and the routine was lost to
 * a parse error even though the model had produced it correctly.
 *
 * Never throws, and never returns anything but a parsed value or null. Returns null rather
 * than throwing so the caller decides what that means.
 */
export function parseRoutinePayload(raw: string): unknown {
  for (const candidate of [...fencedBodies(raw), ...balancedObjects(raw)]) {
    const parsed = tryParse(candidate);
    if (parsed === FAILED) continue;
    /*
     * A coach action block rides the same fence syntax and parses just as well, so without
     * this a reply that appended one -- which the chat hides, and which this very function's
     * callers' model has been asked for elsewhere -- would be read as the routine. The two
     * are different protocols that happen to share a delimiter, and `validateRoutine` would
     * reject the action anyway: the generation would be lost to a payload that was never
     * the problem.
     */
    if (isCoachAction(parsed)) continue;
    return parsed;
  }
  return null;
}

/**
 * Fenced block bodies, most-likely-first.
 *
 * A block tagged `json` leads, because when the model did follow the instruction that is
 * the payload and reading in the order it wrote is one fewer guess. Every other fence
 * follows, in the order written, since an untagged block is what a model emits when it
 * ignores the tag without ignoring the fence.
 */
function* fencedBodies(raw: string): Generator<string> {
  const json: string[] = [];
  const other: string[] = [];

  // Reset the shared regex's lastIndex, which is sticky across calls on a /g pattern.
  FENCE.lastIndex = 0;
  for (const match of raw.matchAll(FENCE)) {
    const body = (match[2] ?? "").trim();
    if (body === "") continue;
    ((match[1] ?? "").toLowerCase() === "json" ? json : other).push(body);
  }

  yield* json;
  yield* other;
}

/**
 * Fenced blocks, capturing the language tag.
 *
 * The tag is captured rather than assumed so that `json` can be told apart from an untagged
 * block; see {@link fencedBodies}.
 */
const FENCE = /```([a-zA-Z]*)[ \t]*([\s\S]*?)```/g;

/**
 * Every top-level `{...}` in the text, in the order written, brace-balanced and
 * string-aware.
 *
 * String-aware because the alternative miscounts: a `}` inside `"focus": "pierna } baja"`
 * closes nothing, and a `"` inside the payload escapes the next one. Braces inside a string
 * are counted and discarded rather than tracked, so the depth only moves on braces that are
 * really structure.
 */
function* balancedObjects(raw: string): Generator<string> {
  for (let start = raw.indexOf("{"); start !== -1; start = raw.indexOf("{", start + 1)) {
    const end = matchBrace(raw, start);
    if (end === -1) return; // Unterminated: nothing after it can be balanced either.
    yield raw.slice(start, end + 1);
    start = end;
  }
}

/** The index of the `}` closing the `{` at `start`, or -1 if it never arrives. */
function matchBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

/** Distinguishes "parsed to null" from "did not parse", which `JSON.parse` cannot. */
const FAILED = Symbol("failed");

function tryParse(body: string): unknown | typeof FAILED {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return FAILED;
  }
}

/**
 * Narrows an untrusted value to a {@link GeneratedRoutine}.
 *
 * Structural only -- shapes, ranges, counts. Whether the ids exist is not checked here,
 * because that needs a catalog and this function must stay pure so the parsing rules can
 * be tested against a fixture the size of a tweet.
 *
 * Coercion is lenient about a numeric *string* (`"sets": "4"`) because models emit them
 * and a wizard that drops an exercise over a quoted number is a worse failure than one
 * that accepts it. It is strict about everything else, and returns null rather than
 * repairing: a partially-valid routine is not a routine, and guessing which half to keep
 * is how a two-day split becomes a four-day one.
 */
export function validateRoutine(value: unknown): GeneratedRoutine | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (name === "") return null;
  if (!Array.isArray(record.days) || record.days.length === 0) return null;

  const days: GeneratedDay[] = [];
  for (const rawDay of record.days.slice(0, MAX_ROUTINE_DAYS)) {
    if (typeof rawDay !== "object" || rawDay === null) return null;
    const day = rawDay as Record<string, unknown>;
    if (!Array.isArray(day.exercises) || day.exercises.length === 0) return null;

    const exercises: GeneratedExercise[] = [];
    for (const rawExercise of day.exercises.slice(0, MAX_EXERCISES_PER_DAY)) {
      if (typeof rawExercise !== "object" || rawExercise === null) return null;
      const exercise = rawExercise as Record<string, unknown>;

      const exerciseId =
        typeof exercise.exerciseId === "string" ? exercise.exerciseId.trim() : "";
      if (exerciseId === "") return null;

      const sets = toCount(exercise.sets);
      const repsMin = toCount(exercise.repsMin);
      const repsMax = toCount(exercise.repsMax);
      const restSeconds = toCount(exercise.restSeconds);
      if (sets === null || repsMin === null || repsMax === null || restSeconds === null) return null;

      /*
       * A "range" with its ends reversed means the model swapped the fields. Silently
       * swapping them here would be reading an intent the payload never stated, and
       * `5-3` would quietly become a legal prescription.
       */
      if (repsMax < repsMin) return null;

      exercises.push({ exerciseId, sets, repsMin, repsMax, restSeconds });
    }

    days.push({
      dayNumber: toCount(day.dayNumber) ?? days.length + 1,
      focus: typeof day.focus === "string" ? day.focus.trim() : "",
      exercises,
    });
  }

  return { name, days };
}

/** A positive integer, or null. */
function toCount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

// ------------------------------------------------------------------ catalog

/**
 * Replaces ids the catalog does not have with a real exercise from the same region.
 *
 * "Same `body_part`" is the rule, and the interesting part is *whose*: an unknown id has
 * no row, so its body part is unrecoverable. It is inferred from the day the model wrote
 * it into -- specifically from the exercises in that same day that it did get right. A
 * day is one region, so if the model put a press banca next to two chest movements it
 * meant chest, and the first chest exercise in the catalog is a faithful substitute. If
 * the whole day is unknown there is no signal left, and the substitute is the catalog's
 * first exercise -- a worse answer, but a dangling foreign key is not an answer at all.
 *
 * Runs against everything the caller offered, not against the truncated prompt list: the
 * two are not the same set, and an id outside the prompt may still be a real exercise.
 *
 * The counts are returned so the wizard can tell the athlete a movement changed. Hiding a
 * substitution is how someone ends up wondering why the routine they saved is not the one
 * they were shown.
 *
 * An id that cannot be substituted is **kept** in `unresolved`, not removed. Dropping it
 * would silently leave a day short of the sets the model planned with nothing on screen
 * to explain why; the wizard renders a placeholder and refuses to save, which is a visible
 * failure rather than a quiet one.
 */
export function substituteUnknownExercises(
  routine: GeneratedRoutine,
  availableExerciseIds: string[],
  catalog: Pick<Exercise, "id" | "body_part">[],
): { routine: GeneratedRoutine; substituted: number; unresolved: string[] } {
  const known = new Set<string>([...availableExerciseIds, ...catalog.map((e) => e.id)]);

  // First one wins, so the choice is stable for a given catalog order rather than
  // depending on how rows happened to come back from the database.
  const firstByBodyPart = new Map<string, string>();
  for (const exercise of catalog) {
    const part = exercise.body_part ?? "";
    if (part !== "" && !firstByBodyPart.has(part)) firstByBodyPart.set(part, exercise.id);
  }
  const catalogOrder = catalog.map((exercise) => exercise.id);

  const bodyPartOf = new Map<string, string>();
  for (const id of known) {
    const part = catalog.find((exercise) => exercise.id === id)?.body_part;
    if (part !== undefined && part !== "") bodyPartOf.set(id, part);
  }

  const unresolved: string[] = [];
  let substituted = 0;

  const days = routine.days.map((day) => {
    // The regions this day already lands in, from the exercises the model got right.
    const dayParts = [...new Set(
      day.exercises
        .map((exercise) => (known.has(exercise.exerciseId) ? bodyPartOf.get(exercise.exerciseId) : undefined))
        .filter((part): part is string => part !== undefined),
    )];

    const exercises = day.exercises.map((exercise) => {
      if (known.has(exercise.exerciseId)) return exercise;

      // Prefer the day's own first region; a region the model used elsewhere in this day
      // is the best available evidence of what it meant.
      const fallback =
        (dayParts[0] !== undefined ? firstByBodyPart.get(dayParts[0]) : undefined) ??
        catalogOrder[0];

      if (fallback === undefined) {
        unresolved.push(exercise.exerciseId);
        return exercise;
      }

      substituted += 1;
      return { ...exercise, exerciseId: fallback };
    });

    return { ...day, exercises };
  });

  return { routine: { ...routine, days }, substituted, unresolved: [...new Set(unresolved)] };
}

// ------------------------------------------------------------------ request

/**
 * Asks the assistant for a routine and returns one the catalog can hold.
 *
 * The order is fixed, and each step is a reason the next one cannot be trusted:
 *
 *  1. Abort check, so an already-cancelled wizard spends nothing.
 *  2. One cancellable network call.
 *  3. Abort check again -- the athlete may have cancelled while the model was thinking,
 *     and parsing a routine nobody will see is wasted work.
 *  4. Parse, then validate, then substitute: each is a gate. A malformed reply cannot
 *     become a routine, and a routine with a dangling id cannot reach the wizard.
 *
 * @throws {RoutineGenerationError} classified per {@link CoachError}. An abort is thrown
 * as the platform's own `AbortError`, so the wizard can tell "the user stopped this" from
 * "this failed".
 */
export async function generateRoutine(
  request: RoutineGenerationRequest,
  options: {
    signal?: AbortSignal;
    /**
     * The transport. Injectable because a wizard's three interesting states -- loading,
     * cancelled, failed -- are all about this call, and none of them is reachable without
     * a way to hang, reject and resolve it on demand.
     */
    ask?: RoutineTransport;
    /**
     * The rows an id may point at.
     *
     * Separate from `availableExerciseIds` because they answer different questions: this
     * is "what exists", that is "what will you accept". They are usually the same list,
     * and the wizard passes the catalog for both.
     */
    catalog?: Pick<Exercise, "id" | "body_part">[];
  } = {},
): Promise<{ routine: GeneratedRoutine; substituted: number; unresolved: string[] }> {
  const ask = options.ask ?? askAssistant;
  const catalog = options.catalog ?? [];

  throwIfAborted(options.signal);

  const instruction = buildRoutineInstruction(request);
  const context = buildRoutineContext(request);

  let response: AssistantResponse;
  try {
    response = await ask(instruction, context, options.signal);
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    if (cause instanceof RoutineGenerationError) throw cause;
    if (cause instanceof CoachRequestError) throw new RoutineGenerationError(cause.detail);
    throw new RoutineGenerationError({
      code: "NETWORK_ERROR",
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }

  throwIfAborted(options.signal);

  let routine: GeneratedRoutine | null = null;

  if (response.toolCalls && response.toolCalls.length > 0) {
    const createRoutineCall = response.toolCalls.find(
      (tc) => tc.function.name === "createRoutine",
    );
    if (createRoutineCall) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(createRoutineCall.function.arguments);
      } catch {
        args = {};
      }
      await executeToolCall("createRoutine", args, {
        catalog: catalog as Pick<Exercise, "id" | "name">[],
      }).catch(() => undefined);
      routine = routineFromToolCallArgs(args, context.routineRequest.daysPerWeek);
    }
  }

  if (routine === null) {
    routine = validateRoutine(parseRoutinePayload(response.message));
  }

  if (routine === null) {
    throw new RoutineGenerationError({ code: "SERVICE_UNAVAILABLE" });
  }

  return substituteUnknownExercises(routine, request.availableExerciseIds, catalog);
}

function routineFromToolCallArgs(args: Record<string, unknown>, daysPerWeek: number): GeneratedRoutine | null {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  if (name === "") return null;

  const exercises = Array.isArray(args.exercises) ? args.exercises : [];
  const exercisesPerDay = Math.max(1, Math.ceil(exercises.length / daysPerWeek));
  const days: GeneratedDay[] = [];

  for (let d = 0; d < daysPerWeek; d++) {
    const start = d * exercisesPerDay;
    const end = start + exercisesPerDay;
    const dayExercises = exercises.slice(start, end);
    if (dayExercises.length === 0) continue;

    days.push({
      dayNumber: d + 1,
      focus: "",
      exercises: dayExercises.map((e): GeneratedExercise => {
        const ex = (e as Record<string, unknown>) ?? {};
        return {
          exerciseId: typeof ex.exerciseId === "string" ? ex.exerciseId : "",
          sets: typeof ex.sets === "number" ? ex.sets : 3,
          repsMin: typeof ex.repsMin === "number" ? ex.repsMin : 8,
          repsMax: typeof ex.repsMax === "number" ? ex.repsMax : 12,
          restSeconds: typeof ex.restSeconds === "number" ? ex.restSeconds : 90,
        };
      }),
    });
  }

  if (days.length === 0) return null;
  return validateRoutine({ name, days });
}

/**
 * The call this feature makes: one instruction, one briefing, and the reply's text.
 *
 * A function rather than a class so a test can pass `async () => "..."` and get a real
 * generation without a fake transport type.
 */
export type RoutineTransport = (
  instruction: string,
  context: RoutinePromptContext,
  signal?: AbortSignal,
) => Promise<AssistantResponse>;

/** The default transport: the same Edge Function and the same rate-limit budget as the chat. */
export const askAssistant: RoutineTransport = async (instruction, context, signal) => {
  const { askCoach } = await import("./coachAssistant");

  const response = await askCoach(
    {
      userMessage: instruction,
      context,
      conversationHistory: [],
      tools: [...EXERCISE_TOOLS],
      tool_choice: { type: "function", function: { name: "createRoutine" } },
    },
    () => undefined,
    signal,
  );

  return response;
};

/**
 * An abort, thrown as the platform's `AbortError`.
 *
 * The same name `coachAssistant` looks for, so a wizard that already distinguishes an
 * abort from a failure there handles this without a second branch.
 */
function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException("La generación se canceló", "AbortError");
}