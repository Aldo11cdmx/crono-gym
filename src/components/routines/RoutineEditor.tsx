import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Plus, Trash2 } from "lucide-react";
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
  /** Modo inicial al crear (hint desde Bloque 1). `split` se mapea a `weekly`. */
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
  const sorted = [...byDay.keys()].sort((a, b) => a - b);
  for (let i = 0; i < 7; i += 1) {
    const dayExs = sorted[i] !== undefined ? byDay.get(sorted[i]) ?? [] : [];
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
    const label = (ex.exercise.body_part ? translateMuscle(raw) : translateTarget(raw)).toUpperCase();
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
    if (labels.length >= 2) break;
  }
  return labels.length > 0 ? labels.join(" • ") : null;
}

function dayMetrics(day: RoutineDay): string | null {
  if (day.exercises.length === 0) return null;
  const totalSets = day.exercises.reduce((sum, ex) => sum + (ex.target_sets ?? 0), 0);
  const restSec = day.exercises.reduce((sum, ex) => sum + (ex.target_sets ?? 0) * (ex.rest_seconds ?? 0), 0);
  const minutes = Math.max(1, Math.round((totalSets * 45 + restSec) / 60));
  return `${day.exercises.length} ej. • ~${minutes} min`;
}

export function RoutineEditor({ mode, routine, initialPlanMode, onSave, onClose }: RoutineEditorProps) {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetDayIndex, setTargetDayIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [dayDetailIndex, setDayDetailIndex] = useState<number | null>(null);
  const [draftMode, setDraftMode] = useState<"single" | "weekly">(
    initialPlanMode === "weekly" || initialPlanMode === "split" ? "weekly" : "single",
  );

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
    setDraft((d) => ({ ...d, title: e.target.value }));
  }, []);

  const addExerciseToDay = useCallback((dayIndex: number, exercise: Exercise) => {
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      const day = next[dayIndex];
      next[dayIndex] = { ...day, kind: "training", exercises: [...day.exercises, draftExercise(exercise, day.exercises.length)] };
      return { ...d, days: next };
    });
    setPickerOpen(false);
    setTargetDayIndex(null);
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
    setSaving(true);
    setSaveResult(null);
    try {
      const promise = saveRoutine(userId, draft, "editor");
      await flushSave(draft.draftKey);
      const result = await promise;
      setSaveResult(result);
      if (result.ok) {
        initialDraftRef.current = draft;
        onSave();
      }
    } finally {
      setSaving(false);
    }
  }, [userId, draft, onSave]);

  const problems = validateDraft(draft);
  const hasValidationErrors = problems.length > 0;
  const canSave = draft.title.trim().length >= 3 && !hasValidationErrors;

  const handleClose = useCallback(() => {
    if (dirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const openPickerForDay = useCallback((dayIndex: number) => {
    setTargetDayIndex(dayIndex);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setTargetDayIndex(null);
  }, []);

  const dayContext = useMemo(() => {
    const idx = targetDayIndex ?? 0;
    const day = draft.days[idx];
    if (!day) return undefined;
    return { dayIndex: idx, dayLabel: day.label, dayExercises: day.exercises.map((ex) => ex.exercise) };
  }, [draft, targetDayIndex]);

  const isWeekly = draft.mode === "weekly" || draftMode === "weekly";
  const headerTitle = mode === "edit" ? "Editar rutina" : isWeekly ? "Plan Semanal" : "Nueva Rutina";
  const transition = reducedMotion ? undefined : `transform ${MOTION.fast} ${MOTION.easeOut}, opacity ${MOTION.fast} ${MOTION.easeOut}`;

  const nameInput = (
    <input
      type="text"
      value={draft.title}
      onChange={setTitle}
      placeholder={isWeekly ? "Nombre del programa…" : CRONOS_LABELS.namePlaceholder}
      aria-label="Nombre de la rutina"
      style={{
        width: "100%",
        border: "none",
        background: "transparent",
        color: TEXT.primary,
        fontSize: TYPE.hero.size,
        lineHeight: TYPE.hero.lineHeight,
        fontWeight: 900,
        letterSpacing: TYPE.hero.tracking,
        padding: `${SPACE.xs}px 0 0`,
        marginBottom: SPACE.lg,
        outline: "none",
      }}
    />
  );

  const addRow = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        minHeight: 56,
        padding: `0 ${SPACE.md}px`,
        borderRadius: RADIUS.card,
        border: `1px solid ${GLASS.border}`,
        background: SOLID.card,
        color: ACCENT.text,
        cursor: "pointer",
        textAlign: "left",
        transition,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: SPACE.sm, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: RADIUS.pill,
            background: ACCENT.subtle,
            color: ACCENT.text,
            flexShrink: 0,
          }}
        >
          <Plus size={16} aria-hidden="true" />
        </span>
        <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600, color: ACCENT.text }}>{label}</span>
      </span>
      <ChevronRight size={16} color={TEXT.tertiary} aria-hidden="true" />
    </button>
  );

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
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: SPACE.xs,
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          borderBottom: `1px solid ${GLASS.border}`,
          background: SOLID.card,
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
            padding: 0,
            border: "none",
            background: "transparent",
            color: TEXT.secondary,
            fontSize: TYPE.subhead.size,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {dayDetailIndex != null ? <ChevronLeft size={18} aria-hidden="true" /> : null}
          {dayDetailIndex != null ? ROUTINES_UI_LABELS.back : ROUTINES_UI_LABELS.cancel}
        </button>
        <h2 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 700, color: TEXT.primary, textAlign: "center" }}>
          {dayDetailIndex != null ? weekdayName(draft.days[dayDetailIndex]?.weekday ?? dayDetailIndex) : headerTitle}
        </h2>
        <button
          type="button"
          onClick={dayDetailIndex != null ? () => setDayDetailIndex(null) : () => void handleSave()}
          disabled={dayDetailIndex != null ? false : saving || !canSave}
          aria-label={dayDetailIndex != null ? "Listo" : "Guardar rutina"}
          style={{
            justifySelf: "end",
            minHeight: MOTION.minTouchTarget,
            padding: 0,
            border: "none",
            background: "transparent",
            color: ACCENT.text,
            fontSize: TYPE.subhead.size,
            fontWeight: 700,
            cursor: dayDetailIndex == null && (saving || !canSave) ? "not-allowed" : "pointer",
            opacity: dayDetailIndex == null && (saving || !canSave) ? 0.4 : 1,
          }}
        >
          {dayDetailIndex != null ? "Listo" : saving ? CRONOS_LABELS.saving : "Guardar"}
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: `${SPACE.xs}px ${SPACE.md}px ${SPACE.xl}px` }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: SPACE.md }}>
          {dayDetailIndex == null ? (
            <>
              {nameInput}

              {isWeekly ? (
                <section aria-label="Plan semanal" style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: SPACE.xs,
                    }}
                  >
                    <span
                      style={{
                        fontSize: TYPE.label.size,
                        lineHeight: TYPE.label.lineHeight,
                        fontWeight: TYPE.label.weight,
                        letterSpacing: TYPE.label.tracking,
                        color: TEXT.tertiary,
                        textTransform: "uppercase",
                        fontFamily: TYPE.mono.font,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Progreso semanal • {draft.days.filter((d) => d.exercises.length > 0 || d.kind === "rest").length} de 7 días
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                      gap: 6,
                      marginBottom: SPACE.lg,
                    }}
                    aria-hidden="true"
                  >
                    {draft.days.map((day) => {
                      const planned = day.exercises.length > 0 || day.kind === "rest";
                      return (
                        <span
                          key={day.id}
                          style={{
                            height: 8,
                            borderRadius: RADIUS.pill,
                            background: planned ? ACCENT.base : GLASS.fillSubtle,
                            boxShadow: day.exercises.length > 0 ? ACCENT.glow : "none",
                          }}
                        />
                      );
                    })}
                  </div>

                  <div
                    style={{
                      borderRadius: RADIUS.card,
                      border: `1px solid ${GLASS.borderStrong}`,
                      background: SOLID.card,
                      overflow: "hidden",
                      boxShadow: GLASS.shadow,
                    }}
                  >
                    {draft.days.map((day, index) => {
                      const count = day.exercises.length;
                      const configured = count > 0;
                      const muscles = dayMuscleSummary(day);
                      const metrics = dayMetrics(day);
                      const subtitle = configured
                        ? muscles ?? metrics ?? `${count} ej.`
                        : day.kind === "rest"
                          ? "Descanso"
                          : "Sin ejercicios";
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => setDayDetailIndex(index)}
                          aria-label={`${weekdayName(day.weekday ?? index)}: ${configured ? `${count} ej.` : day.kind === "rest" ? "Descanso" : "Sin ejercicios"}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: SPACE.sm,
                            width: "100%",
                            minHeight: 64,
                            padding: `0 ${SPACE.md}px`,
                            border: "none",
                            borderBottom: index < draft.days.length - 1 ? `1px solid ${GLASS.border}` : "none",
                            background: "transparent",
                            color: TEXT.primary,
                            textAlign: "left",
                            cursor: "pointer",
                            transition,
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                            <span
                              aria-hidden="true"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 36,
                                height: 36,
                                borderRadius: RADIUS.pill,
                                flexShrink: 0,
                                fontFamily: TYPE.mono.font,
                                fontSize: TYPE.caption.size,
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                background: configured ? ACCENT.subtle : GLASS.fillSubtle,
                                border: `1px solid ${configured ? ACCENT.border : GLASS.border}`,
                                color: configured ? ACCENT.text : TEXT.tertiary,
                                boxShadow: configured ? ACCENT.glow : "none",
                              }}
                            >
                              {weekdayInitial(day.weekday ?? index)}
                            </span>
                            <span style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                              <span
                                style={{
                                  fontSize: TYPE.subhead.size,
                                  lineHeight: TYPE.subhead.lineHeight,
                                  fontWeight: 700,
                                  letterSpacing: TYPE.subhead.tracking,
                                  color: TEXT.primary,
                                }}
                              >
                                {weekdayName(day.weekday ?? index)}
                              </span>
                              <span
                                style={{
                                  fontFamily: TYPE.mono.font,
                                  fontSize: TYPE.caption.size,
                                  lineHeight: TYPE.caption.lineHeight,
                                  fontWeight: configured ? 500 : 400,
                                  fontVariantNumeric: "tabular-nums",
                                  color: day.kind === "rest" && !configured ? TEXT.tertiary : configured ? TEXT.secondary : TEXT.tertiary,
                                  textTransform: day.kind === "rest" && !configured ? "uppercase" : undefined,
                                  letterSpacing: day.kind === "rest" && !configured ? TYPE.label.tracking : undefined,
                                }}
                              >
                                {subtitle}
                              </span>
                            </span>
                          </span>
                          <ChevronRight size={16} color={TEXT.tertiary} aria-hidden="true" style={{ flexShrink: 0 }} />
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: SPACE.sm,
                      marginTop: SPACE.md,
                      marginBottom: SPACE.lg,
                      padding: SPACE.md,
                      borderRadius: RADIUS.card,
                      border: `1px solid ${GLASS.border}`,
                      background: GLASS.fillSubtle,
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
                      <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: TYPE.caption.size, lineHeight: TYPE.caption.lineHeight, color: TEXT.secondary }}>
                        Mantén este programa entre 6 a 12 semanas. Cambiar de rutina constantemente impide la adaptación neuromuscular y la sobrecarga progresiva.
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <section aria-label="Ejercicios" style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
                  <p
                    style={{
                      margin: `0 0 ${SPACE.xs}px`,
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
                            gap: SPACE.sm,
                            minHeight: 56,
                            padding: SPACE.md,
                            borderRadius: RADIUS.card,
                            border: `1px solid ${GLASS.border}`,
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
                              width: MOTION.minTouchTarget,
                              height: MOTION.minTouchTarget,
                              border: "none",
                              borderRadius: RADIUS.control,
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
                    : null}
                  {addRow("Añadir ejercicio", () => openPickerForDay(0))}
                </section>
              )}

              {saveResult && !saveResult.ok ? (
                <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }} aria-live="polite">
                  {CRONOS_LABELS.saveError}
                </p>
              ) : null}
            </>
          ) : detailDay ? (
            <section aria-label={`Ejercicios de ${weekdayName(detailDay.weekday ?? dayDetailIndex)}`} style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
              <button
                type="button"
                onClick={() => setDayRest(dayDetailIndex, detailDay.kind !== "rest" || detailDay.exercises.length > 0)}
                aria-pressed={detailDay.kind === "rest" && detailDay.exercises.length === 0}
                aria-label="Marcar como día de descanso"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: SPACE.sm,
                  minHeight: MOTION.minTouchTarget,
                  padding: `0 ${SPACE.md}px`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${detailDay.kind === "rest" && detailDay.exercises.length === 0 ? ACCENT.border : GLASS.border}`,
                  background: detailDay.kind === "rest" && detailDay.exercises.length === 0 ? ACCENT.subtle : GLASS.fillSubtle,
                  color: detailDay.kind === "rest" && detailDay.exercises.length === 0 ? ACCENT.text : TEXT.secondary,
                  fontSize: TYPE.subhead.size,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span>Día de descanso</span>
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: TYPE.mono.font,
                    fontSize: TYPE.label.size,
                    fontWeight: TYPE.label.weight,
                    letterSpacing: TYPE.label.tracking,
                    textTransform: "uppercase",
                    color: detailDay.kind === "rest" && detailDay.exercises.length === 0 ? ACCENT.text : TEXT.tertiary,
                  }}
                >
                  {detailDay.kind === "rest" && detailDay.exercises.length === 0 ? "Activo" : "No"}
                </span>
              </button>

              {detailDay.exercises.map((ex, exIndex) => (
                <div
                  key={ex.rowId ?? `${ex.exercise.id}-${exIndex}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: SPACE.sm,
                    padding: SPACE.md,
                    borderRadius: RADIUS.card,
                    border: `1px solid ${GLASS.border}`,
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
                      width: MOTION.minTouchTarget,
                      height: MOTION.minTouchTarget,
                      border: "none",
                      borderRadius: RADIUS.control,
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
              {addRow(
                `Añadir ejercicios a ${weekdayName(detailDay.weekday ?? dayDetailIndex)}`,
                () => openPickerForDay(dayDetailIndex),
              )}
            </section>
          ) : null}
        </div>
      </div>

      <UnifiedExerciseSelectorSheet
        isOpen={pickerOpen}
        mode="single"
        onClose={closePicker}
        dayContext={dayContext}
        onSelectSingle={(exercise) => {
          if (targetDayIndex !== null) addExerciseToDay(targetDayIndex, exercise);
        }}
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