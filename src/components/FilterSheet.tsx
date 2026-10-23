/**
 * FilterSheet.tsx — a bottom sheet with dropdown selectors for the attribute
 * filters (body part, equipment, target).
 *
 * Replaces the three inline `<select>` elements from ExerciseBrowser with
 * native-styled dropdowns that include the "all" option correctly labeled
 * (fixing the translateOption / translateBodyPart mismatch bug).
 */

import { X } from "lucide-react";
import type { PickerFilters } from "@/lib/picker/pickerHelpers";
import {
  translateBodyPart,
  translateTarget,
  translateEquipment,
} from "@/lib/i18n";

export interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PickerFilters;
  onChange: (filters: PickerFilters) => void;
  bodyPartOptions: string[];
  equipmentOptions: string[];
  targetOptions: string[];
}

function FilterSelect({
  label,
  value,
  options,
  translate,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  translate: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-200"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "all" ? "Todos" : translate(opt)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterSheet({
  isOpen,
  onClose,
  filters,
  onChange,
  bodyPartOptions,
  equipmentOptions,
  targetOptions,
}: FilterSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end bg-black/72 transition-opacity duration-normal ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-4 rounded-t-[24px] border border-white/10 bg-neutral-950 p-5 shadow-xl"
        style={{ maxHeight: "70vh" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-100">Filtrar ejercicios</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          <FilterSelect
            label="Parte del cuerpo"
            value={filters.bodyPart}
            options={bodyPartOptions}
            translate={translateBodyPart}
            onChange={(v) => onChange({ ...filters, bodyPart: v })}
          />
          <FilterSelect
            label="Equipamiento"
            value={filters.equipment}
            options={equipmentOptions}
            translate={translateEquipment}
            onChange={(v) => onChange({ ...filters, equipment: v })}
          />
          <FilterSelect
            label="Objetivo"
            value={filters.target}
            options={targetOptions}
            translate={translateTarget}
            onChange={(v) => onChange({ ...filters, target: v })}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-neutral-950 hover:brightness-110"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}