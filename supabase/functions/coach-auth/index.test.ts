/**
 * Tests for the coach-auth Edge Function.
 *
 * =====================================================================
 * RUN WITH DENO TEST. THIS FILE MUST NOT BE PART OF THE VITEST SUITE.
 * =====================================================================
 *
 *   deno test --no-check --allow-env --allow-net supabase/functions/coach-auth/
 *   deno check supabase/functions/coach-auth/index.ts
 *
 * `--no-check` is not optional and not a shortcut: `deno test` typechecks by default, and
 * typechecking this file from the repository root makes Deno resolve `npm:@types/node`
 * (it injects that dependency whenever a root `package.json` is present) against a
 * `node_modules` that does not contain it. The failure is a module-resolution error that
 * says nothing about this code. So the two commands are split, which is what
 * `supabase/functions/deno.json` already prescribes: `deno check` for types, `deno test`
 * for behaviour.
 *
 * Same reasoning as `coach-assistant/index.test.ts` for the runtime. Everything this
 * function decides is an HTTP decision -- status codes, CORS headers, `Retry-After`,
 * whether a token was issued at all -- and `Request`/`Response` under Node is a different
 * implementation of the same interface. Exactly one thing is substituted:
 * `globalThis.fetch`, because Supabase's REST and auth endpoints are not code this
 * repository owns. The handler, its ordering, the key derivation, the lockout arithmetic
 * and the token all run for real.
 *
 * The PIN hashes in here are built by {@link pinHash}, which re-implements the stored
 * format rather than importing the function's own hash. That is deliberate: importing it
 * would make "verify accepts what hash writes" true by construction, and a format that
 * disagrees with its own writer would not be caught.
 */

import {
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { handler } from "./index.ts";
import { withCorsFloor } from "../_shared/http.ts";

const ALLOWED_ORIGIN = "https://cronos.app";
const SUPABASE_URL = "https://stub.supabase.co";
const JWT_SECRET = "test-coach-jwt-secret";

/** Mirrors `PIN_ITERATIONS` in the function. Changing one without the other fails loudly. */
const PIN_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

const COACH_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

// ------------------------------------------------------------------- helpers

/**
 * Build a `pin_hash` in the format the function expects.
 *
 * Memoised per PIN value: one derivation is ~100ms at the production iteration count, and
 * several tests want a hash of the same PIN. The cache is keyed by the PIN itself and
 * lives only for the process, which is why this is not a security problem.
 */
const hashCache = new Map<string, Promise<string>>();

function pinHash(pin: string): Promise<string> {
  const cached = hashCache.get(pin);
  if (cached !== undefined) return cached;

  const pending = (async () => {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(pin),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PIN_ITERATIONS },
      material,
      KEY_BYTES * 8,
    );
    const encode = (bytes: Uint8Array): string => {
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };
    return `pbkdf2_sha256$${PIN_ITERATIONS}$${encode(salt)}$${encode(new Uint8Array(bits))}`;
  })();

  hashCache.set(pin, pending);
  return pending;
}

