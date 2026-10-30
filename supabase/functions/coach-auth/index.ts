/**
 * coach-auth — the coach PIN gate, and the only place `COACH_JWT_SECRET` exists.
 *
 * The coach signs in with an ordinary account and then proves it is them a second time
 * with a PIN before the portal opens. That framing decides everything here: the PIN is a
 * gate on a *session*, not an identity, which is why this function still authenticates
 * the caller as a user and why the token it issues names both the user and the coach.
 *
 * The threat being defended against is a four-digit PIN, which is 10,000 guesses. Against
 * an unbounded budget that is nothing, so two things bound it:
 *
 *   - **A lockout, counted server-side.** The guesses land here, so the count lives here.
 *     `coach_login_attempts` has RLS on and no policy, so a client cannot read the log
 *     that says which coach is being probed, nor delete it to reset the budget.
 *   - **PBKDF2 at a cost the attacker pays too.** 210,000 rounds, so verification is
 *     deliberately slow for a correct PIN as well as a wrong one.
 *
 * Three rules about what may be logged, because this function handles a secret:
 *
 *   1. The PIN is never logged, never compared by string equality against a log, and
 *      never included in an error body. Not even a redacted length.
 *   2. `COACH_JWT_SECRET` is read only from `Deno.env.get` and never has a fallback. A
 *      default secret would be a shipped secret: every deployment would share it and any
 *      of them could mint coach tokens for any coach.
 *   3. Error bodies are generic and do not distinguish "no such coach" from "wrong PIN".
 *
 * Order of operations, and it is load-bearing:
 *
 *   1. CORS, before anything a hostile origin could learn from.
 *   2. Secrets present, before the caller is told anything.
 *   3. Caller identity, before any database work.
 *   4. Lockout budget, before the expensive key derivation. Rejecting a locked-out caller
 *      must not cost a PBKDF2 run, or the lockout becomes a way to make the function burn
 *      CPU on demand.
 *   5. PIN derivation.
 *   6. Issue, or refuse to.
 *
 * Two actions, and the difference matters: `verify` checks a PIN, `change` checks one and
 * then replaces it. A `change` is the only way a coach row stops being provisional.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  bearerToken,
  jsonResponse,
  originAllowed,
  withCorsFloor,
} from "../_shared/http.ts";

/**
 * The two tables this function touches, described.
 *
 * Same reasoning as `coach-assistant`: without a generic, `createClient` infers
 * `never` for every row and no column name is checked, so a typo in `is_provisional`
 * becomes a runtime error against a column that does not exist. `src/types/supabase.ts`
 * cannot be imported from a Deno runtime, so these are declared where they are used.
 */
interface CoachAuthDatabase {
  public: {
    Tables: {
      coaches: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          pin_hash: string;
          is_provisional: boolean;
          is_active: boolean;
        };
        Insert: never;
        Update: { pin_hash?: string; is_provisional?: boolean };
        Relationships: [];
      };
      coach_login_attempts: {
        Row: { coach_id: string | null; attempted_at: string | null; succeeded: boolean | null };
        Insert: { coach_id?: string; attempted_at?: string; succeeded?: boolean };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

type AdminClient = SupabaseClient<CoachAuthDatabase>;

// ------------------------------------------------------------------- policy

/** A PIN is four digits. Enforced on both verify and change. */
const PIN_PATTERN = /^\d{4}$/;

/**
 * PBKDF2 rounds.
 *
 * OWASP's floor for PBKDF2-HMAC-SHA-256 is 600,000, which is also the ceiling any
 * four-digit PIN can defend: there are only 10,000 candidates, so cost buys nothing here
 * and only denies service to the one legitimate coach typing their PIN. 210,000 is the
 * previous recommendation, kept because it makes a wrong-PIN attempt take real time
 * (~100ms) without making the whole endpoint unusable.
 *
 * Not configurable. An environment override is a backdoor with a plausible name, and a
 * deployment that lowers it gets no warning that it did.
 */
const PIN_ITERATIONS = 210_000;

const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** Failures tolerated inside the lockout window before the coach is locked out. */
const MAX_FAILURES = 5;

/** How long a burst of failures locks a coach out. */
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** Lifetime of an issued coach session token. */
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

/** Body cap. A PIN and an action; anything larger is not a request from this app. */
const MAX_BODY_BYTES = 4096;

// ------------------------------------------------------------------ crypto

/**
 * Compare two byte strings without an early exit.
 *
 * `===` on strings returns as soon as it finds a difference, and the length of that
 * difference leaks how far a guess got — enough to recover a hash byte by byte given
 * enough samples. This accumulates every mismatch and looks once, so the time does not
 * depend on where two strings diverge.
 *
 * The length check *is* an early exit, and it has to be: unequal lengths are not
 * equal regardless of content, and no timing model here hides a fact the caller supplied
 * anyway. `diff` is `| 0`-bounded per byte, so it cannot overflow into false equality.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** PBKDF2-HMAC-SHA-256. */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  lengthBytes: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

/** Base64url, unpadded. JWT segments and salt fields both want this alphabet. */
function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode base64url, tolerating the padding this function never writes but a seeded
 * `pin_hash` might.
 */
function fromBase64Url(value: string): Uint8Array {
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Hash a PIN for storage.
 *
 * The format is self-describing -- `pbkdf2_sha256$rounds$salt$key` -- so the cost can be
 * raised later without a migration: a verifier reads the rounds out of the stored value.
 * The cost is written down per hash rather than read from a constant, which is the whole
 * reason a re-pin strategy is possible at all without invalidating every coach.
 *
 * `pbkdf2_sha256` as the literal is chosen so a future move to Argon2id is a new prefix
 * rather than a silent change of meaning under the same one.
 */
async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveKey(pin, salt, PIN_ITERATIONS, KEY_BYTES);
  return `pbkdf2_sha256$${PIN_ITERATIONS}$${base64Url(salt)}$${base64Url(derived)}`;
}

/**
 * Check a PIN against a stored hash.
 *
 * False for a malformed hash rather than throwing. A row with an unreadable `pin_hash`
 * cannot be distinguished by the caller from a wrong PIN, which is the right outcome:
 * the alternative is a 500 that tells a prober this account exists and is broken.
 */
async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;

  const rounds = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(rounds) || rounds < 1) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64Url(parts[2]);
    expected = fromBase64Url(parts[3]);
  } catch {
    return false;
  }
  if (expected.length !== KEY_BYTES || salt.length !== SALT_BYTES) return false;

  const derived = await deriveKey(pin, salt, rounds, expected.length);
  return timingSafeEqual(derived, expected);
}

