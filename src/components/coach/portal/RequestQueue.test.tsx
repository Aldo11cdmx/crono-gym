/**
 * @vitest-environment jsdom
 *
 * `usePolling` is mocked down to "run this once, on demand". The hook has its own suite
 * covering the clock -- overlap, hidden tabs, the restart -- and a queue test that let the
 * real timer run would be testing that suite again through a component, with every
 * assertion racing a background re-read.
 *
 * What is left here is the part that is genuinely the component's: which rows it asks the
 * database for, what it renders from them, and what it writes when a button is pressed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { RequestQueue } from "./RequestQueue";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";

// --------------------------------------------------------------- fixtures

const COACH = "coach-1";
const PENDING = "req-pending";
const OTHER_PENDING = "req-pending-2";
const ACTIVE = "req-active";

function request(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: PENDING,
    athlete_id: "athlete-1",
    coach_id: COACH,
    status: "pending",
    athlete_notes: "Quiero volver a press de banca.",
    created_at: "2026-10-03T09:00:00.000Z",
    updated_at: "2026-10-03T09:00:00.000Z",
    ...over,
  };
}

const PROFILES = [
  { user_id: "athlete-1", display_name: "Mara" },
  { user_id: "athlete-2", display_name: null },
];

// ------------------------------------------------------------------ mocks

/**
 * The Supabase client.
 *
 * Records every chain a test can assert on: which table was read, which filters were
 * applied, and every `update` payload. The request read deliberately honours the
 * component's `.in("status", ...)` so a test that asserts the component *asks* for open
 * requests only can observe it.
 */
interface Write {
  table: string;
  values: Record<string, unknown>;
  /** Live reference to the chain's filter list; populated as the chain is built. */
  filters: unknown[][];
}

/**
 * A hoisted `vi.mock` over a mutable fixture, rather than `vi.doMock` per test.
 *
 * `vi.doMock` only affects modules imported *after* it runs, and `RequestQueue` is a
 * static import at the top of this file -- so with `doMock` the component kept the real
 * `@lib/supabase` binding and every assertion below was quietly made against a real
 * client. `useFavorites.test` gets away with `doMock` because it imports its hook
 * dynamically inside each test; this file does not.
 *
 * The recorded chains are what let a test assert *what the component asked for*: which
 * table, which filters, and every `update` payload. The request read honours the
 * component's `.in("status", …)` so "asks for open requests only" is observable rather
 * than assumed.
 */
interface SupabaseFixture {
  requests?: Record<string, unknown>[];
  profiles?: Record<string, unknown>[];
  requestError?: string | null;
  writeError?: string | null;
  profilesError?: string | null;
  /**
   * Leave the write pending until `releaseWrite()` is called.
   *
   * The only way to hold a request open deterministically, and therefore the only way to
   * observe a component mid-write. Resolving through a bare `then` completes in a
   * microtask, so a test that only clicks can never see the in-flight state.
   */
  holdWrite?: boolean;
}

interface SupabaseMock {
  reads: { table: string; calls: unknown[][]; isWrite: boolean }[];
  writes: Write[];
  releaseWrite: () => void;
}

let fixture: SupabaseFixture = {};
let recorded: SupabaseMock = { reads: [], writes: [], releaseWrite: () => undefined };

