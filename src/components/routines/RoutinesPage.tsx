import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useRoutines } from "@/hooks/useGymData";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { ACCENT, GLASS, SCRIM, STATUS, TEXT, TYPE } from "@/design/tokens";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { TRAIN_PATH } from "@/components/shell/navItems";
import { RoutineCard } from "./RoutineCard";
import { RoutineEditor } from "./RoutineEditor";
import { WeeklyPlanner } from "./WeeklyPlanner";
import { draftFromRoutine, displayDayLabel } from "@/lib/routines/routineDayModel";

type RoutineFilter = "all" | "single" | "weekly" | "favorites";

type RoutineWithMode = RoutineWithExercises & {
  routineMode: "single" | "weekly" | "legacy";
  is_favorite?: boolean;
};

const FILTER_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "single", label: "Individuales" },
  { value: "weekly", label: "Semanales" },
  { value: "favorites", label: "Favoritas" },
] as const;

export function RoutinesPage() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { routines, loading, error, refresh } = useRoutines(userId);
  const [editing, setEditing] = useState<{
    mode: "new";
  } | { mode: "edit"; routine: RoutineWithExercises } | null>(null);
  const [planning, setPlanning] = useState<RoutineWithExercises | null>(null);
  const [dayPickerRoutine, setDayPickerRoutine] = useState<RoutineWithMode | null>(null);
  const [sessionConflict, setSessionConflict] = useState<{ routineId: string | null; title: string; dayLabel?: string | null } | null>(null);
  const [filter, setFilter] = useState<RoutineFilter>("all");
  const { isActive, start, session } = useActiveSession();
  const navigate = useNavigate();

  const routineRows = routines as RoutineWithMode[];
  const summary = useMemo(() => {
    const weekly = routineRows.filter((r) => r.routineMode === "weekly").length;
    const single = routineRows.filter((r) => r.routineMode === "single" || r.routineMode === "legacy").length;
    const favorites = routineRows.filter((r) => Boolean(r.is_favorite)).length;
    return { total: routineRows.length, single, weekly, favorites };
  }, [routineRows]);

  const visibleRoutines = useMemo(() => {
    if (filter === "all") return routineRows;
    if (filter === "single") return routineRows.filter((r) => r.routineMode === "single" || r.routineMode === "legacy");
    if (filter === "weekly") return routineRows.filter((r) => r.routineMode === "weekly");
    return routineRows.filter((r) => Boolean(r.is_favorite));
  }, [filter, routineRows]);

  const openNew = useCallback(() => setEditing({ mode: "new" }), []);
  const openEdit = useCallback(
    (routine: RoutineWithExercises) => setEditing({ mode: "edit", routine }),
    [],
  );
  const openPlan = useCallback((routine: RoutineWithExercises) => setPlanning(routine), []);
  const close = useCallback(() => setEditing(null), []);
  const closePlan = useCallback(() => setPlanning(null), []);

  const handleTrain = useCallback(
    (routine: RoutineWithMode) => {
      if (isActive && session) {
        setSessionConflict({
          routineId: session.routineId,
          title: session.title,
          dayLabel: session.dayLabel,
        });
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
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <div
          className="rounded-3xl border p-5"
          style={{ background: GLASS.fillSubtle, borderColor: GLASS.border }}
        >
          <p className="text-neutral-500" style={{ fontSize: TYPE.subhead.size }}>
            Cargando rutinas…
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-3xl border"
              style={{
                minHeight: 180,
                background: GLASS.fillSubtle,
                borderColor: GLASS.border,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard raised>
        <div className="space-y-3">
          <p style={{ fontSize: TYPE.subhead.size, fontWeight: 600, color: STATUS.error.text }}>
            No se pudieron cargar las rutinas
          </p>
          <p className="rounded-2xl border px-3 py-2.5" aria-live="polite" style={{ borderColor: STATUS.error.border, background: STATUS.error.muted, color: STATUS.error.text, fontSize: TYPE.caption.size }}>
              {error}
            </p>
          <GlassButton variant="secondary" onClick={() => void refresh()}>
            Reintentar
          </GlassButton>
        </div>
      </GlassCard>
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
      <div className="space-y-5">
        <div
          className="flex items-center justify-between gap-3 rounded-3xl border p-4 sm:p-5"
          style={{ background: GLASS.fillSubtle, borderColor: GLASS.border }}
        >
          <div className="min-w-0">
            <p className="text-neutral-500" style={{ fontSize: TYPE.caption.size }}>
              Planificación
            </p>
            <h1
              className="truncate text-neutral-100"
              style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}
            >
              {planning.title}
            </h1>
          </div>
          <GlassButton variant="ghost" onClick={closePlan} aria-label="Volver a rutinas">
            Volver
          </GlassButton>
        </div>
        <WeeklyPlanner routine={planning} onSave={async () => {
          closePlan();
          void refresh();
        }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-2">
      <section
        className="rounded-3xl border p-5 sm:p-6"
        style={{
          background: `linear-gradient(180deg, ${GLASS.fillRaised} 0%, ${GLASS.fillSubtle} 100%)`,
          borderColor: GLASS.border,
          boxShadow: GLASS.shadow,
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p
              className="uppercase"
              style={{
                fontSize: TYPE.label.size,
                letterSpacing: TYPE.label.tracking,
                fontWeight: TYPE.label.weight,
                color: TEXT.tertiary,
              }}
            >
              Biblioteca
            </p>
            <h1
              className="text-neutral-100"
              style={{ fontSize: TYPE.title1.size, fontWeight: TYPE.title1.weight, lineHeight: TYPE.title1.lineHeight }}
            >
              Mis rutinas
            </h1>
            <p className="max-w-xl text-neutral-400" style={{ fontSize: TYPE.subhead.size }}>
              Organiza tus sesiones, planifica la semana y entra a entrenar sin perder el ritmo.
            </p>
          </div>
          <div className="shrink-0">
            <GlassButton variant="primary" icon={<Plus />} onClick={openNew} aria-label="Nueva rutina">
              Nueva rutina
            </GlassButton>
          </div>
        </div>

        {routineRows.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Total", value: summary.total },
              { label: "Individuales", value: summary.single },
              { label: "Semanales", value: summary.weekly },
              { label: "Favoritas", value: summary.favorites },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border px-3 py-2.5"
                style={{ background: GLASS.fillSubtle, borderColor: GLASS.border }}
              >
                <p className="text-neutral-500" style={{ fontSize: TYPE.caption.size }}>
                  {item.label}
                </p>
                <p
                  className="text-neutral-100"
                  style={{ fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight, fontVariantNumeric: "tabular-nums" }}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {sessionConflict && (
        <GlassCard raised style={{ border: `1px solid ${ACCENT.border}`, background: ACCENT.subtle }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-200">
              Hay una sesión activa: <strong className="text-neutral-50">{sessionConflict.title}</strong>
              {sessionConflict.dayLabel ? ` (${sessionConflict.dayLabel})` : ""}.
            </p>
            <div className="flex flex-wrap gap-2">
              <GlassButton
                variant="primary"
                onClick={() => {
                  closeConflict();
                  navigate(TRAIN_PATH);
                }}
              >
                Ir a la sesión activa
              </GlassButton>
              <GlassButton variant="ghost" onClick={closeConflict}>
                Entendido
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {routineRows.length === 0 ? (
        <GlassCard raised>
          <div className="mx-auto max-w-md space-y-4 py-10 text-center">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border"
              style={{ background: ACCENT.subtle, borderColor: ACCENT.border, color: ACCENT.text }}
            >
              <Plus size={22} />
            </div>
            <div className="space-y-1">
              <p className="text-neutral-100" style={{ fontSize: TYPE.headline.size, fontWeight: TYPE.headline.weight }}>
                Crea tu primera rutina
              </p>
              <p className="text-neutral-500" style={{ fontSize: TYPE.subhead.size }}>
                Guarda ejercicios, series y descansos para empezar con una estructura clara.
              </p>
            </div>
            <GlassButton variant="primary" icon={<Plus />} onClick={openNew}>
              Nueva rutina
            </GlassButton>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl
              value={filter}
              options={FILTER_OPTIONS}
              onChange={(value) => setFilter(value as RoutineFilter)}
              ariaLabel="Filtrar rutinas"
              className="self-start"
            />
            <p className="text-neutral-500" style={{ fontSize: TYPE.caption.size }}>
              {visibleRoutines.length} {visibleRoutines.length === 1 ? "rutina" : "rutinas"}
            </p>
          </div>

          {routineRows.some((r) => r.routineMode === "weekly") && (filter === "all" || filter === "weekly") && (
            <GlassCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-neutral-100" style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>
                    Planificador semanal
                  </h2>
                  <p className="text-neutral-500" style={{ fontSize: TYPE.caption.size }}>
                    Ajusta qué sesión corresponde a cada día.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {routineRows
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

          {visibleRoutines.length === 0 ? (
            <GlassCard>
              <div className="py-8 text-center">
                <p className="text-neutral-400" style={{ fontSize: TYPE.subhead.size }}>
                  No hay rutinas en este filtro.
                </p>
                <GlassButton variant="ghost" className="mt-3" onClick={() => setFilter("all")}>
                  Ver todas
                </GlassButton>
              </div>
            </GlassCard>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleRoutines.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  onTrain={handleTrain}
                  onEdit={() => openEdit(routine)}
                  onPlan={() => openPlan(routine)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {dayPickerRoutine && (
        <div
          className="fixed inset-0 z-[var(--cronos-z-modal)] flex items-end justify-center p-3 sm:items-center"
          style={{ backgroundColor: SCRIM.modal, backdropFilter: "blur(6px)" }}
          onClick={closeDayPicker}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
            <GlassCard raised>
              <div className="space-y-4">
                <div>
                  <p className="text-neutral-500" style={{ fontSize: TYPE.caption.size }}>
                    {dayPickerRoutine.title}
                  </p>
                  <h3 className="text-neutral-100" style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}>
                    Elegir día de entrenamiento
                  </h3>
                </div>
                <p className="text-neutral-400" style={{ fontSize: TYPE.caption.size }}>
                  Selecciona el día que quieres entrenar.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(() => {
                    const draft = draftFromRoutine(dayPickerRoutine);
                    return draft.days
                      .filter((d) => d.kind === "training")
                      .map((day) => {
                        const label = displayDayLabel(day, dayPickerRoutine.routineMode === "legacy" ? "single" : dayPickerRoutine.routineMode);
                        return (
                          <GlassButton
                            key={day.id}
                            variant="secondary"
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
                <div className="flex justify-end">
                  <GlassButton variant="ghost" onClick={closeDayPicker}>
                    Cancelar
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
