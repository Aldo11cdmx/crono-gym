/**
 * @vitest-environment jsdom
 *
 * Two things are asserted here that a screenshot cannot show.
 *
 * The panel is *not* a gate. It draws a clock and never consults it to decide whether the
 * coach may work, so the tests pin that down from both sides: at 03:00, off shift, the
 * switch is still operable.
 *
 * And the write is one column on one row. The migration's column-level grant is what makes
 * it legal -- RLS is row-level and would otherwise have let this toggle rewrite the
 * coach's `pin_hash` -- so a test asserts the update payload contains `is_available` and
 * nothing else, and that it is scoped by `user_id` rather than by an id the client supplied.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ShiftPanel } from "./ShiftPanel";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { COACH_SHIFTS } from "@/lib/coach/access";

const COACH = "coach-1";

// ------------------------------------------------------------------- mocks

type Call = [string, ...unknown[]];

interface Update {
  values: Record<string, unknown>;
  calls: Call[];
}

interface Fixture {
  isAvailable?: boolean | null;
  readError?: string | null;
  writeError?: string | null;
}

interface Mock {
  updates: Update[];
  reads: Call[][];
}

let fixture: Fixture = {};
let recorded: Mock = { updates: [], reads: [] };

vi.mock("@lib/supabase", () => ({
  supabase: {
    from() {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};

      for (const method of ["select", "eq"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push([method, ...args]);
          return builder;
        };
      }

      builder.maybeSingle = () => builder;

      builder.update = (values: Record<string, unknown>) => {
        // Live reference: `update()` runs before `.eq("user_id", …)`, so a copy taken here
        // would always be empty and the scoping assertion would pass against nothing.
        recorded.updates.push({ values, calls });
        return builder;
      };

      builder.then = (resolve: (value: { data: unknown; error: { message: string } | null }) => void) => {
        recorded.reads.push([...calls]);

        /*
         * A read and a write on this table differ in exactly one way: the read carries
         * `select`. That is how the mock tells them apart, and it is checked here rather
         * than tracked with a flag because the two chains are otherwise identical.
         */
        const isRead = calls.some((call) => call[0] === "select");

        if (!isRead) {
          const failure = fixture.writeError ?? null;
          return resolve({ data: null, error: failure ? { message: failure } : null });
        }

        const failure = fixture.readError ?? null;
        const value =
          fixture.isAvailable === null || fixture.isAvailable === undefined
            ? null
            : { is_available: fixture.isAvailable };
        return resolve({ data: failure ? null : value, error: failure ? { message: failure } : null });
      };

      return builder;
    },
  },
}));

function installSupabaseMock(next: Fixture = {}): Mock {
  fixture = next;
  recorded = { updates: [], reads: [] };
  return recorded;
}

