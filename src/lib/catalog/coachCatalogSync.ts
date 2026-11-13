/**
 * coachCatalogSync.ts — what a coach changes here reaches Supabase, or says why not.
 *
 * The catalog the app ships is a static asset; a coach's rename, machine and
 * demonstration are not. Those live in `localStorage` so the app shows them
 * immediately and without a network, but a device-local store is not a catalog:
 * another phone, a cleared cache or a fresh install would lose the work.
 *
 * So every governance write is two-tier:
 *
 *   1. Local, always, first: the override store, so the coach sees the change
 *      in the same frame and an offline gym still works.
 *   2. Remote, best effort: an upsert of the governance columns. If the server
 *      has not been migrated yet it answers 42703 (undefined column), and the
 *      write is retried against the base columns so the rename still lands.
 *
 * Neither tier throws at the caller: a failed sync is reported, not raised,
 * because the athlete's catalog must not break over a network that is down.
 */

import { supabase } from "@lib/supabase";
import type { Database } from "@/types/supabase";
import { equipmentMap } from "@/data/equipmentMap";
import { peekLoadedCatalog } from "./catalogRegistry";
import {
  canonicalOverrides,
  exerciseIdVariants,
  markCatalogOverrideSynced,
  mergeOverridesFromRemote,
  normaliseExerciseId,
  readCatalogOverride,
  saveCatalogOverride,
  type CatalogDefault,
  type CatalogOverride,
  type CatalogOverrides,
} from "./customExercises";
import { NO_EQUIPMENT_ID } from "./resolveExercise";
import type { CatalogExercise, StationKey } from "./types";

const TABLE = "exercises";

/** Where a coach's own demonstration is kept. */
export const COACH_GIF_BUCKET = "exercise-media";

/** Postgres: undefined column. The migration has not been applied. */
export const UNDEFINED_COLUMN = "42703";

/** Largest demonstration accepted: a GIF this size is already generous. */
export const MAX_GIF_BYTES = 4 * 1024 * 1024;

const GIF_TYPES = ["image/gif", "image/webp", "image/png", "image/jpeg"] as const;

/** Row shapes the typed client accepts; payloads are assembled field by field. */
type ExerciseInsert = Database["public"]["Tables"]["exercises"]["Insert"];
type ExerciseUpdate = Database["public"]["Tables"]["exercises"]["Update"];

/**
 * The columns this module writes. The base ones exist in every deployment; the
 * governance ones only after the governance migration, which is why every write
 * is prepared twice and retried against `BASE_COLUMNS`.
 */
const GOVERNANCE_COLUMNS =
  "id,name,equipment,gif_url,image,equipment_id,equipment_name,station_key,movement_pattern,available_in_cronos_gym";

const BASE_COLUMNS = "id,name,equipment,gif_url,image";

/** Postgres: new row violates the not-null constraint of a column. */
const NOT_NULL_VIOLATION = "23502";

/** Postgres and PostgREST answers when a column is missing from the schema cache. */
const SCHEMA_CACHE_MISS = "PGRST204";

/**
 * The `exercises.equipment` text for an exercise with no machine.
 *
 * The column is not nullable, so `NONE` has to be spelled out in words there.
 */
export const BODYWEIGHT_EQUIPMENT = "body weight";

/** What a machine assignment looks like in the free-text equipment column. */
export function equipmentText(equipmentId: string, equipmentName: string): string {
  return `${equipmentId}::${equipmentName}`;
}

export type RemoteOutcome = "upserted" | "updated" | "skipped" | "offline" | "unavailable";

export interface CoachSyncResult {
  local: true;
  remote: RemoteOutcome;
  detail?: string;
}

export interface HydrateResult {
  hydrated: number;
  remote: "full" | "base" | "unavailable";
  detail?: string;
}

interface RemoteError {
  code?: string;
  message?: string;
}

/** A row of `public.exercises`, in whichever shape the server can return. */
export type RemoteExerciseRow = Partial<
  Pick<ExerciseInsert, "id" | "name" | "equipment" | "gif_url" | "instructions" | "body_part" | "target">
