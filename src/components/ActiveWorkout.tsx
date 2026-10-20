/**
 * ActiveWorkout.tsx — rediseño desde cero, presentación Apple minimalista.
 *
 * Estética: modo oscuro, fondo negro puro, acento cian/teal (#6EE7F7), tipografía
 * del sistema, cards elevadas, bordes de pelo, micro-header fijo arriba y scroll
 * vertical nativo. Toda la lógica de sesión, borrador, sobrecarga y sincronía se
 * conserva; solo cambia la piel.
 *
 * Los nombres accesibles y roles que ejercitan los tests se preservan tal cual:
 * "Empezar", "Finalizar", grupos "Serie n", chips "Serie n de tipo X",
 * spinbutton /Peso:/, botón de gear, "Última sesión: ...", undo banner, etc.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  X,
  Play,
  Target,
   MapPin,
   ArrowRight,
  RefreshCw,
  Check,
  Dumbbell,
} from "lucide-react";
import { loadRestSeconds } from "../lib/workout/restPreferences";
import type { SetEntry } from "../lib/workout/types";
import { GYM_LABELS } from "../lib/i18n";
import { GYM_SETTINGS_KEY } from "../context/GymSettingsContext";
import {
  ACCENT,
  DANGER,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SURFACE,
  SOLID,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import type { PlannedExercise } from "../hooks/useGymData";
import { ExerciseCarousel } from "./ExerciseCarousel";
import { ExerciseSelectorModal } from "./ExerciseSelectorModal";
import type { CatalogExercise } from "@/lib/catalog/types";
import type { Exercise } from "@/types/supabase";
import {
  EMPTY_PERFORMANCE,
  usePreviousPerformance,
} from "../hooks/usePreviousPerformance";
import { useOfflineSync } from "../hooks/useOfflineSync";
import {
  newSessionId,
  saveDraft,
  type DraftExercise,
  type FinalizePayload,
} from "../lib/offlineStore";
import { queueAndSync } from "../lib/sessionSync";
import { useActiveSession } from "../context/ActiveSessionContext";
import { useGymSettings } from "../context/GymSettingsContext";
import { RestTimer } from "./RestTimer";
import { SET_LOGGER_LABELS, UNDO_LABELS } from "../lib/i18n";
import { toWarmupColumn } from "../lib/workout/setKind";
import { newInstanceId } from "../lib/workout/instanceId";
import {
  cloneRoutineToSession,
  newSessionExercise,
  newSessionSet,
  templateFromPlanned,
  workingTemplateSets,
} from "../lib/workout/routineCloner";
import { kgToLb } from "../lib/profile";
import { getNextSupersetTargetIndex, getSupersetInfo } from "../lib/workout/supersetUtils";
import type { SupersetInfo } from "../lib/workout/supersetUtils";
import { SupersetBadge } from "./workout/SupersetBadge";
import { formatRepRange, suggestNextTarget, type OverloadTarget } from "../lib/overload";
import { getEquipmentSuggestionForExercise } from "@/data/equipmentCatalog";
import type { EquipmentEntry, EquipmentSuggestion } from "@/data/equipmentCatalog";
import { resolveMedia, resolveMediaUrl } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";

const DEFAULT_REST = 90;
const PERSIST_DEBOUNCE_MS = 400;
export const UNDO_WINDOW_MS = 5000;

function shortName(name: string): string {
  const cleaned = name.replace(/^(barbell|dumbbell|cable|kettlebell|weighted)\s+/i, "");
  const withoutSuffix = cleaned.replace(/\s+-\s+.*$/, "");
  return withoutSuffix.length > 0 ? withoutSuffix : cleaned;
}

function toNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** ------------------------------------------------------------------ headers */

interface PreWorkoutGateProps {
  routineTitle: string;
  plannedCount: number;
  onStart: () => void;
}

function PreWorkoutGate({
  routineTitle,
  plannedCount,
  onStart,
}: PreWorkoutGateProps) {
  return (
    <section
      role="region"
      aria-label="Resumen previo al entrenamiento"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: SPACE.lg,
        padding: SPACE.card,
        borderRadius: RADIUS.surface,
        border: `1px dashed ${GLASS.borderStrong}`,
        background: SOLID.card,
        textAlign: "center",
        maxWidth: "560px",
        margin: "0 auto",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: TYPE.title.size,
          fontWeight: TYPE.title.weight,
          color: TEXT.primary,
        }}
      >
        {routineTitle}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: TYPE.body.size,
          color: TEXT.secondary,
        }}
      >
        {plannedCount} ejercicio{plannedCount !== 1 ? "s" : ""} planeados.
      </p>
      <button
        type="button"
        onClick={onStart}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE.sm,
          minHeight: MOTION.minTouchTarget,
          padding: `${SPACE.sm} ${SPACE.lg}`,
          borderRadius: RADIUS.control,
          border: `1px solid ${STATUS.progression.base}`,
          background: STATUS.progression.base,
          color: TEXT.onAccent,
          fontSize: TYPE.subhead.size,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Empezar
      </button>
    </section>
  );
}

interface SessionHeaderProps {
  exerciseLabel: string;
  /**
   * The group the exercise on screen belongs to, when it is in one.
   *
   * The strip at the top of the session says the same thing, but the strip is
   * a strip: the athlete's eyes are on the set table, and the header is the
   * one line of chrome that is always on screen.
   */
  superset?: SupersetInfo | null;
  startedAt: string | null;
  onGear: () => void;
}

