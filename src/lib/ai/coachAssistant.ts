/**
 * coachAssistant.ts — the client's side of the assistant.
 *
 * Two shapes of the same call: a live stream in production, and a local mock when
 * there is no backend to call. The mock is not a fallback bolted on for convenience —
 * it is what makes the chat screen developable and testable at all, because a
 * streaming UI against a network call cannot be exercised without either a key or a
 * server. It is chosen by *environment*, never by failure: a 500 in production must
 * surface as an error, because silently answering from a fixture would show an
 * athlete fake training advice while they believe it is real.
 *
 * Everything here is defensive at the parsing layer. The stream format is a
 * provider's, not ours, and a model that emits prose where JSON was expected, or a
 * fence that never closes, has to degrade to plain text rather than take down the
 * screen. A chat that shows an unparseable message is a cosmetic bug; a chat that
 * throws mid-stream is a lost conversation.
 */

import { buildSystemContent } from "./coachPrompt";
import {
  CoachRequestError,
  isCoachAction,
  type CoachRequest,
  type CoachResponse,
  type CoachAction,
} from "./types";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type AssistantResponse = CoachResponse & {
  toolCalls?: ToolCall[];
};

type CoachRequestWithTools = CoachRequest & {
  tools?: unknown[];
  tool_choice?: unknown;
};

/** Longest user message the Edge Function will accept. Mirrored, not discovered. */
export const MAX_USER_MESSAGE_CHARS = 500;

/** Prior turns sent upstream. Keeps the prompt inside the model's attention. */
export const MAX_HISTORY_TURNS = 6;

/**
 * Fenced blocks, capturing the language tag so an action block can be recognised
 * even when its JSON is unusable.
 *
 * Matched tolerantly on purpose: a model asked for a fenced block routinely writes
 * ```action, ``` json, or ```ACTION. Requiring an exact fence is how a perfectly
 * good recommendation ends up invisible because of a space.
 */
const FENCE = /```([a-zA-Z]*)[ \t]*([\s\S]*?)```/g;

/** Tags that mean "this block was meant to be the structured action". */
const ACTION_TAGS = new Set(["", "action", "json"]);

/**
 * Splits a response into its prose and its structured action.
 *
 * Never throws. A malformed block, a block with no `type`, or a `type` this build
 * does not know all yield `action: undefined` — but the block is still removed from
 * the message, because a user who is shown raw JSON has learned nothing and a user
 * shown a failed recommendation can still act on the sentence above it.
 *
 * Scanning continues past a broken block: a model can emit a prose fence and then a
 * valid one, and abandoning the response at the first bad block would throw away a
 * correct recommendation.
 */
export function parseCoachAction(rawText: string): { message: string; action?: CoachAction } {
  // Reset the shared regex's lastIndex, which is sticky across calls on a /g pattern.
  FENCE.lastIndex = 0;

  const blocks = [...rawText.matchAll(FENCE)];
  let action: CoachAction | undefined;
  let stripIndex = -1;
  let firstActionBlock = -1;

  for (const [index, match] of blocks.entries()) {
    const tag = (match[1] ?? "").toLowerCase();
    const body = match[2]?.trim();
    const looksLikeAction = ACTION_TAGS.has(tag);
    if (looksLikeAction && firstActionBlock === -1) firstActionBlock = index;
    if (!body) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }

    if (isCoachAction(parsed)) {
      action = parsed;
      stripIndex = index;
      break;
    }
  }

  // No usable action. Still remove the first action-shaped block: it is a broken
  // payload the model meant for the app, not prose the athlete should have to read
  // past. An unrelated fence -- a code example, say -- is left alone.
  const removeAt = stripIndex === -1 ? firstActionBlock : stripIndex;

  let message = rawText;
  if (removeAt !== -1 && blocks[removeAt]) {
    message = message.replace(blocks[removeAt][0], "");
  }

  return { message: message.trim(), ...(action ? { action } : {}) };
}

