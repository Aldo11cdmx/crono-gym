/**
 * @vitest-environment jsdom
 *
 * `usePolling` is mocked to a manual trigger, exactly as in `RequestQueue.test`: the clock
 * has its own suite, and letting a real timer run here would race every assertion against
 * a background re-read.
 *
 * The Supabase mock is a hoisted `vi.mock` over a mutable fixture rather than a per-test
 * `vi.doMock`. `doMock` only affects modules imported after it runs and this file imports
 * the component statically, so with `doMock` the component keeps the real client binding
 * and the tests pass by expecting emptiness.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { HumanCoachChat } from "./HumanCoachChat";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";

// ---------------------------------------------------------------- fixtures

const REQUEST = "req-1";
const COACH = "coach-1";
const ATHLETE = "athlete-1";

function message(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "m-1",
    request_id: REQUEST,
    sender_id: ATHLETE,
    sender_role: "athlete",
    content: "¿Cómo va el hombro?",
    created_at: "2026-10-03T09:00:00.000Z",
    ...over,
  };
}

// ------------------------------------------------------------------- mocks

/** A recorded chain call: the method name followed by its arguments. */
type Call = [string, ...unknown[]];

interface Insert {
  values: Record<string, unknown>;
}

interface Fixture {
  messages?: Record<string, unknown>[];
  readError?: string | null;
  writeError?: string | null;
  holdWrite?: boolean;
}

interface Mock {
  reads: Call[][];
  inserts: Insert[];
  releaseWrite: () => void;
}

let fixture: Fixture = {};
let recorded: Mock = { reads: [], inserts: [], releaseWrite: () => undefined };

vi.mock("@lib/supabase", () => ({
  supabase: {
    from() {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};
      let isWrite = false;

      for (const method of ["select", "eq", "order"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push([method, ...args]);
          return builder;
        };
      }

      builder.insert = (values: Record<string, unknown>) => {
        isWrite = true;
        recorded.inserts.push({ values });
        return builder;
      };

      builder.then = (resolve: (value: { data: unknown; error: { message: string } | null }) => void) => {
        recorded.reads.push([...calls]);

        if (isWrite) {
          const failure = fixture.writeError ?? null;
          const answer = () => resolve({ data: null, error: failure ? { message: failure } : null });
          if (fixture.holdWrite) {
            recorded.releaseWrite = answer;
            return undefined;
          }
          return answer();
        }

        const failure = fixture.readError ?? null;
        return resolve({
          data: failure ? null : (fixture.messages ?? []),
          error: failure ? { message: failure } : null,
        });
      };

      return builder;
    },
  },
}));

function installSupabaseMock(next: Fixture = {}): Mock {
  fixture = next;
  recorded = { reads: [], inserts: [], releaseWrite: () => undefined };
  return recorded;
}

let lastTask: (() => Promise<void>) | null = null;
let lastEnabled: boolean | null = null;

vi.mock("@/hooks/usePolling", () => ({
  usePolling: (task: () => Promise<void>, _ms: number, enabled?: boolean) => {
    lastTask = task;
    lastEnabled = enabled ?? true;
  },
}));

async function renderChat(props: Partial<Parameters<typeof HumanCoachChat>[0]> = {}) {
  const view = render(<HumanCoachChat requestId={REQUEST} userId={COACH} {...props} />);
  await waitFor(() => expect(lastTask).not.toBeNull());
  await refresh();
  return view;
}

async function refresh(): Promise<void> {
  await act(async () => {
    await lastTask?.();
  });
}

/** Types a message and submits the form. */
function send(text: string): void {
  fireEvent.change(screen.getByLabelText(T.chatPlaceholder), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: T.chatSend }));
}

beforeEach(() => {
  lastTask = null;
  lastEnabled = null;
  installSupabaseMock();
});

afterEach(() => {
  cleanup();
});

// ------------------------------------------------------------------- tests

describe("HumanCoachChat · qué lee", () => {
  it("filtra por la sesión seleccionada, no por remitente", async () => {
    const mock = installSupabaseMock({ messages: [message()] });
    await renderChat();

    const requestFilter = mock.reads[0]?.find((call) => call[0] === "eq");
    expect(requestFilter).toEqual(["eq", "request_id", REQUEST]);
  });

  it("pide la conversación en orden cronológico", async () => {
    // Ascending: a chat rendered newest-first is a transcript, not a conversation.
    const mock = installSupabaseMock({ messages: [message()] });
    await renderChat();

    const order = mock.reads[0]?.find((call) => call[0] === "order");
    expect(order).toEqual(["order", "created_at", { ascending: true }]);
  });

  it("no sondea sin una sesión seleccionada", async () => {
    // A coach with nothing open should not be paying for a transcript nobody reads.
    installSupabaseMock({ messages: [message()] });
    await renderChat({ requestId: null });

    expect(lastEnabled).toBe(false);
    expect(screen.queryByRole("heading", { name: T.chatTitle })).toBeNull();
  });
});

