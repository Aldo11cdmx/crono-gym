/**
 * customExercises.ts — exercises a coach created ahead of the catalog deploy,
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
 * with separate jobs — the machine/availability of a row, and the name a coach gave it —
 * so writing one never erases the other.
 *
 * An override also carries its own sync state (`dirty`, `syncStatus`, `updatedAt`), so a
 * change the coach made on this device is never replaced by a remote row that still holds
 * the shipped value. `mergeOverridesFromRemote` is where that rule lives.
 *
 * A missing or corrupt store is the same as "no custom exercises" and "no overrides",
 * so the catalog still loads.
 */

import type { Exercise } from "@/types/supabase";
import {
  BODYWEIGHT_EQUIPMENT_NAME,
  BODYWEIGHT_STATION,
  NO_EQUIPMENT_ID,
  type StationKey,
} from "./types";

const STORAGE_KEY = "cronos_custom_exercises_v1";
export const CATALOG_OVERRIDES_KEY = "cronos_catalog_overrides_v1";
export const EXERCISE_NAME_OVERRIDES_KEY = "cronos_exercise_name_overrides_v1";
export const CATALOG_UPDATED_EVENT = "cronos:catalog-updated";

export interface CatalogOverride {
  customNameEs?: string;
  equipment_id?: string;
  /** The machine's name as the coach sees it, so a machine the map does not know still renders. */
  equipment_name?: string;
  station_key?: StationKey;
  movement_pattern?: string;
  availableInCronosGym?: boolean;
  /**
   * The coach removed this exercise from the catalog.
   *
   * A deletion is an override like any other, not a `DELETE` of the row: a routine
   * that already references the exercise must keep its history, and the coach must
   * be able to undo. The row stops being trainable everywhere while it stays here.
   */
  deleted?: boolean;
  /** The coach's own demonstration, when the shipped one is wrong. */
  gif_url?: string;
  /** The coach's own still, when the shipped one is wrong. */
  image?: string;
  /** Epoch ms of the last write on this device. */
  updatedAt?: number;
  /** True while Supabase has not confirmed this override. */
  dirty?: boolean;
  syncStatus?: OverrideSyncStatus;
}

export type OverrideSyncStatus = "synced" | "pending" | "local_only";

/** The shipped values an override is compared against: the default, not a cache. */
export interface CatalogDefault {
  name?: string;
  gif_url?: string;
  equipment_id?: string | null;
  equipment_name?: string | null;
  station_key?: string | null;
}

export type CatalogOverrides = Record<string, CatalogOverride>;

/** The name a coach gave an exercise, keyed by catalog id. */
export type ExerciseNameOverrides = Record<string, string>;

/** Both stores as one read: the resolution path must not parse them twice. */
export interface CatalogOverridesSnapshot {
  catalog: CatalogOverrides;
  names: ExerciseNameOverrides;
}

/**
 * The canonical form of a catalog id: the padded one, as the shipped asset writes it.
 *
 * The asset pads to four digits (`0001`) while history rows, the coach portal and
 * Supabase answers all carry `1`. A lookup that only tries one of them misses the
 * override the other one wrote, which is how a rename used to vanish on reload.
 */
export function normaliseExerciseId(exerciseId: string): string {
  const trimmed = exerciseId.trim();
  if (trimmed === "") return trimmed;
  return /^\d+$/.test(trimmed) ? trimmed.padStart(4, "0") : trimmed;
}

/** Every key an override of this exercise may live under, canonical first. */
export function exerciseIdVariants(exerciseId: string): string[] {
  const canonical = normaliseExerciseId(exerciseId);
  const variants = [canonical];
  if (/^\d+$/.test(canonical)) {
    const unpadded = String(Number(canonical));
    if (unpadded !== canonical) variants.push(unpadded);
  }
  return variants;
}

/**
 * The canonical ids the coach has removed from the catalog.
 *
 * Read from the store on every call and not from the shared snapshot: a delete is
 * followed immediately by a re-render of the list that has to lose the row, and
 * `invalidateOverridesSnapshot` is what makes that possible, but a caller that
 * already holds a snapshot must not keep showing a row the coach just deleted.
 */
