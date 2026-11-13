/**
 * catalogRegistry.ts — the catalog the device has already read.
 *
 * The loader is asynchronous; the resolution path is not. Components that render
 * a name or a machine while the catalog is still being read (or after it failed)
 * need a synchronous answer for "which rows do we know about", and a second
 * `loadCatalog()` would mean a second download.
 *
 * The registry holds the last rows the loader accepted. It is a mirror, not a
 * source: `loadCatalog` is still the only thing that fetches and caches.
 */

import type { CatalogExercise } from "./types";

let rows: readonly CatalogExercise[] = [];

/** Records the rows a successful load produced. */
export function setLoadedCatalog(next: readonly CatalogExercise[]): void {
  rows = next;
}

/** The rows the loader last accepted. Empty until the first load. */
export function peekLoadedCatalog(): readonly CatalogExercise[] {
  return rows;
}

/** Drops the mirror. Used by the tests and by an explicit cache reset. */
export function resetCatalogRegistry(): void {
  rows = [];
}