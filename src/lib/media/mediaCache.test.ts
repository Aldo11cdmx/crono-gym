/**
 * mediaCache.test.ts — what stays on the device, and what goes first.
 *
 * The cache has two rules worth pinning: a medium is found by its key (not by
 * its URL), and when the quota is exceeded the animations are evicted before
 * the photos. jsdom has no IndexedDB, so the store is faked; the policy
 * itself -- which entry loses its place -- is pure and is tested directly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { tx } from "@/lib/idb";
import {
  MEDIA_CACHE_QUOTA_BYTES,
  isAnimation,
  mediaCacheBytes,
  readMedia,
  readMediaByUrl,
  selectEvictions,
  trimMediaCache,
  writeMedia,
  type MediaRecord,
} from "./mediaCache";

const { records } = vi.hoisted(() => ({ records: new Map<string, unknown>() }));

vi.mock("@/lib/idb", () => ({
  MEDIA_STORE: "media",
  tx: vi.fn(),
}));

function entry(id: string, kind: MediaRecord["kind"], bytes: number, lastUsed: number) {
  return { id, kind, bytes, lastUsed };
}

beforeEach(() => {
  records.clear();
  vi.mocked(tx).mockImplementation(async (_store, _mode, run) => {
    const objectStore = {
      get: (key: string) => ({ result: records.get(key) }),
      put: (value: MediaRecord) => {
        records.set(value.id, value);
        return { result: value.id };
      },
      delete: (key: string) => {
        records.delete(key);
        return { result: undefined };
      },
      getAll: () => ({ result: [...records.values()] }),
      index: (name: string) => ({
        get: (value: string) => ({
          result: [...records.values()].find(
            (record) => (record as MediaRecord)[name as "url"] === value,
          ),
        }),
      }),
    };
    const request = run(objectStore as unknown as IDBObjectStore);
    return (request.result as unknown) ?? null;
  });
});

describe("isAnimation", () => {
  it("trata el GIF como animación y el resto como imagen", () => {
    expect(isAnimation("exercise-gif")).toBe(true);
    expect(isAnimation("exercise-image")).toBe(false);
    expect(isAnimation("equipment-photo")).toBe(false);
  });
});

describe("selectEvictions", () => {
  it("no evoca nada cuando el caché cabe en la cuota", () => {
    const entries = [entry("a", "exercise-gif", 100, 1), entry("b", "equipment-photo", 100, 2)];

    expect(selectEvictions(entries, 1000)).toEqual([]);
  });

  it("evoca primero la animación más antigua", () => {
    const entries = [
      entry("gif-old", "exercise-gif", 100, 1),
      entry("gif-new", "exercise-gif", 100, 5),
      entry("photo", "equipment-photo", 100, 2),
    ];

    // 300 bytes in a 250 byte quota: freeing the oldest animation is enough.
    expect(selectEvictions(entries, 250)).toEqual(["gif-old"]);
  });

  it("no toca las fotos mientras queden animaciones", () => {
    const entries = [
      entry("gif", "exercise-gif", 100, 1),
      entry("photo", "equipment-photo", 100, 2),
    ];

    expect(selectEvictions(entries, 150)).toEqual(["gif"]);
  });

  it("evoca también las fotos cuando no queda ninguna animación", () => {
    const entries = [entry("photo", "equipment-photo", 100, 2)];

    expect(selectEvictions(entries, 50)).toEqual(["photo"]);
  });

  it("evoca lo justo para volver a caber en la cuota", () => {
    const entries = [
      entry("a", "exercise-gif", 100, 1),
      entry("b", "exercise-gif", 100, 2),
      entry("c", "equipment-photo", 100, 3),
    ];

    expect(selectEvictions(entries, 150)).toEqual(["a", "b"]);
  });
});

describe("the media cache", () => {
  it("guarda un medio bajo su clave y lo devuelve", async () => {
    const blob = new Blob(["gif"], { type: "image/gif" });

    await writeMedia("exercise-gif:0001", "https://cdn.test/0001.gif", "exercise-gif", blob);
    const read = await readMedia("exercise-gif:0001");

    expect(read).not.toBeNull();
    expect(await read?.text()).toBe("gif");
  });

  it("encuentra un medio por la URL con la que se descargó", async () => {
    const blob = new Blob(["gif"], { type: "image/gif" });

    await writeMedia("exercise-gif:0001", "https://cdn.test/0001.gif", "exercise-gif", blob);
    const record = await readMediaByUrl("https://cdn.test/0001.gif");

    expect(record?.id).toBe("exercise-gif:0001");
  });

  it("no encuentra un medio que no está", async () => {
    expect(await readMedia("exercise-gif:9999")).toBeNull();
  });

  it("evoca la animación más antigua cuando se pasa la cuota", async () => {
    await writeMedia(
      "exercise-gif:0001",
      "https://cdn.test/0001.gif",
      "exercise-gif",
      new Blob(["x".repeat(100)]),
    );
    await writeMedia(
      "equipment-photo:1",
      "https://cdn.test/eq.jpg",
      "equipment-photo",
      new Blob(["y".repeat(10)]),
    );

    await trimMediaCache(50);

    expect(await readMedia("exercise-gif:0001")).toBeNull();
    expect(await readMedia("equipment-photo:1")).not.toBeNull();
  });

  it("suma lo que ocupa el caché", async () => {
    await writeMedia(
      "exercise-gif:0001",
      "https://cdn.test/0001.gif",
      "exercise-gif",
      new Blob(["x".repeat(100)]),
    );

    expect(await mediaCacheBytes()).toBe(100);
  });

  it("tiene una cuota por defecto que cabe en el dispositivo", () => {
    expect(MEDIA_CACHE_QUOTA_BYTES).toBeGreaterThan(0);
    expect(MEDIA_CACHE_QUOTA_BYTES).toBeLessThanOrEqual(128 * 1024 * 1024);
  });
});