> & {
  image?: string | null;
  equipment_id?: string | null;
  equipment_name?: string | null;
  station_key?: string | null;
  movement_pattern?: string | null;
  available_in_cronos_gym?: boolean | null;
};

function errorOf(value: unknown): RemoteError {
  if (!value || typeof value !== "object") return {};
  const error = value as RemoteError;
  return { code: error.code, message: error.message };
}

export function isUndefinedColumn(error: unknown): boolean {
  const { code, message } = errorOf(error);
  if (code === UNDEFINED_COLUMN) return true;
  // PostgREST reports a column the schema cache has not seen under its own code.
  if (code === SCHEMA_CACHE_MISS) return true;
  return typeof message === "string" && /column .* does not exist/i.test(message);
}

/**
 * A write the server cannot attribute to a row.
 *
 * Either no row matched the filter (RLS, or the row is stored under the other id
 * form) or the payload violated a constraint. Neither is a reason to tell the
 * coach the change is saved everywhere.
 */
export function isUnattributedWrite(error: unknown): boolean {
  const { code, message } = errorOf(error);
  if (code === NOT_NULL_VIOLATION) return true;
  if (typeof message !== "string") return false;
  return /no rows|0 rows|not found|violates not-null|null value in column/i.test(message);
}

/** The device is offline, or the browser does not say. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function findLocalRow(exerciseId: string): CatalogExercise | undefined {
  return peekLoadedCatalog().find((row) => row.id === exerciseId);
}

/**
 * Writes one governance change: local first, then remote.
 *
 * The local write is unconditional, because the coach is looking at the row. The
 * remote write is the part that has to be honest:
 *
 *   - it targets every id form the row may be stored under, so a write that
 *     filtered on `1` never missed a row stored as `0001`;
 *   - it asks for the ids back, so "the request did not fail" and "the row is
 *     saved" are different answers;
 *   - only a confirmed write clears `dirty`.
 *
 * `row` is the catalog row the coach is editing; when it is not given the local
 * catalog mirror is consulted for the text columns that have to travel with a
 * machine change.
 */
export async function persistCoachExerciseChange(
  exerciseId: string,
  override: CatalogOverride,
  row?: CatalogExercise | null,
): Promise<CoachSyncResult> {
  // Tier 1: the coach sees the change now, online or not, and it is marked pending
  // until tier 2 answers.
  saveCatalogOverride(exerciseId, override);

  if (isOffline()) return { local: true, remote: "offline" };
  if (typeof supabase?.from !== "function") return { local: true, remote: "skipped" };

  const source = row ?? findLocalRow(exerciseId);
  const variants = exerciseIdVariants(exerciseId);

  const governance: ExerciseUpdate = {};
  if (override.customNameEs !== undefined) governance.name = override.customNameEs;
  if (override.equipment_id !== undefined) {
    governance.equipment_id = override.equipment_id;
    // `equipment` is not nullable: a bodyweight exercise is spelled out in words,
    // a machine is stored as "id::name" so the free-text column stays greppable.
    const machineName =
      override.equipment_name ?? source?.equipment_name ?? equipmentMap[override.equipment_id]?.name ?? "";
    governance.equipment =
      override.equipment_id === NO_EQUIPMENT_ID
        ? BODYWEIGHT_EQUIPMENT
        : `${override.equipment_id}::${machineName}` || source?.equipment || "other";
  }
  if (override.equipment_name !== undefined) governance.equipment_name = override.equipment_name;
  if (override.station_key !== undefined) governance.station_key = override.station_key;
  if (override.movement_pattern !== undefined) {
    governance.movement_pattern = override.movement_pattern;
  }
  if (override.availableInCronosGym !== undefined) {
    governance.available_in_cronos_gym = override.availableInCronosGym;
  }
  if (override.gif_url !== undefined) governance.gif_url = override.gif_url;
  if (override.image !== undefined) governance.image = override.image;

  // What the server can always store: the columns it has had since the beginning.
  const base: ExerciseUpdate = {};
  if (governance.name !== undefined) base.name = governance.name;
  if (governance.gif_url !== undefined) base.gif_url = governance.gif_url;
  if (governance.image !== undefined) base.image = governance.image;

  const write = (payload: ExerciseUpdate) =>
    supabase.from(TABLE).update(payload).in("id", variants).select("id");

  const first = await write(governance);
  let error = first.error;
  let confirmed = !error && (first.data?.length ?? 0) > 0;

  if (error && isUndefinedColumn(error)) {
    // The server is on the old schema: only the columns it has always had.
    const retry = await write(base);
    error = retry.error;
    confirmed = !error && (retry.data?.length ?? 0) > 0;
  }

  if (error) {
    markCatalogOverrideSynced(exerciseId, "local_only");
    return { local: true, remote: "unavailable", detail: error.message };
  }

  if (!confirmed) {
    markCatalogOverrideSynced(exerciseId, "local_only");
    return {
      local: true,
      remote: "unavailable",
      detail: "Supabase no confirmó ninguna fila para este ejercicio.",
    };
  }

  markCatalogOverrideSynced(exerciseId, "synced");
  return { local: true, remote: "updated" };
}

