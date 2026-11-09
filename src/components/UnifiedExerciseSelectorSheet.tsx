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
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { translateEquipment } from "@/lib/i18n";
import { MY_GYM_EQUIPMENT_TAGS } from "@/data/myGymEquipment";
import { resolveAvailability } from "@/lib/equipment/availability";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { supabase } from "@lib/supabase";
import { ACCENT, DANGER, GLASS, MOTION, RADIUS, SCRIM, SOLID, SPACE, SURFACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { MuscleSelector } from "./MuscleSelector";
import { filterByMuscles, muscleCounts, selectionLabels } from "@/lib/muscleFilter";
import { enabledSlugs as getEnabledSlugs } from "@/lib/muscleMap";

const PAGE_SIZE = 12;
const MY_GYM_SCOPE = { tags: MY_GYM_EQUIPMENT_TAGS, complete: false };
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
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [onlyMyGym, setOnlyMyGym] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<Slug[]>([]);
  const [isAnatomicalOpen, setIsAnatomicalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localExercises, setLocalExercises] = useState<Exercise[]>([]);
  const [opError, setOpError] = useState<string | null>(null);
  const [previouslyFocused, setPreviouslyFocused] = useState<HTMLElement | null>(null);
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
    if (!q && !selectedEquipment && !onlyMyGym && selectedMuscles.length === 0) return baseRows;
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
      if (selectedEquipment && normaliseExerciseName(ex.equipment) !== normaliseExerciseName(selectedEquipment)) return false;
      if (onlyMyGym) {
        const availability = resolveAvailability(ex.equipment, MY_GYM_SCOPE);
        if (availability !== "available") return false;
      }
      return true;
    });
    if (selectedMuscles.length === 0) return attributeFiltered;
    return filterByMuscles(attributeFiltered, selectedMuscles).results;
  }, [baseRows, debouncedQuery, selectedEquipment, onlyMyGym, selectedMuscles, ensureIndex]);

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
  }, [query, tab, selectedEquipment, onlyMyGym, selectedMuscles]);

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
    setQuery(""); setTab("all"); setSelectedEquipment(null); setOnlyMyGym(false); setSelectedMuscles([]); setPage(1);
  }, []);
  const handleMuscleSelectorChange = useCallback((next: Slug[]) => setSelectedMuscles(next), []);
  const handleClearMuscles = useCallback(() => setSelectedMuscles([]), []);
  const handleToggleAnatomical = useCallback(() => setIsAnatomicalOpen((prev) => !prev), []);

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

  const activeFilterCount = (selectedEquipment ? 1 : 0) + (onlyMyGym ? 1 : 0) + (query.length > 0 ? 1 : 0) + (selectedMuscles.length > 0 ? 1 : 0);
  const muscleCountsBySlug = useMemo(() => muscleCounts(baseRows, ENABLED_MUSCLE_SLUGS), [baseRows]);
  const muscleSelectionLabels = selectionLabels(selectedMuscles);

  const equipmentChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: { key: string; label: string; active: boolean; onToggle: (k: string) => void }[] = [];
    for (const ex of baseRows) {
      const key = normaliseExerciseName(ex.equipment);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      chips.push({
        key, label: translateEquipment(ex.equipment), active: selectedEquipment === key,
        onToggle: (k) => { setSelectedEquipment(k === key ? null : k); setPage(1); },
      });
    }
    return chips;
  }, [baseRows, selectedEquipment]);

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
          maxHeight: isMobile ? "94dvh" : "86dvh",
          borderRadius: isMobile ? RADIUS.sheet : RADIUS.modal,
          border: `1px solid ${GLASS.border}`,
          background: `linear-gradient(180deg, ${SURFACE.raised} 0%, ${SOLID.popover} 100%)`,
          boxShadow: GLASS.shadow,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header style={{ padding: `${SPACE.md}px ${SPACE.lg}px ${SPACE.sm}px`, borderBottom: `1px solid ${GLASS.border}`, background: GLASS.fillSubtle }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE.md }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, letterSpacing: TYPE.label.tracking, textTransform: "uppercase", color: ACCENT.text }}>Cronos Performance</p>
              <h2 style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, lineHeight: TYPE.title2.lineHeight, color: TEXT.primary }}>{title}</h2>
              <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                {filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""}{dayContext?.dayLabel ? ` · ${dayContext.dayLabel}` : ""}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" style={iconBtnStyle()}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {dayContext && dayMuscleSlugs.size > 0 && (
            <div style={{ marginTop: SPACE.sm, display: "flex", alignItems: "center", gap: SPACE.xs, flexWrap: "wrap" }}>
              <span style={{ fontSize: TYPE.caption.size, fontWeight: 600, color: TEXT.secondary }}>Balance</span>
              {[...dayMuscleSlugs].map((slug) => (
                <span key={slug} style={{ padding: `2px ${SPACE.sm}px`, borderRadius: RADIUS.pill, border: `1px solid ${ACCENT.border}`, background: ACCENT.subtle, color: TEXT.primary, fontSize: TYPE.caption.size }}>{slug}</span>
              ))}
            </div>
          )}
        </header>

        <div ref={scrollContainer} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: `${SPACE.md}px ${SPACE.lg}px ${mode === "multiple" && selectedIds.size > 0 ? "96px" : SPACE.lg}px` }}>
          <div style={{ position: "sticky", top: 0, zIndex: 1, paddingBottom: SPACE.sm, background: `linear-gradient(180deg, ${SOLID.popover} 70%, transparent 100%)` }}>
            <div style={{ position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: SPACE.md, top: "50%", transform: "translateY(-50%)", color: TEXT.tertiary, pointerEvents: "none" }} aria-hidden="true" />
              <input
                data-testid="selector-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
                placeholder="Buscar por nombre, músculo o equipo…"
                style={{ width: "100%", minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.xl}px 0 44px`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.borderStrong}`, background: SURFACE.sunken, color: TEXT.primary, fontSize: TYPE.body.size, fontFamily: "inherit", outline: "none" }}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda" style={{ ...iconBtnStyle(), position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent" }}>
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: SPACE.xs, marginBottom: SPACE.md, padding: 2, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: GLASS.fillSubtle }}>
            {(["all", "frequent"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} style={{ flex: 1, minHeight: MOTION.minTouchTarget, borderRadius: RADIUS.control, border: "none", background: tab === t ? ACCENT.subtle : "transparent", color: tab === t ? TEXT.primary : TEXT.secondary, fontSize: TYPE.subhead.size, fontWeight: tab === t ? 600 : 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: SPACE.xs }}>
                {t === "frequent" && <Sparkles size={14} aria-hidden="true" />}
                {t === "all" ? "Todos" : `Frecuentes (${frequentIds.length})`}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: SPACE.md }}>
            <button type="button" onClick={handleToggleAnatomical} aria-expanded={isAnatomicalOpen} aria-controls="anatomical-accordion" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm, minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.md}px`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: isAnatomicalOpen ? ACCENT.subtle : GLASS.fillSubtle, color: TEXT.secondary, fontSize: TYPE.subhead.size, cursor: "pointer" }}>
              <span style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}><Activity size={16} aria-hidden="true" />Categorías musculares{selectedMuscles.length > 0 && <span style={{ marginLeft: SPACE.xs, padding: `0 ${SPACE.xs}px`, borderRadius: RADIUS.pill, background: ACCENT.base, color: TEXT.onAccent, fontSize: TYPE.caption.size }}>{selectedMuscles.length}</span>}</span>
              <ChevronDown size={16} aria-hidden="true" style={{ transform: isAnatomicalOpen ? "rotate(180deg)" : "rotate(0deg)", transition: reducedMotion ? "none" : `transform ${MOTION.fast} ${MOTION.easeOut}` }} />
            </button>
            {isAnatomicalOpen && (
              <div id="anatomical-accordion" style={{ marginTop: SPACE.sm, maxHeight: isMobile ? "50dvh" : "none", overflowY: "auto" }}>
                <MuscleSelector selected={selectedMuscles} onChange={handleMuscleSelectorChange} counts={muscleCountsBySlug} legendLabel="Músculos del catálogo" className="" />
              </div>
            )}
          </div>

          <div style={{ marginBottom: SPACE.md }}>
            <p style={groupLabelStyle()}>Filtros</p>
            <div style={{ display: "flex", gap: SPACE.xs, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
              <Chip active={onlyMyGym} label="Mi gimnasio" onClick={() => { setOnlyMyGym((v) => !v); setPage(1); }} />
              {equipmentChips.map((chip) => <Chip key={chip.key} active={chip.active} label={chip.label} onClick={() => chip.onToggle(chip.key)} />)}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div style={{ marginBottom: SPACE.md, display: "flex", alignItems: "center", gap: SPACE.xs, flexWrap: "wrap" }}>
              {selectedEquipment && <RemovableChip label={translateEquipment(selectedEquipment)} onRemove={() => setSelectedEquipment(null)} />}
              {onlyMyGym && <RemovableChip label="Mi gimnasio" onRemove={() => setOnlyMyGym(false)} />}
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
                  {localExercises.length === 0 ? "El catálogo está vacío." : query || selectedEquipment || selectedMuscles.length > 0 ? "No se encontraron coincidencias para la búsqueda." : onlyMyGym ? "No hay ejercicios con disponibilidad confirmada para Mi Gym." : "No se encontró ningún ejercicio con esos filtros."}
                </p>
                <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>Ajusta la búsqueda o limpia los filtros para ver más resultados.</p>
              </div>
              {activeFilterCount > 0 && <button type="button" onClick={handleClear} style={primaryBtnStyle()}>Limpiar filtros</button>}
            </div>
          )}
        </div>

        {mode === "multiple" && selectedIds.size > 0 && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.md, padding: `${SPACE.md}px ${SPACE.lg}px calc(${SPACE.md}px + env(safe-area-inset-bottom, 0px))`, borderTop: `1px solid ${GLASS.borderStrong}`, background: "rgba(10,10,12,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>{selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}</p>
              <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>Listos para añadir a la rutina</p>
            </div>
            <div style={{ display: "flex", gap: SPACE.sm }}>
              <button type="button" onClick={() => setSelectedIds(new Set())} style={secondaryBtnStyle()}>Limpiar</button>
              <button type="button" onClick={handleConfirm} style={primaryBtnStyle()}>{`Agregar ${selectedIds.size} ejercicio${selectedIds.size !== 1 ? "s" : ""}`}</button>
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

  return (
    <div style={{ borderRadius: RADIUS.surface, border: `1px solid ${active ? ACCENT.border : GLASS.border}`, background: active ? ACCENT.subtle : SURFACE_ROLE_CARD, overflow: "hidden" }}>
      <div
        role="option"
        aria-pressed={active || undefined}
        aria-label={displayName}
        tabIndex={0}
        style={{ display: "flex", alignItems: "center", gap: SPACE.md, padding: SPACE.md, cursor: "pointer", minHeight: 84 }}
        onClick={() => { if (!alreadyInDay) onSelect(exercise); }}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !alreadyInDay) { e.preventDefault(); onSelect(exercise); } }}
      >
        <button type="button" aria-label={`Vista previa de ${displayName}`} onClick={(e) => { e.stopPropagation(); onTogglePreview(exercise.id); }} style={{ width: 64, height: 64, flexShrink: 0, borderRadius: RADIUS.control, overflow: "hidden", border: `1px solid ${GLASS.border}`, background: SURFACE.sunken, padding: 0, cursor: "pointer", display: "grid", placeItems: "center", color: TEXT.tertiary }}>
          {failed || previewFailed ? <Dumbbell size={20} aria-hidden="true" /> : <img src={src} alt="" width={64} height={64} decoding="async" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onLoad={onLoad} onError={() => { setPreviewFailed(true); onError(); }} />}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
          <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.caption.size, color: TEXT.secondary, display: "flex", alignItems: "center", gap: SPACE.xs, minWidth: 0 }}>
            <Activity size={12} aria-hidden="true" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{primaryMuscle} · {equipment}</span>
          </p>
        </div>
        {alreadyInDay ? (
          <span style={{ padding: `4px ${SPACE.sm}px`, borderRadius: RADIUS.pill, border: `1px solid ${GLASS.border}`, color: TEXT.tertiary, fontSize: TYPE.caption.size, fontWeight: 600, flexShrink: 0 }}>Ya en día</span>
        ) : multiSelect ? (
          <span style={{ width: 32, height: 32, borderRadius: RADIUS.round, border: `2px solid ${active ? ACCENT.base : GLASS.borderStrong}`, background: active ? ACCENT.base : "transparent", color: active ? TEXT.onAccent : TEXT.secondary, display: "grid", placeItems: "center", fontSize: TYPE.caption.size, fontWeight: 700, flexShrink: 0 }}>
            {order !== null ? order : <Check size={14} aria-hidden="true" />}
          </span>
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

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} style={{ display: "inline-flex", alignItems: "center", minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.md}px`, borderRadius: RADIUS.pill, border: `1px solid ${active ? ACCENT.border : GLASS.border}`, background: active ? ACCENT.subtle : "transparent", color: active ? TEXT.primary : TEXT.secondary, fontSize: TYPE.caption.size, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
  );
}
function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button type="button" onClick={onRemove} style={{ display: "inline-flex", alignItems: "center", gap: SPACE.xs, minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.sm}px`, borderRadius: RADIUS.pill, border: `1px solid ${ACCENT.border}`, background: ACCENT.subtle, color: TEXT.primary, fontSize: TYPE.caption.size, cursor: "pointer" }}>{label}<X size={12} aria-hidden="true" /></button>;
}
function StateBlock({ text, tone }: { text: string; tone?: "error" }) {
  return <div role={tone === "error" ? "alert" : undefined} style={{ padding: SPACE.section, textAlign: "center", color: tone === "error" ? DANGER.base : TEXT.tertiary, fontSize: TYPE.subhead.size }}>{text}</div>;
}
function iconBtnStyle(): CSSProperties { return { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: MOTION.minTouchTarget, minHeight: MOTION.minTouchTarget, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: GLASS.fillSubtle, color: TEXT.secondary, cursor: "pointer", padding: 0 }; }
function primaryBtnStyle(): CSSProperties { return { minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.lg}px`, borderRadius: RADIUS.control, border: `1px solid ${ACCENT.base}`, background: ACCENT.base, color: TEXT.onAccent, fontSize: TYPE.subhead.size, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }; }
function secondaryBtnStyle(): CSSProperties { return { minHeight: MOTION.minTouchTarget, padding: `0 ${SPACE.md}px`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.borderStrong}`, background: "transparent", color: TEXT.secondary, fontSize: TYPE.subhead.size, fontWeight: 600, cursor: "pointer" }; }
function groupLabelStyle(): CSSProperties { return { margin: `0 0 ${SPACE.xs}px`, fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, letterSpacing: TYPE.label.tracking, textTransform: "uppercase", color: TEXT.tertiary }; }
const SURFACE_ROLE_CARD = "rgba(255,255,255,0.03)";