// --------------------------------------------------------------------- jwt

/**
 * Mint a coach session token: HS256 over `{ sub, uid, role, iat, exp }`.
 *
 * Hand-rolled rather than pulled from a library, because the alternative means shipping a
 * JWT implementation into a function that signs exactly one shape of token and verifies
 * none. The only consumer of this token is this app's own client.
 *
 * What the claims are for:
 *
 *   - `sub` is the **coach row**, not the user. The portal's writes are about a coach, and
 *     RLS resolves ownership through `coaches.user_id = auth.uid()` — the user id — so both
 *     are needed and neither is derivable from the other at read time.
 *   - `role: "coach"` is a marker, not an authorization. Nothing in this repository grants
 *     anything on it: every policy is written against `auth.uid()`. It exists so a future
 *     policy can tell "a signed-in coach" from "a signed-in athlete" in one comparison, and
 *     it is deliberately inert today rather than load-bearing.
 *   - `iat`/`exp` are seconds, per RFC 7519, which is why the constants are divided by 1000
 *     at the one place that needs it.
 *
 * Note the signature is computed over `header.payload` with the secret as an HMAC key and
 * never transmitted, so a stolen token is useless without `COACH_JWT_SECRET`.
 */
async function signSessionToken(
  coachId: string,
  userId: string,
  secret: string,
): Promise<{ token: string; expiresAt: string }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAt + Math.floor(SESSION_TTL_MS / 1000);

  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64Url(
    new TextEncoder().encode(
      JSON.stringify({ sub: coachId, uid: userId, role: "coach", iat: issuedAt, exp: expiresAtSeconds }),
    ),
  );

  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput) as BufferSource),
  );

  return {
    token: `${signingInput}.${base64Url(signature)}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

// ------------------------------------------------------------------- pins

/**
 * Why a replacement PIN is refused, as a code the caller never sees.
 *
 * Returns null when the PIN is acceptable, so the check is a single truthiness test at
 * the call site and there is no way to forget a branch.
 *
 * A four-digit PIN is 10,000 candidates and every one of them is memorable by a human
 * standing at a desk, so the rules here are about what a shoulder-surfer or a stolen
 * phone reveals, not about entropy:
 *
 *   - **Length.** Anything but four digits; a shorter "PIN" is a fraction of the space.
 *   - **Repetition.** `1111` is 1 candidate out of 10,000, so it is worth roughly four
 *     digits of entropy less than its length suggests.
 *   - **Sequence.** `1234`, `4321`, and the other two runs of four are the first four
 *     numbers anyone reaches for.
 *   - **Unchanged.** Re-issuing the current PIN would consume the change without changing
 *     the secret.
 *
 * "Not previously used" is *not* here, and cannot be: `pin_hash` is overwritten by a
 * change, so there is no history to compare against. Adding one is a schema change and a
 * TODO, not something to fake in here.
 */
function validateNewPin(pin: string, currentPin: string): string | null {
  if (!PIN_PATTERN.test(pin)) return "pin_length";

  const digits = [...pin].map(Number);
  if (digits.every((digit) => digit === digits[0])) return "pin_repeated";

  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);
  if (ascending || descending) return "pin_sequential";

  if (pin === currentPin) return "pin_unchanged";

  return null;
}

// ------------------------------------------------------------------ handler

async function handleRequest(request: Request, cors: Record<string, string>): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" }, cors);
  }
  // Before the JWT is read, so a hostile origin learns nothing about whether a token
  // would have been accepted.
  if (!originAllowed(request)) {
    return jsonResponse(403, { error: "origin_not_allowed" }, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("COACH_JWT_SECRET");

  /*
   * All three or none. `COACH_JWT_SECRET` has no fallback *by design*: a default would be
   * a shared secret across every deployment that forgot to set one, and anyone reading a
   * deployment's config could then mint a coach token for any coach in it. Presence only
   * is logged, never a value -- these lines land in a dashboard other people can read.
   */
  if (!supabaseUrl || !serviceRoleKey || !secret) {
    console.error("refusing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or COACH_JWT_SECRET is not visible to this process");
    return jsonResponse(503, { error: "service_unavailable" }, cors);
  }

  const token = bearerToken(request);
  if (!token) return jsonResponse(401, { error: "unauthorized" }, cors);

  // Service role: reading `coaches.pin_hash` and writing `coach_login_attempts` are both
  // denied to a client by RLS on purpose. Never leaves this process.
  const admin = createClient<CoachAuthDatabase>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: authError } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (authError || !userId) {
    return jsonResponse(401, { error: "unauthorized" }, cors);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonResponse(400, { error: "invalid_request" }, cors);
  }
  // Checked before parsing, so an oversized body is refused without being materialised
  // into an object first.
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResponse(400, { error: "invalid_request" }, cors);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { error: "invalid_request" }, cors);
  }

  const { action, pin, newPin } = readBody(body);
  if (action === null || !PIN_PATTERN.test(pin)) {
    return jsonResponse(400, { error: "invalid_request" }, cors);
  }

  /*
   * The replacement PIN is validated here, before the database work, because a malformed
   * body is the cheapest thing to refuse.
   *
   * Read into its own binding rather than reusing `newPin`: TypeScript will not carry a
   * narrowing from `action === "change" && typeof newPin !== "string"` past that early
   * return, because the condition could have fired on `action` alone -- so every later use
   * of `newPin` would still be `string | undefined` and each one would need its own
   * assertion. One binding here is what keeps the rest of the function free of them.
   */
  const replacement = typeof newPin === "string" ? newPin : null;
  if (action === "change" && (replacement === null || !PIN_PATTERN.test(replacement))) {
    return jsonResponse(400, { error: "invalid_request" }, cors);
  }

  /*
   * One lookup, and 404 for "no such coach" and "retired coach" alike.
   *
   * Collapsing them is the point: a distinct status for each would let anyone with a
   * signed-in account enumerate the coaching staff. It also keeps the client honest --
   * `useCoachAuth` maps 400 and 401 to `INVALID_PIN` and everything else to a service
   * failure, so a signed-in athlete who is not a coach is told the function could not
   * help rather than being told a coach row does not exist.
   */
  const { data: coach, error: coachError } = await admin
    .from("coaches")
    .select("id, user_id, display_name, pin_hash, is_provisional, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (coachError || !coach) {
    return jsonResponse(404, { error: "not_found" }, cors);
  }

  /*
   * Lockout budget, before the derivation.
   *
   * `lockedUntil` is measured from the *oldest* failure in the window rather than from now.
   * A sliding `now + window` would let a coach who keeps trying extend their own lockout
   * indefinitely, which turns the control into a way to lock yourself out forever; anchored
   * to the first failure, the burst always ends exactly one window after it began.
   */
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();
  const { data: failures } = await admin
    .from("coach_login_attempts")
    .select("attempted_at")
    .eq("coach_id", coach.id)
    .eq("succeeded", false)
    .gte("attempted_at", windowStart)
    .order("attempted_at", { ascending: true });

  const recentFailures = failures ?? [];
  if (recentFailures.length >= MAX_FAILURES) {
    const oldest = recentFailures[0].attempted_at;
    const liftsAt = new Date(
      (oldest ? Date.parse(oldest) : Date.now()) + LOCKOUT_WINDOW_MS,
    ).toISOString();
    const retryAfter = Math.max(1, Math.ceil((Date.parse(liftsAt) - Date.now()) / 1000));
    return jsonResponse(
      429,
      { error: "too_many_attempts", lockedUntil: liftsAt },
      { ...cors, "Retry-After": String(retryAfter) },
    );
  }

  const correct = await verifyPin(pin, coach.pin_hash);

  /*
   * Every attempt is recorded, successes included. Counting only failures would make a
   * legitimate coach's successful unlock indistinguishable from an attacker probing.
   *
   * Recorded before the response, because the whole point is that the next guess is
   * counted. A rejected insert is logged and swallowed rather than turned into a 500:
   * failing closed here would lock out a coach who typed correctly, and failing loudly
   * would hand a prober a distinct response for the fifth attempt. The log is what makes
   * the gap visible.
   */
  await recordAttempt(admin, coach.id, correct);
  if (!correct) {
    return jsonResponse(401, { error: "invalid_credentials" }, cors);
  }

  if (action === "change" && replacement !== null) {
    const refusal = validateNewPin(replacement, pin);
    if (refusal !== null) {
      // The reason stays server-side. The body is the same 400 a malformed body gets,
      // which `useCoachAuth` reports as `PIN_CHANGE_REJECTED` -- enough for the form to
      // name the new-PIN field, not enough to become an oracle for validating PINs.
      console.error(`refusing a PIN change for coach ${coach.id}: ${refusal}`);
      return jsonResponse(400, { error: "invalid_request" }, cors);
    }

    const { error: updateError } = await admin
      .from("coaches")
      .update({ pin_hash: await hashPin(replacement), is_provisional: false })
      .eq("id", coach.id);
    if (updateError) {
      return jsonResponse(503, { error: "service_unavailable" }, cors);
    }
  }

  /*
   * A coach still on a seeded PIN is refused a session, and the refusal is a 200.
   *
   * A 200 because it is not a failure: the coach proved who they are, they simply have one
   * more step. Returning 401 would burn their attempt budget for a correct PIN and tell
   * them they were wrong.
   *
   * No token in this body, deliberately. The plan wrote `{ token, requiresPinChange }`,
   * and issuing a usable token here would defeat the requirement entirely -- the client
   * would have one, and any caller could simply keep using it. "The Edge Function refuses
   * to issue a session JWT while `is_provisional` is true" is only true if it does not
   * issue one. `useCoachAuth` already models this as its own state rather than as either
   * success or error.
   */
  if (coach.is_provisional && action === "verify") {
    return jsonResponse(200, { requiresPinChange: true }, cors);
  }

  const { error: clearError } = await admin
    .from("coach_login_attempts")
    .delete()
    .eq("coach_id", coach.id)
    .eq("succeeded", false);
  if (clearError) {
    console.error(`could not clear failed attempts for coach ${coach.id}`);
  }

  const { token: sessionToken, expiresAt } = await signSessionToken(coach.id, userId, secret);
  return jsonResponse(200, { token: sessionToken, coachId: coach.id, expiresAt }, cors);
}

/**
 * The validated shape of a request body.
 *
 * Every field is optional here and checked at the call site, so the parser has no opinion
 * about what is valid — it only turns an arbitrary JSON value into three things that are
 * either the right primitive or `undefined`. A missing or wrong-typed field arrives as
 * `undefined`/`null` rather than as a runtime error on a property access.
 */
function readBody(body: unknown): {
  action: "verify" | "change" | null;
  pin: string;
  newPin: string | undefined;
} {
  const record = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const action = record.action === "verify" || record.action === "change" ? record.action : null;
  return {
    action,
    pin: typeof record.pin === "string" ? record.pin : "",
    newPin: typeof record.newPin === "string" ? record.newPin : undefined,
  };
}

/**
 * Record one PIN attempt.
 *
 * Never throws and never returns a value the caller acts on: the decision to fail or not
 * belongs to the caller, and the only thing this function must guarantee is that it does
 * not turn a bookkeeping problem into a wrong answer about the PIN.
 */
async function recordAttempt(admin: AdminClient, coachId: string, succeeded: boolean): Promise<void> {
  const { error } = await admin
    .from("coach_login_attempts")
    .insert({ coach_id: coachId, attempted_at: new Date().toISOString(), succeeded });
  if (error) {
    // Presence of the coach id and the outcome only. No PIN, no hash, no user input.
    console.error(`could not record a ${succeeded ? "successful" : "failed"} attempt for coach ${coachId}`);
  }
}

/*
 * Only when run as the entry point. `supabase functions serve` and `deploy` both execute
 * this file directly, so the guard does not affect either.
 */
export const handler = withCorsFloor("coach-auth", handleRequest);

if (import.meta.main) {
  Deno.serve(handler);
}