/**
 * ActiveWorkout.tsx — Rediseño Apple HIG / Apple Fitness+ para la pantalla de entrenamiento activo.
 *
 * Principios:
 *   - Fondo OLED puro (#000000) para que los GIFs se integren sin bordes.
 *   - Header telemetría: sticky, blur, timer con indicador verde pulsante (#30D158), botón "Terminar" iOS-style.
 *   - Carrusel de ejercicios: indicadores circulares pulidos, anillo Crimson (#FF3B30) en activo.
 *   - Área de identidad del ejercicio: GIF grande sobre negro, títulos limpios (regex strip IDs), jerarquía editorial Apple.
 *   - Toolbar unificada: grid único "Demo | Avance | Cambiar | Ajustar" en contenedor GlassCard.
 *   - Tabla de series Apple HIG: columnas SERIE | ANTERIOR | KG/LB | REPS | RPE | ✓ con styling Graphite L1/L2.
 *   - Padding inferior (pb-36) para evitar solapamiento con BottomNav y botón flotante Cronos IA.
 *
 * Se preserva toda la lógica de negocio: borrador, sincronía, supersets, recuperación, timer deadline-based.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Play,
  Target,
  MapPin,
  ArrowRight,
  RefreshCw,
  Check,
  Dumbbell,
  Settings,
} from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { loadRestSeconds } from "../lib/workout/restPreferences";
import type { SetEntry } from "../lib/workout/types";
import { GYM_LABELS } from "../lib/i18n";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  SOLID,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import type { PlannedExercise } from "../hooks/useGymData";
import { ExerciseCarousel } from "./ExerciseCarousel";
import { UnifiedExerciseSelectorSheet } from "./UnifiedExerciseSelectorSheet";
import { DemoSheet } from "./workout/DemoSheet";
import { AvanceSheet } from "./workout/AvanceSheet";
import { AjustarSheet } from "./workout/AjustarSheet";
import { CambiarSheet } from "./workout/CambiarSheet";
import type { Exercise } from "@/types/supabase";
import {
  EMPTY_PERFORMANCE,
  usePreviousPerformance,
} from "../hooks/usePreviousPerformance";
import { useOfflineSync } from "../hooks/useOfflineSync";
import {
  newSessionId,
  saveDraft,
  deleteDraft,
  type DraftExercise,
  type FinalizePayload,
} from "../lib/offlineStore";
import { queueAndSync } from "../lib/sessionSync";
import { useActiveSession } from "../context/ActiveSessionContext";
import { useGymSettings } from "../context/GymSettingsContext";
import { useElapsedMs } from "../hooks/useElapsedMs";
import { RestTimer } from "./RestTimer";
import { UNDO_LABELS } from "../lib/i18n";
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
import { WorkoutPreStartView } from "./workout/WorkoutPreStartView";
import { suggestNextTarget, type OverloadTarget } from "../lib/overload";
import { getEquipmentSuggestionForExercise } from "@/data/equipmentCatalog";
import { findExerciseReplacements } from "@/lib/engines/exerciseReplacementEngine";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import type { EquipmentEntry, EquipmentSuggestion } from "@/data/equipmentCatalog";
import { resolveMedia, resolveMediaUrl } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

const DEFAULT_REST = 90;
const PERSIST_DEBOUNCE_MS = 400;
export const UNDO_WINDOW_MS = 5000;

/** Strips catalog ID suffixes like " • 0028", " - 0123", "· 0045" from exercise names. */
function cleanExerciseName(name: string): string {
  return name.replace(/\s*[•·-]\s*\d{3,5}$/, "");
}

function toNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** ------------------------------------------------------------------ Session Header (Fitness+ Telemetry) */

interface SessionHeaderProps {
  exerciseLabel: string;
  superset?: SupersetInfo | null;
  startedAt: string | null;
  onGear: () => void;
  onTerminate?: () => void;
}

