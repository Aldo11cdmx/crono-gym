/**
 * @vitest-environment jsdom
 *
 * SelectionBar.test.tsx — tests the floating selection bar's count display
 * and button states.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SelectionBar } from "./SelectionBar";

afterEach(cleanup);

describe("SelectionBar", () => {
  it("shows the correct singular count", () => {
    render(
      <SelectionBar
        selectedCount={1}
        canAddMore={true}
        onAdd={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("1 seleccionado")).toBeTruthy();
  });

  it("shows the correct plural count", () => {
    render(
      <SelectionBar
        selectedCount={5}
        canAddMore={true}
        onAdd={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("5 seleccionados")).toBeTruthy();
  });

  it("calls onAdd when Add button is clicked and enabled", () => {
    const onAdd = vi.fn();
    render(
      <SelectionBar
        selectedCount={2}
        canAddMore={true}
        onAdd={onAdd}
        onClear={vi.fn()}
      />,
    );
    const addButton = screen.getByRole("button", { name: /Añadir al entrenamiento/i });
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalled();
  });

  it("disables Add button when canAddMore is false", () => {
    render(
      <SelectionBar
        selectedCount={2}
        canAddMore={false}
        onAdd={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const addButton = screen.getByRole("button", { name: /Añadir al entrenamiento/i });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onClear when Clear button is clicked", () => {
    const onClear = vi.fn();
    render(
      <SelectionBar
        selectedCount={2}
        canAddMore={true}
        onAdd={vi.fn()}
        onClear={onClear}
      />,
    );
    const clearButton = screen.getByRole("button", { name: /Limpiar selección/i });
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalled();
  });
});