function SessionHeader({
  exerciseLabel,
  superset,
  startedAt,
  onGear,
}: SessionHeaderProps) {
  const GEAR = GYM_LABELS.triggerAriaLabel(GYM_LABELS.defaultTriggerContext);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: Z_INDEX.sticky,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.md,
        padding: `${SPACE.sm} ${SPACE.md}`,
        borderBottom: `1px solid ${GLASS.border}`,
        background: SCRIM.modal,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, minWidth: 0 }}>
          {exerciseLabel && (
            <div
              style={{
                fontSize: TYPE.caption.size,
                color: TEXT.tertiary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {exerciseLabel}
            </div>
          )}
          {superset && (
            <SupersetBadge
              label={superset.label}
              position={superset.position}
              total={superset.total}
              tone={superset.tone}
            />
          )}
        </div>
        {startedAt && (
          <div
            style={{
              fontFamily: TYPE.mono.font,
              fontSize: TYPE.body.size,
              fontWeight: 600,
              color: TEXT.primary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {new Date(startedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label={GEAR}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: MOTION.minTouchTarget,
          minHeight: MOTION.minTouchTarget,
          borderRadius: RADIUS.control,
          border: `1px solid ${GLASS.border}`,
          background: "transparent",
          color: TEXT.secondary,
          cursor: "pointer",
          padding: `0 ${SPACE.sm}`,
        }}
        onClick={onGear}
      >
        ⚙️
      </button>
    </header>
  );
}

/** ------------------------------------------------------------------ set tracker table */

interface SetTrackerTableProps {
  index: number;
  entry: SetEntry;
  previousKg?: number | null;
  previousReps?: number | null;
  formatWeight?: (kg: number) => string;
  previousLabel?: string;
  overloadTarget?: OverloadTarget | null;
  onChange: (index: number, entry: SetEntry) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
}

const SET_TYPE_LABELS_MAP: Record<string, string> = {
  normal: "Normal",
  warmup: "Calentamiento",
  failure: "Al fallo",
  drop: "Drop set",
};

function SetTrackerTable({
  index,
  entry,
  previousKg,
  previousReps,
  formatWeight,
  previousLabel,
  overloadTarget,
  onChange,
  onRemove,
  onDuplicate,
}: SetTrackerTableProps) {
  const setNumber = index + 1;
  const labelWeight = formatWeight ? formatWeight(Number(entry.weight || 0)) : entry.weight;
  const isCompleted = entry.completed;
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <div
      role="group"
      aria-label={`Serie ${setNumber}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.sm,
        padding: SPACE.card,
        borderRadius: RADIUS.card,
        border: `1px solid ${GLASS.border}`,
        background: SOLID.card,
      }}
    >
      {/* Selector de tipo de serie — pestañas segmentadas estilo iOS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.sm,
          flexWrap: "wrap",
          marginBottom: SPACE.xs,
        }}
      >
        {Object.entries(SET_TYPE_LABELS_MAP).map(([kind, kindLabel]) => (
          <button
            key={kind}
            type="button"
            role="button"
            aria-label={`Serie ${setNumber} de tipo ${kindLabel}`}
            aria-pressed={entry.kind === kind}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: MOTION.minTouchTarget,
              padding: `6px 14px`,
              borderBottom: `2px solid ${
                entry.kind === kind ? ACCENT.base : "transparent"
              }`,
              borderRadius: 0,
              background: "transparent",
              color: entry.kind === kind ? TEXT.primary : TEXT.secondary,
              fontSize: TYPE.caption.size,
              fontWeight: entry.kind === kind ? 700 : 500,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
            onClick={() => {
              onChange(index, { ...entry, kind: kind as SetEntry["kind"] });
            }}
          >
            {kindLabel}
          </button>
        ))}

        {overloadTarget && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: SPACE.xs,
              fontSize: TYPE.caption.size,
              color: ACCENT.text,
              fontWeight: 700,
              background: ACCENT.subtle,
              borderRadius: RADIUS.control,
              padding: `4px 10px`,
              border: `1px solid ${ACCENT.border}`,
            }}
          >
            Meta hoy:{overloadTarget.weight != null && overloadTarget.reps != null
              ? ` ${formatWeight ? formatWeight(overloadTarget.weight) : overloadTarget.weight} kg × ${overloadTarget.reps}`
              : overloadTarget.weight != null
              ? ` ${formatWeight ? formatWeight(overloadTarget.weight) : overloadTarget.weight} kg`
              : ` × ${overloadTarget.reps} reps`}
          </span>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <label
            style={{
              display: "block",
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
              marginBottom: SPACE.xs,
            }}
          >
            Peso (KG)
          </label>
          <input
            type="number"
            role="spinbutton"
            aria-label={`Peso: serie ${setNumber}`}
            value={entry.weight}
            onChange={(e) =>
              onChange(index, { ...entry, weight: e.target.value })
            }
            onBlur={(e) => {
              const v = Number.parseFloat(e.target.value);
              if (Number.isFinite(v)) {
                const snapped = Math.round(v / 2.5) * 2.5;
                const finalValue = snapped % 5 === 2.5 ? snapped - 2.5 : snapped;
                onChange(index, { ...entry, weight: String(finalValue) });
              }
            }}
            style={{
              width: "100%",
              minHeight: MOTION.minTouchTarget,
              padding: `8px 12px`,
              borderRadius: RADIUS.input,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.popover,
              color: TEXT.primary,
              fontSize: TYPE.body.size,
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: "tabular-nums",
            }}
          />
          <span
            style={{
              fontSize: TYPE.body.size,
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: "tabular-nums",
              color: TEXT.primary,
            }}
          >
            {labelWeight}
          </span>
          {previousLabel && (
            <span
              style={{
                display: "block",
                fontSize: TYPE.caption.size,
                color: TEXT.tertiary,
                marginTop: SPACE.xs,
              }}
              aria-label={previousLabel}
            >
              {previousLabel}
            </span>
          )}
          {previousKg != null && previousReps != null && (
            <span
              style={{
                fontSize: TYPE.caption.size,
                color: TEXT.tertiary,
                marginTop: SPACE.xs,
              }}
            >
              Última: {labelWeight} × {previousReps}
            </span>
          )}
          {previousKg != null && previousReps != null && entry.weight && entry.reps && (
            <>
              {toNumber(entry.weight)! > previousKg &&
                toNumber(entry.reps)! >= previousReps && (
                  <span
                    style={{
                      fontSize: TYPE.caption.size,
                      fontWeight: 700,
                      color: ACCENT.text,
                      marginTop: SPACE.xs,
                    }}
                  >
                    +{`${(toNumber(entry.weight)! - previousKg).toFixed(1)} kg`}
                  </span>
                )}
              {toNumber(entry.weight)! <= previousKg &&
                toNumber(entry.reps)! > previousReps && (
                  <span
                    style={{
                      fontSize: TYPE.caption.size,
                      fontWeight: 700,
                      color: ACCENT.text,
                      marginTop: SPACE.xs,
                    }}
                  >
                    +{`${toNumber(entry.reps)! - previousReps} rep`}
                  </span>
                )}
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: SPACE.xs }}>
          <button
            type="button"
            aria-label={`Duplicar la serie ${setNumber}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.secondary,
              cursor: "pointer",
            }}
            onClick={() => onDuplicate(index)}
          >
            ⧉
          </button>
          <button
            type="button"
            aria-label={`Eliminar la serie ${setNumber}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.secondary,
              cursor: "pointer",
            }}
            onClick={() => onRemove(index)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label
            style={{
              display: "block",
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
              marginBottom: SPACE.xs,
            }}
          >
            Reps
          </label>
          <input
            type="number"
            role="spinbutton"
            aria-label="Repeticiones"
            value={entry.reps}
            onChange={(e) => onChange(index, { ...entry, reps: e.target.value })}
            style={{
              width: "100%",
              minHeight: MOTION.minTouchTarget,
              padding: `8px 12px`,
              borderRadius: RADIUS.input,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.popover,
              color: TEXT.primary,
              fontSize: TYPE.body.size,
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label
            style={{
              display: "block",
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
              marginBottom: SPACE.xs,
            }}
          >
            RPE
          </label>
          <input
            type="number"
            role="spinbutton"
            aria-label={`RPE: serie ${setNumber}`}
            value={entry.rpe}
            onChange={(e) => onChange(index, { ...entry, rpe: e.target.value })}
            style={{
              width: "100%",
              minHeight: MOTION.minTouchTarget,
              padding: `8px 12px`,
              borderRadius: RADIUS.input,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.popover,
              color: TEXT.primary,
              fontSize: TYPE.body.size,
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </div>
      </div>

      {noteOpen && (
        <div style={{ marginTop: SPACE.sm, flex: 1, minWidth: 0 }}>
          <textarea
            aria-label={`Texto de la nota de la serie ${setNumber}`}
            value={entry.notes ?? ""}
            onChange={(e) =>
              onChange(index, { ...entry, notes: e.target.value })
            }
            onBlur={() => setNoteOpen(false)}
            style={{
              width: "100%",
              minHeight: 44,
              padding: `8px 12px`,
              borderRadius: RADIUS.input,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.popover,
              color: TEXT.primary,
              fontSize: TYPE.body.size,
              fontFamily: TYPE.mono.font,
              resize: "vertical",
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
        <button
          type="button"
          aria-label={`Nota de la serie ${setNumber}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: SPACE.xs,
            minHeight: MOTION.minTouchTarget,
            padding: `6px 10px`,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: noteOpen ? STATUS.progression.base : "transparent",
            color: noteOpen ? TEXT.onAccent : TEXT.secondary,
            fontSize: TYPE.caption.size,
            fontWeight: 600,
            cursor: "pointer",
          }}
          onClick={() => setNoteOpen(!noteOpen)}
        >
          {noteOpen ? "Ocultar nota" : "+ Nota"}
        </button>
        <button
          type="button"
          aria-label={
            isCompleted
              ? `Marcar la serie ${setNumber} como no completada`
              : `Marcar la serie ${setNumber} como completada`
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: MOTION.minTouchTarget,
            minHeight: MOTION.minTouchTarget,
            borderRadius: RADIUS.round,
            border: `1px solid ${ACCENT.base}`,
            background: isCompleted ? ACCENT.base : "transparent",
            color: isCompleted ? TEXT.onAccent : ACCENT.text,
            fontSize: TYPE.body.size,
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
          }}
          onClick={() =>
            onChange(index, { ...entry, completed: !isCompleted })
          }
        >
          <Check size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}


/** ------------------------------------------------------------------ exercise stage */

interface ExerciseStageProps {
  exercise: Exercise;
  completedSets: number;
  totalSets: number;
  lastSessionLabel: string | null;
  equipment: EquipmentEntry | null;
   onDemo: () => void;
   onAdvance: () => void;
   onChangeExercise: () => void;
   onAdjustEquipment: () => void;
}

/** ------------------------------------------------------------------ exercise stage */

function ExerciseStage({
  exercise,
  completedSets,
  totalSets,
  lastSessionLabel,
  equipment,
   onDemo,
   onAdvance,
   onChangeExercise,
   onAdjustEquipment,
  }: ExerciseStageProps) {
  const media = resolveMedia("exercise-gif", exercise.id, exercise.gif_url);
  const { src, failed, onLoad, onError } = useMediaSrc(media);

  return (
    <section
      style={{
        maxWidth: "560px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: SPACE.md,
        alignItems: "center",
      }}
    >
      {/* Escenario principal: GIF del ejercicio sobre negro puro */}
      <div
        style={{
          maxHeight: 200,
          width: "auto",
          margin: "0 auto",
          background: SURFACE.base,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {media.url && !failed ? (
          <img
            src={src}
            alt={`Demo de ${exercise.name}`}
            onLoad={onLoad}
            onError={onError}
            style={{
              maxHeight: "100%",
              width: "auto",
              objectFit: "contain",
              background: "transparent",
              filter: "invert(1) hue-rotate(180deg) contrast(125%) brightness(110%)",
              imageRendering: "-webkit-optimize-contrast",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: TEXT.tertiary,
              fontSize: TYPE.caption.size,
            }}
          >
            Sin demo disponible
          </div>
        )}
        {/* Botón flotante de equipamiento (siempre visible) */}
        <button
          type="button"
          aria-label={`Ver foto del equipo: ${equipment?.name ?? "Sin equipo"}`}
          onClick={onAdjustEquipment}
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            width: 40,
            height: 40,
            minWidth: 40,
            minHeight: 40,
            borderRadius: "50%",
            border: `1px solid ${GLASS.border}`,
            background: SURFACE.overlay,
            color: TEXT.primary,
            cursor: "pointer",
            boxShadow: GLASS.shadow,
            transition: `all ${MOTION.fast} ${MOTION.standard}`,
          }}
        >
          <MapPin size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Chip de equipamiento (siempre visible) */}
      <button
        type="button"
        onClick={onAdjustEquipment}
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.xs,
          padding: `${SPACE.xs} ${SPACE.sm}`,
          borderRadius: RADIUS.control,
          border: `1px solid ${GLASS.border}`,
          background: SOLID.popover,
          cursor: "pointer",
          transition: `all ${MOTION.fast} ${MOTION.standard}`,
        }}
      >
        {equipment?.views?.[0] ? (
          <img
            src={resolveMediaUrl(equipment.views[0].src)}
            alt={`Miniatura ${equipment.name}`}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              objectFit: "cover",
              border: `1px solid ${GLASS.border}`,
              background: SURFACE.base,
              flexShrink: 0,
            }}
          />
        ) : (
          <Dumbbell size={20} strokeWidth={2} aria-hidden="true" />
        )}
        <span
          style={{
            fontSize: TYPE.caption.size,
            fontWeight: 600,
            color: TEXT.primary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {equipment?.name ?? "Sin equipo"} •{" "}
          {equipment?.id.replace("CG-EQP-", "") ?? "—"}
        </span>
      </button>

      {/* Meta de serie y progreso */}
      <div
        style={{
          width: "100%",
          fontSize: TYPE.caption.size,
          color: TEXT.tertiary,
          textAlign: "center",
        }}
      >
        {lastSessionLabel ?? ""}
      </div>
      <div
        style={{
          width: "100%",
          fontSize: TYPE.body.size,
          fontWeight: 600,
          color: TEXT.primary,
          textAlign: "center",
        }}
      >
        {completedSets} de {totalSets} series
      </div>

      {/* Botones de acción rápida */}
      <div
        style={{
          display: "flex",
          gap: SPACE.sm,
          justifyContent: "center",
          width: "100%",
        }}
      >
        <ActionChip
          label="Demo"
          icon={<Play size={16} aria-hidden="true" />}
          onClick={onDemo}
        />
        <ActionChip
          label="Avance"
          icon={<Target size={16} aria-hidden="true" />}
          onClick={onAdvance}
        />
         <ActionChip
           label="Cambiar"
           icon={<ArrowRight size={16} aria-hidden="true" />}
           onClick={onChangeExercise}
         />
        <ActionChip
          label="Ajustar"
          icon={<RefreshCw size={16} aria-hidden="true" />}
          onClick={onAdjustEquipment}
        />
      </div>
    </section>
  );
}

