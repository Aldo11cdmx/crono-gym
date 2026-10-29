/**
 * useFrequentExercises.ts — ejercicios frecuentes/recientes en localStorage.
 *
 * Clave: `frequent_exercises`. Siempre es un array de IDs de ejercicio, tope
 * configurable (por defecto 50). El JSON corrupto o el storage bloqueado
 * devuelven vacío sin romper la UI; la persistencia solo ocurre cuando el
 * usuario confirma una selección, nunca al marcarla.
 */

import { useCallback, useState } from "react";

const FREQUENT_KEY = "frequent_exercises";

function loadFrequentIds(max: number): string[] {
  try {
    const raw = window.localStorage.getItem(FREQUENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter((id): id is string => typeof id === "string");
    return ids.slice(0, max);
  } catch {
    return [];
  }
}

function addUnique(prev: string[], id: string, max: number): string[] {
  const next = [id, ...prev.filter((existing) => existing !== id)];
  return next.slice(0, max);
}

function addUniqueBatch(prev: string[], ids: string[], max: number): string[] {
  const next = ids.reduce((acc, id) => addUnique(acc, id, max), prev);
  return next.slice(0, max);
}

export function useFrequentExercises(max = 50) {
  const [frequentIds, setFrequentIds] = useState<string[]>(() =>
    loadFrequentIds(max),
  );

  const add = useCallback(
    (id: string) =>
      setFrequentIds((prev) => addUnique(prev, id, max)),
    [max],
  );

  const addBatch = useCallback(
    (ids: string[]) =>
      setFrequentIds((prev) => addUniqueBatch(prev, ids, max)),
    [max],
  );

  const remove = useCallback(
    (id: string) =>
      setFrequentIds((prev) => prev.filter((existing) => existing !== id)),
    [],
  );

  return { frequentIds, add, addBatch, remove };
}

export { FREQUENT_KEY };
