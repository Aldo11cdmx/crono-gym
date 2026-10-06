/**
 * @vitest-environment jsdom
 *
 * The button's whole job is a rule about where it may and may not appear, so nearly every
 * test here is that rule. It is also mounted in the shell rather than on a screen, which
 * means nothing else in the app is responsible for it -- so if it silently stops rendering,
 * the only symptom is a feature nobody can find.
 *
 * The sheet is mocked: it has its own suite. What matters from here is *when* it is asked
 * for, not what it does once asked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CoachFloatingButton } from "./CoachFloatingButton";
import { SYMMETRY_LABELS as T } from "@/lib/i18n";

const sheetMock = vi.fn<(props: Record<string, unknown>) => null>(() => null);
vi.mock("./SymmetryBottomSheet", () => ({
  SymmetryBottomSheet: (props: Record<string, unknown>) => {
    sheetMock(props);
    // Honours `open` the way the real sheet does, so "closed" is observable in the tree
    // and not only in the prop. A mock that always rendered would make the closed case
    // unfalsifiable from the outside.
    return props.open ? <div data-testid="sheet" /> : null;
  },
}));

// The shell sits outside the session provider, so the button reads it from this context.
interface FakeActiveSession {
  session: { routineId: string | null; title: string; startedAt: string } | null;
  isActive: boolean;
}
const sessionMock = vi.fn<() => FakeActiveSession>(() => ({ session: null, isActive: false }));
vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: () => sessionMock(),
}));

// For the case where nobody supplied an id and the button has to resolve one itself.
interface FakeAuthSession {
  session: { user: { id: string } } | null;
}
const getSession = vi.fn<() => Promise<{ data: FakeAuthSession }>>(async () => ({
  data: { session: null },
}));
vi.mock("@lib/supabase", () => ({ supabase: { auth: { getSession: () => getSession() } } }));

/**
 * Renders the button on `path`.
 *
 * `userId` goes in an options bag rather than as a positional argument because the
 * component treats `undefined` as a meaningful third value -- "not supplied, resolve it
 * yourself" -- and a defaulted positional parameter cannot tell that from "not passed",
 * which would silently make every resolution test an ordinary one.
 */
function renderAt(path: string, options: { userId?: string | null } = { userId: "u1" }) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <CoachFloatingButton userId={options.userId} />
              <main>page</main>
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

/** The shell's call: no id at all, so the button resolves one itself. */
function renderResolving(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<CoachFloatingButton />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sheetMock.mockClear();
  sessionMock.mockReturnValue({ session: null, isActive: false });
  getSession.mockResolvedValue({ data: { session: null } });
});

afterEach(cleanup);

// ------------------------------------------------------------- visibility

describe("CoachFloatingButton · dónde aparece", () => {
  it("aparece en cualquier pantalla menos en el portal del entrenador", () => {
    for (const path of ["/entrenar", "/", "/ranking", "/perfil", "/entrenamiento", "/coach"]) {
      const view = renderAt(path);
      expect(screen.getByTestId("coach-fab"), `faltaba en ${path}`).toBeTruthy();
      view.unmount();
    }
  });

  it("se esconde en el portal del entrenador", () => {
    // The portal has its own chrome and its own lock; a floating "ask the AI" button over
    // it is noise, and worse, it lands on top of the portal's primary action.
    renderAt("/coach/portal");

    expect(screen.queryByTestId("coach-fab")).toBeNull();
  });

  it("se anuncia con un nombre que dice quién es Symmetry", () => {
    renderAt("/");

    // Not "chat" or "help": an icon-only button has to say what it opens, and the athlete
    // meets the name here before anywhere else.
    expect(screen.getByRole("button", { name: T.fabAriaLabel })).toBeTruthy();
  });

  it("es alcanzable con el pulgar", () => {
    renderAt("/");

    expect(screen.getByTestId("coach-fab").getAttribute("aria-label")).toBe(T.fabAriaLabel);
  });
});

// ---------------------------------------------------------------- opening

/**
 * The props the sheet was last rendered with.
 *
 * A spy alone is not enough: the sheet is rendered only while open, so "is it open" is
 * answered by the tree and by these props. Reading the last call rather than counting
 * calls keeps the assertions about state instead of about how many times React happened
 * to re-render.
 *
 * It throws rather than returning `undefined` when the sheet has not rendered, because a
 * silent `undefined` turns a real failure into a confusing `.open of undefined` further
 * down.
 */
function lastSheetProps(): Record<string, unknown> {
  const calls = sheetMock.mock.calls;
  if (calls.length === 0) throw new Error("la hoja aún no se ha renderizado");
  return calls[calls.length - 1][0];
}

/**
 * Opens the sheet and waits for it to appear.
 *
 * A `findBy` rather than a bare assertion, so the test never depends on how many times
 * React happened to flush.
 */
async function openSheet() {
  fireEvent.click(screen.getByTestId("coach-fab"));
  return screen.findByTestId("sheet");
}

