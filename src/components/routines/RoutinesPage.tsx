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

export function RoutinesPage() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { routines, loading, error, refresh } = useRoutines(userId);
  const [editing, setEditing] = useState<{
    mode: "new";
  } | { mode: "edit"; routine: RoutineWithExercises } | null>(null);

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
  const close = useCallback(() => setEditing(null), []);

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
            Tus rutinas de entrenamiento. Selecciona una para editarla o empezar a entrenar.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onTrain={() => {
                // Navigate to train with this routine
              }}
              onEdit={() => openEdit(routine)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
