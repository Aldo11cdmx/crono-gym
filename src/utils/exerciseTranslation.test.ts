/**
 * exerciseTranslation.test.ts — the display-name helper used by the exercise
 * picker cards. It must resolve the catalog names to their Spanish label and
 * fall back to the raw name when the catalog has no translation.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getExerciseDisplayName } from "./exerciseTranslation";
import exercisesEs from "@/data/translations/exercises_es.json";

const dict = exercisesEs as Record<string, string>;

describe("getExerciseDisplayName", () => {
  it("translates a catalog exercise name to Spanish", () => {
    expect(getExerciseDisplayName({ name: "barbell bench press" })).toBe(
      "Press de banca con barra",
    );
  });

  it("translates forearm exercises", () => {
    expect(getExerciseDisplayName({ name: "band reverse wrist curl" })).toBe(
      "Curl de muñeca invertido con banda",
    );
    expect(getExerciseDisplayName({ name: "band wrist curl" })).toBe(
      "Curl de muñeca con banda",
    );
    expect(
      getExerciseDisplayName({
        name: "barbell palms down wrist curl over a bench",
      }),
    ).toBe("Curl de muñeca con barra en banco (palmas abajo)");
  });

  it("ignores the case and the surrounding spaces of the name", () => {
    expect(getExerciseDisplayName({ name: "Barbell Bench Press" })).toBe(
      "Press de banca con barra",
    );
    expect(getExerciseDisplayName({ name: "  BARBELL BENCH PRESS  " })).toBe(
      "Press de banca con barra",
    );
  });

  it("prefers the name_es field of the exercise", () => {
    expect(
      getExerciseDisplayName({
        name: "barbell bench press",
        name_es: "Press de banca Zeta",
      }),
    ).toBe("Press de banca Zeta");
  });

  it("falls back to the raw name when there is no translation", () => {
    expect(getExerciseDisplayName({ name: "Ejercicio sin traducir" })).toBe(
      "Ejercicio sin traducir",
    );
  });

  it("has no empty translation", () => {
    const empty = Object.entries(dict).filter(([, value]) => !value.trim());
    expect(empty).toEqual([]);
  });

  it(
    "translates every name of the exercise catalog",
    () => {
      // The catalog is a 16 MB JSON: read it from disk instead of importing it
      // so the suite does not pay the bundler transform on every run.
      const catalog = JSON.parse(
        readFileSync(
          resolve(process.cwd(), "src/data/exercisesCatalog.json"),
          "utf8",
        ),
      ) as { name: string }[];

      const translated = new Set(
        Object.keys(dict).map((key) => key.trim().toLowerCase()),
      );
      const missing = [
        ...new Set(catalog.map((entry) => entry.name.trim().toLowerCase())),
      ].filter((name) => !translated.has(name));

      expect(missing).toEqual([]);
    },
    30000,
  );
});
