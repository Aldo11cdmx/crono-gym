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

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_USER_MESSAGE_CHARS,
  askCoach,
  parseCoachAction,
} from "./coachAssistant";
import { CoachRequestError, type AssistantContext, type CoachRequest } from "./types";

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

describe("askCoach failure classification", () => {
  it("maps 401 to an auth error", async () => {
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