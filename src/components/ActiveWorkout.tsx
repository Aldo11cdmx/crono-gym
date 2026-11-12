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
  Plus,
} from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
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
import { useElapsedMs, formatElapsed } from "../hooks/useElapsedMs";
import { RestTimer } from "./RestTimer";
import { UNDO_LABELS } from "../lib/i18n";
import { toWarmupColumn } from "../lib/workout/setKind";
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
import { equipmentMap } from "@/data/equipmentMap";
import { resolveMedia, resolveMediaUrl } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import {
  calibratePendingSets,
  estimateSmartLoad,
  findSmartSubstitutes,
  generateSmartWarmupSets,
  getAdaptiveRestSeconds,
  getLoadBreakdownHint,
  SET_TYPE_GUIDES,
} from "@/lib/workout/cronosSmartEngine";

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
  const elapsedMs = useElapsedMs(startedAt);
  const elapsedStr = formatElapsed(elapsedMs);

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
              {elapsedStr}
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
  onFillFromPrevious?: (index: number) => void;
  canRemove?: boolean;
  totalSets?: number;
}

const SET_TYPE_OPTIONS: Array<{
  kind: NonNullable<SetEntry["kind"]>;
  badge: string;
  title: string;
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  help: string;
}> = [
  {
    kind: "normal",
    badge: "1",
    title: "Serie Normal (Working Set)",
    color: TEXT.primary,
    bg: "rgba(44, 44, 46, 1)",
    border: "rgba(255, 255, 255, 0.10)",
    badgeBg: "#3F3F46",
    badgeText: "#FFFFFF",
    badgeBorder: "transparent",
    help: "Serie efectiva de trabajo con tu peso objetivo manteniendo entre 1 y 3 repeticiones en reserva (RIR 1–3).",
  },
  {
    kind: "warmup",
    badge: "W",
    title: "Calentamiento (Warm-up)",
    color: "#FF9F0A",
    bg: "rgba(255, 159, 10, 0.15)",
    border: "rgba(255, 159, 10, 0.40)",
    badgeBg: "rgba(255, 159, 10, 0.20)",
    badgeText: "#FF9F0A",
    badgeBorder: "rgba(255, 159, 10, 0.40)",
    help: "Serie de aproximación con menor peso (40%–70%) para lubricar articulaciones y activar el sistema nervioso sin generar fatiga. No cuenta como serie efectiva.",
  },
  {
    kind: "failure",
    badge: "F",
    title: "Al Fallo Muscular (Failure)",
    color: "#FF3B30",
    bg: "rgba(255, 59, 48, 0.15)",
    border: "rgba(255, 59, 48, 0.40)",
    badgeBg: "rgba(255, 59, 48, 0.20)",
    badgeText: "#FF3B30",
    badgeBorder: "rgba(255, 59, 48, 0.40)",
    help: "Serie llevada al límite donde no puedes completar ni una repetición más con buena técnica (RIR 0 / RPE 10). Úsala preferiblemente en la última serie del ejercicio.",
  },
  {
    kind: "drop",
    badge: "D",
    title: "Serie Descendente (Drop Set)",
    color: "#BF5AF2",
    bg: "rgba(191, 90, 242, 0.15)",
    border: "rgba(191, 90, 242, 0.40)",
    badgeBg: "rgba(191, 90, 242, 0.20)",
    badgeText: "#BF5AF2",
    badgeBorder: "rgba(191, 90, 242, 0.40)",
    help: "Al terminar tus repeticiones cerca del fallo, reduces el peso inmediatamente entre un 20% y 30% y continúas sin descanso para maximizar el estrés metabólico.",
  },
];