vi.mock("@lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const filters: unknown[][] = [];
      const builder: Record<string, unknown> = {};
      /*
       * Whether this chain is a write.
       *
       * Needed because a select and an update on the same table resolve through the same
       * `then`, and a test that cannot make a write fail cannot check that a failed write
       * puts the row back.
       */
      let isWrite = false;

      for (const method of ["select", "in", "eq", "order"]) {
        builder[method] = (...args: unknown[]) => {
          // Every argument, not just the first: `.in("status", ["pending","active"])` is
          // the assertion that matters and it lives in the second.
          filters.push([method as string, ...args]);
          return builder;
        };
      }

      builder.update = (values: Record<string, unknown>) => {
        isWrite = true;
        // The live array, not a copy: `update()` runs *before* `.eq("id", …)`, so a
        // snapshot taken here would always be empty and the scoping assertion would pass
        // against a filter the mock had thrown away.
        recorded.writes.push({ table, values, filters });
        return builder;
      };

      // Only reached at the end of a chain, which is when the read resolves.
      builder.then = (resolve: (value: { data: unknown; error: { message: string } | null }) => void) => {
        recorded.reads.push({ table, calls: [...filters], isWrite });

        if (isWrite) {
          const failure = fixture.writeError ?? null;
          const answer = () => resolve({ data: null, error: failure ? { message: failure } : null });
          if (fixture.holdWrite) {
            recorded.releaseWrite = answer;
            return undefined;
          }
          return answer();
        }

        if (table === "coach_session_requests") {
          const failure = fixture.requestError ?? null;
          return resolve({
            data: failure ? null : (fixture.requests ?? []),
            error: failure ? { message: failure } : null,
          });
        }

        if (table === "profiles") {
          const failure = fixture.profilesError ?? null;
          return resolve({
            data: failure ? null : (fixture.profiles ?? PROFILES),
            error: failure ? { message: failure } : null,
          });
        }

        return resolve({ data: null, error: null });
      };

      return builder;
    },
  },
}));

/** Points the mock at a new fixture and hands back this test's recorder. */
function installSupabaseMock(next: SupabaseFixture = {}): SupabaseMock {
  fixture = next;
  recorded = { reads: [], writes: [], releaseWrite: () => undefined };
  return recorded;
}

/**
 * `usePolling` reduced to a manual trigger.
 *
 * The captured task is what the component would have had the hook call, so a test drives a
 * refresh the same way the ten-second timer would -- by calling it.
 */
let lastTask: (() => Promise<void>) | null = null;

vi.mock("@/hooks/usePolling", () => ({
  usePolling: (task: () => Promise<void>) => {
    lastTask = task;
  },
}));

/**
 * Mounts the queue and completes its first load.
 *
 * The initial render is a skeleton, and with `usePolling` mocked the task is never called
 * for us -- so the first load is driven here, exactly as the ten-second timer would.
 */
async function renderQueue(onOpenConversation = vi.fn()) {
  const view = render(<RequestQueue onOpenConversation={onOpenConversation} />);
  await waitFor(() => expect(lastTask).not.toBeNull());
  await refresh();
  return { ...view, onOpenConversation };
}

/** Runs the captured poll task inside `act`, so React has flushed the state it sets. */
async function refresh(): Promise<void> {
  await act(async () => {
    await lastTask?.();
  });
}

beforeEach(() => {
  lastTask = null;
  installSupabaseMock();
});

afterEach(() => {
  cleanup();
});

// ------------------------------------------------------------------ tests

describe("RequestQueue · qué pide al servidor", () => {
  it("filtra por estado en la consulta, no en el cliente", async () => {
    // The filter is in the query so the database refuses to return rows it does not have
    // to send. An unfiltered read would pull a coach's whole history on every poll.
    const { reads } = installSupabaseMock({ requests: [] });
    await renderQueue();

    const statuses = reads[0]?.calls.find(([m]) => m === "in")?.[2];
    expect(statuses).toEqual(["pending", "active"]);
  });

  it("no filtra por coach_id en ninguna de las dos lecturas", async () => {
    // This is the security property, not an oversight. RLS already refuses every request
    // addressed to another coach, and a client that could name its own coach_id would be
    // naming someone else's.
    const { reads } = installSupabaseMock({ requests: [] });
    await renderQueue();

    for (const read of reads) {
      expect(read.calls.some(([method, value]) => method === "eq" && value === "coach_id")).toBe(false);
      expect(read.calls.some(([method, value]) => method === "in" && Array.isArray(value) && value.includes(COACH))).toBe(false);
    }
  });

  it("lee los nombres de los atletas en una segunda consulta", async () => {
    // PostgREST cannot embed profiles through auth.users from a browser client, and a list
    // of uuids is something a coach cannot act on.
    const { reads } = installSupabaseMock({ requests: [request()] });
    await renderQueue();
    await refresh();

    const tables = reads.map((r) => r.table);
    expect(tables).toContain("coach_session_requests");
    expect(tables).toContain("profiles");
  });

  it("pide un solo nombre por atleta aunque tenga dos solicitudes", async () => {
    const { reads } = installSupabaseMock({
      requests: [
        request({ id: PENDING, athlete_id: "athlete-1" }),
        request({ id: ACTIVE, status: "active", athlete_id: "athlete-1" }),
      ],
    });
    await renderQueue();
    await refresh();

    const profileRead = reads.find((r) => r.table === "profiles");
    const ids = profileRead?.calls.find(([m]) => m === "in")?.[2];
    expect(ids).toEqual(["athlete-1"]);
  });
});