function SessionHeader({
  exerciseLabel,
  superset,
  startedAt,
  onGear,
  onTerminate,
}: SessionHeaderProps) {
  const GEAR = GYM_LABELS.triggerAriaLabel(GYM_LABELS.defaultTriggerContext);
  useElapsedMs(startedAt);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.md,
        padding: `calc(10px + env(safe-area-inset-top, 0px)) 16px 10px 16px`,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Left: Live Timer Capsule + Progress Text */}
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, minWidth: 0 }}>
        {startedAt && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 9999,
              background: "rgba(48, 209, 88, 0.15)",
              border: "1px solid rgba(48, 209, 88, 0.3)",
            }}
          >
            <span
              className="cronos-pulse-green"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#30D158",
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: TYPE.mono.font,
                fontSize: TYPE.caption.size,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: "#30D158",
                whiteSpace: "nowrap",
              }}
            >
              EN VIVO
            </span>
          </div>
        )}
        {exerciseLabel && (
          <div
            style={{
              fontSize: TYPE.caption.size,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: TEXT.secondary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 200,
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

      {/* Right: Settings + Terminar Button */}
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
        <button
          type="button"
          aria-label={GEAR}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: RADIUS.round,
            border: `1px solid ${GLASS.border}`,
            background: "rgba(255, 255, 255, 0.05)",
            color: TEXT.secondary,
            cursor: "pointer",
          }}
          onClick={onGear}
        >
          <Settings size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        {onTerminate && (
          <GlassButton
            variant="ghost"
            onClick={onTerminate}
            aria-label="Terminar entrenamiento"
            style={{
              height: 40,
              minWidth: 40,
              padding: "0 14px",
              borderRadius: 9999,
              background: "rgba(255, 59, 48, 0.12)",
              color: ACCENT.text,
              border: `1px solid ${ACCENT.border}`,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
            }}
          >
            Terminar
          </GlassButton>
        )}
      </div>
    </header>
  );
}

/** ------------------------------------------------------------------ Set Tracker Table (Apple HIG) */

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

const SET_TYPE_OPTIONS: Array<{ kind: SetEntry["kind"]; label: string; fullLabel: string; color: string; bg: string }> = [
  { kind: "normal", label: "1", fullLabel: "Normal / Efectiva", color: TEXT.primary, bg: "rgba(255, 255, 255, 0.08)" },
  { kind: "warmup", label: "C", fullLabel: "Calentamiento", color: "#FBBF24", bg: "rgba(251, 191, 36, 0.2)" },
  { kind: "normal", label: "A", fullLabel: "Aproximación", color: "#60A5FA", bg: "rgba(96, 165, 250, 0.2)" },
  { kind: "failure", label: "F", fullLabel: "Al Fallo", color: "#F87171", bg: "rgba(239, 68, 68, 0.25)" },
  { kind: "drop", label: "D", fullLabel: "Drop Set", color: "#A855F7", bg: "rgba(168, 85, 247, 0.25)" },
  { kind: "normal", label: "RP", fullLabel: "Rest-Pause", color: "#FB923C", bg: "rgba(251, 146, 60, 0.25)" },
];