/**
 * Re-sends every change this device still owes Supabase.
 *
 * A change can stay unsent: the gym had no network, the migration had not been
 * applied, the write was rejected. The portal's "Guardar y sincronizar cambios"
 * button is the coach's way to settle the debt without redoing the work, and the
 * app also calls this on sign-in so a pending change is not left behind forever.
 */
export async function syncPendingOverrides(): Promise<{
  attempted: number;
  synced: number;
  stillPending: number;
}> {
  const pending = canonicalOverrides().filter(
    ([, override]) => override.dirty === true || override.syncStatus !== "synced",
  );

  let synced = 0;
  for (const [id] of pending) {
    const override = readCatalogOverride(id) ?? {};
    const result = await persistCoachExerciseChange(id, override);
    if (result.remote === "updated" || result.remote === "upserted") synced += 1;
  }

  const stillPending = canonicalOverrides().filter(
    ([, override]) => override.dirty === true || override.syncStatus !== "synced",
  ).length;

  return { attempted: pending.length, synced, stillPending };
}

/** How many overrides this device has not confirmed with Supabase. */
export function countPendingOverrides(): number {
  return canonicalOverrides().filter(
    ([, override]) => override.dirty === true || override.syncStatus !== "synced",
  ).length;
}

/**
 * Takes the remote catalog into the local override store.
 *
 * Called once when the portal opens, and once when the app signs in: the device
 * copy is a cache, and a coach who edited on another machine has to see the same
 * names and machines here. The merge is per field and announced once.
 *
 * The shipped rows are handed to the merge as the baseline, so a remote row that
 * still holds the default is recognised as "no news" and cannot overwrite a
 * change this device has not managed to upload yet.
 */
