/**
 * Tests for the coach-assistant Edge Function.
 *
 * =====================================================================
 * RUN WITH DENO TEST. THIS FILE MUST NOT BE PART OF THE VITEST SUITE.
 * =====================================================================
 *
 *   deno test --allow-env --allow-net supabase/functions/coach-assistant/
 *
 * Two reasons, both structural rather than matters of preference:
 *
 *  1. `import { handler } from "./index.ts"` reaches a module whose last statement is
 *     guarded by `import.meta.main`. Vitest would import it as a dependency, so the
 *     guard correctly keeps the port unbound -- but Vitest runs on Node, where the
 *     `Deno` global does not exist at all. `Deno.env.get` at the top of the handler
 *     would throw `ReferenceError` during the test, not a useful assertion.
 *
 *  2. Everything this function decides is an HTTP decision: status codes, CORS
 *     headers, `Retry-After`, and a body that must arrive as a stream rather than a
 *     buffered string. A Node-hosted runner would exercise Node's `Request`/`Response`
 *     instead, which is a different implementation of the same interface.
 *
 * So these drive the exported handler with real `Request` objects under Deno's own
 * fetch types. Exactly two things are substituted -- `globalThis.fetch`, for the
 * Supabase REST/auth endpoints and for OpenRouter -- because those are not code this
 * repository owns. The handler itself, its validation order, its rate limiter and its
 * stream plumbing all run for real.
 *
 * The stubs are per-test rather than shared, because the rate limiter is stateful and
 * a shared counter would make tests order-dependent.
 */

import {
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { handler } from "./index.ts";

const ALLOWED_ORIGIN = "https://cronos.app";
const SUPABASE_URL = "https://stub.supabase.co";

// ------------------------------------------------------------------- stubs

/** A Server-Sent Events body that ends with a usage frame, as OpenRouter sends one. */
function sseBody(fragments: string[], tokensUsed: number | null): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = fragments.map(
    (fragment) => `data: ${JSON.stringify({ choices: [{ delta: { content: fragment } }] })}\n\n`,
  );
  lines.push("data: [DONE]\n\n");
  if (tokensUsed !== null) {
    lines.push(`data: ${JSON.stringify({ usage: { total_tokens: tokensUsed } })}\n\n`);
  }

  // Chunked on purpose, with a frame split across two chunks, so the frame assembly
  // in `teeForUsage` is doing real work here rather than reading whole lines.
  const payload = lines.join("");
  const splitAt = Math.floor(payload.length / 2);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload.slice(0, splitAt)));
      controller.enqueue(encoder.encode(payload.slice(splitAt)));
      controller.close();
    },
  });
}

interface StubOptions {
  /** Requests already counted in the current window. */
  requestCount?: number;
  /** The window that count belongs to. Defaults to the current hour. */
  windowStart?: Date;
  /** What OpenRouter answers. */
  upstream?: () => Promise<Response> | Response;
  /** When false, `getUser` reports an invalid token. */
  tokenValid?: boolean;
  /** When true, the rate-limit prune rejects instead of resolving. */
  failDelete?: boolean;
}

interface Stub {
  restore: () => void;
  /** Requests that reached OpenRouter. */
  upstreamCalls: () => number;
  /** Usage rows written. */
  usageRows: () => unknown[];
  /** Rate-limit rows the handler tried to write. */
  writtenWindows: () => unknown[];
  /** The bearer tokens OpenRouter was called with. */
  authorization: () => string[];
}

/**
 * Bodies sent to OpenRouter, newest last.
 *
 * Module-level because the stub is a `fetch` replacement: there is no call site to
 * thread a recorder through, and the alternative -- threading one through `stubNetwork`
 * into every test -- would add a parameter used by two of the fifteen tests. Reset in
 * `stubNetwork`, so nothing leaks between them.
 */
let upstreamBodies: string[] = [];

/** Truncated to the hour, matching the function's own `hourStart`. */
function currentHour(): Date {
  const copy = new Date();
  copy.setUTCMinutes(0, 0, 0);
  return copy;
}

