/**
 * customExercises.ts — exercises a coach created ahead of the catalog deploy.
 *
 * The exercise catalog the app ships is a static JSON asset (`exercisesCatalog.json`)
 * loaded on demand; a row inserted into the Supabase `exercises` table does not appear
 * in that asset until it is regenerated. To let a coach use a brand-new exercise the
 * same day, it is also kept in `localStorage` and merged into the in-memory catalog by
 * `useExerciseCatalog`. The Supabase insert stays the source of truth for other coaches
 * and admins; this local mirror only closes the same-session gap on this device.
 *
 * A missing or corrupt store is the same as "no custom exercises", so the catalog still
 * loads.
 */

import type { Exercise } from "@/types/supabase";

const STORAGE_KEY = "cronos_custom_exercises_v1";

/** Reads the device-local custom exercises. Never throws. */
export function readCustomExercises(): Exercise[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isExerciseLike);
  } catch {
    return [];
  }
}

function isExerciseLike(value: unknown): value is Exercise {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Exercise>;
  return typeof row.id === "string" && row.id.length > 0 && typeof row.name === "string";
}

/** Adds (or replaces) a custom exercise in the device-local store. */
export function addCustomExercise(exercise: Exercise): void {
  if (typeof window === "undefined") return;
  try {
    const current = readCustomExercises().filter((row) => row.id !== exercise.id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([exercise, ...current]));
  } catch {
    // A full localStorage is an edge case; the Supabase row still exists.
  }
}