/**
 * idb.ts — the single owner of the `cronos-offline` database.
 *
 * This file exists because two modules used to open the same database with
 * different declared versions: `offlineStore` asked for v1, `rankHistory` asked for
 * v2. IndexedDB rejects an `open()` whose version is *lower* than the database's
 * current one with a `VersionError`, and both callers caught that error and resolved
 * `null` — which is exactly the "degrade to a no-op" behaviour they wanted. So the
 * workout queue did not crash when the two collided; it silently stopped queueing,
 * depending on which module happened to open the database first.
 *
 * One owner, one version, one upgrade handler. Every store the app needs is created
 * here, so adding one means adding a line to {@link STORES} rather than bumping a
 * version somewhere and hoping every other module agrees.
 *
 * The failure mode stays what it was by design: no IndexedDB, a blocked upgrade or an
 * exhausted quota all resolve to `null`, because logging and drafting must never be
 * the thing that breaks a workout. Callers already handle that.
 */

/** Database name. Stable across releases: changing it would orphan local drafts. */
export const DB_NAME = "cronos-offline";

/**
 * Current schema version.
 *
 * v1: `drafts`, `queue` (offline workout store)
 * v2: `rankHistory`, `lastRanks` (rank timeline and hysteresis input)
 * v3: `coachChats` (the assistant's daily conversation log)
 */
export const DB_VERSION = 3;

export const DRAFT_STORE = "drafts";
export const QUEUE_STORE = "queue";
export const RANK_HISTORY_STORE = "rankHistory";
export const LAST_RANKS_STORE = "lastRanks";
export const COACH_CHATS_STORE = "coachChats";

/**
 * Every store in the database, with the index each one needs.
 *
 * A table rather than imperative statements in the upgrade handler, so the schema is
 * one readable thing and a store cannot be created with the wrong key path in one
 * branch and the right one in another. Indexes are additive: `createIndex` on an
 * existing name is a no-op that throws only if the key path differs, and no two
 * entries here ever do.
 */
export const STORES: readonly {
  name: string;
  keyPath: string;
  indexes?: readonly string[];
}[] = [
  // Keyed by logId so a single active session per device is enough.
  { name: DRAFT_STORE, keyPath: "logId" },
  { name: QUEUE_STORE, keyPath: "id", indexes: ["createdAt"] },
  { name: RANK_HISTORY_STORE, keyPath: "id", indexes: ["day", "slug"] },
  { name: LAST_RANKS_STORE, keyPath: "slug" },
  // Keyed by the ISO day, so there is exactly one conversation per calendar day.
  { name: COACH_CHATS_STORE, keyPath: "id" },
];

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Opens the database, upgrading it if needed.
 *
 * Memoized on the promise rather than the handle, so two callers racing on first use
 * share one connection instead of opening two. Concurrent opens of the same version
 * are legal; concurrent *upgrades* are not, which is what `onblocked` is for.
 */
export function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    // Absent in SSR and in some hardened browsers.
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const spec of STORES) {
          if (db.objectStoreNames.contains(spec.name)) continue;
          const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath });
          for (const index of spec.indexes ?? []) store.createIndex(index, index);
        }
      };

      request.onsuccess = () => resolve(request.result);
      // Private browsing and blocked storage land here; never throw at the user.
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Runs one request against one store, resolving `null` on every failure.
 *
 * Shared by all four stores so the degradation contract lives in one place: a
 * missing database, a missing store and a failed request are all "nothing to
 * report", never an exception. The alternative — each store reimplementing this —
 * is how the version bug happened in the first place.
 */
export function tx<T>(
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

/**
 * Drops the memoized connection.
 *
 * Test-only: the promise cache is module state, so a suite that needs a fresh
 * database — a migration from an older version, an upgrade path — has no other way
 * to make the next `openDb()` open anything. Production code must never need this.
 */
export function resetDbForTests(): void {
  dbPromise = null;
}