/**
 * catalogCache.test.ts — the catalog on the device.
 *
 * jsdom has no IndexedDB, and the convention in this repository is that the
 * behaviour of IndexedDB itself is not this code's to test. What is this
 * code's to test is everything around it: that the catalog is compressed,
 * that it survives the round trip, that an old or corrupted row is ignored
 * rather than misread, and that a row older than its TTL is marked stale
 * instead of being thrown away.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { tx } from "@/lib/idb";
import {
  CATALOG_CACHE_KEY,
  CATALOG_CACHE_TTL_MS,
  CATALOG_CACHE_VERSION,
  compressText,
  decompressText,
  indexedDbCatalogCache,
  isFresh,
  type CatalogCacheRecord,
} from "./catalogCache";
import type { CatalogExercise } from "./types";

const { records } = vi.hoisted(() => ({ records: new Map<string, unknown>() }));

vi.mock("@/lib/idb", () => ({
  CATALOG_STORE: "catalog",
  tx: vi.fn(),
}));

function row(id: string): CatalogExercise {
  return {
    id,
    name: `Ejercicio ${id}`,
    category: "upper legs",
    body_part: "upper legs",
    equipment: "barbell",
    gif_url: `videos/${id}.gif`,
    image: `images/${id}.jpg`,
    muscle_group: "quadriceps",
    secondary_muscles: [],
    target: "quads",
    availableInCronosGym: true,
    instructions: { es: "Apártate" },
    instruction_steps: { es: ["Apártate"] },
    media_id: "abc",
    created_at: "2024-01-01",
    attribution: null,
  };
}

beforeEach(() => {
  records.clear();
  vi.mocked(tx).mockImplementation(async (_store, _mode, run) => {
    const objectStore = {
      get: (key: string) => ({ result: records.get(key) }),
      put: (value: CatalogCacheRecord) => {
        records.set(value.id, value);
        return { result: value.id };
      },
    };
    const request = run(objectStore as unknown as IDBObjectStore);
    return (request.result as string | undefined) ?? null;
  });
});

describe("compressText", () => {
  it("comprime y descomprime el mismo texto", async () => {
    const text = JSON.stringify([row("1"), row("2")]);

    const compressed = await compressText(text);
    expect(compressed).not.toBeNull();
    expect(await decompressText(compressed as ArrayBuffer)).toBe(text);
  });

  it("devuelve el texto tal cual cuando no está comprimido", async () => {
    const text = "sin comprimir";

    expect(await decompressText(text)).toBe(text);
  });
});

describe("isFresh", () => {
  it("acepta un catálogo recién guardado", () => {
    expect(isFresh(Date.now())).toBe(true);
  });

  it("rechaza un catálogo más viejo que su vida útil", () => {
    expect(isFresh(Date.now() - CATALOG_CACHE_TTL_MS - 1000)).toBe(false);
  });
});

describe("indexedDbCatalogCache", () => {
  it("no encuentra nada cuando no hay fila guardada", async () => {
    expect(await indexedDbCatalogCache.read()).toBeNull();
  });

  it("guarda el catálogo y lo devuelve", async () => {
    await indexedDbCatalogCache.write([row("1"), row("2")]);

    const cached = await indexedDbCatalogCache.read();

    expect(cached?.rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(cached?.fresh).toBe(true);
  });

  it("guarda el catálogo comprimido", async () => {
    await indexedDbCatalogCache.write([row("1")]);

    const record = records.get(CATALOG_CACHE_KEY) as CatalogCacheRecord;
    expect(record.version).toBe(CATALOG_CACHE_VERSION);
    expect(record.payload).toBeInstanceOf(ArrayBuffer);
  });

  it("ignora una fila de otra versión", async () => {
    records.set(CATALOG_CACHE_KEY, {
      id: CATALOG_CACHE_KEY,
      version: CATALOG_CACHE_VERSION + 1,
      storedAt: Date.now(),
      payload: await compressText(JSON.stringify([row("1")])),
    });

    expect(await indexedDbCatalogCache.read()).toBeNull();
  });

  it("ignora una fila corrupta en lugar de fallar", async () => {
    records.set(CATALOG_CACHE_KEY, {
      id: CATALOG_CACHE_KEY,
      version: CATALOG_CACHE_VERSION,
      storedAt: Date.now(),
      payload: new Uint8Array([1, 2, 3]).buffer,
    });

    expect(await indexedDbCatalogCache.read()).toBeNull();
  });

  it("marca como viejo un catálogo que pasó su vida útil", async () => {
    records.set(CATALOG_CACHE_KEY, {
      id: CATALOG_CACHE_KEY,
      version: CATALOG_CACHE_VERSION,
      storedAt: Date.now() - CATALOG_CACHE_TTL_MS - 1000,
      payload: await compressText(JSON.stringify([row("1")])),
    });

    const cached = await indexedDbCatalogCache.read();

    expect(cached?.rows).toHaveLength(1);
    expect(cached?.fresh).toBe(false);
  });
});
