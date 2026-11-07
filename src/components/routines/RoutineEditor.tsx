import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2, Save, Copy, ArrowUp, ArrowDown } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { UnifiedExerciseSelectorSheet } from "@/components/UnifiedExerciseSelectorSheet";
import type { Exercise } from "@/types/supabase";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import {
  saveRoutine,
  flushSave,
  duplicateRoutine,
  type SaveResult,
} from "@/lib/routines/saveRoutine";
import {
  draftFromRoutine,
  validateDraft,
  newDraftKey,
  displayDayLabel,
  type LoadedRoutineSnapshot,
  type RoutineDraftV2,
  type RoutineDay,
  type DraftExercise,
} from "@/lib/routines/routineDayModel";
import { useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { CRONOS_LABELS } from "@/lib/i18n";
import { TYPE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface RoutineEditorProps {
  mode: "new" | "edit";
  routine?: RoutineWithExercises;
  onSave: () => void;
  onClose: () => void;
}

function emptyDay(order: number): RoutineDay {
  return {
    id: crypto.randomUUID(),
    order,
    weekday: null,
    label: "",
    kind: "training",
    exercises: [],
  };
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
  const byDay = new Map<number, typeof routine.exercises[number][]>();
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

function translationFor(code: string): string {
  const map: Record<string, string> = {
    titleTooShort: CRONOS_LABELS.routineValidation.titleTooShort,
    noTitle: CRONOS_LABELS.routineValidation.noTitle,
    noExercises: CRONOS_LABELS.routineValidation.noExercises,
    noTrainingDay: CRONOS_LABELS.routineValidation.noTrainingDay,
    dayWithoutExercises: CRONOS_LABELS.routineValidation.dayWithoutExercises,
    invalidDayId: CRONOS_LABELS.routineValidation.invalidDayId,
    missingRowId: CRONOS_LABELS.routineValidation.missingRowId,
    duplicateRowId: CRONOS_LABELS.routineValidation.duplicateRowId,
    duplicateExerciseInDay: CRONOS_LABELS.routineValidation.duplicateExerciseInDay,
    missingSnapshot: CRONOS_LABELS.routineValidation.missingSnapshot,
    weekdayConflict: CRONOS_LABELS.routineValidation.weekdayConflict,
    tooManyDays: CRONOS_LABELS.routineValidation.tooManyDays,
  };
  return map[code] ?? code;
}

function dayKindBadgeClass(kind: RoutineDay["kind"]): string {
  const base = "text-xs px-2 py-0.5 rounded-full";
  switch (kind) {
    case "training":
      return base + " text-accent bg-accent/10";
    case "rest":
      return base + " text-neutral-400 bg-neutral-800/50";
    case "mobility":
      return base + " text-cyan-400 bg-cyan-950/20";
    case "empty":
      return base + " text-neutral-500 bg-neutral-900/30";
  }
  return base;
}

export function RoutineEditor({
  mode,
  routine,
  onSave,
  onClose,
}: RoutineEditorProps) {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetDayIndex, setTargetDayIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<"single" | "weekly">("single");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeConfirmDayIndex, setRemoveConfirmDayIndex] = useState<number | null>(null);
  const [removeConfirmExerciseCount, setRemoveConfirmExerciseCount] = useState(0);
  const [switchModeConfirmOpen, setSwitchModeConfirmOpen] = useState(false);
  const [pendingDraftMode, setPendingDraftMode] = useState<"single" | "weekly">("single");

  const initialDraftRef = useRef<RoutineDraftV2 | null>(null);

  const initialDraft = useMemo((): RoutineDraftV2 => {
    if (mode === "edit" && routine) {
      const loaded = draftFromRoutine(routine);
      if (loaded.needsModeConfirmation && draftMode === "weekly") {
        return emptyWeekDraftFromRoutine(routine, loaded.snapshot);
      }
      return loaded;
    }
    const days: RoutineDay[] = draftMode === "weekly" ? [...Array(7).keys()].map((wd) => ({
      id: crypto.randomUUID(),
      order: wd,
      weekday: wd,
      label: "",
      kind: wd < 5 ? "training" : "rest",
      exercises: [],
    })) : [];
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
    setDraft(initialDraft);
    initialDraftRef.current = initialDraft;
  }, [initialDraft]);

  const reducedMotion = useReducedMotion();

  const dirty = useMemo(() => {
    const init = initialDraftRef.current;
    if (!init) return false;
    if (init.title !== draft.title) return true;
    if (init.description !== draft.description) return true;
    if (init.days.length !== draft.days.length) return true;
    for (let i = 0; i < draft.days.length; i++) {
      const a = init.days[i];
      const b = draft.days[i];
      if (!a || !b) return true;
      if (a.label !== b.label) return true;
      if (a.kind !== b.kind) return true;
      if (a.exercises.length !== b.exercises.length) return true;
      for (let j = 0; j < b.exercises.length; j++) {
        const ea = a.exercises[j];
        const eb = b.exercises[j];
        if (!ea || !eb) return true;
        if (ea.exercise.id !== eb.exercise.id) return true;
        if (ea.target_sets !== eb.target_sets) return true;
        if (ea.rest_seconds !== eb.rest_seconds) return true;
        if (ea.target_reps_min !== eb.target_reps_min) return true;
        if (ea.target_reps_max !== eb.target_reps_max) return true;
      }
    }
    return false;
  }, [draft]);

  const setTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft((d) => ({ ...d, title: e.target.value }));
  }, []);

  const setDescription = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft((d) => ({ ...d, description: e.target.value }));
  }, []);

  const addDay = useCallback(() => {
    setDraft((d) => {
      const next = [...d.days, emptyDay(d.days.length)];
      return { ...d, days: next };
    });
  }, []);

  const removeDay = useCallback((index: number) => {
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      next.splice(index, 1);
      next.forEach((day, i) => {
        day.order = i;
      });
      return { ...d, days: next };
    });
  }, []);

  const moveDay = useCallback((fromIndex: number, toIndex: number) => {
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      next.forEach((day, i) => {
        day.order = i;
      });
      return { ...d, days: next };
    });
  }, []);

  const setDayKind = useCallback((dayIndex: number, kind: RoutineDay["kind"]) => {
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      const day = next[dayIndex];
      if (day.kind !== "training" && (kind === "rest" || kind === "mobility" || kind === "empty")) {
        // Ya es no-training: solo cambia el kind.
        next[dayIndex] = { ...next[dayIndex], kind };
        return { ...d, days: next };
      }
      if (kind === "training") {
        // Volver a training: solo cambia el kind.
        next[dayIndex] = { ...next[dayIndex], kind: "training" };
        return { ...d, days: next };
      }
      // Cambiar de training a no-training con ejercicios: requiere confirmación.
      if (day.exercises.length > 0) {
        setRemoveConfirmDayIndex(dayIndex);
        setRemoveConfirmExerciseCount(day.exercises.length);
        setRemoveConfirmOpen(true);
        return d;
      }
      next[dayIndex] = { ...next[dayIndex], kind, exercises: [] };
      return { ...d, days: next };
    });
  }, []);

  const setDayLabel = useCallback((dayIndex: number, value: string) => {
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      next[dayIndex] = { ...next[dayIndex], label: value };
      return { ...d, days: next };
    });
  }, []);

  const addExerciseToDay = useCallback(
    (dayIndex: number, exercise: Exercise) => {
      setDraft((d) => {
        const next = [...d.days].map((day) => ({ ...day }));
        const day = next[dayIndex];
        const nextExercises = [
          ...day.exercises,
          draftExercise(exercise, day.exercises.length),
        ];
        next[dayIndex] = { ...day, exercises: nextExercises };
        return { ...d, days: next };
      });
      setPickerOpen(false);
      setTargetDayIndex(null);
    },
    [],
  );

  const removeExercise = useCallback((dayIndex: number, exerciseIndex: number) => {
    setDraft((d) => {
      const next = [...d.days].map((day) => ({ ...day }));
      const day = next[dayIndex];
      const nextExercises = [...day.exercises];
      nextExercises.splice(exerciseIndex, 1);
      nextExercises.forEach((ex, i) => {
        ex.order_index = i;
      });
      next[dayIndex] = { ...day, exercises: nextExercises };
      return { ...d, days: next };
    });
  }, []);

  const setExerciseSets = useCallback(
    (dayIndex: number, exerciseIndex: number, value: number) => {
      setDraft((d) => {
        const next = [...d.days].map((day) => ({ ...day }));
        const day = next[dayIndex];
        const ex = { ...day.exercises[exerciseIndex], target_sets: Math.max(1, value) };
        const nextExercises = [...day.exercises];
        nextExercises[exerciseIndex] = ex;
        next[dayIndex] = { ...day, exercises: nextExercises };
        return { ...d, days: next };
      });
    },
    [],
  );

  const setExerciseRest = useCallback(
    (dayIndex: number, exerciseIndex: number, value: number) => {
      setDraft((d) => {
        const next = [...d.days].map((day) => ({ ...day }));
        const day = next[dayIndex];
        const ex = { ...day.exercises[exerciseIndex], rest_seconds: Math.max(0, value) };
        const nextExercises = [...day.exercises];
        nextExercises[exerciseIndex] = ex;
        next[dayIndex] = { ...day, exercises: nextExercises };
        return { ...d, days: next };
      });
    },
    [],
  );

  const setExerciseReps = useCallback(
    (dayIndex: number, exerciseIndex: number, field: "min" | "max", value: number | null) => {
      setDraft((d) => {
        const next = [...d.days].map((day) => ({ ...day }));
        const day = next[dayIndex];
        const ex = { ...day.exercises[exerciseIndex] };
        if (field === "min") ex.target_reps_min = value;
        else ex.target_reps_max = value;
        const nextExercises = [...day.exercises];
        nextExercises[exerciseIndex] = ex;
        next[dayIndex] = { ...day, exercises: nextExercises };
        return { ...d, days: next };
      });
    },
    [],
  );

  const duplicateDay = useCallback((dayIndex: number) => {
    setDraft((d) => {
      const day = { ...d.days[dayIndex] };
      const copy = {
        ...day,
        id: crypto.randomUUID(),
        order: d.days.length,
        exercises: day.exercises.map((ex) => ({
          ...ex,
          rowId: crypto.randomUUID(),
        })),
      };
      const next = [...d.days].map((d2) => ({ ...d2 }));
      next.splice(dayIndex + 1, 0, copy);
      next.forEach((d2, i) => {
        d2.order = i;
      });
      return { ...d, days: next };
    });
  }, []);

  const confirmRemoveExercises = useCallback(() => {
    setDraft((d) => {
      if (removeConfirmDayIndex === null) return d;
      const next = [...d.days].map((day) => ({ ...day }));
      next[removeConfirmDayIndex] = { ...next[removeConfirmDayIndex], kind: "rest", exercises: [] };
      return { ...d, days: next };
    });
    setRemoveConfirmOpen(false);
    setRemoveConfirmDayIndex(null);
    setRemoveConfirmExerciseCount(0);
  }, [removeConfirmDayIndex]);

  const cancelRemoveExercises = useCallback(() => {
    setRemoveConfirmOpen(false);
    setRemoveConfirmDayIndex(null);
    setRemoveConfirmExerciseCount(0);
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
  }, [userId, draft, draft.draftKey, onSave]);

  const handleDuplicate = useCallback(() => {
    const copy = duplicateRoutine(draft, "copia de " + draft.title);
    setDraft(copy);
  }, [draft]);

  const problems = validateDraft(draft);
  const hasValidationErrors = problems.length > 0;
  const canSave = draft.title.trim().length >= 3 && !hasValidationErrors;
  const validationMessages = problems.map(translationFor);

  const hasExercises = draft.days.some((d) => d.exercises.length > 0);

  const requestSwitchMode = useCallback((nextMode: "single" | "weekly") => {
    if (nextMode === draftMode) return;
    if (hasExercises) {
      setPendingDraftMode(nextMode);
      setSwitchModeConfirmOpen(true);
      return;
    }
    setDraftMode(nextMode);
  }, [draftMode, hasExercises]);

  const openPickerForDay = useCallback((dayIndex: number) => {
    setTargetDayIndex(dayIndex);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setTargetDayIndex(null);
  }, []);

  const isEditMode = mode === "edit";

  const handleClose = useCallback(() => {
    if (dirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const handleCloseConfirmSave = useCallback(async () => {
    setCloseConfirmOpen(false);
    await handleSave();
  }, [handleSave]);

  const handleCloseConfirmDiscard = useCallback(() => {
    setCloseConfirmOpen(false);
    onClose();
  }, [onClose]);

  const dayContext = useMemo(() => {
    const idx = targetDayIndex ?? 0;
    const day = draft.days[idx];
    if (!day) return undefined;
    return {
      dayIndex: idx,
      dayLabel: day.label,
      dayExercises: day.exercises.map((ex) => ex.exercise),
    };
  }, [draft, targetDayIndex]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#000", backdropFilter: reducedMotion ? "none" : "blur(20px)" }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-900/80">
        <h2 className="text-neutral-100 font-semibold" style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}>
          {isEditMode ? "Editar rutina" : "Nueva rutina"}
        </h2>
        <GlassButton variant="ghost" icon={<X />} onClick={handleClose} aria-label="Cerrar editor" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="space-y-6">
          <GlassCard>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-xs text-neutral-500 mb-1 uppercase tracking-wider" style={{ fontWeight: 600 }}>
                  Nombre de la rutina
                </label>
                <input type="text" value={draft.title} onChange={setTitle} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-neutral-100 focus:border-accent/50 focus:outline-none transition-colors" placeholder={CRONOS_LABELS.namePlaceholder} />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1 uppercase tracking-wider" style={{ fontWeight: 600 }}>
                  Descripción
                </label>
                <textarea value={draft.description} onChange={setDescription} rows={3} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-neutral-100 focus:border-accent/50 focus:outline-none transition-colors" placeholder="Anota qu\u00e9 trabaja esta rutina\u2026" />
              </div>
              {mode === "new" && (
                <div>
                  <label className="block text-xs text-neutral-500 mb-1 uppercase tracking-wider" style={{ fontWeight: 600 }}>
                    Tipo de plan
                  </label>
                  <div className="flex gap-2">
                    <GlassButton
                      variant={draftMode === "single" ? "primary" : "ghost"}
                      onClick={() => requestSwitchMode("single")}
                      aria-label="Plan individual"
                    >
                      Individual
                    </GlassButton>
                    <GlassButton
                      variant={draftMode === "weekly" ? "primary" : "ghost"}
                      onClick={() => requestSwitchMode("weekly")}
                      aria-label="Plan semanal"
                    >
                      Semanal
                    </GlassButton>
                  </div>
                  <p className="text-neutral-500 text-xs mt-1" style={{ fontSize: TYPE.caption.size }}>
                    {draftMode === "weekly" ? "7 d\u00edas fijos (Lunes\u2013Domingo)" : "D\u00edas libres (individual)"}
                  </p>
                </div>
              )}
              {mode === "edit" && draft.needsModeConfirmation && (
                <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
                  <p className="text-neutral-300 text-sm mb-3" style={{ fontSize: TYPE.caption.size }}>
                    Esta rutina no tiene plan semanal asignado.
                  </p>
                  <GlassButton
                    variant="primary"
                    onClick={() => setDraftMode("weekly")}
                    aria-label="Convertir a plan semanal"
                  >
                    {CRONOS_LABELS.planner.convertToWeekly}
                  </GlassButton>
                </div>
              )}
            </div>
          </GlassCard>

          <div className="space-y-3">
            {draft.days.map((day, dayIndex) => (
              <GlassCard key={day.id} raised className="group">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <input value={day.label} onChange={(e) => setDayLabel(dayIndex, e.target.value)} className="bg-transparent border-none text-neutral-100 focus:ring-0 outline-none min-w-[120px]" style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight }} placeholder={"D\u00eda " + (day.order + 1)} />
                        <select value={day.kind} onChange={(e) => setDayKind(dayIndex, e.target.value as RoutineDay["kind"])} className="bg-neutral-950/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-neutral-300 focus:border-accent/50 focus:outline-none">
                          <option value="training">Entrenamiento</option>
                          <option value="rest">Descanso</option>
                          <option value="mobility">Movilidad</option>
                          <option value="empty">Vac\u00edo</option>
                        </select>
                        <span className={dayKindBadgeClass(day.kind)} style={{ fontSize: "10px", padding: "0 4px", borderRadius: "9999px" }}>
                          {displayDayLabel(day, draft.mode)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {dayIndex > 0 && (
                        <GlassButton variant="ghost" icon={<ArrowUp size={14} />} onClick={(e) => { e.stopPropagation(); moveDay(dayIndex, dayIndex - 1); }} aria-label="Mover d\u00eda arriba" />
                      )}
                      {dayIndex < draft.days.length - 1 && (
                        <GlassButton variant="ghost" icon={<ArrowDown size={14} />} onClick={(e) => { e.stopPropagation(); moveDay(dayIndex, dayIndex + 1); }} aria-label="Mover d\u00eda abajo" />
                      )}
                      <GlassButton variant="ghost" icon={<Copy />} onClick={(e) => { e.stopPropagation(); duplicateDay(dayIndex); }} aria-label="Duplicar d\u00eda" />
                      <GlassButton variant="destructive" icon={<Trash2 />} onClick={(e) => { e.stopPropagation(); removeDay(dayIndex); }} aria-label="Eliminar d\u00eda" />
                    </div>
                  </div>

                  {day.kind === "training" && (
                    <div className="flex gap-3">
                      {day.exercises.map((ex, exIndex) => (
                        <GlassCard key={ex.rowId ?? ex.exercise.id} flush className="flex flex-col gap-2 min-w-[200px]">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-neutral-300 truncate max-w-[150px]" title={ex.exercise.name} style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight }}>
                              {ex.exercise.name}
                            </span>
                            <GlassButton variant="ghost" icon={<Trash2 />} onClick={(e) => { e.stopPropagation(); removeExercise(dayIndex, exIndex); }} aria-label="Quitar ejercicio" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-neutral-500 uppercase mb-1">Series</label>
                              <input type="number" value={ex.target_sets} onChange={(e) => setExerciseSets(dayIndex, exIndex, Number(e.target.value) || 1)} className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-neutral-100 focus:border-accent/50 focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[10px] text-neutral-500 uppercase mb-1">Descanso (s)</label>
                              <input type="number" value={ex.rest_seconds} onChange={(e) => setExerciseRest(dayIndex, exIndex, Number(e.target.value) || 0)} className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-neutral-100 focus:border-accent/50 focus:outline-none" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-neutral-500 uppercase mb-1">Reps m\u00edn</label>
                              <input type="number" value={ex.target_reps_min ?? ""} onChange={(e) => setExerciseReps(dayIndex, exIndex, "min", e.target.value === "" ? null : Number(e.target.value))} className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-neutral-100 focus:border-accent/50 focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[10px] text-neutral-500 uppercase mb-1">Reps m\u00e1x</label>
                              <input type="number" value={ex.target_reps_max ?? ""} onChange={(e) => setExerciseReps(dayIndex, exIndex, "max", e.target.value === "" ? null : Number(e.target.value))} className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-neutral-100 focus:border-accent/50 focus:outline-none" />
                            </div>
                          </div>
                        </GlassCard>
                      ))}
                      {day.exercises.length === 0 && (
                        <div className="text-neutral-600 text-sm italic">
                          {CRONOS_LABELS.emptyDay}
                        </div>
                      )}
                      <GlassButton variant="ghost" icon={<Plus />} onClick={(e) => { e.stopPropagation(); openPickerForDay(dayIndex); }} aria-label="A\u00f1adir ejercicio al d\u00eda">
                        A\u00f1adir ejercicio
                      </GlassButton>
                    </div>
                  )}
                </div>
              </GlassCard>
            ))}
            <GlassButton variant="secondary" icon={<Plus />} onClick={addDay} block disabled={draft.mode === "weekly"} aria-label="A\u00f1adir d\u00eda de entrenamiento">
              A\u00f1adir d\u00eda
            </GlassButton>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-neutral-900/80 p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GlassButton variant="ghost" icon={<Copy />} onClick={handleDuplicate} disabled={!isEditMode} aria-label="Duplicar rutina">
              Duplicar
            </GlassButton>
          </div>
          <GlassButton variant="primary" icon={<Save />} onClick={handleSave} disabled={saving || !canSave} aria-label="Guardar rutina">
            {saving ? CRONOS_LABELS.saving : CRONOS_LABELS.save}
          </GlassButton>
        </div>
        {!canSave && !saving && (
          <p className="text-xs text-red-400">
            {validationMessages.length > 0 ? validationMessages.join(", ") : CRONOS_LABELS.routineValidation.noTitle}
          </p>
        )}
        {saveResult && !saveResult.ok && (
          <p className="text-xs text-red-400">{CRONOS_LABELS.saveError}</p>
        )}
        {saveResult && saveResult.ok && (
          <p className="text-xs text-emerald-400">{CRONOS_LABELS.saved}</p>
        )}
      </div>

      <UnifiedExerciseSelectorSheet
        isOpen={pickerOpen}
        mode="single"
        onClose={closePicker}
        dayContext={dayContext}
        onSelectSingle={(exercise) => {
          if (targetDayIndex !== null) {
            addExerciseToDay(targetDayIndex, exercise);
          }
        }}
      />

      {closeConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
          <GlassCard raised className="w-full max-w-md p-6">
            <h3 className="text-neutral-100 font-semibold mb-3" style={{ fontSize: TYPE.subhead.size }}>
              Tienes cambios sin guardar
            </h3>
            <p className="text-neutral-400 text-sm mb-6">
              \u00bfQu\u00e9 deseas hacer antes de cerrar?
            </p>
            <div className="flex gap-3">
              <GlassButton variant="primary" onClick={handleCloseConfirmSave} disabled={saving || !canSave}>
                Guardar y salir
              </GlassButton>
              <GlassButton variant="destructive" onClick={handleCloseConfirmDiscard}>
                Descartar cambios
              </GlassButton>
              <GlassButton variant="ghost" onClick={() => setCloseConfirmOpen(false)}>
                Cancelar
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      )}

      {removeConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={cancelRemoveExercises}>
          <div onClick={(e) => e.stopPropagation()}>
            <GlassCard raised className="w-full max-w-md p-6">
            <h3 className="text-neutral-100 font-semibold mb-3" style={{ fontSize: TYPE.subhead.size }}>
              {CRONOS_LABELS.planner.removeExercisesTitle}
            </h3>
            <p className="text-neutral-400 text-sm mb-6">
              {CRONOS_LABELS.planner.removeExercisesBody.replace("{count}", String(removeConfirmExerciseCount))}
            </p>
            <div className="flex gap-3">
              <GlassButton variant="destructive" onClick={confirmRemoveExercises}>
                {CRONOS_LABELS.planner.removeExercisesConfirm}
              </GlassButton>
              <GlassButton variant="ghost" onClick={cancelRemoveExercises}>
                {CRONOS_LABELS.planner.removeExercisesCancel}
              </GlassButton>
            </div>
          </GlassCard>
          </div>
        </div>
      )}

      {switchModeConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setSwitchModeConfirmOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <GlassCard raised className="w-full max-w-md p-6">
            <h3 className="text-neutral-100 font-semibold mb-3" style={{ fontSize: TYPE.subhead.size }}>
              {CRONOS_LABELS.planner.switchModeDiscardTitle}
            </h3>
            <p className="text-neutral-400 text-sm mb-6">
              {CRONOS_LABELS.planner.switchModeDiscardBody}
            </p>
            <div className="flex gap-3">
              <GlassButton variant="destructive" onClick={() => { setSwitchModeConfirmOpen(false); setDraftMode(pendingDraftMode); }}>
                {CRONOS_LABELS.planner.switchModeDiscardConfirm}
              </GlassButton>
              <GlassButton variant="ghost" onClick={() => setSwitchModeConfirmOpen(false)}>
                {CRONOS_LABELS.planner.switchModeDiscardCancel}
              </GlassButton>
            </div>
          </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
