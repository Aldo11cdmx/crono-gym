/**
 * @vitest-environment jsdom
 *
 * The sheet is a dialog, so most of these are about the parts a dialog gets wrong: focus
 * escaping it, Escape not closing it, and a backdrop click that fires when the athlete was
 * tapping inside the panel. Those three are invisible in a screenshot and are exactly what
 * a screen-reader or one-handed user notices.
 *
 * `CoachChat` and the wizard are mocked. They are tested on their own, and a sheet test
 * that mounts the real chat is a test of IndexedDB.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CronosBottomSheet } from "./CronosBottomSheet";
import { CRONOS_LABELS as T } from "@/lib/i18n";

/**
 * Typed mocks rather than `vi.fn(() => <div/>)`.
 *
 * The assertions read `mock.calls[n][0]`, and an untyped zero-argument mock types that
 * index as `undefined` -- which is a type error, not a runtime one, and therefore the mock
 * would silently stop describing the props the component passes.
 */
const chatMock = vi.fn<(props: Record<string, unknown>) => React.ReactElement>(() => <div data-testid="coach-chat" />);
const wizardMock = vi.fn<(props: Record<string, unknown>) => React.ReactElement>(
  () => <div data-testid="routine-wizard" />,
);

vi.mock("./CoachChat", () => ({ CoachChat: (props: Record<string, unknown>) => chatMock(props) }));
vi.mock("./RoutineGeneratorWizard", () => ({
  RoutineGeneratorWizard: (props: Record<string, unknown>) => wizardMock(props),
}));

// The context the chat needs before it will mount.
vi.mock("@/hooks/useCoach", () => ({
  useCoachContext: () => ({ context: { generatedAt: "now" }, loading: false, error: null }),
}));
vi.mock("@/context/GymSettingsContext", () => ({
  useGymSettings: () => ({ inventory: {}, barType: "olympic", customBarKg: 20 }),
}));

function renderSheet(overrides: Partial<Parameters<typeof CronosBottomSheet>[0]> = {}) {
  const props = { open: true, onClose: vi.fn(), userId: "u1", ...overrides };
  const view = render(<CronosBottomSheet {...props} />);
  return { ...view, props };
}

afterEach(() => {
  cleanup();
  chatMock.mockClear();
  wizardMock.mockClear();
});

// -------------------------------------------------------------- opening

