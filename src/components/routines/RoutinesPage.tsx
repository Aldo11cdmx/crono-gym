import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { useRoutines } from "@/hooks/useGymData";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { TYPE } from "@/design/tokens";
import { RoutineCard } from "./RoutineCard";
import { RoutineEditor } from "./RoutineEditor";
import { WeeklyPlanner } from "./WeeklyPlanner";

export function RoutinesPage() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { routines, loading, error, refresh } = useRoutines(userId);
  const [editing, setEditing] = useState<{
    mode: "new";
  } | { mode: "edit"; routine: RoutineWithExercises } | null>(null);
  const [planning, setPlanning] = useState<RoutineWithExercises | null>(null);

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

  const openNew = useCallback(() => setEditing({ mode: "new" }), []);
  const openEdit = useCallback(
    (routine: RoutineWithExercises) => setEditing({ mode: "edit", routine }),
    [],
  );
  const openPlan = useCallback((routine: RoutineWithExercises) => setPlanning(routine), []);
  const close = useCallback(() => setEditing(null), []);
  const closePlan = useCallback(() => setPlanning(null), []);

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
                routine={routine}
                onTrain={() => {
                  // Navigate to train with this routine
                }}
                onEdit={() => openEdit(routine)}
                onPlan={() => openPlan(routine)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
