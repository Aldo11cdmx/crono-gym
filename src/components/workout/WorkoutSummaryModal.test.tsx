/**
 * @vitest-environment jsdom
 *
 * The summary is the only screen that can still do something about the rows the
 * athlete never checked, so the tests below are about that decision: what the
 * banner says, and what the numbers become once it is answered.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as sessionSync from "../../lib/sessionSync";
import { GymSettingsProvider } from "../../context/GymSettingsContext";
import type { DraftExercise } from "../../lib/offlineStore";
import type { Exercise } from "../../types/supabase";
import { WorkoutSummaryModal } from "./WorkoutSummaryModal";

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

function draft(exercises: readonly DraftExercise[]) {
  return (
    <GymSettingsProvider>
      <WorkoutSummaryModal
        isOpen
        onClose={vi.fn()}
        routineTitle="Empuje"
        startedAt="2026-11-14T10:00:00.000Z"
        completedAt="2026-11-14T10:45:00.000Z"
        exercises={exercises}
        userId="user-1"
        routineId={null}
        onSaved={vi.fn()}
        onDone={onDone}
      />
    </GymSettingsProvider>
  );
}

let onDone = vi.fn();

function session(): DraftExercise[] {
  return [
    {
      key: "bench",
      exercise: exercise("bench"),
      restSeconds: 90,
      sets: [
        { set_number: 1, weight: "60", reps: "8", rpe: "8", kind: "normal", completed: true },
        { set_number: 2, weight: "62.5", reps: "6", rpe: "9", kind: "normal", completed: false },
        { set_number: 3, weight: "", reps: "", rpe: "", kind: "normal", completed: false },
      ],
    },
  ];
}

afterEach(() => {
  cleanup();
  onDone = vi.fn();
});

describe("WorkoutSummaryModal", () => {
  it("avisa de la serie con carga que quedó sin marcar", () => {
    render(draft(session()));

    expect(screen.getByText("Aún tenías 1 serie sin marcar")).toBeTruthy();
  });

  it("no cuenta la serie pendiente hasta que se incluye", () => {
    render(draft(session()));

    // 1 serie de 60x8; la segunda (62.5x6) todavía no suma.
    expect(screen.getByText("1 de 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Incluirlas como completadas/ }));

    expect(screen.getByText("2 de 3")).toBeTruthy();
    expect(screen.getByText("Incluidas en el resumen")).toBeTruthy();
  });

  it("al omitir deja el volumen como estaba y lo dice", () => {
    render(draft(session()));

    fireEvent.click(screen.getByRole("button", { name: "Omitirlas" }));

    expect(screen.getByText("1 de 3")).toBeTruthy();
    expect(screen.getByText("Se omitieron")).toBeTruthy();
  });

  it("abre las cuatro tarjetas y LISTO cierra la sesión", () => {
    render(draft(session()));

    fireEvent.click(within(screen.getByRole("tablist", { name: "Secciones del resumen" })).getByRole("tab", { name: /Compartir/ }));

    // The studio has its own tablist for the four cards; the section tablist
    // must still show exactly one selected section.
    const sections = within(screen.getByRole("tablist", { name: "Secciones del resumen" })).getAllByRole("tab");
    expect(sections.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(screen.getByRole("tablist", { name: "Tarjetas para compartir" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Vista previa/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar PNG" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "LISTO" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("guarda las series incluidas en el payload", async () => {
    const spy = vi.spyOn(sessionSync, "queueAndSync").mockResolvedValue(null);
    render(draft(session()));

    fireEvent.click(screen.getByRole("button", { name: /Incluirlas como completadas/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));

    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as { sets: unknown[] }).sets).toHaveLength(2);
  });
});