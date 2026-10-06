/**
 * SelectionBar.tsx — the floating action bar that appears when exercises are
 * selected in the ExercisePicker.
 *
 * Anchors to the bottom of the viewport, shows the count of selected items,
 * and provides "Add" and "Clear" actions. The "Add" button is disabled when
 * no selected exercise can be added (all are already added and duplicates
 * are not allowed).
 */

import { Plus, Trash2 } from "lucide-react";

export interface SelectionBarProps {
  selectedCount: number;
  canAddMore: boolean;
  onAdd: () => void;
  onClear: () => void;
}

export function SelectionBar({
  selectedCount,
  canAddMore,
  onAdd,
  onClear,
}: SelectionBarProps) {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-2xl border border-white/10 bg-neutral-900/80 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur"
      style={{ width: "calc(100% - 32px)", maxWidth: "480px" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-neutral-950 text-[10px] font-bold">
            {selectedCount}
          </span>
          <span className="text-sm font-medium text-neutral-200">
            {selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpiar selección"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:border-white/20 hover:text-neutral-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAddMore}
            aria-label="Añadir al entrenamiento"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              canAddMore
                ? "bg-accent text-neutral-950 hover:brightness-110"
                : "bg-neutral-700 text-neutral-500"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir
          </button>
        </div>
      </div>
    </div>
  );
}
