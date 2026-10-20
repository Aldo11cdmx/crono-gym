/**
 * catalogLoader.ts — the exercise catalog, loaded when it is needed.
 *
 * The catalog used to be a static import:
 *
 *     import exercisesCatalog from "@/data/exercisesCatalog.json";
 *
 * which put 16.3 MB of JSON inside the entry chunk. The app shipped a 16.5 MB
 * bundle to draw a screen where the catalog is only read when the user opens
 * the exercise picker — a screen most sessions never open.
 *
 * The JSON now ships as its own asset and is fetched the first time something
 * asks for it. The loader keeps one in-flight request and one memory cache, so
 * opening the picker twice does not download or parse it twice, and the
 * downloaded copy is written to IndexedDB so the next start is local.
 *
 * The URL is overridable with `VITE_EXERCISES_CATALOG_URL` so the catalog can
 * later be served compressed from a CDN, or from the device cache, without
 * touching the code that reads it.
 */

import catalogAssetUrl from "@/data/exercisesCatalog.json?url";
import {
  indexedDbCatalogCache,
  type CatalogCache,
  type CachedCatalog,
} from "./catalogCache";
import { isCatalogExercise, type CatalogExercise } from "./types";

const DEFAULT_CATALOG_URL = import.meta.env.VITE_EXERCISES_CATALOG_URL ?? catalogAssetUrl;

export class CatalogLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogLoadError";
  }
}

export interface LoadCatalogOptions {
  /** Where to read the catalog from. Defaults to the bundled asset. */
  url?: string;
  /** Injection seam for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Where the catalog is kept between starts. Defaults to IndexedDB. */
  cache?: CatalogCache;
}

let cache: CatalogExercise[] | null = null;
let inFlight: Promise<CatalogExercise[]> | null = null;

/**
 * Reads the catalog once and keeps it in memory.
 *
 * The device cache comes first: a stored catalog younger than its TTL is
 * served without touching the network. A stored catalog that has gone stale is
 * refreshed from the network, and is used as it is if the network is not
 * there — a day-old catalog is better than no catalog.
 *
 * Rejects with a `CatalogLoadError` when the file cannot be fetched and there
 * is nothing stored, so the caller can offer a retry.
 */
export async function loadCatalog(options: LoadCatalogOptions = {}): Promise<CatalogExercise[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  const url = options.url ?? DEFAULT_CATALOG_URL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const store = options.cache ?? indexedDbCatalogCache;

  inFlight = (async () => {
    const stored = await readStored(store);
    if (stored?.fresh) {
      cache = stored.rows;
      return stored.rows;
    }

    try {
      const rows = await fetchCatalog(url, fetchImpl);
      cache = rows;
      // The write must not delay the picker: it happens in the background and
      // a failure to store is not a failure to show the catalog.
      void store.write(rows).catch(() => undefined);
      return rows;
    } catch (err) {
      if (stored) {
        cache = stored.rows;
        return stored.rows;
      }
      throw err;
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Reads the device cache. A broken cache is an empty cache, never a failure. */
async function readStored(store: CatalogCache): Promise<CachedCatalog | null> {
  try {
    return await store.read();
  } catch {
    return null;
  }
}

/** Downloads the catalog and keeps the rows that can be rendered. */
async function fetchCatalog(url: string, fetchImpl: typeof fetch): Promise<CatalogExercise[]> {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new CatalogLoadError(`HTTP ${res.status} al cargar el catálogo`);
  }
  const payload: unknown = JSON.parse(await res.text());
  if (!Array.isArray(payload)) {
    throw new CatalogLoadError("El catálogo no es una lista de ejercicios");
  }
  const rows = payload.filter(isCatalogExercise);
  if (rows.length === 0) {
    throw new CatalogLoadError("El catálogo no contiene ejercicios utilizables");
  }
  return rows;
}

/** Drops the memory cache. Used by the tests and by an explicit refresh. */
export function resetCatalogCache(): void {
  cache = null;
}

export { isCatalogExercise };
export type { CachedCatalog };