/**
 * Holds back a fenced block until it is known to be complete.
 *
 * The reason this exists is that a stream cannot be un-sent. `parseCoachAction` runs on
 * the finished reply, so the action block was removed from the returned `message` but had
 * already been handed to `onChunk` fragment by fragment: the athlete watched the raw JSON
 * type itself into the bubble, and the block then vanished when the answer was replaced.
 * Stripping after the fact cannot fix that, so the block is not emitted in the first place.
 *
 * The cost is that a block delays its own text until its closing fence arrives. A block is
 * a few hundred characters, so the delay is a few hundred characters -- paid only while one
 * is open, and only for the block itself. Prose around it keeps streaming.
 *
 * The strip decision is `parseCoachAction`'s, applied to the block in isolation, so a caller
 * that concatenates everything `push` returned ends up with exactly the string
 * `parseCoachAction` would have returned for the whole reply. Two code paths that disagree
 * about what to hide would be a bug that only shows up on the frames where they differ.
 */
export function createActionBlockFilter(): {
  /** Text to show now, given a fragment. May be empty while a block is open. */
  push(fragment: string): string;
  /** Whatever is still held back. Call once, at end of stream. */
  flush(): string;
} {
  /** Everything received. Fences are found in here rather than per fragment. */
  let text = "";
  /** How much of `text` the caller has already been given. */
  let emittedUpTo = 0;
  /** Index of a fence whose closing fence has not arrived yet, or -1. */
  let holding = -1;

  const drain = (final: boolean): string => {
    let out = "";

    for (;;) {
      if (holding !== -1) {
        const close = text.indexOf(FENCE_TOKEN, holding + FENCE_TOKEN.length);
        if (close === -1) {
          if (!final) return out;
          /*
           * End of stream with a fence still open. `parseCoachAction` needs a closed block
           * to match, so it leaves this text in the message; emitting it keeps the streamed
           * text and the returned message identical instead of losing the tail.
           */
          out += text.slice(holding);
          emittedUpTo = text.length;
          return out;
        }

        const end = close + FENCE_TOKEN.length;
        const block = text.slice(holding, end);
        emittedUpTo = end;
        holding = -1;

        // A block this build does not read as an action block is the athlete's to see.
        if (parseCoachAction(block).message !== "") out += block;
        continue;
      }

      const open = text.indexOf(FENCE_TOKEN, emittedUpTo);
      if (open === -1) {
        /*
         * No fence here -- but the last one or two backticks may be the start of one whose
         * third backtick arrives in the next fragment. Emitting them would hide the opening
         * fence from this scan while the athlete could still see it, and the block would
         * stream through unfiltered. Two backticks is the most that can be held: three is a
         * fence, and any fence found here is handled by the branch above.
         *
         * Counted over the text *from* `emittedUpTo`, never over the whole of it. A
         * consumed block's own closing fence is still the tail of `text` while its
         * trailing prose has not arrived, and counting it there rewinds `emittedUpTo` to
         * before the fence just stripped -- at which point the closing fence is found again
         * as a new opening one and two stray backticks reach the athlete.
         *
         * `emittedUpTo` advances only over what was emitted, stopping short of the held
         * backticks: the next `push` re-scans them as part of the pending text, which is
         * how a fence split across two fragments is still seen as one fence.
         */
        const pending = text.slice(emittedUpTo);
        const trailing = TRAILING_BACKTICKS.exec(pending)?.[0].length ?? 0;
        const hold = Math.min(trailing, FENCE_TOKEN.length - 1);
        const safeEnd = text.length - hold;
        out += text.slice(emittedUpTo, safeEnd);
        emittedUpTo = safeEnd;
        return out;
      }

      // Text before the fence is prose, and streams as it arrives.
      out += text.slice(emittedUpTo, open);
      emittedUpTo = open;
      holding = open;
    }
  };

  return {
    push(fragment: string): string {
      if (fragment === "") return "";
      text += fragment;
      return drain(false);
    },
    flush(): string {
      return drain(true);
    },
  };
}

/** The fence delimiter. Same three characters the matching fence pattern uses. */
const FENCE_TOKEN = "```";