function SetTrackerTable({
  index,
  entry,
  previousKg,
  previousReps,
  formatWeight,
  onChange,
}: SetTrackerTableProps) {
  const setNumber = index + 1;
  const [menuOpen, setMenuOpen] = useState(false);

  const currentOption = useMemo(() => {
    if (entry.kind === "warmup") return SET_TYPE_OPTIONS[1];
    if (entry.kind === "failure") return SET_TYPE_OPTIONS[3];
    if (entry.kind === "drop") return SET_TYPE_OPTIONS[4];
    return SET_TYPE_OPTIONS[0];
  }, [entry.kind]);

  const previousText = previousKg != null && previousReps != null
    ? formatWeight
      ? `${formatWeight(previousKg)} × ${previousReps}`
      : `${previousKg}kg × ${previousReps}`
    : "—";

  const isCompleted = entry.completed;

  return (
    <div
      role="group"
      aria-label={`Serie ${setNumber}`}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 54px 1fr 1fr 44px 34px",
        alignItems: "center",
        gap: 1.5,
        padding: "6px 0",
        borderBottom: index > 0 ? "1px solid rgba(255, 255, 255, 0.04)" : "none",
        background: isCompleted ? "rgba(48, 209, 88, 0.06)" : "transparent",
        borderRadius: index === 0 ? "12px 12px 0 0" : index === 2 ? "0 0 12px 12px" : 0,
        transition: "background 200ms ease",
      }}
    >
      {/* Serie Badge */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={`Serie ${setNumber} tipo`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 9999,
            background: currentOption.bg,
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: currentOption.color,
            fontSize: currentOption.label === "RP" ? "9px" : "11px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            transition: "transform 150ms ease, box-shadow 150ms ease",
          }}
        >
          {currentOption.label === "1" ? setNumber : currentOption.label}
        </button>

        {menuOpen && (
          <>
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
              }}
              onClick={() => setMenuOpen(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "40px",
                left: 0,
                zIndex: 51,
                background: "rgba(22, 22, 26, 0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 16,
                padding: "8px",
                minWidth: "200px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.9)",
              }}
            >
              {SET_TYPE_OPTIONS.map((option, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(index, { ...entry, kind: option.kind });
                    setMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 12,
                    color: TEXT.primary,
                    fontSize: "14px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: option.bg,
                      color: option.color,
                      fontSize: option.label === "RP" ? "8px" : "10px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {option.label === "1" ? setNumber : option.label}
                  </div>
                  <span>{option.fullLabel}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Anterior */}
      <div
        style={{
          minWidth: 0,
          fontSize: "11px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          color: TEXT.tertiary,
          whiteSpace: "nowrap",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {previousText}
      </div>

      {/* KG/LB */}
      <input
        type="number"
        inputMode="decimal"
        aria-label={`Peso serie ${setNumber}`}
        value={entry.weight}
        onChange={(e) => onChange(index, { ...entry, weight: e.target.value })}
        onFocus={(e) => { e.target.select(); }}
        className="cronos-set-input"
        style={{
          width: "100%",
          background: "#2C2C2E",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 10,
          padding: "6px 8px",
          textAlign: "center",
          color: TEXT.primary,
          fontSize: "13px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          outline: "none",
        }}
      />

      {/* REPS */}
      <input
        type="number"
        inputMode="numeric"
        aria-label={`Repeticiones serie ${setNumber}`}
        value={entry.reps}
        onChange={(e) => onChange(index, { ...entry, reps: e.target.value })}
        onFocus={(e) => { e.target.select(); }}
        className="cronos-set-input"
        style={{
          width: "100%",
          background: "#2C2C2E",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 10,
          padding: "6px 8px",
          textAlign: "center",
          color: TEXT.primary,
          fontSize: "13px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          outline: "none",
        }}
      />

      {/* RPE */}
      <input
        type="number"
        inputMode="numeric"
        aria-label={`RPE serie ${setNumber}`}
        placeholder="RPE"
        value={entry.rpe || ""}
        onChange={(e) => onChange(index, { ...entry, rpe: e.target.value })}
        onFocus={(e) => { e.target.select(); }}
        className="cronos-set-input"
        style={{
          width: "100%",
          background: "#2C2C2E",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 10,
          padding: "6px 8px",
          textAlign: "center",
          color: TEXT.primary,
          fontSize: "13px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          outline: "none",
        }}
      />

      {/* Check Button */}
      <button
        type="button"
        aria-label={isCompleted ? `Marcar la serie ${setNumber} como no completada` : `Marcar la serie ${setNumber} como completada`}
        onClick={() => {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate(isCompleted ? [15] : [40, 60, 80]);
          }
          onChange(index, { ...entry, completed: !entry.completed });
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 9999,
          background: isCompleted ? "#30D158" : "rgba(255, 255, 255, 0.08)",
          color: isCompleted ? "#000" : "rgba(255, 255, 255, 0.4)",
          border: isCompleted ? "1px solid #30D158" : "1px solid rgba(255, 255, 255, 0.1)",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 150ms ease",
          boxShadow: isCompleted ? "0 0 0 4px rgba(48, 209, 88, 0.3), 0 4px 12px rgba(48, 209, 88, 0.4)" : "none",
        }}
      >
        <Check size={18} strokeWidth={3} />
      </button>
    </div>
  );
}

/** ------------------------------------------------------------------ Exercise Stage (Identity Area) */

interface ExerciseStageProps {
  exercise: Exercise;
  completedSets: number;
  totalSets: number;
  lastSessionShort: string | null;
  equipment: EquipmentEntry | null;
  onDemo?: () => void;
  onAdvance?: () => void;
  onChangeExercise: () => void;
  onAdjustEquipment: () => void;
}

function ExerciseStage({
  exercise,
  completedSets,
  totalSets,
  lastSessionShort,
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
      {/* Main GIF on Pure Black */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: 360,
          margin: "0 auto",
          height: 120,
          borderRadius: 16,
          overflow: "hidden",
          background: SURFACE.base,
        }}
      >
        {media.url && !failed ? (
          <img
            src={src}
            alt={`Demo de ${cleanExerciseName(getExerciseDisplayName(exercise))}`}
            onLoad={onLoad}
            onError={onError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              background: "transparent",
              filter: "invert(1) hue-rotate(180deg) contrast(125%) brightness(110%)",
              imageRendering: "-webkit-optimize-contrast",
            }}
            width={640}
            height={360}
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
              padding: SPACE.md,
              textAlign: "center",
            }}
          >
            <Dumbbell size={32} strokeWidth={1.5} aria-hidden="true" style={{ marginBottom: 8 }} />
            Sin demo disponible
          </div>
        )}
        {/* Floating Equipment Button */}
        <button
          type="button"
          aria-label={`Ver foto del equipo: ${equipment?.name ?? "Sin equipo"}`}
          onClick={onAdjustEquipment}
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${GLASS.border}`,
            background: "rgba(22, 22, 26, 0.9)",
            backdropFilter: "blur(12px)",
            color: TEXT.primary,
            cursor: "pointer",
            boxShadow: GLASS.shadow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MapPin size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Exercise Identity: Clean Title + Subtle Progress Pill (single compact row) */}
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: TYPE.headline.size,
                lineHeight: TYPE.headline.lineHeight,
                fontWeight: TYPE.headline.weight,
                color: TEXT.primary,
                letterSpacing: "0",
              }}
            >
              {cleanExerciseName(getExerciseDisplayName(exercise))}
            </h2>
            {lastSessionShort && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "11px",
                  fontFamily: TYPE.mono.font,
                  fontVariantNumeric: "tabular-nums",
                  color: TEXT.tertiary,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {lastSessionShort}
              </p>
            )}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 9999,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <span
              style={{
                fontFamily: TYPE.mono.font,
                fontSize: TYPE.caption.size,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: TEXT.secondary,
              }}
            >
              {completedSets} / {totalSets}
            </span>
            <div
              style={{
                width: 60,
                height: 4,
                borderRadius: 9999,
                background: "rgba(255, 255, 255, 0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`,
                  height: "100%",
                  background: ACCENT.base,
                  borderRadius: 9999,
                  transition: "width 300ms ease-out",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Toolbar: Demo | Avance | Cambiar | Ajustar */}
      <GlassCard
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "4px 6px",
          margin: "6px 0",
          borderRadius: 16,
          background: "rgba(28, 28, 30, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "none",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5 }}>
          <ToolbarButton label="Demo" icon={<Play size={12} strokeWidth={2} aria-hidden="true" />} onClick={onDemo ?? (() => {})} />
          <ToolbarButton label="Avance" icon={<Target size={12} strokeWidth={2} aria-hidden="true" />} onClick={onAdvance ?? (() => {})} />
          <ToolbarButton label="Cambiar" icon={<ArrowRight size={12} strokeWidth={2} aria-hidden="true" />} onClick={onChangeExercise} />
          <ToolbarButton label="Ajustar" icon={<RefreshCw size={12} strokeWidth={2} aria-hidden="true" />} onClick={onAdjustEquipment} />
        </div>
      </GlassCard>
    </section>
  );
}