export async function hydrateOverridesFromSupabase(): Promise<HydrateResult> {
  if (isOffline()) return { hydrated: 0, remote: "unavailable", detail: "offline" };
  if (typeof supabase?.from !== "function") {
    return { hydrated: 0, remote: "unavailable", detail: "no-client" };
  }

  let rows: RemoteExerciseRow[] = [];
  let remote: HydrateResult["remote"] = "full";

  const full = await supabase.from(TABLE).select(GOVERNANCE_COLUMNS).limit(2000);
  if (full.error && isUndefinedColumn(full.error)) {
    remote = "base";
    const base = await supabase.from(TABLE).select(BASE_COLUMNS).limit(2000);
    if (base.error) {
      return { hydrated: 0, remote: "unavailable", detail: base.error.message };
    }
    rows = (base.data ?? []) as RemoteExerciseRow[];
  } else if (full.error) {
    return { hydrated: 0, remote: "unavailable", detail: full.error.message };
  } else {
    rows = (full.data ?? []) as RemoteExerciseRow[];
  }

  const local = peekLoadedCatalog();
  const baseById = new Map<string, CatalogDefault>();
  for (const row of local) {
    baseById.set(row.id, {
      name: row.name,
      gif_url: row.gif_url,
      equipment_id: row.equipment_id ?? null,
      equipment_name: row.equipment_name ?? null,
      station_key: row.station_key ?? null,
    });
  }

  const overrides: CatalogOverrides = {};

  for (const row of rows) {
    if (!row?.id) continue;
    const override: CatalogOverride = {};
    if (row.equipment_id) override.equipment_id = row.equipment_id;
    if (row.equipment_name) override.equipment_name = row.equipment_name;
    if (row.station_key) override.station_key = row.station_key as StationKey;
    if (row.movement_pattern) override.movement_pattern = row.movement_pattern;
    if (typeof row.available_in_cronos_gym === "boolean") {
      override.availableInCronosGym = row.available_in_cronos_gym;
    }
    // A remote GIF only counts as a coach's choice when it differs from the one
    // the device shipped; otherwise every row would carry an override and the
    // shipped demonstrations would stop updating with the app. The merge applies
    // the same rule to every other field.
    const shipped = baseById.get(normaliseExerciseId(row.id))?.gif_url;
    if (row.gif_url && shipped && row.gif_url !== shipped) override.gif_url = row.gif_url;
    if (row.name) override.customNameEs = row.name;
    if (row.image) override.image = row.image;
    if (Object.keys(override).length > 0) overrides[normaliseExerciseId(row.id)] = override;
  }

  const hydrated = mergeOverridesFromRemote(overrides, baseById);
  return { hydrated, remote };
}

function extensionFor(type: string): string {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  return "gif";
}

function publicUrlFor(path: string): string | null {
  const { data } = supabase.storage.from(COACH_GIF_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export type GifUploadResult =
  | { ok: true; url: string; remote: RemoteOutcome }
  | { ok: false; error: string };

/**
 * Turns what the coach picked into a URL the catalog can render.
 *
 * A pasted URL is validated and kept as it is. A file is uploaded to the coach
 * bucket and the resulting public URL is written as the exercise's override, so
 * the demonstration follows the coach across devices instead of living in one
 * browser's memory.
 */
export async function uploadOrResolveCoachGif(
  input: string | File | null | undefined,
  exerciseId: string,
): Promise<GifUploadResult> {
  if (typeof input === "string") {
    const url = input.trim();
    if (!url) return { ok: false, error: "Pega una URL o elige un archivo." };
    if (!/^(https?:\/\/|\/)/i.test(url)) {
      return { ok: false, error: "La URL debe empezar por http:// o https://" };
    }
    const persisted = await persistCoachExerciseChange(exerciseId, { gif_url: url });
    return { ok: true, url, remote: persisted.remote };
  }

  if (!input) return { ok: false, error: "Pega una URL o elige un archivo." };

  if (!(input instanceof File)) {
    return { ok: false, error: "El archivo no se pudo leer." };
  }
  if (!GIF_TYPES.includes(input.type as (typeof GIF_TYPES)[number])) {
    return { ok: false, error: "Usa un GIF, WebP, PNG o JPG." };
  }
  if (input.size > MAX_GIF_BYTES) {
    return { ok: false, error: "La imagen supera los 4 MB." };
  }
  if (isOffline()) {
    return { ok: false, error: "Sin conexión: la imagen no se puede subir ahora." };
  }

  const path = `coach/${exerciseId}-${Date.now()}.${extensionFor(input.type)}`;
  const { error } = await supabase.storage.from(COACH_GIF_BUCKET).upload(path, input, {
    cacheControl: "31536000",
    contentType: input.type,
    upsert: true,
  });
  if (error) return { ok: false, error: error.message };

  const url = publicUrlFor(path);
  if (!url) return { ok: false, error: "La subida terminó pero la URL pública no se pudo leer." };

  const persisted = await persistCoachExerciseChange(exerciseId, { gif_url: url });
  return { ok: true, url, remote: persisted.remote };
}