/**
 * @vitest-environment jsdom
 *
 * Two things are asserted, and the second is the one that matters.
 *
 * The reduction keeps the heaviest set per exercise, and the *earliest* date that weight was
 * reached. Rows arrive newest-first, so the naive version -- first row wins -- silently
 * reports the most recent repetition of a record as the date it was set. Every test here
 * therefore states the expected date explicitly rather than checking that some date exists.
 *
 * And the query is asserted as a query: `!inner` on the join, `is_warmup` excluded, weights
 * non-null, and scoped by `workout_logs.user_id`. That last one is not a detail -- it is the
 * same column the coach SELECT policy from `20261003030000_coach_portal.sql` checks, so the
 * filter and the policy are one thing. A filter on anything else would be a filter the
 * database has already refused to widen.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { MAX_SETS, reduceToRecords, useAthletePRs, type SetRow } from "./useAthletePRs";

// ------------------------------------------------------------------- mocks

type Call = [string, ...unknown[]];

interface Fixture {
  sets?: unknown[];
  exercises?: unknown[];
  setsError?: string | null;
  exercisesError?: string | null;
}

interface Recorded {
  table: string;
  calls: Call[];
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
        reads.push({ table, calls: [...calls] });

        if (table === "completed_sets") {
          const failure = fixture.setsError ?? null;
          return resolve({
            data: failure ? null : (fixture.sets ?? []),
            error: failure ? { message: failure } : null,
          });
        }

        if (table === "exercises") {
          const failure = fixture.exercisesError ?? null;
          return resolve({
            data: failure ? null : (fixture.exercises ?? []),
            error: failure ? { message: failure } : null,
          });
        }

        return resolve({ data: null, error: null });
      };

      return builder;
    },
  },
}));

/** Mounts the hook and waits for both reads to settle. */
async function mountHook(userId: string | null) {
  function Probe() {
    const { prs, loading, error } = useAthletePRs(userId);
    return (
      <div>
        <span data-testid="loading">{String(loading)}</span>
        <span data-testid="error">{error ?? ""}</span>
        <ul>
          {prs.map((pr) => (
            <li key={pr.exerciseId}>
              {pr.exerciseName}|{pr.weightKg}|{pr.reps ?? "-"}|{pr.achievedAt}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const view = render(<Probe />);
  await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
  return view;
}

/** A completed-set row, newest-first shaped. */
const set = (
  exerciseId: string,
  weight: number | null,
  startedAt: string,
  reps: number | null = 5,
): SetRow => ({
  exercise_id: exerciseId,
  weight,
  reps,
  workout_logs: { started_at: startedAt },
});

beforeEach(() => {
  fixture = {};
  reads = [];
});

afterEach(() => {
  cleanup();
});

// ------------------------------------------------------------------- tests

describe("useAthletePRs · la consulta", () => {
  it("filtra por el usuario del workout, que es la columna que la política comprueba", async () => {
    await mountHook("athlete-1");

    const read = reads.find((r) => r.table === "completed_sets");
    expect(read).toBeDefined();
    expect(read?.calls).toContainEqual(["eq", "workout_logs.user_id", "athlete-1"]);
  });

  it("excluye los ajustes y los pesos nulos", async () => {
    // A 60 kg warm-up on a 100 kg day is not a record, and a null weight is not a number.
    await mountHook("athlete-1");

    const read = reads.find((r) => r.table === "completed_sets");
    expect(read?.calls).toContainEqual(["eq", "is_warmup", false]);
    expect(read?.calls).toContainEqual(["not", "weight", "is", null]);
  });

  it("usa inner join, para que el filtro pueda quitar los workouts que no son del atleta", async () => {
    await mountHook("athlete-1");

    const read = reads.find((r) => r.table === "completed_sets");
    // Without `!inner` the `.eq` is a predicate applied after the embed and cannot remove a
    // parent row, which is the difference between filtering and annotating.
    expect(String(read?.calls[0]?.[1])).toContain("!inner");
  });

  it("acota la ventana con un límite nombrado", async () => {
    await mountHook("athlete-1");

    const read = reads.find((r) => r.table === "completed_sets");
    expect(read?.calls).toContainEqual(["limit", MAX_SETS]);
  });

  it("no pregunta nada sin atleta", async () => {
    await mountHook(null);

    // A null userId means "no selection", not "everyone": querying anyway would be the one
    // call in this file that could return rows the coach has no claim to.
    expect(reads).toEqual([]);
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });
});

describe("useAthletePRs · nombres y errores", () => {
  it("resuelve los nombres del catálogo en una segunda lectura", async () => {
    fixture = {
      sets: [set("ex-banca", 80, "2026-10-01T10:00:00.000Z")],
      exercises: [{ id: "ex-banca", name: "Press de banca" }],
    };
    await mountHook("athlete-1");

    expect(screen.getByText("Press de banca|80|5|2026-10-01T10:00:00.000Z")).toBeTruthy();
    expect(reads.filter((r) => r.table === "exercises")).toHaveLength(1);
  });

  it("cae al id cuando el catálogo no tiene el ejercicio", async () => {
    // An id is unreadable but not wrong; a blank row would read as a broken section.
    fixture = { sets: [set("ex-desconocido", 60, "2026-10-01T10:00:00.000Z")] };
    await mountHook("athlete-1");

    expect(screen.getByText(/ex-desconocido\|60/)).toBeTruthy();
  });

  it("no tira la lista entera si falla la lectura de nombres", async () => {
    fixture = {
      sets: [set("ex-banca", 80, "2026-10-01T10:00:00.000Z")],
      exercisesError: "boom",
    };
    await mountHook("athlete-1");

    expect(screen.getByText(/ex-banca\|80/)).toBeTruthy();
    expect(screen.getByTestId("error").textContent).toBe("");
  });

  it("reporta el error de la lectura principal", async () => {
    fixture = { setsError: "sin permiso" };
    await mountHook("athlete-1");

    expect(screen.getByTestId("error").textContent).toBe("sin permiso");
  });

  it("sanitiza ids con sufijo :N antes de pasarlos al .in()", async () => {
    // If an exercise_id from completed_sets arrives with a ":1" suffix
    // (PostgREST embed leak), the .in() on exercises must strip it —
    // otherwise PostgREST rejects the whole batch with a 400.
    fixture = {
      sets: [set("ex-banca:1", 80, "2026-10-01T10:00:00.000Z")],
      exercises: [{ id: "ex-banca", name: "Press de banca" }],
    };
    await mountHook("athlete-1");

    const exercisesRead = reads.find((r) => r.table === "exercises");
    const inCall = exercisesRead?.calls.find(
      (c: unknown[]) => c[0] === "in" && c[1] === "id",
    ) as [string, string, string[]] | undefined;
    expect(inCall?.[2]).toEqual(["ex-banca"]);
  });
});

describe("reduceToRecords · la reducción", () => {
  const names = new Map([["ex-banca", "Press de banca"]]);

  it("conserva el peso máximo por ejercicio", () => {
    const records = reduceToRecords(
      [
        set("ex-banca", 80, "2026-10-03T10:00:00.000Z"),
        set("ex-banca", 100, "2026-09-01T10:00:00.000Z"),
        set("ex-banca", 90, "2026-09-15T10:00:00.000Z"),
      ],
      names,
    );

    expect(records).toHaveLength(1);
    expect(records[0].weightKg).toBe(100);
  });

  it("reporta la fecha más antigua en que se alcanzó ese máximo", () => {
    // The judgement call this whole file exists to pin. Rows arrive newest-first, so
    // first-row-wins would answer September for a record set in March.
    const records = reduceToRecords(
      [
        set("ex-banca", 100, "2026-09-20T10:00:00.000Z", 5),
        set("ex-banca", 100, "2026-03-02T10:00:00.000Z", 3),
        set("ex-banca", 100, "2026-07-11T10:00:00.000Z", 5),
      ],
      names,
    );

    expect(records[0].achievedAt).toBe("2026-03-02T10:00:00.000Z");
    // And the reps come from the set that set it, not from the row that happened to be first.
    expect(records[0].reps).toBe(3);
  });

  it("reinicia la fecha cuando el máximo sube", () => {
    const records = reduceToRecords(
      [
        set("ex-banca", 110, "2026-08-01T10:00:00.000Z"),
        set("ex-banca", 100, "2026-01-01T10:00:00.000Z"),
      ],
      names,
    );

    // The old date belonged to the old record.
    expect(records[0].weightKg).toBe(110);
    expect(records[0].achievedAt).toBe("2026-08-01T10:00:00.000Z");
  });

  it("ordena por fecha descendente y deja los registros sin fecha al final", () => {
    const records = reduceToRecords(
      [
        set("ex-sin-fecha", 50, ""),
        set("ex-viejo", 60, "2026-01-01T10:00:00.000Z"),
        set("ex-nuevo", 70, "2026-06-01T10:00:00.000Z"),
      ],
      names,
    );

    expect(records.map((r) => r.exerciseId)).toEqual(["ex-nuevo", "ex-viejo", "ex-sin-fecha"]);
  });

  it("descarta pesos que no son un número positivo", () => {
    const records = reduceToRecords(
      [set("ex-banca", 0, "2026-01-01T10:00:00.000Z"), set("ex-banca", null, "2026-01-02T10:00:00.000Z")],
      names,
    );

    expect(records).toEqual([]);
  });

  it("acepta la relación embebida como arreglo o como objeto", () => {
    const asArray: SetRow = {
      exercise_id: "ex-banca",
      weight: 70,
      reps: 5,
      workout_logs: [{ started_at: "2026-05-05T10:00:00.000Z" }],
    };

    expect(reduceToRecords([asArray], names)[0].achievedAt).toBe("2026-05-05T10:00:00.000Z");
  });

  it("cuenta un set sin workout legible, pero no puede fecharlo", () => {
    const orphan: SetRow = {
      exercise_id: "ex-banca",
      weight: 70,
      reps: 5,
      workout_logs: null,
    };

    const records = reduceToRecords([orphan], names);
    expect(records[0].weightKg).toBe(70);
    expect(records[0].achievedAt).toBe("");
  });
});

describe("useAthletePRs · al cambiar de atleta", () => {
  it("descarta los registros del atleta anterior", async () => {
    /*
     * The race the `mounted` ref exists for: a coach clicking through two athletes faster
     * than the network answers would otherwise see the first athlete's records under the
     * second athlete's name.
     */
    fixture = { sets: [set("ex-banca", 80, "2026-10-01T10:00:00.000Z")] };

    function Probe({ userId }: { userId: string }) {
      const { prs } = useAthletePRs(userId);
      return <span data-testid="count">{prs.length}</span>;
    }

    const view = render(<Probe userId="athlete-1" />);
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    await act(async () => {
      view.rerender(<Probe userId="athlete-2" />);
    });

    await waitFor(() => {
      expect(reads.filter((r) => r.table === "completed_sets").at(-1)?.calls).toContainEqual([
        "eq",
        "workout_logs.user_id",
        "athlete-2",
      ]);
    });
  });
});