function ToolbarButton({
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
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        padding: "4px 6px",
        borderRadius: RADIUS.control,
        border: `1px solid ${GLASS.border}`,
        background: "#1C1C1E",
        color: TEXT.secondary,
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0",
        textTransform: "none",
        cursor: "pointer",
        height: 32,
        minHeight: 32,
        transition: "background 150ms ease, color 150ms ease",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
        e.currentTarget.style.color = TEXT.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#1C1C1E";
        e.currentTarget.style.color = TEXT.secondary;
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** ------------------------------------------------------------------ Undo Banner */

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
        padding: "12px 16px",
        borderRadius: 14,
        border: `1px solid ${GLASS.borderStrong}`,
        background: "rgba(22, 22, 26, 0.95)",
        backdropFilter: "blur(20px)",
        boxShadow: GLASS.shadow,
      }}
    >
      <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>
        Serie {setNumber} eliminada
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
        <GlassButton
          variant="secondary"
          onClick={onUndo}
          aria-label={`Deshacer la eliminación de la serie ${setNumber}`}
          style={{
            minHeight: 36,
            padding: "0 14px",
            borderRadius: 9999,
            fontSize: TYPE.body.size,
            fontWeight: 600,
          }}
        >
          {UNDO_LABELS.undo}
        </GlassButton>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso de eliminación"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1px solid ${GLASS.border}`,
            background: "transparent",
            color: TEXT.tertiary,
            cursor: "pointer",
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <span
        aria-hidden="true"
        className="cronos-undo--drain"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 2,
          width: "100%",
          transformOrigin: "left center",
          background: ACCENT.base,
          animation: `cronos-undo-drain ${UNDO_WINDOW_MS}ms linear forwards`,
        }}
      />
    </div>
  );
}

