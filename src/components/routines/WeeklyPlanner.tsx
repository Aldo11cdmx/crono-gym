import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Moon, Save } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { GLASS, SCRIM, STATUS, TEXT, TYPE } from "@/design/tokens";
import {
  saveRoutine,
  flushSave,
  type SaveResult,
} from "@/lib/routines/saveRoutine";
import {
  draftFromRoutine,
  displayDayLabel,
  swapDayContents,
  type LoadedRoutineSnapshot,
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

function emptyWeekDraft(routine: RoutineWithExercises, snapshot: LoadedRoutineSnapshot | null = null): RoutineDraftV2 {
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
    snapshot,
  };
}

export function WeeklyPlanner({ routine, onSave }: WeeklyPlannerProps) {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  const initialDraftRef = useRef<RoutineDraftV2 | null>(null);

  const loaded = useMemo(() => draftFromRoutine(routine), [routine]);

  const initialDraft = useMemo<RoutineDraftV2>(() => {
    if (loaded.mode === "weekly" && loaded.days.length === 7) {
      return loaded;
    }
    return emptyWeekDraft(routine, loaded.snapshot);
  }, [loaded]);

  const [draft, setDraft] = useState<RoutineDraftV2>(initialDraft);

  useEffect(() => {
    initialDraftRef.current = initialDraft;
  }, [initialDraft]);

  // --- Diálogo de dos pasos para "marcar como descanso" (§6.11) ---
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveFromWeekday, setMoveFromWeekday] = useState<number | null>(null);

  const nonTrainingTargets = useMemo(() => {
    if (moveFromWeekday === null) return [];
    return draft.days.filter(
      (d) => d.weekday !== null && d.weekday !== moveFromWeekday && d.kind !== "training",
    );
  }, [draft, moveFromWeekday]);

  const allTraining = useMemo(() => {
    return draft.days.every((d) => d.kind === "training");
  }, [draft]);

  // Destino por defecto: siguiente empty hacia adelante con vuelta; si no, siguiente rest; si no, siguiente mobility.
  const defaultTarget = useMemo(() => {
    if (moveFromWeekday === null) return null;
    const pick = (kind: RoutineDay["kind"]): number | null => {
      for (let offset = 1; offset <= 7; offset += 1) {
        const wd = (moveFromWeekday + offset) % 7;
        const day = draft.days.find((d) => d.weekday === wd);
        if (day && day.kind === kind) return wd;
      }
      return null;
    };
    return pick("empty") ?? pick("rest") ?? pick("mobility");
  }, [draft, moveFromWeekday]);

  const openMoveDialog = useCallback((weekday: number) => {
    setMoveFromWeekday(weekday);
    setMoveDialogOpen(true);
  }, []);

  const closeMoveDialog = useCallback(() => {
    setMoveDialogOpen(false);
    setMoveFromWeekday(null);
  }, []);

  const executeMove = useCallback(
    (targetWeekday: number) => {
      if (moveFromWeekday === null) return;
      setDraft((d) => {
        const next = [...d.days].map((day) => ({ ...day }));
        const fromIdx = next.findIndex((d2) => d2.weekday === moveFromWeekday);
        const toIdx = next.findIndex((d2) => d2.weekday === targetWeekday);
        if (fromIdx < 0 || toIdx < 0) return d;
        const fromDay = next[fromIdx];
        const toDay = next[toIdx];
        // El destino recibe el contenido completo del origen (kind: training, label, exercises con rowId intactos).
        next[toIdx] = {
          ...toDay,
          kind: "training",
          label: fromDay.label,
          exercises: [...fromDay.exercises],
        };
        // El origen recibe el contenido previo del destino y luego se fija como rest.
        const originLabel = toDay.kind === "rest" ? toDay.label : "";
        next[fromIdx] = {
          ...fromDay,
          kind: "rest",
          label: originLabel,
          exercises: [],
        };
        return { ...d, days: next };
      });
      closeMoveDialog();
    },
    [closeMoveDialog, moveFromWeekday],
  );

  const setDayKind = useCallback(
    (weekday: number, kind: RoutineDay["kind"]) => {
      const day = draft.days.find((d) => d.weekday === weekday);
      if (!day) return;
      // Si ya es rest/mobility/empty, solo cambia el kind (no hay contenido que preservar).
      if (day.kind !== "training") {
        setDraft((d) => {
          const next = [...d.days].map((day2) => ({ ...day2 }));
          const idx = next.findIndex((d2) => d2.weekday === weekday);
          if (idx < 0) return d;
          next[idx] = { ...next[idx], kind };
          return { ...d, days: next };
        });
        return;
      }
      // Marcar training como descanso: requiere destino (flujo de dos pasos §6.11).
      if (kind === "rest" || kind === "mobility" || kind === "empty") {
        if (allTraining) {
          // No hay destino posible: no abre diálogo, no destruye nada.
          return;
        }
        openMoveDialog(weekday);
        return;
      }
      // Volver a training desde otro kind: solo cambia el kind.
      setDraft((d) => {
        const next = [...d.days].map((day2) => ({ ...day2 }));
        const idx = next.findIndex((d2) => d2.weekday === weekday);
        if (idx < 0) return d;
        next[idx] = { ...next[idx], kind: "training" };
        return { ...d, days: next };
      });
    },
    [allTraining, draft, openMoveDialog],
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

  const problems = validateDraftPlanner(draft);
  const canSave = problems.length === 0;

  const validationMessage = useMemo(() => {
    if (problems.length === 0) return "";
    const map: Record<string, string> = {
      noTrainingDay: "El plan necesita al menos un día de entrenamiento.",
      weekdayConflict: CRONOS_LABELS.routineValidation.weekdayConflict,
      dayWithoutExercises: CRONOS_LABELS.routineValidation.dayWithoutExercises,
      dayNotTrainingWithExercises: CRONOS_LABELS.routineValidation.dayNotTrainingWithExercises,
    };
    return problems.map((p) => map[p] ?? p).join(", ");
  }, [problems]);

  const kindLabel = (kind: RoutineDay["kind"]): string => {
    if (kind === "training") return "Entrenamiento";
    if (kind === "rest") return "Descanso";
    if (kind === "mobility") return "Movilidad";
    return "Vacío";
  };

  const kindTone = (kind: RoutineDay["kind"]) => {
    if (kind === "training") return { color: "var(--cronos-accent-text, #f87171)", background: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.28)" };
    if (kind === "mobility") return { color: STATUS.success.text, background: STATUS.success.muted, border: STATUS.success.border };
    if (kind === "rest") return { color: TEXT.secondary, background: GLASS.fillSubtle, border: GLASS.border };
    return { color: TEXT.tertiary, background: "transparent", border: GLASS.border };
  };

  const moveDialogContent = (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ backgroundColor: SCRIM.modal }} onClick={closeMoveDialog}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <GlassCard raised>
          <div className="space-y-4">
            <h3 className="text-neutral-100" style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>
              {moveFromWeekday !== null ? CRONOS_LABELS.planner.moveSessionTitle.replace("{day}", WEEKDAYS_ES[moveFromWeekday]) : CRONOS_LABELS.planner.moveSessionTitle}
            </h3>
            <p className="text-neutral-400" style={{ fontSize: TYPE.caption.size }}>{CRONOS_LABELS.planner.moveSessionBody}</p>
            {allTraining ? (
              <p className="text-xs" style={{ color: STATUS.error.text }}>{CRONOS_LABELS.planner.moveAllTraining}</p>
            ) : (
              <div className="space-y-2">
                {nonTrainingTargets.map((targetDay) => (
                  <GlassButton key={targetDay.weekday} variant={defaultTarget === targetDay.weekday ? "primary" : "ghost"} onClick={() => executeMove(targetDay.weekday as number)} disabled={defaultTarget === null} aria-label={CRONOS_LABELS.planner.moveToDay.replace("{day}", WEEKDAYS_ES[targetDay.weekday ?? 0])} block>
                    {WEEKDAYS_ES[targetDay.weekday ?? 0]} · {kindLabel(targetDay.kind)}
                  </GlassButton>
                ))}
                {nonTrainingTargets.length === 0 && <p className="text-xs text-neutral-400">{CRONOS_LABELS.planner.moveAllTraining}</p>}
              </div>
            )}
            <div className="flex justify-end"><GlassButton variant="ghost" onClick={closeMoveDialog}>Cancelar</GlassButton></div>
          </div>
        </GlassCard>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="uppercase" style={{ fontSize: TYPE.label.size, letterSpacing: TYPE.label.tracking, fontWeight: TYPE.label.weight, color: TEXT.tertiary }}>Plan semanal</p>
          <h2 className="text-neutral-100" style={{ fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, lineHeight: TYPE.title2.lineHeight }}>{CRONOS_LABELS.planner.title}</h2>
          <p className="text-neutral-400" style={{ fontSize: TYPE.caption.size }}>Organiza los días de la semana de esta rutina.</p>
        </div>
        <GlassButton variant="primary" icon={<Save />} onClick={handleSave} disabled={saving || !canSave} aria-label={CRONOS_LABELS.planner.saveWeekly}>
          {saving ? CRONOS_LABELS.planner.savingWeekly : CRONOS_LABELS.planner.saveWeekly}
        </GlassButton>
      </div>

      {!canSave && <p className="text-xs" style={{ color: STATUS.error.text }}>{validationMessage}</p>}

      <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="grid min-w-[760px] gap-3 sm:min-w-0 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {WEEKDAYS_ES.map((weekdayName, wd) => {
            const day = draft.days.find((d) => d.weekday === wd);
            const label = day ? displayDayLabel(day, "weekly") : weekdayName;
            const kind = day?.kind ?? "training";
            const exCount = day?.exercises.length ?? 0;
            const isMovingFrom = moveFromWeekday === wd;
            const isDefaultTarget = defaultTarget === wd;
            const tone = kindTone(kind);
            return (
              <div key={wd} onClick={(e) => e.stopPropagation()}>
                <GlassCard raised className="flex h-full min-h-[188px] flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-neutral-100" style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight }}>{weekdayName}</span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5" style={{ fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, letterSpacing: TYPE.label.tracking, color: tone.color, background: tone.background, borderColor: tone.border }}>{kindLabel(kind)}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-neutral-200" style={{ fontSize: TYPE.subhead.size, lineHeight: TYPE.subhead.lineHeight, overflowWrap: "anywhere" }}>{label}</p>
                    <p className="text-neutral-500" style={{ fontSize: TYPE.caption.size }}>{exCount} {exCount === 1 ? "ejercicio" : "ejercicios"}</p>
                  </div>
                  <div className="mt-auto space-y-2 pt-1">
                    <GlassButton variant="ghost" icon={<Moon size={14} />} onClick={() => setDayKind(wd, kind === "rest" ? "training" : "rest")} disabled={allTraining && kind === "training"} aria-label={kind === "rest" ? "Quitar descanso" : "Marcar descanso"} block>
                      {kind === "rest" ? "Quitar descanso" : "Marcar descanso"}
                    </GlassButton>
                    <div className="flex justify-end gap-1">
                      {wd > 0 && <GlassButton variant="ghost" icon={<ArrowUp size={12} />} onClick={() => swapDays(wd, wd - 1)} aria-label="Mover día arriba" />}
                      {wd < 6 && <GlassButton variant="ghost" icon={<ArrowDown size={12} />} onClick={() => swapDays(wd, wd + 1)} aria-label="Mover día abajo" />}
                    </div>
                    {isMovingFrom && <p className="text-xs" style={{ color: "var(--cronos-accent-text, #f87171)" }}>Mover sesión a…</p>}
                    {isDefaultTarget && moveDialogOpen && <p className="text-xs" style={{ color: STATUS.success.text }}>Destino sugerido</p>}
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </div>

      {allTraining && <p className="text-xs" style={{ color: STATUS.error.text }}>{CRONOS_LABELS.planner.moveAllTraining}</p>}
      {moveDialogOpen && moveDialogContent}
      {saveResult && !saveResult.ok && <p className="text-xs" style={{ color: STATUS.error.text }}>{CRONOS_LABELS.planner.weeklySaveError}</p>}
      {saveResult && saveResult.ok && <p className="text-xs" style={{ color: STATUS.success.text }}>{CRONOS_LABELS.planner.weeklySaved}</p>}
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
    if (day.kind !== "training" && day.exercises.length > 0) problems.push("dayNotTrainingWithExercises");
  }
  const trainingDays = draft.days.filter((d) => d.kind === "training");
  if (trainingDays.length === 0) problems.push("noTrainingDay");
  return problems;
}
