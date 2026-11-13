/**
 * resolveExercise.ts — one answer to "what does this exercise look like now".
 *
 * The catalog is a static asset; a coach's rename and machine assignment are not.
 * Every screen that shows an exercise used to read the row directly, so a rename
 * reached some screens, some of the time, after a cache expired.
 *
 * This module is the one place that merges the two: the shipped row, the coach's
 * overrides for that id, and the machine the row is mapped to. Components ask for
 * an exercise by id or by name and get a row whose name, machine and media are
 * already the ones to render.
 *
 * It is pure and synchronous: no React, no network, no store writes.
 */

import { equipmentMap } from "@/data/equipmentMap";
import { translateEquipment } from "@/lib/i18n";
import { resolveMediaUrl } from "@/lib/media/mediaResolver";
import { repairMojibake } from "@/lib/text/mojibake";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { peekLoadedCatalog } from "./catalogRegistry";
import {
  readOverridesSnapshot,
  type CatalogOverride,
  type CatalogOverridesSnapshot,
} from "./customExercises";
import type { CatalogExercise, StationKey } from "./types";

/** The id a bodyweight row carries when it has no machine. */
export const NO_EQUIPMENT_ID = "NONE";

/** A station that cannot host a session, whatever the availability flag says. */
const UNAVAILABLE_STATION: StationKey = "unavailable_station";

export interface ResolvedCatalogExercise extends CatalogExercise {
  /** The name to show: the coach's name first, then the Spanish one. */
  displayName: string;
  /** The Spanish name, as an `exercises.name_es` value. */
  nameEs: string | null;
  effectiveEquipmentId: string;
  effectiveEquipmentName: string;
  effectiveEquipmentImage: string;
  effectiveGifUrl: string;
  effectiveImageUrl: string;
  stationKey: StationKey;
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

/**
 * Resolves one exercise by catalog id, or by name when the id is not known.
 *
 * Returns null for a name that matches nothing: a near-miss here would write a
 * set against the wrong movement.
 */
export function resolveCatalogExerciseWithOverrides(
  idOrName: string | null | undefined,
  rows?: readonly CatalogExercise[],
): ResolvedCatalogExercise | null {
  const wanted = (idOrName ?? "").trim();
  if (wanted === "") return null;
  const pool = rows ?? peekLoadedCatalog();
  const row =
    pool.find((candidate) => candidate.id === wanted) ??
    pool.find(
      (candidate) => normaliseExerciseName(candidate.name) === normaliseExerciseName(wanted),
    ) ??
    pool.find(
      (candidate) =>
        Boolean(candidate.name_es) &&
        normaliseExerciseName(candidate.name_es ?? "") === normaliseExerciseName(wanted),
    );
  if (!row) return null;
  return resolveCatalogExercise(row, readOverridesSnapshot());
}

/** Resolves a row against overrides already read. */
export function resolveCatalogExercise(
  row: CatalogExercise,
  overrides: CatalogOverridesSnapshot = readOverridesSnapshot(),
): ResolvedCatalogExercise {
  const override: CatalogOverride = overrides.catalog[row.id] ?? {};
  const customName = overrides.names[row.id] ?? override.customNameEs ?? row.customNameEs ?? null;

  const translated = getExerciseDisplayName({ name: row.name, name_es: row.name_es });
  const displayName = repairMojibake(customName ?? translated).trim() || row.name;
  const nameEs = repairMojibake(customName ?? row.name_es ?? (translated !== row.name ? translated : ""));

  const effectiveEquipmentId = override.equipment_id ?? row.equipment_id ?? NO_EQUIPMENT_ID;
  const mapped = effectiveEquipmentId === NO_EQUIPMENT_ID ? undefined : equipmentMap[effectiveEquipmentId];
  const equipmentName =
    repairMojibake(mapped?.name ?? row.equipment_name ?? "") || translateEquipment(row.equipment);
  const equipmentImage = mapped?.views?.[0]?.src ?? row.image_urls?.[0] ?? "";

  const stationKey = (override.station_key ?? row.station_key ?? "free_weight_area") as StationKey;
  const available = override.availableInCronosGym ?? row.availableInCronosGym ?? true;

  return {
    ...row,
    customNameEs: customName ?? undefined,
    displayName,
    nameEs: nameEs === "" ? null : nameEs,
    effectiveEquipmentId,
    effectiveEquipmentName: equipmentName,
    effectiveEquipmentImage: resolveMediaUrl(equipmentImage),
    effectiveGifUrl: resolveMediaUrl(row.gif_url),
    effectiveImageUrl: resolveMediaUrl(row.image),
    stationKey,
    station_key: stationKey,
    availableInCronosGym: available && stationKey !== UNAVAILABLE_STATION,
  };
}

/** Resolves many rows with one read of the override stores. */
export function resolveCatalogExercises(
  rows: readonly CatalogExercise[],
  overrides: CatalogOverridesSnapshot = readOverridesSnapshot(),
): ResolvedCatalogExercise[] {
  return rows.map((row) => resolveCatalogExercise(row, overrides));
}