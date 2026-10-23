/**
 * ActionMenu.test.tsx — tests for the routine action menu (duplicate + share).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ActionMenu } from "./RoutinesPage";

const anchorRect = {
  top: 100,
  bottom: 120,
  left: 200,
  right: 220,
  width: 20,
  height: 20,
  x: 200,
  y: 100,
  toJSON: () => ({}),
} as DOMRect;

afterEach(() => cleanup());

describe("ActionMenu", () => {
  it("renders Duplicate and Share menu items", () => {
    render(
      <ActionMenu
        anchorRect={anchorRect}
        onDuplicate={vi.fn()}
        onShare={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("menuitem", { name: "Duplicar" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Compartir" })).toBeTruthy();
  });

  it("calls onDuplicate and onClose when Duplicate is clicked", () => {
    const onDuplicate = vi.fn();
    const onClose = vi.fn();
    render(
      <ActionMenu
        anchorRect={anchorRect}
        onDuplicate={onDuplicate}
        onShare={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicar" }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onShare and onClose when Share is clicked", () => {
    const onShare = vi.fn();
    const onClose = vi.fn();
    render(
      <ActionMenu
        anchorRect={anchorRect}
        onDuplicate={vi.fn()}
        onShare={onShare}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Compartir" }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(
      <ActionMenu
        anchorRect={anchorRect}
        onDuplicate={vi.fn()}
        onShare={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on overlay click", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ActionMenu
        anchorRect={anchorRect}
        onDuplicate={vi.fn()}
        onShare={vi.fn()}
        onClose={onClose}
      />,
    );

    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
