/**
 * useExerciseCatalog.ts — the whole exercise catalogue, once.
 *
 * The import wizard needs it to turn a name from a CSV into a catalog id, and it
 * needs the whole thing: resolving "Sentadilla" to one specific row is only
 * possible if every row with that name is in hand, and the user's file will name
 * exercises from every region regardless of which muscles they picked.
 *
 * Shared across the wizard's steps rather than refetched per step, because a
 * catalogue query is the largest single read in the importer and re-running it on
 * every column change is what makes a wizard feel broken.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@lib/supabase";
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

export function useExerciseCatalog(userId: string | null): ExerciseCatalogState {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setExercises([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from("exercises").select("*");
    if (err) setError(err.message);
    else setExercises((data ?? []) as Exercise[]);
    setLoading(false);
  }, [userId]);

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