export function readDeletedExerciseIds(): Set<string> {
  const ids = new Set<string>();
  for (const [id, override] of Object.entries(loadCatalogOverrides())) {
    if (override?.deleted === true) ids.add(normaliseExerciseId(id));
  }
  return ids;
}

/** Whether the coach removed this exercise. Unknown ids are not deleted. */
export function isExerciseDeleted(exerciseId: string | null | undefined): boolean {
  if (!exerciseId) return false;
  return readDeletedExerciseIds().has(normaliseExerciseId(exerciseId));
}

/**
 * Drops the rows the coach removed.
 *
 * The filter is here rather than in the loader because the catalog is also the
 * place a restore reads from: the registry keeps every row, and only the lists a
 * user picks a movement from lose the deleted ones.
 */
export function filterDeletedExercises<T extends { id: string }>(rows: readonly T[]): T[] {
  const deleted = readDeletedExerciseIds();
  // The untouched array is returned as it is: the loader hands the same rows to
  // several callers, and copying 1,324 rows to delete none of them is waste.
  if (deleted.size === 0) return rows as T[];
  return rows.filter((row) => !deleted.has(normaliseExerciseId(row.id)));
}

/** How many exercises this device has removed. One per exercise, not per id form. */
export function countDeletedExercises(): number {
  let total = 0;
  for (const [, override] of canonicalOverrides()) {
    if (override.deleted === true) total += 1;
  }
  return total;
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
  // `deleted` travels at the top level as well: a listener that only needs to know
  // whether the exercise still exists should not have to read the whole override.
  announce({ exerciseId, deleted: override.deleted === true, override });
}

/**
 * Writes the machine, station and availability of one exercise, keeping whatever
 * name override already existed.
 *
 * The merge is the point: assigning a machine used to replace the whole object,
 * so a rename followed by a machine change silently lost the rename.
 *
 * The write lands on the canonical id *and* on its unpadded twin, so a reader that
 * asks for either key finds it.
 */
export function saveCatalogOverride(exerciseId: string, override: CatalogOverride): void {
  if (typeof window === "undefined") return;
  const { customNameEs, ...fields } = override;
  const current = loadCatalogOverrides();
  const canonical = normaliseExerciseId(exerciseId);
  const base = current[canonical] ?? current[exerciseId] ?? {};
  const merged: CatalogOverride = { ...base, ...fields };
  if (merged.dirty === undefined) merged.dirty = true;
  if (merged.syncStatus === undefined) {
    merged.syncStatus = merged.dirty ? "pending" : "synced";
  }
  if (merged.updatedAt === undefined) merged.updatedAt = Date.now();
  for (const key of Object.keys(merged) as Array<keyof CatalogOverride>) {
    if (merged[key] === undefined) delete merged[key];
  }

  const next: CatalogOverrides = { ...current, [canonical]: merged };
  for (const variant of exerciseIdVariants(exerciseId)) {
    if (variant !== canonical) next[variant] = merged;
  }
  writeJson(CATALOG_OVERRIDES_KEY, next);

  if (customNameEs !== undefined) {
    writeNameOverride(exerciseId, customNameEs);
  }
  invalidateOverridesSnapshot();
  emit(exerciseId, override);
}

/**
 * Records what Supabase answered for one override.
 *
 * Only this may clear `dirty`: a change stays "pending" until the server says it
 * has the row, and stays "local_only" when it does not, so a reload never presents
 * an unconfirmed change as if it were saved everywhere.
 */
export function markCatalogOverrideSynced(
  exerciseId: string,
  status: Exclude<OverrideSyncStatus, "pending">,
): void {
  if (typeof window === "undefined") return;
  const current = loadCatalogOverrides();
  const canonical = normaliseExerciseId(exerciseId);
  const existing = current[canonical] ?? current[exerciseId];
  if (!existing) return;

  const merged: CatalogOverride = {
    ...existing,
    dirty: status !== "synced",
    syncStatus: status,
    updatedAt: Date.now(),
  };
  const next: CatalogOverrides = { ...current, [canonical]: merged };
  for (const variant of exerciseIdVariants(exerciseId)) {
    if (variant !== canonical) next[variant] = merged;
  }
  writeJson(CATALOG_OVERRIDES_KEY, next);
  invalidateOverridesSnapshot();
  emit(exerciseId, merged);
}

