/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@lib/supabase", () => ({ supabase: {} }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ role: "athlete" }) }));
vi.mock("@/hooks/useDashboardSessions", () => ({
  useDashboardSessions: () => ({ sessions: [], loading: false, error: null, refresh: async () => {} }),
}));
vi.mock("@/hooks/useGymData", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useGymData")>("@/hooks/useGymData");
  return { ...actual, useRoutines: () => ({ routines: [], loading: false, error: null, refresh: async () => {}, toggleFavorite: async () => true, pendingIds: new Set() }) };
});
vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: () => ({ start: () => {}, session: null, recoverableDraft: null, rehydrating: false }),
}));

import { composeDaySessionStatus, composeWeeklyAssignments } from "./RoutinesPage";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { DashboardSession } from "@/lib/dashboard/dashboardMetrics";

function routine(id: string, dayIndexes: Array<number | null | undefined>): RoutineWithExercises {
  return {
    id,
    user_id: "u1",
    title: `R ${id}`,
    description: null,
    created_at: "2026-01-01T00:00:00Z",
    is_favorite: false,
    source: "user",
    created_by_coach_id: null,
    authored_by_coach_id: null,
    authored_by_coach: null,
    is_template: false,
    exercises: dayIndexes.map((dayIndex, i) => ({
      exercise: {
        id: `ex-${id}-${i}`,
        name: `Ex ${i}`,
        name_es: null,
        body_part: "chest",
        target: "pectorals",
        equipment: "barbell",
        gif_url: "",
        instructions: [],
        is_active: true,
        is_hidden: false,
      },
      target_sets: 3,
      rest_seconds: 90,
      dayIndex: dayIndex as number | null,
      dayLabel: "",
    })),
  } as unknown as RoutineWithExercises;
}

describe("composeWeeklyAssignments (P1.2.1)", () => {
  it("rutina con ejercicios lunes (0) y jueves (3) genera dos asignaciones", () => {
    const out = composeWeeklyAssignments([routine("r1", [0, 3, 0])]);
    expect(out.map((a) => [a.routineId, a.dayIndex])).toEqual([
      ["r1", 0],
      ["r1", 3],
    ]);
  });

  it("varios ejercicios misma rutina en lunes generan una sola asignación", () => {
    const out = composeWeeklyAssignments([routine("r1", [0, 0, 0])]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ routineId: "r1", dayIndex: 0, order: 0 });
  });

  it("dos rutinas distintas en el mismo día se conservan", () => {
    const out = composeWeeklyAssignments([routine("r1", [1]), routine("r2", [1])]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((a) => a.routineId))).toEqual(new Set(["r1", "r2"]));
    expect(out.every((a) => a.dayIndex === 1)).toBe(true);
  });

  it("ejercicios sin dayIndex válido no generan asignaciones inventadas", () => {
    const out = composeWeeklyAssignments([
      routine("r1", [null, undefined as unknown as number, -1, 7, 1.5 as unknown as number]),
    ]);
    expect(out).toEqual([]);
  });

  it("IDs de asignación no colisionan y son deterministas", () => {
    const out = composeWeeklyAssignments([routine("r1", [3, 0]), routine("r2", [0])]);
    const ids = out.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(out.map((a) => [a.id, a.routineId, a.dayIndex])).toEqual([
      ["r1-0", "r1", 0],
      ["r2-0", "r2", 0],
      ["r1-3", "r1", 3],
    ]);
  });

  it("acciones existentes siguen identificando por id (misma rutina, distinto día)", () => {
    const out = composeWeeklyAssignments([routine("r1", [0, 3])]);
    expect(out.find((a) => a.dayIndex === 0)?.id).toBe("r1-0");
    expect(out.find((a) => a.dayIndex === 3)?.id).toBe("r1-3");
  });
});

