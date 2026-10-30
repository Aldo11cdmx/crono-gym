/**
 * UnifiedExerciseSelectorSheet.tsx — el único selector de ejercicios de la app.
 *
 * Sustituye a `ExerciseSelectorModal`, `ExercisePickerModal` y al picker interno
 * de `VipRoutineBuilder`. Un solo componente, dos modos (simple / múltiple) que
 * se distinguen en el tipo (unión discriminada) y dos experiencias (móvil / PC)
 * que se distinguen solo con clases de CSS.
 *
 * - Abre instantáneamente: el marco se monta y anima con transform/opacity
 *   (máx. 250 ms). Nada bloquea el primer pintado.
 * - Filtración en segundo plano: input con debounce ~150 ms + useDeferredValue;
 *   búsqueda vacía y sin filtros = slice directo del catálogo.
 * - Índice de búsqueda perezoso: se construye en la primera búsqueda, nunca al
 *   importar. Texto normalizado (NFD, minúsculas, sin acentos).
 * - Paginación de 12: nunca se montan los ~1.300 nodos a la vez. Carga 12 más
 *   al llegar al centinela (IntersectionObserver) o al botón "Cargar más".
 * - Mapa anatómico cargado con React.lazy solo al tocar su botón.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Activity, ChevronDown, Search, Sparkles, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { Slug } from "react-muscle-highlighter";
import type { Exercise } from "@/types/supabase";
import { useExerciseCatalog, normaliseExerciseName } from "@/hooks/useExerciseCatalog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFrequentExercises } from "@/hooks/useFrequentExercises";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { translateEquipment } from "@/lib/i18n";
import { isAvailableInMyGym } from "@/data/myGymEquipment";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SOLID,
  SPACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { ExerciseRow } from "./exercise-selector/ExerciseRow";
import { FilterChips } from "./exercise-selector/FilterChips";
import { MuscleSelector } from "./MuscleSelector";
import { SelectionBar } from "./exercise-selector/SelectionBar";
import {
  filterByMuscles,
  muscleCounts,
  selectionLabels,
} from "@/lib/muscleFilter";
import { enabledSlugs as getEnabledSlugs } from "@/lib/muscleMap";

const PAGE_SIZE = 12;
const DEBOUNCE_MS = 150;
const MOBILE_MAX_WIDTH = 767; // por debajo de md (768px)
const ENABLED_MUSCLE_SLUGS = getEnabledSlugs();

export type UnifiedExerciseSelectorSheetMode = "single" | "multiple";

interface UnifiedExerciseSelectorSheetBase {
  isOpen: boolean;
  onClose: () => void;
  excludeIds?: readonly string[];
  initialMuscle?: Slug;
  title?: string;
}

export type UnifiedExerciseSelectorSheetProps =
  | (UnifiedExerciseSelectorSheetBase & {
      mode: "single";
      onSelectSingle: (exercise: Exercise) => void;
      onSelectMultiple?: never;
    })
  | (UnifiedExerciseSelectorSheetBase & {
      mode: "multiple";
      onSelectMultiple: (exercises: Exercise[]) => void;
      onSelectSingle?: never;
    });

type Tab = "all" | "frequent";
function normaliseTokens(value: string): string[] {
  return normaliseExerciseName(value)
    .split(/\s+/)
    .filter(Boolean);
}

function buildSearchIndex(exercises: Exercise[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const ex of exercises) {
    const tokens = new Set([
      ...normaliseTokens(ex.name),
      ...normaliseTokens(ex.body_part),
      ...normaliseTokens(ex.equipment),
      ...normaliseTokens(ex.target),
    ]);
    for (const token of tokens) {
      const set = index.get(token) ?? new Set();
      set.add(ex.id);
      index.set(token, set);
    }
  }
  return index;
}

export function UnifiedExerciseSelectorSheet({
  isOpen,
  onClose,
  excludeIds = [],
  mode,
  onSelectSingle,
  onSelectMultiple,
  title = "Seleccionar ejercicio",
}: UnifiedExerciseSelectorSheetProps) {
  const excluded = useMemo(
    () => new Set(excludeIds),
    [excludeIds.join(",")],
  );
  const reducedMotion = useReducedMotion();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
  const isFinePointer = useMediaQuery("(pointer: fine)");
  const {
    exercises,
    loading: catalogLoading,
    error: catalogError,
  } = useExerciseCatalog();
  const { frequentIds, addBatch } = useFrequentExercises();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [onlyMyGym, setOnlyMyGym] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<Slug[]>([]);
  const [isAnatomicalOpen, setIsAnatomicalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previouslyFocused, setPreviouslyFocused] = useState<HTMLElement | null>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const focusIndexRef = useRef<number>(-1);
  const searchIndexRef = useRef<Map<string, Set<string>> | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const mountedRef = useRef(false);

  // Buscador instantáneo al abrir (puntero fino; nada en táctil para no abrir el teclado).
  useEffect(() => {
    if (!isOpen) return;
    setPreviouslyFocused(document.activeElement as HTMLElement);
    const input = document.querySelector('[data-testid="selector-search-input"]') as HTMLInputElement | null;
    if (isFinePointer && input) input.focus();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    mountedRef.current = true;
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      mountedRef.current = false;
      if (previouslyFocused) previouslyFocused.focus();
      setPreviouslyFocused(null);
      focusIndexRef.current = -1;
    };
  }, [isOpen, isFinePointer]);

  const handleConfirm = useCallback(() => {
    if (mode === "single") return;
    const selected = [...selectedIds]
      .map((id) => exercises.find((ex) => ex.id === id))
      .filter((ex): ex is Exercise => ex !== undefined);
    if (selected.length === 0) return;
    void addBatch(selected.map((ex) => ex.id));
    hapticSuccess();
    onSelectMultiple(selected);
    onClose();
  }, [mode, exercises, selectedIds, addBatch, onSelectMultiple, onClose]);

  // Escape cierra; teclado del listado.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector('[data-testid="selector-search-input"]') as HTMLInputElement | null;
        input?.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && mode === "multiple") {
        e.preventDefault();
        handleConfirm();
        return;
      }
      if (["ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        handleKeyboard(e.key);
        return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, mode, onClose, handleConfirm]);

  // Índice de búsqueda: perezoso, una sola vez.
  const ensureIndex = useCallback((): Map<string, Set<string>> => {
    if (!searchIndexRef.current) {
      searchIndexRef.current = buildSearchIndex(exercises);
    }
    return searchIndexRef.current;
  }, [exercises]);

  // Catálogo base filtrado por pestaña y exclusiones.
  const baseRows = useMemo(() => {
    const rows = exercises.filter((ex) => !excluded.has(ex.id));
    if (tab === "frequent") {
      const frequentSet = new Set(frequentIds);
      return rows.filter((ex) => frequentSet.has(ex.id));
    }
    return rows;
  }, [exercises, tab, frequentIds, excluded]);

  // Filtrado: búsqueda diferida + filtros de atributo + mapa muscular.
  const filtered = useMemo(() => {
    const q = normaliseExerciseName(debouncedQuery);
    if (!q && !selectedEquipment && !onlyMyGym && selectedMuscles.length === 0) {
      // Búsqueda vacía y sin filtros: no se filtra nada, slice directo.
      return baseRows;
    }
    const index = ensureIndex();
    let ids: Set<string> | null = null;
    if (q) {
      for (const token of normaliseTokens(debouncedQuery)) {
        const set = index.get(token);
        if (!set) {
          ids = new Set();
          break;
        }
        const next = new Set<string>();
        if (ids) {
          for (const id of ids) {
            if (set.has(id)) next.add(id);
          }
        } else {
          for (const id of set) next.add(id);
        }
        ids = next;
      }
    }
    const attributeFiltered = baseRows.filter((ex) => {
      if (ids && !ids.has(ex.id)) return false;
      if (selectedEquipment && normaliseExerciseName(ex.equipment) !== normaliseExerciseName(selectedEquipment)) return false;
      if (onlyMyGym && !isAvailableInMyGym(ex.equipment)) return false;
      return true;
    });
    if (selectedMuscles.length === 0) return attributeFiltered;
    return filterByMuscles(attributeFiltered, selectedMuscles).results;
  }, [baseRows, debouncedQuery, selectedEquipment, onlyMyGym, selectedMuscles, ensureIndex]);

  // Paginación: 12 por página, nunca se montan todos los nodos.
  const visibleCount = page * PAGE_SIZE;
  const displayed = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;

  // Centinela de IntersectionObserver para cargar 12 más.
  useEffect(() => {
    const container = scrollContainer.current;
    if (!container || !("IntersectionObserver" in window)) return;
    const sentinel = container.querySelector("[data-testid='selector-sentinel']");
    if (!sentinel) return;
    ioRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore) {
          setPage((p) => p + 1);
        }
      },
      { root: container, rootMargin: "200px" },
    );
    ioRef.current.observe(sentinel);
    return () => {
      ioRef.current?.disconnect();
      ioRef.current = null;
    };
  }, [hasMore]);

  // Nueva búsqueda / filtros / pestaña: reinicia página y scroll.
  useEffect(() => {
    setPage(1);
    const container = scrollContainer.current;
    if (container) container.scrollTop = 0;
    focusIndexRef.current = -1;
  }, [query, tab, selectedEquipment, onlyMyGym, selectedMuscles]);

  const isSelected = (id: string) => selectedIds.has(id);
  const orderOf = (id: string): number | null => {
    const arr = [...selectedIds];
    const i = arr.indexOf(id);
    return i === -1 ? null : i + 1;
  };

  const handleSelect = useCallback(
    (ex: Exercise) => {
      if (mode === "single") {
        hapticLight();
        void addBatch([ex.id]);
        onSelectSingle(ex);
        onClose();
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(ex.id)) next.delete(ex.id);
        else next.add(ex.id);
        hapticLight();
        return next;
      });
    },
    [mode, onClose, onSelectSingle, addBatch],
  );

  const handleTogglePreview = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMore) setPage((p) => p + 1);
  }, [hasMore]);

  const handleClear = useCallback(() => {
    setQuery("");
    setTab("all");
    setSelectedEquipment(null);
    setOnlyMyGym(false);
    setSelectedMuscles([]);
    setPage(1);
  }, []);

  const handleMuscleSelectorChange = useCallback(
    (next: Slug[]) => setSelectedMuscles(next),
    [],
  );

  const handleClearMuscles = useCallback(() => {
    setSelectedMuscles([]);
  }, []);

  const handleToggleAnatomical = useCallback(() => {
    setIsAnatomicalOpen((prev) => !prev);
  }, []);

  const activeFilterCount =
    (selectedEquipment ? 1 : 0) +
    (onlyMyGym ? 1 : 0) +
    (query.length > 0 ? 1 : 0) +
    (selectedMuscles.length > 0 ? 1 : 0);

  const muscleCountsBySlug = useMemo(
    () => muscleCounts(baseRows, ENABLED_MUSCLE_SLUGS),
    [baseRows],
  );

  const muscleSelectionLabels = selectionLabels(selectedMuscles);

  const scrollStyle: CSSProperties = {
    overflowY: "auto",
    overscrollBehavior: "contain",
    touchAction: "pan-y",
    WebkitOverflowScrolling: "touch",
  };

  const sheetStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    // Abre y anima solo con transform/opacity; máximo 250 ms (MOTION.normal).
    transform: "translateY(0)",
    transition: reducedMotion ? "none" : `transform ${MOTION.normal} ${MOTION.easeOut}`,
    paddingBottom: `calc(${SPACE.card}px + env(safe-area-inset-bottom, 0px))`,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.modal,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        background: SCRIM.modal,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...sheetStyle,
          width: isMobile ? "100vw" : "min(92vw, 700px)",
          maxHeight: isMobile ? "92dvh" : "80dvh",
          borderRadius: isMobile ? `${RADIUS.sheet}` : RADIUS.modal,
          border: `1px solid ${GLASS.border}`,
          background: SOLID.popover,
          boxShadow: GLASS.shadow,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Barra superior */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
            padding: `${SPACE.md} ${SPACE.lg} ${SPACE.sm}`,
            borderBottom: `1px solid ${GLASS.border}`,
            background: SOLID.popover,
          }}
        >
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            <h2
              style={{
                margin: 0,
                fontSize: TYPE.title2.size,
                fontWeight: TYPE.title2.weight,
                color: TEXT.primary,
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: TYPE.caption.size,
                color: TEXT.tertiary,
              }}
            >
              {filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: MOTION.minTouchTarget,
                minHeight: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: "transparent",
                color: TEXT.secondary,
                cursor: "pointer",
                padding: `0 ${SPACE.sm}`,
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
</div>
        </div>

        {/* Contenido: buscador + chips + listado */}
        <div
          ref={scrollContainer}
          style={{
            ...scrollStyle,
            flex: 1,
            padding: `${SPACE.sm} ${SPACE.lg}`,
            overflowX: "hidden",
          }}
        >
          {/* Buscador */}
          <div
            style={{
              position: "relative",
              marginBottom: SPACE.md,
            }}
          >
            <Search
              size={18}
              style={{
                position: "absolute",
                left: SPACE.md,
                top: "50%",
                transform: "translateY(-50%)",
                color: TEXT.tertiary,
                pointerEvents: "none",
              }}
              aria-hidden="true"
            />
            <input
              data-testid="selector-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="Buscar ejercicio…"
              style={{
                width: "100%",
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.lg} 0 ${calcPaddingLeft()}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: "rgba(255,255,255,0.05)",
                color: TEXT.primary,
                fontSize: TYPE.body.size,
                fontFamily: "inherit",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
                style={{
                  position: "absolute",
                  right: SPACE.sm,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: MOTION.minTouchTarget,
                  minHeight: MOTION.minTouchTarget,
                  borderRadius: RADIUS.round,
                  border: `1px solid ${GLASS.border}`,
                  background: "transparent",
                  color: TEXT.tertiary,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Acordeón de mapa muscular (colapsado por defecto) */}
          <div style={{ marginBottom: SPACE.md }}>
            <button
              type="button"
              onClick={handleToggleAnatomical}
              aria-expanded={isAnatomicalOpen}
              aria-controls="anatomical-accordion"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: SPACE.sm,
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.sm}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: isAnatomicalOpen ? ACCENT.subtle : "transparent",
                color: isAnatomicalOpen ? TEXT.primary : TEXT.secondary,
                fontSize: TYPE.subhead.size,
                fontWeight: TYPE.subhead.weight,
                cursor: "pointer",
                transition: `background ${MOTION.fast} ${MOTION.easeOut}, color ${MOTION.fast} ${MOTION.easeOut}`,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
                <Activity size={16} aria-hidden="true" />
                Filtrar por mapa muscular
                {selectedMuscles.length > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 18,
                      height: 18,
                      padding: `0 ${SPACE.xs}`,
                      borderRadius: RADIUS.round,
                      background: ACCENT.base,
                      color: TEXT.onAccent,
                      fontSize: TYPE.caption.size,
                      fontWeight: 600,
                    }}
                  >
                    {selectedMuscles.length}
                  </span>
                )}
              </span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                style={{
                  transition: `transform ${MOTION.fast} ${MOTION.easeOut}`,
                  transform: isAnatomicalOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {isAnatomicalOpen && (
              <div
                id="anatomical-accordion"
                style={{
                  marginTop: SPACE.sm,
                  maxHeight: isMobile ? "50dvh" : "none",
                  overflowY: "auto",
                  overflowX: "hidden",
                }}
              >
                <MuscleSelector
                  selected={selectedMuscles}
                  onChange={handleMuscleSelectorChange}
                  counts={muscleCountsBySlug}
                  legendLabel="Músculos del catálogo"
                  className=""
                />
              </div>
            )}
          </div>

          {/* Chips: músculo y equipamiento */}
          <div style={{ display: "flex", gap: SPACE.md, marginBottom: SPACE.md, flexWrap: "wrap" }}>
            <FilterChips
              groupLabel="Equipamiento"
              chips={equipmentChips()}
            />
          </div>

          {/* Segmentado Todos | Frecuentes */}
          <div
            style={{
              display: "flex",
              gap: SPACE.xs,
              marginBottom: SPACE.md,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: "rgba(255,255,255,0.03)",
              padding: "2px",
            }}
          >
            {(["all", "frequent"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  minHeight: MOTION.minTouchTarget,
                  borderRadius: RADIUS.control,
                  border: "none",
                  background: tab === t ? ACCENT.subtle : "transparent",
                  color: tab === t ? TEXT.primary : TEXT.secondary,
                  fontSize: TYPE.subhead.size,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: SPACE.xs,
                  transition: `background ${MOTION.fast} ${MOTION.easeOut}, color ${MOTION.fast} ${MOTION.easeOut}`,
                }}
              >
                {t === "frequent" && <Sparkles size={14} aria-hidden="true" />}
                {t === "all" ? "Todos" : `Frecuentes (${frequentIds.length})`}
              </button>
            ))}
          </div>

          {/* Filtros activos como chips removibles */}
          {activeFilterCount > 0 && (
            <div style={{ marginBottom: SPACE.md }}>
              <p
                style={{
                  margin: `0 0 ${SPACE.xs}`,
                  fontSize: TYPE.caption.size,
                  fontWeight: 600,
                  letterSpacing: TYPE.label.tracking,
                  textTransform: "uppercase",
                  color: TEXT.tertiary,
                }}
              >
                Activos
              </p>
<div style={{ display: "flex", gap: SPACE.xs, flexWrap: "wrap" }}>
                  {selectedEquipment && removableChip({ label: translateEquipment(selectedEquipment), onRemove: () => setSelectedEquipment(null) })}
                  {onlyMyGym && removableChip({ label: "Mi Gym", onRemove: () => setOnlyMyGym(false) })}
                  {query && removableChip({ label: `"${query}"`, onRemove: () => setQuery("") })}
                  {selectedMuscles.length > 0 && removableChip({ label: muscleSelectionLabels, onRemove: handleClearMuscles })}
                </div>
              <button
                type="button"
                onClick={handleClear}
                style={{
                  marginTop: SPACE.xs,
                  background: "none",
                  border: "none",
                  color: TEXT.tertiary,
                  fontSize: TYPE.caption.size,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Estado de carga del catálogo */}
          {catalogLoading && displayed.length === 0 && (
            <div style={{ padding: SPACE.section, textAlign: "center", color: TEXT.tertiary }}>
              Cargando catálogo…
            </div>
          )}
          {catalogError && displayed.length === 0 && (
            <div style={{ padding: SPACE.section, textAlign: "center", color: ACCENT.text }}>
              {catalogError}
            </div>
          )}

          {/* Listado */}
          {displayed.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {displayed.map((ex) => {
                const selected = isSelected(ex.id);
                const order = mode === "multiple" ? orderOf(ex.id) : null;
                return (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    order={order}
                    selected={selected}
                    multiSelect={mode === "multiple"}
                    expanded={expandedId === ex.id}
                    onSelect={handleSelect}
                    onTogglePreview={handleTogglePreview}
                  />
                );
              })}
              {hasMore && (
                <div
                  data-testid="selector-sentinel"
                  style={{ height: 1 }}
                  aria-hidden="true"
                />
              )}
            </div>
          )}

          {/* Botón cargar más (respaldo si no hay IntersectionObserver) */}
          {hasMore && !("IntersectionObserver" in window) && (
            <button
              type="button"
              onClick={handleLoadMore}
              style={{
                display: "block",
                margin: `0 auto ${SPACE.md}`,
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.md}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: "transparent",
                color: TEXT.secondary,
                fontSize: TYPE.subhead.size,
                cursor: "pointer",
              }}
            >
              Cargar más ejercicios
            </button>
          )}

          {/* Estado vacío */}
          {displayed.length === 0 && !catalogLoading && !catalogError && (
            <div
              style={{
                padding: SPACE.section,
                textAlign: "center",
                color: TEXT.tertiary,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: SPACE.md,
              }}
            >
              <Search size={40} aria-hidden="true" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p style={{ margin: 0, fontSize: TYPE.body.size, color: TEXT.primary }}>
                No se encontró ningún ejercicio con esos filtros.
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    minHeight: MOTION.minTouchTarget,
                    padding: `0 ${SPACE.md}`,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${ACCENT.base}`,
                    background: ACCENT.base,
                    color: TEXT.onAccent,
                    fontSize: TYPE.subhead.size,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Barra flotante (modo múltiple, solo si hay selección) */}
        {mode === "multiple" && (
          <SelectionBar
            selectedCount={selectedIds.size}
            onAdd={handleConfirm}
            onClear={() => setSelectedIds(new Set())}
          />
        )}
      </div>
    </div>
  );

  // ----------------------------------------------------------------- helpers

  function equipmentChips() {
    // Equipamiento una sola vez, sin duplicados, del mapa de equipamiento (no del dataset crudo).
    const seen = new Set<string>();
    const chips: { key: string; label: string; active: boolean; onToggle: (k: string) => void }[] = [];
    for (const ex of baseRows) {
      const key = normaliseExerciseName(ex.equipment);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      chips.push({
        key,
        label: translateEquipment(ex.equipment),
        active: selectedEquipment === key,
        onToggle: (k) => {
          setSelectedEquipment(k === key ? null : k);
          setPage(1);
        },
      });
    }
    return chips;
  }

  function removableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
      <button
        type="button"
        onClick={onRemove}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: SPACE.xs,
          minHeight: MOTION.minTouchTarget,
          padding: `0 ${SPACE.sm}`,
          borderRadius: RADIUS.control,
          border: `1px solid ${ACCENT.border}`,
          background: ACCENT.subtle,
          color: TEXT.primary,
          fontSize: TYPE.caption.size,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        {label}
        <X size={12} aria-hidden="true" />
      </button>
    );
  }

  function calcPaddingLeft(): string {
    return "44px";
  }

  function handleKeyboard(key: string) {
    const rows = scrollContainer.current?.querySelectorAll('[role="option"]') ?? [];
    if (rows.length === 0) return;
    let next = focusIndexRef.current;
    if (key === "ArrowDown") next = Math.min(next + 1, rows.length - 1);
    else if (key === "ArrowUp") next = Math.max(next - 1, 0);
    else {
      const row = rows[focusIndexRef.current];
      if (row) (row as HTMLElement).click();
      return;
    }
    if (next < 0 || next === focusIndexRef.current) return;
    focusIndexRef.current = next;
    (rows[next] as HTMLElement)?.focus();
    rows[next]?.scrollIntoView?.({ block: "nearest" });
  }
}
