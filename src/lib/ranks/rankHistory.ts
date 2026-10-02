/**
 * rankHistory.ts — IndexedDB persistence for the ranks timeline.
 *
 * Two things need to survive a reload:
 *
 *  - `rankHistory`: one row per actual rank change, which is what the evolution
 *    chart plots. Deliberately *not* a score series: a muscle whose score drifts
 *    from 44 to 46 without crossing a threshold produced no rank, and plotting
 *    that as an event would put dozens of meaningless points on the timeline.
 *  - `lastRanks`: the rank each muscle held at the last computation, which is
 *    the input to hysteresis. Without it a reload would treat every rank as new,
 *    and the demotion buffer would have nothing to protect.
 *
 * History rows are keyed so re-recording the same change cannot duplicate:
 * `slug + rank + day`. A user who drops and regains the same rank on the same day
 * is the same fact as far as the timeline is concerned.
 *
 * Everything degrades to a no-op if IndexedDB is unavailable, exactly like
 * `offlineStore`: a missing timeline must never break the map.
 */

const DB_NAME = "cronos-offline";
/** Bumped to add the rank stores; existing stores are left untouched. */
const DB_VERSION = 2;
const RANK_HISTORY_STORE = "rankHistory";
const LAST_RANKS_STORE = "lastRanks";

/** One recorded rank change. */
export interface RankHistoryRecord {
  /** Composite key: `${slug}|${rank}|${day}`. */
  id: string;
  slug: string;
  rank: string;
  score: number;
  /** ISO timestamp of the change. */
  recordedAt: string;
  /** ISO date, `YYYY-MM-DD`, used for the timeline axis. */
  day: string;
}

/** The rank map's last known state, for hysteresis across reloads. */
export interface LastRanksRecord {
  /** Muscle slug. */
  slug: string;
  rank: string;
  score: number;
  updatedAt: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RANK_HISTORY_STORE)) {
          const store = db.createObjectStore(RANK_HISTORY_STORE, { keyPath: "id" });
          store.createIndex("day", "day");
          store.createIndex("slug", "slug");
        }
        if (!db.objectStoreNames.contains(LAST_RANKS_STORE)) {
          db.createObjectStore(LAST_RANKS_STORE, { keyPath: "slug" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      // A version-2 open blocked by another tab is not an error worth surfacing.
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const transaction = db.transaction(store, mode);
          const request = run(transaction.objectStore(store));
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
          transaction.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

/** `YYYY-MM-DD` in UTC, so timeline grouping never depends on the local clock. */
export function isoDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Composite id, so writing the same change twice is a no-op. */
export function rankHistoryId(slug: string, rank: string, day: string): string {
  return `${slug}|${rank}|${day}`;
}

/**
 * Appends rank changes.
 *
 * `put` rather than `add`, so a duplicate on the same day overwrites instead of
 * throwing a ConstraintError that would reject the whole batch.
 */
export async function appendRankHistory(
  records: Omit<RankHistoryRecord, "id">[],
): Promise<number> {
  if (records.length === 0) return 0;
  let written = 0;
  for (const record of records) {
    const row: RankHistoryRecord = {
      ...record,
      id: rankHistoryId(record.slug, record.rank, record.day),
    };
    const result = await tx(RANK_HISTORY_STORE, "readwrite", (store) => store.put(row));
    if (result !== null) written += 1;
  }
  return written;
}

/** Whole timeline, oldest first. */
export async function loadRankHistory(): Promise<RankHistoryRecord[]> {
  const rows = await tx<RankHistoryRecord[]>(RANK_HISTORY_STORE, "readonly", (store) =>
    store.getAll(),
  );
  return (rows ?? []).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

/** Timeline for one muscle, oldest first. */
export async function loadRankHistoryFor(slug: string): Promise<RankHistoryRecord[]> {
  const rows = await tx<RankHistoryRecord[]>(RANK_HISTORY_STORE, "readonly", (store) =>
    store.index("slug").getAll(slug),
  );
  return (rows ?? []).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

/** Replaces the stored ranks with a fresh snapshot. */
export async function saveLastRanks(
  snapshot: Record<string, string>,
  scores: Record<string, number>,
  now: string = new Date().toISOString(),
): Promise<void> {
  for (const [slug, rank] of Object.entries(snapshot)) {
    const row: LastRanksRecord = { slug, rank, score: scores[slug] ?? 0, updatedAt: now };
    await tx(LAST_RANKS_STORE, "readwrite", (store) => store.put(row));
  }
}

export async function loadLastRanks(): Promise<Record<string, string>> {
  const rows = await tx<LastRanksRecord[]>(LAST_RANKS_STORE, "readonly", (store) =>
    store.getAll(),
  );
  const snapshot: Record<string, string> = {};
  for (const row of rows ?? []) snapshot[row.slug] = row.rank;
  return snapshot;
}

/**
 * Drops every rank record.
 *
 * Used when signing out, so the next account on this device does not inherit the
 * previous user's ranks, timeline and demotion buffer. `lastRanks` especially
 * matters: without this, a new user would start with someone else's rank held and
 * the hysteresis buffer would protect a rank they never earned.
 */
export async function clearRankData(): Promise<void> {
  await tx(RANK_HISTORY_STORE, "readwrite", (store) => store.clear());
  await tx(LAST_RANKS_STORE, "readwrite", (store) => store.clear());
}

/** Drops history for one muscle, used when a set of sessions is deleted. */
export async function clearRankHistoryFor(slug: string): Promise<void> {
  const rows = await loadRankHistoryFor(slug);
  for (const row of rows) {
    await tx(RANK_HISTORY_STORE, "readwrite", (store) => store.delete(row.id));
  }
}