describe("HumanCoachChat · lo que muestra", () => {
  it("distingue lo que escribió el coach de lo que escribió el atleta", async () => {
    installSupabaseMock({
      messages: [
        message({ id: "m-1" }),
        message({ id: "m-2", sender_id: COACH, sender_role: "coach", content: "Mejorando, sigue así" }),
      ],
    });
    await renderChat();

    expect(screen.getByText("¿Cómo va el hombro?")).not.toBeNull();
    expect(screen.getByText("Mejorando, sigue así")).not.toBeNull();

    // The coach's own message is flush right; the athlete's is flush left.
    const own = screen.getByText("Mejorando, sigue así").parentElement;
    const theirs = screen.getByText("¿Cómo va el hombro?").parentElement;
    expect(own?.style.alignSelf).toBe("flex-end");
    expect(theirs?.style.alignSelf).toBe("flex-start");
  });

  it("trata un mensaje sin autor conocido como del atleta", async () => {
    // An unattributable message belongs to neither side. Defaulting it to "mine" would put
    // somebody else's words in the coach's own column.
    installSupabaseMock({ messages: [message({ id: "m-1", sender_id: null, sender_role: null })] });
    await renderChat();

    expect(screen.getByText("¿Cómo va el hombro?").parentElement?.style.alignSelf).toBe("flex-start");
  });

  it("muestra el texto del mensaje tal cual", async () => {
    // `content` is whatever an athlete typed. Rendering it as markup would make this a
    // place to run script inside a coach's authenticated session.
    installSupabaseMock({ messages: [message({ content: "<b>negrita</b> & <script>" })] });
    await renderChat();

    const shown = screen.getByText("<b>negrita</b> & <script>");
    expect(shown.tagName).toBe("P");
    expect(shown.querySelector("b")).toBeNull();
    expect(shown.querySelector("script")).toBeNull();
  });

  it("dice que no hay mensajes en vez de mostrar un transcript vacío", async () => {
    installSupabaseMock({ messages: [] });
    await renderChat();

    expect(screen.getByText(T.chatEmpty)).not.toBeNull();
  });

  it("avisa cuando no puede leer", async () => {
    installSupabaseMock({ readError: "boom" });
    await renderChat();

    expect(screen.getByRole("alert").textContent).toContain(T.chatLoadError);
  });

  it("deja la región activa en el contenedor, no en la lista", async () => {
    // A live region on the element whose height changes re-announces its whole contents on
    // every change -- so a chat growing one line at a time would be read end to end again
    // after every message.
    installSupabaseMock({ messages: [message()] });
    await renderChat();

    const live = screen.getByRole("heading", { name: T.chatTitle }).closest("section")
      ?.querySelector("[aria-live='polite']");
    expect(live).not.toBeNull();
    expect(live?.tagName).toBe("DIV");
  });

  it("limpia el transcript al cambiar de sesión", async () => {
    // Otherwise the previous athlete's messages stay on screen for the length of one
    // request, and the coach reads one conversation while thinking they read another.
    installSupabaseMock({ messages: [message({ id: "m-1", content: "Del atleta anterior" })] });
    const { rerender } = await renderChat();
    expect(screen.getByText("Del atleta anterior")).not.toBeNull();

    rerender(<HumanCoachChat requestId="req-2" userId={COACH} />);

    expect(screen.queryByText("Del atleta anterior")).toBeNull();
  });
});

describe("HumanCoachChat · enviar", () => {
  it("escribe la sesión, el remitente, el papel y el texto", async () => {
    const mock = installSupabaseMock({ messages: [] });
    await renderChat();

    send("Te dejo 3 series de peso muerto.");

    await waitFor(() => expect(mock.inserts).toHaveLength(1));
    expect(mock.inserts[0].values).toEqual({
      request_id: REQUEST,
      sender_id: COACH,
      sender_role: "coach",
      content: "Te dejo 3 series de peso muerto.",
    });
  });

  it("fuerza el papel a coach sin tomarlo de un prop", async () => {
    // There is one caller and it is always the coach. A prop a component can be handed
    // would mean a component that can write as an athlete.
    const mock = installSupabaseMock({ messages: [] });
    await renderChat();

    send("hola");

    await waitFor(() => expect(mock.inserts[0]?.values.sender_role).toBe("coach"));
  });

  it("no envía un mensaje vacío ni sólo espacios", async () => {
    const mock = installSupabaseMock({ messages: [] });
    await renderChat();

    const sendButton = screen.getByRole("button", { name: T.chatSend });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);

    // Whitespace is not a message. `draft.trim()` is the guard; the button being enabled
    // here would mean the guard was `length > 0` instead.
    fireEvent.change(screen.getByLabelText(T.chatPlaceholder), { target: { value: "    " } });
    await waitFor(() => expect((screen.getByRole("button", { name: T.chatSend }) as HTMLButtonElement).disabled).toBe(true));

    send("    ");
    await waitFor(() => expect(mock.inserts).toHaveLength(0));
  });

  it("limpia el borrador tras enviar", async () => {
    installSupabaseMock({ messages: [] });
    await renderChat();

    send("Listo");

    await waitFor(() =>
      expect((screen.getByLabelText(T.chatPlaceholder) as HTMLTextAreaElement).value).toBe(""),
    );
  });

  it("conserva el borrador si el envío falla", async () => {
    // The one failure a chat must not have: losing what someone typed because the network
    // blipped.
    installSupabaseMock({ messages: [], writeError: "boom" });
    await renderChat();

    send("Te dejo 3 series de peso muerto.");

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(T.chatError));
    expect((screen.getByLabelText(T.chatPlaceholder) as HTMLTextAreaElement).value).toBe(
      "Te dejo 3 series de peso muerto.",
    );
  });

  it("vuelve a leer después de enviar, en vez de escribir el mensaje a mano", async () => {
    // The transcript is the server's. Patching it locally would be a second source of truth
    // for a conversation with two participants.
    const mock = installSupabaseMock({ messages: [] });
    await renderChat();
    const readsBefore = mock.reads.length;

    send("Listo");

    await waitFor(() => expect(mock.reads.length).toBeGreaterThan(readsBefore));
  });

  it("no permite un segundo envío mientras el primero está en vuelo", async () => {
    // A double-tap is two messages, and the coach would not know why the athlete got two.
    const mock = installSupabaseMock({ messages: [], holdWrite: true });
    await renderChat();

    send("Uno");
    send("Dos");

    await waitFor(() => expect(mock.inserts).toHaveLength(1));

    await act(async () => {
      mock.releaseWrite();
    });
  });
});