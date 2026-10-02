/**
 * seedExercises.ts
 *
 * Source of the 1,324-exercise catalog.
 *
 * `loadExercises()` is read-only: it GETs the upstream dataset over HTTP and
 * normalizes it. It is safe to call from the browser, and `ExerciseBrowser`
 * uses it as a fallback whenever the `exercises` table is empty or unreadable
 * (unseeded, or blocked by the SELECT-only `exercises_select_authenticated`
 * policy).
 *
 * `seedExercises()` writes to Supabase and MUST run in a server context (Edge
 * Function or a migration script), never from the browser: the anon key cannot
 * bypass RLS.
 *
 * The dataset stores media as RELATIVE paths (e.g. "videos/0001-2gPfomN.gif").
 * This module prefixes them with the raw GitHub base URL before caching,
 * so downstream consumers always receive a usable absolute URL.
 */

const RAW_BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main";

export interface SeedExercise {
  id: string;
  name: string;
  body_part: string;
  target: string;
  equipment: string;
  gif_url: string; // absolute URL after prefixing
  instructions: string[]; // from instruction_steps.es (Spanish)
}

interface RawRecord {
  id: string;
  name: string;
  body_part: string;
  target: string;
  equipment: string;
  gif_url: string | null;
  instruction_steps?: {
    es?: string[];
  };
}

export function normalizeRecord(raw: RawRecord): SeedExercise | null {
  if (!raw || typeof raw.id !== "string" || !raw.gif_url) return null;

  const steps = raw.instruction_steps?.es;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return {
    id: raw.id,
    name: raw.name,
    body_part: raw.body_part,
    target: raw.target,
    equipment: raw.equipment,
    gif_url: raw.gif_url.startsWith("http")
      ? raw.gif_url
      : `${RAW_BASE}/${raw.gif_url}`,
    instructions: steps,
  };
}

interface CacheEntry {
  fetchedAt: number;
  exercises: SeedExercise[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let memoryCache: CacheEntry | null = null;
/** De-duplicates concurrent callers so mounting views don't refetch the catalog. */
let inFlight: Promise<SeedExercise[]> | null = null;

const DEFAULT_DATA_URL = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";

function resolveDataUrl(url?: string): string {
  const resolved = url ?? import.meta.env.VITE_EXERCISES_DATA_URL ?? DEFAULT_DATA_URL;
  if (!resolved) throw new FailedToFetchExercisesError("Missing exercises dataset URL");
  return resolved;
}

/**
 * Fetch and normalize the exercise catalog.
 *
 * Safe to call from the browser: this is a read-only HTTP GET of the upstream
 * dataset, so it does not touch Supabase or its RLS policies. `url` is
 * optional and falls back to VITE_EXERCISES_DATA_URL. Serves from an in-memory
 * cache so repeat reads (and offline reads within the TTL) are instant.
 */
export async function loadExercises(url?: string): Promise<SeedExercise[]> {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.exercises;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const target = resolveDataUrl(url);
    const res = await fetch(target);
    if (!res.ok) {
      throw new FailedToFetchExercisesError(`HTTP ${res.status} for ${target}`);
    }

    const raw = (await res.json()) as RawRecord[];
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new FailedToFetchExercisesError(`Empty dataset at ${target}`);
    }

    const exercises = raw.map(normalizeRecord).filter((x): x is SeedExercise => x !== null);
    if (exercises.length === 0) {
      throw new FailedToFetchExercisesError(`No usable records at ${target}`);
    }

    memoryCache = { fetchedAt: Date.now(), exercises };
    return exercises;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export class FailedToFetchExercisesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FailedToFetchExercisesError";
  }
}

/**
 * Upsert the catalog into the `exercises` table.
 * Returns the number of rows written.
 *
 * Server context only: this writes through the `exercises_insert_authenticated`
 * policy, which the anon browser key cannot satisfy.
 */
export async function seedExercises(
  upsert: (rows: SeedExercise[]) => Promise<{ count: number; error: Error | null }>,
  url?: string
): Promise<number> {
  const exercises = await loadExercises(url);
  const { count, error } = await upsert(exercises);
  if (error) throw error;
  return count;
}