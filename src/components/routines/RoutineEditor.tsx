import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2, Save, Copy, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
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
import { GLASS, MOTION, SCRIM, SOLID, STATUS, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { ROUTINE_TEMPLATES } from "@/lib/routines/routineTemplates";

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

function dayKindTone(kind: RoutineDay["kind"]) {
  if (kind === "training") return { color: "var(--cronos-accent-text, #f87171)", background: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.28)" };
  if (kind === "mobility") return { color: STATUS.success.text, background: STATUS.success.muted, border: STATUS.success.border };
  if (kind === "rest") return { color: TEXT.secondary, background: GLASS.fillSubtle, border: GLASS.border };
  return { color: TEXT.tertiary, background: "transparent", border: GLASS.border };
}

function dayKindBadgeClass(_kind: RoutineDay["kind"]): string {
  return "inline-flex items-center rounded-full border px-2 py-0.5";
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
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [validationExpanded, setValidationExpanded] = useState(false);

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
    // Solo restaurar el draft inicial cuando el draft actual sigue siendo la referencia original.
    // Esto evita sobrescribir cambios del usuario o plantillas aplicadas cuando draftMode cambia.
    if (draft === initialDraftRef.current) {
      setDraft(initialDraft);
    }
    initialDraftRef.current = initialDraft;
  }, [initialDraft]);

  const reducedMotion = useReducedMotion();
  const catalog = useExerciseCatalog();

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

  const applyTemplateToDraft = useCallback(
    (template: (typeof ROUTINE_TEMPLATES)[number]) => {
      if (catalog.loading) return;
      if (catalog.error) {
        setTemplateError(catalog.error);
        return;
      }
      setTemplateLoading(true);
      try {
        const isWeekly = template.days.length === 7;
        const days: RoutineDay[] = template.days.map((td, i) => {
          const isMobility = td.label.toLowerCase().includes("movilidad");
          const kind = isMobility ? "mobility" : td.exercises.length > 0 ? "training" : "rest";
          const exercises = td.exercises.map((ex, ei) => {
            const resolved = catalog.find(ex.name);
            const exercise: Exercise = resolved
              ? resolved
              : ({ id: "", name: ex.name, name_es: null } as Exercise);
            return {
              rowId: crypto.randomUUID(),
              exercise,
              target_sets: ex.sets,
              rest_seconds: ex.restSeconds,
              order_index: ei,
              target_reps_min: ex.repsMin,
              target_reps_max: ex.repsMax,
            };
          });
          return {
            id: crypto.randomUUID(),
            order: i,
            weekday: isWeekly ? i : null,
            label: td.label,
            kind,
            exercises,
          };
        });

        setDraft((d) => ({
          ...d,
          title: template.title,
          description: `Plantilla: ${template.title}`,
          mode: isWeekly ? "weekly" : "single",
          days,
        }));

        setDraftMode(isWeekly ? "weekly" : "single");
      } finally {
        setTemplateLoading(false);
      }
      setTemplateOpen(false);
    },
    [catalog]
  );

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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: SCRIM.modal, backdropFilter: reducedMotion ? "none" : "blur(20px)" }}>
      <div className="border-b px-4 py-3 sm:px-6" style={{ borderColor: GLASS.border, background: SOLID.popover, backdropFilter: reducedMotion ? "none" : "blur(16px)" }}>
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-neutral-100" style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, lineHeight: TYPE.title2.lineHeight }}>{isEditMode ? "Editar rutina" : "Nueva rutina"}</h2>
            <p className="hidden sm:block text-neutral-500" style={{ fontSize: TYPE.caption.size }}>{isEditMode ? "Edición" : "Nueva"} · {draft.mode === "weekly" ? "Plan semanal · 7 días" : "Rutina individual"}</p>
          </div>
          <GlassButton variant="ghost" icon={<X />} onClick={handleClose} aria-label="Cerrar editor" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-5xl space-y-5">
          <GlassCard raised><div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block uppercase" style={{ fontSize: TYPE.label.size, letterSpacing: TYPE.label.tracking, fontWeight: TYPE.label.weight, color: TEXT.tertiary }}>Nombre de la rutina</label>
                <input type="text" value={draft.title} onChange={setTitle} className="w-full rounded-2xl border bg-black/25 px-4 py-3 text-neutral-100 outline-none transition-colors focus:border-[var(--cronos-accent-border)]" style={{ borderColor: GLASS.border, fontSize: TYPE.subhead.size }} placeholder={CRONOS_LABELS.namePlaceholder} />
              </div>
              <div>
                <label className="mb-1 block uppercase" style={{ fontSize: TYPE.label.size, letterSpacing: TYPE.label.tracking, fontWeight: TYPE.label.weight, color: TEXT.tertiary }}>Descripción</label>
                <textarea value={draft.description} onChange={setDescription} rows={3} className="w-full rounded-2xl border bg-black/25 px-4 py-3 text-neutral-100 outline-none transition-colors focus:border-[var(--cronos-accent-border)]" style={{ borderColor: GLASS.border }} placeholder="Anota qué trabaja esta rutina…" />
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: GLASS.border, background: GLASS.fillSubtle }}>
              {mode === "new" ? (<>
                <label className="block uppercase" style={{ fontSize: TYPE.label.size, letterSpacing: TYPE.label.tracking, fontWeight: TYPE.label.weight, color: TEXT.tertiary }}>Tipo de plan</label>
                <div className="flex flex-wrap gap-2">
                  <GlassButton variant={draftMode === "single" ? "primary" : "ghost"} onClick={() => requestSwitchMode("single")} aria-label="Plan individual">Individual</GlassButton>
                  <GlassButton variant={draftMode === "weekly" ? "primary" : "ghost"} onClick={() => requestSwitchMode("weekly")} aria-label="Plan semanal">Semanal</GlassButton>
                </div>
                <p className="text-neutral-500" style={{ fontSize: TYPE.caption.size }}>{draftMode === "weekly" ? "7 días fijos (Lunes–Domingo)." : "Días libres (individual)."}</p>
                <GlassButton variant="ghost" onClick={() => { setTemplateError(null); setTemplateOpen(true); }} aria-label="Desde plantilla">Desde plantilla</GlassButton>
              </>) : mode === "edit" && draft.needsModeConfirmation ? (<div className="space-y-3">
                <p className="text-neutral-300" style={{ fontSize: TYPE.caption.size }}>Esta rutina no tiene plan semanal asignado.</p>
                <GlassButton variant="primary" onClick={() => setDraftMode("weekly")} aria-label="Convertir a plan semanal">{CRONOS_LABELS.planner.convertToWeekly}</GlassButton>
              </div>) : (<p className="text-neutral-500" style={{ fontSize: TYPE.subhead.size }}>Revisa nombre, días y ejercicios antes de guardar.</p>)}
            </div>
          </div></div></GlassCard>

          <section className="space-y-3" aria-label="Estructura de la rutina">
            <div className="flex items-center justify-between gap-3 px-1">
              <h3 className="text-neutral-100" style={{ fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight }}>Estructura</h3>
              <p className="text-neutral-500" style={{ fontSize: TYPE.caption.size }}>{draft.days.length} {draft.days.length === 1 ? "día" : "días"}</p>
            </div>
            {draft.days.map((day, dayIndex) => {
              const tone = dayKindTone(day.kind);
              return (
              <GlassCard key={day.id} raised><div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <input value={day.label} onChange={(e) => setDayLabel(dayIndex, e.target.value)} className="min-w-[140px] rounded-xl border bg-black/20 px-3 py-2 text-neutral-100 outline-none transition-colors focus:border-[var(--cronos-accent-border)]" style={{ borderColor: GLASS.border, fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight }} placeholder={"Día " + (day.order + 1)} />
                    <select value={day.kind} onChange={(e) => setDayKind(dayIndex, e.target.value as RoutineDay["kind"])} className="rounded-xl border bg-black/20 px-3 py-2 text-neutral-300 outline-none focus:border-[var(--cronos-accent-border)]" style={{ borderColor: GLASS.border, fontSize: TYPE.caption.size }}>
                      <option value="training">Entrenamiento</option><option value="rest">Descanso</option><option value="mobility">Movilidad</option><option value="empty">Vacío</option>
                    </select>
                    <span className={dayKindBadgeClass(day.kind)} style={{ fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, letterSpacing: TYPE.label.tracking, color: tone.color, background: tone.background, borderColor: tone.border }}>{displayDayLabel(day, draft.mode)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {dayIndex > 0 && (<GlassButton variant="ghost" icon={<ArrowUp size={14} />} onClick={(e) => { e.stopPropagation(); moveDay(dayIndex, dayIndex - 1); }} aria-label="Mover día arriba" />)}
                    {dayIndex < draft.days.length - 1 && (<GlassButton variant="ghost" icon={<ArrowDown size={14} />} onClick={(e) => { e.stopPropagation(); moveDay(dayIndex, dayIndex + 1); }} aria-label="Mover día abajo" />)}
                    <GlassButton variant="ghost" icon={<Copy />} onClick={(e) => { e.stopPropagation(); duplicateDay(dayIndex); }} aria-label="Duplicar día" />
                    <GlassButton variant="destructive" icon={<Trash2 />} onClick={(e) => { e.stopPropagation(); removeDay(dayIndex); }} aria-label="Eliminar día" />
                  </div>
                </div>

                {day.kind === "training" && (<div className="space-y-3">
                  {day.exercises.length > 0 ? (<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {day.exercises.map((ex, exIndex) => (
                      <GlassCard key={ex.rowId ?? ex.exercise.id} flush className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 text-neutral-200" title={ex.exercise.name} style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight, overflowWrap: "anywhere" }}>{ex.exercise.name}</span>
                          <GlassButton variant="ghost" icon={<Trash2 size={15} />} onClick={(e) => { e.stopPropagation(); removeExercise(dayIndex, exIndex); }} aria-label="Quitar ejercicio" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="mb-1 block uppercase" style={{ fontSize: TYPE.label.size, letterSpacing: TYPE.label.tracking, color: TEXT.tertiary }}>Series</label><input type="number" value={ex.target_sets} onChange={(e) => setExerciseSets(dayIndex, exIndex, Number(e.target.value) || 1)} className="w-full rounded-xl border bg-black/20 px-3 py-2 text-neutral-100 outline-none focus:border-[var(--cronos-accent-border)]" style={{ borderColor: GLASS.border, fontSize: TYPE.caption.size }} /></div>
                          <div><label className="mb-1 block uppercase" style={{ fontSize: TYPE.label.size, letterSpacing: TYPE.label.tracking, color: TEXT.tertiary }}>Descanso (s)</label><input type="number" value={ex.rest_seconds} onChange={(e) => setExerciseRest(dayIndex, exIndex, Number(e.target.value) || 0)} className="w-full rounded-xl border bg-black/20 px-3 py-2 text-neutral-100 outline-none focus:border-[var(--cronos-accent-border)]" style={{ borderColor: GLASS.border, fontSize: TYPE.caption.size }} /></div>
                          <div><label className="mb-1 block uppercase" style={{ fontSize: TYPE.label.size, letterSpacing: TYPE.label.tracking, color: TEXT.tertiary }}>Reps mín</label><input type="number" value={ex.target_reps_min ?? ""} onChange={(e) => setExerciseReps(dayIndex, exIndex, "min", e.target.value === "" ? null : Number(e.target.value))} className="w-full rounded-xl border bg-black/20 px-3 py-2 text-neutral-100 outline-none focus:border-[var(--cronos-accent-border)]" style={{ borderColor: GLASS.border, fontSize: TYPE.caption.size }} /></div>
                          <div><label className="mb-1 block uppercase" style={{ fontSize: TYPE.label.size, letterSpacing: TYPE.label.tracking, color: TEXT.tertiary }}>Reps máx</label><input type="number" value={ex.target_reps_max ?? ""} onChange={(e) => setExerciseReps(dayIndex, exIndex, "max", e.target.value === "" ? null : Number(e.target.value))} className="w-full rounded-xl border bg-black/20 px-3 py-2 text-neutral-100 outline-none focus:border-[var(--cronos-accent-border)]" style={{ borderColor: GLASS.border, fontSize: TYPE.caption.size }} /></div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>) : (<div className="rounded-2xl border px-4 py-3 text-neutral-500" style={{ borderColor: GLASS.border, background: GLASS.fillSubtle, fontSize: TYPE.subhead.size }}>{CRONOS_LABELS.emptyDay}</div>)}
                  <GlassButton variant="ghost" icon={<Plus />} onClick={(e) => { e.stopPropagation(); openPickerForDay(dayIndex); }} aria-label="Añadir ejercicio al día">Añadir ejercicio</GlassButton>
                </div>)}
              </div></GlassCard>
            );})}
            <GlassButton variant="secondary" icon={<Plus />} onClick={addDay} block disabled={draft.mode === "weekly"} aria-label="Añadir día de entrenamiento">Añadir día</GlassButton>
          </section>
        </div>
      </div>

<div className="border-t px-4 py-2.5 sm:px-6 sm:py-3" style={{ borderColor: GLASS.border, background: SOLID.popover, backdropFilter: reducedMotion ? "none" : "blur(16px)" }}>
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {isEditMode && (
              <GlassButton variant="ghost" icon={<Copy />} onClick={handleDuplicate} disabled={!isEditMode} aria-label="Duplicar rutina">Duplicar</GlassButton>
            )}
            <GlassButton variant="primary" icon={<Save />} onClick={handleSave} disabled={saving || !canSave} aria-label="Guardar rutina">{saving ? CRONOS_LABELS.saving : CRONOS_LABELS.save}</GlassButton>
          </div>
          {saving && (
            <p className="rounded-xl border px-3 py-1.5 text-xs" aria-live="polite" style={{ borderColor: GLASS.border, background: SURFACE.sunken, color: TEXT.secondary }}>
              Guardando cambios de la rutina…
            </p>
          )}
          {!canSave && !saving && hasValidationErrors && (
            <div>
              <button
                type="button"
                onClick={() => setValidationExpanded((v) => !v)}
                aria-expanded={validationExpanded}
                className="flex w-full items-center justify-between rounded-xl border px-3 py-1.5 text-left transition-colors"
                style={{ borderColor: GLASS.border, background: GLASS.fillSubtle, color: TEXT.secondary }}
              >
                <span className="text-xs" style={{ color: STATUS.warning.text }}>Faltan {validationMessages.length} {validationMessages.length === 1 ? "cosa para guardar" : "cosas para guardar"}</span>
                <ChevronDown size={14} style={{ color: TEXT.tertiary, transform: validationExpanded ? "rotate(180deg)" : "none", transition: `transform ${MOTION.fast} ${MOTION.easeOut}` }} />
              </button>
              {validationExpanded && (
                <ul className="mt-1.5 space-y-1 px-3 text-xs" style={{ color: STATUS.warning.text }}>
                  {validationMessages.slice(0, 4).map((m) => <li key={m}>• {m}</li>)}
                </ul>
              )}
            </div>
          )}
          {!canSave && !saving && !hasValidationErrors && (
            <p className="text-xs" style={{ color: STATUS.warning.text }}>{CRONOS_LABELS.routineValidation.noTitle}</p>
          )}
          {saveResult && !saveResult.ok && (
            <div className="rounded-xl border px-3 py-2 text-xs" aria-live="polite" style={{ borderColor: STATUS.error.border, background: STATUS.error.muted }}>
              <p className="font-medium" style={{ color: STATUS.error.text }}>{CRONOS_LABELS.saveError}</p>
              <p className="mt-1" style={{ color: STATUS.error.text }}>{translationFor(saveResult.error)}</p>
            </div>
          )}
          {saveResult && saveResult.ok && (
            <p className="rounded-xl border px-3 py-2 text-xs" aria-live="polite" style={{ borderColor: STATUS.success.border, background: STATUS.success.muted, color: STATUS.success.text }}>
              {CRONOS_LABELS.saved}
            </p>
          )}
        </div>
      </div>

      <UnifiedExerciseSelectorSheet isOpen={pickerOpen} mode="single" onClose={closePicker} dayContext={dayContext} onSelectSingle={(exercise) => { if (targetDayIndex !== null) addExerciseToDay(targetDayIndex, exercise); }} />

      {closeConfirmOpen && (<div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ backgroundColor: SCRIM.modal }} onClick={(e) => e.stopPropagation()}><div className="w-full max-w-md"><GlassCard raised><div className="space-y-4">
        <h3 className="text-neutral-100" style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>Tienes cambios sin guardar</h3>
        <p className="text-neutral-400 text-sm">¿Qué deseas hacer antes de cerrar?</p>
        <div className="flex flex-wrap gap-2">
          <GlassButton variant="primary" onClick={handleCloseConfirmSave} disabled={saving || !canSave}>Guardar y salir</GlassButton>
          <GlassButton variant="destructive" onClick={handleCloseConfirmDiscard}>Descartar cambios</GlassButton>
          <GlassButton variant="ghost" onClick={() => setCloseConfirmOpen(false)}>Cancelar</GlassButton>
        </div>
      </div></GlassCard></div></div>)}

      {removeConfirmOpen && (<div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ backgroundColor: SCRIM.modal }} onClick={cancelRemoveExercises}><div onClick={(e) => e.stopPropagation()} className="w-full max-w-md"><GlassCard raised><div className="space-y-4">
        <h3 className="text-neutral-100" style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>{CRONOS_LABELS.planner.removeExercisesTitle}</h3>
        <p className="text-neutral-400 text-sm">{CRONOS_LABELS.planner.removeExercisesBody.replace("{count}", String(removeConfirmExerciseCount))}</p>
        <div className="flex flex-wrap gap-2"><GlassButton variant="destructive" onClick={confirmRemoveExercises}>{CRONOS_LABELS.planner.removeExercisesConfirm}</GlassButton><GlassButton variant="ghost" onClick={cancelRemoveExercises}>{CRONOS_LABELS.planner.removeExercisesCancel}</GlassButton></div>
      </div></GlassCard></div></div>)}

      {switchModeConfirmOpen && (<div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ backgroundColor: SCRIM.modal }} onClick={() => setSwitchModeConfirmOpen(false)}><div onClick={(e) => e.stopPropagation()} className="w-full max-w-md"><GlassCard raised><div className="space-y-4">
        <h3 className="text-neutral-100" style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>{CRONOS_LABELS.planner.switchModeDiscardTitle}</h3>
        <p className="text-neutral-400 text-sm">{CRONOS_LABELS.planner.switchModeDiscardBody}</p>
        <div className="flex flex-wrap gap-2"><GlassButton variant="destructive" onClick={() => { setSwitchModeConfirmOpen(false); setDraftMode(pendingDraftMode); }}>{CRONOS_LABELS.planner.switchModeDiscardConfirm}</GlassButton><GlassButton variant="ghost" onClick={() => setSwitchModeConfirmOpen(false)}>{CRONOS_LABELS.planner.switchModeDiscardCancel}</GlassButton></div>
      </div></GlassCard></div></div>)}

      {templateOpen && (<div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ backgroundColor: SCRIM.modal }} onClick={() => { setTemplateError(null); setTemplateOpen(false); }}><div onClick={(e) => e.stopPropagation()} className="w-full max-w-md"><GlassCard raised><div className="space-y-4">
        <h3 className="text-neutral-100" style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>Elegir plantilla</h3>
        <p className="text-neutral-400" style={{ fontSize: TYPE.caption.size }}>Clona una plantilla base y adapta los días y ejercicios a tu gusto.</p>
        {templateError && <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: STATUS.error.border, background: STATUS.error.muted, color: STATUS.error.text }}>{templateError}</div>}
        <div className="space-y-2">{ROUTINE_TEMPLATES.map((template) => (
          <GlassButton key={template.id} variant="ghost" block onClick={() => applyTemplateToDraft(template)} disabled={templateLoading} aria-label={`Plantilla ${template.title}`}><div className="w-full text-left">
            <div className="flex items-center justify-between gap-2"><span style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>{template.title}</span><span className="text-xs text-neutral-500">{template.days.length} día{template.days.length !== 1 ? "s" : ""}</span></div>
            <p className="mt-1 text-neutral-500" style={{ fontSize: TYPE.caption.size }}>{template.days.filter((d) => d.exercises.length > 0).length} día{template.days.filter((d) => d.exercises.length > 0).length !== 1 ? "s con ejercicios" : " con ejercicio"}</p>
          </div></GlassButton>
        ))}</div>
        <div className="flex justify-end"><GlassButton variant="ghost" onClick={() => { setTemplateError(null); setTemplateOpen(false); }} disabled={templateLoading}>Cancelar</GlassButton></div>
      </div></GlassCard></div></div>)}
    </div>
  );
}
