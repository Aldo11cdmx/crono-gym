import { useCallback, useEffect, useMemo, useState } from "react";
import type { Slug } from "react-muscle-highlighter";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@lib/supabase";
import { loadExercises } from "@services/seedExercises";
import type { Exercise } from "../types/supabase";
import {
  Search,
  Dumbbell,
  Target,
  Activity,
  X,
  AlertCircle,
  CloudDownload,
  Building2,
  PersonStanding,
} from "lucide-react";
import { MY_GYM_EQUIPMENT_TAGS } from "../data/myGymEquipment";
import { MuscleSelector } from "./MuscleSelector";
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
  translateOption,
  translateTarget,
} from "../lib/i18n";

const BODY_PARTS = BODY_PART_FILTER_VALUES;

/** Where the currently displayed catalog came from. */
type Source = "supabase" | "fallback";

export function ExerciseBrowser({
  onSelect,
  onClose,
}: {
  onSelect: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("supabase");
  const [onlyMyGym, setOnlyMyGym] = useState(false);

  // The URL is the single owner of the anatomy selection, read and written
  // through the router rather than `window.history`. Two components write this
  // param (this one, and the ranks view that hands a muscle to the catalog), and
  // two writers that bypass the router is how the two copies of the URL drift
  // apart -- the symptom being a filter that applies once and then silently
  // stops.
  const [searchParams, setSearchParams] = useSearchParams();

  // Multi-selection of muscles. Seeded from the URL so returning to the browser
  // keeps the anatomy filter, which is the whole point of a filter the user set
  // deliberately.
  const [muscles, setMuscles] = useState<Slug[]>(() =>
    parseMuscleParam(searchParams.get(MUSCLE_PARAM)),
  );
  const [showAnatomy, setShowAnatomy] = useState(() => muscles.length > 0);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      // Preferred path: the seeded table.
      const { data, error: dbError } = await supabase
        .from("exercises")
        .select("*")
        .order("id", { ascending: true });

      const rows = (data ?? []) as Exercise[];
      if (!alive) return;

      if (!dbError && rows.length > 0) {
        setExercises(rows);
        setSource("supabase");
        setLoading(false);
        return;
      }

      // Empty table or an RLS/network failure: fall back to the dataset so the
      // catalog is usable regardless of seeding state.
      const reason = dbError ? dbError.message : "La tabla exercises está vacía";
      try {
        const fallback = await loadExercises();
        if (!alive) return;
        setExercises(fallback);
        setSource("fallback");
        setError(`Mostrando el catálogo en caché (${fallback.length}). ${reason}.`);
      } catch (fallbackError) {
        if (!alive) return;
        setExercises([]);
        setError(
          `No se pudo cargar el catálogo: ${
            fallbackError instanceof Error ? fallbackError.message : reason
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

  // Sorted by the Spanish label so the dropdown reads naturally; filtering
  // still uses the raw catalog value.
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
    () => ({ query, bodyPart, equipment, target, onlyMyGym }),
    [query, bodyPart, equipment, target, onlyMyGym],
  );

  const gymMatcher = useCallback((value: string) => MY_GYM_EQUIPMENT_TAGS.has(value), []);

  const baseFiltered = useMemo(
    () => applyBaseFilters(exercises, filters, { isMyGymEquipment: gymMatcher }),
    [exercises, filters, gymMatcher],
  );

  const { results: filtered, levelById } = useMemo(
    () => filterByMuscles(baseFiltered, muscles),
    [baseFiltered, muscles],
  );

  const counts = useMemo(
    () => muscleCounts(baseFiltered, enabledSlugs()),
    [baseFiltered],
  );

  // Mirror the selection into the URL without adding history entries, so a
  // reload or a link share keeps the filter but Back still leaves the modal.
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
        ? explainEmpty(baseFiltered, exercises, muscles, filters, T, {
            isMyGymEquipment: gymMatcher,
          })
        : null,
    [filtered.length, loading, baseFiltered, exercises, muscles, filters, gymMatcher],
  );

  const onSelectMuscle = useCallback((next: Slug[]) => setMuscles(next), []);

  const activeMuscles = useMemo(
    () =>
      muscles
        .map((slug) => muscleDefinition(slug))
        .filter((d): d is NonNullable<typeof d> => Boolean(d)),
    [muscles],
  );

  function clearFilters() {
    setQuery("");
    setBodyPart("all");
    setEquipment("all");
    setTarget("all");
    setOnlyMyGym(false);
    setMuscles([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-neutral-900/70 shadow-glass backdrop-blur-md sm:h-[85vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-50">Biblioteca de Ejercicios</h2>
            <p className="text-xs text-neutral-400">
              {loading
                ? "Busca y filtra para agregar a tu entrenamiento."
                : T.resultsMany(filtered.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-white/10 bg-neutral-950/40 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busqueda por nombre..."
              className="w-full rounded-lg border border-white/10 bg-neutral-950/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FilterSelect
              label="Parte del cuerpo"
              icon={<Activity className="h-3.5 w-3.5" />}
              value={bodyPart}
              options={BODY_PARTS}
              onChange={setBodyPart}
              translate={translateBodyPart}
            />
            <FilterSelect
              label="Equipamiento"
              icon={<Dumbbell className="h-3.5 w-3.5" />}
              value={equipment}
              options={["all", ...equipmentOptions]}
              onChange={setEquipment}
            />
            <FilterSelect
              label="Objetivo"
              icon={<Target className="h-3.5 w-3.5" />}
              value={target}
              options={["all", ...targetOptions]}
              onChange={setTarget}
              translate={translateTarget}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-neutral-500">
              {filtered.length} de {exercises.length} ejercicios
              {source === "fallback" ? " (caché local)" : ""}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAnatomy((v) => !v)}
                aria-pressed={showAnatomy}
                aria-controls="anatomy-panel"
                className={`flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                  showAnatomy || muscles.length > 0
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-white/10 text-neutral-300 hover:border-white/25"
                }`}
              >
                <PersonStanding className="h-3.5 w-3.5" />
                {muscles.length > 0 ? T.openWithSelection(muscles.length) : T.open}
              </button>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={onlyMyGym}
                  onChange={(e) => setOnlyMyGym(e.target.checked)}
                  className="accent-accent"
                />
                <Building2 className="h-3.5 w-3.5" />
                Solo mi gym
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-neutral-400 underline-offset-2 hover:underline"
              >
                {T.clearAll}
              </button>
            </div>
          </div>

          {(activeMuscles.length > 0 ||
            equipment !== "all" ||
            query.trim() !== "" ||
            bodyPart !== "all" ||
            target !== "all") && (
            <ActiveFilterChips
              muscles={activeMuscles.map((d) => d.slug)}
              onRemoveMuscle={(slug) => setMuscles((prev) => toggleMuscle(prev, slug))}
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
        </div>

        <div className="flex min-h-0 flex-1">
          {showAnatomy && (
            <div
              id="anatomy-panel"
              className="w-full shrink-0 overflow-y-auto border-b border-white/10 bg-neutral-950/40 p-4 sm:w-80 sm:border-b-0 sm:border-r"
            >
              <MuscleSelector selected={muscles} onChange={onSelectMuscle} counts={counts} />
            </div>
          )}
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            {error && (
              <div
                className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                  source === "fallback"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : "border-red-500/30 bg-red-500/10 text-red-300"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {source === "fallback" ? (
                    <CloudDownload className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                </span>
                <span>{error}</span>
              </div>
            )}
            {loading ? (
              <div className="text-center text-neutral-500">Cargando catalogo...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-neutral-500">
                {emptyCause ? (
                  <>
                    <p>{emptyCause.message}</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 text-xs text-accent underline-offset-2 hover:underline"
                    >
                      {emptyCause.action}
                    </button>
                  </>
                ) : (
                  "Sin resultados para esta busqueda."
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    level={levelById.get(ex.id)}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Removable chips for every active filter.
 *
 * Each chip names the filter it removes. The anatomy chips are listed separately
 * from the dropdown ones so the user can tell which came from the body map.
 */
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
    <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2.5">
      <span className="text-[11px] text-neutral-600">Filtros activos:</span>
      {muscles.map((slug) => {
        const label = muscleDefinition(slug)?.label ?? slug;
        return (
          <FilterChip key={slug} label={label} removeLabel={T.chipRemove(label)} onRemove={() => onRemoveMuscle(slug)} />
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
        className="ml-1 text-[11px] text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
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
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-2.5 pr-1 text-[11px] text-accent">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="rounded-full p-0.5 transition hover:bg-accent/25"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function FilterSelect({
  label,
  icon,
  value,
  options,
  onChange,
  translate,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  translate?: (v: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
        {icon}
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {translate ? translate(o) : translateOption(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExerciseCard({
  exercise,
  level,
  onSelect,
}: {
  exercise: Exercise;
  level?: "primary" | "secondary";
  onSelect: (ex: Exercise) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const steps = exercise.instructions ?? [];
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950/40 transition hover:border-accent/50">
      <div className="relative aspect-video bg-neutral-900">
        {!imgError ? (
          <img
            src={exercise.gif_url}
            alt={`Animación de ${exercise.name}`}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">
            <Dumbbell className="h-8 w-8" />
          </div>
        )}
        {level === "secondary" && (
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-neutral-400">
            Estimula también
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-neutral-100">{exercise.name}</h3>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-neutral-400">
          <span className="rounded-md bg-white/5 px-1.5 py-0.5">
            {translateBodyPart(exercise.body_part)}
          </span>
          <span className="rounded-md bg-white/5 px-1.5 py-0.5">
            {translateTarget(exercise.target)}
          </span>
          <span className="rounded-md bg-white/5 px-1.5 py-0.5">
            {translateEquipment(exercise.equipment)}
          </span>
        </div>
        {steps.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowSteps((v) => !v)}
              aria-expanded={showSteps}
              className="text-[11px] text-neutral-500 underline-offset-2 transition hover:text-neutral-300 hover:underline"
            >
              {showSteps ? "Ocultar instrucciones" : `Instrucciones (${steps.length})`}
            </button>
            {showSteps && (
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-neutral-400">
                {steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => onSelect(exercise)}
          className="mt-2 w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-neutral-950 transition hover:brightness-110"
        >
          Agregar al entrenamiento
        </button>
      </div>
    </div>
  );
}