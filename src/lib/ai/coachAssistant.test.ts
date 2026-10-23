/**
 * coachAssistant.test.ts
 *
 * The parser and the client's failure classification, both of which are places where
 * the app can be taken down by something outside its control.
 *
 * The streaming tests build real `Response` objects over real `ReadableStream`s with
 * deliberately awkward chunk boundaries -- a frame split across two reads, a frame
 * with no trailing newline, a non-JSON keep-alive -- because those are what actually
 * happen on a network, and a mock that only ever delivers whole lines passes against
 * a parser that would break in production.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_USER_MESSAGE_CHARS,
  askCoach,
  createActionBlockFilter,
  parseCoachAction,
} from "./coachAssistant";
import { CoachRequestError, type AssistantContext, type CoachRequest } from "./types";
import type { LocalStateRow } from "@/lib/profile/localState";

/*
 * The Supabase client and the local-state store sit behind dynamic imports inside
 * `coachAssistant`, so these are the seams that intercept them. Mocked for the whole
 * file rather than per test, because `vi.mock` is hoisted and a file cannot mix mocked
 * and unmocked imports of the same module.
 */
const { authMock, localStateMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    refreshSession: vi.fn(),
  },
  localStateMock: {
    loadLocalState: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth: authMock } }));
vi.mock("@/lib/profile/localState", () => ({ loadLocalState: localStateMock.loadLocalState }));

const CONTEXT: AssistantContext = {
  currentGoal: "volume",
  experienceLevel: "intermediate",
  recentPRs: [{ exercise: "Press de banca", weightKg: 75, reps: 5 }],
  weeklyVolume: { chest: 4 },
  availablePlates: [2.5, 5, 10, 20],
  barWeightKg: 20,
  bodyWeightKg: 61.4,
  currentMuscleRanks: { chest: "Plata" },
};

const request = (over: Partial<CoachRequest> = {}): CoachRequest => ({
  userMessage: "¿Subo peso en sentadilla?",
  context: CONTEXT,
  conversationHistory: [],
  ...over,
});

/** An SSE body from the given raw string, as the function would pipe it. */
function sseResponse(chunks: string[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" }, ...init });
}

/** One OpenRouter-style frame. */
const frame = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  /*
   * Defaults for every test in the file, because the client now reads the session
   * before it calls. `restoreMocks` in `vitest.config.ts` wipes implementations
   * between tests, so these are re-established each time rather than set once.
   */
  authMock.getSession.mockReset().mockResolvedValue({
    data: { session: { access_token: "session-token" } },
  });
  authMock.refreshSession.mockReset().mockResolvedValue({
    data: { session: { access_token: "refreshed-token" } },
    error: null,
  });
  localStateMock.loadLocalState.mockReset().mockResolvedValue(null);
});

// ------------------------------------------------------------- parseAction

