/**
 * customExercises.ts â€” exercises a coach created ahead of the catalog deploy,
 * and the overrides a coach applies on top of the shipped catalog.
 *
 * The exercise catalog the app ships is a static JSON asset (`exercisesCatalog.json`)
 * loaded on demand; a row inserted into the Supabase `exercises` table does not appear
 * in that asset until it is regenerated. To let a coach use a brand-new exercise the
 * same day, it is also kept in `localStorage` and merged into the in-memory catalog by
 * `useExerciseCatalog`. The Supabase insert stays the source of truth for other coaches
 * and admins; this local mirror only closes the same-session gap on this device.
 *
 * Overrides are the other half: a coach renames an exercise or points it at a machine,
 * and the app has to show that immediately without a redeploy. They live in two stores
 * with separate jobs â€” the machine/availability of a row, and the name a coach gave it â€”
 * so writing one never erases the other.
 *
 * A missing or corrupt store is the same as "no custom exercises" and "no overrides",
 * so the catalog still loads.
 */

import type { Exercise } from "@/types/supabase";
import type { StationKey } from "./types";

const STORAGE_KEY = "cronos_custom_exercises_v1";
export const CATALOG_OVERRIDES_KEY = "cronos_catalog_overrides_v1";
export const EXERCISE_NAME_OVERRIDES_KEY = "cronos_exercise_name_overrides_v1";
export const CATALOG_UPDATED_EVENT = "cronos:catalog-updated";

export interface CatalogOverride {
  customNameEs?: string;
  equipment_id?: string;
  station_key?: StationKey;
  availableInCronosGym?: boolean;
  /** The coach's own demonstration, when the shipped one is wrong. */
  gif_url?: string;
}

export type CatalogOverrides = Record<string, CatalogOverride>;

/** The name a coach gave an exercise, keyed by catalog id. */
export type ExerciseNameOverrides = Record<string, string>;

/** Both stores as one read: the resolution path must not parse them twice. */
export interface CatalogOverridesSnapshot {
  catalog: CatalogOverrides;
  names: ExerciseNameOverrides;
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full localStorage is an edge case; the Supabase row still exists.
  }
}

export function loadCatalogOverrides(): CatalogOverrides {
  const parsed = readJson(CATALOG_OVERRIDES_KEY);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as CatalogOverrides)
    : {};
}

export function loadNameOverrides(): ExerciseNameOverrides {
  const parsed = readJson(EXERCISE_NAME_OVERRIDES_KEY);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const names: ExerciseNameOverrides = {};
  for (const [id, name] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof name === "string" && name.trim() !== "") names[id] = name;
  }
  return names;
}

/**
 * The overrides as one object, read once until something changes.
 *
 * Resolving the catalog touches this for every row; parsing two `localStorage`
 * payloads 1,324 times would be the difference between a picker that opens and
 * one that stalls.
 */
let snapshot: CatalogOverridesSnapshot | null = null;

export function readOverridesSnapshot(): CatalogOverridesSnapshot {
  if (!snapshot) {
    snapshot = { catalog: loadCatalogOverrides(), names: loadNameOverrides() };
  }
  return snapshot;
}

/**
 * Forgets the cached snapshot.
 *
 * `subscribeCatalogOverrides` calls this on every change; a test that writes to
 * `localStorage` the way another tab would needs it too.
 */
export function invalidateOverridesSnapshot(): void {
  snapshot = null;
}

function announce(detail: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT, { detail }));
}

function emit(exerciseId: string, override: CatalogOverride): void {
  announce({ exerciseId, override });
}

/**
 * Writes the machine, station and availability of one exercise, keeping whatever
 * name override already existed.
 *
 * The merge is the point: assigning a machine used to replace the whole object,
 * so a rename followed by a machine change silently lost the rename.
 */
