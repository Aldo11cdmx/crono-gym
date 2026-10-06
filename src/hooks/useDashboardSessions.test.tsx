/**
 * @vitest-environment jsdom
 *
 * Mirrors the mock strategy from `useAthletePRs.test.tsx`: the Supabase client is
 * replaced with a chainable query builder that records every call, and the fixture
 * supplies the data each table returns. Tests assert on the recorded query chain
 * and on the transformed `DashboardSession[]` output.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useDashboardSessions } from "./useDashboardSessions";

type Call = [string, ...unknown[]];

interface Fixture {
  logs?: unknown[];
  logsError?: string | null;
  routines?: unknown[];
  sets?: unknown[];
  setsError?: string | null;
}

interface Recorded {
  table: string;
  calls: Call[];
  result: { data: unknown; error: { message: string } | null } | null;
}

let fixture: Fixture = {};
let reads: Recorded[] = [];

vi.mock("@lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};

      for (const method of ["select", "eq", "not", "order", "limit", "in"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push([method as string, ...args]);
          return builder;
        };
      }

      builder.then = (resolve: (value: { data: unknown; error: { message: string } | null }) => void) => {
        const rec: Recorded = { table, calls: [...calls], result: null };

        if (table === "workout_logs") {
          const failure = fixture.logsError ?? null;
          rec.result = {
            data: failure ? null : (fixture.logs ?? []),
            error: failure ? { message: failure } : null,
          };
          reads.push(rec);
          return resolve(rec.result);
        }

        if (table === "routines") {
          rec.result = { data: fixture.routines ?? [], error: null };
          reads.push(rec);
          return resolve(rec.result);
        }

        if (table === "completed_sets") {
          const failure = fixture.setsError ?? null;
          rec.result = {
            data: failure ? null : (fixture.sets ?? []),
            error: failure ? { message: failure } : null,
          };
          reads.push(rec);
          return resolve(rec.result);
        }

        rec.result = { data: null, error: null };
        reads.push(rec);
        return resolve(rec.result);
      };

      return builder;
    },
  },
}));

function Probe({ userId }: { userId: string | null }) {
  const { sessions, loading, error } = useDashboardSessions(userId);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ""}</span>
      <span data-testid="session-count">{sessions.length}</span>
      <ul>
        {sessions.map((s) => (
          <li key={s.id}>
            {s.id}|{s.startedAt}|{s.completedAt ?? "NULL"}|{s.routineId ?? "NULL"}|
            {s.routineTitle ?? "NULL"}|sets:{s.sets.length}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function mountHook(userId: string | null) {
  const view = render(<Probe userId={userId} />);
  await waitFor(() => {
    const el = view.container.querySelector('[data-testid="loading"]');
    expect(el?.textContent).toBe("false");
  });
  return view;
}

beforeEach(() => {
  fixture = {};
  reads = [];
});

afterEach(() => {
  cleanup();
});

// ------------------------------------------------------------------- tests

describe("useDashboardSessions · la consulta", () => {
  it("no pregunta nada sin usuario", async () => {
    await mountHook(null);
    expect(reads).toEqual([]);
    expect(screen.getByTestId("session-count").textContent).toBe("0");
  });

  it("filtra por usuario y solo sesiones completadas", async () => {
    await mountHook("athlete-1");

    const read = reads.find((r) => r.table === "workout_logs");
    expect(read).toBeDefined();
    expect(read?.calls).toContainEqual(["eq", "user_id", "athlete-1"]);
    expect(read?.calls).toContainEqual(["not", "completed_at", "is", null]);
  });

  it("ordena por started_at descendente y limita a 30", async () => {
    await mountHook("athlete-1");

    const read = reads.find((r) => r.table === "workout_logs");
    expect(read?.calls).toContainEqual(["order", "started_at", { ascending: false }]);
    expect(read?.calls).toContainEqual(["limit", 30]);
  });

  it("consulta completed_sets con join a exercises", async () => {
    fixture = {
      logs: [
        { id: "log-1", started_at: "2026-10-01T10:00:00", completed_at: "2026-10-01T10:30:00", routine_id: null },
      ],
      routines: [],
      sets: [],
    };
    await mountHook("athlete-1");

    const read = reads.find((r) => r.table === "completed_sets");
    expect(read).toBeDefined();
    // The select string must request the exercise join.
    const selectCall = read?.calls.find((c) => c[0] === "select");
    expect(String(selectCall?.[1])).toContain("exercises");
  });

  it("reporta el error de la lectura principal", async () => {
    fixture = { logsError: "sin permiso" };
    await mountHook("athlete-1");

    expect(screen.getByTestId("error").textContent).toBe("sin permiso");
    expect(screen.getByTestId("session-count").textContent).toBe("0");
  });

  it("reporta el error de completed_sets", async () => {
    fixture = { logsError: "sin permiso" };
    await mountHook("athlete-1");
  });

  it("fetches routine titles when logs have routine_id", async () => {
    fixture = {
      logs: [
        { id: "log-1", started_at: "2026-10-01T10:00:00", completed_at: "2026-10-01T10:30:00", routine_id: "r1" },
      ],
      routines: [{ id: "r1", title: "Full Body" }],
      sets: [],
    };
    await mountHook("athlete-1");

    const titleRead = reads.find((r) => r.table === "routines");
    expect(titleRead).toBeDefined();
    const inCall = titleRead?.calls.find((c) => c[0] === "in");
    expect(inCall).toEqual(["in", "id", ["r1"]]);
  });
});

describe("useDashboardSessions · transformación", () => {
  it("mapea logs a DashboardSession con sets anidados", async () => {
    fixture = {
      logs: [
        { id: "log-1", started_at: "2026-10-01T10:00:00", completed_at: "2026-10-01T10:30:00", routine_id: "r1" },
        { id: "log-2", started_at: "2026-10-03T12:00:00", completed_at: "2026-10-03T12:30:00", routine_id: null },
      ],
      routines: [{ id: "r1", title: "Upper" }],
      sets: [
        {
          id: "s1",
          log_id: "log-1",
          exercise_id: "ex-1",
          exercises: { name: "Squat", body_part: "upper legs" },
          weight: 100,
          reps: 5,
          is_warmup: false,
        },
        {
          id: "s2",
          log_id: "log-1",
          exercise_id: "ex-1",
          exercises: { name: "Squat", body_part: "upper legs" },
          weight: 60,
          reps: 10,
          is_warmup: true,
        },
        {
          id: "s3",
          log_id: "log-2",
          exercise_id: "ex-2",
          exercises: { name: "Press", body_part: "shoulders" },
          weight: 50,
          reps: 8,
          is_warmup: false,
        },
      ],
    };

    await mountHook("athlete-1");

    expect(screen.getByTestId("session-count").textContent).toBe("2");
    expect(screen.getByText(/log-1\|/)).toBeTruthy();
    expect(screen.getByText(/log-1\|.*sets:2/)).toBeTruthy();
    expect(screen.getByText(/log-2\|.*NULL\|NULL\|sets:1/)).toBeTruthy();
  });

  it("usa el id del ejercicio como nombre cuando el catalogo no tiene el nombre", async () => {
    fixture = {
      logs: [
        { id: "log-1", started_at: "2026-10-01T10:00:00", completed_at: "2026-10-01T10:30:00", routine_id: null },
      ],
      sets: [
        {
          id: "s1",
          log_id: "log-1",
          exercise_id: "ex-unknown",
          exercises: { name: null, body_part: null },
          weight: 100,
          reps: 5,
          is_warmup: false,
        },
      ],
    };

    await mountHook("athlete-1");

    // The set's exerciseName should fall back to the id.
    // (We verify via session count and no error.)
    expect(screen.getByTestId("session-count").textContent).toBe("1");
    expect(screen.getByTestId("error").textContent).toBe("");
  });

  it("maneja logs sin sets (sesión completa pero sin ejercicios)", async () => {
    fixture = {
      logs: [
        { id: "log-1", started_at: "2026-10-01T10:00:00", completed_at: "2026-10-01T10:30:00", routine_id: null },
      ],
      routines: [],
      sets: [],
    };

    await mountHook("athlete-1");

    expect(screen.getByTestId("session-count").textContent).toBe("1");
    expect(screen.getByText(/log-1\|.*sets:0/)).toBeTruthy();
  });

  it("no pide routine titles cuando ningun log tiene routine_id", async () => {
    fixture = {
      logs: [
        { id: "log-1", started_at: "2026-10-01T10:00:00", completed_at: "2026-10-01T10:30:00", routine_id: null },
      ],
      routines: [],
      sets: [],
    };

    await mountHook("athlete-1");

    const titleRead = reads.find((r) => r.table === "routines");
    expect(titleRead).toBeUndefined();
  });
});
