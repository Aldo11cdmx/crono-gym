/**
 * seedExercises.ts
 *
 * One-time server-side seed of the 1,324-exercise catalog into Supabase.
 *
 * IMPORTANT: this helper must run in a server context (Edge Function or a
 * migration script), never from the browser. The anon key cannot bypass
 * Row-Level Security, so a client-side call would be blocked by the
 * `exercises_select_authenticated` policy, which is SELECT-only.
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

/**
 * Fetch and normalize the exercise catalog.
 * Falls back to an in-memory cache so offline reads still work.
 */
export async function loadExercises(url: string): Promise<SeedExercise[]> {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.exercises;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new FailedToFetchExercisesError(`HTTP ${res.status} for ${url}`);
  }

  const raw = (await res.json()) as RawRecord[];
  const exercises = raw.map(normalizeRecord).filter((x): x is SeedExercise => x !== null);

  memoryCache = { fetchedAt: Date.now(), exercises };
  return exercises;
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
 */
export async function seedExercises(
  upsert: (rows: SeedExercise[]) => Promise<{ count: number; error: Error | null }>,
  url: string
): Promise<number> {
  const exercises = await loadExercises(url);
  const { count, error } = await upsert(exercises);
  if (error) throw error;
  return count;
}