/** A run of backticks at the very end of the text received so far. */
const TRAILING_BACKTICKS = /`+$/;

// ------------------------------------------------------------------- request

/**
 * True when there is no backend to talk to and the mock should answer instead.
 *
 * Development builds with no `VITE_SUPABASE_URL` are exactly the case where a real
 * call cannot be made: `supabase.ts` throws on the missing pair, and an assistant
 * that cannot be reached is not a useful development experience.
 */
function shouldUseDevMock(): boolean {
  return import.meta.env.DEV === true && !import.meta.env.VITE_SUPABASE_URL;
}

/**
 * Asks the coach, streaming the answer as it arrives.
 *
 * `onChunk` is called with each fragment of the assistant's text, in order. The
 * returned `message` is the *complete* text with any action block removed, so a
 * caller that re-renders from the return value after streaming from `onChunk` gets
 * the same string either way.
 *
 * @throws {CoachRequestError} classified per {@link CoachError}.
 */
export async function askCoach(
  request: CoachRequestWithTools,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<AssistantResponse> {
  const message = request.userMessage.trim();

  // Validated before anything else, including the mock: an over-long message is a
  // client-side mistake, and reporting it locally is faster and more accurate than
  // spending a round trip to be told what the caller already knew.
  if (request.userMessage.length > MAX_USER_MESSAGE_CHARS) {
    throw new CoachRequestError({ code: "INPUT_TOO_LONG" });
  }

  if (shouldUseDevMock()) return mockAnswer(message, onChunk, signal);

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-assistant`;
  // Lets the function answer a CORS preflight from the app's own origin only.
  const origin = typeof window === "undefined" ? undefined : window.location.origin;

  const attempt = (token: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(origin ? { Origin: origin } : {}),
      },
       body: JSON.stringify({
        userMessage: message,
        context: request.context,
        conversationHistory: request.conversationHistory.slice(-MAX_HISTORY_TURNS * 2),
        ...(request.tools ? { tools: request.tools } : {}),
        ...(request.tool_choice ? { tool_choice: request.tool_choice } : {}),
      }),
      signal,
    });

  let response: Response;
  try {
    response = await attempt(await accessToken());

    /*
     * A 401 here is almost always an expired access token rather than a revoked
     * account: Supabase access tokens are short-lived, and the library refreshes them
     * on a timer that a suspended laptop or a backgrounded tab will have missed. The
     * refresh happens here so the athlete never sees it, and the retry reuses the
     * original question rather than asking them to send it again.
     *
     * Exactly one retry. A second 401 means the refresh itself did not produce a token
     * the function accepts, which is a real auth failure and is reported as one.
     */
    if (response.status === 401 && !signal?.aborted) {
      const refreshed = await refreshAccessToken();
      if (refreshed) response = await attempt(refreshed);
    }
  } catch (cause) {
    // An abort is the user's own doing, not a failure, and must not surface as a
    // network error in the transcript.
    if (isAbort(cause, signal)) throw cause;
    throw new CoachRequestError({
      code: "NETWORK_ERROR",
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }

  if (!response.ok) throw await classifyHttpError(response);

  return readStream(response, onChunk);
}

// ------------------------------------------------------------------- auth

/**
 * The Supabase client, or null when it cannot be built.
 *
 * Imported lazily because `@/lib/supabase` throws at module scope when the env vars
 * are absent, and {@link shouldUseDevMock} is precisely the case where they are. A
 * static import would take the whole module down and kill the development mock along
 * with it.
 */
async function supabaseClient(): Promise<SupabaseAuth | null> {
  try {
    const { supabase } = await import("@/lib/supabase");
    return supabase.auth as SupabaseAuth;
  } catch {
    return null;
  }
}

/** The slice of the auth client this module uses. */
interface SupabaseAuth {
  getSession(): Promise<{ data: { session: { access_token: string } | null } }>;
  refreshSession(): Promise<{
    data: { session: { access_token: string } | null };
    error: unknown;
  }>;
}

/**
 * The bearer token for the request.
 *
 * The **session access token**, not the anon key. The function resolves the caller
 * with `auth.getUser(token)`, which only accepts a user token -- the anon key is a
 * valid JWT that the gateway's signature check accepts and that `getUser` then
 * rejects, so sending it produced a 401 on every single call.
 *
 * Falls back to the anon key when there is no session at all, because the function's
 * 401 is what classifies the failure correctly; the alternative is a request with no
 * usable credential, which would fail at the gateway instead and read as a network
 * problem.
 */
async function accessToken(): Promise<string> {
  try {
    const auth = await supabaseClient();
    const { data } = (await auth?.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (token) return token;
  } catch {
    // Falls through to the anon key.
  }
  return import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
}

/**
 * A refresh in progress, shared by every caller that hits a 401 at the same time.
 *
 * Not a micro-optimisation. Two requests 401ing together -- the assistant's question
 * and a sync, say -- would each call `refreshSession()`, and Supabase may reuse the
 * same refresh token for both, so the second could arrive after the first consumed
 * it and invalidate the session it just obtained. One in-flight promise, one refresh.
 */
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const auth = await supabaseClient();
      if (!auth) return null;
      const { data, error } = await auth.refreshSession();
      if (error) return null;
      return data.session?.access_token ?? null;
    } catch {
      // A failed refresh is not an error here: the caller reports AUTH_ERROR either
      // way, and a thrown refresh would mask the real status with a network error.
      return null;
    }
  })();

  // Cleared on settle so the next expiry can refresh again. Held on a local reference
  // because assigning here would race the concurrent callers still awaiting it.
  void refreshInFlight.finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function isAbort(cause: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return cause instanceof Error && cause.name === "AbortError";
}