describe("RequestQueue · lo que muestra", () => {
  it("pone las pendientes antes que las activas", async () => {
    // A single newest-first list is the obvious design and it is wrong: a run of active
    // sessions would push the one request needing a decision off the panel.
    installSupabaseMock({
      requests: [
        request({ id: ACTIVE, status: "active", athlete_id: "athlete-1" }),
        request({ id: PENDING, status: "pending", athlete_id: "athlete-2" }),
      ],
    });
    await renderQueue();
    await refresh();

    const accept = screen.getByRole("button", { name: T.accept });
    expect(accept).not.toBeNull();
    expect(accept.compareDocumentPosition(screen.getByRole("button", { name: T.openConversation })))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("muestra el nombre del atleta", async () => {
    installSupabaseMock({ requests: [request()] });
    await renderQueue();
    await refresh();

    expect(screen.getByText("Mara")).not.toBeNull();
  });

  it("nombra al atleta sin nombre en vez de mostrar su uuid", async () => {
    // display_name is nullable and nobody is ever asked to fill it, so this is a state the
    // queue genuinely meets.
    installSupabaseMock({ requests: [request({ athlete_id: "athlete-2" })] });
    await renderQueue();
    await refresh();

    expect(screen.getByText(T.athleteUnnamed)).not.toBeNull();
    expect(screen.queryByText("athlete-2")).toBeNull();
  });

  it("dice que no hubo nota en vez de dejar un hueco", async () => {
    installSupabaseMock({ requests: [request({ athlete_notes: null })] });
    await renderQueue();
    await refresh();

    expect(screen.getByText(T.requestNotesEmpty)).not.toBeNull();
  });

  it("traduce el estado en vez de imprimir el valor crudo", async () => {
    installSupabaseMock({ requests: [request({ status: "pending" })] });
    await renderQueue();
    await refresh();

    expect(screen.getByText(T.requestStatus.pending)).not.toBeNull();
    expect(screen.queryByText("pending")).toBeNull();
  });

  it("muestra el estado vacío cuando no hay nada abierto", async () => {
    installSupabaseMock({ requests: [] });
    await renderQueue();
    await refresh();

    expect(screen.getByText(T.queueEmptyTitle)).not.toBeNull();
    expect(screen.queryByRole("button", { name: T.accept })).toBeNull();
  });

  it("sigue mostrando las solicitudes si sólo falla la lectura de nombres", async () => {
    // The rows are valid and still actionable; hiding the whole list over a missing label
    // would hide a request the coach is waiting on.
    installSupabaseMock({
      requests: [request()],
      profiles: [],
      profilesError: "boom",
    });
    await renderQueue();
    await refresh();

    expect(screen.getByRole("button", { name: T.accept })).not.toBeNull();
    expect(screen.getByText(T.athleteUnnamed)).not.toBeNull();
  });

  it("avisa cuando no puede leer las solicitudes", async () => {
    installSupabaseMock({ requestError: "boom" });
    await renderQueue();
    await refresh();

    expect(screen.getByRole("alert").textContent).toContain(T.queueLoadError);
  });
});

describe("RequestQueue · aceptar y rechazar", () => {
  it("acepta escribiendo sólo el estado y el id", async () => {
    const { writes } = installSupabaseMock({ requests: [request()] });
    await renderQueue();
    await refresh();

    fireEvent.click(screen.getByRole("button", { name: T.accept }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].table).toBe("coach_session_requests");
    expect(writes[0].values).toEqual({ status: "active" });
    expect(writes[0].filters).toEqual([["eq", "id", PENDING]]);
  });

  it("rechaza escribiendo declined", async () => {
    const { writes } = installSupabaseMock({ requests: [request()] });
    await renderQueue();
    await refresh();

    fireEvent.click(screen.getByRole("button", { name: T.decline }));

    await waitFor(() => expect(writes[0]?.values).toEqual({ status: "declined" }));
  });

  it("deja la fila en su sitio hasta que el servidor acepta", async () => {
    // No optimistic removal. The row stays saying "Aceptando…" while the write is in
    // flight, so the coach can see which decision is in progress and a refusal leaves
    // nothing to undo.
    installSupabaseMock({ requests: [request()] });
    await renderQueue();
    await refresh();

    fireEvent.click(screen.getByRole("button", { name: T.accept }));

    // Still a pending row with its accept button -- not yet moved to the active group.
    expect(screen.queryByRole("button", { name: T.openConversation })).toBeNull();
    expect(screen.getByText(T.accepting)).not.toBeNull();
  });

  it("vuelve a leer tras una escritura aceptada", async () => {
    // The re-read is what moves the row, rather than local patching. Observable as a
    // second read after the write: the component trusts the server, not itself.
    const mock = installSupabaseMock({ requests: [request()] });
    await renderQueue();
    await refresh();
    const readsBefore = mock.reads.length;

    fireEvent.click(screen.getByRole("button", { name: T.accept }));

    await waitFor(() => expect(mock.reads.length).toBeGreaterThan(readsBefore));
  });

  it("deja la fila y avisa si el servidor rechaza la escritura", async () => {
    // Otherwise the queue would be asserting a decision the server never accepted, until
    // the next poll happened to disagree.
    const { writes } = installSupabaseMock({ requests: [request()], writeError: "denied" });
    await renderQueue();
    await refresh();

    fireEvent.click(screen.getByRole("button", { name: T.accept }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(T.queueError));
    expect(writes).toHaveLength(1);
    // The row never moved, and the button is usable again.
    expect(screen.getByRole("button", { name: T.accept })).not.toBeNull();
  });

  it("bloquea los botones de las demás filas mientras una escritura está en vuelo", async () => {
    // Two rows, one write in flight. Accepting one and declining the other in parallel is
    // two real writes racing, and nothing here can undo the second.
    const mock = installSupabaseMock({
      requests: [
        request({ id: PENDING, athlete_id: "athlete-1" }),
        request({ id: OTHER_PENDING, athlete_id: "athlete-2" }),
      ],
      holdWrite: true,
    });

    await renderQueue();
    await refresh();

    const accepts = screen.getAllByRole("button", { name: T.accept });
    const declines = screen.getAllByRole("button", { name: T.decline });

    fireEvent.click(accepts[0]);

    // The first card is busy; the second is locked out so no second write can start.
    await waitFor(() => expect((accepts[1] as HTMLButtonElement).disabled).toBe(true));
    expect((declines[1] as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      mock.releaseWrite();
    });
  });

  it("abre la conversación de la solicitud que se pulse", async () => {
    installSupabaseMock({ requests: [request({ id: ACTIVE, status: "active" })] });
    const { onOpenConversation } = await renderQueue();
    await refresh();

    fireEvent.click(screen.getByRole("button", { name: T.openConversation }));

    // Both halves: the CRM and the builder filter by `user_id`, so a callback carrying only
    // the request id would send the parent back to the database to learn who this was.
    expect(onOpenConversation).toHaveBeenCalledWith(ACTIVE, "athlete-1");
  });

  it("no ofrece conversación ni botones a una solicitud rechazada", async () => {
    // The component filters to pending and active, so a declined row that arrives anyway --
    // a stale poll, a widened status filter -- must not render as actionable.
    installSupabaseMock({ requests: [request({ status: "declined" })] });
    await renderQueue();
    await refresh();

    expect(screen.queryByRole("button", { name: T.accept })).toBeNull();
    expect(screen.queryByRole("button", { name: T.openConversation })).toBeNull();
    expect(within(screen.getByRole("region")).getByText(T.queueEmptyTitle)).not.toBeNull();
  });
});
