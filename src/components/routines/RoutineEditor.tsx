import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Save, Copy } from "lucide-react";
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

  const initialDraft = useMemo((): RoutineDraftV2 => {
    if (mode === "edit" && routine) {
      return draftFromRoutine(routine);
    }
    return {
      draftKey: newDraftKey(),
      id: null,
      title: "",
      description: "",
      mode: "single",
      days: [],
      snapshot: null,
      needsModeConfirmation: false,
    };
  }, [mode, routine]);

  const [draft, setDraft] = useState<RoutineDraftV2>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const reducedMotion = useReducedMotion();

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
      const next = [...d.days];
      next.splice(index, 1);
      next.forEach((day, i) => {
        day.order = i;
      });
      return { ...d, days: next };
    });
  }, []);

  const addExerciseToDay = useCallback(
    (dayIndex: number, exercise: Exercise) => {
      setDraft((d) => {
        const next = [...d.days];
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
      const next = [...d.days];
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
        const next = [...d.days];
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
        const next = [...d.days];
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
        const next = [...d.days];
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
      const day = d.days[dayIndex];
      const copy = {
        ...day,
        id: crypto.randomUUID(),
        order: d.days.length,
        exercises: day.exercises.map((ex) => ({
          ...ex,
          rowId: crypto.randomUUID(),
        })),
      };
      const next = [...d.days];
      next.splice(dayIndex + 1, 0, copy);
      next.forEach((d2, i) => {
        d2.order = i;
      });
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
        onSave();
      }
    } finally {
      setSaving(false);
    }
  }, [userId, draft, draft.draftKey, onSave]);

  const handleDuplicate = useCallback(() => {
    const copy = duplicateRoutine(draft, `${draft.title} (copia)`);
    setDraft(copy);
  }, [draft]);

  const problems = validateDraft(draft);
  const hasValidationErrors = problems.length > 0;
  const canSave = draft.title.trim().length >= 3 && !hasValidationErrors;

  const openPickerForDay = useCallback((dayIndex: number) => {
    setTargetDayIndex(dayIndex);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setTargetDayIndex(null);
  }, []);

  const isEditMode = mode === "edit";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundColor: "#000",
        backdropFilter: reducedMotion ? "none" : "blur(20px)",
      }}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-900/80">
        <h2
          className="text-neutral-100 font-semibold"
          style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}
        >
          {isEditMode ? "Editar rutina" : "Nueva rutina"}
        </h2>
        <GlassButton variant="ghost" icon={<X />} onClick={onClose} aria-label="Cerrar editor" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="space-y-6">
          <GlassCard>
            <div className="space-y-4 p-6">
              <div>
                <label
                  className="block text-xs text-neutral-500 mb-1 uppercase tracking-wider"
                  style={{ fontWeight: 600 }}
                >
                  Nombre de la rutina
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={setTitle}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-neutral-100 focus:border-accent/50 focus:outline-none transition-colors"
                  placeholder={CRONOS_LABELS.namePlaceholder}
                />
              </div>
              <div>
                <label
                  className="block text-xs text-neutral-500 mb-1 uppercase tracking-wider"
                  style={{ fontWeight: 600 }}
                >
                  Descripción
                </label>
                <textarea
                  value={draft.description}
                  onChange={setDescription}
                  rows={3}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-neutral-100 focus:border-accent/50 focus:outline-none transition-colors"
                  placeholder="Anota qué trabaja esta rutina…"
                />
              </div>
            </div>
          </GlassCard>

          <div className="space-y-3">
            {draft.days.map((day, dayIndex) => (
              <GlassCard key={day.id} raised className="group">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium text-neutral-100"
                        style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight }}
                      >
                        {day.label || `Día ${day.order + 1}`}
                      </span>
                      {day.kind === "training" && (
                        <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                          Entrenamiento
                        </span>
                      )}
                    </div>
                    <GlassButton
                      variant="ghost"
                      icon={<Copy />}
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateDay(dayIndex);
                      }}
                      aria-label="Duplicar día"
                    />
                    <GlassButton
                      variant="destructive"
                      icon={<Trash2 />}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDay(dayIndex);
                      }}
                      aria-label="Eliminar día"
                    />
                  </div>

                  <div className="flex gap-3">
                    {day.exercises.map((ex, exIndex) => (
                      <GlassCard
                        key={ex.rowId ?? ex.exercise.id}
                        flush
                        className="flex flex-col gap-2 min-w-[200px]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="text-neutral-300 truncate max-w-[150px]"
                            title={ex.exercise.name}
                            style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight }}
                          >
                            {ex.exercise.name}
                          </span>
                          <GlassButton
                            variant="ghost"
                            icon={<Trash2 />}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeExercise(dayIndex, exIndex);
                            }}
                            aria-label="Quitar ejercicio"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-neutral-500 uppercase mb-1">Series</label>
                            <input
                              type="number"
                              value={ex.target_sets}
                              onChange={(e) =>
                                setExerciseSets(dayIndex, exIndex, Number(e.target.value) || 1)
                              }
                              className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-neutral-100 focus:border-accent/50 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-neutral-500 uppercase mb-1">Descanso (s)</label>
                            <input
                              type="number"
                              value={ex.rest_seconds}
                              onChange={(e) =>
                                setExerciseRest(dayIndex, exIndex, Number(e.target.value) || 0)
                              }
                              className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-neutral-100 focus:border-accent/50 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-neutral-500 uppercase mb-1">Reps mín</label>
                            <input
                              type="number"
                              value={ex.target_reps_min ?? ""}
                              onChange={(e) =>
                                setExerciseReps(
                                  dayIndex,
                                  exIndex,
                                  "min",
                                  e.target.value === "" ? null : Number(e.target.value),
                                )
                              }
                              className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-neutral-100 focus:border-accent/50 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-neutral-500 uppercase mb-1">Reps máx</label>
                            <input
                              type="number"
                              value={ex.target_reps_max ?? ""}
                              onChange={(e) =>
                                setExerciseReps(
                                  dayIndex,
                                  exIndex,
                                  "max",
                                  e.target.value === "" ? null : Number(e.target.value),
                                )
                              }
                              className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-neutral-100 focus:border-accent/50 focus:outline-none"
                            />
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                    {day.exercises.length === 0 && (
                      <div className="text-neutral-600 text-sm italic">
                        {CRONOS_LABELS.emptyDay}
                      </div>
                    )}
                    <GlassButton
                      variant="ghost"
                      icon={<Plus />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openPickerForDay(dayIndex);
                      }}
                      aria-label="Añadir ejercicio al día"
                    >
                      Añadir ejercicio
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            ))}
            <GlassButton
              variant="secondary"
              icon={<Plus />}
              onClick={addDay}
              block
              aria-label="Añadir día de entrenamiento"
            >
              Añadir día
            </GlassButton>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-neutral-900/80 p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GlassButton
              variant="ghost"
              icon={<Copy />}
              onClick={handleDuplicate}
              disabled={!isEditMode}
              aria-label="Duplicar rutina"
            >
              Duplicar
            </GlassButton>
          </div>
          <GlassButton
            variant="primary"
            icon={<Save />}
            onClick={handleSave}
            disabled={saving || !canSave}
            aria-label="Guardar rutina"
          >
            {saving ? CRONOS_LABELS.saving : CRONOS_LABELS.save}
          </GlassButton>
        </div>
        {!canSave && !saving && (
          <p className="text-xs text-red-400">
            {problems.length > 0 ? problems.join(", ") : "Ponle un nombre a la rutina antes de guardarla."}
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
        onSelectSingle={(exercise) => {
          if (targetDayIndex !== null) {
            addExerciseToDay(targetDayIndex, exercise);
          }
        }}
      />
    </div>
  );
}
