import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Moon, Save } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { TYPE } from "@/design/tokens";
import {
  saveRoutine,
  flushSave,
  type SaveResult,
} from "@/lib/routines/saveRoutine";
import {
  draftFromRoutine,
  displayDayLabel,
  swapDayContents,
  type RoutineDay,
  type RoutineDraftV2,
} from "@/lib/routines/routineDayModel";
import { useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { CRONOS_LABELS } from "@/lib/i18n";

const WEEKDAYS_ES = CRONOS_LABELS.planner.weekdays;

interface WeeklyPlannerProps {
  routine: RoutineWithExercises;
  onSave: () => void;
}

function emptyWeekDraft(routine: RoutineWithExercises): RoutineDraftV2 {
  const days: RoutineDay[] = [];
  for (let wd = 0; wd < 7; wd += 1) {
    days.push({
      id: crypto.randomUUID(),
      order: wd,
      weekday: wd,
      label: "",
      kind: wd < 5 ? "training" : "rest",
      exercises: [],
    });
  }
  return {
    draftKey: crypto.randomUUID(),
    id: routine.id,
    title: routine.title,
    description: routine.description ?? "",
    mode: "weekly",
    days,
    snapshot: null,
  };
}

export function WeeklyPlanner({ routine, onSave }: WeeklyPlannerProps) {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  const initialDraftRef = useRef<RoutineDraftV2 | null>(null);

  const initialDraft = useMemo<RoutineDraftV2>(() => {
    const loaded = draftFromRoutine(routine);
    if (loaded.mode === "weekly" && loaded.days.length === 7) {
      return loaded;
    }
    return emptyWeekDraft(routine);
  }, [routine]);

  const [draft, setDraft] = useState<RoutineDraftV2>(initialDraft);

  useEffect(() => {
    initialDraftRef.current = initialDraft;
  }, [initialDraft]);

  const problems = validateDraftPlanner(draft);
  const canSave = problems.length === 0;

  const setDayKind = useCallback(
    (weekday: number, kind: RoutineDay["kind"]) => {
      setDraft((d) => {
        const next = [...d.days].map((day) => ({ ...day }));
        const idx = next.findIndex((d2) => d2.weekday === weekday);
        if (idx < 0) return d;
        next[idx] = { ...next[idx], kind };
        if (kind !== "training") {
          next[idx].exercises = [];
        }
        return { ...d, days: next };
      });
    },
    [],
  );

  const swapDays = useCallback((fromWeekday: number, toWeekday: number) => {
    setDraft((d) => {
      const next = swapDayContents(d.days, fromWeekday, toWeekday);
      return { ...d, days: next };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const promise = saveRoutine(userId, draft, "planner");
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

  const validationMessage = useMemo(() => {
    if (problems.length === 0) return "";
    const map: Record<string, string> = {
      noTrainingDay: "El plan necesita al menos un día de entrenamiento.",
      weekdayConflict: CRONOS_LABELS.routineValidation.weekdayConflict,
      dayWithoutExercises: CRONOS_LABELS.routineValidation.dayWithoutExercises,
    };
    return problems.map((p) => map[p] ?? p).join(", ");
  }, [problems]);

  const kindLabel = (kind: RoutineDay["kind"]): string => {
    if (kind === "training") return "Entrenamiento";
    if (kind === "rest") return "Descanso";
    if (kind === "mobility") return "Movilidad";
    return "Vacío";
  };

  const kindClass = (kind: RoutineDay["kind"]): string => {
    if (kind === "training") return "text-accent bg-accent/10";
    if (kind === "rest") return "text-neutral-400 bg-neutral-800/50";
    if (kind === "mobility") return "text-cyan-400 bg-cyan-950/20";
    return "text-neutral-500 bg-neutral-900/30";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-neutral-100 font-semibold"
            style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}
          >
            {CRONOS_LABELS.planner.title}
          </h2>
          <p className="text-neutral-400" style={{ fontSize: TYPE.caption.size }}>
            Organiza los días de la semana de esta rutina.
          </p>
        </div>
        <GlassButton variant="primary" icon={<Save />} onClick={handleSave} disabled={saving || !canSave} aria-label={CRONOS_LABELS.planner.saveWeekly}>
          {saving ? CRONOS_LABELS.planner.savingWeekly : CRONOS_LABELS.planner.saveWeekly}
        </GlassButton>
      </div>

      {!canSave && (
        <p className="text-xs text-red-400">{validationMessage}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {WEEKDAYS_ES.map((weekdayName, wd) => {
          const day = draft.days.find((d) => d.weekday === wd);
          const label = day ? displayDayLabel(day, "weekly") : weekdayName;
          const kind = day?.kind ?? "training";
          const exCount = day?.exercises.length ?? 0;
          return (
            <GlassCard key={wd} raised className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <span
                  className="text-neutral-100 font-medium"
                  style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight }}
                >
                  {weekdayName}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${kindClass(kind)}`} style={{ fontSize: "10px" }}>
                  {kindLabel(kind)}
                </span>
              </div>
              <div className="text-neutral-400 text-sm" style={{ fontSize: TYPE.caption.size }}>
                {label}
              </div>
              <div className="text-neutral-500 text-xs" style={{ fontSize: TYPE.caption.size }}>
                {exCount} {exCount === 1 ? "ejercicio" : "ejercicios"}
              </div>
              <div className="flex items-center justify-between gap-1 mt-auto pt-2">
                <GlassButton variant="ghost" icon={<Moon size={14} />} onClick={() => setDayKind(wd, kind === "rest" ? "training" : "rest")} aria-label={kind === "rest" ? "Quitar descanso" : "Marcar descanso"} />
                <div className="flex gap-0.5">
                  {wd > 0 && (
                    <GlassButton variant="ghost" icon={<ArrowUp size={12} />} onClick={() => swapDays(wd, wd - 1)} aria-label="Mover día arriba" />
                  )}
                  {wd < 6 && (
                    <GlassButton variant="ghost" icon={<ArrowDown size={12} />} onClick={() => swapDays(wd, wd + 1)} aria-label="Mover día abajo" />
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {saveResult && !saveResult.ok && (
        <p className="text-xs text-red-400">{CRONOS_LABELS.planner.weeklySaveError}</p>
      )}
      {saveResult && saveResult.ok && (
        <p className="text-xs text-emerald-400">{CRONOS_LABELS.planner.weeklySaved}</p>
      )}
    </div>
  );
}

function validateDraftPlanner(draft: RoutineDraftV2): string[] {
  const problems: string[] = [];
  if (draft.mode === "weekly" && draft.days.length !== 7) problems.push("weekdayConflict");
  const weekdays = new Set<number>();
  for (const day of draft.days) {
    if (day.weekday === null) { problems.push("weekdayConflict"); continue; }
    if (weekdays.has(day.weekday)) problems.push("weekdayConflict");
    weekdays.add(day.weekday);
    if (day.kind === "training" && day.exercises.length === 0) problems.push("dayWithoutExercises");
    if (day.kind !== "training" && day.exercises.length > 0) problems.push("dayWithoutExercises");
  }
  const trainingDays = draft.days.filter((d) => d.kind === "training");
  if (trainingDays.length === 0) problems.push("noTrainingDay");
  return problems;
}