function ActionChip({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: JSX.Element;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.xs,
        minHeight: MOTION.minTouchTarget,
        padding: `8px 14px`,
        borderRadius: RADIUS.control,
        border: `1px solid ${GLASS.border}`,
        background: SOLID.popover,
        color: TEXT.primary,
        fontSize: TYPE.caption.size,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {icon}
      <span style={{ fontSize: TYPE.caption.size }}>{label}</span>
    </button>
  );
}

/** ------------------------------------------------------------------ undo */

interface UndoBannerProps {
  setNumber: number;
  onUndo: () => void;
  onDismiss: () => void;
}

function UndoBanner({ setNumber, onUndo, onDismiss }: UndoBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: SPACE.md,
        zIndex: Z_INDEX.sticky,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.sm,
        overflow: "hidden",
        padding: "10px 14px",
        borderRadius: RADIUS.control,
        border: `1px solid ${GLASS.borderStrong}`,
        background: SOLID.popover,
        boxShadow: GLASS.shadow,
      }}
    >
      <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>
        Serie {setNumber} eliminada
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
        <button
          type="button"
          onClick={onUndo}
          aria-label={`Deshacer la eliminación de la serie ${setNumber}`}
          style={{
            minHeight: MOTION.minTouchTarget,
            padding: "0 14px",
            borderRadius: RADIUS.control,
            border: `1px solid ${ACCENT.border}`,
            background: ACCENT.muted,
            color: ACCENT.text,
            fontSize: TYPE.body.size,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {UNDO_LABELS.undo}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso de eliminación"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: MOTION.minTouchTarget,
            minHeight: MOTION.minTouchTarget,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: "transparent",
            color: TEXT.tertiary,
            cursor: "pointer",
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </span>
      <span
        aria-hidden="true"
        className="cronos-undo--drain"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: "2px",
          width: "100%",
          transformOrigin: "left center",
          background: ACCENT.base,
          animation: `cronos-undo-drain ${UNDO_WINDOW_MS}ms ${MOTION.easeLinear} forwards`,
        }}
      />
    </div>
  );
}