describe("parseCoachAction", () => {
  it("extracts a well-formed action and strips it from the message", () => {
    const raw = [
      "Sube 2.5 kg la próxima sesión.",
      "```action",
      '{"type":"training_adjustment","field":"weight","delta":2.5,"reason":"Progresión lineal"}',
      "```",
    ].join("\n");

    const { message, action } = parseCoachAction(raw);
    expect(action).toEqual({
      type: "training_adjustment",
      field: "weight",
      delta: 2.5,
      reason: "Progresión lineal",
    });
    // The user must never see the JSON, even on success.
    expect(message).toBe("Sube 2.5 kg la próxima sesión.");
    expect(message).not.toContain("type");
  });

  it("returns no action when there is no block", () => {
    const { message, action } = parseCoachAction("Descansa bien esta semana.");
    expect(action).toBeUndefined();
    expect(message).toBe("Descansa bien esta semana.");
  });

  it("ignores malformed JSON and still returns the prose", () => {
    const raw = "Buenos días.\n```action\n{oops not json\n```";
    const { message, action } = parseCoachAction(raw);
    // A broken block must not cost the athlete the answer that preceded it.
    expect(action).toBeUndefined();
    expect(message).toBe("Buenos días.");
  });

  it("ignores a type this build does not know", () => {
    const raw = "Consulta a un médico.\n```action\n{\"type\":\"prescribe_medication\",\"x\":1}\n```";
    const { message, action } = parseCoachAction(raw);
    expect(action).toBeUndefined();
    expect(message).toBe("Consulta a un médico.");
  });

  it("finds the block at the start, the middle and the end", () => {
    const json = '{"type":"deload_suggestion","durationWeeks":1,"reason":"6 semanas"}';
    for (const raw of [
      `\`\`\`action\n${json}\n\`\`\`\n\n descansa.`,
      `Antes de nada:\n\`\`\`action\n${json}\n\`\`\`\n\ny después descansa.`,
      `descansa.\n\`\`\`action\n${json}\n\`\`\``,
    ]) {
      expect(parseCoachAction(raw).action, raw).toMatchObject({ type: "deload_suggestion" });
    }
  });

  it("accepts a plain or mis-cased fence", () => {
    // A model asked for ```action routinely writes ```json or ```ACTION. Requiring an
    // exact fence is how a correct recommendation ends up invisible.
    const json = '{"type":"calorie_adjustment","deltaKcal":150,"reason":"Déficit"}';
    expect(parseCoachAction(`\`\`\`json\n${json}\n\`\`\``).action).toMatchObject({
      type: "calorie_adjustment",
    });
    expect(parseCoachAction(`\`\`\`ACTION\n${json}\n\`\`\``).action).toMatchObject({
      type: "calorie_adjustment",
    });
  });

  it("keeps looking after a bad block and finds a good one", () => {
    const raw = [
      "Sube 2.5 kg.",
      "```action",
      "{not json",
      "```",
      "```action",
      '{"type":"training_adjustment","field":"weight","delta":2.5,"reason":"Ok"}',
      "```",
    ].join("\n");
    expect(parseCoachAction(raw).action).toMatchObject({ type: "training_adjustment" });
  });

  it("never throws on adversarial input", () => {
    for (const raw of [
      "",
      "```",
      "```action",
      "```action\n```",
      "```action\nnull\n```",
      "```action\n[]\n```",
      "```action\n{\"type\":null}\n```",
      "é".repeat(500),
    ]) {
      expect(() => parseCoachAction(raw), raw).not.toThrow();
      expect(parseCoachAction(raw).action, raw).toBeUndefined();
    }
  });

  it("does not leak state between calls", () => {
    // The regex is module-level and global; a sticky lastIndex would make the second
    // call return nothing depending on the first.
    const raw = '```action\n{"type":"deload_suggestion","durationWeeks":1,"reason":"x"}\n```';
    expect(parseCoachAction(raw).action).toBeTruthy();
    expect(parseCoachAction(raw).action).toBeTruthy();
    expect(parseCoachAction(raw).action).toBeTruthy();
  });
});

// --------------------------------------------------- createActionBlockFilter

