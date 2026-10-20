/**
 * catalogCache.ts — the exercise catalog, kept on the device.
 *
 * The catalog is 16.3 MB of JSON (2.3 MB compressed) that does not change
 * between releases. Downloading it again on every cold start is what makes the
 * app feel broken on a bad connection, so the first successful download is
 * stored in IndexedDB and every later start reads it from there.
 *
 * It is stored *compressed*: the browser's `CompressionStream` turns 16.3 MB of
 * JSON into roughly 2.3 MB, which is the difference between a cache that fits
 * in the quota and one that does not. Where `CompressionStream` is missing the
 * raw text is stored instead -- bigger, but still a cache.
 *
 * The cache never throws. A missing database, an exhausted quota and a
 * corrupted row are all "there is no cache", because the catalog is an
 * optimisation: the app must still work when it is not there.
 */

import { CATALOG_STORE, tx } from "@/lib/idb";
import { isCatalogExercise, type CatalogExercise } from "./types";

/** The one row the store holds. */
export const CATALOG_CACHE_KEY = "catalog";

/**
 * Bumped when the stored shape changes, so an old row is ignored rather than
 * misread.
 */
export const CATALOG_CACHE_VERSION = 1;

/**
 * How long a stored catalog is served without asking the network again.
 *
 * A week: long enough that a second start in the same week is local, short
 * enough that a corrected exercise in the upstream dataset reaches the device
 * without the user having to clear anything.
 */
export const CATALOG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CatalogCacheRecord {
  id: string;
  version: number;
  storedAt: number;
  /** The catalog JSON, compressed when the browser can compress it. */
  payload: ArrayBuffer | string;
}

export interface CachedCatalog {
  rows: CatalogExercise[];
  storedAt: number;
  /** False when the row is older than the TTL: still usable, but worth replacing. */
  fresh: boolean;
}

export interface CatalogCache {
  read(): Promise<CachedCatalog | null>;
  write(rows: CatalogExercise[]): Promise<void>;
}

/** Compresses text with gzip. Returns null where the browser cannot. */
export async function compressText(text: string): Promise<ArrayBuffer | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return await new Response(stream).arrayBuffer();
  } catch {
    return null;
  }
}

/** Reverses {@link compressText}. Plain text is returned untouched. */
export async function decompressText(payload: ArrayBuffer | string): Promise<string> {
  if (typeof payload === "string") return payload;
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este navegador no puede descomprimir el catálogo guardado");
  }
  const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

/** True when the row is younger than the TTL. */
export function isFresh(storedAt: number, now: number = Date.now()): boolean {
  return now - storedAt < CATALOG_CACHE_TTL_MS;
}

/**
 * The catalog as it is stored on the device.
 *
 * `read` resolves `null` for every kind of absence: no database, no row, a row
 * from an older version, a row that cannot be decompressed. The caller then
 * falls back to the network.
 */
export const indexedDbCatalogCache: CatalogCache = {
  async read() {
    const record = await tx<CatalogCacheRecord>(CATALOG_STORE, "readonly", (store) =>
      store.get(CATALOG_CACHE_KEY),
    );
    if (!record || record.version !== CATALOG_CACHE_VERSION) return null;

    try {
      const text = await decompressText(record.payload);
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) return null;
      const rows = parsed.filter(isCatalogExercise);
      if (rows.length === 0) return null;
      return { rows, storedAt: record.storedAt, fresh: isFresh(record.storedAt) };
    } catch {
      return null;
    }
  },

  async write(rows) {
    const text = JSON.stringify(rows);
    const payload = (await compressText(text)) ?? text;
    await tx(CATALOG_STORE, "readwrite", (store) =>
      store.put({
        id: CATALOG_CACHE_KEY,
        version: CATALOG_CACHE_VERSION,
        storedAt: Date.now(),
        payload,
      }),
    );
  },
};
