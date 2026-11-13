// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogExercise } from "./types";
import {
  CATALOG_OVERRIDES_KEY,
  EXERCISE_NAME_OVERRIDES_KEY,
  readOverridesSnapshot,
  saveCatalogOverride,
  saveNameOverride,
  invalidateOverridesSnapshot,
} from "./customExercises";
import { resetCatalogRegistry, setLoadedCatalog } from "./catalogRegistry";
import {
  NO_EQUIPMENT_ID,
  normaliseExerciseName,
  resolveCatalogExercise,
  resolveCatalogExercises,
  resolveCatalogExerciseWithOverrides,
} from "./resolveExercise";

function row(overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id: "0001",
    name: "3/4 sit-up",
    name_es: null,
    category: "strength",
    body_part: "waist",
    equipment: "body weight",
    gif_url: "https://cdn.example/0001.gif",
    image: "https://cdn.example/0001.jpg",
    muscle_group: "abdominals",
    secondary_muscles: [],
    target: "rectus abdominis",
    availableInCronosGym: true,
    equipment_id: "NONE",
    instructions: {},
    instruction_steps: {},
    media_id: "0001",
    created_at: "2026-01-01T00:00:00.000Z",
    attribution: null,
    ...overrides,
  };
}

function setOverride(id: string, value: unknown): void {
  window.localStorage.setItem(CATALOG_OVERRIDES_KEY, JSON.stringify({ [id]: value }));
}

function setName(id: string, value: unknown): void {
  window.localStorage.setItem(EXERCISE_NAME_OVERRIDES_KEY, JSON.stringify({ [id]: value }));
}

beforeEach(() => {
  window.localStorage.clear();
  resetCatalogRegistry();
  invalidateOverridesSnapshot();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normaliseExerciseName", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normaliseExerciseName("Press Militar")).toBe("press militar");
    expect(normaliseExerciseName("Elevación lateral")).toBe("elevacion lateral");
    expect(normaliseExerciseName("  Curl-de   bíceps ")).toBe("curl de biceps");
  });
});

describe("resolveCatalogExercise", () => {
  it("falls back to the machine the dataset already mapped", () => {
    const resolved = resolveCatalogExercise(
      row({
        equipment_id: "CG-EQP-0003",
        equipment_name: "Press de banca",
        equipment: "barbell",
        image_urls: ["public/images/gym-equipment/CG-EQP-0003_press.jpg"],
      }),
      { catalog: {}, names: {} },
    );
    expect(resolved.effectiveEquipmentId).toBe("CG-EQP-0003");
    expect(resolved.effectiveEquipmentName).toBe("Maquina Curl Femoral Acostado");
    expect(resolved.effectiveEquipmentImage).toContain("CG-EQP-0003");
  });

  it("uses the dataset's own label when the id maps to nothing", () => {
    const resolved = resolveCatalogExercise(
      row({ equipment_id: "CG-EQP-9999", equipment_name: "Press de banca" }),
      { catalog: {}, names: {} },
    );
    expect(resolved.effectiveEquipmentName).toBe("Press de banca");
  });

  it("prefers the coach's machine over the dataset's", () => {
    const resolved = resolveCatalogExercise(
      row({ equipment_id: "CG-EQP-0003", equipment_name: "Press de banca" }),
      { catalog: { "0001": { equipment_id: "CG-EQP-0010" } }, names: {} },
    );
    expect(resolved.effectiveEquipmentId).toBe("CG-EQP-0010");
  });

  it("keeps the raw equipment for the smart-load engine", () => {
    const resolved = resolveCatalogExercise(
      row({ equipment: "dumbbell", equipment_id: "CG-EQP-0040" }),
      { catalog: {}, names: {} },
    );
    expect(resolved.equipment).toBe("dumbbell");
    expect(resolved.effectiveEquipmentName).not.toBe("dumbbell");
  });

  it("reports no machine for a bodyweight row, with the dataset's label", () => {
    const resolved = resolveCatalogExercise(row({ equipment: "body weight" }), {
      catalog: {},
      names: {},
    });
    expect(resolved.effectiveEquipmentId).toBe(NO_EQUIPMENT_ID);
    expect(resolved.effectiveEquipmentName).toBe("Peso corporal");
  });

  it("names the exercise from the coach first, then the dictionary", () => {
    const renamed = resolveCatalogExercise(row({ name: "push-up" }), {
      catalog: {},
      names: { "0001": "Flexiones" },
    });
    expect(renamed.displayName).toBe("Flexiones");

    const translated = resolveCatalogExercise(row({ name: "push-up" }), {
      catalog: {},
      names: {},
    });
    expect(translated.displayName).toBe("Flexión");
  });

  it("repairs a broken name from the dataset", () => {
    const resolved = resolveCatalogExercise(row({ name: "FlexiÃ³n de brazo", equipment: "body weight" }), {
      catalog: {},
      names: {},
    });
    expect(resolved.displayName).toBe("Flexión de brazo");
  });

  it("writes through a broken dataset name the coach fixed by hand", () => {
    const resolved = resolveCatalogExercise(row({ name: "FlexiÃ³n de brazo" }), {
      catalog: {},
      names: { "0001": "Flexiones" },
    });
    expect(resolved.displayName).toBe("Flexiones");
  });

  it("marks a station the gym cannot host as unavailable", () => {
    const resolved = resolveCatalogExercise(row({ station_key: "unavailable_station" }), {
      catalog: {},
      names: {},
    });
    expect(resolved.availableInCronosGym).toBe(false);
  });

  it("still blocks a session on an unavailable station, even with a machine", () => {
    const resolved = resolveCatalogExercise(
      row({ station_key: "unavailable_station", equipment_id: "CG-EQP-0022" }),
      { catalog: { "0001": { availableInCronosGym: true } }, names: {} },
    );
    expect(resolved.availableInCronosGym).toBe(false);
  });
});

