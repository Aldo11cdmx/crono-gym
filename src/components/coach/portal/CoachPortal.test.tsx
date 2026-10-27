/**
 * @vitest-environment jsdom
 *
 * `CoachPortal` decides two things and delegates everything else, so that is what is
 * asserted here: whether the PIN gate is in front of the panels, and which athlete the
 * right-hand column is about.
 *
 * The three panels are replaced by stubs. Not to make the test easier -- to make it about
 * the parent. `RequestQueue`, `HumanCoachChat` and `ShiftPanel` each have their own suites
 * covering their own reads, writes and polling; mounting them here would test them again
 * and assert nothing about this file.
 *
 * The property worth protecting is the one a screenshot cannot show. The PIN gate renders
 * `children` only while a session is held, and those children are the panels -- so if the
 * gate were ever moved *inside* the layout, or dropped, every panel would still render and
 * every test that only looked at "the portal shows the queue" would still pass. The gate is
 * therefore asserted in both states rather than only the open one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CoachPortal } from "./CoachPortal";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";

const COACH = "coach-1";
const ATHLETE = "athlete-1";
const REQUEST = "req-1";

// ------------------------------------------------------------------- mocks

interface AuthFixture {
  isUnlocked: boolean;
  requiresPinChange: boolean;
}

let authFixture: AuthFixture = { isUnlocked: false, requiresPinChange: false };
const authCalls = { touch: 0, lock: 0 };

vi.mock("@/lib/coach/useCoachAuth", () => ({
  // `getCoachId` too: the builder reads it on every save to decide whether the write can
  // leave a routine nobody is able to clean up.
  getCoachId: () => "coach-row-1",
  useCoachAuth: () => ({
    isUnlocked: authFixture.isUnlocked,
    requiresPinChange: authFixture.requiresPinChange,
    isLoading: false,
    error: null,
    lockedUntil: null,
    unlock: vi.fn(async () => false),
    changePin: vi.fn(async () => false),
    lock: () => {
      authCalls.lock += 1;
    },
    touch: () => {
      authCalls.touch += 1;
    },
  }),
}));

vi.mock("@/lib/coach/CoachAccessGate", () => ({
  CoachPinGate: ({ children }: { children: React.ReactNode }) =>
    authFixture.isUnlocked ? <>{children}</> : <div>PIN REQUIRED</div>,
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ userId: COACH, email: "coach@example.com" }),
}));

/** The coach's own profile row. Nullable `display_name` is exercised by one test. */
let profileName: string | null = "Coach Ada";

vi.mock("@lib/supabase", () => ({
  supabase: {
    from: () => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq"]) builder[method] = () => builder;
      builder.maybeSingle = () => builder;
      builder.then = (resolve: (value: unknown) => void) =>
        resolve({ data: profileName === null ? null : { display_name: profileName }, error: null });
      return builder;
    },
  },
}));

const chatProps: { requestId: string | null }[] = [];

vi.mock("./RequestQueue", () => ({
  RequestQueue: ({ onOpenConversation }: { onOpenConversation: (r: string, a: string) => void }) => (
    <button type="button" onClick={() => onOpenConversation(REQUEST, ATHLETE)}>
      open conversation
    </button>
  ),
}));

vi.mock("./HumanCoachChat", () => ({
  HumanCoachChat: ({ requestId }: { requestId: string | null }) => {
    chatProps.push({ requestId });
    return <div>chat:{requestId}</div>;
  },
}));

vi.mock("./ShiftPanel", () => ({
  ShiftPanel: () => <div>shift panel</div>,
}));

vi.mock("./LiveGymFeed", () => ({
  LiveGymFeed: () => <div>live gym feed</div>,
}));

const crmProps: { athleteId: string | null }[] = [];

vi.mock("./AthleteCRM", () => ({
  AthleteCRM: ({ athleteId }: { athleteId: string | null }) => {
    crmProps.push({ athleteId });
    return <div>crm:{athleteId ?? "none"}</div>;
  },
}));

const builderProps: { athleteId: string | null }[] = [];

vi.mock("./VipRoutineBuilder", () => ({
  VipRoutineBuilder: ({
    athleteId,
    onSaved,
  }: {
    athleteId: string | null;
    onSaved?: (title: string) => void;
  }) => {
    builderProps.push({ athleteId });
    return (
      <button type="button" onClick={() => onSaved?.("Fuerza 4 días")}>
        save routine
      </button>
    );
  },
}));

// ----------------------------------------------------------------- helpers