describe("createActionBlockFilter", () => {
  const ACTION_BLOCK =
    '```action\n{"type":"training_adjustment","field":"weight","delta":2.5}\n```';

  /** Feeds `pieces` one at a time, exactly as a stream would, and joins what came out. */
  const run = (pieces: string[]): string => {
    const filter = createActionBlockFilter();
    return [...pieces.map((piece) => filter.push(piece)), filter.flush()].join("");
  };

  /** Every split of `text` into `count` pieces, so no boundary goes untested. */
  function everySplit(text: string, count: number): string[][] {
    if (count === 1) return [[text]];
    const out: string[][] = [];
    for (let i = 1; i < text.length; i += 1) {
      for (const rest of everySplit(text.slice(i), count - 1)) {
        out.push([text.slice(0, i), ...rest]);
      }
    }
    return out;
  }

  it("never emits an action block, whatever the fragment boundaries", () => {
    const raw = `Sube 2.5 kg.\n${ACTION_BLOCK}\nListo.`;
    const splits = everySplit(raw, 2).concat(everySplit(raw, 3));

    for (const pieces of splits) {
      const shown = run(pieces);
      expect(shown, pieces.join("|")).not.toContain("```");
      expect(shown, pieces.join("|")).not.toContain("training_adjustment");
      // And the prose around it is neither lost nor duplicated.
      expect(shown, pieces.join("|")).toBe(parseCoachAction(raw).message);
    }
  });

  it("keeps a fence the athlete is meant to read", () => {
    const raw = "Corre esto:\n```bash\nnpm run dev\n```\nY ya.";
    // A code block is not an action block; hiding every fence would hide the answer.
    expect(run([raw])).toBe(raw);
  });

  it("holds back a fence whose third backtick arrives in the next fragment", () => {
    // The failure this guards is subtle: emitting the first two backticks would let the
    // scan miss the fence they belong to, and the block would stream through unfiltered.
    expect(run(["Antes ``", "`action\n{\"type\":\"deload_suggestion\"}\n```"])).toBe(
      "Antes ",
    );
  });

  it("shows an unterminated fence rather than swallowing the tail", async () => {
    // `max_tokens` cuts a reply mid-block. `parseCoachAction` leaves an unclosed fence in
    // the message, so the filter must emit it too or the two disagree.
    const raw = "Sube 2.5 kg.\n```action\n{\"type\":\"deload";
    expect(run([raw])).toBe(raw);
    expect(run([raw])).toBe(parseCoachAction(raw).message);
  });

  it("drops a malformed action block too, since the athlete cannot act on it", () => {
    const raw = "Descansa.\n```action\n{oops\n```\nListo.";
    expect(run([raw])).toBe("Descansa.\n\nListo.");
  });

  it("emits nothing for an empty stream", () => {
    expect(run([])).toBe("");
    expect(createActionBlockFilter().push("")).toBe("");
  });
});

// ------------------------------------------------------------ askCoach