describe("resolveCatalogExerciseWithOverrides", () => {
  it("finds a row by id, by English name and by Spanish name", () => {
    setLoadedCatalog([row(), row({ id: "0002", name: "Push-up", name_es: "Lagartijas" })]);
    const overrides = readOverridesSnapshot();
    expect(resolveCatalogExerciseWithOverrides("0002", undefined)?.id).toBe("0002");
    expect(resolveCatalogExerciseWithOverrides("push up", undefined)?.id).toBe("0002");
    expect(resolveCatalogExerciseWithOverrides("lagartijas", undefined)?.id).toBe("0002");
    expect(overrides).toEqual({ catalog: {}, names: {} });
  });

  it("answers null instead of guessing a movement", () => {
    setLoadedCatalog([row()]);
    expect(resolveCatalogExerciseWithOverrides("no-such-exercise", undefined)).toBeNull();
    expect(resolveCatalogExerciseWithOverrides("", undefined)).toBeNull();
    expect(resolveCatalogExerciseWithOverrides(null, undefined)).toBeNull();
  });

  it("reads the overrides that localStorage holds", () => {
    setLoadedCatalog([row()]);
    setName("0001", "Encogimiento");
    expect(resolveCatalogExerciseWithOverrides("0001", undefined)?.displayName).toBe("Encogimiento");
  });

  it("sees a rename written after the first resolution", () => {
    setLoadedCatalog([row()]);
    expect(resolveCatalogExerciseWithOverrides("0001", undefined)?.displayName).not.toBe("Flexiones");
    saveNameOverride("0001", "Flexiones");
    expect(resolveCatalogExerciseWithOverrides("0001", undefined)?.displayName).toBe("Flexiones");
  });
});

describe("saveCatalogOverride", () => {
  it("keeps the coach's name when a machine is assigned", () => {
    saveNameOverride("0001", "Encogimiento");
    saveCatalogOverride("0001", { equipment_id: "CG-EQP-0012" });

    const resolved = resolveCatalogExercise(row(), readOverridesSnapshot());
    expect(resolved.displayName).toBe("Encogimiento");
    expect(resolved.effectiveEquipmentId).toBe("CG-EQP-0012");
  });

  it("keeps the machine when the name is rewritten", () => {
    saveCatalogOverride("0001", { equipment_id: "CG-EQP-0012", station_key: "flat_bench" });
    saveNameOverride("0001", "Encogimiento con mancuerna");

    const snapshot = readOverridesSnapshot();
    expect(snapshot.names["0001"]).toBe("Encogimiento con mancuerna");
    expect(resolveCatalogExercise(row(), snapshot).effectiveEquipmentId).toBe("CG-EQP-0012");
    expect(resolveCatalogExercise(row(), snapshot).stationKey).toBe("flat_bench");
  });

  it("drops the name override when the coach clears it", () => {
    saveNameOverride("0001", "Encogimiento");
    saveNameOverride("0001", "   ");
    expect(readOverridesSnapshot().names["0001"]).toBeUndefined();
  });

  it("survives a corrupt store, which reads as no overrides", () => {
    window.localStorage.setItem(CATALOG_OVERRIDES_KEY, "{not json");
    window.localStorage.setItem(EXERCISE_NAME_OVERRIDES_KEY, JSON.stringify({ "0001": 42 }));
    expect(readOverridesSnapshot()).toEqual({ catalog: {}, names: {} });
    expect(resolveCatalogExercise(row()).displayName).not.toBe("42");
  });

  it("ignores a value that is not an object", () => {
    setOverride("0001", "nope");
    window.localStorage.setItem(CATALOG_OVERRIDES_KEY, JSON.stringify(["nope"]));
    expect(readOverridesSnapshot().catalog).toEqual({});
  });

  it("announces the change so open screens re-resolve", () => {
    const listener = vi.fn();
    window.addEventListener("cronos:catalog-updated", listener);
    saveCatalogOverride("0001", { equipment_id: "CG-EQP-0012" });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("cronos:catalog-updated", listener);
  });
});

describe("resolveCatalogExercises", () => {
  it("resolves a page of rows with one read of the stores", () => {
    setLoadedCatalog([row(), row({ id: "0002", name: "Push-up" })]);
    setName("0002", "Lagartija");
    const resolved = resolveCatalogExercises([row(), row({ id: "0002", name: "Push-up" })]);
    expect(resolved.map((exercise) => exercise.displayName)[1]).toBe("Lagartija");
  });
});