beforeEach(() => {
  authFixture = { isUnlocked: true, requiresPinChange: false };
  authCalls.touch = 0;
  authCalls.lock = 0;
  profileName = "Coach Ada";
  chatProps.length = 0;
  crmProps.length = 0;
  builderProps.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ------------------------------------------------------------------- tests

describe("CoachPortal · el cerrojo", () => {
  it("no monta ningún panel sin sesión de entrenador", () => {
    authFixture.isUnlocked = false;
    render(<CoachPortal />);

    // The property this file exists to protect: locked means *nothing* is on screen, not
    // that the panels are dimmed.
    expect(screen.getByText("PIN REQUIRED")).toBeTruthy();
    expect(screen.queryByText("open conversation")).toBeNull();
    expect(screen.queryByText("shift panel")).toBeNull();
  });

  it("monta la cola y el panel de turno con sesión abierta", () => {
    render(<CoachPortal />);

    expect(screen.getByText("open conversation")).toBeTruthy();
    expect(screen.getByText("shift panel")).toBeTruthy();
  });

  it("pide confirmación antes de cerrar la sesión, y no la cierra si se cancela", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CoachPortal />);

    fireEvent.click(screen.getByRole("button", { name: T.closeSession }));

    expect(confirmSpy).toHaveBeenCalledWith(T.closeSessionConfirm);
    expect(authCalls.lock).toBe(0);
  });

  it("cierra la sesión cuando se confirma", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CoachPortal />);

    fireEvent.click(screen.getByRole("button", { name: T.closeSession }));

    expect(authCalls.lock).toBe(1);
  });
});

describe("CoachPortal · la selección", () => {
  it("pide elegir una solicitud antes de montar el chat", () => {
    render(<CoachPortal />);

    // An empty chat pane reads as a broken one; the prompt says what to do next.
    // The chat column's own copy, not the CRM's: the two are deliberately different sentences
    // so a coach with nothing selected does not read the same line once per card.
    expect(screen.getByText(T.chatSelectPrompt)).toBeTruthy();
    expect(screen.queryByText(T.crmSelectPrompt)).toBeNull();
    expect(screen.queryByText(T.builderSelectPrompt)).toBeNull();
    expect(screen.queryByText(`chat:${REQUEST}`)).toBeNull();
    expect(screen.getByText("crm:none")).toBeTruthy();
    expect(builderProps.at(-1)).toEqual({ athleteId: null });
  });

  it("eleva la solicitud y el atleta del clic a los dos consumidores", async () => {
    render(<CoachPortal />);

    await act(async () => {
      fireEvent.click(screen.getByText("open conversation"));
    });

    expect(screen.getByText(`chat:${REQUEST}`)).toBeTruthy();
    expect(screen.queryByText(T.chatSelectPrompt)).toBeNull();
    expect(chatProps.at(-1)?.requestId).toBe(REQUEST);
    /*
     * The athlete travels with the request, not just the conversation. This is the assertion
     * that would fail if the callback carried only `requestId`: the CRM would then have to
     * look the athlete up itself, on a filter that could disagree with the queue row that
     * produced the selection.
     */
    expect(crmProps.at(-1)).toEqual({ athleteId: ATHLETE });
    /*
     * The builder shares that selection, and with more force: it *writes* to the athlete's
     * library, so pointing it at the previous athlete would put a coach's prescription in
     * somebody else's account. That is the one mistake here the athlete cannot undo.
     */
    expect(builderProps.at(-1)).toEqual({ athleteId: ATHLETE });
  });

  /*
   * The regression this pins, found by looking at the rendered column at 390px: with no athlete
   * selected the chat, the CRM and the builder are all empty at the same moment and all three
   * sit in one column. They reused one sentence, so the coach read the same line three times in
   * a row -- once per card, immediately under a different heading each time.
   */
  it("cada tarjeta vacía dice lo que espera, sin repetir la frase de la otra", () => {
    expect(new Set([T.chatSelectPrompt, T.crmSelectPrompt, T.builderSelectPrompt]).size).toBe(3);
  });

  it("confirma la rutina guardada junto a la conversación, no dentro del builder", async () => {
    render(<CoachPortal />);
    await act(async () => {
      fireEvent.click(screen.getByText("open conversation"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("save routine"));
    });

    // The builder clears its own message the moment the draft resets, so the confirmation
    // has to be echoed at portal level or it vanishes exactly when it is still useful.
    expect(screen.getByText("Fuerza 4 días")).toBeTruthy();
  });
});

describe("CoachPortal · inactividad", () => {
  it("reporta actividad al coach por captura, aunque el panel no la escuche", () => {
    render(<CoachPortal />);

    expect(authCalls.touch).toBe(0);

    /*
     * Capture phase on the root, so an interaction anywhere inside counts -- including on a
     * child that has no handler of its own. A `touch` threaded through each panel instead
     * would be one component short of the timer eventually, and the symptom is a coach
     * locked out mid-session with no way to tell why.
     */
    fireEvent.pointerDown(screen.getByText("shift panel"));

    expect(authCalls.touch).toBeGreaterThan(0);
  });

  it("reporta actividad también desde el teclado", () => {
    render(<CoachPortal />);
    const before = authCalls.touch;

    fireEvent.keyDown(screen.getByText("shift panel"), { key: "Enter" });

    expect(authCalls.touch).toBeGreaterThan(before);
  });
});

describe("CoachPortal · encabezado", () => {
  it("muestra el nombre del entrenador cuando existe", async () => {
    render(<CoachPortal />);

    await waitFor(() => expect(screen.getByText("Coach Ada")).toBeTruthy());
  });

  it("cae al título del portal cuando el nombre es null", async () => {
    // `display_name` is nullable and nobody is asked to fill it, so this is a state the
    // portal will genuinely meet -- and an empty <h1> is worse than a generic one.
    profileName = null;
    render(<CoachPortal />);

    await waitFor(() => expect(screen.getAllByText(T.title).length).toBeGreaterThan(0));
  });
});