/**
 * Maps a non-OK response onto a classified error.
 *
 * The function's own body is never shown: it may name internal services, or -- worse
 * -- distinguish "the key is missing" from "your request was malformed", which is
 * free reconnaissance for anyone holding a token.
 */
async function classifyHttpError(response: Response): Promise<CoachRequestError> {
  if (response.status === 401) return new CoachRequestError({ code: "AUTH_ERROR" });
  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    return new CoachRequestError({
      code: "RATE_LIMITED",
      // A missing or unparseable header must not become `NaN`, which a countdown
      // would render as "NaN minutos".
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0,
    });
  }
  if (response.status === 503) return new CoachRequestError({ code: "SERVICE_UNAVAILABLE" });
  if (response.status === 400) return new CoachRequestError({ code: "INPUT_TOO_LONG" });
  return new CoachRequestError({ code: "SERVICE_UNAVAILABLE" });
}

/**
 * Reads a Server-Sent Events stream, emitting each text fragment.
 *
 * Assumes OpenRouter's OpenAI-compatible shape: `data: {json}` lines terminated by a
 * literal `data: [DONE]`. That assumption is isolated to this one function so that a
 * provider change is a one-place edit rather than a hunt through the app. Anything
 * unrecognised -- a differently-prefixed frame, a truncated tail, a JSON error
 * object mid-stream -- is skipped rather than thrown, because partial text is worth
 * more than none.
 */
async function readStream(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<AssistantResponse> {
  const body = response.body;
  if (!body) {
    const { message, action } = parseCoachAction(await response.text());
    if (message) onChunk(message);
    return { message, ...(action ? { action } : {}) };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let raw = "";
  let toolCalls: ToolCall[] = [];

  const filter = createActionBlockFilter();
  let shown = "";
  const emit = (fragment: string) => {
    if (!fragment) return;
    full += fragment;
    const safe = filter.push(fragment);
    if (!safe) return;
    shown += safe;
    onChunk(safe);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const decoded = decoder.decode(value, { stream: true });
    buffer += decoded;
    raw += decoded;

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "" || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice("data:".length).trim();
      if (data === "[DONE]") continue;

      const fragment = textFromFrame(data);
      if (fragment) emit(fragment);

      const parsedCalls = toolCallsFromFrame(data);
      if (parsedCalls) {
        for (const call of parsedCalls) {
          const existing = toolCalls.find((tc) => tc.id === call.id);
          if (existing) {
            existing.function.arguments += call.function.arguments;
          } else {
            toolCalls.push({ ...call });
          }
        }
      }
    }
  }

  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const fragment = textFromFrame(tail.slice("data:".length).trim());
    if (fragment) emit(fragment);
  }

  if (full === "" && raw.trim() !== "") {
    emit(raw.trim());
  }

  const held = filter.flush();
  if (held !== "") {
    shown += held;
    onChunk(held);
  }

  const { action } = parseCoachAction(full);
  return {
    message: shown.trim(),
    ...(action ? { action } : {}),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };
}