describe("askCoach validation", () => {
  it("rejects an over-long message before touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const long = "a".repeat(MAX_USER_MESSAGE_CHARS + 1);
    await expect(askCoach(request({ userMessage: long }), () => undefined)).rejects.toMatchObject(
      { detail: { code: "INPUT_TOO_LONG" } },
    );
    // Reported locally: the caller already knew, and a round trip would cost tokens.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a message of exactly the limit", async () => {
    const fetchMock = vi.fn(async () => sseResponse([frame("ok"), "data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);

    const atLimit = "a".repeat(MAX_USER_MESSAGE_CHARS);
    await expect(askCoach(request({ userMessage: atLimit }), () => undefined)).resolves.toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws CoachRequestError, so a caller cannot mistake it for a plain Error", async () => {
    const long = "a".repeat(MAX_USER_MESSAGE_CHARS + 1);
    await expect(askCoach(request({ userMessage: long }), () => undefined)).rejects.toBeInstanceOf(
      CoachRequestError,
    );
  });
});

describe("askCoach streaming", () => {
  it("emits each fragment and returns the assembled message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([frame("Sube "), frame("2.5 kg."), "data: [DONE]\n\n"]),
      ),
    );

    const chunks: string[] = [];
    const response = await askCoach(request(), (chunk) => chunks.push(chunk));

    expect(chunks).toEqual(["Sube ", "2.5 kg."]);
    expect(response.message).toBe("Sube 2.5 kg.");
  });

  it("reassembles a frame split across two reads", async () => {
    // What actually happens on a network: one SSE frame, two TCP reads. A parser
    // that consumed per-read would emit half a JSON object and drop the content.
    const encoder = new TextEncoder();
    const whole = frame("Hola");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(whole.slice(0, 12)));
        controller.enqueue(encoder.encode(whole.slice(12)));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { status: 200 })),
    );

    const chunks: string[] = [];
    const response = await askCoach(request(), (chunk) => chunks.push(chunk));
    expect(chunks).toEqual(["Hola"]);
    expect(response.message).toBe("Hola");
  });

  it("reads a final frame that has no trailing newline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([frame("sin newline")])));

    const chunks: string[] = [];
    await askCoach(request(), (chunk) => chunks.push(chunk));
    expect(chunks.join("")).toBe("sin newline");
  });

  it("skips keep-alives and non-JSON frames instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          ": ping\n\n",
          "event: message\n",
          frame("real"),
          "data: not-json\n\n",
          'data: {"choices":[]}\n\n',
          "data: [DONE]\n\n",
        ]),
      ),
    );

    const chunks: string[] = [];
    const response = await askCoach(request(), (chunk) => chunks.push(chunk));
    expect(chunks).toEqual(["real"]);
    expect(response.message).toBe("real");
  });

  it("parses an action out of the streamed text", async () => {
    const text =
      'Sube 2.5 kg.\n```action\n{"type":"training_adjustment","field":"weight","delta":2.5,"reason":"Ok"}\n```';
    // Deliberately split mid-word to prove the action survives reassembly.
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([frame(text.slice(0, 20)), frame(text.slice(20))])));

    const response = await askCoach(request(), () => undefined);
    expect(response.action).toMatchObject({ type: "training_adjustment", delta: 2.5 });
    expect(response.message).toBe("Sube 2.5 kg.");
  });

  it("never shows the action block to the athlete while it streams", async () => {
    /*
     * The regression this pins. `parseCoachAction` only runs on the finished reply, so
     * before the filter existed the raw JSON was handed to `onChunk` fragment by fragment
     * and the athlete watched it type itself into the bubble, only for it to be replaced
     * when the answer came back. Checking only `response.message` cannot see that: the
     * block was already on screen. So this asserts on the chunks, which is what the
     * bubble is actually made of.
     */
    const text =
      'Sube 2.5 kg.\n```action\n{"type":"training_adjustment","field":"weight","delta":2.5}\n```\nListo.';
    // One frame per character: the worst case for a filter that only looks within a
    // fragment, since the opening and closing fences are each split across three frames.
    const characters = [...text].map((character) => frame(character));
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(characters)));

    const chunks: string[] = [];
    const response = await askCoach(request(), (chunk) => chunks.push(chunk));
    const streamed = chunks.join("");

    expect(streamed).not.toContain("```");
    expect(streamed).not.toContain("training_adjustment");
    expect(response.action).toMatchObject({ type: "training_adjustment", delta: 2.5 });
    // The streamed text and the returned message are the same string, so re-rendering from
    // the return value after streaming cannot change what is on screen.
    expect(streamed.trim()).toBe(response.message);
    expect(response.message).toBe("Sube 2.5 kg.\n\nListo.");
  });

  it("falls back to the whole body when the response has no stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("texto plano", { status: 200 })),
    );

    const chunks: string[] = [];
    const response = await askCoach(request(), (chunk) => chunks.push(chunk));
    expect(response.message).toBe("texto plano");
    expect(chunks).toEqual(["texto plano"]);
  });

  it("caps the history it sends, keeping whole exchanges", async () => {
    // Parameters declared explicitly: a zero-arg mock infers a `[]` tuple, so
    // `calls[0][1]` would not typecheck and the assertion would need a cast that
    // hides the shape it is checking.
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      sseResponse([frame("ok")]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turno ${i}`,
    }));
    await askCoach(request({ conversationHistory: history }), () => undefined);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      conversationHistory: { content: string }[];
    };
    // 12 entries = 6 exchanges, not 12 turns: an odd cut would leave the model with
    // a reply and no question.
    expect(body.conversationHistory).toHaveLength(12);
    expect(body.conversationHistory.at(-1)?.content).toBe("turno 29");
  });
});

describe("an expired access token", () => {
  it("refreshes and retries, and the athlete never sees it", async () => {
    // The reported bug. A 401 from an expired token is not an account problem, and
    // answering it with "your session expired" strands someone whose session is fine.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(sseResponse([frame("Ya estás.")]));
    vi.stubGlobal("fetch", fetchMock);

    const chunks: string[] = [];
    const response = await askCoach(request(), (chunk) => chunks.push(chunk));

    // Resolved, not thrown: nothing in the transcript says anything about auth.
    expect(response.message).toBe("Ya estás.");
    expect(chunks).toEqual(["Ya estás."]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authMock.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("retries with the refreshed token, not the one that just expired", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(sseResponse([frame("ok")]));
    vi.stubGlobal("fetch", fetchMock);

    await askCoach(request(), () => undefined);

    const bearerOf = (call: number): string | null =>
      (fetchMock.mock.calls[call][1].headers as Record<string, string>).Authorization;

    expect(bearerOf(0)).toBe("Bearer session-token");
    expect(bearerOf(1)).toBe("Bearer refreshed-token");
  });

  it("resends the original question rather than asking for it again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(sseResponse([frame("ok")]));
    vi.stubGlobal("fetch", fetchMock);

    await askCoach(request({ userMessage: "¿subo peso?" }), () => undefined);

    // The retry replays the same body; the athlete typed it once.
    const bodyOf = (call: number): { userMessage: string } =>
      JSON.parse(fetchMock.mock.calls[call][1].body as string);
    expect(bodyOf(1).userMessage).toBe("¿subo peso?");
  });

  it("sends the session access token rather than the anon key", async () => {
    // The root cause underneath the reported bug. The anon key is a valid JWT the
    // gateway accepts and that `auth.getUser` then rejects, so sending it made every
    // single call 401 -- which made the app look like it was expiring constantly.
    // Parameters declared explicitly: a zero-arg mock infers a `[]` tuple, so
    // `mock.calls[0][1]` would not typecheck and asserting on a cast would hide the
    // shape being checked.
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      sseResponse([frame("ok")]),
    );
    vi.stubGlobal("fetch", fetchMock);

    await askCoach(request(), () => undefined);

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer session-token");
  });

  it("falls back to the anon key when there is no session at all", async () => {
    // Not to make the call succeed -- it will not -- but so the request carries a
    // credential the gateway will verify. That way the 401 comes from the function's
    // own auth check and classifies as AUTH_ERROR, instead of failing earlier and
    // reading as a network problem.
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response("", { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "AUTH_ERROR" },
    });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""}`);
  });

  it("gives up with AUTH_ERROR when the retry is refused too", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "AUTH_ERROR" },
    });
    // One retry, not a loop. A second 401 means the refresh produced a token the
    // function does not accept, which is a real failure rather than an expiry.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the refresh itself fails", async () => {
    authMock.refreshSession.mockResolvedValue({ data: { session: null }, error: {} });
    const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "AUTH_ERROR" },
    });
    // There is no new token to send, so a second call could only fail identically.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes once for two requests that expire together", async () => {
    // Supabase refresh tokens can be single-use. Two concurrent 401s each refreshing
    // would let the second arrive after the first consumed the token and invalidate
    // the very session it just produced.
    let release: (value: unknown) => void = () => undefined;
    authMock.refreshSession.mockImplementation(
      () => new Promise((resolve) => {
        release = resolve;
      }),
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      // A fresh stream per call, not one shared Response: a body can be read once, so
      // handing both retries the same object would fail with "ReadableStream is locked"
      // and tell us nothing about the single-flight behaviour under test.
      .mockImplementation(async () => sseResponse([frame("ok")]));
    vi.stubGlobal("fetch", fetchMock);

    const both = Promise.allSettled([
      askCoach(request(), () => undefined),
      askCoach(request(), () => undefined),
    ]);

    // Let both 401s land before the refresh resolves, so they genuinely overlap.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    release({
      data: { session: { access_token: "refreshed-token" } },
      error: null,
    });

    const results = await both;
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(authMock.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("does not retry once the athlete has aborted", async () => {
    // The abort is their own doing; spending a refresh on it would trade a real
    // session for nothing.
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      return new Response("", { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(askCoach(request(), () => undefined, controller.signal)).rejects.toBeDefined();
    expect(authMock.refreshSession).not.toHaveBeenCalled();
  });

  it("leaves a non-401 failure alone", async () => {
    // A 503 must not burn a refresh token: the session was fine and the provider was
    // not, and rotating the credential would turn a transient outage into a re-login.
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "SERVICE_UNAVAILABLE" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authMock.refreshSession).not.toHaveBeenCalled();
  });
});

