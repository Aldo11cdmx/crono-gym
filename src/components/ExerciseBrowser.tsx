/**
 * ExerciseBrowser.tsx — the exercise catalog browser with multi-select.
 *
 * Uses a Floating Action Dock (`SelectionBar`) that appears at the bottom of
 * the viewport when one or more exercises are selected. The dock's "Add" button
 * fires `onAdd` with the array of selected `Exercise` objects.
 *
 * Filter state is owned by this component (query, body_part, equipment, target,
 * muscle slugs). The muscle-map filter reuses `filterByMuscles` from
 * `muscleFilter.ts` because that function needs the `MatchLevel` type from
 * `react-muscle-highlighter`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Slug } from "react-muscle-highlighter";
import { useSearchParams } from "react-router-dom";
import type { Exercise } from "../types/supabase";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import { toExercises } from "@/lib/catalog/exerciseAdapter";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import {
  Search,
  Dumbbell,
  X,
  AlertCircle,
  PersonStanding,
  Filter,
  Check,
} from "lucide-react";
import { MuscleSelector } from "./MuscleSelector";
import { ExerciseDetailSheet } from "./ExerciseDetailSheet";
import { FilterSheet } from "./FilterSheet";
import { SelectionBar } from "./SelectionBar";
import { enabledSlugs, muscleDefinition } from "../lib/muscleMap";
import {
  applyBaseFilters,
  explainEmpty,
  filterByMuscles,
  MUSCLE_PARAM,
  muscleCounts,
  parseMuscleParam,
  serializeMuscleParam,
  toggleMuscle,
  type BaseFilters,
} from "../lib/muscleFilter";
import {
  BODY_PART_FILTER_VALUES,
  MUSCLE_FILTER_LABELS as T,
  sortBySpanishLabel,
  translateBodyPart,
  translateEquipment,
  translateTarget,
} from "../lib/i18n";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import type { PickerFilters } from "@/lib/picker/pickerHelpers";
import {
  ACCENT,
  GLASS,
  RADIUS,
  SCRIM,
  SOLID,
  STATUS,
  SURFACE_ROLE,
  TEXT,
} from "@/design/tokens";

const BODY_PARTS = BODY_PART_FILTER_VALUES;

export function ExerciseBrowser({
  onAdd,
  isAdded,
  onClose,
}: {
  onAdd?: (exercises: Exercise[]) => void;
  isAdded?: (exerciseId: string) => boolean;
  onClose: () => void;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [searchParams, setSearchParams] = useSearchParams();

  const [muscles, setMuscles] = useState<Slug[]>(() =>
    parseMuscleParam(searchParams.get(MUSCLE_PARAM)),
  );
  const [showAnatomy, setShowAnatomy] = useState(() => muscles.length > 0);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      /*
       * The catalog comes from the device.
       *
       * It used to be `select *` from the `exercises` table, with a 16 MB
       * fetch of the whole dataset as the fallback. Both downloaded the same
       * 1,324 exercises the app already ships with, on every visit to the
       * library. Now the catalog is read from the device copy, which is
       * downloaded once and kept.
       */
      try {
        const rows = toExercises(await loadCatalog());
        if (!alive) return;
        setExercises(rows);
      } catch (err) {
        if (!alive) return;
        setExercises([]);
        setError(
          `No se pudo cargar el catálogo: ${
            err instanceof Error ? err.message : "error desconocido"
          }`,
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const equipmentOptions = useMemo(() => {
    const s = new Set<string>();
    exercises.forEach((e) => s.add(e.equipment));
    return sortBySpanishLabel([...s], translateEquipment);
  }, [exercises]);
  const targetOptions = useMemo(() => {
    const s = new Set<string>();
    exercises.forEach((e) => s.add(e.target));
    return sortBySpanishLabel([...s], translateTarget);
  }, [exercises]);

  const filters: BaseFilters = useMemo(
    () => ({ query, bodyPart, equipment, target }),
    [query, bodyPart, equipment, target],
  );

  const baseFiltered = useMemo(
    () => applyBaseFilters(exercises, filters),
    [exercises, filters],
  );

  const { results: filtered, levelById } = useMemo(
    () => filterByMuscles(baseFiltered, muscles),
    [baseFiltered, muscles],
  );

  const counts = useMemo(
    () => muscleCounts(baseFiltered, enabledSlugs()),
    [baseFiltered],
  );

  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        const serialized = serializeMuscleParam(muscles);
        if (serialized) next.set(MUSCLE_PARAM, serialized);
        else next.delete(MUSCLE_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [muscles, setSearchParams]);

  const emptyCause = useMemo(
    () =>
      filtered.length === 0 && !loading
        ? explainEmpty(baseFiltered, exercises, muscles, filters, T)
        : null,
    [
      filtered.length,
      loading,
      baseFiltered,
      exercises,
      muscles,
      filters,
    ],
  );

  const onSelectMuscle = useCallback((next: Slug[]) => setMuscles(next), []);

  const activeMuscles = useMemo(
    () =>
      muscles
        .map((slug) => muscleDefinition(slug))
        .filter((d): d is NonNullable<typeof d> => Boolean(d)),
    [muscles],
  );

  const pickerFilters: PickerFilters = useMemo(
    () => ({
      muscles: [],
      bodyPart,
      equipment,
      target,
    }),
    [bodyPart, equipment, target],
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    if (!onAdd) return;
    const toAdd = exercises.filter((e) => selectedIds.has(e.id));
    onAdd(toAdd);
    setSelectedIds(new Set());
  }, [exercises, selectedIds, onAdd]);

  const handleClear = useCallback(() => setSelectedIds(new Set()), []);

  const canAddMore = useMemo(
    () =>
      onAdd !== undefined &&
      [...selectedIds].some((id) => !(isAdded?.(id) ?? false)),
    [selectedIds, onAdd, isAdded],
  );

  function clearFilters() {
    setQuery("");
    setBodyPart("all");
    setEquipment("all");
    setTarget("all");
    setMuscles([]);
  }

  const sheetRadius = RADIUS.card;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: SCRIM.modal }}
    >
      <div
        className="relative flex w-full max-w-6xl flex-col overflow-hidden backdrop-blur-md"
        style={{
          backgroundColor: SURFACE_ROLE.popover,
          border: `1px solid ${GLASS.border}`,
          boxShadow: GLASS.shadow,
          borderRadius: sheetRadius,
          maxHeight: "92vh",
        }}
      >
        {/* ---- Header ---- */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: `1px solid ${GLASS.border}`,
            backgroundColor: GLASS.fillRaised,
          }}
        >
          <div>
            <h2
              style={{ color: TEXT.primary }}
              className="text-lg font-semibold"
            >
              Biblioteca de Ejercicios
            </h2>
            <p style={{ color: TEXT.secondary }} className="text-xs">
              {loading
                ? "Busca y filtra para agregar a tu entrenamiento."
                : T.resultsMany(filtered.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-xl p-1.5 text-neutral-400 opacity-60 transition hover:opacity-100"
            style={{ color: TEXT.tertiary }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ---- Search + body-part chips ---- */}
        <div
          className="px-5 py-3"
          style={{
            borderBottom: `1px solid ${GLASS.border}`,
            backgroundColor: GLASS.fill,
          }}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: TEXT.tertiary }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, objetivo o equipo..."
              className="w-full rounded-xl border-0 py-2 pl-9 pr-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
              style={{
                backgroundColor: SURFACE_ROLE.well,
                borderColor: GLASS.border,
                color: TEXT.primary,
              }}
            />
          </div>

          {/* Body-part chip strip */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {BODY_PARTS.map((part) => {
              const isActive = bodyPart === part;
              return (
                <button
                  key={part}
                  type="button"
                  onClick={() => setBodyPart(part)}
                  aria-pressed={isActive}
                  className="rounded-full border px-3 py-1 text-xs font-medium opacity-70 transition hover:opacity-100"
                  style={{
                    backgroundColor: isActive ? ACCENT.muted : "transparent",
                    borderColor: isActive ? ACCENT.base : GLASS.border,
                    color: isActive ? TEXT.primary : TEXT.tertiary,
                    borderWidth: "1px",
                    borderStyle: "solid",
                  }}
                >
                  {part === "all" ? "Todos" : translateBodyPart(part)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Secondary filter row ---- */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3"
          style={{
            borderBottom: `1px solid ${GLASS.border}`,
            backgroundColor: GLASS.fillRaised,
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium opacity-70 transition hover:opacity-100"
              style={{
                backgroundColor: "transparent",
                borderColor: GLASS.border,
                color: TEXT.secondary,
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              Equipamiento y objetivo
            </button>

            <button
              type="button"
              onClick={() => setShowAnatomy((v) => !v)}
              aria-pressed={showAnatomy}
              aria-controls="anatomy-panel"
              className="flex min-h-[32px] items-center gap-1.5 rounded-xl border px-3 py-1 text-xs opacity-70 transition hover:opacity-100"
              style={{
                backgroundColor:
                  showAnatomy || muscles.length > 0
                    ? ACCENT.muted
                    : "transparent",
                borderColor:
                  showAnatomy || muscles.length > 0
                    ? ACCENT.base
                    : GLASS.border,
                color:
                  showAnatomy || muscles.length > 0
                    ? TEXT.primary
                    : TEXT.tertiary,
              }}
            >
              <PersonStanding className="h-3.5 w-3.5" />
              {muscles.length > 0
                ? T.openWithSelection(muscles.length)
                : "Cuerpo"}
            </button>
          </div>

          <span
            className="text-xs"
            style={{
              color: TEXT.tertiary,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {filtered.length} de {exercises.length} ejercicios
          </span>
        </div>

        {/* ---- Active filter chips ---- */}
        {(activeMuscles.length > 0 ||
          equipment !== "all" ||
          query.trim() !== "" ||
          bodyPart !== "all" ||
          target !== "all") && (
          <ActiveFilterChips
            muscles={activeMuscles.map((d) => d.slug)}
            onRemoveMuscle={(slug) =>
              setMuscles((prev) => toggleMuscle(prev, slug))
            }
            equipment={equipment}
            onClearEquipment={() => setEquipment("all")}
            query={query}
            onClearQuery={() => setQuery("")}
            bodyPart={bodyPart}
            onClearBodyPart={() => setBodyPart("all")}
            target={target}
            onClearTarget={() => setTarget("all")}
            onClearAll={clearFilters}
          />
        )}

        {/* ---- Content area ---- */}
        <div className="flex min-h-0 flex-1">
          {showAnatomy && (
            <div
              id="anatomy-panel"
              className="w-full shrink-0 overflow-y-auto p-4 sm:w-80"
              style={{
                borderTop: `1px solid ${GLASS.border}`,
                backgroundColor: GLASS.fill,
              }}
            >
              <MuscleSelector
                selected={muscles}
                onChange={onSelectMuscle}
                counts={counts}
              />
            </div>
          )}
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            {error && (
              <div
                className="mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: STATUS.error.border,
                  backgroundColor: STATUS.error.muted,
                  color: STATUS.error.text,
                }}
              >
                <span className="mt-0.5 shrink-0">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <span>{error}</span>
              </div>
            )}
            {loading ? (
              <div
                className="py-12 text-center"
                style={{ color: TEXT.tertiary }}
              >
                Cargando catálogo...
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="py-12 text-center"
                style={{ color: TEXT.tertiary }}
              >
                {emptyCause ? (
                  <>
                    <p>{emptyCause.message}</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 text-xs underline-offset-2 hover:underline"
                      style={{ color: ACCENT.text }}
                    >
                      {emptyCause.action}
                    </button>
                  </>
                ) : (
                  "Sin resultados para esta búsqueda."
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((ex) => (
                  <BrowserExerciseCard
                    key={ex.id}
                    exercise={ex}
                    level={levelById.get(ex.id)}
                    selected={selectedIds.has(ex.id)}
                    onToggleSelect={toggleSelection}
                    alreadyAdded={isAdded?.(ex.id) ?? false}
                    onOpenDetail={() => setDetailExercise(ex)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={pickerFilters}
        onChange={(next) => {
          setBodyPart(next.bodyPart);
          setEquipment(next.equipment);
          setTarget(next.target);
          setFilterSheetOpen(false);
        }}
        bodyPartOptions={BODY_PARTS}
        equipmentOptions={["all", ...equipmentOptions]}
        targetOptions={["all", ...targetOptions]}
      />

      <ExerciseDetailSheet
        exercise={detailExercise}
        isOpen={detailExercise !== null}
        onClose={() => setDetailExercise(null)}
      />

      {selectedIds.size > 0 && onAdd && (
        <SelectionBar
          selectedCount={selectedIds.size}
          canAddMore={canAddMore}
          onAdd={handleAdd}
          onClear={handleClear}
        />
      )}
    </div>
  );
}

function ActiveFilterChips({
  muscles,
  onRemoveMuscle,
  equipment,
  onClearEquipment,
  query,
  onClearQuery,
  bodyPart,
  onClearBodyPart,
  target,
  onClearTarget,
  onClearAll,
}: {
  muscles: Slug[];
  onRemoveMuscle: (slug: Slug) => void;
  equipment: string;
  onClearEquipment: () => void;
  query: string;
  onClearQuery: () => void;
  bodyPart: string;
  onClearBodyPart: () => void;
  target: string;
  onClearTarget: () => void;
  onClearAll: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 px-5 py-2.5"
      style={{
        borderTop: `1px solid ${GLASS.border}`,
        backgroundColor: GLASS.fill,
      }}
    >
      <span style={{ color: TEXT.tertiary, fontSize: "11px" }}>
        Filtros activos:
      </span>
      {muscles.map((slug) => {
        const label = muscleDefinition(slug)?.label ?? slug;
        return (
          <FilterChip
            key={slug}
            label={label}
            removeLabel={T.chipRemove(label)}
            onRemove={() => onRemoveMuscle(slug)}
          />
        );
      })}
      {bodyPart !== "all" && (
        <FilterChip
          label={translateBodyPart(bodyPart)}
          removeLabel={T.chipRemove(translateBodyPart(bodyPart))}
          onRemove={onClearBodyPart}
        />
      )}
      {equipment !== "all" && (
        <FilterChip
          label={translateEquipment(equipment)}
          removeLabel={T.chipRemove(translateEquipment(equipment))}
          onRemove={onClearEquipment}
        />
      )}
      {target !== "all" && (
        <FilterChip
          label={translateTarget(target)}
          removeLabel={T.chipRemove(translateTarget(target))}
          onRemove={onClearTarget}
        />
      )}
      {query.trim() !== "" && (
        <FilterChip
          label={`"${query.trim()}"`}
          removeLabel={T.chipRemove(query.trim())}
          onRemove={onClearQuery}
        />
      )}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 text-[11px] underline-offset-2 hover:underline"
        style={{ color: TEXT.tertiary }}
      >
        {T.clearAll}
      </button>
    </div>
  );
}

function FilterChip({
  label,
  removeLabel,
  onRemove,
}: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]"
      style={{
        backgroundColor: ACCENT.muted,
        borderColor: ACCENT.border,
        color: ACCENT.text,
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="rounded-full p-0.5 text-neutral-500 opacity-60 transition hover:opacity-100"
        style={{ color: ACCENT.text }}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

interface BrowserExerciseCardProps {
  exercise: Exercise;
  level?: "primary" | "secondary";
  selected: boolean;
  onToggleSelect: (id: string) => void;
  alreadyAdded: boolean;
  onOpenDetail: () => void;
}

function BrowserExerciseCard({
  exercise,
  level,
  selected,
  onToggleSelect,
  alreadyAdded,
  onOpenDetail,
}: BrowserExerciseCardProps) {
  const media = resolveMedia("exercise-gif", exercise.id, exercise.gif_url);
  const { src, failed, onLoad, onError } = useMediaSrc(media);

  return (
    <div
      className="group overflow-hidden rounded-xl border transition"
      style={{
        backgroundColor: SURFACE_ROLE.card,
        borderColor: selected ? ACCENT.base : GLASS.border,
        boxShadow: selected ? ACCENT.ring : GLASS.shadow,
      }}
    >
      {/* GIF thumbnail */}
      <div className="relative aspect-video">
        {!failed && media.url ? (
          <img
            src={src}
            alt={`Animación de ${exercise.name}`}
            loading="lazy"
            onLoad={onLoad}
            onError={onError}
            className="h-full w-full object-contain"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ color: TEXT.tertiary }}
          >
            <Dumbbell className="h-8 w-8" />
          </div>
        )}
        {level === "secondary" && (
          <span
            className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px]"
            style={{ backgroundColor: GLASS.fill, color: TEXT.tertiary }}
          >
            Estimula también
          </span>
        )}
        <span
          className="absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10px]"
          style={{ backgroundColor: SOLID.card, color: TEXT.secondary }}
        >
          GIF de referencia
        </span>
        {/* Detail trigger (invisible button overlay on the image) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          aria-label="Ver detalles"
          className="absolute inset-0 rounded-xl"
        />
        {/* Selection checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!alreadyAdded) onToggleSelect(exercise.id);
          }}
          aria-label={selected ? "Deseleccionar" : "Seleccionar"}
          className="absolute top-2 right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all"
          style={{
            borderColor: selected ? ACCENT.base : TEXT.disabled,
            backgroundColor: selected ? ACCENT.base : SOLID.card,
            color: TEXT.onAccent,
            opacity: alreadyAdded && !selected ? 0.4 : 1,
          }}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="p-3">
        <div
          className="flex items-start justify-between gap-2"
          style={{ color: TEXT.primary }}
        >
          <h3 className="truncate text-sm font-medium">
            {getExerciseDisplayName(exercise)}
          </h3>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          <span
            className="rounded-full px-1.5 py-0.5 text-[11px]"
            style={{
              backgroundColor: GLASS.fill,
              color: TEXT.tertiary,
            }}
          >
            {translateBodyPart(exercise.body_part)}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[11px]"
            style={{
              backgroundColor: GLASS.fill,
              color: TEXT.tertiary,
            }}
          >
            {translateTarget(exercise.target)}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[11px]"
            style={{
              backgroundColor: GLASS.fill,
              color: TEXT.tertiary,
            }}
          >
            {translateEquipment(exercise.equipment)}
          </span>
        </div>
      </div>
    </div>
  );
}

;
