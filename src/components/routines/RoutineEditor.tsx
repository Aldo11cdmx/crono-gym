import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Flame, Plus, Trash2 } from "lucide-react";
import { UnifiedExerciseSelectorSheet } from "@/components/UnifiedExerciseSelectorSheet";
import type { Exercise } from "@/types/supabase";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { saveRoutine, flushSave, type SaveResult } from "@/lib/routines/saveRoutine";
import {
  draftFromRoutine,
  validateDraft,
  newDraftKey,
  type LoadedRoutineSnapshot,
  type RoutineDraftV2,
  type RoutineDay,
  type DraftExercise,
} from "@/lib/routines/routineDayModel";
import { useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { CRONOS_LABELS, ROUTINES_UI_LABELS, translateMuscle, translateTarget } from "@/lib/i18n";
import { ACCENT, GLASS, MOTION, RADIUS, SCRIM, SOLID, SPACE, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface RoutineEditorProps {
  mode: "new" | "edit";
  routine?: RoutineWithExercises;
  initialPlanMode?: "single" | "weekly" | "split";
  onSave: () => Promise<void> | void;
  onClose: () => void;
}

function emptyDay(order: number): RoutineDay {
  return { id: crypto.randomUUID(), order, weekday: null, label: "", kind: "training", exercises: [] };
}

function draftExercise(exercise: Exercise, orderIndex: number): DraftExercise {
  return {
    rowId: crypto.randomUUID(),
    exercise,
    target_sets: 3,
    rest_seconds: 90,
    order_index: orderIndex,
    target_reps_min: null,
    target_reps_max: null,
  };
}

function emptyWeekDraftFromRoutine(routine: RoutineWithExercises, snapshot: LoadedRoutineSnapshot | null = null): RoutineDraftV2 {
  const days: RoutineDay[] = [];
  const byDay = new Map<number, (typeof routine.exercises)[number][]>();
  for (const ex of routine.exercises) {
    const di = ex.dayIndex ?? 0;
    const list = byDay.get(di) ?? [];
    list.push(ex);
    byDay.set(di, list);
  }
  for (let i = 0; i < 7; i += 1) {
    const dayExs = byDay.get(i) ?? [];
    days.push({
      id: crypto.randomUUID(),
      order: i,
      weekday: i,
      label: "",
      kind: dayExs.length > 0 ? "training" : "rest",
      exercises: dayExs.map((ex, idx) => ({
        exercise: ex.exercise,
        target_sets: ex.target_sets,
        rest_seconds: ex.rest_seconds,
        order_index: idx,
        target_reps_min: ex.target_reps_min,
        target_reps_max: ex.target_reps_max,
        rowId: ex.rowId,
      })),
    });
  }
  return {
    draftKey: crypto.randomUUID(),
    id: routine.id,
    title: routine.title,
    description: routine.description ?? "",
    mode: "weekly",
    days,
    snapshot,
  };
}

function weekdayName(index: number): string {
  const names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  return names[index] ?? `Día ${index + 1}`;
}

function weekdayInitial(index: number): string {
  return (["L", "M", "X", "J", "V", "S", "D"][index] ?? "·");
}

function dayMuscleSummary(day: RoutineDay): string | null {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const ex of day.exercises) {
    const raw = ex.exercise.body_part?.trim() || ex.exercise.target?.trim() || "";
    if (!raw) continue;
    const label = (ex.exercise.body_part ? translateMuscle(raw) : translateTarget(raw));
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
    if (labels.length >= 2) break;
  }
  return labels.length > 0 ? labels.join(" • ") : null;
}

const WEEKLY_QUICK_CHIPS = [
  "V-Taper 5 Días",
  "Push / Pull / Legs",
  "Upper / Lower",
  "Full Body 3x",
  "Hipertrofia 6 Días",
];

const SINGLE_QUICK_CHIPS = [
  "Empuje (Push)",
  "Tirón (Pull)",
  "Pierna & Glúteo",
  "Espalda & Hombro",
  "Torso",
  "Brazo Completo",
];

export function RoutineEditor({ mode, routine, initialPlanMode, onSave, onClose }: RoutineEditorProps) {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetDayIndex, setTargetDayIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [dayDetailIndex, setDayDetailIndex] = useState<number | null>(null);
  const [draftMode, setDraftMode] = useState<"single" | "weekly">(
    initialPlanMode === "weekly" || initialPlanMode === "split" ? "weekly" : "single",
  );
  const [titleInputValue, setTitleInputValue] = useState("");

  const initialDraftRef = useRef<RoutineDraftV2 | null>(null);
  const createHintAppliedRef = useRef(false);

  useEffect(() => {
    if (mode !== "new" || createHintAppliedRef.current || initialPlanMode == null) return;
    createHintAppliedRef.current = true;
    setDraftMode(initialPlanMode === "weekly" || initialPlanMode === "split" ? "weekly" : "single");
  }, [mode, initialPlanMode]);

  const initialDraft = useMemo((): RoutineDraftV2 => {
    if (mode === "edit" && routine) {
      const loaded = draftFromRoutine(routine);
      if (loaded.needsModeConfirmation && draftMode === "weekly") return emptyWeekDraftFromRoutine(routine, loaded.snapshot);
      if (draftMode === "weekly" && loaded.mode === "single") {
        const fullWeek = [...Array(7).keys()].map((wd) => emptyDay(wd));
        fullWeek[0] = {
          ...(loaded.days[0] ?? emptyDay(0)),
          id: crypto.randomUUID(),
          order: 0,
          weekday: 0,
          kind: (loaded.days[0]?.exercises.length ?? 0) > 0 ? "training" : "rest",
        };
        return { ...loaded, mode: "weekly", days: fullWeek };
      }
      return loaded;
    }
    const days: RoutineDay[] =
      draftMode === "weekly"
        ? [...Array(7).keys()].map((wd) => ({
            id: crypto.randomUUID(),
            order: wd,
            weekday: wd,
            label: "",
            kind: wd < 5 ? "training" : "rest",
            exercises: [],
          }))
        : [emptyDay(0)];
    return {
      draftKey: newDraftKey(),
      id: null,
      title: "",
      description: "",
      mode: draftMode,
      days,
      snapshot: null,
      needsModeConfirmation: false,
    };
  }, [mode, routine, draftMode]);

  const [draft, setDraft] = useState<RoutineDraftV2>(initialDraft);

  useEffect(() => {
    if (draft === initialDraftRef.current) setDraft(initialDraft);
    initialDraftRef.current = initialDraft;
    setTitleInputValue(initialDraft.title);
  }, [initialDraft]);

  const reducedMotion = useReducedMotion();

  const dirty = useMemo(() => {
    const init = initialDraftRef.current;
    if (!init) return false;
    if (init.title !== draft.title) return true;
    if (init.days.length !== draft.days.length) return true;
    for (let i = 0; i < draft.days.length; i++) {
      const a = init.days[i];
      const b = draft.days[i];
      if (!a || !b) return true;
      if (a.label !== b.label || a.kind !== b.kind || a.exercises.length !== b.exercises.length) return true;
      for (let j = 0; j < b.exercises.length; j++) {
        const ea = a.exercises[j];
        const eb = b.exercises[j];
        if (!ea || !eb || ea.exercise.id !== eb.exercise.id || ea.target_sets !== eb.target_sets || ea.rest_seconds !== eb.rest_seconds) return true;
      }
    }
    return false;
  }, [draft]);

  const setTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTitleInputValue(value);
    setDraft((d) => ({ ...d, title: value }));
  }, []);

  const addExercisesToDay = useCallback((dayIndex: number, exercises: Exercise[]) => {
    if (exercises.length === 0) return;
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      const day = next[dayIndex];
      if (!day) return d;
      const additions = exercises.map((exercise, i) => draftExercise(exercise, day.exercises.length + i));
      next[dayIndex] = { ...day, kind: "training", exercises: [...day.exercises, ...additions] };
      return { ...d, days: next };
    });
  }, []);

  const removeExercise = useCallback((dayIndex: number, exerciseIndex: number) => {
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      const exs = [...next[dayIndex].exercises];
      exs.splice(exerciseIndex, 1);
      exs.forEach((ex, i) => {
        ex.order_index = i;
      });
      next[dayIndex] = { ...next[dayIndex], exercises: exs };
      return { ...d, days: next };
    });
  }, []);

  const setDayRest = useCallback((dayIndex: number, isRest: boolean) => {
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      const day = next[dayIndex];
      next[dayIndex] = isRest
        ? { ...day, kind: "rest", exercises: [] }
        : { ...day, kind: "training" };
      return { ...d, days: next };
    });
  }, []);

  const handleSave = useCallback(async () => {
    const hasAnyExercise = draft.days.some((d) => d.exercises.length > 0);
    const isWeeklyMode = draft.mode === "weekly" || draftMode === "weekly";
    const defaultTitle = isWeeklyMode ? "Plan Semanal" : "Nueva Rutina";
    const title = draft.title.trim().length >= 3 ? draft.title.trim() : hasAnyExercise ? defaultTitle : draft.title;
    const finalDraft: RoutineDraftV2 = title !== draft.title ? { ...draft, title } : draft;
    const blocking = validateDraft(finalDraft).filter((p) => p !== "noTitle" && p !== "titleTooShort");
    if (!hasAnyExercise || blocking.length > 0) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const promise = saveRoutine(userId, finalDraft, "editor");
      await flushSave(finalDraft.draftKey);
      const result = await promise;
      setSaveResult(result);
      if (result.ok) {
        setDraft(finalDraft);
        initialDraftRef.current = finalDraft;
        onSave();
      }
    } finally {
      setSaving(false);
    }
  }, [userId, draft, onSave, draftMode]);

  const problems = validateDraft(draft);
  const hasAnyExercise = draft.days.some((d) => d.exercises.length > 0);
  const nonTitleProblems = problems.filter((p) => p !== "noTitle" && p !== "titleTooShort");
  const canSave = hasAnyExercise && nonTitleProblems.length === 0;

  const handleClose = useCallback(() => {
    if (dirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const onOpenExercisePicker = useCallback((dayIndex?: number) => {
    setTargetDayIndex(dayIndex ?? 0);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleSelectMultiple = useCallback((exercises: Exercise[]) => {
    addExercisesToDay(targetDayIndex, exercises);
    setPickerOpen(false);
  }, [addExercisesToDay, targetDayIndex]);

  const dayContext = useMemo(() => {
    const day = draft.days[targetDayIndex];
    if (!day) return undefined;
    return { dayIndex: targetDayIndex, dayLabel: day.label, dayExercises: day.exercises.map((ex) => ex.exercise) };
  }, [draft, targetDayIndex]);

  const isWeekly = draft.mode === "weekly" || draftMode === "weekly";
  const headerTitle = mode === "edit" ? "Editar rutina" : isWeekly ? "Plan Semanal" : "Nueva Rutina";
  const transition = reducedMotion ? undefined : `transform ${MOTION.fast} ${MOTION.easeOut}, opacity ${MOTION.fast} ${MOTION.easeOut}`;

  // Weekly progress calculations
  const trainingDaysCount = draft.days.filter((d) => d.kind === "training" && d.exercises.length > 0).length;
  const restDaysCount = draft.days.filter((d) => d.kind === "rest").length;

  // Quick-fill chips handler
  const handleQuickChip = useCallback((chipLabel: string) => {
    setTitleInputValue(chipLabel);
    setDraft((d) => ({ ...d, title: chipLabel }));
  }, []);

  const quickChips = isWeekly ? WEEKLY_QUICK_CHIPS : SINGLE_QUICK_CHIPS;

  // Day detail view reference
  const detailDay = dayDetailIndex != null ? draft.days[dayDetailIndex] : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        backgroundColor: SURFACE.base,
        color: TEXT.primary,
      }}
    >
      {/* iOS 18 Top Navigation Bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          height: 52,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: SPACE.xs,
          padding: `0 ${SPACE.md}px`,
          borderBottom: `1px solid ${GLASS.border}`,
          background: "rgba(9,9,11,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <button
          type="button"
          onClick={dayDetailIndex != null ? () => setDayDetailIndex(null) : handleClose}
          aria-label={dayDetailIndex != null ? ROUTINES_UI_LABELS.back : ROUTINES_UI_LABELS.cancel}
          style={{
            justifySelf: "start",
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            minHeight: MOTION.minTouchTarget,
            padding: `0 ${SPACE.xs}px`,
            border: "none",
            background: "transparent",
            color: TEXT.secondary,
            fontSize: TYPE.subhead.size,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {dayDetailIndex != null && <ChevronLeft size={18} aria-hidden="true" />}
          {dayDetailIndex != null ? ROUTINES_UI_LABELS.back : ROUTINES_UI_LABELS.cancel}
        </button>
        <h2 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 700, color: TEXT.primary, textAlign: "center" }}>
          {dayDetailIndex != null ? weekdayName(draft.days[dayDetailIndex]?.weekday ?? dayDetailIndex) : headerTitle}
        </h2>
        <button
          type="button"
          onClick={dayDetailIndex != null ? () => setDayDetailIndex(null) : handleSave}
          disabled={dayDetailIndex != null ? false : saving || !canSave}
          aria-label={dayDetailIndex != null ? "Listo" : "Guardar rutina"}
          style={{
            justifySelf: "end",
            minHeight: 32,
            padding: `0 ${SPACE.md}px`,
            borderRadius: 9999,
            border: "none",
            background: dayDetailIndex == null && (saving || !canSave) ? "rgba(255,255,255,0.05)" : ACCENT.base,
            color: dayDetailIndex == null && (saving || !canSave) ? TEXT.disabled : TEXT.onAccent,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: dayDetailIndex == null && (saving || !canSave) ? "not-allowed" : "pointer",
            opacity: dayDetailIndex == null && (saving || !canSave) ? 0.4 : 1,
            boxShadow: dayDetailIndex == null && canSave && !saving ? `0 2px 8px rgba(255,59,48,0.3)` : "none",
            transition: reducedMotion ? "none" : "all 150ms ease",
          }}
        >
          {dayDetailIndex != null ? "Listo" : saving ? CRONOS_LABELS.saving : "Guardar"}
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 16px 128px", display: "flex", flexDirection: "column", gap: 16 }}>
          {dayDetailIndex == null ? (
            <>
              {/* Identity Card + Quick-Fill Chips */}
              <div
                style={{
                  borderRadius: "24px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#1C1C1E",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      lineHeight: 14,
                      fontWeight: 600,
                      letterSpacing: 0.8,
                      color: TEXT.tertiary,
                      textTransform: "uppercase",
                    }}
                  >
                    {isWeekly ? "NOMBRE DEL PROGRAMA" : "NOMBRE DE LA SESIÓN"}
                  </span>
                  <input
                    type="text"
                    value={titleInputValue}
                    onChange={setTitle}
                    placeholder={isWeekly ? "Nombre del programa…" : CRONOS_LABELS.namePlaceholder}
                    aria-label="Nombre de la rutina"
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      color: TEXT.primary,
                      fontSize: "20px",
                      fontWeight: 700,
                      lineHeight: "28px",
                      letterSpacing: "-0.005em",
                      padding: 0,
                      outline: "none",
                    }}
                  />
                </div>

                {/* Quick-Fill Chips */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    paddingBottom: 8,
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {quickChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleQuickChip(chip)}
                      style={{
                        flexShrink: 0,
                        minHeight: 32,
                        padding: `0 16px`,
                        borderRadius: 9999,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.04)",
                        color: TEXT.secondary,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: reducedMotion ? "none" : "all 150ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!reducedMotion) {
                          e.currentTarget.style.background = "rgba(255,59,48,0.12)";
                          e.currentTarget.style.borderColor = ACCENT.border;
                          e.currentTarget.style.color = ACCENT.text;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!reducedMotion) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                          e.currentTarget.style.color = TEXT.secondary;
                        }
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {isWeekly ? (
                /* Weekly Mode: Microciclo Bento + 7-Day List */
                <>
                  {/* Microciclo Bento */}
                  <div
                    style={{
                      borderRadius: "24px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "#1C1C1E",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          fontSize: 11,
                          lineHeight: 14,
                          fontWeight: 600,
                          letterSpacing: 0.8,
                          color: TEXT.tertiary,
                          textTransform: "uppercase",
                        }}
                      >
                        ESTRUCTURA SEMANAL
                      </span>
                      <span
                        style={{
                          fontFamily: TYPE.mono.font,
                          fontSize: 12,
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          color: TEXT.tertiary,
                        }}
                      >
                        {trainingDaysCount} entrenos • {restDaysCount} descansos
                      </span>
                    </div>

                    {/* 7 Capsule Tracker - horizontal, no wrapping */}
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", msOverflowStyle: "none" }}>
                      {draft.days.map((day, index) => {
                        const hasExercises = day.exercises.length > 0;
                        const isRest = day.kind === "rest";

                        let capsuleStyle: React.CSSProperties = {
                          width: 1,
                          flex: 1,
                          minWidth: 28,
                          height: 3,
                          borderRadius: 9999,
                          transition: reducedMotion ? "none" : "all 200ms ease",
                          background: "#2C2C2E",
                          border: "1px solid rgba(255,255,255,0.08)",
                        };

                        let labelColor: string = TEXT.tertiary;
                        if (isRest) {
                          capsuleStyle.background = "rgba(255,255,255,0.06)";
                          capsuleStyle.border = "1px solid rgba(255,255,255,0.08)";
                          labelColor = TEXT.disabled;
                        } else if (hasExercises) {
                          capsuleStyle.background = ACCENT.base;
                          capsuleStyle.boxShadow = "0 0 8px rgba(255,59,48,0.4)";
                          labelColor = ACCENT.text;
                        }

                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => setDayDetailIndex(index)}
                            aria-label={`${weekdayName(day.weekday ?? index)}: ${hasExercises ? `${day.exercises.length} ej.` : isRest ? "Descanso" : "Toca para asignar"}`}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 6,
                              padding: 0,
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            <div style={{ width: "100%", ...capsuleStyle }} />
                            <span
                              style={{
                                fontFamily: TYPE.mono.font,
                                fontSize: 10,
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                color: labelColor,
                              }}
                            >
                              {weekdayInitial(day.weekday ?? index)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 7-Day List - Apple Fitness+ Style: Individual Cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {draft.days.map((day, index) => {
                      const count = day.exercises.length;
                      const hasExercises = count > 0;
                      const isRest = day.kind === "rest";
                      const muscles = dayMuscleSummary(day);

                      let indicatorBg: string = "#2C2C2E";
                      let indicatorBorder: string = "rgba(255,255,255,0.08)";
                      let indicatorColor: string = TEXT.tertiary;
                      let dayNameColor: string = TEXT.primary;
                      let subtitleText = "";
                      let subtitleColor: string = TEXT.tertiary;
                      let rightAction: React.ReactNode = null;

                      if (isRest) {
                        indicatorBg = "rgba(255,255,255,0.03)";
                        indicatorBorder = "rgba(255,255,255,0.05)";
                        indicatorColor = TEXT.disabled;
                        dayNameColor = TEXT.tertiary;
                        subtitleText = "Recuperación muscular";
                        subtitleColor = TEXT.disabled;
                        rightAction = (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: `2px 12px`,
                              borderRadius: 9999,
                              background: "rgba(255,255,255,0.04)",
                              color: TEXT.tertiary,
                            }}
                          >
                            Descanso
                          </span>
                        );
                      } else if (hasExercises) {
                        indicatorBg = "rgba(255,59,48,0.15)";
                        indicatorBorder = "rgba(255,59,48,0.4)";
                        indicatorColor = ACCENT.text;
                        subtitleText = muscles ? `${muscles} • ${count} ej.` : `${count} ej.`;
                        subtitleColor = TEXT.tertiary;
                        rightAction = (
                          <span
                            style={{
                              fontFamily: TYPE.mono.font,
                              fontSize: 11,
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                              padding: `2px 12px`,
                              borderRadius: 9999,
                              background: "rgba(255,59,48,0.15)",
                              color: ACCENT.text,
                            }}
                          >
                            {count} ej.
                          </span>
                        );
                      } else {
                        subtitleText = "Toca para asignar ejercicios";
                        rightAction = (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: `4px 12px`,
                              borderRadius: 9999,
                              background: "rgba(255,255,255,0.05)",
                              color: TEXT.tertiary,
                            }}
                          >
                            + Configurar
                          </span>
                        );
                      }

                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => setDayDetailIndex(index)}
                          aria-label={`${weekdayName(day.weekday ?? index)}: ${hasExercises ? `${count} ejercicios` : isRest ? "Descanso" : "Sin ejercicios"}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            width: "100%",
                            minHeight: 64,
                            padding: "0 16px",
                            borderRadius: "24px",
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "#1C1C1E",
                            color: TEXT.primary,
                            textAlign: "left",
                            cursor: "pointer",
                            transition,
                          }}
                        >
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                            <div
                              aria-hidden="true"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 44,
                                height: 44,
                                borderRadius: "12px",
                                flexShrink: 0,
                                fontFamily: TYPE.mono.font,
                                fontSize: 12,
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                background: indicatorBg,
                                border: `1px solid ${indicatorBorder}`,
                                color: indicatorColor,
                              }}
                            >
                              {weekdayInitial(day.weekday ?? index)}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                              <span
                                style={{
                                  fontSize: 15,
                                  lineHeight: 20,
                                  fontWeight: 700,
                                  letterSpacing: -0.005,
                                  color: dayNameColor,
                                }}
                              >
                                {weekdayName(day.weekday ?? index)}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  lineHeight: 18,
                                  fontWeight: 400,
                                  color: subtitleColor,
                                }}
                              >
                                {subtitleText}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {rightAction}
                            <ChevronRight size={16} color={TEXT.tertiary} aria-hidden="true" style={{ flexShrink: 0 }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Adaptation period note */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "16px",
                      borderRadius: "24px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(28,28,30,0.6)",
                    }}
                  >
                    <Flame size={16} color={ACCENT.text} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: TYPE.mono.font,
                          fontSize: TYPE.label.size,
                          lineHeight: TYPE.label.lineHeight,
                          fontWeight: TYPE.label.weight,
                          letterSpacing: TYPE.label.tracking,
                          color: TEXT.secondary,
                          textTransform: "uppercase",
                        }}
                      >
                        Periodo de adaptación recomendado
                      </p>
                      <p style={{ margin: "8px 0 0", fontSize: TYPE.caption.size, lineHeight: TYPE.caption.lineHeight, color: TEXT.secondary }}>
                        Mantén este programa entre 6 a 12 semanas. Cambiar de rutina constantemente impide la adaptación neuromuscular y la sobrecarga progresiva.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                /* Single Mode: Exercise List with Editorial Empty State */
                <section aria-label="Ejercicios" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: TYPE.label.size,
                      lineHeight: TYPE.label.lineHeight,
                      fontWeight: TYPE.label.weight,
                      letterSpacing: TYPE.label.tracking,
                      color: TEXT.tertiary,
                      textTransform: "uppercase",
                    }}
                  >
                    Ejercicios
                  </p>
                  {(draft.days[0]?.exercises.length ?? 0) > 0
                    ? draft.days[0]!.exercises.map((ex, exIndex) => (
                        <div
                          key={ex.rowId ?? `${ex.exercise.id}-${exIndex}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            minHeight: 56,
                            padding: "20px",
                            borderRadius: "24px",
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: SOLID.card,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
                              {ex.exercise.name_es || ex.exercise.name}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                fontFamily: TYPE.mono.font,
                                fontSize: TYPE.caption.size,
                                fontVariantNumeric: "tabular-nums",
                                color: TEXT.tertiary,
                              }}
                            >
                              {ex.target_sets} series
                              {ex.target_reps_min != null || ex.target_reps_max != null
                                ? ` · ${ex.target_reps_min ?? "?"}–${ex.target_reps_max ?? "?"} reps`
                                : ""}
                              {ex.rest_seconds ? ` · ${ex.rest_seconds}s` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExercise(0, exIndex)}
                            aria-label={`Quitar ${ex.exercise.name_es || ex.exercise.name}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 44,
                              height: 44,
                              border: "none",
                              borderRadius: 12,
                              background: "transparent",
                              color: TEXT.tertiary,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                        </div>
                      ))
                    : (
                      /* Editorial Empty State Hero Card */
                      <div
                        style={{
                          borderRadius: "24px",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "#1C1C1E",
                          padding: "32px 20px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          gap: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 48,
                            height: 48,
                            borderRadius: "20px",
                            background: "rgba(255,59,48,0.1)",
                            border: `1px solid ${ACCENT.border}`,
                            color: ACCENT.text,
                          }}
                        >
                          <Dumbbell size={24} aria-hidden="true" />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 260 }}>
                          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TEXT.primary }}>
                            Estructura tu sesión
                          </p>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 20, color: TEXT.tertiary }}>
                            Añade movimientos del catálogo para calcular series, músculos trabajados y duración.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenExercisePicker(0)}
                          style={{
                            width: "100%",
                            height: 44,
                            borderRadius: "16px",
                            background: ACCENT.base,
                            color: TEXT.onAccent,
                            fontSize: 15,
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            boxShadow: "0 4px 16px rgba(255,59,48,0.25)",
                          }}
                        >
                          <Plus size={18} aria-hidden="true" />
                          Añadir ejercicios
                        </button>
                      </div>
                    )}
                  <button
                    type="button"
                    onClick={() => onOpenExercisePicker(0)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      width: "100%",
                      minHeight: 56,
                      padding: "0 16px",
                      borderRadius: "24px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: SOLID.card,
                      color: ACCENT.text,
                      cursor: "pointer",
                      textAlign: "left",
                      transition,
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 32,
                          height: 32,
                          borderRadius: 9999,
                          background: ACCENT.subtle,
                          color: ACCENT.text,
                          flexShrink: 0,
                        }}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </span>
                      <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600, color: ACCENT.text }}>Añadir ejercicio</span>
                    </span>
                    <ChevronRight size={16} color={TEXT.tertiary} aria-hidden="true" />
                  </button>
                </section>
              )}

              {saveResult && !saveResult.ok ? (
                <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }} aria-live="polite">
                  {CRONOS_LABELS.saveError}
                </p>
              ) : null}
            </>
          ) : detailDay ? (
            /* Day Detail View */
            <section aria-label={`Ejercicios de ${weekdayName(detailDay.weekday ?? dayDetailIndex)}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Native iOS Toggle for Rest Day */}
              <button
                type="button"
                onClick={() => setDayRest(dayDetailIndex, detailDay.kind !== "rest" || detailDay.exercises.length > 0)}
                aria-pressed={detailDay.kind === "rest" && detailDay.exercises.length === 0}
                aria-label="Marcar como día de descanso"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: `1px solid ${detailDay.kind === "rest" && detailDay.exercises.length === 0 ? ACCENT.border : "rgba(255,255,255,0.08)"}`,
                  background: detailDay.kind === "rest" && detailDay.exercises.length === 0 ? "rgba(255,59,48,0.12)" : "rgba(28,28,30,0.6)",
                  color: detailDay.kind === "rest" && detailDay.exercises.length === 0 ? ACCENT.text : TEXT.secondary,
                  fontSize: TYPE.subhead.size,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span>Día de descanso</span>
                <div
                  style={{
                    position: "relative",
                    width: 48,
                    height: 28,
                    borderRadius: 9999,
                    background: detailDay.kind === "rest" && detailDay.exercises.length === 0 ? ACCENT.base : "#2C2C2E",
                    border: "none",
                    transition: reducedMotion ? "none" : "background 200ms ease",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      left: detailDay.kind === "rest" && detailDay.exercises.length === 0 ? 24 : 2,
                      width: 24,
                      height: 24,
                      borderRadius: 9999,
                      background: "white",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      transition: reducedMotion ? "none" : "left 200ms ease",
                    }}
                  />
                </div>
              </button>

              {detailDay.exercises.map((ex: DraftExercise, exIndex: number) => (
                <div
                  key={ex.rowId ?? `${ex.exercise.id}-${exIndex}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "20px",
                    borderRadius: "24px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: SOLID.card,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
                      {ex.exercise.name_es || ex.exercise.name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: TYPE.mono.font,
                        fontSize: TYPE.caption.size,
                        fontVariantNumeric: "tabular-nums",
                        color: TEXT.tertiary,
                      }}
                    >
                      {ex.target_sets} series
                      {ex.target_reps_min != null || ex.target_reps_max != null
                        ? ` · ${ex.target_reps_min ?? "?"}–${ex.target_reps_max ?? "?"} reps`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(dayDetailIndex, exIndex)}
                    aria-label={`Quitar ${ex.exercise.name_es || ex.exercise.name}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 44,
                      height: 44,
                      border: "none",
                      borderRadius: 12,
                      background: "transparent",
                      color: TEXT.tertiary,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              ))}

              {/* Editorial Empty State for Day Detail */}
              {detailDay.exercises.length === 0 && (
                <div
                  style={{
                    borderRadius: "24px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#1C1C1E",
                    padding: "32px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 48,
                      height: 48,
                      borderRadius: "20px",
                      background: "rgba(255,59,48,0.1)",
                      border: `1px solid ${ACCENT.border}`,
                      color: ACCENT.text,
                    }}
                  >
                    <Dumbbell size={24} aria-hidden="true" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 260 }}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TEXT.primary }}>
                      Estructura tu sesión
                    </p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 20, color: TEXT.tertiary }}>
                      Añade movimientos del catálogo para calcular series, músculos trabajados y duración.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenExercisePicker(dayDetailIndex)}
                    style={{
                      width: "100%",
                      height: 44,
                      borderRadius: "16px",
                      background: ACCENT.base,
                      color: TEXT.onAccent,
                      fontSize: 15,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 4px 16px rgba(255,59,48,0.25)",
                    }}
                  >
                    <Plus size={18} aria-hidden="true" />
                    Añadir ejercicios
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => onOpenExercisePicker(dayDetailIndex)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  minHeight: 56,
                  padding: "0 16px",
                  borderRadius: "24px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: SOLID.card,
                  color: ACCENT.text,
                  cursor: "pointer",
                  textAlign: "left",
                  transition,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 9999,
                      background: ACCENT.subtle,
                      color: ACCENT.text,
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                  </span>
                  <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600, color: ACCENT.text }}>
                    {`Añadir ejercicios a ${weekdayName(detailDay.weekday ?? dayDetailIndex)}`}
                  </span>
                </span>
                <ChevronRight size={16} color={TEXT.tertiary} aria-hidden="true" />
              </button>
            </section>
          ) : null}
        </div>
      </div>

      <UnifiedExerciseSelectorSheet
        key={`picker-${targetDayIndex}-${pickerOpen}`}
        isOpen={pickerOpen}
        mode="multiple"
        onClose={closePicker}
        dayContext={dayContext}
        onSelectMultiple={handleSelectMultiple}
      />

      {closeConfirmOpen ? (
        <div
          role="presentation"
          onClick={() => setCloseConfirmOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: SPACE.md,
            background: SCRIM.modal,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cambios sin guardar"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: RADIUS.card,
              border: `1px solid ${GLASS.borderStrong}`,
              background: SOLID.popover,
              padding: SPACE.card,
              display: "flex",
              flexDirection: "column",
              gap: SPACE.sm,
            }}
          >
            <h3 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 700, color: TEXT.primary }}>
              Tienes cambios sin guardar
            </h3>
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
              ¿Qué deseas hacer antes de cerrar?
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
              <button
                type="button"
                onClick={async () => {
                  setCloseConfirmOpen(false);
                  await handleSave();
                }}
                disabled={saving || !canSave}
                style={{
                  minHeight: MOTION.minTouchTarget,
                  padding: `0 ${SPACE.md}px`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${ACCENT.base}`,
                  background: "transparent",
                  color: ACCENT.text,
                  fontWeight: 700,
                  cursor: saving || !canSave ? "not-allowed" : "pointer",
                  opacity: saving || !canSave ? 0.4 : 1,
                }}
              >
                Guardar y salir
              </button>
              <button
                type="button"
                onClick={() => {
                  setCloseConfirmOpen(false);
                  onClose();
                }}
                style={{
                  minHeight: MOTION.minTouchTarget,
                  padding: `0 ${SPACE.md}px`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.border}`,
                  background: "transparent",
                  color: TEXT.secondary,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Descartar cambios
              </button>
              <button
                type="button"
                onClick={() => setCloseConfirmOpen(false)}
                style={{
                  minHeight: MOTION.minTouchTarget,
                  padding: `0 ${SPACE.md}px`,
                  borderRadius: RADIUS.control,
                  border: "none",
                  background: "transparent",
                  color: TEXT.tertiary,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}