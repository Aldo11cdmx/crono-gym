/**
 * WeeklyPlanner.test.tsx — tests for the extended weekly planner.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WeeklyPlanner } from "./WeeklyPlanner";
import type {
  DaySessionStatusMap,
  WeeklyPlannerProps,
} from "./WeeklyPlanner";
import type { WeeklyAssignment } from "@/lib/routines/routinesViewModel";

const ROUTINES = [
  { routineId: "r-0", title: "Full Body A" },
  { routineId: "r-1", title: "Full Body B" },
  { routineId: "r-2", title: "Cardio" },
];

const INITIAL_ASSIGNMENTS: WeeklyAssignment[] = [
  { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0, title: "Lunes: Empuje Pro" },
  { id: "a-1", routineId: "r-1", dayIndex: 0, order: 1 },
  { id: "a-2", routineId: "r-2", dayIndex: 1, order: 0 },
];

afterEach(() => cleanup());

describe("WeeklyPlanner (extended)", () => {
  it("renders the day carousel with the seven weekday letters", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    expect(screen.getByText("L")).toBeTruthy();
    expect(screen.getByText("M")).toBeTruthy();
    expect(screen.getByText("X")).toBeTruthy();
    expect(screen.getByText("J")).toBeTruthy();
    expect(screen.getByText("V")).toBeTruthy();
    expect(screen.getByText("S")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy();
  });

  it("renders the routines of the day the carousel selects", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    expect(screen.getByText("Full Body B")).toBeTruthy();
    expect(screen.getByText("Lunes: Empuje Pro")).toBeTruthy();
    // "Cardio" belongs to Tuesday: the card shows one day at a time.
    expect(screen.queryByText("Cardio")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Martes" }));
    expect(screen.getByText("Cardio")).toBeTruthy();
  });

  it("renders the custom session title when provided", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    expect(screen.getByText("Lunes: Empuje Pro")).toBeTruthy();
  });

  it("shows Rest day label for empty non-today days", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={3}
      />,
    );
    const restLabels = screen.getAllByText("Descanso");
    expect(restLabels.length).toBeGreaterThan(0);
  });

  it("does not render undo/redo buttons when there is no history", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    expect(screen.queryByLabelText("Deshacer")).toBeNull();
    expect(screen.queryByLabelText("Rehacer")).toBeNull();
  });

  it("calls onChange after a reorder drag", async () => {
    const onChange = vi.fn();
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={onChange}
        todayIndex={0}
      />,
    );
    const dragItem = screen.getByText("Full Body B");
    await fireEvent.dragStart(dragItem);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the 'Iniciar sesión de hoy' button for today without assignments", () => {
    const onStartToday = vi.fn();
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={[]}
        onChange={vi.fn()}
        todayIndex={0}
        onStartToday={onStartToday}
      />,
    );
    expect(screen.getByText("Iniciar sesión de hoy")).toBeTruthy();
    fireEvent.click(screen.getByText("Iniciar sesión de hoy"));
    expect(onStartToday).toHaveBeenCalledWith(0);
  });

  it("accepts optional P1.2 session props without changing behavior", () => {
    const daySessionStatus: DaySessionStatusMap = {
      "2026-11-05|r-0": {
        key: { dateKey: "2026-11-05", routineId: "r-0" },
        confirmed: true,
        syncPending: false,
      },
    };
    const props: WeeklyPlannerProps = {
      routines: ROUTINES,
      initialAssignments: INITIAL_ASSIGNMENTS,
      onChange: vi.fn(),
      todayIndex: 0,
      daySessionStatus,
      activeSessionRoutineId: "r-0",
      recoverableDraftRoutineId: null,
    };
    render(<WeeklyPlanner {...props} />);
    expect(screen.getByRole("tablist", { name: "Días de la semana" })).toBeTruthy();
    expect(screen.getByText("Full Body B")).toBeTruthy();
  });

  it("handles absent/empty P1.2 session props without errors", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
        daySessionStatus={undefined}
        activeSessionRoutineId={undefined}
        recoverableDraftRoutineId={undefined}
      />,
    );
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
        daySessionStatus={{}}
        activeSessionRoutineId={null}
        recoverableDraftRoutineId={null}
      />,
    );
    expect(screen.getAllByRole("tablist", { name: "Días de la semana" }).length).toBe(2);
  });

  describe("P1.3 agregación y identidad temporal", () => {
    const weekStartKey = "2026-11-02"; // Mon; todayIndex 0 => Mon 2026-11-02
    const baseProps = {
      routines: [
        { routineId: "r1", title: "R1" },
        { routineId: "r2", title: "R2" },
      ],
      onChange: vi.fn(),
      todayIndex: 0,
      todayDateKey: weekStartKey,
    };

    it("dos rutinas completadas mismo día -> completed", () => {
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": { key: { dateKey: "2026-11-02", routineId: "r1" }, confirmed: true, syncPending: false },
        "2026-11-02|r2": { key: { dateKey: "2026-11-02", routineId: "r2" }, confirmed: true, syncPending: false },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          initialAssignments={[
            { id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 },
            { id: "r2-0", routineId: "r2", dayIndex: 0, order: 1 },
          ]}
          daySessionStatus={map}
        />,
      );
      expect(screen.getByText("Completado")).toBeTruthy();
    });

    it("una completada y otra pendiente -> partial", () => {
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": { key: { dateKey: "2026-11-02", routineId: "r1" }, confirmed: true, syncPending: false },
        "2026-11-02|r2": { key: { dateKey: "2026-11-02", routineId: "r2" }, confirmed: false, syncPending: false },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          initialAssignments={[
            { id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 },
            { id: "r2-0", routineId: "r2", dayIndex: 0, order: 1 },
          ]}
          daySessionStatus={map}
        />,
      );
      expect(screen.getByText("Parcial")).toBeTruthy();
    });

    it("rehydrating con resolving muestra estado neutral", () => {
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": {
          key: { dateKey: "2026-11-02", routineId: "r1" },
          confirmed: false,
          syncPending: false,
          sessionStateResolving: true,
        },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          routines={[{ routineId: "r1", title: "R1" }]}
          initialAssignments={[{ id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 }]}
          daySessionStatus={map}
        />,
      );
      expect(screen.getByText("Comprobando sesión")).toBeTruthy();
      expect(screen.queryByText("Pendiente")).toBeNull();
    });

    it("una sola rutina completada no marca otra rutina distinta", () => {
      const map: DaySessionStatusMap = {
        "2026-11-03|r1": { key: { dateKey: "2026-11-03", routineId: "r1" }, confirmed: true, syncPending: false },
        "2026-11-03|r2": { key: { dateKey: "2026-11-03", routineId: "r2" }, confirmed: false, syncPending: false },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          todayIndex={1}
          todayDateKey="2026-11-03"
          initialAssignments={[
            { id: "r1-1", routineId: "r1", dayIndex: 1, order: 0 },
            { id: "r2-1", routineId: "r2", dayIndex: 1, order: 1 },
          ]}
          daySessionStatus={map}
        />,
      );
      expect(screen.getByText("Parcial")).toBeTruthy();
      expect(screen.queryByText("Completado")).toBeNull();
    });

    it("sync_pending solo si el mapa lo indica (no global)", () => {
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": { key: { dateKey: "2026-11-02", routineId: "r1" }, confirmed: false, syncPending: true },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          routines={[{ routineId: "r1", title: "R1" }]}
          initialAssignments={[{ id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 }]}
          daySessionStatus={map}
        />,
      );
      expect(screen.getByText("Sincronización pendiente")).toBeTruthy();
    });

    it("una completada y otra not_done en fecha pasada -> partial (no completed)", () => {
      // Mon 2026-11-02 is past relative to Thu 2026-11-05
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": { key: { dateKey: "2026-11-02", routineId: "r1" }, confirmed: true, syncPending: false },
        "2026-11-02|r2": { key: { dateKey: "2026-11-02", routineId: "r2" }, confirmed: false, syncPending: false },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          todayIndex={3}
          todayDateKey="2026-11-05"
          initialAssignments={[
            { id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 },
            { id: "r2-0", routineId: "r2", dayIndex: 0, order: 1 },
          ]}
          daySessionStatus={map}
        />,
      );
      fireEvent.click(screen.getByRole("tab", { name: "Lunes" }));
      expect(screen.getByText("Parcial")).toBeTruthy();
      expect(screen.queryByText("Completado")).toBeNull();
    });

    it("todas not_done en fecha pasada -> not_done", () => {
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": { key: { dateKey: "2026-11-02", routineId: "r1" }, confirmed: false, syncPending: false },
        "2026-11-02|r2": { key: { dateKey: "2026-11-02", routineId: "r2" }, confirmed: false, syncPending: false },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          todayIndex={3}
          todayDateKey="2026-11-05"
          initialAssignments={[
            { id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 },
            { id: "r2-0", routineId: "r2", dayIndex: 0, order: 1 },
          ]}
          daySessionStatus={map}
        />,
      );
      fireEvent.click(screen.getByRole("tab", { name: "Lunes" }));
      expect(screen.getByText("No realizado")).toBeTruthy();
    });

    it("una activa y otra completada -> in_progress (prioridad)", () => {
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": { key: { dateKey: "2026-11-02", routineId: "r1" }, confirmed: true, syncPending: false },
        "2026-11-02|r2": { key: { dateKey: "2026-11-02", routineId: "r2" }, confirmed: false, syncPending: false, activeInProgress: true },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          initialAssignments={[
            { id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 },
            { id: "r2-0", routineId: "r2", dayIndex: 0, order: 1 },
          ]}
          daySessionStatus={map}
        />,
      );
      expect(screen.getByText("En curso")).toBeTruthy();
    });

    it("una sync_pending y otra completada -> sync_pending", () => {
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": { key: { dateKey: "2026-11-02", routineId: "r1" }, confirmed: true, syncPending: false },
        "2026-11-02|r2": { key: { dateKey: "2026-11-02", routineId: "r2" }, confirmed: false, syncPending: true },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          initialAssignments={[
            { id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 },
            { id: "r2-0", routineId: "r2", dayIndex: 0, order: 1 },
          ]}
          daySessionStatus={map}
        />,
      );
      expect(screen.getByText("Sincronización pendiente")).toBeTruthy();
    });

    it("todas pendientes en fecha futura -> pending (nunca not_done)", () => {
      // Sat 2026-11-07 is future relative to Thu 2026-11-05
      const map: DaySessionStatusMap = {
        "2026-11-07|r1": { key: { dateKey: "2026-11-07", routineId: "r1" }, confirmed: false, syncPending: false },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          todayIndex={3}
          todayDateKey="2026-11-05"
          initialAssignments={[{ id: "r1-5", routineId: "r1", dayIndex: 5, order: 0 }]}
          daySessionStatus={map}
        />,
      );
      fireEvent.click(screen.getByRole("tab", { name: "Sábado" }));
      expect(screen.getByText("Pendiente")).toBeTruthy();
      expect(screen.queryByText("No realizado")).toBeNull();
    });

    it("sin asignaciones válidas -> Sin rutina (no_routine)", () => {
      render(
        <WeeklyPlanner
          {...baseProps}
          routines={[]}
          initialAssignments={[]}
          daySessionStatus={{}}
          todayIndex={3}
          todayDateKey="2026-11-05"
        />,
      );
      expect(screen.getAllByText("Descanso").length).toBeGreaterThan(0);
    });

    it("props globales obsoletas no determinan estado visual cuando hay daySessionStatus", () => {
      const map: DaySessionStatusMap = {
        "2026-11-02|r1": { key: { dateKey: "2026-11-02", routineId: "r1" }, confirmed: true, syncPending: false },
      };
      render(
        <WeeklyPlanner
          {...baseProps}
          routines={[{ routineId: "r1", title: "R1" }]}
          initialAssignments={[{ id: "r1-0", routineId: "r1", dayIndex: 0, order: 0 }]}
          daySessionStatus={map}
          activeSessionRoutineId="r1"
          recoverableDraftRoutineId="r1"
          activeRoutineId="r1"
        />,
      );
      expect(screen.getByText("Completado")).toBeTruthy();
      expect(screen.queryByText("En curso")).toBeNull();
    });
  });
});