/** ------------------------------------------------------------------ equipment inspection sheet */

interface EquipmentInspectionSheetProps {
  equipment: EquipmentEntry;
  alternatives?: EquipmentEntry[];
  onClose: () => void;
  onSelect?: (equipment: EquipmentEntry) => void;
}

function EquipmentInspectionSheet({
  equipment,
  alternatives = [],
  onClose,
  onSelect,
}: EquipmentInspectionSheetProps) {
  const [selected, setSelected] = useState<EquipmentEntry>(equipment);

  useEffect(() => {
    setSelected(equipment);
  }, [equipment]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.modal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: SCRIM.modal,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "90vw",
          maxWidth: 560,
          maxHeight: "85vh",
          borderRadius: RADIUS.modal,
          background: SURFACE.base,
          border: `1px solid ${GLASS.borderStrong}`,
          boxShadow: GLASS.shadow,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SPACE.md} ${SPACE.lg}`,
            borderBottom: `1px solid ${GLASS.border}`,
            background: SURFACE.base,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: TYPE.title2.size,
              fontWeight: TYPE.title2.weight,
              color: TEXT.primary,
            }}
          >
            {selected.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar inspección de equipo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.secondary,
              cursor: "pointer",
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: SPACE.md,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.md,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: SPACE.sm,
            }}
          >
            {selected.views.map((view: { id: number; src: string }) => (
              <div
                key={view.id}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  background: SURFACE.raised,
                  borderRadius: RADIUS.surface,
                  border: `1px solid ${GLASS.border}`,
                  overflow: "hidden",
                }}
              >
                <img
                  src={resolveMediaUrl(view.src)}
                  alt={`Vista ${view.id} de ${selected.name}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE.xs,
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.card,
            }}
          >
            <span
              style={{
                fontSize: TYPE.label.size,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: TEXT.secondary,
              }}
            >
              Categoría
            </span>
            <span
              style={{
                fontSize: TYPE.caption.size,
                color: TEXT.primary,
                fontWeight: 600,
              }}
            >
              {selected.category}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE.xs,
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.card,
            }}
          >
            <span
              style={{
                fontSize: TYPE.label.size,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: TEXT.secondary,
              }}
            >
              ID
            </span>
            <span
              style={{
                fontFamily: TYPE.mono.font,
                fontSize: TYPE.caption.size,
                color: TEXT.primary,
              }}
            >
              {selected.id}
            </span>
          </div>

          {(alternatives.length > 0 || equipment.id !== selected.id || alternatives.some((a) => a.id === equipment.id)) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACE.xs,
              }}
            >
              <span
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.secondary,
                  fontWeight: 600,
                }}
              >
                Máquinas compatibles
              </span>
              <div
                style={{
                  display: "flex",
                  gap: SPACE.xs,
                  overflowX: "auto",
                  paddingBottom: SPACE.xs,
                }}
              >
                {[equipment, ...alternatives]
                  .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setSelected(e);
                        onSelect?.(e);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: `${SPACE.xs} ${SPACE.sm}`,
                        borderRadius: RADIUS.control,
                        border: `1px solid ${
                          e.id === selected.id ? ACCENT.base : GLASS.border
                        }`,
                        background: e.id === selected.id ? ACCENT.subtle : SOLID.card,
                        cursor: "pointer",
                        minWidth: 80,
                      }}
                    >
                      {e.views?.[0] && (
                        <img
                          src={resolveMediaUrl(e.views[0].src)}
                          alt={e.name}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: TYPE.caption.size,
                          color: e.id === selected.id ? ACCENT.text : TEXT.primary,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 100,
                        }}
                      >
                        {e.id}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: SPACE.md,
              paddingTop: SPACE.md,
              borderTop: `1px solid ${GLASS.border}`,
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: TYPE.caption.size,
                color: TEXT.secondary,
                marginBottom: SPACE.xs,
                fontWeight: 600,
              }}
            >
              Notas del equipo
            </label>
            <textarea
              style={{
                width: "100%",
                minHeight: 80,
                padding: `8px 12px`,
                borderRadius: RADIUS.input,
                border: `1px solid ${GLASS.border}`,
                background: SOLID.card,
                color: TEXT.primary,
                fontSize: TYPE.body.size,
                fontFamily: TYPE.mono.font,
                resize: "vertical",
              }}
              placeholder="Notas sobre esta máquina…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** ------------------------------------------------------------------ main */