/** The payload of a JWT, verified against the secret as part of the same assertion. */
async function decodeToken(
  token: string,
): Promise<{ claims: Record<string, number | string>; signatureValid: boolean }> {
  const [header, payload, signature] = token.split(".");
  const toBytes = (segment: string): Uint8Array => {
    const standard = segment.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(standard + "=".repeat((4 - (standard.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureValid = await crypto.subtle.verify(
    "HMAC",
    key,
    toBytes(signature) as BufferSource,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  return {
    claims: JSON.parse(new TextDecoder().decode(toBytes(payload))) as Record<string, number | string>,
    signatureValid,
  };
}

interface CoachRow {
  id: string;
  user_id: string;
  display_name: string;
  pin_hash: string;
  is_provisional: boolean;
  is_active: boolean;
}

interface StubOptions {
  /** The coach row this user owns, or null for a user who is not a coach. */
  coach?: CoachRow | null;
  /** Failed attempts already recorded inside the lockout window, oldest first. */
  failures?: { attempted_at: string }[];
  /** When false, `getUser` reports an invalid token. */
  tokenValid?: boolean;
  /** When true, the auth endpoint throws instead of answering. */
  failAuth?: boolean;
  /** When true, the coach update fails. */
  failUpdate?: boolean;
}

interface Stub {
  restore: () => void;
  /** Requests that reached Supabase at all, auth included. */
  calls: () => number;
  /** Requests that reached a table. Zero means no database work was done. */
  restCalls: () => number;
  /** Attempt rows the handler tried to insert. */
  inserts: () => unknown[];
  /** Coach updates the handler tried to write. */
  updates: () => unknown[];
  /** Whether a delete of failed attempts was issued. */
  cleared: () => boolean;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Replaces `globalThis.fetch` with a router over Supabase's auth and REST endpoints. */
function stubNetwork(options: StubOptions = {}): Stub {
  const original = globalThis.fetch;
  const coach = options.coach === undefined ? null : options.coach;
  const state = {
    calls: 0,
    rest: 0,
    inserts: [] as unknown[],
    updates: [] as unknown[],
    cleared: false,
  };

  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(SUPABASE_URL)) {
      throw new Error(`unstubbed request to ${url}`);
    }
    state.calls += 1;
    const method = init?.method ?? "GET";

    if (url.includes("/auth/v1/user")) {
      if (options.failAuth === true) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      const tokenValid = options.tokenValid ?? true;
      if (!tokenValid) return Promise.resolve(jsonResponse({ message: "invalid" }, 401));
      return Promise.resolve(jsonResponse({ id: USER_ID }));
    }

    if (url.includes("/rest/v1/coaches")) {
      state.rest += 1;
      if (method === "PATCH") {
        if (options.failUpdate === true) {
          return Promise.resolve(jsonResponse({ message: "boom" }, 500));
        }
        state.updates.push(JSON.parse(String(init?.body ?? "{}")));
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      // `maybeSingle` sends Accept: application/vnd.pgrst.object+json when a single row
      // is expected, but PostgREST answers a list regardless unless told otherwise, and
      // supabase-js unwraps either. An array keeps the stub on the path supabase-js uses.
      return Promise.resolve(jsonResponse(coach === null ? [] : [coach]));
    }

    if (url.includes("/rest/v1/coach_login_attempts")) {
      state.rest += 1;
      if (method === "POST") {
        state.inserts.push(JSON.parse(String(init?.body ?? "{}")));
        return Promise.resolve(jsonResponse(null, 201));
      }
      if (method === "DELETE") {
        state.cleared = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse(options.failures ?? []));
    }

    throw new Error(`unstubbed request to ${url}`);
  }) as typeof globalThis.fetch;

  return {
    restore: () => {
      globalThis.fetch = original;
    },
    calls: () => state.calls,
    restCalls: () => state.rest,
    inserts: () => state.inserts,
    updates: () => state.updates,
    cleared: () => state.cleared,
  };
}

function setEnv(): void {
  Deno.env.set("SUPABASE_URL", SUPABASE_URL);
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.set("COACH_JWT_SECRET", JWT_SECRET);
  Deno.env.set("ALLOWED_ORIGIN", ALLOWED_ORIGIN);
}

function clearEnv(): void {
  for (const key of [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "COACH_JWT_SECRET",
    "ALLOWED_ORIGIN",
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

  // GET and HEAD may not carry a body -- `new Request` throws for them -- and the method
  // check is one of the things under test, so the request has to be constructible.
  const bodyless = method === "GET" || method === "HEAD";
  const init: RequestInit = { method, headers };
  if (!bodyless) {
    init.body = overrides.rawBody ?? JSON.stringify(overrides.body ?? { action: "verify", pin: "4817" });
  }

  return new Request("https://functions.example/coach-auth", init);
}

/** A coach row holding `pin`, active and not provisional unless overridden. */
async function coachWith(
  pin: string,
  overrides: Partial<CoachRow> = {},
): Promise<CoachRow> {
  return {
    id: COACH_ID,
    user_id: USER_ID,
    display_name: "Coach",
    pin_hash: await pinHash(pin),
    is_provisional: false,
    is_active: true,
    ...overrides,
  };
}

/** Collects `console.error` output for the duration of `run`. */
async function captureConsole(run: () => Promise<void>): Promise<string> {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => {
    lines.push(args.map((arg) => (arg instanceof Error ? arg.stack ?? arg.message : String(arg))).join(" "));
  };
  try {
    await run();
  } finally {
    console.error = original;
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------- CORS

Deno.test("answers a preflight with a 204 and no body", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest({ method: "OPTIONS" }));

    assertEquals(response.status, 204);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
    assertEquals(await response.text(), "");
    // A preflight is answered before any credential is read, so nothing was requested.
    assertEquals(stub.calls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("rejects a method other than POST", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest({ method: "GET" }));

    assertEquals(response.status, 405);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
    assertEquals(stub.calls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("refuses a foreign origin before reading the token", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest({ origin: "https://evil.example" }));

    assertEquals(response.status, 403);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), null);
    // Nothing was learned about whether the token would have been accepted.
    assertEquals(stub.calls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("allows a request with no Origin, which is not a browser", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817") });
  try {
    const response = await handler(makeRequest({ origin: null }));

    assertEquals(response.status, 200);
  } finally {
    stub.restore();
    clearEnv();
  }
});

// ----------------------------------------------------------------- secrets

Deno.test("refuses to serve without COACH_JWT_SECRET rather than falling back", async () => {
  setEnv();
  Deno.env.delete("COACH_JWT_SECRET");
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest());

    assertEquals(response.status, 503);
    // Refused before any credential was checked and before any request was made: a
    // deployment missing its secret must not look like a working one.
    assertEquals(stub.calls(), 0);
    // The body must not say which secret was missing.
    assertEquals((await response.json()).error, "service_unavailable");
  } finally {
    stub.restore();
    clearEnv();
  }
});

// ------------------------------------------------------------------- caller

Deno.test("rejects a request with no bearer token", async () => {
  setEnv();
  const stub = stubNetwork();
  try {
    const response = await handler(makeRequest({ token: null }));

    assertEquals(response.status, 401);
    assertEquals(stub.calls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("rejects a token the auth service will not accept", async () => {
  setEnv();
  const stub = stubNetwork({ tokenValid: false });
  try {
    const response = await handler(makeRequest());

    assertEquals(response.status, 401);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("404s a user who owns no active coach row", async () => {
  setEnv();
  const stub = stubNetwork({ coach: null });
  try {
    const response = await handler(makeRequest());

    assertEquals(response.status, 404);
    // Not a PIN verdict: nothing was recorded, because there is no coach to record against.
    assertEquals(stub.inserts().length, 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("404s a retired coach exactly as it 404s an absent one", async () => {
  setEnv();
  const stub = stubNetwork({ coach: null });
  let absentStatus = 0;
  try {
    absentStatus = (await handler(makeRequest())).status;
  } finally {
    stub.restore();
  }

  /*
   * The query filters `is_active`, so a retired coach returns no row and the handler
   * cannot tell it from an athlete. Asserted against the absent case rather than against a
   * literal, so widening the query later breaks this test rather than quietly turning
   * staff status into an enumeration oracle.
   */
  assertEquals(absentStatus, 404);
});

// ------------------------------------------------------------------ lockout

Deno.test("locks a coach out on the fifth recent failure", async () => {
  setEnv();
  const oldest = new Date(Date.now() - 14 * 60 * 1000).toISOString();
  const stub = stubNetwork({
    coach: await coachWith("4817"),
    failures: [
      { attempted_at: oldest },
      { attempted_at: oldest },
      { attempted_at: oldest },
      { attempted_at: oldest },
      { attempted_at: oldest },
    ],
  });
  try {
    const response = await handler(makeRequest());

    assertEquals(response.status, 429);
    // No attempt recorded: a locked-out coach is not spending guesses.
    assertEquals(stub.inserts().length, 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("anchors lockedUntil to the oldest failure, not to now", async () => {
  setEnv();
  const oldest = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const stub = stubNetwork({
    coach: await coachWith("4817"),
    failures: Array.from({ length: 5 }, () => ({ attempted_at: oldest })),
  });
  try {
    const response = await handler(makeRequest());
    const payload = (await response.json()) as { lockedUntil: string };

    // Ten minutes ago plus the fifteen-minute window. A sliding `now + 15min` would report
    // twenty-five minutes out and would let repeated attempts postpone the release forever.
    const expected = Date.parse(oldest) + 15 * 60 * 1000;
    assertEquals(Math.abs(Date.parse(payload.lockedUntil) - expected), 0);

    // And the header agrees, because the client falls back to it.
    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    assertEquals(Math.abs(retryAfter - Math.ceil((expected - Date.now()) / 1000)) <= 1, true);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("does not lock out below the failure budget", async () => {
  setEnv();
  const stub = stubNetwork({
    coach: await coachWith("4817"),
    failures: Array.from({ length: 4 }, () => ({ attempted_at: new Date().toISOString() })),
  });
  try {
    const response = await handler(makeRequest({ body: { action: "verify", pin: "4817" } }));

    // Four failures are one short of the budget, so the correct PIN is still served.
    assertEquals(response.status, 200);
    assertEquals((stub.inserts()[0] as { succeeded: boolean }).succeeded, true);
  } finally {
    stub.restore();
    clearEnv();
  }
});

// ----------------------------------------------------------------- the PIN

Deno.test("issues a four-hour session token for a correct PIN", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817") });
  try {
    const response = await handler(makeRequest({ body: { action: "verify", pin: "4817" } }));
    const payload = (await response.json()) as { token: string; coachId: string; expiresAt: string };

    assertEquals(response.status, 200);
    assertEquals(payload.coachId, COACH_ID);

    const { claims, signatureValid } = await decodeToken(payload.token);
    assertEquals(signatureValid, true, "token must be signed with COACH_JWT_SECRET");
    assertEquals(claims.sub, COACH_ID, "sub is the coach row, not the user");
    assertEquals(claims.uid, USER_ID);
    assertEquals(claims.role, "coach");
    assertEquals((claims.exp as number) - (claims.iat as number), 4 * 60 * 60);

    // And the client is told the same instant the token itself claims.
    assertEquals(Date.parse(payload.expiresAt), (claims.exp as number) * 1000);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("rejects a wrong PIN, records the attempt, and issues nothing", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817") });
  try {
    const response = await handler(makeRequest({ body: { action: "verify", pin: "0000" } }));
    const payload = (await response.json()) as Record<string, unknown>;

    assertEquals(response.status, 401);
    assertEquals(payload.token, undefined);
    assertEquals(stub.inserts().length, 1);
    assertEquals((stub.inserts()[0] as { succeeded: boolean }).succeeded, false);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("records a successful attempt too, and clears the failures", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817") });
  try {
    await handler(makeRequest({ body: { action: "verify", pin: "4817" } }));

    // Successes are recorded, so a legitimate coach is distinguishable from a prober.
    assertEquals((stub.inserts()[0] as { succeeded: boolean }).succeeded, true);
    assertEquals(stub.cleared(), true);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("never writes a PIN to the log, on any path", async () => {
  setEnv();
  const wrong = stubNetwork({ coach: await coachWith("4817") });
  try {
    const log = await captureConsole(async () => {
      await handler(makeRequest({ body: { action: "verify", pin: "0000" } }));
    });

    assertEquals(log.includes("0000"), false);
    assertEquals(log.includes("4817"), false);
    // The hash is a secret too: it is an offline verifier for the PIN.
    assertEquals(log.includes((await pinHash("4817")).split("$")[3]), false);
  } finally {
    wrong.restore();
    clearEnv();
  }
});

Deno.test("clears a provisional coach's PIN by asking for a change, not a session", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817", { is_provisional: true }) });
  try {
    const response = await handler(makeRequest({ body: { action: "verify", pin: "4817" } }));
    const payload = (await response.json()) as Record<string, unknown>;

    // A 200, not a 401: the PIN was right, and telling the coach otherwise would burn
    // their attempt budget for a correct guess.
    assertEquals(response.status, 200);
    assertEquals(payload.requiresPinChange, true);
    // No token. A token here would make the forced change advisory.
    assertEquals(payload.token, undefined);
    assertEquals(stub.updates().length, 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

// -------------------------------------------------------------- PIN change

Deno.test("changes the PIN, clears provisional, and issues a session", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817", { is_provisional: true }) });
  try {
    const response = await handler(
      makeRequest({ body: { action: "change", pin: "4817", newPin: "2694" } }),
    );
    const payload = (await response.json()) as { token: string; requiresPinChange?: boolean };

    assertEquals(response.status, 200);
    assertNotEquals(payload.token, undefined);
    assertEquals(payload.requiresPinChange, undefined);

    const update = stub.updates()[0] as { pin_hash: string; is_provisional: boolean };
    assertEquals(update.is_provisional, false);
    // A different hash from the seeded one, in the documented format, and not the PIN.
    assertEquals(update.pin_hash.includes("pbkdf2_sha256$"), true);
    assertEquals(update.pin_hash.includes("2694"), false);
    assertNotEquals(update.pin_hash, (await pinHash("4817")));
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("refuses a weak replacement PIN with the same 400 as a malformed body", async () => {
  for (const newPin of ["1234", "4321", "1111", "2345", "4817"]) {
    setEnv();
    const stub = stubNetwork({ coach: await coachWith("4817") });
    try {
      const response = await handler(
        makeRequest({ body: { action: "change", pin: "4817", newPin } }),
      );
      const payload = (await response.json()) as Record<string, unknown>;

      assertEquals(response.status, 400, `expected ${newPin} to be refused`);
      // Deliberately indistinguishable from a bad request: an oracle that explained *why*
      // would validate candidate PINs for anyone who could call it.
      assertEquals(payload.error, "invalid_request");
      assertEquals(stub.updates().length, 0);
      assertEquals(payload.token, undefined);
    } finally {
      stub.restore();
      clearEnv();
    }
  }
});

Deno.test("refuses to change a PIN without the current one", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817") });
  try {
    const response = await handler(
      makeRequest({ body: { action: "change", pin: "0000", newPin: "2694" } }),
    );

    assertEquals(response.status, 401);
    // Nothing was written: the current PIN was never proven.
    assertEquals(stub.updates().length, 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("reports a failed PIN write as a service failure, not a wrong PIN", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817"), failUpdate: true });
  try {
    const response = await handler(
      makeRequest({ body: { action: "change", pin: "4817", newPin: "2694" } }),
    );

    // 503, so `useCoachAuth` reports SERVICE_UNAVAILABLE. A 401 here would send the coach
    // to retype a PIN that was always right.
    assertEquals(response.status, 503);
  } finally {
    stub.restore();
    clearEnv();
  }
});

// ------------------------------------------------------------------- bodies

Deno.test("refuses a body it cannot parse", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817") });
  try {
    const response = await handler(makeRequest({ rawBody: "{not json" }));

    assertEquals(response.status, 400);
    // The caller was authenticated, so one call was made; no table was touched.
    assertEquals(stub.restCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("refuses an action it does not implement", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817") });
  try {
    const response = await handler(makeRequest({ body: { action: "delete", pin: "4817" } }));

    assertEquals(response.status, 400);
    assertEquals(stub.restCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

Deno.test("refuses a PIN that is not four digits", async () => {
  for (const pin of ["123", "12345", "abcd", "12 4", ""]) {
    setEnv();
    const stub = stubNetwork({ coach: await coachWith("4817") });
    try {
      const response = await handler(makeRequest({ body: { action: "verify", pin } }));

      assertEquals(response.status, 400, `expected ${JSON.stringify(pin)} to be refused`);
      assertEquals(stub.restCalls(), 0);
    } finally {
      stub.restore();
      clearEnv();
    }
  }
});

Deno.test("refuses an oversized body before materialising it", async () => {
  setEnv();
  const stub = stubNetwork({ coach: await coachWith("4817") });
  try {
    const response = await handler(
      makeRequest({ rawBody: JSON.stringify({ action: "verify", pin: "4817", pad: "x".repeat(5000) }) }),
    );

    assertEquals(response.status, 400);
    assertEquals(stub.restCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});

// ------------------------------------------------------------- CORS floor

/*
 * These three test the floor through `withCorsFloor` directly rather than by making this
 * function throw, and the reason is worth stating because it is not a shortcut.
 *
 * supabase-js catches a rejected `fetch` and returns it as `{ error }` on the result, so a
 * transport failure arriving at `getUser` arrives as a *value* and this handler turns it
 * into a 401. Every HTTP-layer problem is therefore already classified, and there is no
 * network stub in this file that can produce the unhandled throw the floor exists for --
 * which is a real property of the code, tested by the last of the three below.
 *
 * So the floor is tested where it lives: as the shared wrapper `handler` is built from.
 */

Deno.test("the CORS floor answers a throw with a classified 500 that carries CORS headers", async () => {
  setEnv();
  const guarded = withCorsFloor("test-fn", () => Promise.reject(new Error("boom")));
  const log = await captureConsole(async () => {
    const response = await guarded(
      new Request("https://functions.example/coach-auth", { headers: { Origin: ALLOWED_ORIGIN } }),
    );

    /*
     * The whole reason the floor exists. `Deno.serve` would answer this rejection with a
     * bare 500 and no CORS headers, which the browser reports as "no
     * Access-Control-Allow-Origin header is present" -- a CORS error that hides both the
     * status and the cause, and points the investigation at the wrong layer entirely.
     */
    assertEquals(response.status, 500);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
    assertEquals((await response.json()).error, "internal_error");
  });

  // The cause reaches the dashboard, which is the other half of the contract.
  assertStringIncludes(log, "test-fn");
  assertStringIncludes(log, "boom");

  clearEnv();
});

Deno.test("the CORS floor does not leak an internal message into its body", async () => {
  const guarded = withCorsFloor("test-fn", () =>
    Promise.reject(new Error("postgres://user:hunter2@db.internal/prod failed"))
  );
  let body = "";
  await captureConsole(async () => {
    body = await (
      await guarded(new Request("https://functions.example/coach-auth"))
    ).text();
  });

  assertEquals(body.includes("hunter2"), false);
  assertEquals(body.includes("db.internal"), false);
  assertEquals(body.includes("internal_error"), true);
});

Deno.test("an unreachable auth endpoint is a 401, not an unhandled failure", async () => {
  setEnv();
  const stub = stubNetwork({ failAuth: true });
  try {
    const response = await handler(makeRequest());

    // Documents the property the two tests above depend on: supabase-js turns a rejected
    // fetch into `{ error }`, so this never reaches the floor as a throw. If that ever
    // changes, this test fails here rather than the floor silently becoming unreachable.
    assertEquals(response.status, 401);
    assertEquals(stub.restCalls(), 0);
  } finally {
    stub.restore();
    clearEnv();
  }
});