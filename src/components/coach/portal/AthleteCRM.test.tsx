/**
 * @vitest-environment jsdom
 *
 * `AthleteCRM` is the first screen in this app where one signed-in user reads another
 * user's training data, so the tests are mostly about *which rows it asks for*. The
 * qualification lives in the RLS policies of `20261003030000_coach_portal.sql`, and the only
 * way the client can help that is by filtering on the same column the policy checks --
 * `user_id`. A read scoped by anything else would either be refused by the database or, worse,
 * would return a wider set the database had no reason to refuse.
 *
 * `AnatomicalRanksView` and `useMuscleRanks` are stubbed. Both are large and both have their
 * own suites; what matters here is that `readOnly` reaches the hook, since the shared rank
 * store is keyed by muscle alone and a write from the coach's browser would land in the
 * athlete's own hysteresis.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteCRM } from "./AthleteCRM";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";

const ATHLETE = "athlete-1";

// ------------------------------------------------------------------- mocks

type Call = [string, ...unknown[]];

interface Fixture {
  routines?: unknown[];
  routineExercises?: unknown[];
  exercises?: unknown[];
  errorTable?: string | null;
}

let fixture: Fixture = {};
let reads: { table: string; calls: Call[] }[] = [];

vi.mock("@lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};

      for (const method of ["select", "eq", "in", "order", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push([method as string, ...args]);
          return builder;
        };
      }

      builder.then = (resolve: (value: unknown) => void) => {
        reads.push({ table, calls: [...calls] });

        const failure = fixture.errorTable === table ? "boom" : null;
        const data =
          table === "routines"
            ? (fixture.routines ?? [])
            : table === "routine_exercises"
              ? (fixture.routineExercises ?? [])
              : (fixture.exercises ?? []);

        return resolve({ data: failure ? null : data, error: failure ? { message: failure } : null });
      };

      return builder;
    },
  },
}));

const rankCalls: { userId: string | null; readOnly: boolean | undefined }[] = [];

vi.mock("@/hooks/useMuscleRanks", () => ({
  useMuscleRanks: (userId: string | null, options?: { readOnly?: boolean }) => {
    rankCalls.push({ userId, readOnly: options?.readOnly });
    return { map: null, history: [], promotions: [], loading: false, initialLoading: false, error: null, sessionsNeeded: 0, pendingCount: 0, classifiedCount: 0, strongest: null, weakest: null };
  },
}));

const rankViewCalls: { userId: string | null; readOnly: boolean | undefined }[] = [];

vi.mock("@/components/AnatomicalRanksView", () => ({
  AnatomicalRanksView: ({ userId, readOnly }: { userId: string | null; readOnly?: boolean }) => {
    rankViewCalls.push({ userId, readOnly });
    return <div>ranks map</div>;
  },
}));

const prsCalls: (string | null)[] = [];

vi.mock("@/hooks/useAthletePRs", () => ({
  useAthletePRs: (userId: string | null) => {
    prsCalls.push(userId);
    return {
      prs: [
        { exerciseId: "ex-banca", exerciseName: "Press de banca", weightKg: 100, reps: 5, achievedAt: "2026-03-02T10:00:00.000Z" },
      ],
      loading: false,
      error: null,
    };
  },
}));

const ROUTINE = {
  id: "r-1",
  user_id: ATHLETE,
  title: "Fuerza 4 días",
  description: null,
  created_at: "2026-02-01T10:00:00.000Z",
  is_favorite: false,
  source: "human_coach",
  authored_by_coach: "coach-1",
};

/** Mounts the panel and waits for the two history reads to settle. */
async function mountCRM(athleteId: string | null) {
  const view = render(<AthleteCRM athleteId={athleteId} />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  fixture = { routines: [ROUTINE] };
  reads = [];
  rankCalls.length = 0;
  rankViewCalls.length = 0;
  prsCalls.length = 0;
});

afterEach(() => {
  cleanup();
});

// ------------------------------------------------------------------- tests

describe("AthleteCRM · a quién lee", () => {
  it("filtra el historial por el usuario de la selección", async () => {
    await mountCRM(ATHLETE);

    const read = reads.find((r) => r.table === "routines");
    // The same column the coach SELECT policy checks. Anything else and the two disagree,
    // and the policy is the one that has to win.
    expect(read?.calls).toContainEqual(["eq", "user_id", ATHLETE]);
  });

  it("lee las rutinas del usuario, no las del coach", async () => {
    await mountCRM(ATHLETE);

    const read = reads.find((r) => r.table === "routines");
    expect(read?.calls.some((call) => String(call[1]) === "coach-1")).toBe(false);
  });

  it("pasa el atleta a los rangos y a los records", async () => {
    await mountCRM(ATHLETE);

    expect(rankCalls.at(-1)).toEqual({ userId: ATHLETE, readOnly: true });
    expect(rankViewCalls.at(-1)).toEqual({ userId: ATHLETE, readOnly: true });
    expect(prsCalls.at(-1)).toBe(ATHLETE);
  });

  it("no pregunta nada sin atleta seleccionado", async () => {
    await mountCRM(null);

    // The prompt renders instead of the sections, so an unselected panel issues no reads at
    // all -- rather than reading whatever the previous athlete's id was.
    expect(reads).toEqual([]);
    expect(screen.getByText(T.crmSelectPrompt)).toBeTruthy();
  });
});

