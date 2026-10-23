/**
 * FilterChips.tsx — removable chips for active filters in the ExercisePicker.
 *
 * Shows the current value of each non-"all" filter as a chip with an X button
 * to clear it. "Limpiar todo" clears all at once.
 */

import { X } from "lucide-react";
import type { PickerFilters } from "@/lib/picker/pickerHelpers";
import type { Slug } from "react-muscle-highlighter";
import { muscleDefinition } from "@/lib/muscleMap";

export interface FilterChipsProps {
  filters: PickerFilters;
  selectedMuscle: Slug | null;
  onClearBodyPart: () => void;
  onClearEquipment: () => void;
  onClearTarget: () => void;
  onClearMuscle: () => void;
  onClearAll: () => void;
}

interface ChipSpec {
  label: string;
  onClear: () => void;
}

export function FilterChips({
  filters,
  selectedMuscle,
  onClearBodyPart,
  onClearEquipment,
  onClearTarget,
  onClearMuscle,
  onClearAll,
}: FilterChipsProps) {
  const chips: ChipSpec[] = [];

  if (filters.bodyPart !== "all") {
    chips.push({ label: filters.bodyPart, onClear: onClearBodyPart });
  }
  if (filters.equipment !== "all") {
    chips.push({ label: filters.equipment, onClear: onClearEquipment });
  }
  if (filters.target !== "all") {
    chips.push({ label: filters.target, onClear: onClearTarget });
  }
  if (selectedMuscle) {
    const def = muscleDefinition(selectedMuscle);
    chips.push({
      label: def?.label ?? selectedMuscle,
      onClear: onClearMuscle,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onClear}
            aria-label={`Quitar filtro ${chip.label}`}
            className="rounded-full p-0.5 text-neutral-500 hover:text-neutral-300"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}