describe("askCoach failure classification", () => {
  it("maps 401 to an auth error when the refresh cannot help", async () => {
    authMock.refreshSession.mockResolvedValue({ data: { session: null }, error: {} });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "AUTH_ERROR" },
    });
  });

  it("maps 429 with Retry-After into a millisecond countdown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 429, headers: { "Retry-After": "3600" } })),
    );
    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "RATE_LIMITED", retryAfterMs: 3_600_000 },
    });
  });

  it("never turns a missing Retry-After into NaN", async () => {
    // A countdown rendering "NaN minutos" is worse than no countdown.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "RATE_LIMITED", retryAfterMs: 0 },
    });
  });

  it("maps 503 to an unavailable service", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "SERVICE_UNAVAILABLE" },
    });
  });

  it("maps 400 to an over-long input", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 400 })));
    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "INPUT_TOO_LONG" },
    });
  });

  it("maps an unreachable host to a network error, with the cause", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "NETWORK_ERROR", message: "Failed to fetch" },
    });
  });

  it("propagates an abort without dressing it as a failure", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        if (init.signal?.aborted) {
          const error = new Error("aborted");
          error.name = "AbortError";
          throw error;
        }
        return sseResponse([frame("nunca")]);
      }),
    );

    // The user cancelling is not an error to render in the transcript.
    await expect(
      askCoach(request(), () => undefined, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not leak the function's error body to the caller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("OPENROUTER_API_KEY is not set", { status: 500 }),
      ),
    );

    const error = await askCoach(request(), () => undefined).catch((e: unknown) => e);
    // A distinguishable "the key is missing" from "your request was malformed" is
    // free reconnaissance for anyone holding a token.
    expect(JSON.stringify(error)).not.toContain("OPENROUTER");
  });
});

