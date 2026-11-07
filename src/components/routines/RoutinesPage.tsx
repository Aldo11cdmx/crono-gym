import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { useRoutines } from "@/hooks/useGymData";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { TYPE } from "@/design/tokens";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { TRAIN_PATH } from "@/components/shell/navItems";
import { RoutineCard } from "./RoutineCard";
import { RoutineEditor } from "./RoutineEditor";
import { WeeklyPlanner } from "./WeeklyPlanner";
import { draftFromRoutine, displayDayLabel } from "@/lib/routines/routineDayModel";

export function RoutinesPage() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { routines, loading, error, refresh } = useRoutines(userId);
  const [editing, setEditing] = useState<{
    mode: "new";
  } | { mode: "edit"; routine: RoutineWithExercises } | null>(null);
  const [planning, setPlanning] = useState<RoutineWithExercises | null>(null);
  const [dayPickerRoutine, setDayPickerRoutine] = useState<RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" } | null>(null);
  const [sessionConflict, setSessionConflict] = useState<{ routineId: string; title: string } | null>(null);
  const { isActive, start } = useActiveSession();
  const navigate = useNavigate();

  const openNew = useCallback(() => setEditing({ mode: "new" }), []);
  const openEdit = useCallback(
    (routine: RoutineWithExercises) => setEditing({ mode: "edit", routine }),
    [],
  );
  const openPlan = useCallback((routine: RoutineWithExercises) => setPlanning(routine), []);
  const close = useCallback(() => setEditing(null), []);
  const closePlan = useCallback(() => setPlanning(null), []);

  const handleTrain = useCallback(
    (routine: RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" }) => {
      if (isActive) {
        setSessionConflict({ routineId: routine.id, title: routine.title });
        return;
      }
      const draft = draftFromRoutine(routine);
      if (draft.incomplete) {
        // Guardia: rutina incompleta. La tarjeta ya muestra el estado; no hacemos nada aquí.
        return;
      }
      const trainingDays = draft.days.filter((d) => d.kind === "training");
      if (trainingDays.length === 0) return;
      if (trainingDays.length > 1) {
        setDayPickerRoutine(routine);
        return;
      }
      // Un solo día de entrenamiento (rutina individual o semanal con un solo día): iniciar directamente.
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
      const result = start({
        routine: { id: routine.id, title: routine.title },
        routineDayId: day.id,
        dayLabel: day.label || undefined,
        planned,
      });
      if (result.ok) {
        navigate(TRAIN_PATH);
      }
    },
    [isActive, start, navigate],
  );

  const closeDayPicker = useCallback(() => setDayPickerRoutine(null), []);
  const closeConflict = useCallback(() => setSessionConflict(null), []);

  if (loading) {
    return <p className="text-neutral-500">Cargando rutinas…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (sessionConflict) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <p>Ya hay una sesión activa: "{sessionConflict.title}".</p>
        <GlassButton variant="ghost" onClick={closeConflict}>
          Entendido
        </GlassButton>
      </div>
    );
  }

  if (editing) {
    return (
      <RoutineEditor
        mode={editing.mode === "new" ? "new" : "edit"}
        routine={editing.mode === "edit" ? editing.routine : undefined}
        onSave={async () => {
          close();
          void refresh();
        }}
        onClose={close}
      />
    );
  }

  if (planning) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1
            className="text-neutral-100"
            style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}
          >
            Planificador semanal
          </h1>
          <GlassButton variant="ghost" icon={<Plus />} onClick={closePlan} aria-label="Volver a rutinas" />
        </div>
        <WeeklyPlanner routine={planning} onSave={async () => {
          closePlan();
          void refresh();
        }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1
            className="text-neutral-100"
            style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}
          >
            Rutinas
          </h1>
          <p className="text-neutral-400" style={{ fontSize: TYPE.caption.size }}>
            Tus rutinas de entrenamiento. Selecciona una para editarla o planificarla.
          </p>
        </div>
        <GlassButton variant="primary" icon={<Plus />} onClick={openNew} block>
          Nueva rutina
        </GlassButton>
      </div>

      {routines.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <p className="text-neutral-500" style={{ fontSize: TYPE.body.size }}>
              No tienes rutinas todavía.
            </p>
            <p className="text-neutral-600 text-sm mt-2">
              Crea tu primera rutina y guarda tus ejercicios con series, descansos y rangos de repetición.
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {routines.some((r) => r.routineMode === "weekly") && (
            <GlassCard>
              <div className="p-6">
                <h2 className="text-neutral-100 font-semibold mb-4" style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight }}>
                  Planificador semanal
                </h2>
                <p className="text-neutral-400 text-sm mb-4" style={{ fontSize: TYPE.caption.size }}>
                  Organiza los días de la semana de tus rutinas semanales.
                </p>
                <div className="flex flex-wrap gap-2">
                  {routines
                    .filter((r) => r.routineMode === "weekly")
                    .map((r) => (
                      <GlassButton
                        key={r.id}
                        variant="ghost"
                        onClick={() => openPlan(r)}
                        aria-label={`Planificar ${r.title}`}
                      >
                        {r.title}
                      </GlassButton>
                    ))}
                </div>
              </div>
            </GlassCard>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine as RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" }}
                onTrain={handleTrain}
                onEdit={() => openEdit(routine)}
                onPlan={() => openPlan(routine)}
              />
            ))}
          </div>
        </div>
      )}
      {dayPickerRoutine && (
        <div className="fixed inset-0 z-60 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={closeDayPicker}>
          <div onClick={(e) => e.stopPropagation()}>
            <GlassCard raised className="w-full max-w-md p-6">
              <h3 className="text-neutral-100 font-semibold mb-3" style={{ fontSize: TYPE.subhead.size }}>
                Elegir día de entrenamiento
              </h3>
              <p className="text-neutral-400 text-sm mb-6" style={{ fontSize: TYPE.caption.size }}>
                Selecciona el día que quieres entrenar de "{dayPickerRoutine.title}".
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(() => {
                  const draft = draftFromRoutine(dayPickerRoutine);
                  return draft.days
                    .filter((d) => d.kind === "training")
                    .map((day) => {
                      const label = displayDayLabel(day, dayPickerRoutine.routineMode === "legacy" ? "single" : dayPickerRoutine.routineMode);
                      return (
                        <GlassButton
                          key={day.id}
                          variant="primary"
                          block
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
                          aria-label={`Entrenar ${label}`}
                        >
                          {label}
                        </GlassButton>
                      );
                    });
                })()}
              </div>
              <div className="flex justify-end mt-4">
                <GlassButton variant="ghost" onClick={closeDayPicker} block>
                  Cancelar
                </GlassButton>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