/** ------------------------------------------------------------------ Equipment Inspection Sheet */

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
              width: 44,
              height: 44,
              borderRadius: "50%",
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
                        border: `1px solid ${e.id === selected.id ? ACCENT.base : GLASS.border}`,
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** ------------------------------------------------------------------ Main ActiveWorkout Component */

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
  const { exercises: catalogExercises } = useExerciseCatalog() as any;
  const catalog = useMemo(() => catalogExercises || [], [catalogExercises]);
  const availableEquipmentList = useMemo(
    () => ["mancuernas", "polea", "barra", "maquina", "bandas", "cable"],
    [],
  );

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

  const activeLogId = recoveredLogId ?? logId;

  const [fallbackStartedAt] = useState(() => new Date().toISOString());
  const startedAt = session?.startedAt ?? fallbackStartedAt;

  const [items, setItems] = useState<DraftExercise[]>(() =>
    cloneRoutineToSession(
      templateFromPlanned(planned, { id: routineId, title: routineTitle }),
    ).items,
  );
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState<{ id: number; seconds: number; endsAt: number } | null>(
    null,
  );
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
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isAvanceOpen, setIsAvanceOpen] = useState(false);
  const [isCambiarOpen, setIsCambiarOpen] = useState(false);
  const [isAjustarOpen, setIsAjustarOpen] = useState(false);
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

  function handleExerciseSelected(exercise: Exercise) {
    const existingIndex = items.findIndex((i) => i.exercise.id === exercise.id);
    if (existingIndex !== -1) {
      setSelectedKey(items[existingIndex].key);
      setPickerOpen(false);
      return;
    }
    const loggerExercise: Exercise = {
      id: exercise.id,
      name: exercise.name,
      name_es: exercise.name_es,
      body_part: exercise.body_part,
      target: exercise.target,
      equipment: exercise.equipment,
      gif_url: exercise.gif_url,
      instructions: [],
      is_active: exercise.is_active,
      is_hidden: exercise.is_hidden,
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

  function restoreRecovered() {
    if (!recoverableDraft) return;
    setItems(recoverableDraft.items);
    setNotes(recoverableDraft.notes);
    if (recoverableDraft.selectedKey) setSelectedKey(recoverableDraft.selectedKey);
    restoreDraft();
    setStarted(true);
    setNotice("Sesión recuperada. Continúa donde lo dejaste.");
    if (pendingRestEndsAt) startRestUntil(pendingRestEndsAt);
  }

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
        restEndsAt: restRef.current?.endsAt,
        selectedKey: selectedKeyRef.current,
        routineDayId: session?.routineDayId ?? null,
        dayLabel: session?.dayLabel ?? null,
      });
    },
    [activeLogId, userId, routineId, routineTitle, startedAt, session],
  );

  const itemsRef = useRef(items);
  const notesRef = useRef(notes);
  itemsRef.current = items;
  notesRef.current = notes;
  const restRef = useRef(rest);
  restRef.current = rest;
  const selectedKeyRef = useRef<string | null>(null);
  selectedKeyRef.current = selected?.key ?? null;
  const finalizedRef = useRef(false);

  useEffect(() => {
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

  function startRestUntil(endsAt: number) {
    const remainingMs = endsAt - Date.now();
    if (remainingMs <= 0) return;
    const total = Math.max(Math.ceil(remainingMs / 1000), 1);
    restIdRef.current += 1;
    setRest({ id: restIdRef.current, seconds: total, endsAt });
  }

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

  const lastSessionShort = useMemo(() => {
    if (!selected) return null;
    const prev = performance[selected.exercise.id]?.bestSet;
    if (!prev?.weight) return null;
    return `Ant: ${displayKg(prev.weight)}×${prev.reps}`;
  }, [selected, performance, displayKg]);

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
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([40, 60, 80]);
    }
    const restSeconds = loadRestSeconds(
      itemKey,
      items.find((i) => i.key === itemKey)?.restSeconds ?? DEFAULT_REST,
    );
    startRest(restSeconds);
    advanceToSupersetPartner(itemKey);
  }

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
          : { ...item, sets: [...item.sets, newSessionSet({ kind: "normal" }, item.sets.length)] },
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
    void deleteDraft(activeLogId);
    end();
    onFinished();
  }

  const showSummary = !started && !recoverableDraft && items.length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        flex: 1,
        overflowY: "auto",
        background: SURFACE.base,
        paddingBottom: 144, // pb-36 = 144px for BottomNav + Cronos IA clearance
      }}
    >
      {recoverableDraft && (
        <div
          style={{
            margin: SPACE.md,
            padding: SPACE.md,
            borderRadius: RADIUS.control,
            border: `1px solid ${ACCENT.border}`,
            background: ACCENT.subtle,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
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
            <GlassButton variant="ghost" onClick={discardRecovered} style={{ minHeight: 36 }}>
              Descartar
            </GlassButton>
            <GlassButton variant="primary" onClick={restoreRecovered} style={{ minHeight: 36 }}>
              Recuperar
            </GlassButton>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: `0 ${SPACE.md}px ${SPACE.md}px`,
            padding: `${SPACE.sm}px ${SPACE.md}px`,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: SOLID.popover,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
          }}
        >
          <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
            }}
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
        <p style={{ margin: `0 ${SPACE.md}px ${SPACE.md}px`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          Sin conexión: tu sesión está segura en este dispositivo y se sincronizará automáticamente.
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
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              padding: "24px",
              borderRadius: 24,
              background: SCRIM.overlay,
              backdropFilter: GLASS.blurPlain20,
              WebkitBackdropFilter: GLASS.blurPlain20,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
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
            <div
              style={{
                display: "flex",
                background: GLASS.fill,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                padding: "4px",
                gap: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  gym.updateSettings({ weightUnit: "kg" });
                  setGearOpen(false);
                }}
                style={{
                  flex: 1,
                  minHeight: MOTION.minTouchTarget,
                  padding: `8px 16px`,
                  borderRadius: RADIUS.control,
                  border: gym.weightUnit === "kg" ? `1px solid ${ACCENT.border}` : "1px solid transparent",
                  background: gym.weightUnit === "kg" ? ACCENT.subtle : "transparent",
                  color: gym.weightUnit === "kg" ? ACCENT.text : TEXT.primary,
                  fontSize: TYPE.body.size,
                  fontWeight: gym.weightUnit === "kg" ? 600 : 500,
                  cursor: "pointer",
                  transition: MOTION.transitionStandard,
                }}
              >
                Kilogramos (kg)
              </button>
              <button
                type="button"
                onClick={() => {
                  gym.updateSettings({ weightUnit: "lb" });
                  setGearOpen(false);
                }}
                style={{
                  flex: 1,
                  minHeight: MOTION.minTouchTarget,
                  padding: `8px 16px`,
                  borderRadius: RADIUS.control,
                  border: gym.weightUnit === "lb" ? `1px solid ${ACCENT.border}` : "1px solid transparent",
                  background: gym.weightUnit === "lb" ? ACCENT.subtle : "transparent",
                  color: gym.weightUnit === "lb" ? ACCENT.text : TEXT.primary,
                  fontSize: TYPE.body.size,
                  fontWeight: gym.weightUnit === "lb" ? 600 : 500,
                  cursor: "pointer",
                  transition: MOTION.transitionStandard,
                }}
              >
                Libras (lb)
              </button>
            </div>
          </div>
        </div>
      )}

      {showSummary ? (
        <WorkoutPreStartView
          routineTitle={routineTitle}
          planned={planned}
          onStart={() => setStarted(true)}
          onExit={end}
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
            margin: `${SPACE.xl}px auto`,
          }}
        >
          <X aria-hidden="true" size={32} style={{ color: TEXT.disabled }} />
          <p style={{ margin: 0, fontSize: TYPE.body.size, color: TEXT.tertiary }}>
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
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              borderRadius: RADIUS.control,
              border: `1px solid ${ACCENT.base}`,
              background: ACCENT.base,
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
                ? `${items.findIndex((i) => i.key === selected.key) + 1}/${items.length} ${cleanExerciseName(
                    getExerciseDisplayName(selected.exercise),
                  )}`
                : ""
            }
            superset={selectedSuperset}
            startedAt={session?.startedAt ?? null}
            onGear={() => setGearOpen(true)}
            onTerminate={finish}
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
                lastSessionShort={lastSessionShort}
                equipment={equipmentForSelected}
                onDemo={() => setIsDemoOpen(true)}
                onAdvance={() => setIsAvanceOpen(true)}
                onChangeExercise={() => {
                  setPickerMode("replace");
                  setPickerOpen(true);
                  findExerciseReplacements({
                    currentExercise: selected.exercise as any,
                    availableEquipment: availableEquipmentList,
                    exerciseCatalog: catalog || [],
                  });
                }}
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

          {selected.sets.length > 0 && (
                <div style={{ padding: `0 ${SPACE.md}px ${SPACE.lg}px`, maxWidth: "560px", margin: "0 auto", width: "100%" }}>
                  <GlassCard
                    style={{
                      borderRadius: 24,
                      padding: 20,
                      background: "rgba(28, 28, 30, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      boxShadow: "none",
                    }}
                  >
                    {/* Table Header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 54px 1fr 1fr 44px 34px",
                        alignItems: "center",
                        gap: 1.5,
                        padding: "0 0 6px 0",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em" }}>SERIE</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em" }}>ANTERIOR</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>KG/LB</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>REPS</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>RPE</div>
                      <div></div>
                    </div>

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

                    <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                      <GlassButton
                        variant="secondary"
                        onClick={() => addSet(selected.key)}
                        aria-label="+ Agregar serie"
                        style={{ minHeight: 32, padding: "6px 16px", fontSize: TYPE.subhead.size }}
                      >
                        + Agregar serie
                      </GlassButton>
                    </div>
                  </GlassCard>
                </div>
              )}
            </>
          )}
        </>
      )}

      {rest && (
        <RestTimer
          key={rest.id}
          seconds={rest.seconds}
          endsAt={rest.endsAt}
          onClose={closeRest}
          onFinished={closeRest}
        />
      )}

      {isDemoOpen && (
        <DemoSheet
          isOpen={isDemoOpen}
          onClose={() => setIsDemoOpen(false)}
          exerciseName={selected?.exercise.name ?? ""}
          primaryMuscle={selected?.exercise.target ?? ""}
          secondaryMuscles={[]}
        />
      )}
      {isAvanceOpen && (
        <AvanceSheet
          isOpen={isAvanceOpen}
          onClose={() => setIsAvanceOpen(false)}
          exerciseName={selected?.exercise.name ?? ""}
          history={[]}
        />
      )}
      {isCambiarOpen && (
        <CambiarSheet
          isOpen={isCambiarOpen}
          onClose={() => setIsCambiarOpen(false)}
          currentExercise={(selected?.exercise as any) ?? { id: "", name: "" }}
          availableEquipment={availableEquipmentList}
          exerciseCatalog={catalog}
          onReplace={(ex) => {
            if (selected) {
              setItems((prev) =>
                prev.map((it) =>
                  it.key === selected.key ? { ...it, exercise: ex as any } : it,
                ),
              );
            }
            setIsCambiarOpen(false);
          }}
        />
      )}
      {isAjustarOpen && (
        <AjustarSheet
          isOpen={isAjustarOpen}
          onClose={() => setIsAjustarOpen(false)}
          equipmentName={equipmentForSelected?.name ?? "Sin equipo"}
          equipmentImage={equipmentForSelected?.views?.[0]?.src}
          notes=""
          onNotesChange={() => {}}
        />
      )}
      {pickerOpen && (
        <UnifiedExerciseSelectorSheet
          isOpen={pickerOpen}
          mode="single"
          onClose={() => setPickerOpen(false)}
          onSelectSingle={handleExerciseSelected}
        />
      )}
    </div>
  );
}