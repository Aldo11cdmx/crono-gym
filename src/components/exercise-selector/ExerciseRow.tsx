/**
 * ExerciseRow.tsx — una fila del listado paginado de ejercicios.
 *
 * Muestra miniatura (GIF perezoso, icono de mancuerna si falla), nombre, la
 * línea de músculo primario y equipamiento, y —en modo múltiple— la marca de
 * selección o su número de orden con anillo del acento. Tocar la miniatura
 * expande la fila con la vista previa en línea (GIF más grande, músculos y
 * primeros pasos de técnica si el dataset los trae).
 */

import { useCallback, useMemo, useState } from "react";
import { Activity, Check, Dumbbell, Minus } from "lucide-react";
import type { CSSProperties } from "react";
import type { Exercise } from "@/types/supabase";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { hapticLight } from "@/lib/haptics";
import { ACCENT, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

interface ExerciseRowProps {
  exercise: Exercise;
  /** Índice 1-based en la selección actual (modo múltiple), null si no está. */
  order: number | null;
  selected: boolean;
  multiSelect: boolean;
  expanded: boolean;
  onSelect: (exercise: Exercise) => void;
  onTogglePreview: (id: string) => void;
}

const THUMB_SIZE = 72;

function ExerciseRow({
  exercise,
  order,
  selected,
  multiSelect,
  expanded,
  onSelect,
  onTogglePreview,
}: ExerciseRowProps) {
  const media = useMemo(
    () => resolveMedia("exercise-gif", exercise.id, exercise.gif_url),
    [exercise.id, exercise.gif_url],
  );
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  const [previewFailed, setPreviewFailed] = useState(false);

  const displayName = useMemo(
    () => getExerciseDisplayName(exercise),
    [exercise],
  );
  const primaryMuscle = exercise.body_part || "—";
  const equipment = exercise.equipment || "—";

  const handleRowSelect = useCallback(() => {
    hapticLight();
    onSelect(exercise);
  }, [exercise, onSelect]);

  const handleThumb = useCallback(() => {
    hapticLight();
    onTogglePreview(exercise.id);
  }, [exercise.id, onTogglePreview]);

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: SPACE.md,
    padding: `${SPACE.sm} ${SPACE.md}`,
    borderRadius: RADIUS.control,
    border: `1px solid ${
      selected ? ACCENT.border : "rgba(255,255,255,0.10)"
    }`,
    background: selected ? ACCENT.subtle : "transparent",
    cursor: "pointer",
    contentVisibility: "auto",
    containIntrinsicSize: "0 72px",
    transition: `border-color ${MOTION.fast} ${MOTION.easeOut}, background ${MOTION.fast} ${MOTION.easeOut}`,
  };

  const previewStyle: CSSProperties = {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: SPACE.md,
    padding: `${SPACE.sm} ${SPACE.md} ${SPACE.md}`,
    borderBottom: `1px solid rgba(255,255,255,0.06)`,
    background: "rgba(255,255,255,0.02)",
    contentVisibility: "auto",
    containIntrinsicSize: "0 140px",
  };

  return (
    <div style={{ display: "contents" }}>
      <div
        role="option"
        aria-pressed={selected || undefined}
        aria-label={displayName}
        tabIndex={0}
        style={rowStyle}
        onClick={handleRowSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleRowSelect();
          }
        }}
      >
        <button
          type="button"
          aria-label={`Vista previa de ${displayName}`}
          onClick={(e) => {
            e.stopPropagation();
            handleThumb();
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            flexShrink: 0,
            borderRadius: RADIUS.sm,
            overflow: "hidden",
            background: "rgba(255,255,255,0.05)",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: RADIUS.sm,
              overflow: "hidden",
              position: "relative",
            }}
          >
          {failed || previewFailed ? (
            <Dumbbell
              size={20}
              style={{ color: TEXT.tertiary, display: "block" }}
              aria-hidden="true"
            />
          ) : (
            <img
              src={src}
              alt=""
              width={THUMB_SIZE}
              height={THUMB_SIZE}
              decoding="async"
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onLoad={onLoad}
              onError={() => {
                setPreviewFailed(true);
                onError();
              }}
            />
          )}
          {expanded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePreview(exercise.id);
              }}
              style={{
                position: "absolute",
                right: 4,
                bottom: 4,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: RADIUS.round,
                background: "rgba(0,0,0,0.6)",
                border: "none",
                color: TEXT.primary,
                cursor: "pointer",
              }}
              aria-label="Cerrar vista previa"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: `0 0 ${SPACE.xs}`,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
              color: TEXT.primary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayName}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              alignItems: "center",
              gap: SPACE.xs,
            }}
          >
            <Activity size={12} aria-hidden="true" />
            {primaryMuscle} · {equipment}
          </p>
        </div>
        {multiSelect ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.round,
              border: `2px solid ${
                selected ? ACCENT.base : "rgba(255,255,255,0.10)"
              }`,
              background: selected ? ACCENT.base : "transparent",
              color: selected ? TEXT.onAccent : TEXT.secondary,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
            }}
          >
            {order !== null ? order : <Check size={16} aria-hidden="true" />}
          </span>
        ) : (
          <span style={{ color: TEXT.tertiary }} aria-hidden="true" />
        )}
      </div>
      {expanded && (
        <div style={previewStyle}>
          <div
            style={{
              width: 112,
              height: 112,
              flexShrink: 0,
              borderRadius: RADIUS.control,
              overflow: "hidden",
              background: "rgba(255,255,255,0.05)",
            }}
          >
            {previewFailed ? (
              <Dumbbell size={28} style={{ color: TEXT.tertiary }} aria-hidden="true" />
            ) : (
              <img
                src={src}
                alt=""
                width={112}
                height={112}
                decoding="async"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={() => setPreviewFailed(true)}
              />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: `0 0 ${SPACE.xs}`,
                fontSize: TYPE.subhead.size,
                fontWeight: 600,
                color: TEXT.primary,
              }}
            >
              {primaryMuscle}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: TYPE.caption.size,
                color: TEXT.secondary,
              }}
            >
              {equipment}
            </p>
            {exercise.instructions && exercise.instructions.length > 0 && (
              <div
                style={{
                  marginTop: SPACE.sm,
                  display: "flex",
                  flexDirection: "column",
                  gap: SPACE.xs,
                }}
              >
                {exercise.instructions.slice(0, 3).map((step, i) => (
                  <p
                    key={i}
                    style={{
                      margin: 0,
                      fontSize: TYPE.caption.size,
                      color: TEXT.tertiary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {i + 1}. {step}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { ExerciseRow };