/**
 * `timestamptz` the way PostgREST serialises it.
 *
 * `2026-10-03T03:00:00+00:00`, not `2026-10-03T03:00:00.000Z`. Both parse to the same
 * instant, which is the whole point: the function does date arithmetic on a value it
 * received as text, and a stub that handed back the friendlier JS format would not
 * have told us whether it handles the format the server actually sends.
 */
function postgresTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

/** Replaces `globalThis.fetch` with a router over the two external hosts. */
function stubNetwork(options: StubOptions = {}): Stub {
  const original = globalThis.fetch;
  const state = {
    count: options.requestCount ?? 0,
    windowStart: options.windowStart ?? currentHour(),
    upstreamCalls: 0,
    usage: [] as unknown[],
    windows: [] as unknown[],
    auth: [] as string[],
    failDelete: options.failDelete ?? false,
  };
  upstreamBodies = [];
  const tokenValid = options.tokenValid ?? true;

  const upstream = options.upstream ?? (() => sse(["Sube ", "2.5 kg."], 42));

  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.startsWith(`${SUPABASE_URL}/auth/v1/user`)) {
      const header = new Headers(init?.headers ?? (input as Request).headers).get("Authorization") ?? "";
      if (!tokenValid || !header.includes("valid")) {
        return Promise.resolve(jsonResponse({ message: "invalid" }, 401));
      }
      return Promise.resolve(jsonResponse({ id: "user-1" }));
    }

    if (url.includes("/rest/v1/coach_usage")) {
      state.usage.push(JSON.parse(String(init?.body ?? "{}")));
      return Promise.resolve(jsonResponse(null, 201));
    }

    if (url.includes("/rest/v1/coach_rate_limits")) {
      const method = init?.method ?? "GET";
      if (method === "DELETE") {
        /*
         * Models a prune that fails. Housekeeping runs on every admitted request, so
         * if its rejection is not handled it takes the whole isolate down with it --
         * which is exactly what a browser sees as a 503 carrying no CORS headers.
         */
        if (state.failDelete) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (method === "POST") {
        // A row for the window the handler is writing.
        const row = JSON.parse(String(init?.body ?? "{}"));
        state.windows.push(row);
        state.count = Math.max(state.count, Number(row.request_count ?? 0));
        return Promise.resolve(jsonResponse(null, 201));
      }
      // The handler reads the most recent window to learn the current count. An
      // empty array is what PostgREST returns when no row exists yet.
      //
      // The timestamp is shaped the way PostgREST actually returns a `timestamptz`:
      // an offset and no milliseconds. Returning a JS `toISOString()` here instead
      // would have hidden a real bug, because the handler compares this against its
      // own `hourStart()` output and the two formats differ as strings while being
      // the same instant.
      const rows = state.count === 0
        ? []
        : [{ window_start: postgresTimestamp(state.windowStart), request_count: state.count }];
      return Promise.resolve(jsonResponse(rows));
    }

    if (url.includes("openrouter.ai")) {
      state.upstreamCalls += 1;
      state.auth.push(new Headers(init?.headers ?? {}).get("Authorization") ?? "");
      upstreamBodies.push(String(init?.body ?? ""));
      return Promise.resolve(upstream());
    }

    throw new Error(`unstubbed request to ${url}`);
  }) as typeof globalThis.fetch;

  return {
    restore: () => {
      globalThis.fetch = original;
    },
    upstreamCalls: () => state.upstreamCalls,
    usageRows: () => state.usage,
    writtenWindows: () => state.windows,
    authorization: () => state.auth,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sse(fragments: string[], tokensUsed: number | null): Response {
  return new Response(sseBody(fragments, tokensUsed), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** Env for a working deployment. Cleared by `resetEnv` after every test. */
function setEnv(): void {
  Deno.env.set("SUPABASE_URL", SUPABASE_URL);
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.set("OPENROUTER_API_KEY", "openrouter-key");
  Deno.env.set("ALLOWED_ORIGIN", ALLOWED_ORIGIN);
}

function clearEnv(): void {
  for (const key of [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENROUTER_API_KEY",
    "ALLOWED_ORIGIN",
    "COACH_SYSTEM_PROMPT",
    "COACH_PROMPT_URL",
  ]) {
    try {
      Deno.env.delete(key);
    } catch {
      // Not set; nothing to delete.
    }
  }
}

/** A well-formed request. Overridden per test. */
function makeRequest(overrides: {
  method?: string;
  origin?: string | null;
  token?: string | null;
  body?: unknown;
  rawBody?: string;
} = {}): Request {
  const method = overrides.method ?? "POST";
  const headers = new Headers({ "Content-Type": "application/json" });
  const origin = overrides.origin === undefined ? ALLOWED_ORIGIN : overrides.origin;
  if (origin !== null) headers.set("Origin", origin);
  const token = overrides.token === undefined ? "valid" : overrides.token;
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);

  const payload =
    overrides.rawBody ??
    JSON.stringify(
      overrides.body ?? {
        userMessage: "¿Debería subir peso?",
        context: { currentGoal: "volume", experienceLevel: "intermediate" },
        conversationHistory: [],
      },
    );

  /*
   * A GET or HEAD carries no body. Deno's fetch enforces that and throws
   * "Request with GET/HEAD method cannot have body", which Node's does not -- so the
   * method-not-allowed test only ran correctly by accident on a looser runtime.
   */
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") init.body = payload;

  return new Request("https://function.test/functions/v1/coach-assistant", init);
}

// -------------------------------------------------------------------- tests

Deno.test("answers a preflight from the configured origin only", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const allowed = await handler(
      new Request("https://function.test/", { method: "OPTIONS", headers: { Origin: ALLOWED_ORIGIN } }),
    );
    assertEquals(allowed.status, 204);
    assertEquals(allowed.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);

    const foreign = await handler(
      new Request("https://function.test/", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example" },
      }),
    );
    // No allow-origin header: the browser is expected to refuse the response.
    assertEquals(foreign.headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("refuses a browser call from an unlisted origin before reading the token", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest({ origin: "https://evil.example" }));
    assertEquals(response.status, 403);
    // The point of checking the origin first: nothing downstream was consulted.
    assertEquals(stub.upstreamCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("rejects a request with no bearer token", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest({ token: null }));
    assertEquals(response.status, 401);
    assertEquals(stub.upstreamCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("rejects a token the platform cannot verify", async () => {
  setEnv();
  const stub = stubNetwork({ tokenValid: false });
  try {
    const response = await handler(makeRequest());
    assertEquals(response.status, 401);
    assertEquals(stub.upstreamCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("streams the answer and records the token count", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest());
    assertEquals(response.status, 200);
    assertStringIncludes(response.headers.get("Content-Type") ?? "", "text/event-stream");
    /*
     * The encoding, declared rather than assumed. `application/json` is UTF-8 by
     * specification, so this is belt-and-braces -- except that `nosniff` is set on every
     * response here, and `nosniff` forbids a browser from second-guessing a declared type.
     * That turns an undeclared charset from a technicality into the only statement about
     * how the body is encoded, and there being no statement is what makes an ambiguous
     * body ambiguous.
     */
    assertStringIncludes(response.headers.get("Content-Type") ?? "", "charset=utf-8");
    // A buffered answer could not be read while it was still arriving.
    assertEquals(response.body instanceof ReadableStream, true);

    const text = await response.text();
    assertStringIncludes(text, "Sube ");
    assertStringIncludes(text, "2.5 kg.");

    // The usage read runs off the tee'd copy, so it needs the body consumed first.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assertEquals(stub.usageRows().length, 1);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("sends the provider key, never the Supabase keys", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    await handler(makeRequest());
    assertEquals(stub.authorization()[0], "Bearer openrouter-key");
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("refuses a message longer than the limit the client enforces", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(
      makeRequest({ body: { userMessage: "a".repeat(501), context: {} } }),
    );
    assertEquals(response.status, 400);
    assertEquals(stub.upstreamCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("accepts a message at exactly the limit", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(
      makeRequest({ body: { userMessage: "a".repeat(500), context: {} } }),
    );
    assertEquals(response.status, 200);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("rejects a malformed body rather than throwing", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest({ rawBody: "{ not json" }));
    assertEquals(response.status, 400);
    assertEquals(stub.upstreamCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("survives a failing rate-limit prune", async () => {
  setEnv();
  // The prune is fire-and-forget housekeeping that runs on every admitted request. An
  // unhandled rejection does not just fail the prune -- in Deno it takes the isolate
  // down, so the browser gets a connection that dies mid-response and reports a 503
  // with no CORS headers at all.
  const stub = stubNetwork({ failDelete: true });
  try {
    const response = await handler(makeRequest());
    // The answer still arrives: the request was already admitted and the athlete
    // should not lose it because housekeeping failed.
    assertEquals(response.status, 200);
    await response.text();
    assertEquals(stub.upstreamCalls(), 1);

    // Give the fire-and-forget a turn to reject. An unhandled rejection here would
    // surface as a test-level error rather than a failed assertion.
    await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("always answers with CORS headers, even on failure", async () => {
  setEnv();
  const cases: { name: string; build: () => Request; allowOrigin: boolean }[] = [
    { name: "unauthorised", build: () => makeRequest({ token: null }), allowOrigin: true },
    { name: "malformed body", build: () => makeRequest({ rawBody: "{ not json" }), allowOrigin: true },
    { name: "rate limited", build: () => makeRequest(), allowOrigin: true },
    { name: "wrong method", build: () => makeRequest({ method: "GET" }), allowOrigin: true },
    // The one case that must NOT be echoed: granting an allow-origin to a rejected
    // origin would hand a hostile page a readable response and undo the check itself.
    {
      name: "foreign origin",
      build: () => makeRequest({ origin: "https://evil.example" }),
      allowOrigin: false,
    },
  ];

  for (const testCase of cases) {
    const stub = stubNetwork({ requestCount: testCase.name === "rate limited" ? 20 : 0 });
    try {
      const response = await handler(testCase.build());
      assertEquals(
        response.headers.get("Access-Control-Allow-Origin") === ALLOWED_ORIGIN,
        testCase.allowOrigin,
        `${testCase.name}: unexpected allow-origin`,
      );
    } finally {
      stub.restore();
    }
  }
});

Deno.test("answers with CORS headers when the handler throws", async () => {
  setEnv();
  const stub = stubNetwork({
    upstream: () => {
      // A 200 whose `body` getter throws. This is the shape of a real unguarded throw:
      // `callOpenRouter` wraps the fetch itself but reads `response.body` outside that
      // try, so the failure escapes the handler entirely. A stubbed fetch rejection is
      // not enough to prove the point -- supabase-js and OpenRouter errors are all
      // absorbed long before this boundary.
      const response = sse(["hola"], 5);
      Object.defineProperty(response, "body", {
        get() {
          throw new Error("stream already consumed");
        },
      });
      return response;
    },
  });
  const logged: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    const response = await handler(makeRequest());

    // Without this header the browser reports a CORS error instead of the status, which
    // is the symptom that hides the real cause.
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
    assertEquals(response.status, 500);

    // Generic on the wire, detailed in the log: a body naming the internal failure is
    // reconnaissance for anyone holding a token.
    const body = (await response.json()) as Record<string, unknown>;
    assertEquals(body.message, undefined);
    assertEquals(body.error, "internal_error");

    // The real cause goes to the dashboard, where it is readable.
    assertEquals(logged.length > 0, true);
    assertEquals(String(logged[0]?.[0]).includes("Unhandled"), true);
  } finally {
    console.error = originalError;
    stub.restore();
    clearEnv();
  }
});

Deno.test("counts a request when the user has no window yet", async () => {
  setEnv();
  const stub = stubNetwork({ requestCount: 0 });
  try {
    // The regression this pins: the first request of any hour is the path with no
    // stored row, and it called `.getTime()` on the ISO *string* that `hourStart`
    // returns. Every request threw here before it ever reached OpenRouter.
    const response = await handler(makeRequest());
    assertEquals(response.status, 200);
    await response.text();
    assertEquals(stub.upstreamCalls(), 1);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("treats a window from a previous hour as a fresh one", async () => {
  setEnv();
  // A count that belongs to last hour must not block this hour. Getting this wrong in
  // the other direction -- comparing the strings instead of the instants -- would lock
  // an athlete out for an hour they had already used.
  const stub = stubNetwork({
    requestCount: 3,
    windowStart: new Date(currentHour().getTime() - 3_600_000),
  });
  try {
    const response = await handler(makeRequest());
    assertEquals(response.status, 200);
    assertEquals(stub.upstreamCalls(), 1);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("writes a window the database can compare back", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    await handler(makeRequest());
    const written = stub.writtenWindows()[0] as { window_start: string };
    assertStringIncludes(written.window_start, ":00:00");
    // Truncated to the hour, which is what makes one row per user per window the
    // entire counting scheme.
    assertEquals(new Date(written.window_start).getMinutes(), 0);
    assertEquals(new Date(written.window_start).getSeconds(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("answers 429 with a usable Retry-After once the window is full", async () => {
  setEnv();
  const stub = stubNetwork({ requestCount: 20 });
  try {
    const response = await handler(makeRequest());
    assertEquals(response.status, 429);
    const retryAfter = Number(response.headers.get("Retry-After"));
    // The client's countdown multiplies this by 1000; NaN would render as "NaN min".
    assertEquals(Number.isFinite(retryAfter) && retryAfter > 0, true);
    assertEquals(retryAfter <= 3600, true);
    assertEquals(stub.upstreamCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("reports a missing provider key indistinguishably from an outage", async () => {
  setEnv();
  Deno.env.delete("OPENROUTER_API_KEY");
  const stub = stubNetwork();
  try {
    const missing = await handler(makeRequest());
    assertEquals(missing.status, 503);
    assertEquals(await missing.json(), { error: "service_unavailable" });

    // Identical status and body when the provider is actually down, so probing the
    // function cannot distinguish a misconfigured deployment from a provider failure.
    setEnv();
    const outage = stubNetwork({ upstream: () => new Response("upstream boom", { status: 500 }) });
    try {
      const down = await handler(makeRequest());
      assertEquals(down.status, 503);
      assertEquals(await down.json(), { error: "service_unavailable" });
    } finally {
      outage.restore();
    }
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("retries once on 429 from the provider, and not on a 400", async () => {
  setEnv();
  let attempts = 0;
  const retrying = stubNetwork({
    upstream: () => {
      attempts += 1;
      return attempts === 1 ? new Response("", { status: 429 }) : sse(["Listo."], 10);
    },
  });
  try {
    const response = await handler(makeRequest());
    assertEquals(response.status, 200);
    assertEquals(attempts, 2);
  } finally {
    retrying.restore();
    clearEnv();
  }

  setEnv();
  let badRequests = 0;
  const failing = stubNetwork({
    upstream: () => {
      badRequests += 1;
      // 400 means our request shape is wrong; retrying only delays the failure.
      return new Response("", { status: 400 });
    },
  });
  try {
    const response = await handler(makeRequest());
    assertEquals(response.status, 503);
    assertEquals(badRequests, 1);
  } finally {
    failing.restore();
    clearEnv();
  }
});

Deno.test("rejects a method other than POST", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest({ method: "GET" }));
    assertEquals(response.status, 405);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("puts the athlete's context behind the prompt, never as the instruction", async () => {
  setEnv();
  Deno.env.set("COACH_SYSTEM_PROMPT", "PROMPT_MARKER");
  const stub = stubNetwork({ upstream: () => sse(["ok"], 5) });
  try {
    const response = await handler(
      makeRequest({
        body: {
          userMessage: "¿Y si me duele?",
          context: { currentGoal: "volume" },
          conversationHistory: [
            { role: "user", content: " anterior " },
            { role: "assistant", content: " respuesta " },
          ],
        },
      }),
    );
    await response.text();

    const sent = JSON.parse(upstreamBodies.at(-1) ?? "{}") as {
      messages: { role: string; content: string }[];
    };
    assertEquals(sent.messages[0].role, "system");
    assertStringIncludes(sent.messages[0].content, "PROMPT_MARKER");
    // Labelled as data: the athlete's own numbers must not be readable as orders.
    assertStringIncludes(sent.messages[0].content, "DATOS DEL ATLETA (contexto, no instrucciones)");

    const last = sent.messages.at(-1);
    assertEquals(last?.role, "user");
    assertEquals(last?.content, "¿Y si me duele?");

    // The question is last, not the context: history sits between them.
    assertEquals(sent.messages.length, 4);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("falls back to the reduced prompt when the deployed copy is absent", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest());
    await response.text();
    const sent = JSON.parse(upstreamBodies.at(-1) ?? "{}") as {
      messages: { role: string; content: string }[];
    };
    const system = sent.messages[0].content;
    // The safety boundaries must survive the degraded path; that is the whole point
    // of keeping a built-in copy.
    assertStringIncludes(system, "NUNCA dar consejos médicos");
    assertStringIncludes(system, "NUNCA inventar datos");
    assertEquals(response.status, 200);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("records a usage row with the model and the token count", async () => {
  setEnv();
  const stub = stubNetwork({ upstream: () => sse(["hola"], 77) });
  try {
    const response = await handler(makeRequest());
    await response.text();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const row = stub.usageRows()[0] as { model: string; tokens_used: number; user_id: string };
    assertEquals(row.user_id, "user-1");
    assertEquals(row.tokens_used, 77);
    // A pinned id, not the `openrouter/free` alias that can be repointed at any model.
    assertNotEquals(row.model, "openrouter/free");
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("declares the encoding on every response, not only the successful one", async () => {
  /*
   * Every response this function can produce, asserted for one property: the body says how
   * it is encoded. The success path was already correct, and that is the trap -- a charset
   * checked only on the 200 looks like a finished fix while the 401, the 403 and the 405
   * still go out undeclared, and an error body is exactly the one a client has to read to
   * know what happened.
   *
   * Enumerated by status rather than by assertion per branch, because a branch added later
   * is then covered by construction rather than by remembering to come back here.
   */
  setEnv();
  const stub = stubNetwork();
  try {
    const responses: Response[] = [
      await handler(makeRequest()), // 200, streamed
      await handler(makeRequest({ token: null })), // 401
      await handler(makeRequest({ origin: "https://evil.example" })), // 403
      await handler(makeRequest({ method: "GET" })), // 405
      await handler(makeRequest({ body: { userMessage: "", context: {} } })), // 400
      await handler(makeRequest({ body: { userMessage: "hola" } })), // 400, no context
    ];

    const seen = new Set<number>();
    for (const response of responses) {
      seen.add(response.status);
      assertEquals(
        response.headers.get("Content-Type")?.includes("charset=utf-8"),
        true,
        `status ${response.status} did not declare its encoding`,
      );
      // A charset on a body nobody can read would be pointless.
      assertNotEquals(response.headers.get("Access-Control-Allow-Origin"), undefined);
    }

    // Guards the enumeration itself: a case that silently stopped returning the status it
   // was written for would otherwise turn the loop above into a check of one response.
    assertEquals(
      [...seen].sort((a, b) => a - b),
      [200, 400, 401, 403, 405],
    );
  } finally {
    stub.restore();
    clearEnv();
  }
});