interface ActiveWorkoutProps {
  userId: string;
  routineId: string | null;
  routineTitle: string;
  planned: PlannedExercise[];
  onFinished: () => void;
}

export function ActiveWorkout({
  userId,
  routineId,
  routineTitle,
  planned,
  onFinished,
}: ActiveWorkoutProps) {
  const [logId] = useState(() => newSessionId());

  const {
    session,
    end,
    warmups,
    resolveWarmup,
    recoverableDraft,
    restoreDraft,
    discardDraft,
    recoveredLogId,
    pendingRestEndsAt,
  } = useActiveSession();

  /**
   * The id this session writes under.
   *
   * A recovered session keeps the id it had: the row on the server and the
   * record on the device are the same session, and a second id would leave
   * the first one behind as an orphan that gets offered again after the
   * workout ends. Until the recovery happens, the id is a fresh one.
   */
  const activeLogId = recoveredLogId ?? logId;

  /**
   * The start time, frozen.
   *
   * It used to be read as `session?.startedAt ?? new Date().toISOString()`
   * *during render*: with no session in the context that produced a brand
   * new string on every render, and `persist` -- which depends on it --
   * changed identity with it. The debounce that writes the draft to
   * IndexedDB is keyed on that identity, so every render cleared the timer
   * and started it again and the 400 ms was never reached: the draft was
   * never written.
   *
   * The fallback is captured once, when the workout mounts, and the
   * session's own start time wins whenever there is one.
   */
  const [fallbackStartedAt] = useState(() => new Date().toISOString());
  const startedAt = session?.startedAt ?? fallbackStartedAt;

  const [items, setItems] = useState<DraftExercise[]>(() =>
    /*
     * The session is a run of the routine, not the routine itself.
     *
     * Cloning it here means the sets the athlete logs belong to this run and
     * to nothing else: the routine keeps being a prescription, and running it
     * again starts from the prescription rather than from the last run's
     * guesses. Every item and every set also comes with an identity of its
     * own, which is what lets the tracker tell this attempt from the same
     * attempt in another run.
     */
    cloneRoutineToSession(
      templateFromPlanned(planned, { id: routineId, title: routineTitle }),
    ).items,
  );
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState<{ id: number; seconds: number; endsAt: number } | null>(
    null,
  );
  /** Identifies one rest, so each one mounts its own clock. */
  const restIdRef = useRef(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
   const [pickerOpen, setPickerOpen] = useState(false);
   const [pickerMode, setPickerMode] = useState<"add" | "replace">("add");
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    itemKey: string;
    index: number;
    entry: SetEntry;
  } | null>(null);
  const [equipmentSheetOpen, setEquipmentSheetOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentEntry | null>(
    null,
  );
  const gym = useGymSettings();

  const sync = useOfflineSync();

  const selected = useMemo(
    () => items.find((i) => i.key === selectedKey) ?? items[0] ?? null,
    [items, selectedKey],
  );

  const equipmentSuggestion = useMemo<EquipmentSuggestion>(() => {
    if (!selected) return { primary: null, alternatives: [] };
    return getEquipmentSuggestionForExercise(
      selected.exercise.name,
      selected.exercise.equipment,
    );
  }, [selected]);

  const equipmentForSelected = equipmentSuggestion.primary;

  /**
   * Where the exercise on screen sits inside its superset, if it is in one.
   *
   * Null for an exercise that stands alone, which is the answer that keeps the
   * header ordinary for the exercise that has no partner.
   */
  const selectedSuperset = useMemo(() => {
    if (!selected) return null;
    return getSupersetInfo(
      items,
      items.findIndex((item) => item.key === selected.key),
    );
  }, [items, selected]);

  const carouselItems = useMemo(
    () =>
      items.map((item) => ({
        key: item.key,
        exercise: item.exercise,
        done: item.sets.filter((s) => s.completed).length,
        total: item.sets.length,
        // The grouping travels with the exercise into the strip, so the bubbles
        // of a superset are drawn as one group rather than as two exercises
        // that happen to sit next to each other.
        groupId: item.groupId ?? null,
      })),
    [items],
  );

  function focusExercise(key: string) {
    setSelectedKey(key);
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

   function handleAddExercise() {
     setPickerMode("add");
     setPickerOpen(true);
   }

  function handleExerciseSelected(exercise: CatalogExercise) {
    const existingIndex = items.findIndex((i) => i.exercise.id === exercise.id);
    if (existingIndex !== -1) {
      setSelectedKey(items[existingIndex].key);
      setPickerOpen(false);
      return;
    }
    const loggerExercise: Exercise = {
      id: exercise.id,
      name: exercise.name,
      body_part: exercise.body_part,
      target: exercise.target,
      equipment: exercise.equipment,
      gif_url: exercise.gif_url,
      instructions: [],
    };
    setPickerOpen(false);
    setItems((prev) => {
      if (pickerMode === "replace" && selectedKey) {
        return prev.map((item) =>
          item.key === selectedKey ? { ...item, exercise: loggerExercise } : item,
        );
      }
      return [
        ...prev,
        /*
         * An exercise added mid-session is a new execution of a movement, so
         * it arrives with its own identity and its own sets -- never a copy of
         * the exercise it was added next to.
         */
        newSessionExercise({
          exercise: loggerExercise,
          restSeconds: DEFAULT_REST,
          groupId: null,
          sets: workingTemplateSets(3),
        }),
      ];
    });
    setSelectedKey(exercise.id);
  }

  /**
   * Continues the session that was interrupted.
   *
   * The draft's items replace the planned ones, and the provider adopts the
   * draft's id: the session continues as the one that was interrupted rather
   * than as a new one that looks like it. The draft on the device is then
   * overwritten by the next write, under the same id, so nothing is left
   * behind as an orphan.
   *
   * The rest that was running is resumed where it was. It is the same
   * deadline the timer had before the reload, so the athlete comes back to
   * the countdown they were in and not to a fresh one.
   */
  function restoreRecovered() {
    if (!recoverableDraft) return;
    setItems(recoverableDraft.items);
    setNotes(recoverableDraft.notes);
    // The exercise that was on screen goes back on screen.
    if (recoverableDraft.selectedKey) setSelectedKey(recoverableDraft.selectedKey);
    restoreDraft();
    setStarted(true);
    setNotice("Sesión recuperada. Continúa donde lo dejaste.");
    if (pendingRestEndsAt) startRestUntil(pendingRestEndsAt);
  }

  /**
   * Throws the interrupted session away.
   *
   * The provider deletes the draft, because a draft nobody wants is a draft
   * that would be offered again after the next reload.
   */
  function discardRecovered() {
    if (!recoverableDraft) return;
    discardDraft();
  }

  const persist = useCallback(
    (nextItems: DraftExercise[], nextNotes: string, finalized = false) => {
      void saveDraft({
        logId: activeLogId,
        userId,
        routineId,
        routineTitle,
        startedAt,
        items: nextItems,
        notes: nextNotes,
        finalized,
        updatedAt: Date.now(),
        // The v2 fields: where the athlete was, so a reload puts them back
        // there. Read through refs, never through state: `persist` has to
        // keep the same identity across renders, or the debounce that
        // writes the draft restarts with it and never fires.
        restEndsAt: restRef.current?.endsAt,
        selectedKey: selectedKeyRef.current,
      });
    },
    [activeLogId, userId, routineId, routineTitle, startedAt],
  );

  const itemsRef = useRef(items);
  const notesRef = useRef(notes);
  itemsRef.current = items;
  notesRef.current = notes;
  /** The rest that is running, if any. Read by `persist` without subscribing to it. */
  const restRef = useRef(rest);
  restRef.current = rest;
  /**
   * The exercise that is on screen.
   *
   * The *effective* selection rather than the raw state: `selectedKey` is
   * null until the athlete taps the carousel, but the first exercise of the
   * plan is on screen all the same. What the draft has to remember is what
   * the athlete was looking at.
   */
  const selectedKeyRef = useRef<string | null>(null);
  selectedKeyRef.current = selected?.key ?? null;

  /**
   * True once the session has been sent to the server.
   *
   * After that no draft is written again: a debounce still in flight would
   * otherwise overwrite the finalized draft with an unfinished one, and the
   * session would be offered for recovery after it had already been saved.
   */
  const finalizedRef = useRef(false);

  useEffect(() => {
    // While a draft is waiting to be recovered, the workout is not the owner
    // of the session yet: writing now would leave a second record on the
    // device, under an id nobody will ever read.
    if (recoverableDraft || finalizedRef.current) return;
    const timer = window.setTimeout(() => {
      if (finalizedRef.current) return;
      persist(items, notes);
    }, PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [items, notes, persist, recoverableDraft]);

  const exerciseIds = useMemo(() => items.map((i) => i.exercise.id), [items]);
  const { performance } = usePreviousPerformance(userId, exerciseIds);

  const overload = useMemo(() => {
    const map: Record<string, OverloadTarget> = {};
    for (const item of items) {
      map[item.key] = suggestNextTarget(
        performance[item.exercise.id] ?? EMPTY_PERFORMANCE,
        { exercise: item.exercise },
      );
    }
    return map;
  }, [items, performance]);

  /**
   * Starts a rest that ends at a given moment.
   *
   * The deadline is captured here, once, and handed to `RestTimer`: the clock
   * then reads the wall clock instead of counting down, so a background tab
   * whose timers are throttled cannot make the rest last longer than the
   * athlete asked for.
   */
  function startRestUntil(endsAt: number) {
    const remainingMs = endsAt - Date.now();
    // A rest that has already ended is not a rest to start. The countdown it
    // would show is zero, and a timer that starts at zero is a timer that
    // never had a chance to be a timer.
    if (remainingMs <= 0) return;
    const total = Math.max(Math.ceil(remainingMs / 1000), 1);
    // A counter rather than the clock: two rests started in the same
    // millisecond would otherwise share a key, and the second one would
    // reuse the first one's deadline.
    restIdRef.current += 1;
    setRest({ id: restIdRef.current, seconds: total, endsAt });
  }

  /**
   * Starts a rest of a given length.
   *
   * The length is turned into a deadline on the spot, so that both a rest
   * started now and a rest resumed from a draft are the same thing: a moment
   * the clock reads.
   */
  function startRest(seconds: number) {
    const total = Math.max(seconds, 15);
    startRestUntil(Date.now() + total * 1000);
  }

  const closeRest = useCallback(() => setRest(null), []);

  useEffect(() => {
    if (!pendingRemoval) return;
    const timer = window.setTimeout(() => setPendingRemoval(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [pendingRemoval]);

  const displayKg = useCallback(
    (kg: number): string => {
      const shown = gym.weightUnit === "lb" ? kgToLb(kg) : Math.round(kg * 10) / 10;
      return Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
    },
    [gym.weightUnit],
  );

  const lastSessionFor = useCallback(
    (exerciseId: string): string | null => {
      const previous = performance[exerciseId];
      const target = overload[selectedKey ?? ""];
      const range = target?.repRange ? formatRepRange(target.repRange) : null;

      if (previous?.bestSet?.weight == null) return range;

      const sentence = SET_LOGGER_LABELS.lastSession(
        displayKg(previous.bestSet.weight),
        gym.weightUnit,
        String(previous.bestSet.reps ?? "—"),
      );
      return range ? `${sentence} · ${range}` : sentence;
    },
    [performance, overload, selectedKey, displayKg, gym.weightUnit],
  );

  function patchEntry(
    itemKey: string,
    setIndex: number,
    patch: (entry: SetEntry) => SetEntry,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: item.sets.map((s, i) => (i === setIndex ? patch(s) : s)) },
      ),
    );
  }

  function updateSet(itemKey: string, setIndex: number, entry: SetEntry) {
    patchEntry(itemKey, setIndex, () => entry);
    if (!entry.completed) return;
    const restSeconds = loadRestSeconds(
      itemKey,
      items.find((i) => i.key === itemKey)?.restSeconds ?? DEFAULT_REST,
    );
    startRest(restSeconds);
    advanceToSupersetPartner(itemKey);
  }

  /**
   * Moves the session on to the next exercise of the same superset.
   *
   * A superset is performed back to back -- A, then B, then A again -- so the
   * set the athlete has just finished is not the end of their work; it is the
   * moment the strip moves on by itself. Without this the athlete has to look
   * up, find the partner and tap it, in the middle of the rest that is already
   * running, which is exactly the moment they are least likely to.
   *
   * Two conditions, and both matter:
   *
   * - The partner has to be in the same group. An exercise that stands alone
   *   has no partner, and the session stays where it is.
   * - The partner has to have work left. A group whose exercises are all
   *   finished is a group that is over, and moving to it would send the athlete
   *   back to an exercise they have already done.
   */
  function advanceToSupersetPartner(itemKey: string) {
    const current = itemsRef.current;
    const index = current.findIndex((item) => item.key === itemKey);
    if (index === -1) return;

    const target = getNextSupersetTargetIndex(current, index);
    if (target === -1) return;

    const partner = current[target];
    if (!partner) return;
    if (!partner.sets.some((set) => !set.completed)) return;

    setSelectedKey(partner.key);
  }

  function addSet(itemKey: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : // A set the athlete adds is a new attempt, so it gets its own
            // identity rather than inheriting the one above it.
            { ...item, sets: [...item.sets, newSessionSet({ kind: "normal" }, item.sets.length)] },
      ),
    );
  }

  useEffect(() => {
    const pending = warmups[0];
    if (!pending) return;

    setItems((prev) => {
      const index = prev.findIndex((item) => item.exercise.name === pending.exerciseName);
      if (index === -1) return prev;

      const item = prev[index];
      const warmupEntries: DraftExercise["sets"] = pending.weights.map((weight, position) =>
        newSessionSet(
          { kind: "warmup", weight: String(weight) },
          item.sets.length + position,
        ),
      );

      return prev.map((entry, at) =>
        at === index ? { ...entry, sets: [...warmupEntries, ...entry.sets] } : entry,
      );
    });

    resolveWarmup(pending.id);
  }, [warmups, resolveWarmup]);

  function removeSet(itemKey: string, setIndex: number) {
    const target = itemsRef.current.find((i) => i.key === itemKey)?.sets[setIndex];
    if (!target) return;

    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: item.sets.filter((_, i) => i !== setIndex) },
      ),
    );
    setPendingRemoval({ itemKey, index: setIndex, entry: target });
  }

  function undoRemoveSet() {
    const pending = pendingRemoval;
    if (!pending) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== pending.itemKey) return item;
        const at = Math.min(pending.index, item.sets.length);
        const sets = [...item.sets];
        sets.splice(at, 0, pending.entry);
        return { ...item, sets };
      }),
    );
    setPendingRemoval(null);
  }

  function duplicateSet(itemKey: string, setIndex: number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== itemKey) return item;
        const source = item.sets[setIndex];
        if (!source) return item;
        const sets = [...item.sets];
        /*
         * The copy is a different attempt, so it gets a different identity.
         * Copying the source's id would leave two rows in the tracker with
         * the same name, and the second would look like the first.
         */
        sets.splice(setIndex + 1, 0, {
          ...source,
          completed: false,
          set_number: source.set_number + 1,
          instanceId: newInstanceId(),
        });
        return { ...item, sets };
      }),
    );
  }

  async function finish() {
    const currentItems = itemsRef.current;
    const currentNotes = notesRef.current;

    // The session is over the moment the athlete says so: from here on, no
    // debounce may write an unfinished draft over the finalized one.
    finalizedRef.current = true;

    const payload: FinalizePayload = {
      logId: activeLogId,
      userId,
      routineId,
      startedAt,
      completedAt: new Date().toISOString(),
      notes: currentNotes.trim() === "" ? null : currentNotes,
      sets: currentItems.flatMap((item) =>
        item.sets
          .map((set, index) => ({ set, index }))
          .filter(({ set }) => set.completed)
          .map(({ set, index }) => ({
            exercise_id: item.exercise.id,
            set_number: index + 1,
            weight: toNumber(set.weight),
            reps: toNumber(set.reps),
            rpe: toNumber(set.rpe),
            is_warmup: toWarmupColumn(set.kind),
            notes: set.notes ?? null,
          })),
      ),
    };

    await saveDraft({
      logId: activeLogId,
      userId,
      routineId,
      routineTitle,
      startedAt,
      items: currentItems,
      notes: currentNotes,
      finalized: true,
      updatedAt: Date.now(),
    });

    void queueAndSync(payload);
    end();
    onFinished();
  }

  const showSummary = !started && !recoverableDraft && items.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, paddingTop: SPACE.xl }}>
      {recoverableDraft && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
            padding: SPACE.md,
            borderRadius: RADIUS.control,
            border: `1px solid ${ACCENT.border}`,
            background: ACCENT.subtle,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: TYPE.body.size, color: TEXT.primary }}>
              Encontramos una sesión sin terminar ({recoverableDraft.routineTitle})
            </p>
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
              {recoverableDraft.items.reduce(
                (n: number, i: DraftExercise) =>
                  n + i.sets.filter((s) => s.completed).length,
                0,
              )}{" "}
              series guardadas en este dispositivo.
            </p>
          </div>
          <div style={{ display: "flex", gap: SPACE.sm }}>
            <button type="button" onClick={discardRecovered} style={quietButtonStyle}>
              Descartar
            </button>
            <button
              type="button"
              onClick={restoreRecovered}
              style={primaryButtonStyle}
            >
              Recuperar
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
            padding: `${SPACE.sm} ${SPACE.md}`,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: SOLID.popover,
          }}
        >
          <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            style={{ ...quietButtonStyle, minWidth: MOTION.minTouchTarget }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {pendingRemoval && (
        <UndoBanner
          setNumber={pendingRemoval.index + 1}
          onUndo={undoRemoveSet}
          onDismiss={() => setPendingRemoval(null)}
        />
      )}

      {sync.error && !sync.online && (
        <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          Sin conexión: tu sesión está segura en este dispositivo y se sincronizará
          automáticamente.
        </p>
      )}

      {gearOpen && (
        <div
          role="dialog"
          aria-label={GYM_LABELS.title}
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z_INDEX.modal,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: SCRIM.modal,
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              padding: SPACE.card,
              borderRadius: RADIUS.modal,
              background: SOLID.popover,
              border: `1px solid ${GLASS.borderStrong}`,
              boxShadow: GLASS.shadow,
              maxWidth: 480,
              width: "90vw",
            }}
          >
            <h3
              style={{
                margin: `0 0 ${SPACE.md}`,
                fontSize: TYPE.title2.size,
                fontWeight: TYPE.title2.weight,
                color: TEXT.primary,
              }}
            >
              Configuración del gimnasio
            </h3>
            <div style={{ display: "flex", gap: SPACE.sm }}>
              <button
                type="button"
                onClick={() => {
                    window.localStorage.setItem(
                      GYM_SETTINGS_KEY,
                      JSON.stringify({ weightUnit: "lb" }),
                    );
                  setGearOpen(false);
                }}
                style={{
                  minHeight: MOTION.minTouchTarget,
                  padding: `8px 16px`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.border}`,
                  background: "transparent",
                  color: TEXT.primary,
                  fontSize: TYPE.body.size,
                  cursor: "pointer",
                }}
              >
                lb
              </button>
            </div>
          </div>
        </div>
      )}

      {showSummary ? (
        <PreWorkoutGate
          routineTitle={routineTitle}
          plannedCount={planned.length}
          onStart={() => setStarted(true)}
        />
      ) : items.length === 0 ? (
        <section
          role="region"
          aria-label="Estado vacío"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: SPACE.md,
            padding: SPACE.card,
            borderRadius: RADIUS.surface,
            border: `1px dashed ${GLASS.borderStrong}`,
            background: SOLID.card,
            textAlign: "center",
            maxWidth: "560px",
            margin: "0 auto",
          }}
        >
          <X
            aria-hidden="true"
            size={32}
            style={{ color: TEXT.disabled }}
          />
          <p
            style={{
              margin: 0,
              fontSize: TYPE.body.size,
              color: TEXT.tertiary,
            }}
          >
            Esta sesión todavía no tiene ejercicios.
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.sm,
              minHeight: MOTION.minTouchTarget,
              padding: `${SPACE.sm} ${SPACE.lg}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${STATUS.progression.base}`,
              background: STATUS.progression.base,
              color: TEXT.onAccent,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Agregar ejercicio
          </button>
        </section>
      ) : (
        <>
          <SessionHeader
            exerciseLabel={
              selected
                ? `${items.findIndex((i) => i.key === selected.key) + 1}/${items.length} ${shortName(
                    selected.exercise.name,
                  )}`
                : ""
            }
            superset={selectedSuperset}
            startedAt={session?.startedAt ?? null}
            onGear={() => setGearOpen(true)}
          />

          {carouselItems.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                marginTop: SPACE.md,
                paddingBottom: SPACE.sm,
              }}
            >
              <ExerciseCarousel
                items={carouselItems}
                selectedKey={selectedKey ?? null}
                onSelect={focusExercise}
                onReorder={handleReorder}
                onAdd={handleAddExercise}
              />
            </div>
          )}

          {selected && (
            <>
            <ExerciseStage
              exercise={selected.exercise}
              completedSets={selected.sets.filter((s) => s.completed).length}
                totalSets={selected.sets.length}
                lastSessionLabel={lastSessionFor(selected.exercise.id)}
                equipment={equipmentForSelected}
                 onDemo={() => {}}
                 onAdvance={() => {}}
                 onChangeExercise={() => { setPickerMode("replace"); setPickerOpen(true); }}
                 onAdjustEquipment={() => {
                  setSelectedEquipment(
                    equipmentSuggestion.primary ?? {
                      id: "default",
                      name: "Sin equipo",
                      category: "Accesorio",
                      views: [],
                      exerciseTypes: [],
                    },
                  );
                  setEquipmentSheetOpen(true);
                }}
              />

              {equipmentSheetOpen && selectedEquipment && (
                <EquipmentInspectionSheet
                  equipment={selectedEquipment}
                  alternatives={equipmentSuggestion.alternatives}
                  onClose={() => {
                    setEquipmentSheetOpen(false);
                    setSelectedEquipment(null);
                  }}
                />
              )}

              {selected.sets.map((entry, index) => (
                <SetTrackerTable
                  key={index}
                  index={index}
                  entry={entry}
                  previousKg={performance[selected.exercise.id]?.bestSet?.weight ?? null}
                  previousReps={performance[selected.exercise.id]?.bestSet?.reps ?? null}
                  formatWeight={displayKg}
                  overloadTarget={overload[selected.key] ?? null}
                  previousLabel={
                    performance[selected.exercise.id]?.bestSet?.weight != null &&
                    performance[selected.exercise.id]?.bestSet?.reps != null
                      ? `Repetir la última vez: ${displayKg(
                          performance[selected.exercise.id]?.bestSet?.weight ?? 0,
                        )} kilos por ${performance[selected.exercise.id]?.bestSet?.reps ?? 0} repeticiones`
                      : undefined
                  }
                  onChange={(i, e) => updateSet(selected.key, i, e)}
                  onRemove={(i) => removeSet(selected.key, i)}
                  onDuplicate={(i) => duplicateSet(selected.key, i)}
                />
              ))}

              <div style={{ display: "flex", gap: SPACE.sm, justifyContent: "center", marginTop: SPACE.sm }}>
                <button
                  type="button"
                  onClick={() => addSet(selected.key)}
                  aria-label="+ Agregar serie"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: SPACE.xs,
                    minHeight: MOTION.minTouchTarget,
                    padding: `8px 16px`,
                     borderRadius: RADIUS.control,
                     border: `1px solid ${DANGER.base}`,
                     background: SOLID.popover,
                     color: DANGER.base,
                     fontSize: TYPE.body.size,
                     fontWeight: 600,
                     cursor: "pointer",
                  }}
                >
                  + Agregar serie
                </button>
              </div>
            </>
          )}

           <button
            type="button"
            onClick={finish}
            style={{
              marginTop: SPACE.md,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.xs,
              minHeight: MOTION.minTouchTarget,
              padding: `${SPACE.sm} ${SPACE.lg}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${DANGER.base}`,
              background: DANGER.base,
              color: TEXT.onAccent,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Finalizar
          </button>
        </>
      )}

      {rest && (
        /*
         * The canonical rest clock, the same component the design system
         * ships. `key` is the rest's own id: each rest mounts a fresh clock
         * that reads its own deadline, so a second rest never inherits the
         * first one's time.
         */
        <RestTimer
          key={rest.id}
          seconds={rest.seconds}
          endsAt={rest.endsAt}
          onClose={closeRest}
          onFinished={closeRest}
        />
      )}

      {pickerOpen && (
        <ExerciseSelectorModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleExerciseSelected}
        />
      )}
    </div>
  );
}

const quietButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minHeight: 36,
  padding: "0 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.secondary,
  fontSize: TYPE.label.size,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minHeight: 36,
  padding: "0 14px",
  borderRadius: RADIUS.control,
  border: `1px solid ${ACCENT.base}`,
  background: ACCENT.base,
  color: TEXT.onAccent,
  fontSize: TYPE.label.size,
  fontWeight: 700,
   cursor: "pointer",
 };