/** The override of one exercise, whichever key it was written under. */
export function readCatalogOverride(
  exerciseId: string,
  snapshot: CatalogOverridesSnapshot = readOverridesSnapshot(),
): CatalogOverride | undefined {
  for (const variant of exerciseIdVariants(exerciseId)) {
    const found = snapshot.catalog[variant];
    if (found) return found;
  }
  return undefined;
}

/** The coach's name for one exercise, whichever key it was written under. */
export function readNameOverride(
  exerciseId: string,
  snapshot: CatalogOverridesSnapshot = readOverridesSnapshot(),
): string | undefined {
  for (const variant of exerciseIdVariants(exerciseId)) {
    const found = snapshot.names[variant];
    if (found) return found;
  }
  return undefined;
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
  const canonical = normaliseExerciseId(exerciseId);
  for (const variant of exerciseIdVariants(exerciseId)) {
    if (trimmed === "") delete names[variant];
    else names[variant] = trimmed;
  }
  if (trimmed === "" && canonical !== exerciseId) delete names[exerciseId];
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
 *
 * The anti-revert rule is the reason this is not a plain merge. A device that
 * edited a row while Supabase still holds the shipped value (a failed write, a
 * policy that rejected the update, a row written under the other id form) used to
 * be overwritten by that shipped value on the next load, and the coach's work
 * disappeared on reload. Now a local override that is still `dirty` is only
 * replaced by a remote value that actually differs from the catalog default; a
 * remote value equal to the default is ignored, because it carries no news.
 *
 * `baseById` is the shipped catalog, so the comparison is against the default and
 * not against whatever the local store happened to cache.
 */
export function mergeOverridesFromRemote(
  remote: CatalogOverrides,
  baseById?: ReadonlyMap<string, CatalogDefault>,
): number {
  if (typeof window === "undefined") return 0;
  const current = loadCatalogOverrides();
  const names = loadNameOverrides();
  let changed = 0;
  const nextCatalog: CatalogOverrides = { ...current };

  for (const [rawId, incoming] of Object.entries(remote)) {
    if (!incoming || typeof incoming !== "object") continue;
    const canonical = normaliseExerciseId(rawId);
    const existing = current[canonical] ?? current[rawId] ?? {};
    const base = baseById?.get(canonical);
    const localDirty = existing.dirty === true;
    const merged: CatalogOverride = { ...existing };

    /**
     * A field the device is still holding unsent.
     *
     * `dirty` means "Supabase does not have this yet", so the server cannot be
     * newer for that field: whatever it returns is either the shipped default or
     * the value this device failed to upload. Neither may replace the local one,
     * which is exactly how a rename used to vanish on reload.
     */
    const held = (field: keyof CatalogOverride): boolean =>
      localDirty && existing[field] !== undefined;

    /** A remote value equal to the shipped one carries no news. */
    const isDefault = (value: string | undefined, fallback: string | undefined): boolean =>
      value !== undefined && fallback !== undefined && value === fallback;

    /**
     * Whether the device can actually know that a remote value is the default.
     *
     * `baseById` is the catalog this device has loaded. When it has not loaded
     * yet, the row is unknown, and "different from the default" is unknowable:
     * taking the remote on faith then is what put `CG-EQP-0040` back on an
     * exercise a coach had already moved to "Sin máquina". An unknown default
     * can only fill a field this device has never set.
     */
    const defaultIsKnown = base !== undefined;
    const adoptable = (incomingValue: string, localValue: string | undefined, baseValue: string | null | undefined): boolean =>
      !isDefault(incomingValue, baseValue ?? undefined) && (defaultIsKnown || localValue === undefined);

    /**
     * A coach's "Sin máquina" survives the server.
     *
     * The governance columns are not in every environment yet, so a write of
     * `NONE` can land as `equipment = "body weight"` with the machine id left
     * untouched. On the next load the server offers the old id back; taking it
     * would undo the coach's choice with a value the server never actually
     * changed. A remote row is only allowed to replace a local `NONE` when it
     * says `NONE` itself, or when it agrees the movement is bodyweight.
     */
    const localSaysNoMachine = existing.equipment_id === NO_EQUIPMENT_ID;
    const remoteSaysNoMachine = incoming.equipment_id === NO_EQUIPMENT_ID;
    const remoteAgreesBodyweight =
      incoming.station_key === BODYWEIGHT_STATION ||
      incoming.equipment_name === BODYWEIGHT_EQUIPMENT_NAME;
    const noMachineIsSafe = !localSaysNoMachine || remoteSaysNoMachine || remoteAgreesBodyweight;

    if (!held("equipment_id") && incoming.equipment_id && noMachineIsSafe) {
      if (adoptable(incoming.equipment_id, existing.equipment_id, base?.equipment_id)) {
        merged.equipment_id = incoming.equipment_id;
      }
    }
    if (!held("equipment_name") && incoming.equipment_name && noMachineIsSafe) {
      if (adoptable(incoming.equipment_name, existing.equipment_name, base?.equipment_name)) {
        merged.equipment_name = incoming.equipment_name;
      }
    }
    if (!held("station_key") && incoming.station_key && noMachineIsSafe) {
      if (adoptable(incoming.station_key, existing.station_key, base?.station_key)) {
        merged.station_key = incoming.station_key;
      }
    }
    if (!held("movement_pattern") && incoming.movement_pattern) {
      merged.movement_pattern = incoming.movement_pattern;
    }
    if (!held("availableInCronosGym") && typeof incoming.availableInCronosGym === "boolean") {
      merged.availableInCronosGym = incoming.availableInCronosGym;
    }
    // A deletion is news the same way a rename is: the row the server marked as
    // removed has to disappear here too, or the exercise comes back on reload.
    // The reverse is not true: a remote row that is *not* deleted cannot resurrect
    // an exercise this device removed and has not managed to upload yet.
    if (!held("deleted") && incoming.deleted === true) {
      merged.deleted = true;
    }
    // A remote GIF only counts as a coach's choice when it differs from the one
    // the device shipped; otherwise every row would carry an override and the
    // shipped demonstrations would stop updating with the app.
    if (!held("gif_url") && incoming.gif_url && !isDefault(incoming.gif_url, base?.gif_url)) {
      merged.gif_url = incoming.gif_url;
    }
    if (!held("image") && incoming.image && !isDefault(incoming.image, undefined)) {
      merged.image = incoming.image;
    }

    const customNameEs = incoming.customNameEs?.trim();
    const remoteNameIsDefault =
      Boolean(customNameEs) && Boolean(base?.name) && customNameEs === base?.name;
    const localName = names[canonical] ?? names[rawId];
    const nameHeld = localDirty && Boolean(localName);
    const nameIsNews = Boolean(customNameEs) && !remoteNameIsDefault;

    if (JSON.stringify(merged) !== JSON.stringify(existing)) {
      nextCatalog[canonical] = merged;
      for (const variant of exerciseIdVariants(rawId)) {
        if (variant !== canonical) nextCatalog[variant] = merged;
      }
      changed += 1;
    }

    if (customNameEs && nameIsNews && !nameHeld) {
      names[canonical] = customNameEs;
      for (const variant of exerciseIdVariants(rawId)) {
        if (variant !== canonical) names[variant] = customNameEs;
      }
    }
  }

  if (changed === 0) return 0;
  writeJson(CATALOG_OVERRIDES_KEY, nextCatalog);
  writeJson(EXERCISE_NAME_OVERRIDES_KEY, names);
  invalidateOverridesSnapshot();
  announce({ hydrated: changed });
  return changed;
}

/**
 * One entry per exercise, under its canonical id.
 *
 * A write lands on the padded id and on its unpadded twin, so a reader that asks
 * for either key finds it. Anything that counts or re-sends work has to see the
 * exercise once, or a single rename would look like two.
 */
export function canonicalOverrides(): Array<[string, CatalogOverride]> {
  const byId = new Map<string, CatalogOverride>();
  for (const [id, override] of Object.entries(loadCatalogOverrides())) {
    const canonical = normaliseExerciseId(id);
    const known = byId.get(canonical);
    // The canonical key wins when both exist; they carry the same object anyway.
    if (!known || id === canonical) byId.set(canonical, override);
  }
  return [...byId.entries()];
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