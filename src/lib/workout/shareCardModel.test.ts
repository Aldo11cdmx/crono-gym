import { describe, expect, it } from "vitest";
import type { Exercise } from "@/types/supabase";
import type { DraftExercise } from "../offlineStore";
import {
  buildShareCardInput,
  pendingSets,
  shareSetCount,
  shareVolumeKg,
} from "./shareCardModel";
import type { SetEntry } from "./types";

function exercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: `Ejercicio ${id}`,
    name_es: null,
    body_part: "chest",
    target: "chest",
    equipment: "barbell",
    gif_url: "",
    instructions: [],
    is_active: true,
    is_hidden: false,
    ...overrides,
  };
}

function set(overrides: Partial<SetEntry> = {}): SetEntry {
  return {
    set_number: 1,
    weight: "60",
    reps: "8",
    rpe: "8",
    kind: "normal",
    completed: true,
    ...overrides,
  };
}

function drafted(exerciseRow: Exercise, sets: SetEntry[]): DraftExercise {
  return {
    key: exerciseRow.id,
    exercise: exerciseRow,
    restSeconds: 90,
    sets,
  };
}

describe("shareCardModel", () => {
  it("cuenta volumen y series solo de lo marcado, salvo que se incluyan", () => {
    const rows = [
      drafted(exercise("bench"), [set(), set({ weight: "0", reps: "0", completed: false })]),
    ];

    expect(shareSetCount(rows, false)).toBe(1);
    expect(shareVolumeKg(rows, false)).toBe(480);
    expect(shareSetCount(rows, true)).toBe(2);
    expect(shareVolumeKg(rows, true)).toBe(480);
  });

  it("solo llama pendiente a una fila con carga escrita", () => {
    const rows = [
      drafted(exercise("bench"), [
        set(),
        set({ weight: "70", reps: "5", completed: false }),
        set({ weight: "", reps: "", completed: false }),
      ]),
    ];

    const pending = pendingSets(rows);
    expect(pending).toHaveLength(1);
    expect(pending[0].setNumber).toBe(2);
  });

  it("reparte los músculos entre tren anterior y posterior", () => {
    const rows = [
      drafted(exercise("bench"), [set()]),
      drafted(exercise("row", { body_part: "back", target: "upper-back" }), [set()]),
    ];

    const input = buildShareCardInput(rows, {
      routineTitle: "Empuje y tirón",
      startedAt: "2026-11-14T10:00:00.000Z",
      completedAt: "2026-11-14T10:45:30.000Z",
      includePending: false,
    });

    expect(input.muscles.find((m) => m.label === "Pecho")?.region).toBe("anterior");
    expect(input.muscles.find((m) => m.label === "Espalda Alta")?.region).toBe("posterior");
    expect(input.durationLabel).toBe("45:30");
    expect(input.totalSets).toBe(2);
    expect(input.volumeKg).toBe(960);
  });

  it("ordena los ejercicios por trabajo real, no por orden de la rutina", () => {
    const rows = [
      drafted(exercise("curl"), [set({ weight: "12", reps: "12" })]),
      drafted(exercise("squat"), [set({ weight: "100", reps: "5" })]),
    ];

    const input = buildShareCardInput(rows, {
      routineTitle: "Fuerza",
      startedAt: "2026-11-14T10:00:00.000Z",
      completedAt: "2026-11-14T10:30:00.000Z",
      includePending: false,
    });

    expect(input.exercises[0].name).toContain("squat");
    expect(input.exerciseCount).toBe(2);
  });
});