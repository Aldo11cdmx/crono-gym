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
 */

import { useCallback, useEffect, useState } from "react";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import { toExercises } from "@/lib/catalog/exerciseAdapter";
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

/** Case- and accent-insensitive, so "press militar" finds "Press Militar". */
export function normaliseExerciseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function useExerciseCatalog(): ExerciseCatalogState {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadCatalog();
      setExercises(toExercises(rows));
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

  const find = useCallback(
    (name: string, target?: string | null): Exercise | null => {
      const wanted = normaliseExerciseName(name);
      if (wanted === "") return null;
      // Scoped first: two exercises can share a name across regions, and the
      // muscle the user assigned in the mapping step is the disambiguator.
      const pool = target ? exercises.filter((e) => e.target === target) : exercises;
      return pool.find((e) => normaliseExerciseName(e.name) === wanted) ?? null;
    },
    [exercises],
  );

  return { exercises, loading, error, refresh, find };
}
