/**
 * mediaCache.ts — the exercise media, kept on the device.
 *
 * The animations are the largest thing the app downloads after the catalog
 * itself: 1,324 GIFs and 1,324 photos, all of them reachable from the
 * catalogue. Caching them is what lets a session start with no connection --
 * the catalogue opens, the exercises are there, and the demonstration plays.
 *
 * Two rules shape the cache:
 *
 *  - **A medium is identified by its key, not by its URL.** The key says what
 *    the medium depicts (`exercise-gif:0001`), so moving the files to another
 *    CDN does not throw the cache away.
 *  - **Animations go before photos.** When the quota is exceeded, the
 *    animations are the first to be evicted: a photo of a machine is small and
 *    tells the user what they are about to lift, while a GIF is a nicety.
 *
 * The cache never throws. A missing database, an exhausted quota and a failed
 * write are all "there is no cache", because the media is an optimisation: the
 * app must still work without it.
 */

import { MEDIA_STORE, tx } from "@/lib/idb";
import type { MediaKind } from "./mediaResolver";

/**
 * How much the media cache may occupy.
 *
 * 64 MB: a couple of hundred GIFs, which is more than a user watches in a
 * month, and small enough to live next to the drafts and the rank history
 * without asking the browser for more quota.
 */
export const MEDIA_CACHE_QUOTA_BYTES = 64 * 1024 * 1024;

export interface MediaRecord {
  /** The media key: what the medium depicts. */
  id: string;
  /** The URL it was fetched from, so a request can be answered from the cache. */
  url: string;
  kind: MediaKind;
  bytes: number;
  lastUsed: number;
  blob: Blob;
}

/** The part of a record the eviction policy needs. */
export interface MediaEntry {
  id: string;
  kind: MediaKind;
  bytes: number;
  lastUsed: number;
}

/** Animations are the first to go: they are the largest and the least load-bearing. */
export function isAnimation(kind: MediaKind): boolean {
  return kind === "exercise-gif";
}

/**
 * The ids to remove so the cache fits inside the quota.
 *
 * Animations first, oldest first within each group; photos are only touched
 * when there is nothing else left to evict.
 */
export function selectEvictions(entries: MediaEntry[], quota: number): string[] {
  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total <= quota) return [];

  const byAge = (a: MediaEntry, b: MediaEntry) => a.lastUsed - b.lastUsed;
  const ordered = [
    ...entries.filter((entry) => isAnimation(entry.kind)).sort(byAge),
    ...entries.filter((entry) => !isAnimation(entry.kind)).sort(byAge),
  ];

  const evicted: string[] = [];
  let freed = 0;
  for (const entry of ordered) {
    if (total - freed <= quota) break;
    evicted.push(entry.id);
    freed += entry.bytes;
  }
  return evicted;
}

/** Reads a medium, and counts as used. */
export async function readMedia(key: string): Promise<Blob | null> {
  const record = await tx<MediaRecord>(MEDIA_STORE, "readonly", (store) => store.get(key));
  if (!record?.blob) return null;

  // Touch it: an entry nobody reads is the next one to be evicted.
  void tx(MEDIA_STORE, "readwrite", (store) =>
    store.put({ ...record, lastUsed: Date.now() }),
  );
  return record.blob;
}

/** Finds a medium by the URL it was fetched from. Used by the service worker. */
export async function readMediaByUrl(url: string): Promise<MediaRecord | null> {
  const record = await tx<MediaRecord>(MEDIA_STORE, "readonly", (store) =>
    store.index("url").get(url),
  );
  return record ?? null;
}

/** Stores a medium and trims the cache if it no longer fits in the quota. */
export async function writeMedia(
  key: string,
  url: string,
  kind: MediaKind,
  blob: Blob,
): Promise<void> {
  await tx(MEDIA_STORE, "readwrite", (store) =>
    store.put({
      id: key,
      url,
      kind,
      bytes: blob.size,
      lastUsed: Date.now(),
      blob,
    } satisfies MediaRecord),
  );
  await trimMediaCache();
}

/** Evicts until the cache fits in the quota. Animations go first. */
export async function trimMediaCache(quota: number = MEDIA_CACHE_QUOTA_BYTES): Promise<void> {
  const records = await tx<MediaRecord[]>(MEDIA_STORE, "readonly", (store) => store.getAll());
  if (!records || records.length === 0) return;

  const evicted = selectEvictions(records, quota);
  if (evicted.length === 0) return;

  for (const id of evicted) {
    await tx(MEDIA_STORE, "readwrite", (store) => store.delete(id));
  }
}

/** How much the cache occupies. Used by the settings panel and by the tests. */
export async function mediaCacheBytes(): Promise<number> {
  const records = await tx<MediaRecord[]>(MEDIA_STORE, "readonly", (store) => store.getAll());
  if (!records) return 0;
  return records.reduce((sum, record) => sum + record.bytes, 0);
}
