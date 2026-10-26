/**
 * RoutineDetailModal.tsx — modal de detalle y previsualización de rutina.
 *
 * Panel de vidrio sobre fondo OLED que desglosa la rutina: ejercicio por
 * ejercicio, series programadas y descanso sugerido. Un CTA inferior fijo
 * ("Iniciar sesión de entrenamiento") arranca la sesión activa sin saltos
 * bruscos. Todo el estilo sale de `src/design/tokens.ts`.
 */

import { useMemo, type CSSProperties } from "react";
import {
  Clock,
  Dumbbell,
  Play,
  X,
} from "lucide-react";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import {
  ACCENT,
  FONT_SANS,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { translateMuscle } from "@/lib/i18n";

export interface RoutineDetailModalProps {
  open: boolean;
  onClose: () => void;
  routine: RoutineWithExercises;
  onStart: () => void;
}

export function RoutineDetailModal({
  open,
  onClose,
  routine,
  onStart,
}: RoutineDetailModalProps) {
  if (!open) return null;

  const draftExercises = useMemo(
    () =>
      routine.exercises.map((pe, index) => ({
        index,
        exercise: pe.exercise,
        target_sets: pe.target_sets,
        rest_seconds: pe.rest_seconds,
      })),
    [routine.exercises],
  );

  const totalSets = useMemo(
    () =>
      routine.exercises.reduce((sum, pe) => sum + (pe.target_sets ?? 0), 0),
    [routine.exercises],
  );

  const totalRestMin = useMemo(
    () =>
      Math.round(
        (routine.exercises.reduce((sum, pe) => sum + (pe.rest_seconds ?? 0), 0) /
          60) *
          10,
      ) / 10,
    [routine.exercises],
  );

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: Z_INDEX.modal,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    backgroundColor: SCRIM.modal,
  };

  const panelStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: 460,
    maxHeight: "88vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: GLASS.fillRaised,
    border: `1px solid ${GLASS.border}`,
    borderRadius: RADIUS.sheet,
    boxShadow: GLASS.shadow,
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${SPACE.lg} ${SPACE.xl} ${SPACE.md}`,
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: TYPE.title1.size,
    fontWeight: TYPE.title1.weight,
    lineHeight: TYPE.title1.lineHeight,
    color: TEXT.primary,
    minWidth: 0,
  };

  const descStyle: CSSProperties = {
    margin: 0,
    fontSize: TYPE.body.size,
    lineHeight: TYPE.body.lineHeight,
    color: TEXT.secondary,
    minWidth: 0,
  };

  const metaBarStyle: CSSProperties = {
    display: "flex",
    gap: SPACE.sm,
    padding: `0 ${SPACE.xl} ${SPACE.sm}`,
  };

  const metaChipStyle = (): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: TYPE.caption.size,
    lineHeight: TYPE.caption.lineHeight,
    color: TEXT.secondary,
    backgroundColor: GLASS.fill,
    border: `1px solid ${GLASS.border}`,
    borderRadius: RADIUS.chip,
    padding: "1px 8px",
  });

  const listStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: `0 ${SPACE.xl} ${SPACE.md}`,
    display: "flex",
    flexDirection: "column",
    gap: SPACE.sm,
  };

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: SPACE.sm,
    padding: `${SPACE.xs} ${SPACE.md}`,
    borderRadius: RADIUS.control,
    backgroundColor: GLASS.fill,
    border: `1px solid ${GLASS.border}`,
  };

  const muscleChipStyle = (color: keyof typeof STATUS): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: TYPE.caption.size,
    fontWeight: TYPE.caption.weight,
    letterSpacing: TYPE.label.tracking,
    textTransform: "uppercase",
    color: STATUS[color].text,
    backgroundColor: STATUS[color].muted,
    border: `1px solid ${STATUS[color].border}`,
    borderRadius: RADIUS.pill,
    padding: "1px 8px",
    flexShrink: 0,
  });

  const detailTextStyle: CSSProperties = {
    fontSize: TYPE.body.size,
    color: TEXT.primary,
    minWidth: 0,
    fontVariantNumeric: "tabular-nums",
  };

  const ctaBarStyle: CSSProperties = {
    position: "relative",
    padding: `${SPACE.sm} ${SPACE.xl} ${SPACE.lg}`,
    borderTop: `1px solid ${GLASS.border}`,
    backgroundColor: GLASS.fillRaised,
  };

  const ctaButtonStyle: CSSProperties = {
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    minHeight: MOTION.minTouchTarget,
    padding: `${SPACE.sm} ${SPACE.lg}`,
    borderRadius: RADIUS.control,
    background: ACCENT.base,
    border: `1px solid ${ACCENT.base}`,
    color: TEXT.onAccent,
    fontFamily: FONT_SANS,
    fontSize: TYPE.subhead.size,
    fontWeight: TYPE.subhead.weight,
    cursor: "pointer",
    boxShadow: ACCENT.ring,
    transition: `background-color ${MOTION.fast} ${MOTION.standard}`,
  };

  const closeButtonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: RADIUS.control,
    border: `1px solid ${GLASS.border}`,
    background: GLASS.fill,
    color: TEXT.secondary,
    cursor: "pointer",
  };

  const muscleStatusByTarget: Record<string, keyof typeof STATUS> = {
    chest: "warning",
    pectoral: "warning",
    back: "success",
    espalda: "success",
    legs: "progression",
    pierna: "progression",
    glutes: "warning",
    glúteos: "warning",
    shoulder: "comeback",
    hombro: "comeback",
    arm: "pr",
    brazo: "pr",
    biceps: "pr",
    tríceps: "pr",
    triceps: "pr",
    abdomen: "error",
    abdominal: "error",
  };

  function muscleColor(target: string): keyof typeof STATUS {
    return muscleStatusByTarget[target.toLowerCase()] ?? "success";
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={titleStyle}>
              {routine.title &&
              routine.title.trim() !== "" &&
              routine.title.trim().toLowerCase() !== "xd"
                ? routine.title
                : "Rutina Personalizada"}
            </h1>
            {routine.description && (
              <p style={descStyle}>{routine.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={closeButtonStyle}
          >
            <X style={{ width: 18, height: 18 }} strokeWidth={1.5} />
          </button>
        </div>

        <div style={metaBarStyle}>
          <span style={metaChipStyle()}>
            <Dumbbell style={{ width: 13, height: 13 }} strokeWidth={1.5} />
            <span>
              {routine.exercises.length} ejercicio{routine.exercises.length !== 1 ? "s" : ""}
            </span>
          </span>
          <span style={metaChipStyle()}>
            <Clock style={{ width: 13, height: 13 }} strokeWidth={1.5} />
            <span>{totalSets} series</span>
          </span>
          <span style={metaChipStyle()}>
            <span style={{ fontFamily: TYPE.mono.font, fontVariantNumeric: "tabular-nums" }}>{totalRestMin}</span>{" "}
            <span style={{ fontSize: TYPE.caption.size, opacity: 0.7 }}>min de descanso</span>
          </span>
        </div>

        <div style={listStyle}>
          {draftExercises.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: SPACE.sm,
                padding: SPACE.lg,
                color: TEXT.tertiary,
                textAlign: "center",
              }}
            >
              <Dumbbell
                style={{ width: 32, height: 32, opacity: 0.4 }}
                strokeWidth={1.5}
              />
              <span style={{ fontSize: TYPE.caption.size }}>
                Sin ejercicios programados
              </span>
            </div>
          ) : (
            draftExercises.map((item) => {
              const color = muscleColor(item.exercise.target);
              return (
                <div key={item.exercise.id} style={rowStyle}>
                  <span style={muscleChipStyle(color)}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "9999px",
                        backgroundColor: STATUS[color].base,
                        flexShrink: 0,
                      }}
                    />
                    {translateMuscle(item.exercise.target)}
                  </span>
                  <span
                    style={{
                      ...detailTextStyle,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.exercise.name}
                  </span>
                  <span
                    style={{
                      ...detailTextStyle,
                      fontSize: TYPE.caption.size,
                      color: TEXT.tertiary,
                      textAlign: "right",
                      minWidth: 56,
                    }}
                  >
                    {item.target_sets} ×{item.rest_seconds > 0 ? ` · ${item.rest_seconds}s` : ""}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div style={ctaBarStyle}>
          <button
            type="button"
            onClick={() => {
              onClose();
              onStart();
            }}
            style={ctaButtonStyle}
          >
            <Play style={{ width: 16, height: 16 }} strokeWidth={1.5} />
            Iniciar sesión de entrenamiento
          </button>
        </div>
      </div>
    </div>
  );
}
