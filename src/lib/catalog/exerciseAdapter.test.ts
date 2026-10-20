/**
 * exerciseAdapter.test.ts — the catalog as the app reads an exercise.
 *
 * The row the app expects is a flat one: an id, a name, a muscle, a piece of
 * equipment, a demo and a list of steps. The catalog row is richer and speaks
 * nine languages, so the adapter is the only place that has to know how the
 * two line up.
 */

import { describe, expect, it } from "vitest";
import { toExercise, toExercises } from "./exerciseAdapter";
import type { CatalogExercise } from "./types";

function row(overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id: "0001",
    name: "Sentadilla",
    category: "upper legs",
    body_part: "upper legs",
    equipment: "barbell",
    gif_url: "videos/0001-2gPfomN.gif",
    image: "images/0001-2gPfomN.jpg",
    muscle_group: "quadriceps",
    secondary_muscles: ["hamstrings"],
    target: "quads",
    availableInCronosGym: true,
    instructions: { es: "Apártate", en: "Stand" },
    instruction_steps: { es: ["Apártate", "Baja"] },
    media_id: "2gPfomN",
    created_at: "2024-01-01",
    attribution: null,
    ...overrides,
  };
}

describe("toExercise", () => {
  it("conserva el identificador y el nombre", () => {
    const exercise = toExercise(row());

    expect(exercise.id).toBe("0001");
    expect(exercise.name).toBe("Sentadilla");
  });

  it("deja el GIF en una URL que se puede cargar", () => {
    expect(toExercise(row()).gif_url).toBe(
      "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0001-2gPfomN.gif",
    );
  });

  it("toma los pasos en español, como la tabla sembrada", () => {
    expect(toExercise(row()).instructions).toEqual(["Apártate", "Baja"]);
  });

  it("deja la lista de pasos vacía cuando el catálogo no la tiene", () => {
    expect(toExercise(row({ instruction_steps: {} })).instructions).toEqual([]);
  });
});

describe("toExercises", () => {
  it("convierte todas las filas", () => {
    const exercises = toExercises([row(), row({ id: "0002", name: "Peso muerto" })]);

    expect(exercises.map((e) => e.id)).toEqual(["0001", "0002"]);
  });
});
