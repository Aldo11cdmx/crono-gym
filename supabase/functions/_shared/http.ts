/**
 * The HTTP boundary shared by every Edge Function in this repository.
 *
 * Five things, all of them things that are wrong in a different way when written twice:
 *
 *   - `ALLOWED_ORIGIN` is read from the environment rather than defaulted to `*`.
 *   - The CORS headers a browser needs and the body helper that attaches them.
 *   - Origin admission.
 *   - Bearer-token extraction.
 *   - A floor under the handler so a thrown error still carries CORS headers.
 *
 * The last one is the reason this file exists at all. `Deno.serve` answers a thrown
 * handler with a bare 500 carrying no CORS headers, and the browser reports that as
 * "no Access-Control-Allow-Origin header is present" -- a CORS error, which sends the
 * investigation to the wrong layer and hides both the status code and the cause. That
 * was learned the hard way in `coach-assistant`, so it is structural here: every
 * function gets the floor by wrapping its logic in {@link withCorsFloor}, and the
 * failure mode cannot be reintroduced by forgetting to copy a try/catch.
 *
 * Nothing here knows what any particular function does. A function that needs a
 * different origin policy passes its own; a function that streams does not use
 * {@link jsonResponse} for its success path.
 *
 * Every `Content-Type` this file writes carries an explicit `charset=utf-8`. It is
 * redundant for `application/json`, which is UTF-8 by specification, and it is kept
 * anyway for two reasons that are not about redundancy. It states the encoding next to
 * the bytes it describes, so a reader -- a proxy, a `fetch` in a client, a human with
 * `curl` -- never has to infer it. And `X-Content-Type-Options: nosniff` is set on
 * every response below: that header forbids a browser from second-guessing a declared
 * type, which makes an undeclared charset a real ambiguity rather than a technicality.
 */

/**
 * The single origin this repository's functions answer for.
 *
 * Read from the environment rather than set to `*`. With a bearer-token API a wildcard
 * lets any page on the internet make a signed-in user's browser spend their quota,
 * and the response would be readable there too. The value is the app's deployed origin,
 * so a preview deploy has to add its own.
 */
export function allowedOrigin(): string | null {
  return Deno.env.get("ALLOWED_ORIGIN") ?? null;
}

/**
 * The `Content-Type` of a JSON response, with its encoding declared.
 *
 * Exported so that a function writing a response by hand -- rather than through
 * {@link jsonResponse} -- declares the encoding the same way instead of inventing a
 * second spelling. The `nosniff` header that {@link corsHeaders} attaches is what makes
 * this worth having: with sniffing forbidden, the declared charset is the only statement
 * about how the body is encoded, so leaving it off is leaving the encoding undeclared.
 */
export const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/**
 * The headers every response carries, including error responses.
 *
 * Echoing the configured origin rather than `*`, and only when it matches: the browser
 * compares the echoed value against its own origin, and an `Access-Control-Allow-Origin`
 * that does not match is treated as absent. Sending it unconditionally would be
 * harmless but dishonest -- it would assert an origin match that never happened.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedOrigin();
  const allow = origin && origin !== "*" ? origin : "";
  const requestOrigin = request.headers.get("Origin") ?? "";

  return {
    ...(allow && requestOrigin === allow ? { "Access-Control-Allow-Origin": allow } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    // Deny caching of an answer that was paid for and is user-specific.
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

/**
 * Whether the browser origin is allowed.
 *
 * An absent `Origin` is a server-to-server call rather than a browser one, and is
 * allowed: the JWT is still required, and refusing non-browser callers would break each
 * function's own test suite and any future CLI. A present but unconfigured `Origin` is
 * refused, so running without `ALLOWED_ORIGIN` set fails closed for browsers instead of
 * failing open.
 */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  const allow = allowedOrigin();
  return allow !== null && origin === allow;
}

/**
 * The bearer token, or null.
 *
 * Case-insensitive scheme and surrounding whitespace tolerated, because the header is
 * written by hand often enough that being strict about either produces a 401 that
 * looks like a rejected token. The token itself is never logged, trimmed or otherwise
 * inspected by anything in this repository.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * A JSON response, with the caller's headers merged in.
 *
 * `Content-Type` first so a caller cannot accidentally override it while still being
 * able to add `Retry-After` and friends.
 */
export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": JSON_CONTENT_TYPE, ...headers },
  });
}

/**
 * Wraps a function's real logic in the CORS floor.
 *
 * `logic` receives the request and the CORS headers, and is expected to attach `cors` to
 * every response it returns -- including its own error responses, so that an ordinary
 * 400 is indistinguishable from a 500 in terms of what the browser can read.
 *
 * The body of the fallback is deliberately generic. Returning `String(err)` would put an
 * internal message into a 500 the caller can read, which is the same reconnaissance risk
 * every other error path is written to avoid -- and it would be the only one that leaks.
 * The stack goes to `console.error` instead, where the dashboard can find it.
 *
 * `name` is used only for that log line, so a dashboard with several functions still
 * says which one broke.
 */
export function withCorsFloor(
  name: string,
  logic: (request: Request, cors: Record<string, string>) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async function guarded(request: Request): Promise<Response> {
    // Computed outside the try because the catch needs it. It only reads two headers and
    // one env var, and it is the same call the inner function makes first thing.
    const cors = corsHeaders(request);

    try {
      return await logic(request, cors);
    } catch (cause) {
      console.error(
        `Unhandled error in ${name}:`,
        cause instanceof Error ? (cause.stack ?? cause.message) : String(cause),
      );
      return new Response(JSON.stringify({ error: "internal_error" }), {
        // 500 rather than 503: the service is not unavailable, it is broken. Both map to
        // SERVICE_UNAVAILABLE client-side, so nothing downstream distinguishes them.
        status: 500,
        headers: { "Content-Type": JSON_CONTENT_TYPE, ...cors },
      });
    }
  };
}