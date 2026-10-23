/**
 * ExercisePicker.tsx — the exercise catalog browser with multi-select.
 *
 * Presentational: all data and callbacks arrive as props so the component is
 * agnostic of where exercises come from. The caller wires `useExerciseCatalog`
 * or any other data source; this component only decides how they are shown.
 *
 * Filter state is owned by this component (query, body_part, equipment, target,
 * muscle slugs). The muscle-map filter reuses `filterByMuscles` from
 * `muscleFilter.ts` because that function needs the `MatchLevel` type from
 * `react-muscle-highlighter`.
 */

import { useMemo, useState } from "react";
import { Search, X, Grid3X3, List } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import type { Slug } from "react-muscle-highlighter";

import {
  searchExercises,
  filterExercises,
  sortExercises,
  collectBodyParts,
  collectEquipment,
  collectTargets,
  EMPTY_FILTERS,
  type PickerFilters,
  type SortKey,
} from "@/lib/picker/pickerHelpers";
import { filterByMuscles } from "@/lib/muscleFilter";

import { ExerciseCard } from "./ExerciseCard";
import { FilterChips } from "./FilterChips";
import { SelectionBar } from "./SelectionBar";
import { ExerciseDetailSheet } from "./ExerciseDetailSheet";
import { FilterSheet } from "./FilterSheet";

export interface ExercisePickerProps {
  exercises: Exercise[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onAdd?: (exercises: Exercise[]) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  alreadyAddedIds?: Set<string>;
  allowDuplicates?: boolean;
  lastPerformance?: Record<string, { oneRepMax: number; date: string }>;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function ExercisePicker({
  exercises,
  selectedIds,
  onSelectionChange,
  onAdd,
  favorites = new Set(),
  onToggleFavorite,
  alreadyAddedIds = new Set(),
  allowDuplicates = false,
  lastPerformance,
  isLoading,
  error,
  onRetry,
  className,
}: ExercisePickerProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PickerFilters>(EMPTY_FILTERS);
  const [sortBy] = useState<SortKey>("name");
  const [searchFocused, setSearchFocused] = useState(false);
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<Slug | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);

  const bodyParts = useMemo(() => collectBodyParts(exercises), [exercises]);
  const equipmentOptions = useMemo(() => collectEquipment(exercises), [exercises]);
  const targetOptions = useMemo(() => collectTargets(exercises), [exercises]);

  const muscleSlugs: Slug[] = selectedMuscle ? [selectedMuscle] : [];

  const filtered = useMemo(() => {
    const searched = searchExercises(exercises, query);
    const attrFiltered = filterExercises(searched, filters);
    const muscleFiltered = selectedMuscle
      ? filterByMuscles(attrFiltered, muscleSlugs).results
      : attrFiltered;
    return sortExercises(muscleFiltered, sortBy);
  }, [exercises, query, filters, sortBy, muscleSlugs]);

  const isChecked = (id: string) => selectedIds.includes(id);
  const isAlreadyAdded = (id: string) => alreadyAddedIds.has(id) && !allowDuplicates;

  const handleToggle = (id: string) => {
    const next = isChecked(id)
      ? selectedIds.filter((s) => s !== id)
      : [...selectedIds, id];
    onSelectionChange(next);
  };

  const handleClearAll = () => onSelectionChange([]);

  const activeFilterCount =
    (filters.bodyPart !== "all" ? 1 : 0) +
    (filters.equipment !== "all" ? 1 : 0) +
    (filters.target !== "all" ? 1 : 0) +
    (selectedMuscle ? 1 : 0);

  return (
    <div className={className ?? ""}>
      {/* Header: search + view toggle */}
      <div className="flex items-center gap-2.5 border-b border-white/10 bg-neutral-950/40 px-5 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar ejercicio (p. ej. press de banca, fondos)…"
            className={`w-full rounded-lg border bg-neutral-950/60 py-2 pl-9 pr-3 text-sm text-neutral-100 ${
              searchFocused ? "border-accent" : "border-white/10"
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:text-neutral-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFilterSheetOpen(true)}
          aria-label="Filtrar ejercicios"
          className={`relative flex h-11 w-11 items-center justify-center rounded-lg border transition-colors ${
            activeFilterCount > 0
              ? "border-accent bg-accent/10 text-accent"
              : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-300"
          }`}
        >
          {activeFilterCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-neutral-950">
              {activeFilterCount}
            </span>
          )}
          <Grid3X3 className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => setView(view === "grid" ? "list" : "grid")}
          aria-label={view === "grid" ? "Cambiar a lista" : "Cambiar a cuadrícula"}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-300"
        >
          {view === "grid" ? <Grid3X3 className="h-5 w-5" /> : <List className="h-5 w-5" />}
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="px-5 pt-2.5">
          <FilterChips
            filters={filters}
            selectedMuscle={selectedMuscle}
            onClearBodyPart={() => setFilters({ ...filters, bodyPart: "all" })}
            onClearEquipment={() => setFilters({ ...filters, equipment: "all" })}
            onClearTarget={() => setFilters({ ...filters, target: "all" })}
            onClearMuscle={() => setSelectedMuscle(null)}
            onClearAll={() => {
              setFilters(EMPTY_FILTERS);
              setSelectedMuscle(null);
              setQuery("");
            }}
          />
        </div>
      )}

      {/* Results count */}
      <div className="px-5 pt-2 text-xs text-neutral-500">
        {filtered.length} de {exercises.length} ejercicios
      </div>

      {/* Grid / List */}
      <div
        className={`px-5 pb-4 ${
          view === "grid"
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
            : "space-y-2"
        }`}
      >
        {filtered.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            selected={isChecked(ex.id)}
            alreadyAdded={isAlreadyAdded(ex.id)}
            favorite={favorites.has(ex.id)}
            oneRepMax={lastPerformance?.[ex.id]?.oneRepMax}
            onToggleSelect={handleToggle}
            onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(ex.id) : undefined}
            onOpenDetail={() => setDetailExercise(ex)}
            view={view}
          />
        ))}
      </div>

      {/* Floating selection bar */}
      {selectedIds.length > 0 && onAdd && (
        <SelectionBar
          selectedCount={selectedIds.length}
          canAddMore={selectedIds.some((id) => !isAlreadyAdded(id))}
          onAdd={() => {
            const toAdd = exercises.filter((e) => selectedIds.includes(e.id));
            onAdd(toAdd);
          }}
          onClear={handleClearAll}
        />
      )}

      {/* Empty state */}
      {filtered.length === 0 && !isLoading && !error && (
        <div className="py-12 text-center">
          <Search className="mx-auto mb-3 h-12 w-12 text-neutral-700" />
          <p className="text-neutral-400">Ningún ejercicio coincide con esos filtros.</p>
        </div>
      )}

      {/* Error state */}
      {error && onRetry && (
        <div className="p-5 text-center text-red-400">
          <p className="mb-3">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-neutral-950 hover:brightness-110"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && filtered.length === 0 && (
        <div className="py-12 text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-accent" />
          <p className="text-neutral-400">Cargando ejercicios…</p>
        </div>
      )}

      {/* Sheets */}
      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        bodyPartOptions={bodyParts}
        equipmentOptions={equipmentOptions}
        targetOptions={targetOptions}
      />

      <ExerciseDetailSheet
        exercise={detailExercise}
        isOpen={detailExercise !== null}
        onClose={() => setDetailExercise(null)}
      />
    </div>
  );
}
