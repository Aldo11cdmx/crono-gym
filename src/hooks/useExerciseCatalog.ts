/**
 * useExerciseCatalog.ts — the whole exercise catalogue, once.
 *
 * The import wizard needs it to turn a name from a CSV into a catalog id, and it
 * needs the whole thing: resolving "Sentadilla" to one specific row is only
 * possible if every row with that name is in hand, and the user's file will name
 * exercises from every region regardless of which muscles they picked.
 *
 * The catalog is read from the device, not from the server. It used to be
 * `select *` from the `exercises` table -- 1,324 rows on every mount of the
 * wizard, the library or the hub -- and the rows it needs are the same rows
 * the app ships with. The device copy is downloaded once, kept in IndexedDB
 * and read from there, so the wizard opens without a round trip and opens
 * without a connection.
 *
 * Shared across the wizard's steps rather than refetched per step, because
 * re-reading the catalogue on every column change is what makes a wizard feel
 * broken.
 *
 * A coach's rename or machine change is not a new catalog: the rows stay the
 * same, so the hook re-resolves them when the override stores change instead of
 * downloading 16 MB again.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import { toExercises } from "@/lib/catalog/exerciseAdapter";
import {
  CATALOG_UPDATED_EVENT,
  readCustomExercises,
  subscribeCatalogOverrides,
} from "@/lib/catalog/customExercises";
import { normaliseExerciseName } from "@/lib/catalog/resolveExercise";
import { catalogCache } from "@/lib/cache";
import type { Exercise } from "@/types/supabase";

export interface ExerciseCatalogState {
  exercises: Exercise[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Finds a catalogue row by name, optionally restricted to one muscle.
   *
   * Returns null rather than the closest match: a near-miss here writes a set
   * against the wrong movement, and the ranks engine will then credit the user
   * for a muscle they did not train. Returning null makes the wizard report the
   * exercise as unresolved, which the user can then fix.
   */
  find: (name: string, target?: string | null) => Exercise | null;
}

export { normaliseExerciseName, CATALOG_UPDATED_EVENT };

export function useExerciseCatalog(): ExerciseCatalogState {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    // Only the first read is a wait worth showing: an override arriving mid-session
    // must not turn the picker into a spinner.
    if (!loadedRef.current) setLoading(true);
    setError(null);
    try {
      const cached = catalogCache.get("catalog");
      let rows;
      if (cached) {
        rows = cached;
      } else {
        rows = await loadCatalog();
        catalogCache.set("catalog", rows);
        // El catálogo ya vive en IndexedDB; la caché en memoria solo acelera
        // los re-lecturas dentro de la sesión. Guarda filas base: los overrides
        // se aplican al convertir, así que un cambio del coach no queda preso.
      }
      loadedRef.current = true;
      setExercises([...toExercises(rows), ...readCustomExercises()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el catálogo de ejercicios",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeCatalogOverrides(() => {
    void refresh();
  }), [refresh]);

  const find = useCallback(
    (name: string, target?: string | null): Exercise | null => {
      const wanted = normaliseExerciseName(name);
      if (wanted === "") return null;
      // Scoped first: two exercises can share a name across regions, and the
      // muscle the user assigned in the mapping step is the disambiguator.
      const pool = target ? exercises.filter((e) => e.target === target) : exercises;
      // Both names count: a CSV names an exercise in Spanish, and a coach's
      // rename is a name the athlete will type.
      return (
        pool.find((e) => normaliseExerciseName(e.name) === wanted) ??
        pool.find((e) => Boolean(e.name_es) && normaliseExerciseName(e.name_es ?? "") === wanted) ??
        null
      );
    },
    [exercises],
  );

  return { exercises, loading, error, refresh, find };
}