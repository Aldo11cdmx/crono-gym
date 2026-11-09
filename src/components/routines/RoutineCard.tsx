import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Copy, Dumbbell, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { Exercise } from "@/types/supabase";
import { ACCENT, GLASS, MOTION, RADIUS, SCRIM, SOLID, SPACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hapticLight } from "@/lib/haptics";
import { ROUTINES_UI_LABELS, translateMuscle, translateTarget } from "@/lib/i18n";
import { draftFromRoutine, displayDayLabel } from "@/lib/routines/routineDayModel";

type RoutineCardRoutine = RoutineWithExercises & {
  routineMode: "single" | "weekly" | "legacy";
  is_favorite?: boolean;
};

export interface RoutineCardProps {
  routine: RoutineCardRoutine;
  onTrain: (routine: RoutineCardRoutine) => void;
  onEdit: () => void;
  onPlan?: () => void;
  onDuplicate?: (routine: RoutineCardRoutine) => void | Promise<void>;
  onDelete?: (routine: RoutineCardRoutine) => void | Promise<void>;
}

function routineIsIncomplete(routine: RoutineWithExercises): boolean {
  const desc = routine.description ?? "";
  const hasBridge = desc.startsWith("{");
  return hasBridge && routine.exercises.length === 0;
}

function muscleLabel(exercise: Exercise): string {
  const raw = exercise.body_part?.trim() || exercise.target?.trim() || "";
  if (!raw) return "";
  return exercise.body_part ? translateMuscle(raw) : translateTarget(raw);
}

