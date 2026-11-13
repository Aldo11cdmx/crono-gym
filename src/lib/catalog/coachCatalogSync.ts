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
import { peekLoadedCatalog } from "./catalogRegistry";
import {
  mergeOverridesFromRemote,
  saveCatalogOverride,
  type CatalogOverride,
  type CatalogOverrides,
} from "./customExercises";
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

/** The columns this module writes. The base ones exist in every deployment. */
const GOVERNANCE_COLUMNS =
  "id,name,equipment,gif_url,image,equipment_id,equipment_name,station_key,movement_pattern,available_in_cronos_gym";

const BASE_COLUMNS = "id,name,equipment,gif_url,image";

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
  return typeof message === "string" && /column .* does not exist/i.test(message);
}

function isMissingValue(error: unknown): boolean {
  const { code, message } = errorOf(error);
  return (
    code === "23502" ||
    (typeof message === "string" && /null value in column|violates not-null/i.test(message))
  );
}

/** The device is offline, or the browser does not say. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function findLocalRow(exerciseId: string): CatalogExercise | undefined {
  return peekLoadedCatalog().find((row) => row.id === exerciseId);
}

/** The columns a write can fill from what is known locally. */
function basePayload(exerciseId: string, row: CatalogExercise | undefined): ExerciseInsert {
  const payload: ExerciseInsert = {
    id: exerciseId,
    name: row?.name ?? exerciseId,
    body_part: row?.body_part ?? "other",
    target: row?.target ?? "other",
    equipment: row?.equipment ?? "other",
    gif_url: row?.gif_url ?? "",
  };
  if (row?.image) payload.image = row.image;
  if (row?.equipment_id) payload.equipment_id = row.equipment_id;
  if (row?.movement_pattern) payload.movement_pattern = row.movement_pattern;
  if (typeof row?.availableInCronosGym === "boolean") {
    payload.available_in_cronos_gym = row.availableInCronosGym;
  }
  return payload;
}

/**
 * Writes one governance change: local first, then remote.
 *
 * `row` is the catalog row the coach is editing; when it is not given the local
 * catalog mirror is consulted, and when that has nothing either the write goes
 * out as an update of the governance columns only -- never as an insert that
 * would need a name the server does not have.
 */
export async function persistCoachExerciseChange(
  exerciseId: string,
  override: CatalogOverride,
  row?: CatalogExercise | null,
): Promise<CoachSyncResult> {
  // Tier 1: the coach sees the change now, online or not.
  saveCatalogOverride(exerciseId, override);

  if (isOffline()) return { local: true, remote: "offline" };
  if (typeof supabase?.from !== "function") return { local: true, remote: "skipped" };

  const source = row ?? findLocalRow(exerciseId);
  const governance: ExerciseUpdate = {};
  if (override.equipment_id !== undefined) governance.equipment_id = override.equipment_id;
  if (override.station_key !== undefined) governance.station_key = override.station_key;
  if (override.availableInCronosGym !== undefined) {
    governance.available_in_cronos_gym = override.availableInCronosGym;
  }
  if (override.gif_url !== undefined) governance.gif_url = override.gif_url;
  if (override.customNameEs !== undefined) governance.name = override.customNameEs;

  // An insert needs every required column; without the row there is nothing to
  // insert, so the write becomes an update of the columns that do exist.
  const canInsert = Boolean(source?.name && source?.equipment);
  const full: ExerciseInsert = { ...basePayload(exerciseId, source), ...governance };

  if (!canInsert) {
    const { error } = await supabase.from(TABLE).update(governance).eq("id", exerciseId);
    if (!error) return { local: true, remote: "updated" };
    if (isUndefinedColumn(error)) {
      // The server is on the old schema: only the columns it has always had.
      const base: ExerciseUpdate = {};
      if (governance.name !== undefined) base.name = governance.name;
      if (governance.gif_url !== undefined) base.gif_url = governance.gif_url;
      const retry = await supabase.from(TABLE).update(base).eq("id", exerciseId);
      if (!retry.error) return { local: true, remote: "updated" };
      return { local: true, remote: "unavailable", detail: retry.error.message };
    }
    return { local: true, remote: "unavailable", detail: error.message };
  }

  const { error } = await supabase.from(TABLE).upsert(full);
  if (!error) return { local: true, remote: "upserted" };

  if (isUndefinedColumn(error)) {
    // The server is on the old schema: keep the name and the media, which are
    // the columns the app has always read.
    const base: ExerciseInsert = {
      id: exerciseId,
      name: governance.name ?? source?.name ?? exerciseId,
      body_part: source?.body_part ?? "other",
      target: source?.target ?? "other",
      equipment: source?.equipment ?? "other",
      gif_url: governance.gif_url ?? source?.gif_url ?? "",
    };
    if (source?.image) base.image = source.image;

    const retry = await supabase.from(TABLE).upsert(base);
    if (!retry.error) return { local: true, remote: "upserted" };
    return { local: true, remote: "unavailable", detail: retry.error.message };
  }

  if (isMissingValue(error)) {
    // The row is not there to update: the local catalog is the only copy, and
    // the coach is told rather than losing the change silently.
    return { local: true, remote: "unavailable", detail: error.message };
  }

  return { local: true, remote: "unavailable", detail: error.message };
}

/**
 * Takes the remote catalog into the local override store.
 *
 * Called once when the portal opens, and once when the app signs in: the device
 * copy is a cache, and a coach who edited on another machine has to see the same
 * names and machines here. The merge is per field and announced once.
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
  const localById = new Map(local.map((row) => [row.id, row]));
  const overrides: CatalogOverrides = {};

  for (const row of rows) {
    if (!row?.id) continue;
    const override: CatalogOverride = {};
    if (row.equipment_id) override.equipment_id = row.equipment_id;
    if (row.station_key) override.station_key = row.station_key as StationKey;
    if (typeof row.available_in_cronos_gym === "boolean") {
      override.availableInCronosGym = row.available_in_cronos_gym;
    }
    // A remote GIF only counts as a coach's choice when it differs from the one
    // the device shipped; otherwise every row would carry an override and the
    // shipped demonstrations would stop updating with the app.
    const shipped = localById.get(row.id)?.gif_url;
    if (row.gif_url && shipped && row.gif_url !== shipped) override.gif_url = row.gif_url;
    if (Object.keys(override).length > 0) overrides[row.id] = override;
  }

  const hydrated = mergeOverridesFromRemote(overrides);
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