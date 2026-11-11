import { useCallback, useMemo, useState } from "react";
import { Plus, AlertCircle, Loader2, ChevronRight } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useRoutines } from "@/hooks/useGymData";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { TRAIN_PATH } from "@/components/shell/navItems";
import { supabase } from "@lib/supabase";
import { saveRoutine, flushSave, duplicateRoutine } from "@/lib/routines/saveRoutine";
import { RoutineCard } from "./RoutineCard";
import { RoutineEditor } from "./RoutineEditor";
import { draftFromRoutine, displayDayLabel } from "@/lib/routines/routineDayModel";
import type { SaveResult } from "@/lib/routines/saveRoutine";
import { ACCENT, DANGER, GLASS, MOTION, RADIUS, SCRIM, SOLID, SPACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { hapticLight } from "@/lib/haptics";
import { ROUTINES_UI_LABELS, translateBodyPart, translateTarget } from "@/lib/i18n";

type RoutineTab = "mine" | "catalog";
type RoutineWithMode = RoutineWithExercises & {
  routineMode: "single" | "weekly" | "legacy";
  is_favorite?: boolean;
};

const TAB_OPTIONS = [
  { value: "mine", label: ROUTINES_UI_LABELS.tabMine },
  { value: "catalog", label: ROUTINES_UI_LABELS.tabCatalog },
] as const;

export function RoutinesPage() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { routines, loading, error, refresh } = useRoutines(userId);
  const [dayPickerRoutine, setDayPickerRoutine] = useState<RoutineWithMode | null>(null);
  const [sessionConflict, setSessionConflict] = useState<{
    routineId: string | null;
    title: string;
    dayLabel?: string | null;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "warning" | "info" } | null>(null);
  const [tab, setTab] = useState<RoutineTab>("mine");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineWithMode | null>(null);
  const { isActive, start, session, discardRecoverableDraft } = useActiveSession();
  const navigate = useNavigate();

  const showToast = useCallback((message: string, type: "error" | "warning" | "info" = "info") => {
    hapticLight();
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const routineRows = routines as RoutineWithMode[];

  const summary = useMemo(
    () => ({
      total: routineRows.length,
      single: routineRows.filter((r) => r.routineMode === "single").length,
      weekly: routineRows.filter((r) => r.routineMode === "weekly").length,
      favorites: routineRows.filter((r) => Boolean(r.is_favorite)).length,
    }),
    [routineRows],
  );

  const openNew = useCallback(() => {
    setEditingRoutine(null);
    setEditorOpen(true);
  }, []);
  const openEdit = useCallback((routine: RoutineWithMode) => {
    setEditingRoutine(routine);
    setEditorOpen(true);
  }, []);
  const openPlan = useCallback((_routine: RoutineWithMode) => {
    // Weekly planner removed pending the new planner component.
  }, []);

  const handleTrain = useCallback(
    async (routine: RoutineWithMode) => {
      // If there's already an active session, navigate to it directly
      if (isActive) {
        navigate(TRAIN_PATH);
        return;
      }
      const draft = draftFromRoutine(routine);
      if (draft.incomplete) {
        showToast("Esta rutina tiene días programados pero sin ejercicios. Edítala para añadir ejercicios.", "warning");
        return;
      }
      const trainingDays = draft.days.filter((d) => d.kind === "training");
      if (trainingDays.length === 0) {
        showToast("Esta rutina no tiene días de entrenamiento. Añade al menos un día con ejercicios.", "warning");
        return;
      }
      if (trainingDays.length > 1) {
        setDayPickerRoutine(routine);
        return;
      }
      const day = trainingDays[0];
      const planned = day.exercises.map((ex) => ({
        exercise: ex.exercise,
        target_sets: ex.target_sets,
        rest_seconds: ex.rest_seconds,
        rowId: ex.rowId ?? "",
        order_index: ex.order_index,
        target_reps_min: ex.target_reps_min,
        target_reps_max: ex.target_reps_max,
        dayIndex: day.weekday ?? day.order,
        dayLabel: day.label,
        groupId: ex.groupId,
      }));

      // Try to start the session, handling all failure cases
      let result = start({
        routine: { id: routine.id, title: routine.title },
        routineDayId: day.id,
        dayLabel: day.label || undefined,
        planned,
      });

      // If rehydrating is stuck, force reset and retry once
      if (!result.ok && result.reason === "rehydrating") {
        if (import.meta.env.DEV) {
          console.log("[handleTrain] rehydrating stuck, forcing reset and retrying");
        }
        // The context now has a safety timeout, but we can also try to trigger a retry
        // by calling start again after a brief moment - the rehydrating flag should clear
        await new Promise((r) => setTimeout(r, 100));
        result = start({
          routine: { id: routine.id, title: routine.title },
          routineDayId: day.id,
          dayLabel: day.label || undefined,
          planned,
        });
      }

      // If there's an active session (race condition), navigate to it
      if (!result.ok && result.reason === "active_session") {
        navigate(TRAIN_PATH);
        return;
      }

      // If there's a recoverable draft blocking us, discard it and retry
      if (!result.ok && result.reason === "recoverable_draft") {
        if (import.meta.env.DEV) {
          console.log("[handleTrain] recoverable_draft blocking, discarding and retrying");
        }
        discardRecoverableDraft();
        // Brief pause to let state update
        await new Promise((r) => setTimeout(r, 50));
        result = start({
          routine: { id: routine.id, title: routine.title },
          routineDayId: day.id,
          dayLabel: day.label || undefined,
          planned,
        });
      }

      if (result.ok) {
        navigate(TRAIN_PATH);
      } else {
        // Only show toast for truly invalid data
        if (result.reason === "invalid") {
          showToast("Datos de rutina inválidos. Intenta editarla y guardarla de nuevo.", "error");
        } else if (result.reason === "rehydrating") {
          showToast("Restaurando sesión anterior… Vuelve a intentarlo en un momento.", "info");
        }
      }
    },
    [isActive, session, start, navigate, showToast, discardRecoverableDraft],
  );

  const handleDuplicateRoutine = useCallback(
    async (routine: RoutineWithMode) => {
      if (!userId) return;
      const draft = draftFromRoutine(routine);
      const copy = duplicateRoutine(draft, `${routine.title} (copia)`);
      await saveRoutine(userId, copy, "duplicate");
      await flushSave(copy.draftKey);
      void refresh();
    },
    [userId, refresh],
  );

  const handleDeleteRoutine = useCallback(
    async (routine: RoutineWithMode) => {
      if (!userId) return;
      await supabase.from("routine_exercises").delete().eq("routine_id", routine.id);
      await supabase.from("routines").delete().eq("id", routine.id).eq("user_id", userId);
      void refresh();
    },
    [userId, refresh],
  );

  const closeDayPicker = useCallback(() => setDayPickerRoutine(null), []);
  const closeConflict = useCallback(() => setSessionConflict(null), []);

  const handleEditorSave = useCallback((_result: SaveResult) => {
    setEditorOpen(false);
    setEditingRoutine(null);
    void refresh();
  }, [refresh]);

  const showMainHeader = !editorOpen;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, paddingBottom: SPACE.lg }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: SPACE.md,
            left: SPACE.md,
            right: SPACE.md,
            zIndex: Z_INDEX.toast,
            display: "flex",
            alignItems: "center",
            gap: SPACE.sm,
            padding: `${SPACE.sm} ${SPACE.md}`,
            borderRadius: RADIUS.card,
            border: `1px solid ${toast.type === "error" ? DANGER.border : toast.type === "warning" ? ACCENT.border : GLASS.borderStrong}`,
            background: toast.type === "error" ? DANGER.muted : toast.type === "warning" ? ACCENT.subtle : GLASS.fillRaised,
            boxShadow: GLASS.shadow,
            animation: "cronos-sheet-up 200ms ease-out both",
          }}
          role="alert"
          aria-live="polite"
        >
          {toast.type === "error" && <AlertCircle size={18} style={{ color: DANGER.text, flexShrink: 0 }} aria-hidden="true" />}
          {toast.type === "warning" && <AlertCircle size={18} style={{ color: ACCENT.text, flexShrink: 0 }} aria-hidden="true" />}
          {toast.type === "info" && <Loader2 size={18} style={{ color: TEXT.primary, flexShrink: 0, animation: "spin 1s linear infinite" }} aria-hidden="true" />}
          <span style={{ flex: 1, fontSize: TYPE.subhead.size, color: toast.type === "error" ? DANGER.text : toast.type === "warning" ? ACCENT.text : TEXT.primary }}>
            {toast.message}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Cerrar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: RADIUS.control,
              border: "none",
              background: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
          </button>
        </div>
      )}
      {showMainHeader && (
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: Z_INDEX.sticky,
            marginLeft: `-${SPACE.md}`,
            marginRight: `-${SPACE.md}`,
            paddingLeft: SPACE.md,
            paddingRight: SPACE.md,
            paddingTop: SPACE.sm,
            paddingBottom: SPACE.sm,
            background: SCRIM.overlay,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
            <h1
              style={{
                margin: 0,
                fontSize: TYPE.title1.size,
                lineHeight: TYPE.title1.lineHeight,
                fontWeight: 900,
                letterSpacing: TYPE.title1.tracking,
                color: TEXT.primary,
              }}
            >
              {ROUTINES_UI_LABELS.title}
            </h1>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                openNew();
              }}
              aria-label={ROUTINES_UI_LABELS.newRoutine}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: MOTION.minTouchTarget,
                height: MOTION.minTouchTarget,
                borderRadius: RADIUS.pill,
                border: `1px solid ${GLASS.borderStrong}`,
                background: SOLID.card,
                color: TEXT.primary,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Plus size={22} aria-hidden="true" />
            </button>
          </div>
        </header>
      )}

      {showMainHeader && (
        <SegmentedControl
          value={tab}
          options={TAB_OPTIONS}
          onChange={(value) => setTab(value as RoutineTab)}
          ariaLabel={ROUTINES_UI_LABELS.title}
        />
      )}

      {editorOpen && (
        <RoutineEditor
          routine={editingRoutine}
          onSave={handleEditorSave}
          onClose={() => {
            setEditorOpen(false);
            setEditingRoutine(null);
          }}
        />
      )}

      {sessionConflict ? (
        <GlassCard raised style={{ border: `1px solid ${ACCENT.border}`, background: ACCENT.subtle }}>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
              {ROUTINES_UI_LABELS.activeSession} <strong>{sessionConflict.title}</strong>
              {sessionConflict.dayLabel ? ` (${sessionConflict.dayLabel})` : ""}.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
              <GlassButton
                variant="primary"
                onClick={() => {
                  closeConflict();
                  navigate(TRAIN_PATH);
                }}
              >
                {ROUTINES_UI_LABELS.goToActive}
              </GlassButton>
              <GlassButton variant="ghost" onClick={closeConflict}>
                {ROUTINES_UI_LABELS.understood}
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {loading ? (
        <GlassCard raised>
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }} aria-live="polite">
            {ROUTINES_UI_LABELS.loading}
          </p>
        </GlassCard>
      ) : error ? (
        <GlassCard raised>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
              {ROUTINES_UI_LABELS.loadError}
            </p>
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }} aria-live="polite">
              {error}
            </p>
            <div>
              <GlassButton variant="secondary" onClick={() => void refresh()}>
                {ROUTINES_UI_LABELS.retry}
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      ) : tab === "catalog" ? (
        <GlassCard raised>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, padding: `${SPACE.sm}px 0` }}>
            <p style={{ margin: 0, fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight, color: TEXT.primary }}>
              {ROUTINES_UI_LABELS.catalogEmptyTitle}
            </p>
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
              {ROUTINES_UI_LABELS.catalogEmptyBody}
            </p>
          </div>
        </GlassCard>
      ) : routineRows.length === 0 ? (
        <GlassCard raised>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: SPACE.md,
              padding: `${SPACE.xl}px ${SPACE.sm}px`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: MOTION.minTouchTarget,
                height: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                border: `1px solid ${ACCENT.border}`,
                background: ACCENT.subtle,
                color: ACCENT.text,
              }}
            >
              <Plus size={22} aria-hidden="true" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
              <p style={{ margin: 0, fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight, color: TEXT.primary }}>
                {ROUTINES_UI_LABELS.emptyTitle}
              </p>
              <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
                {ROUTINES_UI_LABELS.emptyBody}
              </p>
            </div>
            <GlassButton variant="primary" icon={<Plus />} onClick={openNew}>
              {ROUTINES_UI_LABELS.newRoutine}
            </GlassButton>
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
          {summary.total > 0 ? (
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
              {routineRows.length} {routineRows.length === 1 ? "rutina" : "rutinas"}
            </p>
          ) : null}
          {routineRows.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onTrain={handleTrain}
              onEdit={() => openEdit(routine)}
              onPlan={() => openPlan(routine)}
              onDuplicate={handleDuplicateRoutine}
              onDelete={handleDeleteRoutine}
            />
          ))}
          <button
            type="button"
            onClick={openNew}
            aria-label={ROUTINES_UI_LABELS.newRoutine}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.xs,
              padding: `${SPACE.lg}px`,
              borderRadius: RADIUS.card,
              border: `1px dashed ${GLASS.border}`,
              background: GLASS.fillFaint,
              color: TEXT.secondary,
              cursor: "pointer",
              width: "100%",
            }}
          >
            <Plus size={22} aria-hidden="true" />
            <span style={{ fontSize: TYPE.caption.size, fontWeight: 600, color: TEXT.primary }}>
              Nueva rutina
            </span>
          </button>
        </div>
      )}

      {dayPickerRoutine ? (
        <div
          role="presentation"
          onClick={closeDayPicker}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z_INDEX.modal,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: SPACE.sm,
            background: SCRIM.modal,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560 }}>
            <GlassCard raised>
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
                <div>
                  <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                    {dayPickerRoutine.title}
                  </p>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: TYPE.title2.size,
                      lineHeight: TYPE.title2.lineHeight,
                      fontWeight: TYPE.title2.weight,
                      color: TEXT.primary,
                    }}
                  >
                    {ROUTINES_UI_LABELS.chooseDay}
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                  {ROUTINES_UI_LABELS.chooseDayHint}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
                  {(() => {
                    const draft = draftFromRoutine(dayPickerRoutine);
                    const todayWeekday = (new Date().getDay() + 6) % 7;
                    return draft.days
                      .filter((d) => d.kind === "training")
                      .map((day) => {
                        const label = displayDayLabel(
                          day,
                          dayPickerRoutine.routineMode === "legacy" ? "single" : dayPickerRoutine.routineMode,
                        );
                        const isToday = day.weekday != null && day.weekday === todayWeekday;
                        const dayExercises = day.exercises;
                        const exerciseCount = dayExercises.length;
                        const muscleLabels = dayExercises
                          .map((e) => {
                            const ex = e.exercise;
                            const raw = ex.body_part?.trim() || ex.target?.trim() || "";
                            if (!raw) return null;
                            return ex.body_part ? translateBodyPart(raw) : translateTarget(raw);
                          })
                          .filter(Boolean);
                        const muscleFocus = [...new Set(muscleLabels)].slice(0, 2).join(" · ");

                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const dayObj = draft.days.find((d) => d.id === day.id);
                              if (!dayObj) return;
                              const planned = dayObj.exercises.map((ex) => ({
                                exercise: ex.exercise,
                                target_sets: ex.target_sets,
                                rest_seconds: ex.rest_seconds,
                                rowId: ex.rowId ?? "",
                                order_index: ex.order_index,
                                target_reps_min: ex.target_reps_min,
                                target_reps_max: ex.target_reps_max,
                                dayIndex: dayObj.weekday ?? dayObj.order,
                                dayLabel: dayObj.label,
                                groupId: ex.groupId,
                              }));
                              const result = start({
                                routine: { id: dayPickerRoutine.id, title: dayPickerRoutine.title },
                                routineDayId: dayObj.id,
                                dayLabel: dayObj.label || undefined,
                                planned,
                              });
                              if (result.ok) {
                                closeDayPicker();
                                navigate(TRAIN_PATH);
                              }
                            }}
                            aria-label={`${ROUTINES_UI_LABELS.startWorkout}: ${label}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: SPACE.sm,
                              padding: `${SPACE.sm}px ${SPACE.md}px`,
                              borderRadius: RADIUS.control,
                              border: "none",
                              background: "transparent",
                              color: TEXT.primary,
                              fontSize: TYPE.subhead.size,
                              fontWeight: 500,
                              cursor: "pointer",
                              width: "100%",
                              minHeight: MOTION.minTouchTarget,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs, flex: 1, minWidth: 0 }}>
                              <span
                                style={{
                                  minWidth: 0,
                                  fontSize: TYPE.subhead.size,
                                  fontWeight: 600,
                                  color: TEXT.primary,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {label}
                              </span>
                              {isToday && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minWidth: 24,
                                    height: 20,
                                    padding: "0 6px",
                                    borderRadius: RADIUS.pill,
                                    background: ACCENT.subtle,
                                    color: ACCENT.text,
                                    fontSize: TYPE.caption.size,
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  HOY
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs, flexShrink: 0 }}>
                              {muscleFocus && (
                                <span
                                  style={{
                                    fontSize: TYPE.caption.size,
                                    color: TEXT.secondary,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {muscleFocus}
                                </span>
                              )}
                              <span
                                style={{
                                  fontFamily: TYPE.mono.font,
                                  fontSize: TYPE.caption.size,
                                  fontWeight: 600,
                                  color: TEXT.tertiary,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                              </span>
                              <ChevronRight
                                size={16}
                                aria-hidden="true"
                                style={{ color: TEXT.tertiary, flexShrink: 0 }}
                              />
                            </div>
                          </button>
                        );
                      });
                  })()}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <GlassButton variant="ghost" onClick={closeDayPicker}>
                    {ROUTINES_UI_LABELS.cancel}
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
