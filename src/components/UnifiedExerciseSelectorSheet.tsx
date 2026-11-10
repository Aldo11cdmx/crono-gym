/**
 * UnifiedExerciseSelectorSheet.tsx — selector premium de ejercicios (Rutinas/entrenamiento).
 *
 * Interfaz completamente rediseñada (APPLE FITNESS × CRONOS PERFORMANCE) conectada a la
 * infraestructura funcional existente: catálogo, búsqueda/filtros, estado de selección,
 * callbacks/contratos, reglas (excludeIds, alreadyInDay), agregar/retirar, orden,
 * persistencia de frecuentes e integración con editores individual/semanal y coach.
 *
 * No duplica lógica ni catálogo. No cambia contratos de integración.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Check, ChevronDown, Dumbbell, Minus, Search, Sparkles, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { Slug } from "react-muscle-highlighter";
import type { Exercise } from "@/types/supabase";
import { useExerciseCatalog, normaliseExerciseName } from "@/hooks/useExerciseCatalog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFrequentExercises } from "@/hooks/useFrequentExercises";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { supabase } from "@lib/supabase";
import { ACCENT, DANGER, GLASS, MOTION, RADIUS, SCRIM, SOLID, SPACE, SURFACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { MuscleSelector } from "./MuscleSelector";
import { filterByMuscles, muscleCounts, selectionLabels } from "@/lib/muscleFilter";
import { enabledSlugs as getEnabledSlugs } from "@/lib/muscleMap";

const PAGE_SIZE = 12;
const DEBOUNCE_MS = 150;
const MOBILE_MAX_WIDTH = 767;
const ENABLED_MUSCLE_SLUGS = getEnabledSlugs();

export type UnifiedExerciseSelectorSheetMode = "single" | "multiple";

interface UnifiedExerciseSelectorSheetBase {
  isOpen: boolean;
  onClose: () => void;
  excludeIds?: readonly string[];
  initialMuscle?: Slug;
  title?: string;
  dayContext?: {
    dayIndex: number;
    dayLabel: string;
    dayExercises: Exercise[];
  };
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
type AnatomicalView = "frontal" | "posterior";

function normaliseTokens(value: string): string[] {
  return normaliseExerciseName(value).split(/\s+/).filter(Boolean);
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

const EQUIPMENT_CATEGORY_MAP: Record<string, string> = {
  cable: "Polea / Cable",
  pulley: "Polea / Cable",
  dumbbell: "Mancuernas",
  "ez barbell": "Barra Z / Hexagonal",
  "trap bar": "Barra Z / Hexagonal",
  barbell: "Barra Olímpica / Libre",
  "olympic barbell": "Barra Olímpica / Libre",
  "leverage machine": "Máquina / Palanca",
  "sled machine": "Máquina / Palanca",
  assisted: "Máquina / Palanca",
  "smith machine": "Máquina Smith",
  "body weight": "Peso Corporal",
  bodyweight: "Peso Corporal",
  band: "Bandas / Kettlebell",
  kettlebell: "Bandas / Kettlebell",
};

const EQUIPMENT_CATEGORY_ORDER = [
  "Polea / Cable",
  "Mancuernas",
  "Barra Olímpica / Libre",
  "Barra Z / Hexagonal",
  "Máquina / Palanca",
  "Máquina Smith",
  "Peso Corporal",
  "Bandas / Kettlebell",
];

function getEquipmentCategory(equipment: string): string {
  const key = normaliseExerciseName(equipment);
  return EQUIPMENT_CATEGORY_MAP[key] ?? "Otros";
}

export function UnifiedExerciseSelectorSheet({
  isOpen,
  onClose,
  excludeIds = [],
  mode,
  onSelectSingle,
  onSelectMultiple,
  title = "Seleccionar ejercicio",
  dayContext,
}: UnifiedExerciseSelectorSheetProps) {
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds.join(",")]);
  const reducedMotion = useReducedMotion();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
  const isFinePointer = useMediaQuery("(pointer: fine)");
  const { exercises, loading: catalogLoading, error: catalogError } = useExerciseCatalog();
  const { frequentIds, addBatch } = useFrequentExercises();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState<string | null>(null);
  const [selectedMuscles, setSelectedMuscles] = useState<Slug[]>([]);
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false);
  const [isAnatomicalOpen, setIsAnatomicalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localExercises, setLocalExercises] = useState<Exercise[]>([]);
  const [opError, setOpError] = useState<string | null>(null);
  const [previouslyFocused, setPreviouslyFocused] = useState<HTMLElement | null>(null);
  const [anatomicalView, setAnatomicalView] = useState<AnatomicalView>("frontal");
  const scrollContainer = useRef<HTMLDivElement>(null);
  const focusIndexRef = useRef<number>(-1);
  const searchIndexRef = useRef<Map<string, Set<string>> | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const mountedRef = useRef(false);

  const alreadyInDay = useMemo(() => new Set(dayContext?.dayExercises.map((ex) => ex.id)), [dayContext?.dayExercises]);
  const dayMuscleSlugs = useMemo(() => {
    const set = new Set<Slug>();
    for (const ex of dayContext?.dayExercises ?? []) {
      if (ex.body_part) set.add(ex.body_part as Slug);
    }
    return set;
  }, [dayContext?.dayExercises]);

  useEffect(() => {
    if (!dayContext?.dayLabel) return;
    const label = dayContext.dayLabel.toLowerCase();
    const muscleByLabel: Record<string, Slug> = {
      pecho: "pecho" as Slug, espalda: "espalda" as Slug, pierna: "piernas" as Slug, piernas: "piernas" as Slug,
      hombro: "hombros" as Slug, hombros: "hombros" as Slug, brazo: "brazos" as Slug, brazos: "brazos" as Slug,
      triceps: "triceps" as Slug, biceps: "biceps" as Slug, abdomen: "abdomen" as Slug, core: "core" as Slug,
      gluteo: "gluteos" as Slug, gluteos: "gluteos" as Slug, gemelo: "gemelos" as Slug, gemelos: "gemelos" as Slug,
    };
    const slug = muscleByLabel[label];
    if (slug && selectedMuscles.length === 0) setSelectedMuscles([slug]);
  }, [dayContext?.dayLabel, selectedMuscles.length]);

  useEffect(() => {
    if (!isOpen) return;
    setPreviouslyFocused(document.activeElement as HTMLElement);
    const input = document.querySelector('[data-testid="selector-search-input"]') as HTMLInputElement | null;
    if (isFinePointer && input) input.focus();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    mountedRef.current = true;
    setSelectedIds(new Set());
    setPage(1);
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
      .map((id) => localExercises.find((ex) => ex.id === id))
      .filter((ex): ex is Exercise => ex !== undefined);
    if (selected.length === 0) return;
    void addBatch(selected.map((ex) => ex.id));
    hapticSuccess();
    onSelectMultiple(selected);
    onClose();
  }, [mode, localExercises, selectedIds, addBatch, onSelectMultiple, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "/") {
        e.preventDefault();
        (document.querySelector('[data-testid="selector-search-input"]') as HTMLInputElement | null)?.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && mode === "multiple") { e.preventDefault(); handleConfirm(); return; }
      if (["ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) { e.preventDefault(); handleKeyboard(e.key); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, mode, onClose, handleConfirm]);

  const ensureIndex = useCallback((): Map<string, Set<string>> => {
    if (!searchIndexRef.current) searchIndexRef.current = buildSearchIndex(localExercises);
    return searchIndexRef.current;
  }, [localExercises]);

  const baseRows = useMemo(() => {
    const rows = localExercises.filter((ex) => !excluded.has(ex.id) && ex.is_active && !ex.is_hidden);
    if (tab === "frequent") {
      const frequentSet = new Set(frequentIds);
      return rows.filter((ex) => frequentSet.has(ex.id));
    }
    return rows;
  }, [localExercises, tab, frequentIds, excluded]);

  useEffect(() => { if (exercises.length === 0) return; setLocalExercises(exercises); }, [exercises]);

  const filtered = useMemo(() => {
    const q = normaliseExerciseName(debouncedQuery);
    if (!q && !selectedEquipmentCategory && selectedMuscles.length === 0) return baseRows;
    const index = ensureIndex();
    let ids: Set<string> | null = null;
    if (q) {
      for (const token of normaliseTokens(debouncedQuery)) {
        const set = index.get(token);
        if (!set) { ids = new Set(); break; }
        const next = new Set<string>();
        if (ids) { for (const id of ids) if (set.has(id)) next.add(id); }
        else { for (const id of set) next.add(id); }
        ids = next;
      }
    }
    const attributeFiltered = baseRows.filter((ex) => {
      if (ids && !ids.has(ex.id)) return false;
      if (selectedEquipmentCategory && getEquipmentCategory(ex.equipment) !== selectedEquipmentCategory) return false;
      return true;
    });
    if (selectedMuscles.length === 0) return attributeFiltered;
    return filterByMuscles(attributeFiltered, selectedMuscles).results;
  }, [baseRows, debouncedQuery, selectedEquipmentCategory, selectedMuscles, ensureIndex]);

  const visibleCount = page * PAGE_SIZE;
  const displayed = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;

  useEffect(() => {
    const container = scrollContainer.current;
    if (!container || !("IntersectionObserver" in window)) return;
    const sentinel = container.querySelector("[data-testid='selector-sentinel']");
    if (!sentinel) return;
    ioRef.current = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && hasMore) setPage((p) => p + 1);
    }, { root: container, rootMargin: "200px" });
    ioRef.current.observe(sentinel);
    return () => { ioRef.current?.disconnect(); ioRef.current = null; };
  }, [hasMore]);

  useEffect(() => {
    setPage(1);
    const container = scrollContainer.current;
    if (container) container.scrollTop = 0;
    focusIndexRef.current = -1;
  }, [query, tab, selectedEquipmentCategory, selectedMuscles]);

  const isSelected = (id: string) => selectedIds.has(id);
  const orderOf = (id: string): number | null => {
    const arr = [...selectedIds];
    const i = arr.indexOf(id);
    return i === -1 ? null : i + 1;
  };

  const handleSelect = useCallback((ex: Exercise) => {
    if (mode === "single") {
      if (alreadyInDay.has(ex.id)) { opError && setOpError(null); return; }
      hapticLight();
      void addBatch([ex.id]);
      onSelectSingle(ex);
      onClose();
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ex.id)) next.delete(ex.id); else next.add(ex.id);
      hapticLight();
      return next;
    });
  }, [mode, onClose, onSelectSingle, addBatch, alreadyInDay, opError]);

  const handleTogglePreview = useCallback((id: string) => setExpandedId((prev) => (prev === id ? null : id)), []);
  const handleLoadMore = useCallback(() => { if (hasMore) setPage((p) => p + 1); }, [hasMore]);
  const handleClear = useCallback(() => {
    setQuery(""); setTab("all"); setSelectedEquipmentCategory(null); setSelectedMuscles([]); setPage(1);
    setIsEquipmentOpen(false); setIsAnatomicalOpen(false);
  }, []);
  const handleMuscleSelectorChange = useCallback((next: Slug[]) => setSelectedMuscles(next), []);
  const handleClearMuscles = useCallback(() => setSelectedMuscles([]), []);
  const handleToggleEquipment = useCallback(() => {
    setIsEquipmentOpen((prev) => {
      const next = !prev;
      if (next) setIsAnatomicalOpen(false);
      return next;
    });
  }, []);
  const handleToggleAnatomical = useCallback(() => {
    setIsAnatomicalOpen((prev) => {
      const next = !prev;
      if (next) setIsEquipmentOpen(false);
      return next;
    });
  }, []);

  const availableEquipmentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const ex of baseRows) {
      const cat = getEquipmentCategory(ex.equipment);
      if (cat !== "Otros") set.add(cat);
    }
    return EQUIPMENT_CATEGORY_ORDER.filter((c) => set.has(c));
  }, [baseRows]);

  const muscleCountsBySlug = useMemo(() => muscleCounts(baseRows, ENABLED_MUSCLE_SLUGS), [baseRows]);
  const muscleSelectionLabels = selectionLabels(selectedMuscles);

  const activeFilterCount = (selectedEquipmentCategory ? 1 : 0) + (query.length > 0 ? 1 : 0) + (selectedMuscles.length > 0 ? 1 : 0);

  const handleRenameExercise = useCallback(async (id: string, name: string, name_es: string | null) => {
    setOpError(null);
    try {
      const { error } = await supabase.from("exercises").update({ name, name_es }).eq("id", id);
      if (error) throw error;
      setLocalExercises((prev) => prev.map((ex) => (ex.id === id ? { ...ex, name, name_es } : ex)));
      searchIndexRef.current = null;
      hapticSuccess();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "No se pudo renombrar el ejercicio.");
    }
  }, []);

  const handleHideExercise = useCallback(async (id: string) => {
    setOpError(null);
    try {
      const { error } = await supabase.from("exercises").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      setLocalExercises((prev) => prev.filter((ex) => ex.id !== id));
      hapticSuccess();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "No se pudo ocultar el ejercicio del catálogo.");
    }
  }, []);

  function handleKeyboard(key: string) {
    const rows = scrollContainer.current?.querySelectorAll('[role="option"]') ?? [];
    if (rows.length === 0) return;
    let next = focusIndexRef.current;
    if (key === "ArrowDown") next = Math.min(next + 1, rows.length - 1);
    else if (key === "ArrowUp") next = Math.max(next - 1, 0);
    else { const row = rows[focusIndexRef.current]; if (row) (row as HTMLElement).click(); return; }
    if (next < 0 || next === focusIndexRef.current) return;
    focusIndexRef.current = next;
    (rows[next] as HTMLElement)?.focus();
    rows[next]?.scrollIntoView?.({ block: "nearest" });
  }

  if (!isOpen) return null;

  const sheetAnim: CSSProperties = {
    transform: "translateY(0)",
    transition: reducedMotion ? "none" : `transform ${MOTION.normal} ${MOTION.easeOut}, opacity ${MOTION.normal} ${MOTION.easeOut}`,
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: Z_INDEX.modal, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", background: SCRIM.modal, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...sheetAnim,
          width: isMobile ? "100vw" : "min(96vw, 920px)",
          maxHeight: isMobile ? "88vh" : "88vh",
          borderRadius: isMobile ? RADIUS.sheet : RADIUS.modal,
          border: `1px solid ${GLASS.border}`,
          background: "#09090B",
          boxShadow: GLASS.shadow,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: `${SPACE.sm}px ${SPACE.md}px`,
            borderBottom: `1px solid ${GLASS.border}`,
            background: "rgba(28,28,30,0.8)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
            <h2
              style={{
                margin: 0,
                minWidth: 0,
                fontSize: TYPE.headline.size,
                fontWeight: TYPE.headline.weight,
                lineHeight: TYPE.headline.lineHeight,
                letterSpacing: TYPE.headline.tracking,
                color: TEXT.primary,
              }}
            >
              {title}
            </h2>
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
                borderRadius: RADIUS.round,
                border: `1px solid ${GLASS.border}`,
                background: GLASS.fillSubtle,
                color: TEXT.secondary,
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {dayContext && dayMuscleSlugs.size > 0 && (
            <div style={{ marginTop: SPACE.xs, display: "flex", alignItems: "center", gap: SPACE.xs, flexWrap: "wrap" }}>
              {[...dayMuscleSlugs].map((slug) => (
                <span
                  key={slug}
                  style={{
                    padding: `2px ${SPACE.sm}px`,
                    borderRadius: RADIUS.pill,
                    border: `1px solid ${ACCENT.border}`,
                    background: ACCENT.subtle,
                    color: TEXT.primary,
                    fontSize: TYPE.caption.size,
                  }}
                >
                  {slug}
                </span>
              ))}
            </div>
          )}
        </header>

        <div
          ref={scrollContainer}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            padding: `${SPACE.sm}px ${SPACE.md}px ${mode === "multiple" && selectedIds.size > 0 ? 144 : SPACE.xl}px`,
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              paddingTop: SPACE.xs,
              paddingBottom: SPACE.xs,
              background: `linear-gradient(180deg, ${SOLID.popover} 80%, transparent 100%)`,
            }}
          >
            <div style={{ position: "relative" }}>
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
              <style>{`[data-testid="selector-search-input"]::placeholder{color:${TEXT.tertiary};opacity:1;}`}</style>
              <input
                data-testid="selector-search-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
                placeholder="Buscar por nombre, músculo o equipo…"
                autoComplete="off"
                style={{
                  width: "100%",
                  height: MOTION.minTouchTarget,
                  minHeight: MOTION.minTouchTarget,
                  paddingLeft: 44,
                  paddingRight: query ? MOTION.minTouchTarget : SPACE.md,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.borderStrong}`,
                  background: SOLID.popover,
                  color: TEXT.primary,
                  fontSize: TYPE.subhead.size,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: MOTION.minTouchTarget,
                    minHeight: MOTION.minTouchTarget,
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: TEXT.secondary,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: SPACE.xs, marginBottom: SPACE.sm, padding: 2, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: "rgba(28,28,30,0.6)" }}>
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
                  fontWeight: tab === t ? 600 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: SPACE.xs,
                }}
              >
                {t === "frequent" && <Sparkles size={14} aria-hidden="true" />}
                {t === "all" ? "Todos" : `Frecuentes (${frequentIds.length})`}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SPACE.xs, marginBottom: SPACE.xs }}>
            <button
              type="button"
              onClick={handleToggleEquipment}
              aria-expanded={isEquipmentOpen}
              aria-controls="equipment-chips"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: SPACE.xs,
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.md}px`,
                borderRadius: RADIUS.control,
                border: `1px solid ${isEquipmentOpen ? ACCENT.border : GLASS.border}`,
                background: isEquipmentOpen ? "rgba(255,59,48,0.1)" : "rgba(28,28,30,0.6)",
                color: TEXT.secondary,
                fontSize: TYPE.subhead.size,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Dumbbell size={16} aria-hidden="true" />
              <span>Equipamiento</span>
              {selectedEquipmentCategory && (
                <span style={{ padding: `2px 6px`, borderRadius: RADIUS.pill, background: ACCENT.base, color: TEXT.onAccent, fontSize: TYPE.caption.size, fontWeight: 600 }}>
                  1
                </span>
              )}
              <ChevronDown size={14} aria-hidden="true" style={{ transform: isEquipmentOpen ? "rotate(180deg)" : "rotate(0deg)", transition: reducedMotion ? "none" : `transform ${MOTION.fast} ${MOTION.easeOut}` }} />
            </button>
            <button
              type="button"
              onClick={handleToggleAnatomical}
              aria-expanded={isAnatomicalOpen}
              aria-controls="anatomical-chips"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: SPACE.xs,
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.md}px`,
                borderRadius: RADIUS.control,
                border: `1px solid ${isAnatomicalOpen ? ACCENT.border : GLASS.border}`,
                background: isAnatomicalOpen ? "rgba(255,59,48,0.1)" : "rgba(28,28,30,0.6)",
                color: TEXT.secondary,
                fontSize: TYPE.subhead.size,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Activity size={16} aria-hidden="true" />
              <span>Músculo</span>
              {selectedMuscles.length > 0 && (
                <span style={{ padding: `2px 6px`, borderRadius: RADIUS.pill, background: ACCENT.base, color: TEXT.onAccent, fontSize: TYPE.caption.size, fontWeight: 600 }}>
                  {selectedMuscles.length}
                </span>
              )}
              <ChevronDown size={14} aria-hidden="true" style={{ transform: isAnatomicalOpen ? "rotate(180deg)" : "rotate(0deg)", transition: reducedMotion ? "none" : `transform ${MOTION.fast} ${MOTION.easeOut}` }} />
            </button>
          </div>

          {isEquipmentOpen && (
            <div id="equipment-chips" style={{ marginBottom: SPACE.sm, maxHeight: "176px", overflowY: "auto" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs, padding: SPACE.xs }}>
                {availableEquipmentCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={selectedEquipmentCategory === cat}
                    onClick={() => { setSelectedEquipmentCategory(selectedEquipmentCategory === cat ? null : cat); setPage(1); setIsEquipmentOpen(false); }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: SPACE.xs,
                      minHeight: 36,
                      padding: `0 ${SPACE.md}px`,
                      borderRadius: RADIUS.pill,
                      border: `1px solid ${selectedEquipmentCategory === cat ? ACCENT.base : "rgba(255,255,255,0.1)"}`,
                      background: selectedEquipmentCategory === cat ? ACCENT.base : "rgba(44,44,46,0.8)",
                      color: selectedEquipmentCategory === cat ? "#FFFFFF" : TEXT.secondary,
                      fontSize: TYPE.caption.size,
                      fontWeight: selectedEquipmentCategory === cat ? 600 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 150ms ease",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isAnatomicalOpen && (
            <div id="anatomical-chips" style={{ marginBottom: SPACE.sm, maxHeight: "176px", overflowY: "auto" }}>
              <MuscleSelector selected={selectedMuscles} onChange={handleMuscleSelectorChange} counts={muscleCountsBySlug} legendLabel="Músculos del catálogo" className="" />
            </div>
          )}

          {activeFilterCount > 0 && (
            <div style={{ marginBottom: SPACE.sm, display: "flex", alignItems: "center", gap: SPACE.xs, flexWrap: "wrap" }}>
              {selectedEquipmentCategory && <RemovableChip label={selectedEquipmentCategory} onRemove={() => setSelectedEquipmentCategory(null)} />}
              {query && <RemovableChip label={`"${query}"`} onRemove={() => setQuery("")} />}
              {selectedMuscles.length > 0 && <RemovableChip label={muscleSelectionLabels} onRemove={handleClearMuscles} />}
              <button type="button" onClick={handleClear} style={{ background: "none", border: "none", color: TEXT.tertiary, fontSize: TYPE.caption.size, cursor: "pointer", padding: `0 ${SPACE.xs}px`, minHeight: MOTION.minTouchTarget }}>Limpiar filtros</button>
            </div>
          )}

          {catalogLoading && displayed.length === 0 && <StateBlock text="Cargando catálogo…" />}
          {catalogError && displayed.length === 0 && <StateBlock text={catalogError} tone="error" />}
          {opError && <StateBlock text={opError} tone="error" />}

          {displayed.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: SPACE.sm }}>
              {displayed.map((ex) => (
                <SelectorCard
                  key={ex.id}
                  exercise={ex}
                  order={mode === "multiple" ? orderOf(ex.id) : null}
                  selected={isSelected(ex.id)}
                  multiSelect={mode === "multiple"}
                  expanded={expandedId === ex.id}
                  alreadyInDay={alreadyInDay.has(ex.id)}
                  onSelect={handleSelect}
                  onTogglePreview={handleTogglePreview}
                  onRename={handleRenameExercise}
                  onHide={handleHideExercise}
                  hidden={!ex.is_active || ex.is_hidden}
                />
              ))}
              {hasMore && <div data-testid="selector-sentinel" style={{ height: 1 }} aria-hidden="true" />}
            </div>
          )}

          {hasMore && !("IntersectionObserver" in window) && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: SPACE.md }}>
              <button type="button" onClick={handleLoadMore} style={secondaryBtnStyle()}>Cargar más ejercicios</button>
            </div>
          )}

          {displayed.length === 0 && !catalogLoading && !catalogError && (
            <div role="status" aria-live="polite" style={{ padding: `${SPACE.section}px ${SPACE.md}px`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE.md }}>
              <div style={{ width: 56, height: 56, borderRadius: RADIUS.round, background: GLASS.fillSubtle, border: `1px solid ${GLASS.border}`, display: "grid", placeItems: "center", color: TEXT.tertiary }}><Search size={24} aria-hidden="true" /></div>
              <div>
                <p style={{ margin: 0, fontSize: TYPE.body.size, fontWeight: 600, color: TEXT.primary }}>
                  {localExercises.length === 0 ? "El catálogo está vacío." : query || selectedEquipmentCategory || selectedMuscles.length > 0 ? "No se encontraron coincidencias para la búsqueda." : "No se encontró ningún ejercicio con esos filtros."}
                </p>
                <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>Ajusta la búsqueda o limpia los filtros para ver más resultados.</p>
              </div>
              {activeFilterCount > 0 && <button type="button" onClick={handleClear} style={primaryBtnStyle()}>Limpiar filtros</button>}
            </div>
          )}
        </div>

        {mode === "multiple" && selectedIds.size > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: Z_INDEX.toast,
              pointerEvents: "auto",
              padding: `${SPACE.md}px ${SPACE.md}px ${SPACE.lg}px`,
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE.md,
              padding: SPACE.md,
              borderRadius: RADIUS.card,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(28,28,30,0.9)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.85)",
              maxWidth: "920px",
              margin: "0 auto",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(255,59,48,0.2)",
                  border: "1px solid rgba(255,59,48,0.4)",
                  color: ACCENT.base,
                  fontFamily: TYPE.mono.font,
                  fontSize: TYPE.caption.size,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {selectedIds.size}
                </div>
                <span style={{ fontSize: TYPE.subhead.size, fontWeight: 500, color: TEXT.primary }}>
                  {selectedIds.size === 1 ? "ejercicio seleccionado" : "ejercicios seleccionados"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  minHeight: 44,
                  padding: `0 ${SPACE.lg}px`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${ACCENT.base}`,
                  background: ACCENT.base,
                  color: TEXT.onAccent,
                  fontSize: TYPE.subhead.size,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 16px rgba(255,59,48,0.25)",
                }}
                aria-label="Añadir a rutina"
              >
                Añadir a rutina
              </button>
            </div>
          </div>
        )}

        {mode === "multiple" && selectedIds.size > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: Z_INDEX.toast - 1,
              pointerEvents: "none",
              padding: `${SPACE.md}px ${SPACE.md}px ${SPACE.lg}px`,
            }}
          >
            <div
              style={{
                position: "relative",
                height: 320,
                maxHeight: "40vh",
                borderRadius: `${RADIUS.card} ${RADIUS.card} 0 0`,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(9,9,11,0.95)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
                overflow: "hidden",
                maxWidth: "920px",
                margin: "0 auto",
              }}
            >
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: SPACE.xs,
                  padding: `${SPACE.xs}px ${SPACE.md}px`,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(9,9,11,0.9)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                }}>
                  {(["frontal", "posterior"] as const).map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setAnatomicalView(view)}
                      aria-pressed={anatomicalView === view}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: SPACE.xs,
                        minHeight: 32,
                        padding: `0 ${SPACE.md}px`,
                        borderRadius: RADIUS.pill,
                        border: "none",
                        background: anatomicalView === view ? "rgba(255,59,48,0.15)" : "transparent",
                        color: anatomicalView === view ? ACCENT.base : TEXT.secondary,
                        fontSize: TYPE.label.size,
                        fontWeight: anatomicalView === view ? 600 : 500,
                        letterSpacing: TYPE.label.tracking,
                        textTransform: "uppercase",
                        cursor: "pointer",
                        transition: "all 150ms ease",
                      }}
                    >
                      {view === "frontal" ? "Frontal" : "Posterior"}
                    </button>
                  ))}
                </div>
                <div style={{
                  flex: 1,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {anatomicalView === "frontal" ? (
                    <svg viewBox="0 0 200 320" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", maxWidth: "200px" }} aria-hidden="true">
                      <path d="M100 10 Q80 40 60 80 Q40 120 40 160 Q40 200 60 240 Q80 280 100 310 Q120 280 140 240 Q160 200 160 160 Q160 120 140 80 Q120 40 100 10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                      <circle cx="100" cy="60" r="20" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <circle cx="70" cy="100" r="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <circle cx="130" cy="100" r="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="100" cy="160" rx="30" ry="25" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="60" cy="220" rx="18" ry="22" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="140" cy="220" rx="18" ry="22" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="80" cy="280" rx="14" ry="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="120" cy="280" rx="14" ry="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 200 320" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", maxWidth: "200px" }} aria-hidden="true">
                      <path d="M100 10 Q80 40 60 80 Q40 120 40 160 Q40 200 60 240 Q80 280 100 310 Q120 280 140 240 Q160 200 160 160 Q160 120 140 80 Q120 40 100 10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                      <ellipse cx="100" cy="70" rx="25" ry="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="70" cy="130" rx="20" ry="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="130" cy="130" rx="20" ry="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="100" cy="190" rx="28" ry="22" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="60" cy="250" rx="18" ry="22" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="140" cy="250" rx="18" ry="22" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="80" cy="300" rx="14" ry="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                      <ellipse cx="120" cy="300" rx="14" ry="18" fill="rgba(255,59,48,0.1)" stroke="rgba(255,59,48,0.3)" strokeWidth="1"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface SelectorCardProps {
  exercise: Exercise;
  order: number | null;
  selected: boolean;
  multiSelect: boolean;
  expanded: boolean;
  alreadyInDay: boolean;
  onSelect: (exercise: Exercise) => void;
  onTogglePreview: (id: string) => void;
  onRename?: (id: string, name: string, nameEs: string | null) => void;
  onHide?: (id: string) => void;
  hidden?: boolean;
}

function SelectorCard({ exercise, order, selected, multiSelect, expanded, alreadyInDay, onSelect, onTogglePreview }: SelectorCardProps) {
  const media = useMemo(() => resolveMedia("exercise-gif", exercise.id, exercise.gif_url), [exercise.id, exercise.gif_url]);
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  const [previewFailed, setPreviewFailed] = useState(false);
  const displayName = useMemo(() => getExerciseDisplayName(exercise), [exercise]);
  const primaryMuscle = exercise.body_part || "—";
  const equipment = exercise.equipment || "—";
  const active = selected && !alreadyInDay;
  const reducedMotion = useReducedMotion();

  const muscleLabel = primaryMuscle.toUpperCase();
  const equipmentLabel = equipment.toUpperCase();

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!alreadyInDay && !reducedMotion) e.currentTarget.style.transform = "scale(0.99)";
  }, [alreadyInDay, reducedMotion]);
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!alreadyInDay) e.currentTarget.style.transform = "scale(1)";
  }, [alreadyInDay]);
  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!alreadyInDay) e.currentTarget.style.transform = "scale(1)";
  }, [alreadyInDay]);

  return (
    <div style={{
      borderRadius: RADIUS.surface,
      border: `1px solid ${active ? ACCENT.base : "rgba(255,255,255,0.08)"}`,
      background: "#1C1C1E",
      overflow: "hidden",
      boxShadow: active ? "0 0 0 1px rgba(255,59,48,0.4)" : "none",
    }}>
      <div
        role="option"
        aria-pressed={active || undefined}
        aria-label={displayName}
        tabIndex={0}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: SPACE.md, cursor: "pointer", minHeight: 84, transition: "transform 150ms ease" }}
        onClick={() => { if (!alreadyInDay) onSelect(exercise); }}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !alreadyInDay) { e.preventDefault(); onSelect(exercise); } }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          aria-label={`Vista previa de ${displayName}`}
          onClick={(e) => { e.stopPropagation(); onTogglePreview(exercise.id); }}
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: RADIUS.control,
            overflow: "hidden",
            border: `1px solid ${GLASS.border}`,
            background: SURFACE.sunken,
            padding: 0,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            color: TEXT.tertiary,
          }}
        >
          {failed || previewFailed ? <Dumbbell size={20} aria-hidden="true" /> : <img src={src} alt="" width={48} height={48} decoding="async" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onLoad={onLoad} onError={() => { setPreviewFailed(true); onError(); }} />}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
          <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary, display: "flex", alignItems: "center", gap: SPACE.xs, minWidth: 0 }}>
            <span style={{ fontFamily: TYPE.mono.font, fontSize: TYPE.caption.size, fontWeight: 600, textTransform: "uppercase", letterSpacing: TYPE.label.tracking }}>{muscleLabel} · {equipmentLabel}</span>
          </p>
        </div>
        {alreadyInDay ? (
          <span style={{ padding: `4px ${SPACE.sm}px`, borderRadius: RADIUS.pill, border: `1px solid ${GLASS.border}`, color: TEXT.tertiary, fontSize: TYPE.caption.size, fontWeight: 600, flexShrink: 0 }}>Ya en día</span>
        ) : multiSelect ? (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `2px solid ${active ? ACCENT.base : "rgba(255,255,255,0.2)"}`,
              background: active ? ACCENT.base : "transparent",
              color: active ? TEXT.onAccent : "transparent",
              display: "grid",
              placeItems: "center",
              fontFamily: TYPE.mono.font,
              fontSize: TYPE.caption.size,
              fontWeight: 700,
              flexShrink: 0,
              transition: "all 150ms ease",
            }}
            aria-hidden="true"
          >
            {active && order !== null ? order : <Check size={14} aria-hidden="true" />}
          </div>
        ) : (
          <span style={{ width: 32, height: 32, borderRadius: RADIUS.round, border: `1px solid ${GLASS.border}`, display: "grid", placeItems: "center", color: TEXT.tertiary, flexShrink: 0 }} aria-hidden="true"><Check size={14} /></span>
        )}
      </div>
      {expanded && (
        <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: SPACE.md, padding: `0 ${SPACE.md}px ${SPACE.md}px`, borderTop: `1px solid ${GLASS.border}` }}>
          <div style={{ width: 88, height: 88, borderRadius: RADIUS.control, overflow: "hidden", background: SURFACE.sunken, marginTop: SPACE.sm, display: "grid", placeItems: "center", color: TEXT.tertiary, position: "relative" }}>
            {previewFailed ? <Dumbbell size={24} aria-hidden="true" /> : <img src={src} alt="" width={88} height={88} decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setPreviewFailed(true)} />}
            <button type="button" onClick={(e) => { e.stopPropagation(); onTogglePreview(exercise.id); }} aria-label="Cerrar vista previa" style={{ position: "absolute", right: 4, bottom: 4, width: 24, height: 24, borderRadius: RADIUS.round, border: "none", background: "rgba(0,0,0,0.65)", color: TEXT.primary, display: "grid", placeItems: "center", cursor: "pointer" }}><Minus size={12} aria-hidden="true" /></button>
          </div>
          <div style={{ minWidth: 0, paddingTop: SPACE.sm }}>
            <p style={{ margin: 0, fontSize: TYPE.caption.size, fontWeight: 600, color: TEXT.secondary, textTransform: "uppercase", letterSpacing: TYPE.label.tracking }}>Detalle</p>
            <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.subhead.size, color: TEXT.primary }}>{primaryMuscle}</p>
            <p style={{ margin: `2px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{equipment}</p>
            {exercise.instructions && exercise.instructions.length > 0 && (
              <div style={{ marginTop: SPACE.sm, display: "flex", flexDirection: "column", gap: 2 }}>
                {exercise.instructions.slice(0, 2).map((step, i) => <p key={i} style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {step}</p>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button type="button" onClick={onRemove} style={{ display: "inline-flex", alignItems: "center", gap: SPACE.xs, minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.sm}px`, borderRadius: RADIUS.pill, border: `1px solid ${ACCENT.border}`, background: ACCENT.subtle, color: TEXT.primary, fontSize: TYPE.caption.size, cursor: "pointer" }}>{label}<X size={12} aria-hidden="true" /></button>;
}
function StateBlock({ text, tone }: { text: string; tone?: "error" }) {
  return <div role={tone === "error" ? "alert" : undefined} style={{ padding: SPACE.section, textAlign: "center", color: tone === "error" ? DANGER.base : TEXT.tertiary, fontSize: TYPE.subhead.size }}>{text}</div>;
}
function primaryBtnStyle(): CSSProperties { return { minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.lg}px`, borderRadius: RADIUS.control, border: `1px solid ${ACCENT.base}`, background: ACCENT.base, color: TEXT.onAccent, fontSize: TYPE.subhead.size, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }; }
function secondaryBtnStyle(): CSSProperties { return { minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.md}px`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.borderStrong}`, background: "transparent", color: TEXT.secondary, fontSize: TYPE.subhead.size, fontWeight: 600, cursor: "pointer" }; }