function SetTrackerTable({
  index,
  entry,
  previousKg,
  previousReps,
  formatWeight,
  onChange,
  onRemove,
  onFillFromPrevious,
  canRemove = false,
  totalSets = 1,
}: SetTrackerTableProps) {
  const setNumber = index + 1;
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [helpKind, setHelpKind] = useState<SetEntry["kind"] | null>(null);

  const currentOption = useMemo(() => {
    const kind = entry.kind ?? "normal";
    return SET_TYPE_OPTIONS.find((o) => o.kind === kind) ?? SET_TYPE_OPTIONS[0];
  }, [entry.kind]);

  const previousText = previousKg != null && previousReps != null
    ? formatWeight
      ? `${formatWeight(previousKg)} × ${previousReps}`
      : `${previousKg}kg × ${previousReps}`
    : "—";

  const hasPrevious = previousKg != null && previousReps != null;
  const isCompleted = entry.completed;

  const openTypeMenu = () => {
    setTypeMenuOpen(true);
    setHelpKind(null);
  };

  const selectKind = (kind: NonNullable<SetEntry["kind"]>) => {
    onChange(index, { ...entry, kind });
    setTypeMenuOpen(false);
    setHelpKind(null);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([15]);
    }
  };

  const badgeLabel = (entry.kind ?? "normal") === "normal" ? String(setNumber) : currentOption.badge;

  const handleFillFromPrevious = () => {
    if (hasPrevious && onFillFromPrevious) {
      onFillFromPrevious(index);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([15]);
      }
    }
  };

  const handleRemove = () => {
    if (canRemove) {
      onRemove(index);
    }
  };

  return (
    <div
      role="group"
      aria-label={`Serie ${setNumber}`}
      style={{
        display: "grid",
        gridTemplateColumns: "36px 54px 1fr 1fr 44px 36px 36px",
        alignItems: "center",
        gap: 2,
        padding: "4px 0",
        borderBottom: index > 0 ? "1px solid rgba(255, 255, 255, 0.04)" : "none",
        background: isCompleted ? "rgba(48, 209, 88, 0.06)" : "transparent",
        borderRadius: 10,
        transition: "background 200ms ease",
        minHeight: 42,
      }}
    >
      {/* Serie Badge - Tap to open type selector */}
      <button
        type="button"
        onClick={openTypeMenu}
        aria-label={`Serie ${setNumber} tipo: ${currentOption.title}. Toca para cambiar.`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 10,
          background: currentOption.bg,
          border: `1px solid ${currentOption.border}`,
          color: currentOption.color,
          fontSize: "12px",
          fontWeight: 700,
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          cursor: "pointer",
          flexShrink: 0,
          transition: "transform 150ms ease, box-shadow 150ms ease, background 150ms ease, border-color 150ms ease",
        }}
        className="active:scale-[0.95]"
        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.92)"; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {badgeLabel}
      </button>

      {typeMenuOpen && (
        <div
          role="dialog"
          aria-label="Selector de tipo de serie"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z_INDEX.modal,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            background: SCRIM.modal,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            padding: "16px",
          }}
          onClick={() => { setTypeMenuOpen(false); setHelpKind(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1C1C1E] border border-white/12 rounded-3xl p-4 shadow-2xl"
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h3 className="text-base font-bold text-white" style={{ margin: 0 }}>Tipo de serie</h3>
                <p className="text-xs text-zinc-400" style={{ margin: "4px 0 0" }}>
                  Selecciona el estímulo de la serie #{setNumber}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar selector de tipo de serie"
                onClick={() => { setTypeMenuOpen(false); setHelpKind(null); }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#D4D4D8",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {SET_TYPE_OPTIONS.map((opt) => {
                const selected = (entry.kind ?? "normal") === opt.kind;
                const optionBadge = opt.kind === "normal" ? String(setNumber) : opt.badge;
                const helpOpen = helpKind === opt.kind;
                return (
                  <div
                    key={opt.kind}
                    className="rounded-2xl bg-[#2C2C2E] border border-white/8 p-3 transition-all"
                    style={{
                      borderColor: selected ? opt.border : "rgba(255,255,255,0.08)",
                      background: selected ? "rgba(44,44,46,0.95)" : "#2C2C2E",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => selectKind(opt.kind)}
                        aria-label={`Seleccionar ${opt.title}`}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          color: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: opt.badgeBg,
                            color: opt.badgeText,
                            border: `1px solid ${opt.badgeBorder}`,
                            fontSize: "12px",
                            fontWeight: 700,
                            fontFamily: TYPE.mono.font,
                            flexShrink: 0,
                          }}
                        >
                          {optionBadge}
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: TEXT.primary }}>
                          {opt.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Ayuda: ${opt.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHelpKind((prev) => (prev === opt.kind ? null : opt.kind));
                        }}
                        className="w-7 h-7 rounded-full bg-white/8 hover:bg-white/15 border border-white/15 font-mono text-xs font-bold text-zinc-300 flex items-center justify-center"
                        style={{ cursor: "pointer", flexShrink: 0 }}
                      >
                        ?
                      </button>
                    </div>
                    {helpOpen && (
                      <div className="mt-2 pt-2 border-t border-white/8 text-xs text-zinc-300 leading-relaxed">
                        {opt.help}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Anterior - Tap to fill from previous */}
      <button
        type="button"
        onClick={handleFillFromPrevious}
        disabled={!hasPrevious}
        aria-label={hasPrevious ? `Rellenar con valores anteriores: ${previousText}` : "Sin datos anteriores"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 0,
          width: "100%",
          height: "100%",
          minHeight: 34,
          fontSize: "11px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          color: hasPrevious ? TEXT.secondary : TEXT.disabled,
          background: "transparent",
          border: "none",
          padding: "0 4px",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor: hasPrevious ? "pointer" : "not-allowed",
          opacity: hasPrevious ? 1 : 0.4,
          transition: "color 150ms ease, background 150ms ease",
          borderRadius: 8,
        }}
        onMouseEnter={(e) => {
          if (hasPrevious) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {previousText}
      </button>

      {/* KG/LB Input */}
      <input
        type="number"
        inputMode="decimal"
        aria-label={`Peso serie ${setNumber}`}
        value={entry.weight}
        placeholder="0"
        onChange={(e) => onChange(index, { ...entry, weight: e.target.value })}
        onFocus={(e) => { e.target.select(); }}
        className="cronos-set-input"
        style={{
          width: "100%",
          height: 42,
          background: "#2C2C2E",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          borderRadius: 12,
          padding: "0 8px",
          textAlign: "center",
          color: TEXT.primary,
          fontSize: "16px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          outline: "none",
          transition: "border-color 150ms ease, background 150ms ease",
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 59, 48, 0.6)";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.10)";
        }}
      />

      {/* REPS Input */}
      <input
        type="number"
        inputMode="numeric"
        aria-label={`Repeticiones serie ${setNumber}`}
        value={entry.reps}
        placeholder="10"
        onChange={(e) => onChange(index, { ...entry, reps: e.target.value })}
        onFocus={(e) => { e.target.select(); }}
        className="cronos-set-input"
        style={{
          width: "100%",
          height: 42,
          background: "#2C2C2E",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          borderRadius: 12,
          padding: "0 8px",
          textAlign: "center",
          color: TEXT.primary,
          fontSize: "16px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          outline: "none",
          transition: "border-color 150ms ease, background 150ms ease",
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 59, 48, 0.6)";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.10)";
        }}
      />

      {/* RPE Button (static display) */}
      <button
        type="button"
        aria-label={`RPE serie ${setNumber}: ${entry.rpe || "—"}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: 42,
          borderRadius: 12,
          background: "#2C2C2E",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          color: TEXT.tertiary,
          fontSize: "16px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          transition: "transform 150ms ease",
        }}
        className="active:scale-[0.95]"
        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {entry.rpe || "—"}
      </button>

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
          borderRadius: 12,
          background: isCompleted ? "#30D158" : "#2C2C2E",
          color: isCompleted ? "#000" : "rgba(255, 255, 255, 0.4)",
          border: isCompleted ? "1px solid #30D158" : "1px solid rgba(255, 255, 255, 0.10)",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 150ms ease",
          boxShadow: isCompleted ? "0 0 14px rgba(48, 209, 88, 0.45)" : "none",
        }}
      >
        <Check size={16} strokeWidth={3} />
      </button>

      {/* Remove/Duplicate Button - only show if canRemove and totalSets > 1 */}
      {(canRemove && totalSets > 1) && (
        <button
          type="button"
          onClick={handleRemove}
          aria-label={`Eliminar serie ${setNumber}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 12,
            background: "rgba(122, 47, 61, 0.15)",
            border: "1px solid rgba(224, 141, 156, 0.3)",
            color: "#E08D9C",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(122, 47, 61, 0.3)";
            e.currentTarget.style.borderColor = "rgba(224, 141, 156, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(122, 47, 61, 0.15)";
            e.currentTarget.style.borderColor = "rgba(224, 141, 156, 0.3)";
          }}
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
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
      {/* Main GIF on Pure Black - Fixed 190px height */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: 240,
          height: 180,
          margin: "0 auto",
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
              maxWidth: "240px",
              height: "180px",
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
        {/* Compact "Machine" pill in bottom-right corner of GIF */}
        {equipment && (
          <button
            type="button"
            aria-label={`Ver foto del equipo: ${equipment.name}`}
            onClick={onAdjustEquipment}
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 9999,
              background: "rgba(28, 28, 30, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#D4D4D8",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
              backdropFilter: "blur(12px)",
            }}
          >
            <MapPin size={10} aria-hidden="true" />
            <span>{equipment.name}</span>
          </button>
        )}
      </div>

      {/* Exercise Identity: Title + Series Counter Pill */}
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: 700,
            color: TEXT.primary,
            letterSpacing: "0",
            textAlign: "center",
            width: "100%",
          }}
        >
          {cleanExerciseName(getExerciseDisplayName(exercise))}
        </h2>
        {lastSessionShort && (
          <p
            style={{
              margin: 0,
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
        {/* Series Counter Pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 9999,
            background: "rgba(28, 28, 30, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.10)",
          }}
        >
          <span
            style={{
              fontFamily: TYPE.mono.font,
              fontSize: "12px",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: ACCENT.base,
            }}
          >
            {completedSets}
          </span>
          <span
            style={{
              fontFamily: TYPE.mono.font,
              fontSize: "12px",
              color: TEXT.tertiary,
            }}
          >
            /
          </span>
          <span
            style={{
              fontFamily: TYPE.mono.font,
              fontSize: "12px",
              color: TEXT.secondary,
            }}
          >
            {totalSets} series
          </span>
          <div
            style={{
              width: 48,
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

      {/* Unified Toolbar: Demo | Avance | Cambiar | Ajustar — h-10, rounded-2xl, bg-[#1C1C1E], border border-white/10, text-xs font-semibold */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, width: "100%", maxWidth: 360, margin: "2px 0" }}>
        <ToolbarButton label="Demo" icon={<Play size={13} strokeWidth={2} aria-hidden="true" />} onClick={onDemo ?? (() => {})} />
        <ToolbarButton label="Avance" icon={<Target size={13} strokeWidth={2} aria-hidden="true" />} onClick={onAdvance ?? (() => {})} />
        <ToolbarButton label="Cambiar" icon={<ArrowRight size={13} strokeWidth={2} aria-hidden="true" />} onClick={onChangeExercise} />
        <ToolbarButton label="Ajustar" icon={<RefreshCw size={13} strokeWidth={2} aria-hidden="true" />} onClick={onAdjustEquipment} />
      </div>
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
        gap: 6,
        padding: "0 8px",
        borderRadius: 24,
        border: "1px solid rgba(255, 255, 255, 0.10)",
        background: "#1C1C1E",
        color: TEXT.secondary,
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0",
        textTransform: "none",
        cursor: "pointer",
        height: 40,
        minHeight: 40,
        transition: "background 150ms ease, color 150ms ease, transform 150ms ease",
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
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.95)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: ACCENT.base,
        }}
      >
        {icon}
      </span>
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
  const [smartGuidesOpen, setSmartGuidesOpen] = useState(false);
  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [calibrationSetIndex, setCalibrationSetIndex] = useState<number | null>(null);
  const [appliedSmartLoadByExercise, setAppliedSmartLoadByExercise] = useState<Record<string, { weightKg: number; reps: number }>>({});
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentEntry | null>(
    null,
  );
  const gym = useGymSettings();

  const sync = useOfflineSync();

  const selected = useMemo(
    () => items.find((i) => i.key === selectedKey) ?? items[0] ?? null,
    [items, selectedKey],
  );

  const selectedIndex = useMemo(
    () => (selected ? items.findIndex((i) => i.key === selected.key) : -1),
    [items, selected],
  );

  const equipmentSuggestion = useMemo<EquipmentSuggestion>(() => {
    if (!selected) return { primary: null, alternatives: [] };
    return getEquipmentSuggestionForExercise(
      selected.exercise.name,
      selected.exercise.equipment,
    );
  }, [selected]);

  const selectedCatalogExercise = useMemo(
    () => catalog.find((exercise: any) => exercise.id === selected?.exercise.id),
    [catalog, selected?.exercise.id],
  );
  const equipmentForSelected = selectedCatalogExercise?.equipment_id && equipmentMap[selectedCatalogExercise.equipment_id]
    ? {
      ...equipmentMap[selectedCatalogExercise.equipment_id],
      id: equipmentMap[selectedCatalogExercise.equipment_id].id,
    } as EquipmentEntry
    : equipmentSuggestion.primary;

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
      const newKey = exercise.id;
      setSelectedKey(newKey);
      const added = newSessionExercise({
        exercise: loggerExercise,
        restSeconds: DEFAULT_REST,
        groupId: null,
        sets: workingTemplateSets(3),
      });
      setSelectedKey(added.key);
      return [...prev, added];
    });

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

  const smartExercise = (selectedCatalogExercise ?? selected?.exercise) as (Exercise & {
    equipment_id?: string;
    station_key?: Parameters<typeof getLoadBreakdownHint>[1];
    movement_pattern?: string;
    image?: string;
  }) | undefined;

  const smartLoad = useMemo(() => {
    if (!selected) return null;
    const history = performance[selected.exercise.id]?.bestSet;
    return estimateSmartLoad({
      mode: history ? "overload" : "biometric_day_0",
      weightKg: history?.weight ?? Number(selected.sets.find((set) => set.kind === "normal")?.weight ?? 0),
      reps: history?.reps ?? undefined,
      targetReps: Number(selected.sets.find((set) => set.kind === "normal")?.reps ?? 8) || 8,
      weightHistory: history?.weight != null && history.reps != null
        ? [{ weightKg: history.weight, reps: history.reps, completed: true }]
        : [],
      targetStation: smartExercise?.station_key,
      movementPattern: smartExercise?.movement_pattern,
      experienceLevel: "beginner",
    });
  }, [performance, selected, selectedCatalogExercise, smartExercise?.movement_pattern, smartExercise?.station_key]);

  const smartSubstitutes = useMemo(() => {
    if (!selected || !smartExercise || !smartLoad) return [];
    return findSmartSubstitutes(smartExercise as any, smartLoad.weightKg, catalog as any);
  }, [catalog, selected, smartExercise, smartLoad]);

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
    if (entry.kind === "normal" && calibrationSetIndex === null) {
      setCalibrationSetIndex(setIndex);
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([40, 60, 80]);
    }
    const configuredRest = loadRestSeconds(
      itemKey,
      items.find((i) => i.key === itemKey)?.restSeconds ?? DEFAULT_REST,
    );
    const restSeconds = Math.max(configuredRest, getAdaptiveRestSeconds(
      entry.kind === "drop" ? "dropset" : entry.kind,
      smartExercise?.movement_pattern,
    ));
    startRest(restSeconds);
    advanceToSupersetPartner(itemKey);
  }

  function applySmartLoad() {
    if (!selected || !smartLoad) return;
    setItems((current) => current.map((item) => item.key !== selected.key ? item : {
      ...item,
      sets: item.sets.map((set) => set.kind === "normal" && !set.completed
        ? { ...set, weight: String(smartLoad.weightKg), reps: String(smartLoad.suggestedReps) }
        : set),
    }));
    setAppliedSmartLoadByExercise((current) => ({
      ...current,
      [selected.exercise.id]: { weightKg: smartLoad.weightKg, reps: smartLoad.suggestedReps },
    }));
  }

  function insertSmartWarmups() {
    if (!selected || !smartLoad) return;
    const warmups = generateSmartWarmupSets(smartLoad.weightKg, selected.sets.some((set) => set.completed));
    setItems((current) => current.map((item) => item.key !== selected.key ? item : {
      ...item,
      sets: [
        ...warmups.map((set, index) => newSessionSet({
          kind: "warmup",
          weight: String(set.weightKg),
          reps: String(set.reps),
        }, index)),
        ...item.sets.map((set, index) => ({ ...set, set_number: index + warmups.length + 1 })),
      ],
    }));
  }

  function applyCalibration(feedback: "too_light" | "perfect" | "too_heavy") {
    if (!selected || calibrationSetIndex === null) return;
    setItems((current) => current.map((item) => {
      if (item.key !== selected.key) return item;
      const calibrated = calibratePendingSets(
        item.sets.map((set) => ({ ...set, weightKg: Number(set.weight) || 0 })),
        calibrationSetIndex,
        feedback,
      );
      return { ...item, sets: calibrated.map(({ weightKg, ...set }) => ({ ...set, weight: String(weightKg) })) };
    }));
    setCalibrationSetIndex(null);
  }

  function replaceWithSubstitute(substitute: (typeof smartSubstitutes)[number]) {
    if (!selected) return;
    const exercise = substitute.exercise;
    const loggerExercise: Exercise = {
      id: exercise.id,
      name: exercise.customNameEs ?? exercise.name,
      name_es: exercise.customNameEs ?? exercise.name_es ?? null,
      body_part: exercise.body_part,
      target: exercise.target,
      equipment: exercise.equipment,
      gif_url: exercise.gif_url,
      instructions: [],
      is_active: true,
      is_hidden: false,
    };
    setItems((current) => current.map((item) => item.key !== selected.key ? item : {
      ...item,
      exercise: loggerExercise,
      sets: item.sets.map((set) => set.kind === "normal" && !set.completed
        ? { ...set, weight: String(substitute.suggestedWeightKg) }
        : set),
    }));
    setSubstituteOpen(false);
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
              selectedIndex >= 0 ? `Ejercicio ${selectedIndex + 1} de ${items.length}` : ""
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
              {smartLoad && appliedSmartLoadByExercise[selected.exercise.id] ? (
                <section className="mx-auto flex w-full max-w-[560px] items-center gap-2 border-y border-white/10 bg-neutral-900 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-white">
                    ✓ Carga aplicada: {appliedSmartLoadByExercise[selected.exercise.id].weightKg} kg × {appliedSmartLoadByExercise[selected.exercise.id].reps}
                  </span>
                  <button type="button" className="min-h-11 shrink-0 rounded-xl bg-neutral-800 px-3 text-xs font-semibold text-white" onClick={insertSmartWarmups}>+ Calentamiento (W)</button>
                  <button type="button" className="min-h-11 shrink-0 rounded-xl bg-neutral-800 px-3 text-xs text-white" onClick={() => setSubstituteOpen(true)}>⇄ Máquina ocupada</button>
                  <button type="button" className="min-h-11 shrink-0 rounded-xl bg-neutral-800 px-3 text-xs text-white" onClick={() => setAppliedSmartLoadByExercise((current) => { const next = { ...current }; delete next[selected.exercise.id]; return next; })}>Editar</button>
                </section>
              ) : smartLoad && (
                <section className="mx-auto w-full max-w-[560px] border-y border-white/10 bg-neutral-900 px-4 py-3">
                  <div className="flex items-center gap-3">
                    {(smartExercise?.image || smartExercise?.gif_url) && (
                      <img src={smartExercise.image || smartExercise.gif_url || ""} alt="" className="h-11 w-11 rounded-xl object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{smartExercise?.equipment_id ?? "Equipo Cronos Gym"}</p>
                      <p className="font-mono text-[11px] text-neutral-500">{smartExercise?.equipment_id ?? "NONE"}</p>
                    </div>
                    <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs font-semibold text-neutral-300" style={{ color: "#FF3B30" }}>🚀 Subir carga</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm text-white">{smartLoad.weightKg} kg × {smartLoad.suggestedReps}</span>
                    <span className="font-mono text-[11px] text-neutral-400">{getLoadBreakdownHint(smartLoad.weightKg, smartExercise?.station_key ?? "free_weight_area", smartExercise?.equipment)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="min-h-11 flex-1 rounded-xl bg-neutral-800 px-3 text-sm font-semibold text-white" style={{ background: "#FF3B30" }} onClick={applySmartLoad}>Aplicar carga</button>
                    <button type="button" className="min-h-11 rounded-xl bg-neutral-800 px-3 text-sm text-white" onClick={insertSmartWarmups}>+ Calentamiento (W)</button>
                    <button type="button" className="min-h-11 rounded-xl bg-neutral-800 px-3 text-sm text-white" onClick={() => setSubstituteOpen(true)}>⇄ Máquina ocupada / Cambiar</button>
                  </div>
                </section>
              )}
              {substituteOpen && (
                <section className="mx-auto w-full max-w-[560px] space-y-2 bg-black px-4 py-3" aria-label="Sustituciones inteligentes">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Alternativas disponibles</h3>
                    <button type="button" className="min-h-11 px-3 text-sm text-neutral-400" onClick={() => setSubstituteOpen(false)}>Cerrar</button>
                  </div>
                  {smartSubstitutes.map((substitute) => (
                    <button key={substitute.exercise.id} type="button" className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-neutral-900 p-3 text-left" onClick={() => replaceWithSubstitute(substitute)}>
                      <img src={substitute.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-white">{substitute.exercise.customNameEs ?? substitute.exercise.name}</strong>
                        <span className="font-mono text-[11px] text-neutral-400">
                          {substitute.exercise.equipment_id ?? "NONE"} · {substitute.exercise.equipment_id && equipmentMap[substitute.exercise.equipment_id] ? equipmentMap[substitute.exercise.equipment_id].name : "Peso libre / Piso"} · {substitute.suggestedWeightKg}kg
                        </span>
                      </span>
                    </button>
                  ))}
                  {smartSubstitutes.length === 0 && <p className="text-sm text-neutral-400">No hay sustituciones disponibles.</p>}
                </section>
              )}
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
              <button type="button" className="mb-2 flex min-h-11 w-full items-center justify-between rounded-xl bg-neutral-900 px-3 text-left text-xs font-semibold text-neutral-300" onClick={() => setSmartGuidesOpen((open) => !open)}>
                <span>ⓘ ¿Para qué sirve cada serie?</span><span aria-hidden="true">{smartGuidesOpen ? "−" : "+"}</span>
              </button>
              {smartGuidesOpen && (
                <div className="mb-3 space-y-1 rounded-xl bg-neutral-900 p-3 text-xs text-neutral-400">
                  <p>{SET_TYPE_GUIDES.warmup}</p><p>{SET_TYPE_GUIDES.normal}</p><p>{SET_TYPE_GUIDES.dropset}</p><p>{SET_TYPE_GUIDES.failure}</p>
                </div>
              )}
              {calibrationSetIndex !== null && (
                <div className="mb-3 flex flex-wrap gap-2 rounded-xl bg-neutral-900 p-3">
                  <button type="button" className="min-h-11 rounded-xl bg-neutral-800 px-3 text-xs text-white" onClick={() => applyCalibration("too_light")}>Muy ligero ⬆️ +2.5kg</button>
                  <button type="button" className="min-h-11 rounded-xl bg-neutral-800 px-3 text-xs font-semibold text-white" style={{ background: "#30D158", color: "#000" }} onClick={() => applyCalibration("perfect")}>Perfecto ✓</button>
                  <button type="button" className="min-h-11 rounded-xl bg-neutral-800 px-3 text-xs text-white" onClick={() => applyCalibration("too_heavy")}>Muy pesado ⬇️ -2.5kg</button>
                </div>
              )}
                  <div
                    style={{
                      borderRadius: 24,
                      padding: 14,
                      background: "#1C1C1E",
                      border: "1px solid rgba(255, 255, 255, 0.10)",
                      boxShadow: "none",
                    }}
                  >
                    {/* Table Header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "36px 54px 1fr 1fr 44px 36px 36px",
                        alignItems: "center",
                        gap: 2,
                        padding: "0 0 6px 0",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>#</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>ANT.</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>KG/LB</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>REPS</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>RPE</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>✓</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}></div>
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
                        onFillFromPrevious={(i: number) => {
                          const prev = performance[selected.exercise.id]?.bestSet;
                          if (prev?.weight != null && prev?.reps != null) {
                            updateSet(selected.key, i, {
                              ...entry,
                              weight: String(prev.weight),
                              reps: String(prev.reps),
                            });
                          }
                        }}
                        canRemove={true}
                        totalSets={selected.sets.length}
                      />
                    ))}

                    <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => addSet(selected.key)}
                        aria-label="+ Agregar serie"
                        style={{
                          width: "100%",
                          height: 40,
                          borderRadius: 24,
                          background: "#2C2C2E",
                          border: "1px solid rgba(255, 255, 255, 0.10)",
                          color: TEXT.primary,
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "background 150ms ease, transform 150ms ease",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#3A3A3E"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#2C2C2E"; }}
                        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.99)"; }}
                        onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      >
                        <Plus size={14} strokeWidth={2} aria-hidden="true" />
                        Agregar serie
                      </button>
                    </div>
                  </div>
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

      {/* Smart Workout Dock - Bottom Sticky Capsule */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 30,
          marginTop: "auto",
          padding: "8px 16px 16px",
          background: "linear-gradient(180deg, transparent 0%, #000000 40%, #000000 100%)",
        }}
      >
        <div
          style={{
            height: 56,
            borderRadius: 28,
            background: "rgba(28, 28, 30, 0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
          }}
        >
          {rest ? (
            /* State A: Rest Timer Active */
            <>
              {/* Left: Status indicator + Timer */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#30D158",
                    boxShadow: "0 0 8px #30D158",
                    animation: "cronos-rest-pulse 1.5s ease-in-out infinite",
                  }}
                  aria-hidden="true"
                />
                <span
                  style={{
                    fontFamily: TYPE.mono.font,
                    fontSize: "16px",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: TEXT.primary,
                  }}
                >
                  {Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000))}s
                </span>
              </div>

              {/* Right: -15s, +15s, Skip */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => startRestUntil(rest.endsAt - 15000)}
                  aria-label="Restar 15 segundos"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 10px",
                    borderRadius: 16,
                    background: "#2C2C2E",
                    border: "1px solid rgba(255, 255, 255, 0.10)",
                    color: "#D4D4D8",
                    fontSize: "11px",
                    fontFamily: TYPE.mono.font,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    cursor: "pointer",
                    height: 36,
                    transition: "background 150ms ease, transform 150ms ease",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  -15s
                </button>
                <button
                  type="button"
                  onClick={() => startRestUntil(rest.endsAt + 15000)}
                  aria-label="Sumar 15 segundos"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 10px",
                    borderRadius: 16,
                    background: "#2C2C2E",
                    border: "1px solid rgba(255, 255, 255, 0.10)",
                    color: "#D4D4D8",
                    fontSize: "11px",
                    fontFamily: TYPE.mono.font,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    cursor: "pointer",
                    height: 36,
                    transition: "background 150ms ease, transform 150ms ease",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={closeRest}
                  aria-label="Saltar descanso"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 12px",
                    borderRadius: 16,
                    background: ACCENT.base,
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    height: 36,
                    transition: "background 150ms ease, transform 150ms ease",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  Saltar
                </button>
              </div>
            </>
          ) : (
            /* State B: Idle (Navigation Mode) */
            <>
              {/* Left: ← Previous */}
              <button
                type="button"
                onClick={() => {
                  if (selectedIndex > 0) {
                    focusExercise(items[selectedIndex - 1].key);
                  }
                }}
                disabled={selectedIndex <= 0}
                aria-label="Ejercicio anterior"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 16,
                  background: "#2C2C2E",
                  border: "none",
                  color: TEXT.secondary,
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: selectedIndex <= 0 ? 0.35 : 1,
                  transition: "background 150ms ease, opacity 150ms ease, transform 150ms ease",
                }}
                onMouseDown={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = "scale(0.95)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                ← Anterior
              </button>

              {/* Center: ⏱ Rest */}
              <button
                type="button"
                onClick={() => startRest(DEFAULT_REST)}
                aria-label="Iniciar descanso de 90 segundos"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 16,
                  background: "#2C2C2E",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#D4D4D8",
                  fontSize: "12px",
                  fontFamily: TYPE.mono.font,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  cursor: "pointer",
                  transition: "background 150ms ease, border-color 150ms ease, transform 150ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#3A3A3E";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#2C2C2E";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                ⏱ 90s
              </button>

              {/* Right: Next → or Finish ✓ */}
              {selectedIndex >= 0 && selectedIndex < items.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIndex < items.length - 1) {
                      focusExercise(items[selectedIndex + 1].key);
                    }
                  }}
                  aria-label="Siguiente ejercicio"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    height: 40,
                    padding: "0 14px",
                    borderRadius: 16,
                    background: ACCENT.base,
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "background 150ms ease, transform 150ms ease",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  aria-label="Finalizar entrenamiento"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    height: 40,
                    padding: "0 14px",
                    borderRadius: 16,
                    background: ACCENT.base,
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "background 150ms ease, transform 150ms ease",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  Finalizar ✓
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}