function toolCallsFromFrame(data: string): ToolCall[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const choices = (parsed as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const delta = (choices[0] as { delta?: { tool_calls?: ToolCall[] } } | undefined)?.delta;
  return delta?.tool_calls ?? null;
}

/** Pulls `choices[0].delta.content` out of one frame, or `""` if it is not there. */
function textFromFrame(data: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    // Not JSON: a comment line, a keep-alive, or a provider-specific frame.
    return "";
  }
  if (typeof parsed !== "object" || parsed === null) return "";
  const choices = (parsed as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const delta = (choices[0] as { delta?: { content?: unknown } } | undefined)?.delta;
  return typeof delta?.content === "string" ? delta.content : "";
}

// ---------------------------------------------------------------- dev mock

/**
 * Rotating development answers, each with a real action where one makes sense.
 *
 * Not random: a rotating list means the same prompt always gets the same answer, so a
 * screenshot or a failing assertion is reproducible. The progression advice is
 * plausible for a trained athlete because the *shape* of the feature matters during
 * development, and a mock that always says "hi" hides every layout bug.
 */
const DEV_RESPONSES: { message: string; action: CoachAction | null }[] = [
  {
    message:
      "Tu volumen de pierna lleva 2 semanas estancado. Agrega una serie de sentadilla la próxima sesión.",
    action: {
      type: "training_adjustment",
      field: "sets",
      delta: 1,
      reason: "Volumen bajo en pierna",
    },
  },
  {
    message: "Press de banca: completaste todas las reps la semana pasada. Sube 2.5 kg.",
    action: {
      type: "training_adjustment",
      field: "weight",
      delta: 2.5,
      reason: "Progresión lineal",
    },
  },
  {
    message:
      "Tu déficit calórico es demasiado agresivo para el volumen que estás haciendo. Sube 150 kcal.",
    action: {
      type: "calorie_adjustment",
      deltaKcal: 150,
      reason: "Déficit > 500 kcal en fase de volumen",
    },
  },
  {
    message:
      "Llevas 6 semanas de volumen continuo. Una semana de descarga va a ayudarte a recuperar y progresar mejor.",
    action: { type: "deload_suggestion", durationWeeks: 1, reason: "6 semanas sin descarga" },
  },
  {
    message:
      "Tu espalda está bien trabajada. El cuello de botella ahora es el bíceps — priorízalo en tu próxima sesión.",
    action: null,
  },
];

/** Advances one turn of the rotation. Module state so consecutive turns differ. */
let mockTurn = 0;

/** Words per streamed fragment, so the mock looks like typing without being one huge frame. */
const MOCK_CHUNK_WORDS = 3;

/** Milliseconds between fragments. Long enough to exercise the streaming UI. */
const MOCK_CHUNK_DELAY_MS = 24;

/**
 * The development answer, delivered in fragments so the streaming path is the one
 * under development rather than a special case.
 */
async function mockAnswer(
  message: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<CoachResponse> {
  // An empty question has no answer to give, and pretending otherwise would let a
  // blank input look like a working conversation.
  if (message === "") {
    throw new CoachRequestError({ code: "NETWORK_ERROR", message: "empty message" });
  }

  const preset = DEV_RESPONSES[mockTurn % DEV_RESPONSES.length];
  mockTurn += 1;

  const words = preset.message.split(" ");
  for (let i = 0; i < words.length; i += MOCK_CHUNK_WORDS) {
    if (signal?.aborted) throw new CoachRequestError({ code: "SERVICE_UNAVAILABLE" });
    // The trailing space of a non-final fragment keeps the joined text identical to
    // the preset; without it the transcript reads "laordinary".
    const isLast = i + MOCK_CHUNK_WORDS >= words.length;
    onChunk(words.slice(i, i + MOCK_CHUNK_WORDS).join(" ") + (isLast ? "" : " "));
    await delay(MOCK_CHUNK_DELAY_MS, signal);
  }

  return { message: preset.message, ...(preset.action ? { action: preset.action } : {}) };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Re-exported so a screen can render the prompt's context block without importing
 * two modules, and so the chat has one place to show what the model was told.
 */
export { buildSystemContent };