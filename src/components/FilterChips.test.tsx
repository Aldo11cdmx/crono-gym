/**
 * @vitest-environment jsdom
 *
 * FilterChips.test.tsx — tests that filter chips appear for active filters
 * and that clear buttons work.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FilterChips } from "./FilterChips";
import { EMPTY_FILTERS } from "@/lib/picker/pickerHelpers";
import type { PickerFilters } from "@/lib/picker/pickerHelpers";

afterEach(cleanup);

describe("FilterChips", () => {
  const baseProps = {
    onClearBodyPart: vi.fn(),
    onClearEquipment: vi.fn(),
    onClearTarget: vi.fn(),
    onClearMyGym: vi.fn(),
    onClearMuscle: vi.fn(),
    onClearAll: vi.fn(),
  };

  it("renders no chips when all filters are 'all'", () => {
    const { container } = render(
      <FilterChips filters={EMPTY_FILTERS} selectedMuscle={null} {...baseProps} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a chip for body_part filter", () => {
    const filters: PickerFilters = { ...EMPTY_FILTERS, bodyPart: "chest" };
    render(<FilterChips filters={filters} selectedMuscle={null} {...baseProps} />);
    expect(screen.getByText("chest")).toBeTruthy();
  });

  it("renders a chip for Mi Gym filter", () => {
    const filters: PickerFilters = { ...EMPTY_FILTERS, onlyMyGym: true };
    render(<FilterChips filters={filters} selectedMuscle={null} {...baseProps} />);
    expect(screen.getByText("Solo mi gym")).toBeTruthy();
  });

  it("renders 'Limpiar todo' only when more than one chip is active", () => {
    const filters: PickerFilters = {
      ...EMPTY_FILTERS,
      bodyPart: "chest",
      equipment: "barbell",
    };
    render(<FilterChips filters={filters} selectedMuscle={null} {...baseProps} />);
    expect(screen.getByText("Limpiar todo")).toBeTruthy();
  });

  it("does not render 'Limpiar todo' when only one chip is active", () => {
    const filters: PickerFilters = { ...EMPTY_FILTERS, bodyPart: "chest" };
    render(<FilterChips filters={filters} selectedMuscle={null} {...baseProps} />);
    expect(screen.queryByText("Limpiar todo")).not.toBeTruthy();
  });

  it("calls onClearBodyPart when the body_part chip's X is clicked", () => {
    const filters: PickerFilters = { ...EMPTY_FILTERS, bodyPart: "chest" };
    render(<FilterChips filters={filters} selectedMuscle={null} {...baseProps} />);
    const clearButtons = screen.getAllByRole("button");
    fireEvent.click(clearButtons[0]);
    expect(baseProps.onClearBodyPart).toHaveBeenCalled();
  });

  it("calls onClearAll when 'Limpiar todo' is clicked", () => {
    const filters: PickerFilters = {
      ...EMPTY_FILTERS,
      bodyPart: "chest",
      equipment: "barbell",
    };
    render(<FilterChips filters={filters} selectedMuscle={null} {...baseProps} />);
    fireEvent.click(screen.getByText("Limpiar todo"));
    expect(baseProps.onClearAll).toHaveBeenCalled();
  });
});