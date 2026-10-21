/**
 * WeeklyPlanEditor.tsx — el diseñador del plan semanal: siete días en una pantalla.
 *
 * Un acordeón de lunes a domingo. Cada día tiene su propio nombre ("Empuje
 * Pro"), sus propios ejercicios y su propio botón de "Agregar ejercicio", y
 * el nombre del día vive en el borrador (`RoutineDraft.dayLabels`) en vez de
 * repetirse en cada movimiento: renombrar un día no debe reescribir todas sus
 * filas.
 *
 * Token-only styling, iconos Lucide a strokeWidth 1.5.
 */

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Plus,
  Trash2,
} from "lucide-react";
import { WEEKDAY_NAME_ES, WEEKDAY_SHORT_ES } from "@/lib/dashboard/heroCardModel";
import {
  dayLabelFor,
  getExerciseName,
  getRepLabel,
  type DraftExercise,
  type RoutineDraft,
} from "@/lib/routines/routineDraftModel";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT,
  TYPE,
} from "@/design/tokens";

const LABELS = {
  dayNameAria: "Nombre de la sesión",
  dayNamePlaceholder: "Nombre del día (ej. Empuje Pro)",
  addExercise: "+ Agregar Ejercicio",
  moveUp: "Subir",
  moveDown: "Bajar",
  remove: "Quitar",
  sets: "Series",
  rest: "Descanso",
  emptyDay: "Sin ejercicios en este día.",
  exerciseCount: (n: number) => (n === 1 ? "1 ejercicio" : `${n} ejercicios`),
} as const;

export interface WeeklyPlanEditorProps {
  draft: RoutineDraft;
  /** Renames the session of a day. */
  onRenameDay: (dayIndex: number, label: string) => void;
  /** Opens the exercise picker for a day. */
  onAddExercise: (dayIndex: number) => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, changes: Partial<DraftExercise>) => void;
  /** Moves an item up or down inside the plan. */
  onMoveItem: (from: number, to: number) => void;
}