describe("AthleteCRM · modo lectura", () => {
  it("no deja que el coach escriba en el almacén de rangos del atleta", async () => {
    await mountCRM(ATHLETE);

    /*
     * The store behind these ranks is keyed by muscle alone and shared by every account on
     * the origin, so a write from here would put hysteresis into the athlete's own next
     * evaluation -- and into the coach's own /rangos.
     */
    expect(rankCalls.at(-1)?.readOnly).toBe(true);
    expect(rankViewCalls.at(-1)?.readOnly).toBe(true);
  });
});

describe("AthleteCRM · historial de rutinas", () => {
  it("lee ejercicios y nombres en dos consultas, no por embedding", async () => {
    await mountCRM(ATHLETE);

    const tables = reads.map((r) => r.table);
    expect(tables).toContain("routine_exercises");
    expect(tables).toContain("exercises");
  });

  it("acota el historial y nombra los ejercicios por día", async () => {
    fixture = {
      routines: [ROUTINE],
      routineExercises: [
        { id: "re-1", routine_id: "r-1", exercise_id: "ex-banca", target_sets: 4, rest_seconds: 90, order_index: 0, day_index: 0, day_label: "Pecho", target_reps_min: 5, target_reps_max: 8 },
        { id: "re-2", routine_id: "r-1", exercise_id: "ex-squat", target_sets: 4, rest_seconds: 120, order_index: 1, day_index: 1, day_label: "Pierna", target_reps_min: 5, target_reps_max: 5 },
      ],
      exercises: [
        { id: "ex-banca", name: "Press de banca" },
        { id: "ex-squat", name: "Sentadilla" },
      ],
    };

    await mountCRM(ATHLETE);

    await waitFor(() => expect(screen.getByText("Fuerza 4 días")).toBeTruthy());

    /*
     * Matched on the whole paragraph rather than on the exercise name alone: "Press de
     * banca" also appears in the records section, so a name-only query would be ambiguous
     * and could pass against the wrong one of the two.
     */
    const dayLine = (label: string, exercise: string) =>
      screen.getByText(
        (_content, element) =>
          element?.tagName === "P" &&
          (element.textContent ?? "").includes(label) &&
          (element.textContent ?? "").includes(exercise),
      );

    // Grouped by day, so the history reads like the routine the athlete will open.
    expect(dayLine("Día 1", "Press de banca")).toBeTruthy();
    expect(dayLine("Día 2", "Sentadilla")).toBeTruthy();
  });

  it("etiqueta una rutina escrita por un coach humano", async () => {
    await mountCRM(ATHLETE);
    await waitFor(() => expect(screen.getByText(T.historyAuthoredByCoach)).toBeTruthy());
  });

  it("distingue una rutina generada por la IA", async () => {
    fixture = { routines: [{ ...ROUTINE, source: "ai", authored_by_coach: null }] };
    await mountCRM(ATHLETE);
    await waitFor(() => expect(screen.getByText(T.historyAuthoredByAi)).toBeTruthy());
  });

  it("atribuye al atleta una rutina sin fuente, en vez de inventar una", async () => {
    // `source` is nullable: null means "not attributed", which is not the same as "written
    // by the athlete" and is certainly not "written by a coach".
    fixture = { routines: [{ ...ROUTINE, source: null, authored_by_coach: null }] };
    await mountCRM(ATHLETE);
    await waitFor(() => expect(screen.getByText(T.historyAuthoredByAthlete)).toBeTruthy());
  });

  it("muestra el estado vacío cuando no hay rutinas", async () => {
    fixture = { routines: [] };
    await mountCRM(ATHLETE);

    await waitFor(() => expect(screen.getByText(T.historyEmpty)).toBeTruthy());
    // No routine, so no second round trip to name exercises that are not referenced.
    expect(reads.some((r) => r.table === "routine_exercises")).toBe(false);
  });

  it("reporta el error del historial sin tumbar el resto del panel", async () => {
    fixture = { errorTable: "routines" };
    await mountCRM(ATHLETE);

    await waitFor(() => expect(screen.getByText(T.crmLoadError)).toBeTruthy());
    // The records section is independent and still answers.
    expect(screen.getByText("Press de banca")).toBeTruthy();
  });
});

describe("AthleteCRM · secciones", () => {
  it("declara que la sección de molestias no existe todavía", async () => {
    await mountCRM(ATHLETE);

    // `session_checkins` has no DDL in this repo, so reading it here would be a runtime
    // error rather than an empty list. Saying so beats a bare "no data".
    expect(screen.getByText(T.checkinsPending)).toBeTruthy();
    expect(reads.some((r) => r.table === "session_checkins")).toBe(false);
  });

  it("lista las cinco secciones en orden", async () => {
    await mountCRM(ATHLETE);

    const headings = screen
      .getAllByRole("heading")
      .map((node) => node.textContent)
      .filter((text): text is string => text !== null);

    expect(headings).toEqual([
      T.crmTitle,
      T.crmRanksSection,
      T.crmVolumeSection,
      T.crmPrsSection,
      T.crmHistorySection,
      T.crmCheckinsSection,
    ]);
  });
});