describe("CoachFloatingButton · abrir", () => {
  it("nace cerrada, no montada", () => {
    renderAt("/");

    // The guarantee is that the assistant is not *alive*: the chat loads a transcript on
    // mount and the wizard holds state. The sheet is only rendered while open, so closed
    // means there is no sheet element at all.
    expect(screen.queryByTestId("sheet")).toBeNull();
    expect(sheetMock).not.toHaveBeenCalled();
  });

  it("abre la hoja al tocarlo", async () => {
    renderAt("/");

    await openSheet();

    expect(lastSheetProps().open).toBe(true);
  });

  it("le pasa el usuario resuelto a la hoja", async () => {
    renderAt("/", { userId: "athlete-7" });

    await openSheet();

    expect(lastSheetProps().userId).toBe("athlete-7");
  });

  it("le pasa el contexto de la rutina en curso", async () => {
    sessionMock.mockReturnValue({
      session: { routineId: "r1", title: "Push A", startedAt: "now" },
      isActive: true,
    });
    renderAt("/entrenar");

    await openSheet();

    expect(lastSheetProps().initialContext).toBe("Push A");
  });

  it("no aparece si no hay nadie con la sesión iniciada", () => {
    // Not a disabled button and not an error: there is no conversation to resume without
    // an athlete, so the doorway simply is not built.
    renderAt("/", { userId: null });

    expect(screen.queryByTestId("coach-fab")).toBeNull();
    expect(sheetMock).not.toHaveBeenCalled();
  });

  it("la cierra cuando la hoja lo pide", async () => {
    renderAt("/");
    await openSheet();

    act(() => (lastSheetProps().onClose as () => void)());

    // Unmounted rather than re-rendered closed: the button stays put, and the assistant's
    // transcript and wizard state go with it.
    expect(screen.queryByTestId("sheet")).toBeNull();
    expect(screen.getByTestId("coach-fab")).toBeTruthy();
  });

  it("vuelve a abrir tras cerrarse", async () => {
    renderAt("/");

    await openSheet();
    act(() => (lastSheetProps().onClose as () => void)());
    await openSheet();

    expect(lastSheetProps().open).toBe(true);
  });
});

// ---------------------------------------------------------------- context

describe("CoachFloatingButton · contexto de la rutina en curso", () => {
  it("en otra pantalla no nombra la sesión, aunque siga activa", async () => {
    // On /perfil the same session is usually still set. Naming a routine the athlete is
    // not doing is worse than naming none.
    sessionMock.mockReturnValue({
      session: { routineId: "r1", title: "Push A", startedAt: "now" },
      isActive: true,
    });
    renderAt("/perfil");

    await openSheet();

    expect(lastSheetProps().initialContext).toBeNull();
  });

  it("no inventa contexto cuando no hay sesión activa", async () => {
    renderAt("/entrenar");

    await openSheet();

    expect(lastSheetProps().initialContext).toBeNull();
  });

  it("el botón sigue ahí con o sin sesión", () => {
    sessionMock.mockReturnValue({
      session: { routineId: "r2", title: "Pull", startedAt: "now" },
      isActive: true,
    });
    renderAt("/entrenar");

    expect(screen.getByTestId("coach-fab")).toBeTruthy();
  });
});

// ------------------------------------------------------------- resolution

describe("CoachFloatingButton · resolver el usuario", () => {
  it("no pinta el botón hasta que sabe quién es", () => {
    // Rendering optimistically and hiding a moment later would show the button to somebody
    // standing at the login screen.
    renderResolving("/");

    expect(screen.queryByTestId("coach-fab")).toBeNull();
  });

  it("aparece con la sesión resuelta por el propio botón", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u-9" } } } });
    renderResolving("/");

    await waitFor(() => expect(screen.getByTestId("coach-fab")).toBeTruthy());
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("le pasa a la hoja el id que resolvió", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u-9" } } } });
    renderResolving("/");
    await waitFor(() => expect(screen.getByTestId("coach-fab")).toBeTruthy());

    await openSheet();

    expect(lastSheetProps().userId).toBe("u-9");
  });

  it("no aparece nunca si la sesión no existe", async () => {
    renderResolving("/");

    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(screen.queryByTestId("coach-fab")).toBeNull();
  });

  it("no aparece si el cliente de sesión falla", async () => {
    // An unreachable auth client means "nobody", never a crash in the shell.
    getSession.mockRejectedValue(new Error("offline"));
    renderResolving("/");

    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(screen.queryByTestId("coach-fab")).toBeNull();
  });

  it("no vuelve a preguntar en cada renderizado", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u-9" } } } });
    renderResolving("/");
    await waitFor(() => expect(screen.getByTestId("coach-fab")).toBeTruthy());

    fireEvent.click(screen.getByTestId("coach-fab"));

    // Once. A second round trip on every open would show the login flash again, briefly,
    // each time the athlete reaches for the button.
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});

// ----------------------------------------------------------------- portal

describe("CoachFloatingButton · el portal del entrenador", () => {
  it("se esconde ahí aunque haya un usuario resuelto", () => {
    renderAt("/coach/portal", { userId: "coach-1" });

    expect(screen.queryByTestId("coach-fab")).toBeNull();
  });

  it("vuelve en cuanto se sale del portal", () => {
    // A back/forward between `/coach/portal` and `/coach` must not leave the button
    // missing, which is what a `useState`-only rule would do.
    renderAt("/coach", { userId: "coach-1" });
    expect(screen.getByTestId("coach-fab")).toBeTruthy();
  });
});