export function WeeklyPlanEditor({
  draft,
  onRenameDay,
  onAddExercise,
  onRemoveItem,
  onUpdateItem,
  onMoveItem,
}: WeeklyPlanEditorProps) {
  const days = useMemo(() => {
    const buckets: { index: number; item: DraftExercise }[][] = Array.from(
      { length: WEEKDAY_NAME_ES.length },
      () => [] as { index: number; item: DraftExercise }[],
    );
    draft.items.forEach((item, index) => {
      const day = item.dayIndex ?? draft.dayIndex;
      if (day < 0 || day >= buckets.length) return;
      buckets[day].push({ index, item });
    });
    return buckets;
  }, [draft]);

  // Open the first day that already has something in it; Monday otherwise.
  const [openDay, setOpenDay] = useState<number>(() => {
    const first = days.findIndex((bucket) => bucket.length > 0);
    return first >= 0 ? first : 0;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
      {WEEKDAY_NAME_ES.map((dayName, dayIndex) => {
        const bucket = days[dayIndex] ?? [];
        const isOpen = openDay === dayIndex;
        const label = dayLabelFor(draft, dayIndex);

        return (
          <section
            key={dayName}
            data-day-index={dayIndex}
            style={{
              borderRadius: RADIUS.control,
              border: `1px solid ${isOpen ? ACCENT.border : GLASS.border}`,
              background: GLASS.fill,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setOpenDay(isOpen ? -1 : dayIndex)}
              aria-expanded={isOpen}
              style={{
                width: "100%",
                minHeight: MOTION.minTouchTarget,
                display: "flex",
                alignItems: "center",
                gap: SPACE.sm,
                padding: `${SPACE.sm} ${SPACE.md}`,
                border: "none",
                background: "transparent",
                color: TEXT.primary,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: RADIUS.round,
                  background: isOpen ? ACCENT.base : GLASS.fillRaised,
                  color: isOpen ? TEXT.onAccent : TEXT.secondary,
                  fontSize: TYPE.caption.size,
                  fontWeight: TYPE.caption.weight,
                  flexShrink: 0,
                }}
              >
                {WEEKDAY_SHORT_ES[dayIndex]}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: TYPE.subhead.size,
                  fontWeight: TYPE.subhead.weight,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label.trim() !== "" ? label : dayName}
              </span>
              <span
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.tertiary,
                  flexShrink: 0,
                }}
              >
                {LABELS.exerciseCount(bucket.length)}
              </span>
              {isOpen ? (
                <ChevronUp size={16} strokeWidth={1.5} style={{ color: TEXT.tertiary }} />
              ) : (
                <ChevronDown size={16} strokeWidth={1.5} style={{ color: TEXT.tertiary }} />
              )}
            </button>

            {isOpen && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: SPACE.sm,
                  padding: `0 ${SPACE.md} ${SPACE.md}`,
                }}
              >
                <input
                  type="text"
                  value={label}
                  aria-label={`${LABELS.dayNameAria}: ${dayName}`}
                  placeholder={LABELS.dayNamePlaceholder}
                  onChange={(e) => onRenameDay(dayIndex, e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: MOTION.minTouchTarget,
                    padding: `0 ${SPACE.md}`,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${GLASS.border}`,
                    background: "transparent",
                    color: TEXT.primary,
                    fontFamily: "inherit",
                    fontSize: TYPE.subhead.size,
                  }}
                />

                {bucket.length === 0 && (
                  <p
                    style={{
                      fontSize: TYPE.caption.size,
                      color: TEXT.tertiary,
                      margin: 0,
                    }}
                  >
                    {LABELS.emptyDay}
                  </p>
                )}

                {bucket.map((entry, position) => (
                  <DayExerciseRow
                    key={entry.item.exercise.id}
                    item={entry.item}
                    isFirst={position === 0}
                    isLast={position === bucket.length - 1}
                    onUpdate={(changes) => onUpdateItem(entry.index, changes)}
                    onRemove={() => onRemoveItem(entry.index)}
                    onMove={(delta) => onMoveItem(entry.index, entry.index + delta)}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => onAddExercise(dayIndex)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: SPACE.xs,
                    minHeight: MOTION.minTouchTarget,
                    padding: `0 ${SPACE.md}`,
                    borderRadius: RADIUS.control,
                    border: `1px dashed ${ACCENT.border}`,
                    background: ACCENT.subtle,
                    color: ACCENT.text,
                    fontFamily: "inherit",
                    fontSize: TYPE.subhead.size,
                    fontWeight: TYPE.subhead.weight,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} strokeWidth={1.5} />
                  {LABELS.addExercise}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function DayExerciseRow({
  item,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMove,
}: {
  item: DraftExercise;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (changes: Partial<DraftExercise>) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.xs,
        padding: SPACE.sm,
        borderRadius: RADIUS.control,
        background: SURFACE.sunken,
        border: `1px solid ${GLASS.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
        <Dumbbell size={14} style={{ color: TEXT.secondary, flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: TYPE.body.size,
            color: TEXT.primary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {getExerciseName(item.exercise)}
        </span>
        <span
          style={{
            fontSize: TYPE.caption.size,
            color: TEXT.tertiary,
            fontFamily: TYPE.mono.font,
            flexShrink: 0,
          }}
        >
          {getRepLabel(item)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs, flexWrap: "wrap" }}>
        <Stepper
          label={LABELS.sets}
          value={item.target_sets}
          onChange={(v) => onUpdate({ target_sets: v })}
        />
        <Stepper
          label={LABELS.rest}
          value={item.rest_seconds}
          step={15}
          suffix="s"
          onChange={(v) => onUpdate({ rest_seconds: v })}
        />
        <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
          <IconButton
            label={LABELS.moveUp}
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={12} strokeWidth={1.5} />
          </IconButton>
          <IconButton
            label={LABELS.moveDown}
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={12} strokeWidth={1.5} />
          </IconButton>
          <IconButton label={LABELS.remove} onClick={onRemove}>
            <Trash2 size={12} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: RADIUS.chip,
        border: "none",
        background: "transparent",
        color: disabled ? TEXT.disabled : TEXT.secondary,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Stepper({
  label,
  value,
  onChange,
  step = 1,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        borderRadius: RADIUS.chip,
        border: `1px solid ${GLASS.border}`,
        background: GLASS.fill,
        padding: "2px 4px",
      }}
    >
      <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{label}</span>
      <button
        type="button"
        aria-label={`Reducir ${label}`}
        onClick={() => onChange(Math.max(step, value - step))}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          border: "none",
          background: "transparent",
          color: TEXT.secondary,
          cursor: "pointer",
          fontSize: TYPE.caption.size,
        }}
      >
        −
      </button>
      <span
        style={{
          minWidth: 28,
          textAlign: "center",
          fontSize: TYPE.caption.size,
          color: TEXT.primary,
          fontFamily: TYPE.mono.font,
        }}
      >
        {value}
        {suffix}
      </span>
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        onClick={() => onChange(value + step)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          border: "none",
          background: "transparent",
          color: TEXT.secondary,
          cursor: "pointer",
          fontSize: TYPE.caption.size,
        }}
      >
        +
      </button>
    </div>
  );
}