describe("composeDaySessionStatus (F3 identidad temporal)", () => {
  const weekStart = new Date(2026, 10, 2); // Mon Nov 2 2026 local

  it("sesión confirmada corresponde a misma rutina y fecha local", () => {
    const assignments = composeWeeklyAssignments([routine("r1", [0])]);
    const sessions: DashboardSession[] = [
      {
        id: "s1",
        startedAt: new Date(2026, 10, 2, 23, 30).toISOString(),
        completedAt: new Date(2026, 10, 3, 0, 10).toISOString(),
        routineId: "r1",
        routineTitle: "R",
        sets: [],
      },
    ];
    const map = composeDaySessionStatus(assignments, sessions, weekStart);
    expect(map["2026-11-02|r1"].confirmed).toBe(true);
  });

  it("rutina alternativa no completa la rutina programada", () => {
    const assignments = composeWeeklyAssignments([routine("r1", [0])]);
    const sessions: DashboardSession[] = [
      {
        id: "s1",
        startedAt: new Date(2026, 10, 2, 10, 0).toISOString(),
        completedAt: new Date(2026, 10, 2, 11, 0).toISOString(),
        routineId: "r2",
        routineTitle: "Alt",
        sets: [],
      },
    ];
    const map = composeDaySessionStatus(assignments, sessions, weekStart);
    expect(map["2026-11-02|r1"].confirmed).toBe(false);
  });

  it("R1 lunes y jueves: sesión activa jueves marca solo jueves", () => {
    const assignments = composeWeeklyAssignments([routine("r1", [0, 3])]);
    const map = composeDaySessionStatus(assignments, [], weekStart, {
      activeSession: { routineId: "r1", startedAt: new Date(2026, 10, 5, 9, 0).toISOString() }, // Thu
      rehydrating: false,
    });
    expect(map["2026-11-02|r1"].activeInProgress).toBe(false);
    expect(map["2026-11-05|r1"].activeInProgress).toBe(true);
  });

  it("borrador lunes no altera jueves (misma rutina)", () => {
    const assignments = composeWeeklyAssignments([routine("r1", [0, 3])]);
    const map = composeDaySessionStatus(assignments, [], weekStart, {
      recoverableDraft: { routineId: "r1", startedAt: new Date(2026, 10, 2, 8, 0).toISOString() },
      rehydrating: false,
    });
    expect(map["2026-11-02|r1"].recoverableDraft).toBe(true);
    expect(map["2026-11-05|r1"].recoverableDraft).toBe(false);
  });

  it("dos rutinas mismo día no intercambian estados", () => {
    const assignments = composeWeeklyAssignments([routine("r1", [1]), routine("r2", [1])]);
    const sessions: DashboardSession[] = [
      {
        id: "s1",
        startedAt: new Date(2026, 10, 3, 10, 0).toISOString(),
        completedAt: new Date(2026, 10, 3, 11, 0).toISOString(),
        routineId: "r1",
        routineTitle: "R1",
        sets: [],
      },
    ];
    const map = composeDaySessionStatus(assignments, sessions, weekStart);
    expect(map["2026-11-03|r1"].confirmed).toBe(true);
    expect(map["2026-11-03|r2"].confirmed).toBe(false);
  });

  it("rehydrating marca resolución sin afirmar activa/borrador", () => {
    const assignments = composeWeeklyAssignments([routine("r1", [0])]);
    const map = composeDaySessionStatus(assignments, [], weekStart, {
      activeSession: { routineId: "r1", startedAt: new Date(2026, 10, 2, 9, 0).toISOString() },
      rehydrating: true,
    });
    expect(map["2026-11-02|r1"].sessionStateResolving).toBe(true);
    expect(map["2026-11-02|r1"].activeInProgress).toBe(false);
    expect(map["2026-11-02|r1"].recoverableDraft).toBe(false);
  });

  it("cambio de semana no colisiona dateKey|routineId", () => {
    const a = composeWeeklyAssignments([routine("r1", [0])]);
    const w1 = composeDaySessionStatus(a, [], new Date(2026, 10, 2));
    const w2 = composeDaySessionStatus(a, [], new Date(2026, 10, 9));
    expect(Object.keys(w1)).toEqual(["2026-11-02|r1"]);
    expect(Object.keys(w2)).toEqual(["2026-11-09|r1"]);
  });

  it("sync_pending no aparece por estado global (siempre false sin evidencia)", () => {
    const assignments = composeWeeklyAssignments([routine("r1", [0])]);
    const map = composeDaySessionStatus(assignments, [], weekStart);
    expect(map["2026-11-02|r1"].syncPending).toBe(false);
  });

  it("sesión activa de otro día no marca el día actual de la misma rutina", () => {
    const assignments = composeWeeklyAssignments([routine("r1", [0, 1])]);
    const map = composeDaySessionStatus(assignments, [], weekStart, {
      activeSession: { routineId: "r1", startedAt: new Date(2026, 10, 2, 9, 0).toISOString() }, // Mon
      rehydrating: false,
    });
    expect(map["2026-11-02|r1"].activeInProgress).toBe(true);
    expect(map["2026-11-03|r1"].activeInProgress).toBe(false);
  });
});

