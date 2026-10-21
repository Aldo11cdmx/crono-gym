/**
 * WeeklyPlanner.tsx — el plan semanal, con carrusel de días.
 *
 * La pantalla se lee en dos niveles, de arriba hacia abajo:
 *
 * 1. **Carrusel de días** (L, M, X, J, V, S, D): un carrusel horizontal de
 *    píldoras táctiles de 44×44px con el estado del día. Es el control de
 *    navegación: un solo toque mueve la sesión que se está viendo.
 * 2. **Tarjeta de la sesión seleccionada**: el nombre del día, el resumen de la
 *    rutina ("7 ejercicios · 45 min"), las rutinas que lo componen y las
 *    acciones.
 *
 * Antes había un tercer nivel —una tira con las siete columnas— que repetía los
 * días y los títulos que el carrusel y la tarjeta ya mostraban. Dos vistas de la
 * misma semana en la misma pantalla: los títulos aparecían dos veces y el texto
 * se encimaba. Ahora hay un solo contenedor, y la semana se recorre de un día a
 * otro con el carrusel.
 *
 * Los botones siguen una jerarquía estricta, y cada nivel se ve distinto:
 *
 *  - **Primario** (uno por tarjeta): "Iniciar", en el acento de la marca.
 *  - **Secundario**: "Editar", neutro.
 *  - **Terciario**: acciones discretas, sólo icono (descanso, opciones del día).
 *
 * Token-only styling, iconos Lucide a strokeWidth 1.5.
 */

