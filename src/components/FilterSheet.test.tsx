/**
 * @vitest-environment jsdom
 *
 * FilterSheet.test.tsx — tests the filter sheet's dropdown options, checkbox,
 * and apply button.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FilterSheet } from "./FilterSheet";
import { EMPTY_FILTERS } from "@/lib/picker/pickerHelpers";

afterEach(cleanup);

const ALL_BODY_PARTS = ["all", "chest", "back", "shoulders"];
const ALL_EQUIPMENT = ["all", "barbell", "dumbbell", "body weight"];
const ALL_TARGETS = ["all", "pectorals", "delts", "triceps"];

function renderSheet(overrides: Record<string, unknown> = {}) {
  return render(
    <FilterSheet
      isOpen={true}
      onClose={vi.fn()}
      filters={EMPTY_FILTERS}
      onChange={vi.fn()}
      bodyPartOptions={ALL_BODY_PARTS}
      equipmentOptions={ALL_EQUIPMENT}
      targetOptions={ALL_TARGETS}
      {...overrides}
    />,
  );
}

describe("FilterSheet", () => {
  it("renders null when isOpen is false", () => {
    const { container } = renderSheet({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it("renders all three filter dropdowns", () => {
    renderSheet();
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(3);
    expect(screen.getByText("Parte del cuerpo")).toBeTruthy();
    expect(screen.getByText("Equipamiento")).toBeTruthy();
    expect(screen.getByText("Objetivo")).toBeTruthy();
  });

  it("includes 'Todos' as the first option in every dropdown", () => {
    renderSheet();
    const selects = screen.getAllByRole("combobox");
    selects.forEach((select) => {
      const firstOption = select.querySelector("option:first-child");
      expect(firstOption?.textContent).toBe("Todos");
    });
  });

  it("calls onClose when Aplicar button is clicked", () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    const applyButton = screen.getByRole("button", { name: /Aplicar/i });
    fireEvent.click(applyButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    const xButtons = screen.getAllByRole("button");
    // First button is the X close, second is Apply
    fireEvent.click(xButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});