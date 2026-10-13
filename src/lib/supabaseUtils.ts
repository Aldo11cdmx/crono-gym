/**
 * Small helpers for IDs that travel through Supabase queries.
 *
 * `usePreviousPerformance`, `useAthletePRs`, `useDashboardSessions` and
 * `useProgress` all build `.in()` filters from IDs they received from a prior
 * read. Those reads were `select("*")` / `select("id,name")` calls with no
 * embeds, so the IDs should arrive clean — but a row written through an
 * embedded relation can surface an `id` carrying a PostgREST foreign-table
 * suffix such as `"0009:1"` or `"a1b2c3d4-…:0"`. Passing that into `.in()`
 * makes PostgREST reject the whole request with a 400 Bad Request, which in
 * turn blanks the dashboard card the query fed.
 *
 * `stripIdSuffix` removes the `:N` tail; `sanitizeIds` strips, dedupes, and
 * drops anything that is left empty or otherwise unmatchable, so a single
 * bad id can never take down a whole batch.
 */

/** Matches a trailing `:digits` suffix PostgREST appends to embedded ids. */
const SUFFIX_RE = /:\d+$/;

/**
 * Removes a PostgREST foreign-table suffix (`:0`, `:1`, …) from a single id.
 *
 * `"0009:1"`  → `"0009"`
 * `"uuid:0"`  → `"uuid"`
 * `"0009"`    → `"0009"` (no-op when there is no suffix)
 */
export function stripIdSuffix(id: string): string {
  return id.replace(SUFFIX_RE, "");
}

/**
 * Cleans an array of ids for use in a Supabase `.in()` call.
 *
 * 1. Strips any `:N` suffix from each id.
 * 2. Drops ids that are empty after stripping or are not strings.
 * 3. De-duplicates (PostgREST sends redundant values in the URL and Postgres
 *    still scans them, so there is nothing to gain and something to lose from
 *    duplicates).
 *
 * Returns a new array; never mutates its input.
 */
export function sanitizeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const clean = stripIdSuffix(raw);
    if (clean.length === 0) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}