beforeEach(() => {
  installSupabaseMock({ isAvailable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Renders and waits for the initial availability read to land. */
async function renderPanel(): Promise<void> {
  render(<ShiftPanel userId={COACH} />);
  await waitFor(() => expect(recorded.reads.length).toBeGreaterThan(0));
  await act(async () => {});
}

function switchControl(): HTMLInputElement {
  return screen.getByRole("checkbox") as HTMLInputElement;
}

// ------------------------------------------------------------------- tests

/**
 * A local wall-clock instant, not a UTC one.
 *
 * `shiftAt` subtracts the machine's own offset, so `09:00Z` lands in the morning shift on a
 * UTC box and outside it on a box in New York. Constructing the date from local parts makes
 * "09:00 where the coach is" true whatever the machine's zone, which is the only way this
 * assertion can mean anything on someone else's CI.
 */
function localTime(hour: number, minute = 0): Date {
  return new Date(2026, 9, 3, hour, minute, 0, 0);
}

describe("ShiftPanel · el reloj", () => {
  it("muestra el turno en curso con sus dos horas", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(localTime(9));
    await renderPanel();

    expect(screen.getByText(T.shiftHours(COACH_SHIFTS[0].startHour, COACH_SHIFTS[0].endHour))).not.toBeNull();
  });

  it("muestra cuándo abre el siguiente turno fuera de horario", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(localTime(3));
    await renderPanel();

    // Off shift, so it must be naming a time rather than showing a shift that is not
    // running. The exact clock is the machine's, so the assertion is on the sentence.
    expect(screen.queryByText(/^Tu turno abre /)).not.toBeNull();
  });

  it("no usa el reloj como puerta", async () => {
    // D8. A shift belongs to the desk, not to a coach: there is no column assigning one to
    // a person, so a clock saying "off shift" must not stop this coach working.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(localTime(3));
    await renderPanel();

    expect(switchControl().disabled).toBe(false);
  });
});

describe("ShiftPanel · el interruptor", () => {
  it("se enciende con lo que leyó de la fila del coach", async () => {
    installSupabaseMock({ isAvailable: true });
    await renderPanel();

    expect(switchControl().checked).toBe(true);
  });

  it("escribe una sola columna y se limita a la fila del coach", async () => {
    // The column grant is the only thing making this legal: an update policy alone would
    // have let this same call rewrite `pin_hash`.
    const mock = installSupabaseMock({ isAvailable: true });
    await renderPanel();

    fireEvent.click(switchControl());

    await waitFor(() => expect(mock.updates).toHaveLength(1));
    expect(mock.updates[0].values).toEqual({ is_available: false });
    expect(mock.updates[0].calls).toEqual([["eq", "user_id", COACH]]);
  });

  it("lo apaga y lo vuelve a encender", async () => {
    const mock = installSupabaseMock({ isAvailable: true });
    await renderPanel();

    fireEvent.click(switchControl());
    await waitFor(() => expect(switchControl().checked).toBe(false));
    expect(mock.updates[0].values).toEqual({ is_available: false });

    fireEvent.click(switchControl());
    await waitFor(() => expect(switchControl().checked).toBe(true));
    expect(mock.updates[1].values).toEqual({ is_available: true });
  });

  it("lee la fila por user_id, nunca por un id que envíe el cliente", async () => {
    const mock = installSupabaseMock({ isAvailable: true });
    await renderPanel();

    const read = mock.reads[0];
    expect(read).toEqual([["select", "is_available"], ["eq", "user_id", COACH]]);
  });

  it("no se mueve si el servidor rechaza la escritura", async () => {
    // The column grant is the only thing making the write legal, so a refusal means the row
    // is not the one we thought -- and a toggle showing the wrong state is worse than one
    // that does not move.
    installSupabaseMock({ isAvailable: true, writeError: "denied" });
    await renderPanel();

    fireEvent.click(switchControl());

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(T.queueError));
    expect(switchControl().checked).toBe(true);
  });

  it("explica para qué sirve el interruptor", async () => {
    // What the panel claims today: that turning this on makes premium athletes able to
    // request a session. Nothing in the athlete-facing product reads `is_available` yet --
    // recorded as a Block 5 TODO -- so this hint is currently aspirational, and the honest
    // fix is either shipping the reader or rewording this line. Asserted so that when the
    // reader lands, changing the copy is a deliberate act.
    installSupabaseMock({ isAvailable: true });
    await renderPanel();

    expect(screen.getByText(T.availabilityHint)).not.toBeNull();
  });
});

describe("ShiftPanel · quien no es coach", () => {
  it("deja el interruptor apagado y deshabilitado sin fila", async () => {
    // A signed-in user with no `coaches` row is somebody who is not a coach. Disabled
    // rather than off: "off" is a decision and this is an absence.
    installSupabaseMock({ isAvailable: null });
    await renderPanel();

    expect(switchControl().disabled).toBe(true);
    expect(switchControl().checked).toBe(false);
  });

  it("no escribe nada si no hay fila", async () => {
    const mock = installSupabaseMock({ isAvailable: null });
    await renderPanel();

    fireEvent.click(switchControl());

    await waitFor(() => expect(mock.updates).toHaveLength(0));
  });

  it("no falla la pantalla cuando la lectura se cae", async () => {
    // The panel is informational; a coach who cannot read their own availability can still
    // work the queue. A silent null is the right failure here, not an error banner over a
    // switch nobody can use.
    installSupabaseMock({ isAvailable: true, readError: "boom" });
    await renderPanel();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(switchControl().disabled).toBe(true);
  });
});