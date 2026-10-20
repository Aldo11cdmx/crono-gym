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
 * opening the picker twice does not download or parse it twice.
 *
 * The URL is overridable with `VITE_EXERCISES_CATALOG_URL` so the catalog can
 * later be served compressed from a CDN, or from the IndexedDB cache, without
 * touching the code that reads it.
 */

import catalogAssetUrl from "@/data/exercisesCatalog.json?url";
import type { CatalogExercise } from "./types";

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
}

/**
 * A catalog row is only usable if it can be identified and rendered: a name
 * to show and an id to key the list on. Rows missing those are dropped instead
 * of crashing the picker.
 */
export function isCatalogExercise(value: unknown): value is CatalogExercise {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CatalogExercise>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.name === "string" &&
    typeof row.gif_url === "string"
  );
}

let cache: CatalogExercise[] | null = null;
let inFlight: Promise<CatalogExercise[]> | null = null;

/**
 * Reads the catalog once and keeps it in memory.
 *
 * Rejects with a `CatalogLoadError` when the file cannot be fetched or does
 * not contain a usable catalog, so the caller can offer a retry.
 */
export async function loadCatalog(options: LoadCatalogOptions = {}): Promise<CatalogExercise[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  const url = options.url ?? DEFAULT_CATALOG_URL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  inFlight = (async () => {
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new CatalogLoadError(`HTTP ${res.status} al cargar el catálogo`);
    }
    const payload: unknown = await res.json();
    if (!Array.isArray(payload)) {
      throw new CatalogLoadError("El catálogo no es una lista de ejercicios");
    }
    const rows = payload.filter(isCatalogExercise);
    if (rows.length === 0) {
      throw new CatalogLoadError("El catálogo no contiene ejercicios utilizables");
    }
    cache = rows;
    return rows;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Drops the memory cache. Used by the tests and by an explicit refresh. */
export function resetCatalogCache(): void {
  cache = null;
}
