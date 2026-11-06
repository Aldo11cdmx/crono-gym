/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { resolveTrainingIntent } from "./trainingIntent";

describe("resolveTrainingIntent (P1.3)", () => {
  it("rehydrating → wait", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: true,
        session: null,
        recoverableDraft: null,
        targetRoutineId: "r1",
      }),
    ).toEqual({ action: "wait", reason: "rehydrating" });
  });

  it("sin sesión ni borrador → start", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: null,
        recoverableDraft: null,
        targetRoutineId: "r1",
        targetRoutineTitle: "R1",
      }),
    ).toEqual({ action: "start", routineId: "r1", routineTitle: "R1" });
  });

  it("sesión activa misma rutina → continue/same_routine", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: { routineId: "r1", title: "Activa" },
        recoverableDraft: null,
        targetRoutineId: "r1",
      }),
    ).toMatchObject({ action: "continue", reason: "same_routine", routineId: "r1" });
  });

  it("sesión activa otra rutina → continue/different_routine", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: { routineId: "r1", title: "Activa" },
        recoverableDraft: null,
        targetRoutineId: "r2",
      }),
    ).toMatchObject({ action: "continue", reason: "different_routine", routineId: "r1" });
  });

  it("borrador misma rutina → restore/same_routine", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: null,
        recoverableDraft: { routineId: "r1", routineTitle: "Borrador" },
        targetRoutineId: "r1",
      }),
    ).toMatchObject({ action: "restore", reason: "same_routine", routineId: "r1" });
  });

  it("borrador otra rutina → restore/different_routine", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: null,
        recoverableDraft: { routineId: "r1", routineTitle: "Borrador" },
        targetRoutineId: "r2",
      }),
    ).toMatchObject({ action: "restore", reason: "different_routine", routineId: "r1" });
  });

  it("sesión libre activa → continue", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: { routineId: null, title: "Sesión libre" },
        recoverableDraft: null,
        targetRoutineId: "r1",
      }),
    ).toMatchObject({ action: "continue", reason: "different_routine", routineId: null });
  });

  it("target libre válido → start", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: null,
        recoverableDraft: null,
        targetRoutineId: null,
        targetRoutineTitle: "Sesión libre",
        allowFreeStart: true,
      }),
    ).toEqual({ action: "start", routineId: null, routineTitle: "Sesión libre" });
  });

  it("target inválido sin sesión libre → blocked", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: null,
        recoverableDraft: null,
        targetRoutineId: null,
        allowFreeStart: false,
      }),
    ).toEqual({ action: "blocked", reason: "invalid_target" });
  });

  it("borrador más sesión restaurada → restore (no continue)", () => {
    expect(
      resolveTrainingIntent({
        rehydrating: false,
        session: { routineId: "r1", title: "Rehidratada" },
        recoverableDraft: { routineId: "r1", routineTitle: "Borrador" },
        targetRoutineId: "r1",
      }),
    ).toMatchObject({ action: "restore", reason: "same_routine" });
  });
});