export function saveCatalogOverride(exerciseId: string, override: CatalogOverride): void {
  if (typeof window === "undefined") return;
  const { customNameEs, ...fields } = override;
  const current = loadCatalogOverrides();
  const merged: CatalogOverride = { ...(current[exerciseId] ?? {}), ...fields };
  for (const key of Object.keys(merged) as Array<keyof CatalogOverride>) {
    if (merged[key] === undefined) delete merged[key];
  }
  writeJson(CATALOG_OVERRIDES_KEY, { ...current, [exerciseId]: merged });
  if (customNameEs !== undefined) {
    writeNameOverride(exerciseId, customNameEs);
  }
  invalidateOverridesSnapshot();
  emit(exerciseId, override);
}

/** Writes the coach's name for one exercise. Empty clears it. */
export function saveNameOverride(exerciseId: string, customNameEs: string): void {
  if (typeof window === "undefined") return;
  writeNameOverride(exerciseId, customNameEs);
  invalidateOverridesSnapshot();
  emit(exerciseId, { customNameEs: customNameEs.trim() || undefined });
}

function writeNameOverride(exerciseId: string, customNameEs: string): void {
  const names = loadNameOverrides();
  const trimmed = customNameEs.trim();
  if (trimmed === "") delete names[exerciseId];
  else names[exerciseId] = trimmed;
  writeJson(EXERCISE_NAME_OVERRIDES_KEY, names);
}

/**
 * Called when the overrides change, in this tab or in another one.
 *
 * The event fires in the tab that wrote; the `storage` event fires in every other
 * tab. A session open in a second tab has to hear about a rename too.
 */
export function subscribeCatalogOverrides(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onUpdated = () => {
    invalidateOverridesSnapshot();
    listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === CATALOG_OVERRIDES_KEY ||
      event.key === EXERCISE_NAME_OVERRIDES_KEY ||
      event.key === null
    ) {
      onUpdated();
    }
  };
  window.addEventListener(CATALOG_UPDATED_EVENT, onUpdated);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CATALOG_UPDATED_EVENT, onUpdated);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Takes a whole page of remote rows into the local override store.
 *
 * A page, not a row at a time: hydrating 1,324 exercises by calling
 * `saveCatalogOverride` would write `localStorage` 1,324 times and announce 1,324
 * changes, and the catalog would spend the whole load re-rendering. The merge is
 * per field -- a remote value the coach never set does not erase the one this
 * device holds -- and the announcement happens once, at the end.
 */
export function mergeOverridesFromRemote(remote: CatalogOverrides): number {
  if (typeof window === "undefined") return 0;
  const current = loadCatalogOverrides();
  const names = loadNameOverrides();
  let changed = 0;
  const nextCatalog: CatalogOverrides = { ...current };

  for (const [id, override] of Object.entries(remote)) {
    if (!override || typeof override !== "object") continue;
    const merged: CatalogOverride = { ...(current[id] ?? {}) };
    if (override.equipment_id) merged.equipment_id = override.equipment_id;
    if (override.station_key) merged.station_key = override.station_key;
    if (typeof override.availableInCronosGym === "boolean") {
      merged.availableInCronosGym = override.availableInCronosGym;
    }
    if (override.gif_url) merged.gif_url = override.gif_url;
    if (JSON.stringify(merged) === JSON.stringify(current[id] ?? {})) continue;
    nextCatalog[id] = merged;
    changed += 1;
    const customNameEs = override.customNameEs?.trim();
    if (customNameEs) names[id] = customNameEs;
  }

  if (changed === 0) return 0;
  writeJson(CATALOG_OVERRIDES_KEY, nextCatalog);
  writeJson(EXERCISE_NAME_OVERRIDES_KEY, names);
  invalidateOverridesSnapshot();
  announce({ hydrated: changed });
  return changed;
}

/** Reads the device-local custom exercises. Never throws. */
export function readCustomExercises(): Exercise[] {
  const parsed = readJson(STORAGE_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isExerciseLike);
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