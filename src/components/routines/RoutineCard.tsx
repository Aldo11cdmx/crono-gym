import { useCallback, useMemo, useRef, useState } from "react";
import { Copy, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { Exercise } from "@/types/supabase";
import { ACCENT, GLASS, MOTION, RADIUS, SOLID, SPACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hapticLight } from "@/lib/haptics";
import { ROUTINES_UI_LABELS, translateBodyPart, translateTarget } from "@/lib/i18n";
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
  return exercise.body_part ? translateBodyPart(raw) : translateTarget(raw);
}

function uniqueMuscles(routine: RoutineWithExercises, max = 3): string[] {
  const muscles: string[] = [];
  const seen = new Set<string>();
  for (const ex of routine.exercises) {
    const label = muscleLabel(ex.exercise);
    if (label && !seen.has(label)) {
      seen.add(label);
      muscles.push(label);
    }
    if (muscles.length >= max) break;
  }
  return muscles;
}

export function RoutineCard({
  routine,
  onTrain,
  onEdit,
  onPlan: _onPlan,
  onDuplicate,
  onDelete,
}: RoutineCardProps) {
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
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
    const minutes = Math.max(1, Math.round((totalSets * 45 + restSec) / 60));

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

    return { exerciseCount, minutes, dayLabels, trainingDays: trainingDays.length };
  }, [routine, isWeekly]);

  const muscles = useMemo(() => uniqueMuscles(routine), [routine]);

  const pressStyle = reducedMotion
    ? undefined
    : { transition: `transform ${MOTION.fast} ${MOTION.easeOut}` };

  const trainButtonStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    height: "44px",
    borderRadius: "12px",
    border: "none",
    background: "#FF3B30",
    color: "#FFFFFF",
    fontSize: TYPE.body.size,
    fontWeight: 600,
    cursor: incomplete ? "not-allowed" : "pointer",
    opacity: incomplete ? 0.5 : 1,
    boxShadow: "0 4px 16px rgba(255,59,48,0.25)",
    transition: reducedMotion ? "none" : "transform 150ms ease, box-shadow 150ms ease",
    ...pressStyle,
  } as React.CSSProperties;

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setConfirmDelete(false);
  }, []);

  const handleEdit = useCallback(() => {
    closeMenu();
    onEdit();
  }, [closeMenu, onEdit]);

  const handleDuplicate = useCallback(() => {
    if (!onDuplicate) return;
    closeMenu();
    void onDuplicate(routine);
  }, [closeMenu, onDuplicate, routine]);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    closeMenu();
    void onDelete(routine);
  }, [closeMenu, confirmDelete, onDelete, routine]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    setMenuOpen((prev) => !prev);
  }, []);

  const handleMenuItemClick = useCallback((action: () => void) => {
    hapticLight();
    action();
  }, []);

  return (
    <GlassCard as="article" raised style={{ borderRadius: RADIUS.card, borderColor: GLASS.borderStrong, boxShadow: GLASS.shadow }}>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, padding: SPACE.md }}>
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
            <button
              ref={triggerRef}
              type="button"
              onClick={handleMenuClick}
              aria-label={ROUTINES_UI_LABELS.options}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: MOTION.minTouchTarget,
                height: MOTION.minTouchTarget,
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

          {muscles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
              {muscles.map((m) => (
                <span
                  key={m}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.05)",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#D4D4D4",
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          )}

          {metrics.dayLabels.length > 0 && (
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
          )}

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
            {metrics.exerciseCount} {ROUTINES_UI_LABELS.exercises} • ~{metrics.minutes} {ROUTINES_UI_LABELS.minApprox}
          </p>

          {incomplete && (
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
              {ROUTINES_UI_LABELS.incomplete}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={incomplete}
          onClick={() => {
            if (!incomplete) {
              hapticLight();
              onTrain(routine);
            }
          }}
          aria-label={ROUTINES_UI_LABELS.startWorkout}
          style={trainButtonStyle}
          onMouseDown={() => {
            if (!incomplete && !reducedMotion) {
              document.activeElement?.setAttribute("style", "transform: scale(0.98)");
            }
          }}
          onMouseUp={() => {
            if (!incomplete && !reducedMotion) {
              document.activeElement?.removeAttribute("style");
            }
          }}
          onMouseLeave={() => {
            if (!incomplete && !reducedMotion) {
              document.activeElement?.removeAttribute("style");
            }
          }}
        >
          <Play size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          {ROUTINES_UI_LABELS.startWorkout}
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label={ROUTINES_UI_LABELS.options}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              right: 0,
              zIndex: Z_INDEX.popover,
              minWidth: 180,
              borderRadius: RADIUS.card,
              border: `1px solid ${GLASS.borderStrong}`,
              background: SOLID.popover,
              boxShadow: GLASS.shadow,
              padding: SPACE.xs,
              display: "flex",
              flexDirection: "column",
              gap: SPACE.xs,
              ...(reducedMotion
                ? {}
                : { animation: `cronos-sheet-up ${MOTION.fast} ${MOTION.easeOut} both` }),
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => handleMenuItemClick(handleEdit)}
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
                color: TEXT.primary,
                textAlign: "left",
                cursor: "pointer",
                fontSize: TYPE.subhead.size,
                fontWeight: 600,
              }}
            >
              <Pencil size={16} color={TEXT.secondary} aria-hidden="true" />
              {ROUTINES_UI_LABELS.editRoutine}
            </button>
            {onDuplicate && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleMenuItemClick(handleDuplicate)}
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
                  color: TEXT.primary,
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: TYPE.subhead.size,
                  fontWeight: 600,
                }}
              >
                <Copy size={16} color={TEXT.secondary} aria-hidden="true" />
                {ROUTINES_UI_LABELS.duplicate}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleMenuItemClick(handleDelete)}
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
                  color: ACCENT.base,
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: TYPE.subhead.size,
                  fontWeight: 600,
                }}
              >
                <Trash2 size={16} color={ACCENT.base} aria-hidden="true" />
                {confirmDelete ? ROUTINES_UI_LABELS.deleteConfirm : ROUTINES_UI_LABELS.delete}
              </button>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}