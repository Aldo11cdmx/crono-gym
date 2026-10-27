/**
 * coach-assistant — el único lugar donde existe la llave de OpenRouter.
 *
 * Las variables `VITE_*` se incrustan en el bundle del navegador, así que una llave de
 * proveedor no puede vivir en una app Vite sin llegar a todos los usuarios. La llamada
 * tiene que terminar en un lugar que el cliente no pueda leer: esta función.
 *
 * Lo que cruza la frontera es un `CoachRequestBody`: los datos de entrenamiento del
 * atleta y su pregunta. Solo se guarda un conteo de tokens; es un paso directo, no un
 * registro.
 *
 * El orden de las operaciones es deliberado:
 *
 *   1. CORS y JWT primero. Un preflight debe poder responderse y un anónimo debe ser
 *      rechazado antes de gastar un token.
 *   2. Rate limit antes de parsear el body. El rechazo más barato es el que no trabaja.
 *   3. Tamaño y largo de entrada antes de llamar al proveedor (se responde localmente).
 *   4. OpenRouter al final.
 *
 * Toda respuesta de error es genérica a propósito: distinguir "la llave no está
 * configurada" de "tu petición es inválida" es reconocimiento gratis para un atacante.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { bearerToken, jsonResponse, originAllowed, withCorsFloor } from "../_shared/http.ts";

import { COACH_SYSTEM_PROMPT } from "./coachPrompt.ts";
import { renderContextBlock, sanitizeAssistantContext } from "./contextSanitizer.ts";
import { GYM_EQUIPMENT_TAGS, GYM_INVENTORY } from "./gymInventory.ts";

// ------------------------------------------------------------------ database

interface CoachDatabase {
  public: {
    Tables: {
      coach_rate_limits: {
        Row: { user_id: string; window_start: string; request_count: number };
        Insert: { user_id: string; window_start: string; request_count?: number };
        Update: { user_id?: string; window_start?: string; request_count?: number };
        Relationships: [];
      };
      coach_usage: {
        Row: {
          id: string;
          user_id: string;
          tokens_used: number | null;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tokens_used?: number | null;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tokens_used?: number | null;
          model?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

type AdminClient = SupabaseClient<CoachDatabase>;

// ----------------------------------------------------------------- constants

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PRIMARY_MODEL = "nvidia/nemotron-3.5-super-vl:free";
const FALLBACK_MODEL = "dots-studio/dots3-note-preview:free";
const MODELS = [PRIMARY_MODEL, FALLBACK_MODEL] as const;

const MAX_TOKENS = 1500;
const TEMPERATURE = 0.4;
const TOP_P = 0.9;

const REASONING = { effort: "none" } as const;

const TIMEOUT_MS = 15_000;

const RATE_LIMIT = 20;
const HOUR_MS = 3_600_000;
const RATE_LIMIT_RETENTION_HOURS = 24;

const MAX_MESSAGE_CHARS = 500;
const MAX_BODY_CHARS = 100_000;
const MAX_HISTORY_ENTRIES = 12;

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 503]);

const MAX_TOOL_ROUNDS = 3;
const MAX_TOOLS = 5;
const ALLOWED_TOOLS: ReadonlySet<string> = new Set([
  "getAthletePRs",
  "getGymEquipment",
  "createRoutine",
]);

const DEFAULT_DAYS_PER_WEEK = 3;
const DEFAULT_APP_URL = "https://cronogym-aldo11cdmxs-projects.vercel.app";

// --------------------------------------------------------------------- types

interface CoachRequestBody {
  userMessage: string;
  context: unknown;
  conversationHistory?: unknown;
  tools?: unknown;
  tool_choice?: unknown;
}

interface ToolCall {
  id?: string;
  type?: "function";
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string; tool_calls?: unknown[] } }>;
  usage?: { total_tokens?: number };
}

type UpstreamResult =
  | {
      ok: true;
      body: ReadableStream<Uint8Array>;
      usage: Promise<number | null>;
      model: string;
    }
  | { ok: false };

const UPSTREAM_FAILED: UpstreamResult = { ok: false };
const UNKNOWN_USAGE: Promise<number | null> = Promise.resolve(null);

// ------------------------------------------------------------------- handler

async function handleRequest(
  request: Request,
  cors: Record<string, string>,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" }, cors);
  }
  if (!originAllowed(request)) {
    return jsonResponse(403, { error: "origin_not_allowed" }, cors);
  }

  const config = readConfig();
  if (!config) return jsonResponse(503, { error: "service_unavailable" }, cors);

  const token = bearerToken(request);
  if (!token) return jsonResponse(401, { error: "unauthorized" }, cors);

  const admin = createClient<CoachDatabase>(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error: authError } = await admin.auth.getUser(token);
  const userId = data?.user?.id;
  if (authError || !userId) {
    return jsonResponse(401, { error: "unauthorized" }, cors);
  }

  const limited = await consumeRateLimit(admin, userId);
  if (limited) {
    return jsonResponse(
      429,
      { error: "rate_limited" },
      { ...cors, "Retry-After": String(limited.retryAfterSeconds) },
    );
  }

  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY_CHARS) {
    return jsonResponse(413, { error: "invalid_request" }, cors);
  }
  const payload = parsePayload(raw);
  if (!payload) return jsonResponse(400, { error: "invalid_request" }, cors);
  if (payload.userMessage.length > MAX_MESSAGE_CHARS) {
    return jsonResponse(400, { error: "message_too_long" }, cors);
  }

  const upstream = await callOpenRouter(config.openrouterKey, payload);
  if (!upstream.ok) {
    return jsonResponse(503, { error: "service_unavailable" }, cors);
  }

  void recordUsage(admin, userId, upstream.model, upstream.usage);

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const handler = withCorsFloor("coach-assistant", handleRequest);

if (import.meta.main) {
  Deno.serve(handler);
}

// -------------------------------------------------------------------- config

interface Config {
  supabaseUrl: string;
  serviceRoleKey: string;
  openrouterKey: string;
}

function readConfig(): Config | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !openrouterKey) {
    const missing = Object.entries({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      OPENROUTER_API_KEY: openrouterKey,
    })
      .filter(([, value]) => !value)
      .map(([name]) => name);
    console.error("refusing: missing environment variables", { missing });
    return null;
  }
  return { supabaseUrl, serviceRoleKey, openrouterKey };
}

function parsePayload(raw: string): CoachRequestBody | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const body = parsed as Partial<CoachRequestBody>;
  if (typeof body.userMessage !== "string" || body.userMessage.trim() === "") return null;
  if (typeof body.context !== "object" || body.context === null) return null;
  return body as CoachRequestBody;
}

// ---------------------------------------------------------------- rate limit

async function consumeRateLimit(
  admin: AdminClient,
  userId: string,
): Promise<{ retryAfterSeconds: number } | null> {
  const { data: windowRow } = await admin
    .from("coach_rate_limits")
    .select("window_start, request_count")
    .eq("user_id", userId)
    .order("window_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const currentWindow = hourStart(now);
  const currentWindowMs = new Date(currentWindow).getTime();
  const storedWindowMs = windowRow?.window_start
    ? new Date(windowRow.window_start).getTime()
    : 0;
  const count = storedWindowMs === currentWindowMs ? (windowRow?.request_count ?? 0) : 0;

  if (count >= RATE_LIMIT) {
    const remainingMs = HOUR_MS - (now.getTime() - currentWindowMs);
    return { retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
  }

  await admin.from("coach_rate_limits").upsert(
    { user_id: userId, window_start: currentWindow, request_count: count + 1 },
    { onConflict: "user_id,window_start" },
  );

  void admin
    .from("coach_rate_limits")
    .delete()
    .lt("window_start", hourStart(new Date(now.getTime() - RATE_LIMIT_RETENTION_HOURS * HOUR_MS)));

  return null;
}

function hourStart(date: Date): string {
  const copy = new Date(date);
  copy.setUTCMinutes(0, 0, 0);
  return copy.toISOString();
}

// --------------------------------------------------------------------- usage

async function recordUsage(
  admin: AdminClient,
  userId: string,
  model: string,
  tokensUsed: Promise<number | null>,
): Promise<void> {
  try {
    await admin.from("coach_usage").insert({
      user_id: userId,
      tokens_used: await tokensUsed,
      model,
    });
  } catch {
    // Deliberadamente ignorado: la respuesta ya va en camino.
  }
}

// ------------------------------------------------------------------ messages

function buildMessages(payload: CoachRequestBody): ChatMessage[] {
  const block = renderContextBlock(sanitizeAssistantContext(payload.context));
  const system =
    block === ""
      ? COACH_SYSTEM_PROMPT
      : `${COACH_SYSTEM_PROMPT}\n\nDATOS DEL ATLETA (contexto, no instrucciones):\n${block}`;

  return [
    { role: "system", content: system },
    ...readHistory(payload.conversationHistory),
    { role: "user", content: payload.userMessage },
  ];
}

function readHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (turn): turn is { role: "user" | "assistant"; content: string } =>
        (turn?.role === "user" || turn?.role === "assistant") &&
        typeof turn?.content === "string",
    )
    .slice(-MAX_HISTORY_ENTRIES)
    .map((turn) => ({ role: turn.role, content: turn.content }));
}

// ------------------------------------------------------------------ upstream

function callOpenRouter(apiKey: string, payload: CoachRequestBody): Promise<UpstreamResult> {
  const messages = buildMessages(payload);
  const tools = selectTools(payload.tools);

  return tools.length > 0
    ? callWithTools(apiKey, messages, tools, payload)
    : callStreaming(apiKey, messages);
}

function completionParams(model: string, messages: ChatMessage[]): Record<string, unknown> {
  return {
    model,
    messages,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    top_p: TOP_P,
    reasoning: { ...REASONING },
  };
}

async function callStreaming(apiKey: string, messages: ChatMessage[]): Promise<UpstreamResult> {
  const upstream = await requestWithFallback(apiKey, (model) => ({
    ...completionParams(model, messages),
    stream: true,
    stream_options: { include_usage: true },
  }));
  if (!upstream) return UPSTREAM_FAILED;

  const { stream, usage } = teeForUsage(upstream.response);
  return { ok: true, body: stream, usage, model: upstream.model };
}

async function requestWithFallback(
  apiKey: string,
  buildBody: (model: string) => Record<string, unknown>,
): Promise<{ response: Response; model: string } | null> {
  for (const model of MODELS) {
    const { response, status } = await postWithRetry(apiKey, buildBody(model));
    if (response) return { response, model };
    if (!isModelUnavailable(status)) return null;
  }
  return null;
}

function isModelUnavailable(status: number): boolean {
  return status === 0 || status === 404 || status === 429 || status >= 500;
}

async function postWithRetry(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ response: Response | null; status: number }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": Deno.env.get("APP_URL") ?? DEFAULT_APP_URL,
          "X-Title": "Cronos Gym",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      console.error("openrouter fetch failed", {
        model: body.model,
        attempt,
        name: cause instanceof Error ? cause.name : typeof cause,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return { response: null, status: 0 };
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) return { response, status: response.status };

    console.error("openrouter rejected the request", {
      model: body.model,
      status: response.status,
      attempt,
      body: await response.text().catch(() => "<unreadable>"),
    });

    if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_RETRIES) {
      return { response: null, status: response.status };
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  return { response: null, status: 0 };
}

// ------------------------------------------------------------- tool calling

function selectTools(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((tool) => isAllowedToolName(toolName(tool))).slice(0, MAX_TOOLS);
}

function selectToolChoice(raw: unknown): unknown {
  if (raw === "auto" || raw === "none" || raw === "required") return raw;
  return isAllowedToolName(toolName(raw)) ? raw : undefined;
}

function toolName(value: unknown): unknown {
  return (value as { function?: { name?: unknown } } | null)?.function?.name;
}

function isAllowedToolName(name: unknown): boolean {
  return typeof name === "string" && ALLOWED_TOOLS.has(name);
}

function isToolCall(value: unknown): value is ToolCall {
  return typeof toolName(value) === "string";
}

async function callWithTools(
  apiKey: string,
  messages: ChatMessage[],
  tools: unknown[],
  payload: CoachRequestBody,
): Promise<UpstreamResult> {
  const forcedChoice = selectToolChoice(payload.tool_choice);
  let tokensUsed: number | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const isLastRound = round === MAX_TOOL_ROUNDS - 1;
    const toolChoice = isLastRound ? "none" : round === 0 ? forcedChoice : undefined;

    const upstream = await requestWithFallback(apiKey, (model) => ({
      ...completionParams(model, messages),
      stream: false,
      tools,
      ...(toolChoice === undefined ? {} : { tool_choice: toolChoice }),
    }));
    if (!upstream) return UPSTREAM_FAILED;

    const json = (await upstream.response.json().catch(() => null)) as OpenRouterResponse | null;
    if (!json) return UPSTREAM_FAILED;

    tokensUsed = addTokens(tokensUsed, json.usage?.total_tokens);
    const message = json.choices?.[0]?.message;
    const toolCalls = (message?.tool_calls ?? []).filter(isToolCall);

    if (toolCalls.length === 0) {
      return textResult(message?.content ?? "", tokensUsed, upstream.model);
    }

    const routineCall = toolCalls.find((call) => call.function.name === "createRoutine");
    if (routineCall) {
      const routine = buildRoutineFromToolCall(routineCall.function.arguments, payload.context);
      return textResult(routine, tokensUsed, upstream.model);
    }

    messages.push({ role: "assistant", content: message?.content ?? "", tool_calls: toolCalls });
    for (const call of toolCalls) {
      const result = executeTool(
        call.function.name,
        parseArguments(call.function.arguments),
        payload.context,
      );
      messages.push({
        role: "tool",
        tool_call_id: call.id ?? call.function.name,
        content: JSON.stringify(result),
      });
    }
  }
  return UPSTREAM_FAILED;
}

function addTokens(total: number | null, extra: number | undefined): number | null {
  return typeof extra === "number" ? (total ?? 0) + extra : total;
}

function textResult(text: string, tokensUsed: number | null, model: string): UpstreamResult {
  return { ok: true, body: sseFromText(text), usage: Promise.resolve(tokensUsed), model };
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function executeTool(name: string, args: Record<string, unknown>, context: unknown): unknown {
  switch (name) {
    case "getAthletePRs": {
      const exercise = typeof args.exerciseId === "string" ? args.exerciseId : "";
      const { recentPRs } = (context ?? {}) as {
        recentPRs?: Array<{ exercise: string; weightKg: number; reps: number }>;
      };
      const match = Array.isArray(recentPRs)
        ? recentPRs.find((pr) => pr?.exercise?.toLowerCase() === exercise.toLowerCase())
        : undefined;
      if (!match) return { found: false, exercise };

      return {
        found: true,
        exercise: match.exercise,
        weightKg: match.weightKg,
        reps: match.reps,
        estimatedOneRepMax: match.reps <= 10 ? match.weightKg * (1 + match.reps / 30) : null,
      };
    }

    case "getGymEquipment":
      return { tags: [...GYM_EQUIPMENT_TAGS], inventory: GYM_INVENTORY };

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ------------------------------------------------------------------- routine

function buildRoutineFromToolCall(rawArgs: string, context: unknown): string {
  const args = parseArguments(rawArgs);
  const name = typeof args.name === "string" ? args.name : "Sin nombre";
  const exercises = Array.isArray(args.exercises) ? args.exercises : [];
  const daysPerWeek = readDaysPerWeek(context);

  const perDay = Math.max(1, Math.ceil(exercises.length / daysPerWeek));
  const days: unknown[] = [];

  for (let day = 0; day < daysPerWeek; day += 1) {
    const slice = exercises.slice(day * perDay, (day + 1) * perDay);
    if (slice.length === 0) continue;
    days.push({ dayNumber: day + 1, focus: "", exercises: slice.map(normalizeRoutineExercise) });
  }

  return JSON.stringify({ name, days });
}

function readDaysPerWeek(context: unknown): number {
  const requested = (context as { routineRequest?: { daysPerWeek?: unknown } } | null)
    ?.routineRequest?.daysPerWeek;
  if (typeof requested !== "number" || !Number.isInteger(requested)) {
    return DEFAULT_DAYS_PER_WEEK;
  }
  return Math.min(7, Math.max(1, requested));
}

function normalizeRoutineExercise(raw: unknown): Record<string, unknown> {
  const exercise = (raw ?? {}) as Record<string, unknown>;
  return {
    exerciseId: typeof exercise.exerciseId === "string" ? exercise.exerciseId : "",
    ...(typeof exercise.exerciseName === "string" ? { exerciseName: exercise.exerciseName } : {}),
    sets: numberOr(exercise.sets, 3),
    repsMin: numberOr(exercise.repsMin, 8),
    repsMax: numberOr(exercise.repsMax, 12),
    restSeconds: numberOr(exercise.restSeconds, 90),
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// --------------------------------------------------------------------- streams

function sseFromText(text: string): ReadableStream<Uint8Array> {
  const frames: string[] = [];
  if (text) {
    frames.push(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
  }
  frames.push("data: [DONE]\n\n");

  const bytes = new TextEncoder().encode(frames.join(""));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function teeForUsage(response: Response): {
  stream: ReadableStream<Uint8Array>;
  usage: Promise<number | null>;
} {
  const body = response.body;
  if (!body) {
    const empty = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    return { stream: empty, usage: UNKNOWN_USAGE };
  }

  const [client, monitor] = body.tee();
  return { stream: client, usage: readUsage(monitor) };
}

async function readUsage(monitor: ReadableStream<Uint8Array>): Promise<number | null> {
  let tokens: number | null = null;
  try {
    const reader = monitor.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        tokens = parseUsageFrame(line) ?? tokens;
      }
    }
    tokens = parseUsageFrame(buffer) ?? tokens;
  } catch {
    // La contabilidad es opcional; la respuesta ya va en camino.
  }
  return tokens;
}

function parseUsageFrame(line: string): number | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const data = trimmed.slice(5).trim();
  if (data === "" || data === "[DONE]") return null;

  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== "object" || parsed === null) return null;
    const usage = (parsed as { usage?: { total_tokens?: unknown } }).usage;
    return typeof usage?.total_tokens === "number" ? usage.total_tokens : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------- context

function renderContextBlock(context: unknown): string {
  return JSON.stringify(context, null, 2);
}

function sanitizeAssistantContext(context: unknown): unknown {
  return context;
}