import {
  Check,
  Circle,
  EllipsisVertical,
  LayoutList,
  Moon,
  MoreHorizontal,
  Pencil,
  Play,
  SkipForward,
  Undo2,
  Redo2,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
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
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import {
  type WeeklyAssignment,
  AssignmentHistory,
  assignToDay,
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
  done: "Completado",
  undoAria: "Deshacer cambio",
  redoAria: "Rehacer cambio",
  dayMenuAria: "Opciones del día",
  rowMoveAria: "Mover rutina a otro día",
  deloadBadge: "SEMANA DE DESCARGA ACTIVA",
  daysAria: "Días de la semana",
  /** The session running right now. */
  inProgress: "En curso",
  /** A day with a session planned. */
  planned: "Planificado",
  /** A free day. */
  restBadge: "Descanso",
  /** The primary action: start the session of the selected day. */
  start: "Iniciar",
  /** The primary action for a day with nothing scheduled. */
  startToday: "Iniciar sesión de hoy",
  /** The secondary action: rename the day or assign a routine to it. */
  edit: "Editar",
  sessionNameAria: "Nombre de la sesión",
  sessionNamePlaceholder: "Nombre de la sesión (ej. Empuje Pro)",
  routinePickerAria: "Asignar rutina al día",
  noSession: "Sin sesión programada",
  noPlanYet: "Todavía no hay nada asignado a este día.",
} as const;

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

/**
 * A tertiary action: a button that carries no word, only its icon.
 *
 * The icon is the whole label, so it always travels with an `aria-label` and a
 * `title` -- a button nobody can read is a button nobody can use.
 */
const tertiaryIconButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.secondary,
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

export interface DayAssignment {
  routineId: string;
  title: string;
  /** Exercises in the routine, for the "7 ejercicios" summary. */
  exerciseCount?: number;
  /** Estimated duration in minutes, for the "45 min" summary. */
  durationMin?: number;
}

export interface WeeklyPlannerProps {
  routines: DayAssignment[];
  initialAssignments: WeeklyAssignment[];
  onChange: (assignments: WeeklyAssignment[]) => void;
  todayIndex?: number;
  /** Days already trained, by their full Spanish name. */
  trainedDays?: Set<string>;
  deloadActive?: boolean;
  /** The routine of the session running right now, if any. */
  activeRoutineId?: string | null;
  /** Starts the session of the given day. */
  onStartDay?: (dayIndex: number) => void;
  /** Starts today's session; shown when today has nothing scheduled. */
  onStartToday?: (dayIndex: number) => void;
}

type DayStatus = "in-progress" | "planned" | "rest" | "done";

export function WeeklyPlanner({
  routines,
  initialAssignments,
  onChange,
  todayIndex = 0,
  trainedDays = new Set(),
  deloadActive = false,
  activeRoutineId = null,
  onStartDay,
  onStartToday,
}: WeeklyPlannerProps) {
  const [assignments, setAssignments] = useState<WeeklyAssignment[]>(
    () => initialAssignments.map((a) => ({ ...a })),
  );

  const historyRef = useRef(new AssignmentHistory(initialAssignments));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const [editing, setEditing] = useState(false);

  const [contextDay, setContextDay] = useState<number | null>(null);
  const [contextAnchor, setContextAnchor] = useState<DOMRect | null>(null);

  const [moveAnchor, setMoveAnchor] = useState<DOMRect | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);

  // The planner follows the calendar: a new day means a new "today".
  useEffect(() => {
    setSelectedDay(todayIndex);
  }, [todayIndex]);

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

  const routineMap = useMemo(
    () => new Map(routines.map((r) => [r.routineId, r])),
    [routines],
  );

  const selectedItems = useMemo(
    () => dayAssignments(selectedDay),
    [dayAssignments, selectedDay],
  );

  /**
   * The name the athlete gave the day, when there is one.
   *
   * The routine's own title is deliberately not used as a fallback: the rows
   * below already print it, and repeating it here would print the same name
   * twice on the screen.
   */
  const sessionName = useMemo(() => {
    const first = selectedItems[0];
    const custom = first?.title?.trim();
    return custom && custom !== "" ? custom : "";
  }, [selectedItems]);

  /**
   * The card's headline.
   *
   * The name the athlete gave the day, the day's own name when there is a
   * session but no name, and an honest "nothing scheduled" when there is none.
   */
  const cardTitle = useMemo(() => {
    if (sessionName !== "") return sessionName;
    if (selectedItems.length > 0) return `Sesión de ${WEEKDAY_NAMES[selectedDay]}`;
    return LABELS.noSession;
  }, [sessionName, selectedItems.length, selectedDay]);

  const status = useMemo((): DayStatus => {
    if (activeRoutineId && selectedItems.some((a) => a.routineId === activeRoutineId)) {
      return "in-progress";
    }
    if (selectedItems.length > 0) return "planned";
    if (trainedDays.has(WEEKDAY_NAMES[selectedDay])) return "done";
    return "rest";
  }, [activeRoutineId, selectedItems, selectedDay, trainedDays]);

  const summary = useMemo(() => {
    if (selectedItems.length === 0) return LABELS.noSession;
    let exercises = 0;
    let minutes = 0;
    let known = false;
    for (const item of selectedItems) {
      const routine = routineMap.get(item.routineId);
      if (!routine || routine.exerciseCount === undefined) continue;
      known = true;
      exercises += routine.exerciseCount;
      minutes += routine.durationMin ?? 0;
    }
    if (!known) {
      const n = selectedItems.length;
      return n === 1 ? "1 rutina asignada" : `${n} rutinas asignadas`;
    }
    return `${exercises} ejercicios · ${minutes} min`;
  }, [selectedItems, routineMap]);

  /**
   * The state of the selected day, as an icon and a word.
   *
   * The label is the *state* and never the session's name: the name is printed
   * by the card's title, and printing it twice would put the same text on the
   * screen twice.
   */
  const statusBadge = useMemo(() => {
    switch (status) {
      case "in-progress":
        return { Icon: Circle, filled: true, label: LABELS.inProgress, color: ACCENT.text };
      case "planned":
        return { Icon: Zap, filled: false, label: LABELS.planned, color: STATUS.progression.text };
      case "done":
        return { Icon: Check, filled: false, label: LABELS.done, color: STATUS.success.text };
      default:
        return { Icon: Moon, filled: false, label: LABELS.restBadge, color: TEXT.tertiary };
    }
  }, [status]);

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

  /** Renames the session of a day: the name lives on its first assignment. */
  const handleRename = useCallback(
    (dayIndex: number, title: string) => {
      const items = dayAssignments(dayIndex);
      const first = items[0];
      if (!first) return;
      const next = assignments.map((a) =>
        a.id === first.id ? { ...a, title } : a,
      );
      commit(next);
    },
    [assignments, commit, dayAssignments],
  );

  /** Assigns a routine to a day, appending it to that day's queue. */
  const handleAssign = useCallback(
    (routineId: string, dayIndex: number) => {
      const next = assignToDay(assignments, routineId, dayIndex);
      commit(next);
    },
    [assignments, commit],
  );

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
        setEditing(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const dayStatus = useCallback(
    (dayIndex: number): DayStatus => {
      const items = dayAssignments(dayIndex);
      if (activeRoutineId && items.some((a) => a.routineId === activeRoutineId)) {
        return "in-progress";
      }
      if (items.length > 0) return "planned";
      if (trainedDays.has(WEEKDAY_NAMES[dayIndex])) return "done";
      return "rest";
    },
    [activeRoutineId, dayAssignments, trainedDays],
  );

  const statusDotColor = useCallback((dayStatusValue: DayStatus): string => {
    switch (dayStatusValue) {
      case "in-progress":
        return ACCENT.base;
      case "planned":
        return STATUS.progression.base;
      case "done":
        return STATUS.success.base;
      default:
        return GLASS.borderStrong;
    }
  }, []);

  const isTodayEmpty = selectedDay === todayIndex && selectedItems.length === 0;

  const handlePrimaryAction = useCallback(() => {
    if (isTodayEmpty) {
      if (onStartToday) onStartToday(todayIndex);
      else if (onStartDay) onStartDay(todayIndex);
      return;
    }
    if (onStartDay) onStartDay(selectedDay);
    else if (onStartToday && selectedDay === todayIndex) onStartToday(todayIndex);
  }, [isTodayEmpty, onStartDay, onStartToday, selectedDay, todayIndex]);

  /**
   * Whether the primary action can do anything.
   *
   * A free day has nothing to start, so the primary button is disabled rather
   * than promising an action that would do nothing. Today is the exception:
   * the athlete can still start a session from scratch.
   */
  const canStart = isTodayEmpty
    ? Boolean(onStartToday ?? onStartDay)
    : selectedItems.length > 0 && Boolean(onStartDay ?? onStartToday);

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

        {/* Carrusel de días */}
        <div
          role="tablist"
          aria-label={LABELS.daysAria}
          style={{
            display: "flex",
            flexDirection: "row",
            gap: SPACE.xs,
            overflowX: "auto",
            paddingBottom: SPACE.xs,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {WEEKDAY_NAMES.map((dayName, dayIndex) => {
            const dayState = dayStatus(dayIndex);
            const isToday = dayIndex === todayIndex;
            const isSelected = dayIndex === selectedDay;

            return (
              <button
                key={dayName}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={dayName}
                title={dayName}
                data-day-index={dayIndex}
                onClick={() => {
                  setSelectedDay(dayIndex);
                  setEditing(false);
                }}
                style={{
                  /*
                   * The seven days share the width the phone has: the pills
                   * shrink rather than push Saturday and Sunday off the screen,
                   * and they keep the 44px of height a tap needs.
                   */
                  minWidth: MOTION.minTouchTarget,
                  maxWidth: MOTION.minTouchTarget,
                  minHeight: MOTION.minTouchTarget,
                  height: MOTION.minTouchTarget,
                  borderRadius: RADIUS.round,
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  fontSize: TYPE.subhead.size,
                  fontWeight: TYPE.subhead.weight,
                  letterSpacing: "0.02em",
                  color: isSelected ? TEXT.onAccent : TEXT.secondary,
                  background: isSelected
                    ? ACCENT.base
                    : isToday
                      ? ACCENT.subtle
                      : GLASS.fill,
                  border: `1px solid ${isSelected ? ACCENT.border : GLASS.border}`,
                  boxShadow: isSelected ? `0 0 12px ${ACCENT.glow}, ${ACCENT.ring}` : "none",
                  cursor: "pointer",
                  flex: "1 1 0",
                }}
              >
                <span>{WEEKDAY_SHORT_ES[dayIndex]}</span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: RADIUS.round,
                    background: isSelected
                      ? TEXT.onAccent
                      : statusDotColor(dayState),
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Tarjeta de la sesión seleccionada */}
        <div
          style={{
            ...SURFACE_RAISED,
            borderRadius: RADIUS.card,
            border: `1px solid ${GLASS.border}`,
            padding: SPACE.md,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE.sm,
            }}
          >
            <span
              style={{
                fontSize: TYPE.label.size,
                fontWeight: TYPE.label.weight,
                letterSpacing: TYPE.label.tracking,
                textTransform: "uppercase",
                color: TEXT.tertiary,
              }}
            >
              {WEEKDAY_NAMES[selectedDay]}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: SPACE.xs,
                fontSize: TYPE.caption.size,
                fontWeight: TYPE.caption.weight,
                color: statusBadge.color,
                background: GLASS.fill,
                border: `1px solid ${GLASS.border}`,
                borderRadius: RADIUS.chip,
                padding: "2px 8px",
                maxWidth: "60%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <statusBadge.Icon
                size={12}
                strokeWidth={1.5}
                fill={statusBadge.filled ? "currentColor" : "none"}
                aria-hidden="true"
              />
              {statusBadge.label}
            </span>
          </div>

          {editing ? (
            <SessionEditor
              routines={routines}
              currentName={sessionName}
              onRename={(value) => handleRename(selectedDay, value)}
              onAssign={(routineId) => handleAssign(routineId, selectedDay)}
              onClose={() => setEditing(false)}
            />
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    fontSize: TYPE.title2.size,
                    fontWeight: TYPE.title2.weight,
                    color: TEXT.primary,
                    lineHeight: TYPE.title2.lineHeight,
                  }}
                >
                  {cardTitle}
                </span>
                {selectedItems.length > 0 && (
                  <span
                    style={{
                      fontSize: TYPE.caption.size,
                      color: TEXT.secondary,
                    }}
                  >
                    {summary}
                  </span>
                )}
              </div>

              {/* Las rutinas del día: aquí se reordena arrastrando. */}
              {selectedItems.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ROW_GAP,
                  }}
                >
                  {selectedItems.map((a) => {
                    const routine = routineMap.get(a.routineId);
                    const title = routine?.title ?? a.routineId;
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

              {/*
               * Un botón por nivel, y cada nivel con su propio peso visual:
               * el primario es la acción, el secundario acompaña, el terciario
               * son acciones discretas que no compiten por la atención.
               */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE.sm,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={!canStart}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: SPACE.xs,
                    minHeight: MOTION.minTouchTarget,
                    padding: `0 ${SPACE.md}`,
                    borderRadius: RADIUS.control,
                    border: "none",
                    backgroundColor: canStart ? ACCENT.base : TEXT.disabled,
                    color: canStart ? TEXT.onAccent : TEXT.tertiary,
                    fontFamily: FONT_SANS,
                    fontSize: TYPE.subhead.size,
                    fontWeight: TYPE.subhead.weight,
                    cursor: canStart ? "pointer" : "default",
                  }}
                >
                  <Play size={16} strokeWidth={1.5} aria-hidden="true" />
                  {isTodayEmpty ? LABELS.startToday : LABELS.start}
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: SPACE.xs,
                    minHeight: MOTION.minTouchTarget,
                    padding: `0 ${SPACE.md}`,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${GLASS.border}`,
                    background: SURFACE.raised,
                    color: TEXT.primary,
                    fontFamily: FONT_SANS,
                    fontSize: TYPE.subhead.size,
                    fontWeight: TYPE.subhead.weight,
                    cursor: "pointer",
                  }}
                >
                  <Pencil size={15} strokeWidth={1.5} aria-hidden="true" />
                  {LABELS.edit}
                </button>

                {selectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleMarkRest(selectedDay)}
                    aria-label={LABELS.markRest}
                    title={LABELS.markRest}
                    style={tertiaryIconButtonStyle}
                  >
                    <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  aria-label={LABELS.dayMenuAria}
                  title={LABELS.dayMenuAria}
                  onClick={(e) => openDayContext(selectedDay, e)}
                  style={tertiaryIconButtonStyle}
                >
                  <EllipsisVertical size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
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

/**
 * The inline editor of a day: its name and the routine assigned to it.
 *
 * It replaces the card's contents rather than opening over them, so the athlete
 * edits one thing at a time on a phone.
 */
function SessionEditor({
  routines,
  currentName,
  onRename,
  onAssign,
  onClose,
}: {
  routines: DayAssignment[];
  currentName: string;
  onRename: (value: string) => void;
  onAssign: (routineId: string) => void;
  onClose: () => void;
}) {
  // The field is local while it is being typed: committing on every keystroke
  // would push an undo entry per character and re-render the week on each one.
  const [draft, setDraft] = useState(currentName);

  useEffect(() => {
    setDraft(currentName);
  }, [currentName]);

  const commitName = () => {
    if (draft !== currentName) onRename(draft);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <input
        type="text"
        value={draft}
        aria-label={LABELS.sessionNameAria}
        placeholder={LABELS.sessionNamePlaceholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitName();
          }
        }}
        style={{
          width: "100%",
          minHeight: MOTION.minTouchTarget,
          padding: `0 ${SPACE.md}`,
          borderRadius: RADIUS.control,
          border: `1px solid ${GLASS.border}`,
          background: SOLID.card,
          color: TEXT.primary,
          fontFamily: FONT_SANS,
          fontSize: TYPE.subhead.size,
        }}
      />
      <div
        role="group"
        aria-label={LABELS.routinePickerAria}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: SPACE.xs,
        }}
      >
        {routines.length === 0 && (
          <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
            {LABELS.noPlanYet}
          </span>
        )}
        {routines.map((routine) => (
          <button
            key={routine.routineId}
            type="button"
            onClick={() => onAssign(routine.routineId)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: SPACE.xs,
              minHeight: 32,
              padding: `0 ${SPACE.sm}`,
              borderRadius: RADIUS.pill,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
              color: TEXT.secondary,
              fontSize: TYPE.caption.size,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Play size={12} strokeWidth={1.5} />
            {routine.title}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            minHeight: MOTION.minTouchTarget,
            padding: `0 ${SPACE.md}`,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: "transparent",
            color: TEXT.secondary,
            fontFamily: FONT_SANS,
            fontSize: TYPE.subhead.size,
            cursor: "pointer",
          }}
        >
          {LABELS.moveCancel}
        </button>
      </div>
    </div>
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
          <Moon size={14} strokeWidth={1.5} />
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