describe("local state gating", () => {
  const localFetch = () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      sseResponse([frame("ok"), "data: [DONE]\n\n"]),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("authorizes the context when consent is stored locally", async () => {
    localStateMock.loadLocalState.mockResolvedValue({
      flags: { aiEnabled: true },
      consent: { shareAiContext: true },
    } as LocalStateRow);
    const fetchMock = localFetch();

    await askCoach(request(), () => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      context: AssistantContext;
    };
    // With consent, the body carries the athlete's stored weight.
    expect(body.context.bodyWeightKg).toBe(CONTEXT.bodyWeightKg);
  });

  it("throws AI_DISABLED and never fetches when the flag is off", async () => {
    localStateMock.loadLocalState.mockResolvedValue({
      flags: { aiEnabled: false },
      consent: { shareAiContext: true },
    } as LocalStateRow);
    const fetchMock = localFetch();

    await expect(askCoach(request(), () => undefined)).rejects.toMatchObject({
      detail: { code: "AI_DISABLED" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to DEV consent when local state cannot be read", async () => {
    // An offline box or a wiped store is not a failure to render: local state must not
    // throw, and in DEV the request still goes through without stored consent.
    localStateMock.loadLocalState.mockRejectedValue(new Error("idb unavailable"));
    const fetchMock = localFetch();

    await askCoach(request(), () => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("strips sensitive context in production without consent", async () => {
    vi.stubEnv("DEV", false);
    localStateMock.loadLocalState.mockResolvedValue({
      flags: { aiEnabled: true },
      consent: { shareAiContext: false },
    } as LocalStateRow);
    const fetchMock = localFetch();

    await askCoach(request(), () => undefined);

    // Consent is denied, so none of the sensitive fields may reach the wire body.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      context: Record<string, unknown>;
    };
    expect(body.context).not.toHaveProperty("bodyWeightKg");
    expect(body.context).not.toHaveProperty("heightCm");
    expect(body.context).not.toHaveProperty("injuries");
    expect(body.context).not.toHaveProperty("daysPerWeek");
    expect(body.context).not.toHaveProperty("goal");
  });
});