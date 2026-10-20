/**
 * catalogLoader.test.ts — the catalog is downloaded once, kept, and reused.
 *
 * The point of the loader is that a 16.3 MB file is not part of the entry
 * bundle, so the assertions that matter are about *when* and *how many times*
 * the file is fetched, and about what happens when there is no network: a
 * device that already has the catalog must still show it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CatalogLoadError,
  isCatalogExercise,
  loadCatalog,
  resetCatalogCache,
} from "./catalogLoader";
import type { CatalogCache, CachedCatalog } from "./catalogCache";
import type { CatalogExercise } from "./types";

function row(id: string, name: string): CatalogExercise {
  return {
    id,
    name,
    category: "upper legs",
    body_part: "upper legs",
    equipment: "barbell",
    gif_url: `videos/${id}.gif`,
    image: `images/${id}.jpg`,
    muscle_group: "quadriceps",
    secondary_muscles: ["hamstrings"],
    target: "quads",
    availableInCronosGym: true,
    instructions: { es: "Apártate" },
    instruction_steps: { es: ["Apártate"] },
    media_id: "abc",
    created_at: "2024-01-01",
    attribution: null,
  };
}

function okResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

/** A store that keeps what it is given, so the tests can inspect it. */
function fakeStore(initial: CachedCatalog | null = null) {
  let stored = initial;
  const cache: CatalogCache = {
    read: async () => stored,
    write: async (rows) => {
      stored = { rows, storedAt: Date.now(), fresh: true };
    },
  };
  return { cache, read: () => stored };
}

beforeEach(() => {
  resetCatalogCache();
});

describe("loadCatalog", () => {
  it("devuelve las filas utilizables del catálogo", async () => {
    const fetchImpl = vi.fn(async () => okResponse([row("1", "Sentadilla"), row("2", "Peso muerto")]));

    const rows = await loadCatalog({ url: "/catalog.json", fetchImpl });

    expect(rows.map((r) => r.name)).toEqual(["Sentadilla", "Peso muerto"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/catalog.json");
  });

  it("descarta las filas sin identificador o sin nombre", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse([row("1", "Sentadilla"), { id: "", name: "Sin id", gif_url: "videos/x.gif" }, { id: "3", name: "Sin gif" }]),
    );

    const rows = await loadCatalog({ url: "/catalog.json", fetchImpl });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("1");
  });

  it("comparte una sola descarga entre llamadas concurrentes", async () => {
    let resolveJson: (value: unknown) => void = () => undefined;
    const json = new Promise((resolve) => {
      resolveJson = resolve;
    });
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          text: () => json.then((value) => JSON.stringify(value)),
        }) as unknown as Response,
    );

    const first = loadCatalog({ url: "/catalog.json", fetchImpl });
    const second = loadCatalog({ url: "/catalog.json", fetchImpl });
    resolveJson([row("1", "Sentadilla")]);

    const [a, b] = await Promise.all([first, second]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("sirve la segunda llamada desde la caché, sin volver a descargar", async () => {
    const fetchImpl = vi.fn(async () => okResponse([row("1", "Sentadilla")]));

    await loadCatalog({ url: "/catalog.json", fetchImpl });
    const again = await loadCatalog({ url: "/catalog.json", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(again[0].name).toBe("Sentadilla");
  });

  it("falla con CatalogLoadError cuando la respuesta no es correcta", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }) as Response);

    await expect(loadCatalog({ url: "/catalog.json", fetchImpl })).rejects.toBeInstanceOf(
      CatalogLoadError,
    );
  });

  it("falla cuando el catálogo no es una lista", async () => {
    const fetchImpl = vi.fn(async () => okResponse({ exercises: [] }));

    await expect(loadCatalog({ url: "/catalog.json", fetchImpl })).rejects.toBeInstanceOf(
      CatalogLoadError,
    );
  });

  it("falla cuando la lista no contiene ninguna fila utilizable", async () => {
    const fetchImpl = vi.fn(async () => okResponse([{ id: "", name: "" }]));

    await expect(loadCatalog({ url: "/catalog.json", fetchImpl })).rejects.toBeInstanceOf(
      CatalogLoadError,
    );
  });

  it("no envenena la caché cuando la descarga falla", async () => {
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(okResponse([row("1", "Sentadilla")]));

    await expect(loadCatalog({ url: "/catalog.json", fetchImpl })).rejects.toThrow("offline");
    const rows = await loadCatalog({ url: "/catalog.json", fetchImpl });

    expect(rows).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("vuelve a descargar tras resetCatalogCache", async () => {
    const fetchImpl = vi.fn(async () => okResponse([row("1", "Sentadilla")]));

    await loadCatalog({ url: "/catalog.json", fetchImpl });
    resetCatalogCache();
    await loadCatalog({ url: "/catalog.json", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("loadCatalog con el catálogo guardado en el dispositivo", () => {
  it("sirve el catálogo guardado sin tocar la red", async () => {
    const fetchImpl = vi.fn(async () => okResponse([row("9", "De la red")]));
    const store = fakeStore({ rows: [row("1", "Guardado")], storedAt: Date.now(), fresh: true });

    const rows = await loadCatalog({ url: "/catalog.json", fetchImpl, cache: store.cache });

    expect(rows[0].name).toBe("Guardado");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refresca un catálogo guardado que ya está viejo", async () => {
    const fetchImpl = vi.fn(async () => okResponse([row("9", "De la red")]));
    const store = fakeStore({ rows: [row("1", "Guardado")], storedAt: 0, fresh: false });

    const rows = await loadCatalog({ url: "/catalog.json", fetchImpl, cache: store.cache });

    expect(rows[0].name).toBe("De la red");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("usa el catálogo guardado cuando no hay red", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const store = fakeStore({ rows: [row("1", "Guardado")], storedAt: 0, fresh: false });

    const rows = await loadCatalog({ url: "/catalog.json", fetchImpl, cache: store.cache });

    expect(rows[0].name).toBe("Guardado");
  });

  it("falla si no hay red y tampoco hay catálogo guardado", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const store = fakeStore(null);

    await expect(
      loadCatalog({ url: "/catalog.json", fetchImpl, cache: store.cache }),
    ).rejects.toThrow("offline");
  });

  it("guarda el catálogo descargado para el siguiente arranque", async () => {
    const fetchImpl = vi.fn(async () => okResponse([row("1", "Sentadilla")]));
    const store = fakeStore();

    await loadCatalog({ url: "/catalog.json", fetchImpl, cache: store.cache });

    expect(store.read()?.rows[0].name).toBe("Sentadilla");
  });
});

describe("isCatalogExercise", () => {
  it("acepta una fila con identificador, nombre y gif", () => {
    expect(isCatalogExercise(row("1", "Sentadilla"))).toBe(true);
  });

  it("rechaza valores que no son filas", () => {
    expect(isCatalogExercise(null)).toBe(false);
    expect(isCatalogExercise("Sentadilla")).toBe(false);
    expect(isCatalogExercise({ id: "1" })).toBe(false);
  });
});
