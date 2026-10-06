/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QuickActionButton, type QuickActionItem } from "./QuickActionButton";

const ACTIONS: QuickActionItem[] = [
  { id: "routine", label: "Nueva rutina", icon: "➕", onChoose: vi.fn() },
  { id: "set", label: "Nuevo set", icon: "🏋", onChoose: vi.fn() },
];

afterEach(() => cleanup());

describe("QuickActionButton", () => {
  it("renders a button", () => {
    render(<QuickActionButton actions={ACTIONS} />);

    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("shows loading skeleton when loading", () => {
    render(<QuickActionButton actions={ACTIONS} loading />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  describe("dropdown", () => {
    it("opens on click and shows actions", () => {
      render(<QuickActionButton actions={ACTIONS} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByText("Nueva rutina")).toBeTruthy();
      expect(screen.getByText("Nuevo set")).toBeTruthy();
    });

    it("closes on second click", () => {
      render(<QuickActionButton actions={ACTIONS} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(screen.getByText("Nueva rutina")).toBeTruthy();

      fireEvent.click(button);
      expect(screen.queryByText("Nueva rutina")).toBeNull();
    });

    it("closes on Escape", () => {
      render(<QuickActionButton actions={ACTIONS} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);
       expect(screen.queryByText("Nueva rutina")).toBeTruthy();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByText("Nueva rutina")).toBeNull();
    });

    it("closes on click outside", () => {
      render(
        <div>
          <QuickActionButton actions={ACTIONS} />
          <span data-testid="outside">Outside</span>
        </div>,
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(screen.queryByText("Nueva rutina")).toBeTruthy();

      fireEvent.mouseDown(screen.getByTestId("outside"));
      expect(screen.queryByText("Nueva rutina")).toBeNull();
    });

    it("calls onChoose when an action is clicked", () => {
      render(<QuickActionButton actions={ACTIONS} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const actionButton = screen.getByText("Nuevo set");
      fireEvent.click(actionButton);

      expect(ACTIONS[1].onChoose).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Nuevo set")).toBeNull(); // dropdown closes
    });

    it("does not open dropdown when only one action", () => {
      const singleAction: QuickActionItem[] = [
        { id: "start", label: "Empezar", icon: "▶", onChoose: vi.fn() },
      ];
      render(<QuickActionButton actions={singleAction} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // With one action, clicking the button calls onChoose directly, no dropdown.
      expect(singleAction[0].onChoose).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Empezar")).toBeNull(); // no dropdown rendered
    });

    it("disables button when no actions", () => {
      render(<QuickActionButton actions={[]} />);

      expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    });
  });
});