export function RoutineCard({ routine, onTrain, onEdit, onPlan: _onPlan, onDuplicate, onDelete }: RoutineCardProps) {
  const reducedMotion = useReducedMotion();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const incomplete = routineIsIncomplete(routine);
  const isWeekly = routine.routineMode === "weekly";

  const metrics = useMemo(() => {
    const draft = draftFromRoutine(routine);
    const trainingDays = draft.days.filter((d) => d.kind === "training");
    const exerciseCount = routine.exercises.length;
    const totalSets = routine.exercises.reduce((sum, ex) => sum + (ex.target_sets ?? 0), 0);
    const restSec = routine.exercises.reduce(
      (sum, ex) => sum + (ex.target_sets ?? 0) * (ex.rest_seconds ?? 0),
      0,
    );
    // Estimación conservadora: ~45s de trabajo por serie + descansos.
    const minutes = Math.max(1, Math.round((totalSets * 45 + restSec) / 60));

    const muscles: string[] = [];
    const seen = new Set<string>();
    for (const ex of routine.exercises) {
      const label = muscleLabel(ex.exercise);
      if (label && !seen.has(label)) {
        seen.add(label);
        muscles.push(label);
      }
      if (muscles.length >= 3) break;
    }

    const dayLabels =
      isWeekly || routine.routineMode === "legacy"
        ? trainingDays.slice(0, 4).map((day) => {
            if (day.weekday != null && day.weekday >= 0 && day.weekday <= 6) {
              return ROUTINES_UI_LABELS.weekdaysShort[day.weekday];
            }
            const full = displayDayLabel(day, isWeekly ? "weekly" : "single");
            return full.slice(0, 3);
          })
        : [];

    return { exerciseCount, minutes, muscles, dayLabels, trainingDays: trainingDays.length };
  }, [routine, isWeekly]);

  const focusText = metrics.muscles.length > 0 ? metrics.muscles.join(" • ").toUpperCase() : null;
  const pressStyle = reducedMotion
    ? undefined
    : { transition: `transform ${MOTION.fast} ${MOTION.easeOut}` };

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setConfirmDelete(false);
  }, []);

  const handleEdit = useCallback(() => {
    closeSheet();
    onEdit();
  }, [closeSheet, onEdit]);

  const handleDuplicate = useCallback(() => {
    if (!onDuplicate) return;
    closeSheet();
    void onDuplicate(routine);
  }, [closeSheet, onDuplicate, routine]);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    closeSheet();
    void onDelete(routine);
  }, [closeSheet, confirmDelete, onDelete, routine]);

  return (
    <GlassCard
      as="article"
      raised
      style={{
        borderRadius: RADIUS.card,
        borderColor: GLASS.borderStrong,
        boxShadow: GLASS.shadow,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`${ROUTINES_UI_LABELS.edit}: ${routine.title}`}
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            border: "none",
            background: "transparent",
            color: "inherit",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
              <h3
                style={{
                  margin: 0,
                  minWidth: 0,
                  fontSize: TYPE.title2.size,
                  lineHeight: TYPE.title2.lineHeight,
                  fontWeight: TYPE.title2.weight,
                  letterSpacing: TYPE.title2.tracking,
                  color: TEXT.primary,
                }}
              >
                {routine.title}
              </h3>
              {isWeekly ? (
                <span
                  aria-label="Plan semanal"
                  style={{ display: "inline-flex", alignItems: "center", color: TEXT.tertiary, flexShrink: 0 }}
                >
                  <CalendarDays size={16} aria-hidden="true" />
                </span>
              ) : (
                <span
                  aria-label="Rutina individual"
                  style={{ display: "inline-flex", alignItems: "center", color: TEXT.tertiary, flexShrink: 0 }}
                >
                  <Dumbbell size={16} aria-hidden="true" />
                </span>
              )}
            </div>

            {focusText ? (
              <p
                style={{
                  margin: 0,
                  fontSize: TYPE.label.size,
                  lineHeight: TYPE.label.lineHeight,
                  fontWeight: TYPE.label.weight,
                  letterSpacing: TYPE.label.tracking,
                  color: ACCENT.text,
                  textTransform: "uppercase",
                }}
              >
                {focusText}
              </p>
            ) : null}

            {metrics.dayLabels.length > 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: TYPE.caption.size,
                  lineHeight: TYPE.caption.lineHeight,
                  fontWeight: TYPE.caption.weight,
                  color: TEXT.tertiary,
                }}
              >
                {metrics.dayLabels.join(" • ")}
              </p>
            ) : null}

            <p
              style={{
                margin: 0,
                fontFamily: TYPE.mono.font,
                fontSize: TYPE.subhead.size,
                lineHeight: TYPE.subhead.lineHeight,
                fontWeight: TYPE.subhead.weight,
                fontVariantNumeric: "tabular-nums",
                color: TEXT.secondary,
              }}
            >
              {metrics.exerciseCount} {ROUTINES_UI_LABELS.exercises} • ~{metrics.minutes}{" "}
              {ROUTINES_UI_LABELS.minApprox}
            </p>

            {incomplete ? (
              <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                {ROUTINES_UI_LABELS.incomplete}
              </p>
            ) : null}
          </div>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              hapticLight();
              if (!incomplete) onTrain(routine);
            }}
            disabled={incomplete}
            aria-label={ROUTINES_UI_LABELS.startWorkout}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.xs,
              minHeight: MOTION.minTouchTarget,
              padding: `0 ${SPACE.md}px`,
              borderRadius: RADIUS.control,
              border: `1px solid ${incomplete ? GLASS.border : ACCENT.base}`,
              background: "transparent",
              color: incomplete ? TEXT.disabled : ACCENT.text,
              fontSize: TYPE.subhead.size,
              lineHeight: TYPE.subhead.lineHeight,
              fontWeight: 700,
              letterSpacing: TYPE.subhead.tracking,
              cursor: incomplete ? "not-allowed" : "pointer",
              opacity: incomplete ? 0.55 : 1,
              ...pressStyle,
            }}
          >
            <Play size={18} aria-hidden="true" />
            {ROUTINES_UI_LABELS.startWorkout}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              hapticLight();
              setConfirmDelete(false);
              setSheetOpen(true);
            }}
            aria-label={ROUTINES_UI_LABELS.options}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: MOTION.minTouchTarget,
              minWidth: MOTION.minTouchTarget,
              height: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.borderStrong}`,
              background: GLASS.fillSubtle,
              color: TEXT.secondary,
              cursor: "pointer",
              flexShrink: 0,
              ...pressStyle,
            }}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
        </div>

        {sheetOpen ? (
          <div
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              closeSheet();
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: Z_INDEX.sheet,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              background: SCRIM.modal,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={ROUTINES_UI_LABELS.options}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 560,
                borderTopLeftRadius: RADIUS.sheet,
                borderTopRightRadius: RADIUS.sheet,
                border: `1px solid ${GLASS.borderStrong}`,
                borderBottom: "none",
                background: SOLID.popover,
                boxShadow: GLASS.shadow,
                padding: SPACE.md,
                display: "flex",
                flexDirection: "column",
                gap: SPACE.xs,
                ...(reducedMotion
                  ? {}
                  : { animation: `cronos-sheet-up ${MOTION.fast} ${MOTION.easeOut} both` }),
              }}
            >
              <p
                style={{
                  margin: 0,
                  padding: `0 ${SPACE.xs}px`,
                  fontFamily: TYPE.mono.font,
                  fontSize: TYPE.label.size,
                  lineHeight: TYPE.label.lineHeight,
                  fontWeight: TYPE.label.weight,
                  letterSpacing: TYPE.label.tracking,
                  color: TEXT.tertiary,
                  textTransform: "uppercase",
                }}
              >
                {routine.title}
              </p>

              <ActionRow
                icon={<Pencil size={16} color={TEXT.secondary} aria-hidden="true" />}
                label={ROUTINES_UI_LABELS.editRoutine}
                color={TEXT.primary}
                onClick={handleEdit}
              />
              {onDuplicate ? (
                <ActionRow
                  icon={<Copy size={16} color={TEXT.secondary} aria-hidden="true" />}
                  label={ROUTINES_UI_LABELS.duplicate}
                  color={TEXT.primary}
                  onClick={handleDuplicate}
                />
              ) : null}
              {onDelete ? (
                <ActionRow
                  icon={<Trash2 size={16} color={ACCENT.base} aria-hidden="true" />}
                  label={confirmDelete ? ROUTINES_UI_LABELS.deleteConfirm : ROUTINES_UI_LABELS.delete}
                  color={ACCENT.base}
                  onClick={handleDelete}
                />
              ) : null}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSheet();
                }}
                style={{
                  width: "100%",
                  minHeight: MOTION.minTouchTarget,
                  marginTop: SPACE.xs,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.border}`,
                  background: GLASS.fillSubtle,
                  color: TEXT.secondary,
                  fontSize: TYPE.caption.size,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {ROUTINES_UI_LABELS.cancel}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}

function ActionRow({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        hapticLight();
        onClick();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: SPACE.sm,
        width: "100%",
        minHeight: MOTION.minTouchTarget,
        padding: `0 ${SPACE.sm}px`,
        border: "none",
        borderRadius: RADIUS.control,
        background: "transparent",
        color,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {icon}
      <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600, color }}>{label}</span>
    </button>
  );
}
