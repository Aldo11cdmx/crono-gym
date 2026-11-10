/**
 * RoutineEditor.tsx — armador de rutinas
 * 
 * - `single`: rutina individual, un solo día
 * - `weekly`: estudio semanal con navegación horizontal de días
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Moon, Play, List, Flame, ChevronLeft } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { Exercise } from "@/types/supabase";
import type { RoutineDraftV2, RoutineDay, DraftExercise } from "@/lib/routines/routineDayModel";
import { draftFromRoutine, validateDraft } from "@/lib/routines/routineDayModel";
import { saveRoutine, flushSave, subscribeSave, type SaveResult } from "@/lib/routines/saveRoutine";
import {
  estimateMinutes,
  getExerciseName,
  getRepLabel,
} from "@/lib/routines/routineDraftModel";
import { countMuscleSets } from "@/components/MuscleReadonlyMap";
import { UnifiedExerciseSelectorSheet } from "@/components/UnifiedExerciseSelectorSheet";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import type { Slug } from "react-muscle-highlighter";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  ACCENT,
  DANGER,
  GLASS,
  MOTION,
  RADIUS,
  SURFACE,
  TEXT,
  TYPE,
  SPACE,
  Z_INDEX,
} from "@/design/tokens";
import { translateMuscle } from "@/lib/i18n";

type EditorMode = "single" | "weekly";

interface RoutineEditorProps {
  routine?: RoutineWithExercises | null;
  onSave?: (result: SaveResult) => void;
  onClose: () => void;
}

const WEEKDAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const QUICK_CHIPS_SINGLE = ["Push", "Pull", "Pierna", "Torso", "Full Body", "Espalda & Bíceps"] as const;

function emptyDay(order: number, weekday: number | null, kind: RoutineDay["kind"]): RoutineDay {
  return {
    id: crypto.randomUUID(),
    order,
    weekday,
    label: "",
    kind,
    exercises: [],
  };
}

function dayTotalSets(day: RoutineDay): number {
  return day.exercises.reduce((sum, ex) => sum + ex.target_sets, 0);
}

function dayRestSeconds(day: RoutineDay): number {
  return day.exercises.reduce((sum, ex) => sum + ex.rest_seconds, 0);
}

function dayMuscleCounts(day: RoutineDay): Map<Slug, number> {
  return countMuscleSets(
    day.exercises.map((ex) => ({
      exercise: ex.exercise as { target: string; body_part: string },
      target_sets: ex.target_sets,
    })),
  );
}

export function RoutineEditor({ routine, onSave, onClose }: RoutineEditorProps) {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const reducedMotion = useReducedMotion();

  const [mode, setMode] = useState<EditorMode>("single");
  const [title, setTitle] = useState(routine?.title ?? "");
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "dirty" | "error">("idle");

  const [days, setDays] = useState<RoutineDay[]>(() => {
    if (routine) {
      const draft = draftFromRoutine(routine as unknown as never);
      const draftDays = Array.isArray(draft.days) ? draft.days : [];
      if (draft.mode === "weekly" || draftDays.length === 7) {
        return Array.from({ length: 7 }, (_, i) => {
          const day = draftDays[i] ?? draftDays.find((d) => d.weekday === i);
          return day && Array.isArray(day.exercises)
            ? { ...day, exercises: [...day.exercises] }
            : emptyDay(i, i, "training");
        });
      }
      return draftDays.length > 0
        ? draftDays.map((d) => ({ ...d, exercises: Array.isArray(d.exercises) ? [...d.exercises] : [] }))
        : [emptyDay(0, null, "training")];
    }
    return mode === "weekly"
      ? WEEKDAYS_SHORT.map((_, i) => emptyDay(i, i, "training"))
      : [emptyDay(0, null, "training")];
  });

  const safeDays = useMemo<RoutineDay[]>(() => {
    if (mode === "weekly") {
      return Array.from({ length: 7 }, (_, i) => {
        const day = days[i];
        if (day && Array.isArray(day.exercises)) {
          return { ...day, exercises: day.exercises };
        }
        return emptyDay(i, i, "training");
      });
    }
    return days.length > 0
      ? days.map((d) => ({ ...d, exercises: Array.isArray(d?.exercises) ? d.exercises : [] }))
      : [emptyDay(0, null, "training")];
  }, [days, mode]);

  const activeDay = safeDays[activeDayIndex] ?? safeDays[0] ?? emptyDay(0, null, "training");
  const activeDayExercises = Array.isArray(activeDay?.exercises) ? activeDay.exercises : [];

  const telemetry = useMemo(() => {
    const sourceDays = safeDays;
    const exerciseCount = sourceDays.reduce((sum, d) => sum + (Array.isArray(d.exercises) ? d.exercises.length : 0), 0);
    const totalSets = sourceDays.reduce((sum, d) => sum + dayTotalSets(d), 0);
    const restSec = sourceDays.reduce((sum, d) => sum + dayRestSeconds(d), 0);
    const minutes = estimateMinutes(exerciseCount, restSec);
    return { exerciseCount, totalSets, minutes };
  }, [safeDays]);

  const activeTelemetry = useMemo(() => {
    const counts = dayMuscleCounts(activeDay);
    return {
      exerciseCount: Array.isArray(activeDayExercises) ? activeDayExercises.length : 0,
      totalSets: dayTotalSets(activeDay),
      minutes: estimateMinutes(Array.isArray(activeDayExercises) ? activeDayExercises.length : 0, dayRestSeconds(activeDay)),
      counts,
    };
  }, [activeDay, activeDayExercises]);

  const hasAnyExercise = safeDays.some((d) => Array.isArray(d.exercises) && d.exercises.length > 0);
  const canSave = title.trim().length >= 3 && hasAnyExercise;

  const isWeeklyMode = mode === "weekly";

  const draftKeyRef = useRef<string>(crypto.randomUUID());

  const handleSave = useCallback(async () => {
    if (!userId) return;
    if (!canSave) return;
    const draft: RoutineDraftV2 = {
      draftKey: draftKeyRef.current,
      id: routine?.id ?? null,
      title: title.trim(),
      description: "",
      mode: mode === "weekly" ? "weekly" : "single",
      days: safeDays.map((d) => ({ ...d, exercises: Array.isArray(d.exercises) ? d.exercises.map((e) => ({ ...e })) : [] })),
      snapshot: null,
    };
    const problems = validateDraft(draft);
    if (problems.length > 0) return;
    setSaveStatus("saving");
    try {
      const result = await saveRoutine(userId, draft, "editor");
      await flushSave(draft.draftKey);
      setSaveStatus("idle");
      onSave?.(result);
      hapticSuccess();
    } catch {
      setSaveStatus("error");
    }
  }, [userId, canSave, title, mode, safeDays, routine?.id, onSave]);

  useEffect(() => {
    const unsub = subscribeSave(draftKeyRef.current, setSaveStatus);
    return () => unsub();
  }, []);

  const setDayLabel = useCallback((index: number, label: string) => {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, label } : d)),
    );
  }, []);

  const toggleRestDay = useCallback(() => {
    setDays((current) =>
      current.map((d, i) =>
        i === activeDayIndex ? { ...d, kind: d.kind === "rest" ? "training" : "rest" } : d,
      ),
    );
    hapticLight();
  }, [activeDayIndex]);

  const handleDayPress = useCallback((index: number) => {
    setActiveDayIndex(index);
    hapticLight();
  }, []);

  const addExercisesToDay = useCallback((exercises: Exercise[]) => {
    const next = exercises.map((ex) => ({
      rowId: crypto.randomUUID(),
      exercise: ex,
      target_sets: 3,
      target_reps_min: null,
      target_reps_max: null,
      rest_seconds: 90,
      order_index: activeDayExercises.length,
    }));
    setDays((prev) =>
      prev.map((d, i) =>
        i === activeDayIndex
          ? { ...d, exercises: [...d.exercises, ...next] }
          : d,
      ),
    );
    setSelectorOpen(false);
    hapticSuccess();
  }, [activeDayIndex, activeDayExercises.length]);

  const removeExerciseFromDay = useCallback((dayIndex: number, exerciseIndex: number) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const next = [...d.exercises];
        next.splice(exerciseIndex, 1);
        return { ...d, exercises: next.map((ex, idx) => ({ ...ex, order_index: idx })) };
      }),
    );
    hapticLight();
  }, []);

  const changeSets = useCallback((dayIndex: number, exerciseIndex: number, delta: number) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const next = [...d.exercises];
        const ex = next[exerciseIndex];
        if (!ex) return d;
        next[exerciseIndex] = { ...ex, target_sets: Math.max(1, ex.target_sets + delta) };
        return { ...d, exercises: next };
      }),
    );
    hapticLight();
  }, []);

  const changeReps = useCallback((dayIndex: number, exerciseIndex: number, delta: number) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const next = [...d.exercises];
        const ex = next[exerciseIndex];
        if (!ex) return d;
        const currentReps = ex.target_reps_min ?? ex.target_reps_max ?? 8;
        const newReps = Math.max(1, currentReps + delta);
        next[exerciseIndex] = { 
          ...ex, 
          target_reps_min: newReps,
          target_reps_max: newReps,
        };
        return { ...d, exercises: next };
      }),
    );
    hapticLight();
  }, []);

  const headerTitle = routine ? "Editar rutina" : "Nueva Rutina";

  const cardStyle = {
    borderRadius: RADIUS.card,
    border: `1px solid ${GLASS.border}`,
    background: SURFACE.raised,
  } as const;

  const weeklyContent = (
    <div>
      {/* Horizontal navigation bar at the top with grid-cols-7 */}
      <div style={{ marginBottom: SPACE.md }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
            padding: 6,
            borderRadius: RADIUS.card,
            border: `1px solid ${GLASS.border}`,
            background: SURFACE.raised,
          }}
          role="tablist"
          aria-label="Días de la semana"
        >
          {WEEKDAYS_SHORT.map((short, i) => {
            const day = safeDays[i];
            const hasExercises = Array.isArray(day?.exercises) ? day.exercises.length > 0 : false;
            const isActive = i === activeDayIndex;
            return (
              <button
                key={short}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`${WEEKDAYS_FULL[i]} ${hasExercises ? "con ejercicios" : day.kind === "rest" ? "día de descanso" : "sin ejercicios"}`}
                onClick={() => handleDayPress(i)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  borderRadius: "16px",
                  border: isActive
                    ? `1.5px solid ${ACCENT.base}`
                    : `1px solid ${GLASS.border}`,
                  background: isActive
                    ? ACCENT.subtle
                    : "transparent",
                  color: isActive ? TEXT.primary : TEXT.secondary,
                  fontSize: TYPE.label.size,
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing: TYPE.label.tracking,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: reducedMotion ? "none" : `all ${MOTION.fast} ${MOTION.standard}`,
                }}
              >
                {short}
                {hasExercises && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: ACCENT.base,
                      marginTop: 2,
                    }}
                    aria-hidden="true"
                  />
                )}
                {day?.kind === "rest" && !hasExercises && (
                  <Moon size={10} style={{ color: TEXT.tertiary, marginTop: 2 }} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content for currently active day only */}
      <div>
        {/* Hero card with MuscleReadonlyMap positioned on the right */}
        <GlassCard raised style={{ padding: SPACE.md, marginBottom: SPACE.md }}>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE.md }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: SPACE.xs }}>
                <span
                  style={{
                    fontSize: TYPE.label.size,
                    fontWeight: TYPE.label.weight,
                    letterSpacing: TYPE.label.tracking,
                    textTransform: "uppercase",
                    color: ACCENT.text,
                    fontFamily: TYPE.mono.font,
                  }}
                >
                  {WEEKDAYS_FULL[activeDayIndex].toUpperCase()}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={activeDay.label}
                    onChange={(e) => setDayLabel(activeDayIndex, e.target.value)}
                    placeholder="Enfoque del día (ej. Espalda y Bíceps)"
                    aria-label="Enfoque del día"
                    style={{
                      fontSize: TYPE.headline.size,
                      fontWeight: TYPE.headline.weight,
                      color: TEXT.primary,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      padding: 0,
                      minWidth: 0,
                      flex: 1,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: TYPE.mono.font,
                    fontSize: TYPE.caption.size,
                    fontWeight: TYPE.mono.weight,
                    letterSpacing: TYPE.mono.tracking,
                    color: TEXT.tertiary,
                  }}
                >
                  {activeDayExercises.length} ejercicios • {dayTotalSets(activeDay)} series • ~{activeTelemetry.minutes} min
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
                <label style={{ fontSize: TYPE.caption.size, color: TEXT.secondary, fontWeight: 600, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: SPACE.xs }}>
                  <input
                    type="checkbox"
                checked={activeDay?.kind === "rest"}
                onChange={toggleRestDay}
                    style={{ width: 20, height: 20, accentColor: ACCENT.base, cursor: "pointer" }}
                  />
                  Día de descanso
                </label>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.md }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {activeDayExercises.length > 0 && (
                  <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.secondary, textTransform: "uppercase", letterSpacing: TYPE.label.tracking, marginBottom: SPACE.xs }}>
                    Músculos del día
                  </p>
                )}
              </div>
              <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                <MuscleReadonlyMap
                  counts={activeTelemetry.counts}
                  side="front"
                  aspectRatio={1}
                  label={`Distribución muscular de ${WEEKDAYS_FULL[activeDayIndex]}`}
                  backgroundColor="transparent"
                  caption={null}
                />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Exercise list for active day with stepper controls for sets and repetitions */}
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.xs }}>
            <h3
              style={{
                margin: 0,
                fontSize: TYPE.headline.size,
                fontWeight: TYPE.headline.weight,
                color: TEXT.primary,
              }}
            >
              Ejercicios de {WEEKDAYS_FULL[activeDayIndex]}
            </h3>
            <GlassButton
              variant="primary"
              onClick={() => setSelectorOpen(true)}
              aria-label={`Añadir ejercicios a ${WEEKDAYS_FULL[activeDayIndex]}`}
              style={{ fontSize: TYPE.caption.size, fontWeight: 700, textTransform: "uppercase", letterSpacing: TYPE.label.tracking }}
            >
              <Plus size={16} aria-hidden="true" /> Añadir ejercicios
            </GlassButton>
          </div>

          {activeDayExercises.length === 0 ? (
            <GlassCard raised style={{ padding: `${SPACE.xl}px ${SPACE.sm}px`, textAlign: "center" }}>
              <Flame size={32} style={{ color: TEXT.tertiary, marginBottom: SPACE.sm }} aria-hidden="true" />
              <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
                Sin ejercicios aún. Añade el primero para este día.
              </p>
            </GlassCard>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
              {activeDayExercises.map((ex, idx) => (
                <div
                  key={ex.rowId ?? ex.exercise.id}
                  style={{
                    ...cardStyle,
                    padding: `${SPACE.sm}px ${SPACE.md}px`,
                    display: "flex",
                    flexDirection: "column",
                    gap: SPACE.sm,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
                    <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: RADIUS.surface,
                          overflow: "hidden",
                          background: GLASS.fillSubtle,
                          flexShrink: 0,
                        }}
                      >
                        <Play size={18} style={{ color: TEXT.primary }} aria-hidden="true" />
                      </div>
                      <div style={{ minWidth: 0, marginLeft: SPACE.sm }}>
                        <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {getExerciseName(ex.exercise as Exercise)}
                        </p>
                        <p style={{ margin: `2px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                          {translateMuscle(ex.exercise.body_part)} • {getRepLabel(ex as unknown as DraftExercise)}
                        </p>
                      </div>
                    </div>
                    <GlassButton variant="ghost" onClick={() => removeExerciseFromDay(activeDayIndex, idx)} aria-label="Eliminar ejercicio" style={{ width: 32, height: 32, padding: 0, color: DANGER.text }}>
                      <Trash2 size={16} aria-hidden="true" />
                    </GlassButton>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
                      <span style={{ fontSize: TYPE.caption.size, color: TEXT.secondary, minWidth: 50 }}>Series</span>
                      <GlassButton variant="ghost" onClick={() => changeSets(activeDayIndex, idx, -1)} aria-label="Quitar serie" style={{ width: 32, height: 32, padding: 0, fontSize: TYPE.caption.size, fontWeight: 700 }}>-</GlassButton>
                      <span style={{ fontFamily: TYPE.mono.font, fontSize: TYPE.caption.size, fontWeight: TYPE.mono.weight, color: TEXT.primary, minWidth: 32, textAlign: "center" }}>
                        {ex.target_sets}
                      </span>
                      <GlassButton variant="ghost" onClick={() => changeSets(activeDayIndex, idx, 1)} aria-label="Añadir serie" style={{ width: 32, height: 32, padding: 0, fontSize: TYPE.caption.size, fontWeight: 700 }}>+</GlassButton>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
                      <span style={{ fontSize: TYPE.caption.size, color: TEXT.secondary, minWidth: 50 }}>Reps</span>
                      <GlassButton variant="ghost" onClick={() => changeReps(activeDayIndex, idx, -1)} aria-label="Quitar repetición" style={{ width: 32, height: 32, padding: 0, fontSize: TYPE.caption.size, fontWeight: 700 }}>-</GlassButton>
                      <span style={{ fontFamily: TYPE.mono.font, fontSize: TYPE.caption.size, fontWeight: TYPE.mono.weight, color: TEXT.primary, minWidth: 32, textAlign: "center" }}>
                        {ex.target_reps_min ?? ex.target_reps_max ?? 8}
                      </span>
                      <GlassButton variant="ghost" onClick={() => changeReps(activeDayIndex, idx, 1)} aria-label="Añadir repetición" style={{ width: 32, height: 32, padding: 0, fontSize: TYPE.caption.size, fontWeight: 700 }}>+</GlassButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <UnifiedExerciseSelectorSheet
          isOpen={selectorOpen}
          onClose={() => setSelectorOpen(false)}
          mode="multiple"
          onSelectMultiple={addExercisesToDay}
          title="Seleccionar ejercicios"
          dayContext={{
            dayIndex: activeDayIndex,
            dayLabel: activeDay?.label ?? "",
            dayExercises: Array.isArray(activeDay?.exercises) ? (activeDay.exercises.map((ex) => ex.exercise as Exercise)) : [],
          }}
        />
      </div>
    </div>
  );

  const singleContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.xs }}>
        <h3 style={{ margin: 0, fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight, color: TEXT.primary }}>Ejercicios</h3>
        <GlassButton
          variant="primary"
          onClick={() => setSelectorOpen(true)}
          aria-label="Añadir ejercicio"
          style={{ fontSize: TYPE.caption.size, fontWeight: 700, textTransform: "uppercase", letterSpacing: TYPE.label.tracking }}
        >
          <Plus size={16} aria-hidden="true" /> Añadir ejercicio
        </GlassButton>
      </div>

              {days[0]?.exercises?.length === 0 ? (
        <GlassCard raised style={{ padding: `${SPACE.xl}px ${SPACE.sm}px`, textAlign: "center" }}>
          <List size={32} style={{ color: TEXT.tertiary, marginBottom: SPACE.sm }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
            Sin ejercicios aún. Añade el primero a tu rutina individual.
          </p>
        </GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          {days[0]?.exercises?.map((ex, idx) => (
            <div
              key={ex.rowId ?? ex.exercise.id}
              style={{
                ...cardStyle,
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                display: "flex",
                flexDirection: "column",
                gap: SPACE.sm,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
                <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: RADIUS.surface,
                      overflow: "hidden",
                      background: GLASS.fillSubtle,
                      flexShrink: 0,
                    }}
                  >
                    <Play size={18} style={{ color: TEXT.primary }} aria-hidden="true" />
                  </div>
                  <div style={{ minWidth: 0, marginLeft: SPACE.sm }}>
                    <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {getExerciseName(ex.exercise as Exercise)}
                    </p>
                    <p style={{ margin: `2px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                      {translateMuscle(ex.exercise.body_part)} • {getRepLabel(ex as unknown as DraftExercise)}
                    </p>
                  </div>
                </div>
                <GlassButton variant="ghost" onClick={() => removeExerciseFromDay(0, idx)} aria-label="Eliminar ejercicio" style={{ width: 32, height: 32, padding: 0, color: DANGER.text }}>
                  <Trash2 size={16} aria-hidden="true" />
                </GlassButton>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
                  <span style={{ fontSize: TYPE.caption.size, color: TEXT.secondary, minWidth: 50 }}>Series</span>
                  <GlassButton variant="ghost" onClick={() => changeSets(0, idx, -1)} aria-label="Quitar serie" style={{ width: 32, height: 32, padding: 0, fontSize: TYPE.caption.size, fontWeight: 700 }}>-</GlassButton>
                  <span style={{ fontFamily: TYPE.mono.font, fontSize: TYPE.caption.size, fontWeight: TYPE.mono.weight, color: TEXT.primary, minWidth: 32, textAlign: "center" }}>
                    {ex.target_sets}
                  </span>
                  <GlassButton variant="ghost" onClick={() => changeSets(0, idx, 1)} aria-label="Añadir serie" style={{ width: 32, height: 32, padding: 0, fontSize: TYPE.caption.size, fontWeight: 700 }}>+</GlassButton>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
                  <span style={{ fontSize: TYPE.caption.size, color: TEXT.secondary, minWidth: 50 }}>Reps</span>
                  <GlassButton variant="ghost" onClick={() => changeReps(0, idx, -1)} aria-label="Quitar repetición" style={{ width: 32, height: 32, padding: 0, fontSize: TYPE.caption.size, fontWeight: 700 }}>-</GlassButton>
                  <span style={{ fontFamily: TYPE.mono.font, fontSize: TYPE.caption.size, fontWeight: TYPE.mono.weight, color: TEXT.primary, minWidth: 32, textAlign: "center" }}>
                    {ex.target_reps_min ?? ex.target_reps_max ?? 8}
                  </span>
                  <GlassButton variant="ghost" onClick={() => changeReps(0, idx, 1)} aria-label="Añadir repetición" style={{ width: 32, height: 32, padding: 0, fontSize: TYPE.caption.size, fontWeight: 700 }}>+</GlassButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UnifiedExerciseSelectorSheet
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        mode="single"
        onSelectSingle={(exercise) => {
          const next: DraftExercise = {
            rowId: crypto.randomUUID(),
            exercise: exercise as Exercise,
            target_sets: 3,
            target_reps_min: 8,
            target_reps_max: 8,
            rest_seconds: 90,
            order_index: days[0]?.exercises?.length ?? 0,
          };
          setDays((prev) =>
            prev.map((d, i) => (i === 0 ? { ...d, exercises: [...d.exercises, next] } : d)),
          );
          setSelectorOpen(false);
          hapticLight();
        }}
        title="Seleccionar ejercicio"
      />
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: SURFACE.base,
        color: TEXT.primary,
        paddingBottom: 100,
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: Z_INDEX.sticky,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${SPACE.md}px`,
          background: GLASS.fillRaised,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${GLASS.border}`,
        }}
      >
        <GlassButton
          variant="ghost"
          onClick={onClose}
          aria-label="Volver"
          style={{
            height: "auto",
            minHeight: 32,
            padding: `0 ${SPACE.sm}px`,
            fontSize: TYPE.subhead.size,
            fontWeight: 500,
            background: "transparent",
            border: "none",
            color: TEXT.secondary,
          }}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </GlassButton>

        <h2
          style={{
            margin: 0,
            fontSize: TYPE.title2.size,
            lineHeight: TYPE.title2.lineHeight,
            fontWeight: TYPE.title2.weight,
            letterSpacing: TYPE.title2.tracking,
            color: TEXT.primary,
          }}
        >
          {headerTitle}
        </h2>

        <GlassButton
          variant="primary"
          onClick={handleSave}
          disabled={!canSave || saveStatus === "saving"}
          aria-label={canSave ? "Guardar rutina" : "Guardar rutina (requiere título y al menos un ejercicio)"}
          style={{
            height: "auto",
            minHeight: 32,
            padding: `0 ${SPACE.sm}px`,
            fontSize: TYPE.caption.size,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: TYPE.label.tracking,
            borderRadius: RADIUS.pill,
          }}
        >
          {saveStatus === "saving" ? "Guardando…" : "Guardar"}
        </GlassButton>
      </header>

      <main style={{ padding: `${SPACE.sm}px ${SPACE.md}px ${SPACE.lg}px`, flex: 1, overflowY: "auto" }}>
        {!isWeeklyMode && (
          <div style={{ display: "flex", gap: SPACE.sm, marginBottom: SPACE.md }}>
            <GlassButton
              variant={mode === "single" ? "primary" : "ghost"}
              onClick={() => setMode("single")}
              aria-label="Rutina individual"
              style={{ flex: 1, fontSize: TYPE.caption.size, fontWeight: 600 }}
            >
              Individual
            </GlassButton>
            <GlassButton
              variant="ghost"
              onClick={() => setMode("weekly")}
              aria-label="Plan semanal"
              style={{ flex: 1, fontSize: TYPE.caption.size, fontWeight: 600 }}
            >
              Semanal
            </GlassButton>
          </div>
        )}

        <div style={{ marginBottom: SPACE.md }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isWeeklyMode ? "Nombre del programa (ej. V-Taper 5 Días)" : "Nombre de la rutina"}
            aria-label={isWeeklyMode ? "Nombre del programa" : "Nombre de la rutina"}
            style={{
              width: "100%",
              fontSize: isWeeklyMode ? TYPE.title2.size : TYPE.hero.size,
              lineHeight: isWeeklyMode ? TYPE.title2.lineHeight : TYPE.hero.lineHeight,
              fontWeight: isWeeklyMode ? TYPE.title2.weight : TYPE.hero.weight,
              letterSpacing: isWeeklyMode ? TYPE.title2.tracking : TYPE.hero.tracking,
              color: TEXT.primary,
              background: "transparent",
              border: "none",
              outline: "none",
              padding: 0,
            }}
          />
        </div>

        {!isWeeklyMode && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: SPACE.xs,
              marginBottom: SPACE.md,
            }}
          >
            {QUICK_CHIPS_SINGLE.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  hapticLight();
                  setTitle(chip);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: SPACE.xs,
                  minHeight: MOTION.minTouchTarget,
                  padding: `0 ${SPACE.sm}px`,
                  borderRadius: RADIUS.pill,
                  border: `1px solid ${GLASS.borderStrong}`,
                  background: GLASS.fillSubtle,
                  color: TEXT.secondary,
                  fontSize: TYPE.caption.size,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <GlassCard raised style={{ padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.md }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: SPACE.sm,
              border: `1px solid ${GLASS.border}`,
              borderRadius: RADIUS.card,
              background: SURFACE.raised,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE.xs }}>
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: TYPE.label.tracking }}>DURACIÓN</span>
              <span style={{ fontFamily: TYPE.mono.font, fontSize: TYPE.mono.size, fontWeight: TYPE.mono.weight, letterSpacing: TYPE.mono.tracking, color: TEXT.primary }}>
                ~{telemetry.minutes} min
              </span>
            </div>
            <div style={{ borderLeft: `1px solid ${GLASS.border}`, borderRight: `1px solid ${GLASS.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE.xs }}>
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: TYPE.label.tracking }}>EJERCICIOS</span>
              <span style={{ fontFamily: TYPE.mono.font, fontSize: TYPE.mono.size, fontWeight: TYPE.mono.weight, letterSpacing: TYPE.mono.tracking, color: TEXT.primary }}>
                {telemetry.exerciseCount}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE.xs }}>
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: TYPE.label.tracking }}>SERIES TOTALES</span>
              <span style={{ fontFamily: TYPE.mono.font, fontSize: TYPE.mono.size, fontWeight: TYPE.mono.weight, letterSpacing: TYPE.mono.tracking, color: ACCENT.text }}>
                {telemetry.totalSets} series
              </span>
            </div>
          </div>
        </GlassCard>

        {isWeeklyMode ? weeklyContent : singleContent}
      </main>
    </div>
  );
}
