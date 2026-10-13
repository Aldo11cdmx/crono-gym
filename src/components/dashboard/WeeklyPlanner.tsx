/**
 * WeeklyPlanner.tsx — the advanced weekly planner strip.
 *
 * A horizontal 7-day strip (Monday → Sunday) where each day shows its
 * routine assignments and supports:
 *
 * - **Drag-and-drop** reordering of assignments within a day (HTML5 DnD API,
 *   fully keyboard-accessible via Enter → "Mover rutina a…" menu).
 * - **Day context menu** (⋮): assign routine, mark rest day, move to tomorrow,
 *   skip today.
 * - **Undo / Redo** stack (20 steps) with Lucide `Undo2` / `Redo2` buttons.
 *
 * Token-only styling, Lucide icons at strokeWidth 1.5.
 */

import {
  EllipsisVertical,
  LayoutList,
  MoreHorizontal,
  PauseCircle,
  SkipForward,
  Undo2,
  Redo2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  ACCENT,
  FONT_SANS,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SOLID,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import {
  type WeeklyAssignment,
  AssignmentHistory,
  moveAssignmentToDay,
  reorderAssignments,
  shiftDayForward,
  skipDay,
} from "@/lib/routines/routinesViewModel";
import { WEEKDAY_SHORT_ES, WEEKDAY_NAME_ES } from "@/lib/dashboard/heroCardModel";

const WEEKDAY_NAMES = [...WEEKDAY_NAME_ES];

const LABELS = {
  planTitle: "Plan semanal",
  assignRoutine: "Asignar rutina",
  markRest: "Marcar como descanso",
  moveToTomorrow: "Mover a mañana",
  skipToday: "Saltar hoy",
  undo: "Deshacer",
  redo: "Rehacer",
  closeAria: "Cerrar",
  movePrompt: "Mover rutina a",
  moveCancel: "Cancelar",
  noRoutines: "Sin rutinas asignadas",
  restDay: "Descanso",
  undoAria: "Deshacer cambio",
  redoAria: "Rehacer cambio",
  dayMenuAria: "Abrir menú del día",
  rowMoveAria: "Mover rutina a otro día",
  deloadBadge: "SEMANA DE DESCARGA ACTIVA",
};

const ROW_GAP = RADIUS.sm;

const SURFACE_STYLE: CSSProperties = {
  backgroundColor: GLASS.fill,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

const SURFACE_RAISED: CSSProperties = {
  backgroundColor: GLASS.fillRaised,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

const OVERLAY_STYLE: CSSProperties = {
  backgroundColor: SCRIM.modal,
  backdropFilter: "blur(8px)",
};

const menuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.xs,
  padding: `${SPACE.sm}px ${SPACE.md}px`,
  borderRadius: RADIUS.sm,
  border: "none",
  background: "transparent",
  color: TEXT.primary,
  cursor: "pointer",
  fontFamily: FONT_SANS,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.subhead.weight,
  textAlign: "left",
};

const smallIconButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: RADIUS.round,
  border: "none",
  background: "transparent",
  color: TEXT.tertiary,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function actionButtonStyle(enabled: boolean): CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: RADIUS.round,
    border: `1px solid ${enabled ? GLASS.borderStrong : GLASS.border}`,
    background: enabled ? GLASS.fillRaised : "transparent",
    color: enabled ? TEXT.primary : TEXT.disabled,
    cursor: enabled ? "pointer" : "default",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

interface DayAssignment {
  routineId: string;
  title: string;
}

export interface WeeklyPlannerProps {
  routines: DayAssignment[];
  initialAssignments: WeeklyAssignment[];
  onChange: (assignments: WeeklyAssignment[]) => void;
  todayIndex?: number;
  trainedDays?: Set<string>;
  deloadActive?: boolean;
}

export function WeeklyPlanner({
  routines,
  initialAssignments,
  onChange,
  todayIndex = 0,
  trainedDays = new Set(),
  deloadActive = false,
}: WeeklyPlannerProps) {
  const [assignments, setAssignments] = useState<WeeklyAssignment[]>(
    () => initialAssignments.map((a) => ({ ...a })),
  );

  const historyRef = useRef(new AssignmentHistory(initialAssignments));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [contextDay, setContextDay] = useState<number | null>(null);
  const [contextAnchor, setContextAnchor] = useState<DOMRect | null>(null);

  const [moveAnchor, setMoveAnchor] = useState<DOMRect | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);

  const syncHistory = useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const commit = useCallback(
    (next: WeeklyAssignment[]) => {
      historyRef.current.push(next);
      setAssignments(next);
      onChange(next);
      syncHistory();
    },
    [onChange, syncHistory],
  );

  const dayAssignments = useCallback(
    (dayIndex: number): WeeklyAssignment[] =>
      assignments
        .filter((a) => a.dayIndex === dayIndex)
        .sort((a, b) => a.order - b.order),
    [assignments],
  );

  const routineMap = new Map(routines.map((r) => [r.routineId, r.title]));

  const handleDrop = useCallback(
    (draggedId: string, targetId: string) => {
      const from = assignments.findIndex((a) => a.id === draggedId);
      const to = assignments.findIndex((a) => a.id === targetId);
      if (from >= 0 && to >= 0) {
        const reordered = reorderAssignments(assignments, from, to);
        commit(reordered);
      }
    },
    [assignments, commit],
  );

  const handleMarkRest = useCallback(
    (dayIndex: number) => {
      const next = skipDay(assignments, dayIndex);
      commit(next);
      setContextDay(null);
      setContextAnchor(null);
    },
    [assignments, commit],
  );

  const handleMoveToTomorrow = useCallback(
    (dayIndex: number) => {
      const next = shiftDayForward(assignments, dayIndex);
      commit(next);
      setContextDay(null);
      setContextAnchor(null);
    },
    [assignments, commit],
  );

  const handleSkipToday = useCallback(() => {
    const next = skipDay(assignments, todayIndex);
    commit(next);
    setContextDay(null);
    setContextAnchor(null);
  }, [assignments, todayIndex, commit]);

  const handleMoveRoutineToDay = useCallback(
    (targetDay: number) => {
      if (moveTargetId) {
        const next = moveAssignmentToDay(assignments, moveTargetId, targetDay);
        commit(next);
      }
      setMoveTargetId(null);
      setMoveAnchor(null);
    },
    [assignments, commit, moveTargetId],
  );

  const handleUndo = useCallback(() => {
    const undone = historyRef.current.undo();
    if (undone) {
      setAssignments(undone);
      onChange(undone);
    }
    syncHistory();
  }, [onChange, syncHistory]);

  const handleRedo = useCallback(() => {
    const redone = historyRef.current.redo();
    if (redone) {
      setAssignments(redone);
      onChange(redone);
    }
    syncHistory();
  }, [onChange, syncHistory]);

  const openDayContext = useCallback(
    (dayIndex: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setContextDay(dayIndex);
      setContextAnchor(rect);
    },
    [],
  );

  const openMoveMenu = useCallback(
    (routineId: string, e: React.MouseEvent | React.KeyboardEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setMoveTargetId(routineId);
      setMoveAnchor(rect);
    },
    [],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextDay(null);
        setContextAnchor(null);
        setMoveTargetId(null);
        setMoveAnchor(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
          marginTop: SPACE.md,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ ...TYPE.subhead, color: TEXT.secondary, margin: 0 }}>
            {LABELS.planTitle}
          </h3>
          {deloadActive && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: TYPE.caption.size,
                fontWeight: TYPE.caption.weight,
                color: STATUS.warning.text,
                background: STATUS.warning.muted,
                borderRadius: RADIUS.chip,
                padding: "2px 8px",
                marginLeft: SPACE.sm,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: RADIUS.round,
                  background: STATUS.warning.base,
                }}
              />
              {LABELS.deloadBadge}
            </span>
          )}
          <div style={{ display: "flex", gap: SPACE.xs }}>
            <button
              aria-label={LABELS.undo}
              title={LABELS.undo}
              onClick={handleUndo}
              disabled={!canUndo}
              style={actionButtonStyle(canUndo)}
            >
              <Undo2 size={16} strokeWidth={1.5} />
            </button>
            <button
              aria-label={LABELS.redo}
              title={LABELS.redo}
              onClick={handleRedo}
              disabled={!canRedo}
              style={actionButtonStyle(canRedo)}
            >
              <Redo2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: SPACE.sm,
            overflowX: "auto",
            paddingBottom: SPACE.xs,
          }}
        >
          {WEEKDAY_NAMES.map((dayName, dayIndex) => {
            const dayItems = dayAssignments(dayIndex);
            const isToday = dayIndex === todayIndex;
            const dayHasContent =
              dayItems.length > 0 || trainedDays.has(dayName);

            return (
              <div
                key={dayName}
                data-day-index={dayIndex}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: SPACE.xs,
                  minWidth: 96,
                  flex: "0 0 auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: SPACE.xs,
                  }}
                >
                  <button
                    type="button"
                    aria-label={dayName}
                    title={dayName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "ArrowDown") {
                        e.preventDefault();
                        openMoveMenu(dayItems[0]?.id ?? "", e);
                      }
                    }}
                    style={{
                      width: MOTION.minTouchTarget,
                      height: MOTION.minTouchTarget,
                      borderRadius: RADIUS.round,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: TYPE.caption.size,
                      fontWeight: isToday ? TYPE.caption.weight : undefined,
                      letterSpacing: "0.02em",
                      color: isToday ? TEXT.onAccent : TEXT.tertiary,
                      background: isToday ? ACCENT.base : GLASS.fill,
                      border: `1px solid ${isToday ? ACCENT.border : GLASS.border}`,
                      boxShadow: isToday ? ACCENT.ring : "none",
                      cursor: "default",
                    }}
                  >
                    {WEEKDAY_SHORT_ES[dayIndex]}
                  </button>
                  {isToday && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: RADIUS.round,
                        background: ACCENT.base,
                      }}
                    />
                  )}
                  <button
                    type="button"
                    aria-label={LABELS.dayMenuAria}
                    title={LABELS.dayMenuAria}
                    onClick={(e) => openDayContext(dayIndex, e)}
                    style={smallIconButtonStyle}
                  >
                    <EllipsisVertical size={14} strokeWidth={1.5} />
                  </button>
                </div>

                {dayItems.length === 0 ? (
                  <div style={{ padding: `${SPACE.sm}px`, minHeight: 40 }}>
                    {!isToday && !dayHasContent && (
                      <span
                        style={{
                          fontSize: TYPE.caption.size,
                          color: TEXT.tertiary,
                        }}
                      >
                        {LABELS.restDay}
                      </span>
                    )}
                    {isToday && (
                      <span
                        style={{
                          fontSize: TYPE.caption.size,
                          color: TEXT.tertiary,
                        }}
                      >
                        {LABELS.noRoutines}
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: ROW_GAP,
                    }}
                  >
                    {dayItems.map((a) => {
                      const title = routineMap.get(a.routineId) ?? a.routineId;
                      return (
                        <DayAssignmentRow
                          key={a.id}
                          assignment={a}
                          title={title}
                          draggedId={draggedId}
                          onDragStart={setDraggedId}
                          onDragEnd={() => setDraggedId(null)}
                          onDrop={handleDrop}
                          onMoveDay={openMoveMenu}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {contextDay !== null && contextAnchor && (
        <DayContextMenu
          dayIndex={contextDay}
          dayName={WEEKDAY_NAMES[contextDay]}
          anchorRect={contextAnchor}
          onMarkRest={() => handleMarkRest(contextDay)}
          onMoveToTomorrow={() => handleMoveToTomorrow(contextDay)}
          onSkipToday={contextDay === todayIndex ? handleSkipToday : undefined}
          onClose={() => {
            setContextDay(null);
            setContextAnchor(null);
          }}
        />
      )}

      {moveTargetId !== null && moveAnchor && (
        <MoveMenu
          anchorRect={moveAnchor}
          days={WEEKDAY_NAMES}
          onSelect={handleMoveRoutineToDay}
          onClose={() => {
            setMoveTargetId(null);
            setMoveAnchor(null);
          }}
        />
      )}
    </>
  );
}

interface DayAssignmentRowProps {
  assignment: WeeklyAssignment;
  title: string;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (draggedId: string, targetId: string) => void;
  onMoveDay: (id: string, e: React.MouseEvent | React.KeyboardEvent) => void;
}

function DayAssignmentRow({
  assignment,
  title,
  draggedId,
  onDragStart,
  onDragEnd,
  onDrop,
  onMoveDay,
}: DayAssignmentRowProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(assignment.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (draggedId && draggedId !== assignment.id) {
          onDrop(draggedId, assignment.id);
        }
      }}
      style={{
        ...SURFACE_STYLE,
        borderRadius: RADIUS.control,
        padding: SPACE.sm,
        border: `1px solid ${GLASS.border}`,
        cursor: "grab",
        opacity: draggedId === assignment.id ? 0.5 : 1,
        touchAction: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.xs,
        }}
      >
        <LayoutList size={14} style={{ color: TEXT.tertiary, flexShrink: 0 }} />
        <span
          style={{
            fontSize: TYPE.caption.size,
            color: TEXT.secondary,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={title}
        >
          {title}
        </span>
        <button
          type="button"
          aria-label={LABELS.rowMoveAria}
          title={LABELS.rowMoveAria}
          onClick={(e) => onMoveDay(assignment.id, e)}
          style={smallIconButtonStyle}
        >
          <MoreHorizontal size={12} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

interface DayContextMenuProps {
  dayIndex: number;
  dayName: string;
  anchorRect: DOMRect;
  onMarkRest: () => void;
  onMoveToTomorrow: () => void;
  onSkipToday?: () => void;
  onClose: () => void;
}

function DayContextMenu({
  dayName,
  anchorRect,
  onMarkRest,
  onMoveToTomorrow,
  onSkipToday,
  onClose,
}: DayContextMenuProps) {
  const top = Math.min(anchorRect.bottom, window.innerHeight - 260);
  const left = Math.min(anchorRect.left, window.innerWidth - 200);

  return (
    <>
      <div
        onClick={onClose}
        style={{ ...OVERLAY_STYLE, position: "fixed", inset: 0, zIndex: Z_INDEX.modal }}
      />
      <div
        role="menu"
        aria-label={`Opciones para ${dayName}`}
        style={{
          ...SURFACE_RAISED,
          position: "fixed",
          top,
          left,
          minWidth: 180,
          borderRadius: RADIUS.control,
          border: `1px solid ${GLASS.border}`,
          padding: SPACE.xs,
          zIndex: Z_INDEX.modal,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <button type="button" role="menuitem" onClick={onMarkRest} style={menuItemStyle}>
          <PauseCircle size={14} strokeWidth={1.5} />
          {LABELS.markRest}
        </button>
        <button type="button" role="menuitem" onClick={onMoveToTomorrow} style={menuItemStyle}>
          <SkipForward size={14} strokeWidth={1.5} />
          {LABELS.moveToTomorrow}
        </button>
        {onSkipToday && (
          <button type="button" role="menuitem" onClick={onSkipToday} style={menuItemStyle}>
            <SkipForward size={14} strokeWidth={1.5} />
            {LABELS.skipToday}
          </button>
        )}
      </div>
    </>
  );
}

interface MoveMenuProps {
  anchorRect: DOMRect;
  days: string[];
  onSelect: (dayIndex: number) => void;
  onClose: () => void;
}

function MoveMenu({ anchorRect, days, onSelect, onClose }: MoveMenuProps) {
  const [selected, setSelected] = useState<string>("");

  return (
    <>
      <div
        onClick={onClose}
        style={{ ...OVERLAY_STYLE, position: "fixed", inset: 0, zIndex: Z_INDEX.modal }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={LABELS.movePrompt}
        style={{
          ...SURFACE_RAISED,
          position: "fixed",
          top: Math.min(anchorRect.bottom + 8, window.innerHeight - 300),
          left: Math.min(anchorRect.left, window.innerWidth - 220),
          maxWidth: 200,
          borderRadius: RADIUS.control,
          border: `1px solid ${GLASS.border}`,
          padding: SPACE.md,
          zIndex: Z_INDEX.modal,
        }}
      >
        <h3 style={{ ...TYPE.subhead, color: TEXT.primary, margin: 0, marginBottom: SPACE.sm }}>
          {LABELS.movePrompt}
        </h3>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            width: "100%",
            padding: SPACE.sm,
            borderRadius: RADIUS.input,
            border: `1px solid ${GLASS.border}`,
            background: GLASS.fill,
            color: TEXT.primary,
            fontFamily: FONT_SANS,
            fontSize: TYPE.body.size,
            marginBottom: SPACE.md,
          }}
        >
          <option value="">Selecciona un día</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: SPACE.sm, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
              color: TEXT.primary,
              cursor: "pointer",
              fontFamily: FONT_SANS,
              fontSize: TYPE.subhead.size,
            }}
          >
            {LABELS.moveCancel}
          </button>
          <button
            onClick={() => {
              if (selected) {
                onSelect(days.indexOf(selected));
              }
            }}
            disabled={!selected}
            style={{
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.popover,
              color: TEXT.primary,
              cursor: "pointer",
              fontFamily: FONT_SANS,
              fontSize: TYPE.subhead.size,
            }}
          >
            {LABELS.assignRoutine}
          </button>
        </div>
      </div>
    </>
  );
}
