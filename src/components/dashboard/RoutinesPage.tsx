/**
 * RoutinesPage.tsx — the athlete's routine library, redesigned in Pure Canvas
 * style (iOS-like blur, translucency, soft curves).
 *
 * Inline sub-components, token-only styling (inline CSSProperties, no hex/rgba
 * literals), Lucide icons at strokeWidth 1.5. Serves as a replacement for the
 * legacy RoutineBuilder: one page that lists, creates, edits, deletes, and
 * starts routines, with undo-first deletion and an iOS-style bottom sheet
 * for the editor.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
   Play,
  Plus,
  StarIcon,
  Pencil,
  Trash2,
  X,
  Clock,
  Dumbbell,
  RefreshCw,
  Sparkle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
   LayoutList,
   MoreHorizontal,
   Share2,
   Copy,
   Moon,
} from "lucide-react";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useNavigate } from "react-router-dom";
import { TRAIN_PATH } from "@/components/shell/navItems";
import { supabase } from "@lib/supabase";
import { ExerciseBrowser } from "@/components/ExerciseBrowser";
import { Skeleton } from "@/components/ui/Skeleton";
import { RoutineLibrary } from "@/components/dashboard/RoutineLibrary";
import { WeeklyPlanner } from "@/components/dashboard/WeeklyPlanner";
import { ExerciseSwapModal, SwapButton } from "@/components/dashboard/ExerciseSwapModal";
import { useGymSettings } from "@/context/GymSettingsContext";
import { MY_GYM_EQUIPMENT_TAGS } from "@/data/myGymEquipment";
import {
  ACCENT,
  COPPER,
  FONT_SANS,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  SOLID,
  STATUS,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { useRoutines, type RoutineWithExercises } from "@/hooks/useGymData";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { getWeekdayIndex, WEEKDAY_SHORT_ES, WEEKDAY_NAME_ES } from "@/lib/dashboard/heroCardModel";
import { saveRoutine, duplicateRoutine } from "@/lib/routines/routineSave";
import {
  draftProblem,
  emptyDraft,
  estimateRoutineDuration,
  getExerciseName,
  getRepLabel,
  isSavableDraft,
  type DraftExercise,
  type RoutineDraft,
} from "@/lib/routines/routineDraftModel";
import {
  formatShareText,
  sanitizeForShare,
  shareRoutineText,
  DUPLICATE_SUFFIX,
} from "@/lib/routines/routineShare";
import { computeWeeklyCoverage, type WeeklyCoverageSummary } from "@/lib/routines/weeklyCoverage";
import { SHEET_TOP_HIGHLIGHT } from "@/design/sheetGradients";
import type { Exercise } from "@/types/supabase";
import { type WeeklyAssignment } from "@/lib/routines/routinesViewModel";

export interface RoutinesPageProps {
  userId: string;
}

const LABELS = {
  pageTitle: "Rutinas",
  pageSubtitle: (n: number) =>
    n === 1 ? "1 rutina guardada" : `${n} rutinas guardadas`,
  newRoutine: "Nueva rutina",
  newShort: "Nueva",
  start: "Empezar",
  libraryAria: "Abrir biblioteca",
  edit: "Editar",
  deleteAria: "Eliminar rutina",
  favoriteAria: "Destacar rutina",
  namePlaceholder: "Nombre de la rutina",
  descPlaceholder: "Descripción (opcional)",
  addExercise: "Agregar ejercicio",
  exerciseCount: (n: number) =>
    n === 1 ? "1 ejercicio" : `${n} ejercicios`,
  emptyTitle: "Sin rutinas todavía",
  emptyBody: "Crea tu primera rutina para empezar a entrenar o explora nuestras plantillas.",
  templateAction: "Usar una plantilla",
   undo: "Deshacer",
   undoSwap: "Deshacer cambio",
   swappedExercise: "Ejercicio reemplazado",
   removedRoutine: "Rutina eliminada",
  retry: "Reintentar",
  saving: "Guardando…",
  saveRoutine: "Guardar rutina",
  cancel: "Cancelar",
  setsLabel: "Series",
  restLabel: "Descanso (s)",
  closeAria: "Cerrar",
  browseAria: "Buscar ejercicios",
  noTitleError: "Ponle un nombre a la rutina.",
  noExercisesError: "Agrega al menos un ejercicio.",
  saveError: "No se pudo guardar la rutina. Inténtalo de nuevo.",
  aiChip: "IA",
  coachChip: "Coach",
  browseEmpty: "Sin ejercicios todavía. Agrega desde el catálogo.",
  duplicate: "Duplicar",
  duplicateAria: "Duplicar rutina",
  share: "Compartir",
  shareAria: "Compartir rutina",
  menuAria: "Más opciones",
  copiedClipboard: "Copiado al portapapeles",
  sharedSuccessfully: "Rutina compartida",
  deloadToggle: "Modo Deload",
  deloadToggleAria: "Activar semana de descarga",
  deloadBadge: "SEMANA DE DESCARGA ACTIVA",
  lowVolumeBadge: "Volumen bajo",
  weeklyCoverageTitle: "Cobertura muscular semanal",
} as const;

const SURFACE_STYLE: CSSProperties = {
  backgroundColor: GLASS.fill,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

const SURFACE_RAISED: CSSProperties = {
  backgroundColor: GLASS.fillRaised,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

const OVERLAY_STYLE: CSSProperties = {
  backgroundColor: SCRIM.modal,
  backdropFilter: "blur(8px)",
};

function draftFromRoutine(routine: RoutineWithExercises): RoutineDraft {
  return {
    id: routine.id,
    title: routine.title,
    description: routine.description ?? "",
    dayIndex: routine.exercises[0]?.dayIndex ?? 0,
    dayLabel: routine.exercises[0]?.dayLabel ?? "",
    items: routine.exercises.map((pe, index) => ({
      exercise: pe.exercise,
      target_sets: pe.target_sets,
      rest_seconds: pe.rest_seconds,
      order_index: index,
      target_reps_min: null,
      target_reps_max: null,
    })),
  };
}

function applyAddExercise(prev: RoutineDraft, exercise: Exercise): RoutineDraft {
  if (prev.items.some((i) => i.exercise.id === exercise.id)) return prev;
  return {
    ...prev,
    items: [
      ...prev.items,
      {
        exercise,
        target_sets: 3,
        rest_seconds: 90,
        order_index: prev.items.length,
        target_reps_min: null,
        target_reps_max: null,
      },
    ],
  };
}

async function deleteRoutineAndRefresh(
  routine: RoutineWithExercises,
  userId: string,
  refresh: () => Promise<void>,
): Promise<void> {
  await supabase.from("routine_exercises").delete().eq("routine_id", routine.id);
  await supabase.from("routines").delete().eq("id", routine.id).eq("user_id", userId);
  void refresh();
}

async function restoreRoutine(
  routine: RoutineWithExercises,
  userId: string,
  refresh: () => Promise<void>,
): Promise<void> {
  try {
    const resolvedSource = routine.source === null ? "user" : routine.source;
    const { data, error: err } = await supabase
      .from("routines")
      .insert({
        id: routine.id,
        user_id: userId,
        title: routine.title,
        description: routine.description ?? null,
        source: resolvedSource,
      })
      .select("id")
      .single();
    if (err || !data) return;

    const rows = routine.exercises.map((pe, index) => ({
      routine_id: data.id,
      exercise_id: pe.exercise.id,
      target_sets: pe.target_sets,
      rest_seconds: pe.rest_seconds,
      order_index: index,
      day_index: pe.dayIndex ?? 0,
      day_label: pe.dayLabel ?? "",
      target_reps_min: null,
      target_reps_max: null,
    }));
    if (rows.length > 0) {
      await supabase.from("routine_exercises").insert(rows);
    }
    void refresh();
  } catch {
    void refresh();
  }
}

export function RoutinesPage({ userId }: RoutinesPageProps) {
  const { routines, loading, error, refresh, toggleFavorite, pendingIds } =
    useRoutines(userId);
  const { start } = useActiveSession();
  const navigate = useNavigate();
  const { exercises: catalogExercises } = useExerciseCatalog();

  const todayIdx = useMemo(() => getWeekdayIndex(Date.now()), []);

  const weeklyAssignments = useMemo<WeeklyAssignment[]>(
    () =>
      routines.map((r) => ({
        id: `${r.id}-${r.exercises[0]?.dayIndex ?? 0}`,
        routineId: r.id,
        dayIndex: r.exercises[0]?.dayIndex ?? 0,
        order: 0,
      })),
    [routines],
  );

  const handleWeeklyChange = useCallback(
    (_next: WeeklyAssignment[]) => {
      void refresh();
    },
    [refresh],
  );

   type SheetMode = "closed" | "new" | "edit" | "browse";
  const [sheet, setSheet] = useState<SheetMode>("closed");
  const [draft, setDraft] = useState<RoutineDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recentlyDeletedId, setRecentlyDeletedId] = useState<string | null>(null);
  const [deletedRoutine, setDeletedRoutine] = useState<RoutineWithExercises | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [swapItemIndex, setSwapItemIndex] = useState<number | null>(null);
  const [swappedExercise, setSwappedExercise] = useState<Exercise | null>(null);
  const [actionMenuTarget, setActionMenuTarget] = useState<{
    routine: RoutineWithExercises;
    anchorRect: DOMRect;
  } | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [deloadActive, setDeloadActive] = useState(false);

  const gym = useGymSettings();
  const availableEquipment = useMemo(
    () => (gym ? MY_GYM_EQUIPMENT_TAGS : undefined),
    [gym],
  );

  const closeSheet = useCallback(() => {
    setSheet("closed");
    setSaveError(null);
  }, []);

  const openNew = useCallback(() => {
    setDraft(emptyDraft());
    setSheet("new");
    setSaveError(null);
  }, []);

  const openEdit = useCallback((routine: RoutineWithExercises) => {
    setDraft(draftFromRoutine(routine));
    setSheet("edit");
    setSaveError(null);
  }, []);

  const openBrowse = useCallback(() => {
    setSheet("browse");
    setSaveError(null);
  }, []);

  const handleStart = useCallback(
    (routine: RoutineWithExercises) => {
      start({ id: routine.id, title: routine.title });
      navigate(TRAIN_PATH);
    },
    [start, navigate],
  );

  const handleDelete = useCallback(
    (routine: RoutineWithExercises) => {
      setRecentlyDeletedId(routine.id);
      setDeletedRoutine(routine);
      void deleteRoutineAndRefresh(routine, userId, refresh);
    },
    [userId, refresh],
  );

  const undoDelete = useCallback(() => {
    if (!deletedRoutine) return;
    void restoreRoutine(deletedRoutine, userId, refresh);
    setRecentlyDeletedId(null);
    setDeletedRoutine(null);
  }, [deletedRoutine, userId, refresh]);

  const patchDraft = useCallback((changes: Partial<RoutineDraft>) => {
    setDraft((prev) => ({ ...prev, ...changes }));
  }, []);

  const addExercise = useCallback((ex: Exercise) => {
    setDraft((prev) => applyAddExercise(prev, ex));
  }, []);

  const removeItem = useCallback((index: number) => {
    setDraft((prev) =>
      prev.items.length === 1
        ? { ...prev, items: [] }
        : {
            ...prev,
            items: prev.items
              .filter((_, i) => i !== index)
              .map((item, i) => ({ ...item, order_index: i })),
          },
    );
  }, []);

  const updateItem = useCallback((index: number, changes: Partial<DraftExercise>) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, ...changes } : item,
      ),
    }));
  }, []);

  const handleSwapItem = useCallback((index: number, replacement: Exercise) => {
    const prevItem = draft.items[index];
    if (!prevItem) return;
    setSwappedExercise(prevItem.exercise);
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, exercise: replacement } : item,
      ),
    }));
  }, [draft.items]);

  const undoSwap = useCallback(() => {
    if (swapItemIndex !== null && swappedExercise) {
      setDraft((prev) => ({
        ...prev,
        items: prev.items.map((item, i) =>
          i === swapItemIndex ? { ...item, exercise: swappedExercise } : item,
        ),
      }));
    }
    setSwappedExercise(null);
    setSwapItemIndex(null);
  }, [swapItemIndex, swappedExercise]);

  const handleDuplicate = useCallback(
    (routine: RoutineWithExercises) => {
      const duplicateRows = routine.exercises.map((pe, index) => ({
        exercise_id: pe.exercise.id,
        target_sets: pe.target_sets,
        rest_seconds: pe.rest_seconds,
        order_index: index,
        day_index: pe.dayIndex ?? 0,
        day_label: pe.dayLabel ?? "",
        target_reps_min: null,
        target_reps_max: null,
      }));
      void duplicateRoutine(userId, {
        id: routine.id,
        title: routine.title,
        description: routine.description,
        exercises: duplicateRows,
      });
      void refresh();
      setShareToast(`${routine.title}${DUPLICATE_SUFFIX}`);
    },
    [userId, refresh],
  );

  const handleShare = useCallback(
    async (routine: RoutineWithExercises) => {
      const shareable = sanitizeForShare({
        title: routine.title,
        description: routine.description,
        items: routine.exercises.map((pe) => ({
          exercise: pe.exercise,
          target_sets: pe.target_sets,
          rest_seconds: pe.rest_seconds,
          order_index: pe.dayIndex ?? 0,
          target_reps_min: null,
          target_reps_max: null,
        })),
      });
      const text = formatShareText(shareable);
      const usedNative = await shareRoutineText(routine.title, text);
      if (!usedNative) {
        setShareToast(LABELS.copiedClipboard);
      } else {
        setShareToast(LABELS.sharedSuccessfully);
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const problem = draftProblem(draft);
    if (problem) {
      setSaveError(
        problem === "noTitle" ? LABELS.noTitleError : LABELS.noExercisesError,
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    const ok = await saveRoutine(userId, draft);
    if (ok) {
      void refresh();
      closeSheet();
    } else {
      setSaveError(LABELS.saveError);
    }
    setSaving(false);
  }, [draft, userId, refresh, closeSheet]);

   useEffect(() => {
     if (recentlyDeletedId === null) return;
     const t = window.setTimeout(() => {
       setRecentlyDeletedId(null);
       setDeletedRoutine(null);
     }, 5000);
     return () => clearTimeout(t);
   }, [recentlyDeletedId]);

   useEffect(() => {
     if (swappedExercise === null) return;
     const t = window.setTimeout(() => {
       setSwappedExercise(null);
       setSwapItemIndex(null);
     }, 5000);
     return () => clearTimeout(t);
    }, [swappedExercise]);

    useEffect(() => {
      if (shareToast === null) return;
      const t = window.setTimeout(() => setShareToast(null), 3000);
      return () => clearTimeout(t);
    }, [shareToast]);

   const visibleRoutines = useMemo(
     () =>
       recentlyDeletedId === null
         ? routines
         : routines.filter((r) => r.id !== recentlyDeletedId),
     [routines, recentlyDeletedId],
   );

   const weeklyCoverage = useMemo(
     () => computeWeeklyCoverage(visibleRoutines, weeklyAssignments, deloadActive),
     [visibleRoutines, weeklyAssignments, deloadActive],
   );

  return (
    <>
      <div
        style={{
          position: "relative",
          minHeight: "calc(100vh - 48px)",
          padding: `${SPACE.xl} ${SPACE.gutter}`,
        }}
      >
        <PageHeader routineCount={visibleRoutines.length} loading={loading} onNew={openNew} onLibrary={() => setShowLibrary(true)} />

        {error && (
          <div
            style={{
              ...SURFACE_STYLE,
              borderRadius: RADIUS.surface,
              marginTop: SPACE.md,
              padding: SPACE.card,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: SPACE.sm }}>
              <AlertCircle
                style={{ width: 16, height: 16, color: ACCENT.secondary, flexShrink: 0, marginTop: 2 }}
              />
              <span style={{ fontSize: TYPE.body.size, color: TEXT.secondary, flex: 1 }}>{error}</span>
              <button
                type="button"
                onClick={() => void refresh()}
                aria-label={LABELS.retry}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: SPACE.xs,
                  fontFamily: FONT_SANS,
                  fontSize: TYPE.subhead.size,
                  fontWeight: TYPE.subhead.weight,
                  color: ACCENT.text,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <RefreshCw style={{ width: 14, height: 14 }} strokeWidth={1.5} /> {LABELS.retry}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <RoutineListSkeleton />
        ) : visibleRoutines.length === 0 ? (
          <>
            <WeeklyStrip deloadActive={deloadActive} />
            {error == null && (
              <EmptyState onNew={openNew} onTemplate={openBrowse} />
            )}
          </>
        ) : (
          <>
            <WeeklyVolumeCoverage
              coverage={weeklyCoverage}
              deloadActive={deloadActive}
              onToggleDeload={() => setDeloadActive((d) => !d)}
            />

            <WeeklyPlanner
              routines={routines.map((r) => ({
                routineId: r.id,
                title: r.title,
              }))}
              initialAssignments={weeklyAssignments}
              onChange={handleWeeklyChange}
              todayIndex={todayIdx}
              deloadActive={deloadActive}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACE.md,
                marginTop: SPACE.md,
              }}
            >
              {visibleRoutines.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  onStart={() => handleStart(routine)}
                  onEdit={() => openEdit(routine)}
                  onDelete={() => handleDelete(routine)}
                  onOpenActionMenu={(e) =>
                    setActionMenuTarget({ routine, anchorRect: (e.currentTarget as HTMLElement).getBoundingClientRect() })
                  }
                  onToggleFavorite={() => void toggleFavorite(routine.id)}
                  isFavoritePending={pendingIds.has(routine.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {sheet !== "closed" && sheet !== "browse" && (
        <Sheet
          mode={sheet === "new" ? "new" : "edit"}
          draft={draft}
          saving={saving}
          error={saveError}
          onPatch={patchDraft}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onBrowse={openBrowse}
          onOpenSwap={setSwapItemIndex}
          onSave={handleSave}
          onClose={closeSheet}
        />
      )}

      {sheet === "browse" && (
        <ExerciseBrowser
          onAdd={(exercises) => {
            exercises.forEach((ex) => addExercise(ex));
            setSheet("edit");
          }}
          onClose={() => setSheet("closed")}
          isAdded={(id) => draft.items.some((i) => i.exercise.id === id)}
        />
      )}

      {swapItemIndex !== null && draft.items[swapItemIndex] && (
        <ExerciseSwapModal
          isOpen={true}
          source={draft.items[swapItemIndex]}
          allExercises={catalogExercises}
          availableEquipment={availableEquipment}
          onReplace={(replacement) => {
            handleSwapItem(swapItemIndex, replacement);
            setSwapItemIndex(null);
          }}
          onDismiss={() => setSwapItemIndex(null)}
        />
      )}

      {recentlyDeletedId !== null && deletedRoutine !== null && (
        <UndoToast
          message={LABELS.removedRoutine}
          onUndo={undoDelete}
          onDismiss={() => {
            setRecentlyDeletedId(null);
            setDeletedRoutine(null);
          }}
        />
      )}

      {showLibrary && (
        <RoutineLibrary
          userId={userId}
          routines={visibleRoutines}
          loading={loading}
          error={error}
          refresh={refresh}
          onStart={handleStart}
          onEdit={openEdit}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {swappedExercise !== null && swapItemIndex !== null && sheet !== "closed" && draft.items[swapItemIndex] && (
        <UndoToast
          message={LABELS.swappedExercise}
          onUndo={undoSwap}
          onDismiss={() => {
            setSwappedExercise(null);
            setSwapItemIndex(null);
          }}
        />
      )}

      {shareToast !== null && (
        <UndoToast
          message={shareToast}
          onUndo={() => {}}
          onDismiss={() => setShareToast(null)}
        />
      )}

      {actionMenuTarget !== null && (
        <ActionMenu
          anchorRect={actionMenuTarget.anchorRect}
          onDuplicate={() => handleDuplicate(actionMenuTarget.routine)}
           onShare={() => void handleShare(actionMenuTarget.routine)}
          onClose={() => setActionMenuTarget(null)}
        />
      )}
    </>
  );
}

function PageHeader({ routineCount, loading, onNew, onLibrary }: {
  routineCount: number;
  loading: boolean;
  onNew: () => void;
  onLibrary: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
      <div>
        <h1
          style={{
            fontSize: TYPE.hero.size,
            fontWeight: TYPE.hero.weight,
            lineHeight: TYPE.hero.lineHeight,
            letterSpacing: TYPE.hero.tracking,
            margin: 0,
            color: TEXT.primary,
          }}
        >
          {LABELS.pageTitle}
        </h1>
        <p
          style={{
            fontSize: TYPE.caption.size,
            lineHeight: TYPE.caption.lineHeight,
            color: TEXT.secondary,
            marginTop: SPACE.xs,
          }}
        >
          {loading ? "Cargando…" : LABELS.pageSubtitle(routineCount)}
        </p>
      </div>
      <button
        type="button"
        onClick={onLibrary}
        aria-label={LABELS.libraryAria}
        title="Biblioteca"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: RADIUS.round,
          background: GLASS.fill,
          border: `1px solid ${GLASS.border}`,
          color: TEXT.secondary,
          cursor: "pointer",
        }}
      >
        <LayoutList style={{ width: 18, height: 18 }} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onNew}
        aria-label={LABELS.newRoutine}
        style={{
          ...glassButtonStyle,
          minWidth: "88px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget.style as any).background = GLASS.fillRaised;
          (e.currentTarget.style as any).borderColor = GLASS.borderStrong;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.style as any).background = GLASS.fill;
          (e.currentTarget.style as any).borderColor = GLASS.border;
        }}
      >
        <Plus style={{ width: 14, height: 14 }} strokeWidth={1.5} />
        {LABELS.newShort}
      </button>
    </div>
  );
}

const glassButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: SPACE.xs,
  padding: `${SPACE.sm} ${SPACE.md}`,
  borderRadius: RADIUS.control,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  color: TEXT.secondary,
  fontFamily: FONT_SANS,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.subhead.weight,
  cursor: "pointer",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
  transition: `background-color ${MOTION.fast} ${MOTION.standard}`,
};

function WeeklyStrip({ deloadActive }: { deloadActive: boolean }) {
  const days = useMemo(() => {
    const todayIdx = getWeekdayIndex(Date.now());
    return WEEKDAY_SHORT_ES.map((short, i) => ({
      short,
      full: WEEKDAY_NAME_ES[i],
      isToday: i === todayIdx,
      isSaturday: WEEKDAY_NAME_ES[i] === "Sábado",
    }));
  }, []);

  return (
    <div style={{ marginTop: SPACE.md }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: SPACE.sm,
          justifyContent: "space-between",
        }}
      >
        {days.map((day) => {
          const bg = day.isToday ? ACCENT.base : GLASS.fill;
          const border = day.isToday ? ACCENT.border : GLASS.border;
          const color = day.isToday ? TEXT.onAccent : TEXT.tertiary;
          const halo = day.isToday
            ? ACCENT.ring
            : day.isSaturday
              ? `0 0 0 3px ${ACCENT.glow}`
              : "none";

          return (
            <div
              key={day.full}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: SPACE.xs,
              }}
            >
              <span
                title={day.full}
                style={{
                  width: MOTION.minTouchTarget,
                  height: MOTION.minTouchTarget,
                  borderRadius: RADIUS.round,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: TYPE.caption.size,
                  fontWeight: day.isToday ? TYPE.caption.weight : undefined,
                  letterSpacing: "0.02em",
                  color,
                  background: bg,
                  border: `1px solid ${border}`,
                  boxShadow: halo,
                }}
              >
                {day.short}
              </span>
              {day.isToday && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: RADIUS.round,
                    background: ACCENT.base,
                  }}
                />
              )}
              {deloadActive && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: RADIUS.round,
                    background: STATUS.warning.base,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyVolumeCoverage({
  coverage,
  deloadActive,
  onToggleDeload,
}: {
  coverage: WeeklyCoverageSummary;
  deloadActive: boolean;
  onToggleDeload: () => void;
}) {
  const hasAssignments = coverage.activeRoutineIds.size > 0;

  return (
    <div
      style={{
        ...SURFACE_STYLE,
        borderRadius: RADIUS.surface,
        padding: SPACE.card,
        marginTop: SPACE.md,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE.sm,
          marginBottom: SPACE.sm,
        }}
      >
        <h3 style={{ ...TYPE.subhead, color: TEXT.primary, margin: 0 }}>{LABELS.weeklyCoverageTitle}</h3>
        {!deloadActive && hasAssignments && (
          <button
            type="button"
            onClick={onToggleDeload}
            aria-label={LABELS.deloadToggleAria}
            title={LABELS.deloadToggleAria}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: SPACE.xs,
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.chip,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.card,
              color: TEXT.secondary,
              fontFamily: FONT_SANS,
              fontSize: TYPE.caption.size,
              cursor: "pointer",
              transition: `background-color ${MOTION.fast} ${MOTION.standard}`,
            }}
          >
            <Moon style={{ width: 12, height: 12 }} strokeWidth={1.5} />
            {LABELS.deloadToggle}
          </button>
        )}
        {deloadActive && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              color: ACCENT.text,
              background: ACCENT.subtle,
              borderRadius: RADIUS.chip,
              padding: "2px 8px",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: RADIUS.round,
                background: ACCENT.base,
              }}
            />
            {LABELS.deloadBadge}
          </span>
        )}
      </div>

      {!hasAssignments ? (
        <p style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, margin: 0 }}>
          Asigna rutinas a la semana para ver la cobertura muscular.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.xs,
          }}
        >
          {coverage.muscles.map((m) => (
            <div
              key={m.slug}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: SPACE.sm,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE.xs,
                  flex: 1,
                }}
              >
                <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>{m.label}</span>
                {m.lowVolume && (
                  <span
                    style={{
                      fontSize: TYPE.caption.size,
                      fontWeight: TYPE.caption.weight,
                      color: ACCENT.text,
                      background: ACCENT.subtle,
                      borderRadius: RADIUS.chip,
                      padding: "2px 6px",
                    }}
                  >
                    {LABELS.lowVolumeBadge}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.secondary,
                  fontFamily: FONT_SANS,
                  minWidth: 60,
                  textAlign: "right",
                }}
              >
                {m.displayedSets} series{m.displayedSets !== m.rawSets && deloadActive && ` (orig: ${m.rawSets})`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutineListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, marginTop: SPACE.md }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ ...SURFACE_STYLE, borderRadius: RADIUS.surface, padding: SPACE.card, height: 120 }}>
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onNew, onTemplate }: { onNew: () => void; onTemplate: () => void }) {
  return (
    <div
      style={{
        ...SURFACE_RAISED,
        borderRadius: RADIUS.card,
        padding: SPACE.card,
        marginTop: SPACE.md,
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: SPACE.md,
        }}
      >
        <Dumbbell
          style={{ width: 48, height: 48, color: TEXT.tertiary, margin: "0 auto" }}
          strokeWidth={1.5}
        />
        <h3
          style={{
            ...TYPE.title2,
            color: TEXT.primary,
            margin: 0,
          }}
        >
          {LABELS.emptyTitle}
        </h3>
        <p
          style={{
            fontSize: TYPE.body.size,
            lineHeight: TYPE.body.lineHeight,
            color: TEXT.secondary,
            maxWidth: "480px",
            margin: 0,
          }}
        >
          {LABELS.emptyBody}
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
            width: "100%",
            maxWidth: "280px",
            marginTop: SPACE.sm,
          }}
        >
          <button
            type="button"
            onClick={onNew}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.xs,
              width: "100%",
              minHeight: "48px",
              padding: `${SPACE.sm} ${SPACE.lg}`,
              borderRadius: RADIUS.control,
              backgroundColor: ACCENT.base,
              color: TEXT.onAccent,
              fontFamily: FONT_SANS,
              fontSize: TYPE.subhead.size,
              fontWeight: TYPE.subhead.weight,
              border: "none",
              cursor: "pointer",
              boxShadow: ACCENT.ring,
              transition: `background-color ${MOTION.fast} ${MOTION.standard}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget.style as any).backgroundColor = ACCENT.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style as any).backgroundColor = ACCENT.base;
            }}
          >
            <Plus style={{ width: 16, height: 16 }} strokeWidth={1.5} />
            {LABELS.newRoutine}
          </button>
          <button
            type="button"
            onClick={onTemplate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.xs,
              width: "100%",
              minHeight: "48px",
              padding: `${SPACE.sm} ${SPACE.lg}`,
              borderRadius: RADIUS.control,
              ...glassButtonStyle,
            }}
          >
            <Sparkle style={{ width: 16, height: 16 }} strokeWidth={1.5} />
            {LABELS.templateAction}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoutineCard({
  routine, onStart, onEdit, onDelete, onOpenActionMenu, onToggleFavorite, isFavoritePending,
}: {
  routine: RoutineWithExercises;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenActionMenu: (e: { currentTarget: HTMLElement }) => void;
  onToggleFavorite: () => void;
  isFavoritePending: boolean;
}) {
  const duration = estimateRoutineDuration(draftFromRoutine(routine));
  const isAi = routine.source === "ai";
  const isCoach = routine.source === "human_coach";

  return (
    <div
      style={{
        ...SURFACE_STYLE,
        borderRadius: RADIUS.surface,
        padding: SPACE.card,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: SHEET_TOP_HIGHLIGHT,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE.sm }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontSize: TYPE.title2.size,
                fontWeight: TYPE.title2.weight,
                lineHeight: TYPE.title2.lineHeight,
                margin: 0,
                color: TEXT.primary,
              }}
            >
              {routine.title}
            </h3>
            {routine.description && (
              <p style={{ fontSize: TYPE.body.size, color: TEXT.secondary, marginTop: SPACE.xs }}>
                {routine.description}
              </p>
            )}
          </div>
          {(isAi || isCoach) && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: TYPE.caption.size,
                fontWeight: TYPE.caption.weight,
                color: isAi ? ACCENT.text : COPPER.text,
                background: isAi ? ACCENT.subtle : COPPER.muted,
                borderRadius: RADIUS.chip,
                padding: "2px 8px",
                flexShrink: 0,
              }}
            >
              {isAi && <Sparkle style={{ width: 10, height: 10 }} />}
              {isAi ? LABELS.aiChip : LABELS.coachChip}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACE.sm,
            fontSize: TYPE.caption.size,
            color: TEXT.secondary,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Dumbbell style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            {LABELS.exerciseCount(routine.exercises.length)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Clock style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            {duration} min
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm, marginTop: SPACE.sm }}>
          <button
            type="button"
            onClick={onStart}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.xs,
              padding: `${SPACE.sm} ${SPACE.lg}`,
              borderRadius: RADIUS.control,
              backgroundColor: ACCENT.base,
              color: TEXT.onAccent,
              fontFamily: FONT_SANS,
              fontSize: TYPE.subhead.size,
              fontWeight: TYPE.subhead.weight,
              border: "none",
              cursor: "pointer",
            }}
          >
            <Play style={{ width: 16, height: 16 }} strokeWidth={1.5} /> {LABELS.start}
          </button>

          <div style={{ display: "inline-flex", gap: SPACE.xs }}>
            <button
              type="button"
              onClick={onEdit}
              aria-label={LABELS.edit}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`, background: SOLID.card,
                color: TEXT.secondary, cursor: "pointer",
              }}
            >
              <Pencil style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={isFavoritePending}
              aria-label={LABELS.favoriteAria}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`, background: SOLID.card,
                color: routine.is_favorite ? ACCENT.text : TEXT.tertiary,
                cursor: "pointer", opacity: isFavoritePending ? 0.5 : 1,
              }}
            >
              <StarIcon style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            </button>
             <button
               type="button"
               onClick={onDelete}
               aria-label={LABELS.deleteAria}
               style={{
                 display: "inline-flex", alignItems: "center", justifyContent: "center",
                 width: 36, height: 36, borderRadius: RADIUS.control,
                 border: `1px solid ${GLASS.border}`, background: SOLID.card,
                 color: TEXT.tertiary, cursor: "pointer",
               }}
             >
               <Trash2 style={{ width: 14, height: 14 }} strokeWidth={1.5} />
             </button>
             <button
               type="button"
               onClick={onOpenActionMenu}
               aria-label={LABELS.menuAria}
               title={LABELS.menuAria}
               style={{
                 display: "inline-flex", alignItems: "center", justifyContent: "center",
                 width: 36, height: 36, borderRadius: RADIUS.control,
                 border: `1px solid ${GLASS.border}`, background: SOLID.card,
                 color: TEXT.secondary, cursor: "pointer",
               }}
             >
               <MoreHorizontal style={{ width: 14, height: 14 }} strokeWidth={1.5} />
             </button>
           </div>
         </div>
       </div>
     </div>
    );
}

const ACTION_MENU_STYLE: CSSProperties = {
  ...SURFACE_RAISED,
  position: "fixed",
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  padding: SPACE.xs,
  minWidth: 160,
  zIndex: Z_INDEX.modal,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const ACTION_MENU_ITEM_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: SPACE.xs,
  fontFamily: FONT_SANS,
  fontSize: TYPE.body.size,
  color: TEXT.primary,
  border: "none",
  background: "transparent",
  width: "100%",
  padding: `${SPACE.sm} ${SPACE.md}`,
  borderRadius: RADIUS.control,
  cursor: "pointer",
  textAlign: "left",
};

export function ActionMenu({
  anchorRect,
  onDuplicate,
  onShare,
  onClose,
}: {
  anchorRect: DOMRect;
  onDuplicate: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maxLeft = Math.max(8, window.innerWidth - 172);
  const left = Math.min(anchorRect.right, maxLeft);
  const maxTop = Math.max(8, window.innerHeight - 120);
  const top = Math.min(anchorRect.bottom + 8, maxTop);

  return (
    <>
      <div
        style={{ ...OVERLAY_STYLE, position: "fixed", inset: 0, zIndex: Z_INDEX.modal }}
        onClick={onClose}
      />
      <div
        role="menu"
        aria-label="Acciones de la rutina"
        style={{ ...ACTION_MENU_STYLE, left, top }}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onDuplicate();
            onClose();
          }}
          style={ACTION_MENU_ITEM_STYLE}
        >
          <Copy style={{ width: 14, height: 14 }} strokeWidth={1.5} />
          {LABELS.duplicate}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            void onShare();
            onClose();
          }}
          style={ACTION_MENU_ITEM_STYLE}
        >
          <Share2 style={{ width: 14, height: 14 }} strokeWidth={1.5} />
          {LABELS.share}
        </button>
      </div>
    </>
  );
}

function Sheet({
  mode, draft, saving, error, onPatch, onRemoveItem, onUpdateItem,
  onBrowse, onOpenSwap,
  onSave, onClose,
}: {
  mode: "new" | "edit";
  draft: RoutineDraft;
  saving: boolean;
  error: string | null;
  onPatch: (changes: Partial<RoutineDraft>) => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, changes: Partial<DraftExercise>) => void;
  onBrowse: () => void;
  onOpenSwap: (index: number) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const canSave = isSavableDraft(draft) && !saving;

  return (
    <div
      style={{
        ...OVERLAY_STYLE,
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.pill,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          ...SURFACE_RAISED,
          borderTopLeftRadius: RADIUS.surface,
          borderTopRightRadius: RADIUS.surface,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          padding: SPACE.card,
          paddingBottom: 0,
          maxHeight: "80vh",
          overflowY: "auto",
          animation: `slideUp ${MOTION.slow}ms ${MOTION.standard}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: RADIUS.chip,
            background: GLASS.border,
            margin: "0 auto",
            marginBottom: SPACE.sm,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
          <h2 style={{ fontSize: TYPE.title1.size, fontWeight: TYPE.title1.weight, margin: 0, color: TEXT.primary }}>
            {mode === "new" ? LABELS.newRoutine : LABELS.edit}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={LABELS.closeAria}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: RADIUS.chip, border: "none",
              background: "transparent", color: TEXT.secondary, cursor: "pointer",
            }}
          >
            <X style={{ width: 16, height: 16 }} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, paddingBottom: SPACE.card }}>
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: SPACE.xs,
                padding: `${SPACE.sm} ${SPACE.md}`,
                borderRadius: RADIUS.control,
                background: ACCENT.subtle,
                color: ACCENT.text,
                fontSize: TYPE.body.size,
              }}
            >
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
            <div>
              <label
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.secondary,
                  display: "block",
                  marginBottom: SPACE.xs,
                }}
              >
                Nombre
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                placeholder={LABELS.namePlaceholder}
                style={{
                  width: "100%",
                  padding: `${SPACE.sm} ${SPACE.md}`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.border}`,
                  background: SOLID.card,
                  color: TEXT.primary,
                  fontSize: TYPE.body.size,
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.secondary,
                  display: "block",
                  marginBottom: SPACE.xs,
                }}
              >
                Descripción
              </label>
              <input
                type="text"
                value={draft.description}
                onChange={(e) => onPatch({ description: e.target.value })}
                placeholder={LABELS.descPlaceholder}
                style={{
                  width: "100%",
                  padding: `${SPACE.sm} ${SPACE.md}`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.border}`,
                  background: SOLID.card,
                  color: TEXT.primary,
                  fontSize: TYPE.body.size,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
            <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
              <label style={{ fontSize: TYPE.caption.size, color: TEXT.secondary, minWidth: 100 }}>
                {LABELS.exerciseCount(draft.items.length)}
              </label>
              <button
                type="button"
                onClick={onBrowse}
                aria-label={LABELS.browseAria}
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: SPACE.xs,
                  padding: `${SPACE.xs} ${SPACE.sm}`,
                  borderRadius: RADIUS.chip,
                  border: `1px solid ${GLASS.border}`,
                  background: SOLID.card,
                  color: TEXT.secondary,
                  fontSize: TYPE.caption.size,
                  cursor: "pointer",
                }}
              >
                <Plus style={{ width: 12, height: 12 }} strokeWidth={1.5} /> {LABELS.addExercise}
              </button>
            </div>

            {draft.items.length === 0 ? (
              <p style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{LABELS.browseEmpty}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
                {draft.items.map((item, index) => (
                   <ExerciseRow
                     key={item.exercise.id}
                     item={item}
                     onUpdate={(changes) => onUpdateItem(index, changes)}
                     onRemove={() => onRemoveItem(index)}
                     onSwap={() => onOpenSwap(index)}
                   />
                 ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE.sm,
              borderTop: `1px solid ${GLASS.border}`,
              paddingTop: SPACE.md,
              marginBottom: SPACE.xl,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: `${SPACE.sm} ${SPACE.lg}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: "transparent",
                color: TEXT.secondary,
                fontFamily: FONT_SANS,
                fontSize: TYPE.subhead.size,
                fontWeight: TYPE.subhead.weight,
                cursor: "pointer",
              }}
            >
              {LABELS.cancel}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: SPACE.xs,
                padding: `${SPACE.sm} ${SPACE.lg}`,
                borderRadius: RADIUS.control,
                backgroundColor: !canSave ? TEXT.disabled : ACCENT.base,
                color: !canSave ? TEXT.tertiary : TEXT.onAccent,
                fontFamily: FONT_SANS,
                fontSize: TYPE.subhead.size,
                fontWeight: TYPE.subhead.weight,
                border: "none",
                cursor: !canSave ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? LABELS.saving : LABELS.saveRoutine}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExerciseRow({
  item, onUpdate, onRemove, onSwap,
}: {
  item: DraftExercise;
  onUpdate: (changes: Partial<DraftExercise>) => void;
  onRemove: () => void;
  onSwap: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ ...SURFACE_STYLE, borderRadius: RADIUS.control, padding: SPACE.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
        <Dumbbell style={{ width: 14, height: 14, color: TEXT.secondary }} />
        <span style={{ flex: 1, fontSize: TYPE.body.size, color: TEXT.primary, minWidth: 0 }}>
          {getExerciseName(item.exercise)}
        </span>
        <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, fontFamily: TYPE.mono.font }}>
          {getRepLabel(item)}
        </span>
        <SwapButton onClick={onSwap} />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: RADIUS.chip, border: "none",
            background: "transparent", color: TEXT.secondary, cursor: "pointer",
          }}
        >
          {expanded ? (
            <ChevronUp style={{ width: 12, height: 12 }} strokeWidth={1.5} />
          ) : (
            <ChevronDown style={{ width: 12, height: 12 }} strokeWidth={1.5} />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: RADIUS.chip, border: "none",
            background: "transparent", color: TEXT.tertiary, cursor: "pointer",
          }}
        >
          <X style={{ width: 12, height: 12 }} strokeWidth={1.5} />
        </button>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: SPACE.sm,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: SPACE.sm,
            alignItems: "end",
          }}
        >
          <NumberInput
            label={LABELS.setsLabel}
            value={item.target_sets}
            min={1}
            max={10}
            onChange={(v) => onUpdate({ target_sets: v })}
          />
          <NumberInput
            label={LABELS.restLabel}
            value={item.rest_seconds}
            min={0}
            max={300}
            step={15}
            suffix="s"
            onChange={(v) => onUpdate({ rest_seconds: v })}
          />
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label, value, min, max, step = 1, suffix = "", onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
      <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
        style={{
          padding: `${SPACE.xs} ${SPACE.sm}`,
          borderRadius: RADIUS.control,
          border: `1px solid ${GLASS.border}`,
          background: SOLID.card,
          color: TEXT.primary,
          fontSize: TYPE.mono.size,
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
        }}
      />
      {suffix && (
        <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{suffix}</span>
      )}
    </div>
  );
}

function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: "fixed",
        right: SPACE.gutter,
        bottom: `calc(${SPACE.xl}px + 72px)`,
        ...SURFACE_RAISED,
        borderRadius: RADIUS.control,
        padding: `${SPACE.sm} ${SPACE.md}`,
        display: "inline-flex",
        alignItems: "center",
        gap: SPACE.sm,
        zIndex: Z_INDEX.pill + 1,
        animation: `fadeIn ${MOTION.slow}ms ${MOTION.standard}`,
      }}
    >
      <span style={{ fontSize: TYPE.caption.size, color: TEXT.secondary }}>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          fontFamily: FONT_SANS,
          fontSize: TYPE.subhead.size,
          fontWeight: TYPE.subhead.weight,
          color: ACCENT.text,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        {LABELS.undo}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={LABELS.closeAria}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          borderRadius: RADIUS.chip,
          border: "none",
          background: "transparent",
          color: TEXT.tertiary,
          cursor: "pointer",
        }}
      >
        <X style={{ width: 10, height: 10 }} strokeWidth={1.5} />
      </button>
    </div>
  );
}
