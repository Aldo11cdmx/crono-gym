import { useCallback, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { useRoutines } from "@/hooks/useGymData";
import type { RoutineWithExercises } from "@/hooks/useGymData";
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

export function RoutinesPage() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { routines, loading, error, refresh } = useRoutines(userId);
  const [editing, setEditing] = useState<{
    mode: "new";
  } | { mode: "edit"; routine: RoutineWithExercises } | null>(null);
  const [planning, setPlanning] = useState<RoutineWithExercises | null>(null);
  const [dayPickerRoutine, setDayPickerRoutine] = useState<RoutineWithMode | null>(null);
  const [sessionConflict, setSessionConflict] = useState<{
    routineId: string | null;
    title: string;
    dayLabel?: string | null;
  } | null>(null);
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
      if (draft.incomplete) return;
      const trainingDays = draft.days.filter((d) => d.kind === "training");
      if (trainingDays.length === 0) return;
      if (trainingDays.length > 1) {
        setDayPickerRoutine(routine);
        return;
      }
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
      if (result.ok) navigate(TRAIN_PATH);
    },
    [isActive, session, start, navigate],
  );

  const closeDayPicker = useCallback(() => setDayPickerRoutine(null), []);
  const closeConflict = useCallback(() => setSessionConflict(null), []);

  // Lógica preservada; UI eliminada intencionalmente para rediseño.
  void userId;
  void loading;
  void error;
  void refresh;
  void editing;
  void planning;
  void dayPickerRoutine;
  void sessionConflict;
  void filter;
  void setFilter;
  void summary;
  void visibleRoutines;
  void openNew;
  void openEdit;
  void openPlan;
  void close;
  void closePlan;
  void handleTrain;
  void closeDayPicker;
  void closeConflict;
  void RoutineCard;
  void RoutineEditor;
  void WeeklyPlanner;
  void displayDayLabel;

  return null;
}