describe("CronosBottomSheet · abrir y cerrar", () => {
  it("no monta nada mientras está cerrada", () => {
    renderSheet({ open: false });

    // Not merely hidden: the chat loads a transcript on mount and the wizard holds a
    // wizard's worth of state, so a hidden tree would keep both alive behind the button.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("se anuncia como un diálogo modal con nombre", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe(T.sheetAriaLabel);
  });

  it("el botón de cerrar avisa a quien la abrió", () => {
    const { props } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: T.closeAriaLabel }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape cierra", () => {
    const { props } = renderSheet();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("cualquier otra tecla no cierra", () => {
    const { props } = renderSheet();

    fireEvent.keyDown(document, { key: "a" });

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("un toque en el overlay cierra", () => {
    const { props } = renderSheet();

    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("un toque dentro del panel no cierra", () => {
    // The panel stops propagation, so a tap on a paragraph cannot dismiss the sheet the
    // paragraph is in. Without this the sheet is unusable with a mouse.
    const { props } = renderSheet();

    fireEvent.click(screen.getByRole("dialog"));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("un deslizamiento hacia abajo cierra, y uno hacia arriba no", () => {
    const { props, unmount } = renderSheet();
    const dialog = screen.getByRole("dialog");

    fireEvent.touchStart(dialog, { touches: [{ clientY: 400 }] });
    fireEvent.touchEnd(dialog, { changedTouches: [{ clientY: 300 }] });

    // An upward swipe is somebody trying to scroll the conversation.
    expect(props.onClose).not.toHaveBeenCalled();
    unmount();

    const second = renderSheet();
    const again = screen.getByRole("dialog");
    fireEvent.touchStart(again, { touches: [{ clientY: 300 }] });
    fireEvent.touchEnd(again, { changedTouches: [{ clientY: 420 }] });

    expect(second.props.onClose).toHaveBeenCalledTimes(1);
  });

  it("un deslizamiento corto no cierra", () => {
    const { props } = renderSheet();
    const dialog = screen.getByRole("dialog");

    fireEvent.touchStart(dialog, { touches: [{ clientY: 300 }] });
    fireEvent.touchEnd(dialog, { changedTouches: [{ clientY: 320 }] });

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("devuelve el foco a donde estaba al cerrarse", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderSheet();
    await waitFor(() => expect(document.activeElement).not.toBe(opener));
    unmount();

    // Otherwise the next Tab starts from the top of the page and the athlete loses
    // their place in whatever they were doing.
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

// ------------------------------------------------------------ focus trap

describe("CronosBottomSheet · trampa de foco", () => {
  it("Tab desde el último control vuelve al primero", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog");
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    )];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(first);
  });

  it("Shift+Tab desde el primer control vuelve al último", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog");
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    )];
    const first = focusable[0];
    first.focus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });

  it("no deja que el foco salga del diálogo en mitad de la lista", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog");
    const middle = dialog.querySelectorAll<HTMLElement>("button:not([disabled])")[1];
    middle.focus();

    // The browser's own default would move focus out; the trap only intervenes at the
    // edges, so a Tab in the middle is left alone.
    fireEvent.keyDown(document, { key: "Tab" });

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("mueve el foco al panel al abrir, para que no quede en la página de detrás", () => {
    renderSheet();

    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});

// ------------------------------------------------------------------ tabs

describe("CronosBottomSheet · pestañas", () => {
  it("monta la conversación en la pestaña de chat", () => {
    renderSheet();

    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(wizardMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("coach-chat")).toBeTruthy();
  });

  it("monta el generador al cambiar de pestaña y desmonta la conversación", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("tab", { name: T.tabGenerate }));

    // Genuinely different screens with their own state: a half-finished wizard must not
    // reappear inside a conversation a week later.
    expect(wizardMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("coach-chat")).toBeNull();
  });

  it("marca la pestaña activa para la tecnología asistiva", () => {
    renderSheet();

    expect(screen.getByRole("tab", { name: T.tabChat }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: T.tabGenerate }));
    expect(screen.getByRole("tab", { name: T.tabGenerate }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("abre en la pestaña que le pidieron", () => {
    renderSheet({ initialTab: "generate" });

    expect(wizardMock).toHaveBeenCalledTimes(1);
  });

  it("vuelve a la pestaña inicial en cada apertura, no en la de la visita anterior", () => {
    const { unmount } = renderSheet();
    fireEvent.click(screen.getByRole("tab", { name: T.tabGenerate }));
    unmount();

    renderSheet();

    expect(screen.getByRole("tab", { name: T.tabChat }).getAttribute("aria-selected")).toBe("true");
  });
});

// --------------------------------------------------------------- chrome

describe("CronosBottomSheet · marco", () => {
  it("muestra el nombre del asistente, el aviso y las dos pestañas", () => {
    renderSheet();

    expect(screen.getByText(T.sheetTitle)).toBeTruthy();
    expect(screen.getByText(T.disclaimer)).toBeTruthy();
    expect(screen.getByRole("tab", { name: T.tabChat })).toBeTruthy();
    expect(screen.getByRole("tab", { name: T.tabGenerate })).toBeTruthy();
  });

  it("el aviso nombra los dos límites reales del asistente", () => {
    renderSheet();

    // "Es una IA" alone is the version nobody reads. What the athlete needs is what it
    // cannot do: it cannot see the bar, and it is not a clinician.
    expect(T.disclaimer).toContain("No ve tu técnica");
    expect(T.disclaimer).toContain("médico");
  });

  it("pasa la rutina en curso a la conversación como una línea de contexto", () => {
    renderSheet({ initialContext: "Push A" });

    expect(screen.getByText("Push A")).toBeTruthy();
    // Shown, not injected into the chat's context: that context is built from the training
    // record, and free text arriving there would be an instruction dressed as data.
    expect((chatMock.mock.calls[0][0] as Record<string, unknown>).initialContext).toBeUndefined();
  });
});