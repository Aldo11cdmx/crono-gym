import type { CatalogExercise } from "@/lib/catalog/types";

/**
 * cache.ts — caché en memoria con TTL para lecturas frecuentes de Supabase.
 *
 * El catálogo de ejercicios ya vive en IndexedDB (catalogLoader), pero los
 * perfiles de coach, los datos biométricos del atleta y cualquier otro `SELECT`
 * que se repite al cambiar de pestaña no deberían volver a la red cada vez.
 *
 * Una entrada expira tras su TTL y se vuelve a leer. Las escrituras del mismo
 * usuario invalidan su entrada para no devolver datos viejos tras un `update`.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Caché simple clave→valor con tiempo de vida. Nunca lanza. */
export class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    this.expire();
    return this.store.size;
  }

  private expire(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

/** 2-5 minutos, según los datos: perfiles y biométricos cambian poco en una sesión. */
const PROFILE_TTL_MS = 3 * 60 * 1000;
const METRICS_TTL_MS = 2 * 60 * 1000;
const CATALOG_TTL_MS = 5 * 60 * 1000;

/** Un solo caché por tipo de dato, compartido por todos los hooks. */
export const profileCache = new TTLCache<Record<string, unknown>>(PROFILE_TTL_MS);
export const metricsCache = new TTLCache<Record<string, unknown>>(METRICS_TTL_MS);
export const catalogCache = new TTLCache<CatalogExercise[]>(CATALOG_TTL_MS);
