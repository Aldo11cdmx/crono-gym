/**
 * ExerciseRow.tsx — una fila del listado paginado de ejercicios.
 *
 * Muestra miniatura (GIF perezoso, icono de mancuerna si falla), nombre, la
 * línea de músculo primario y equipamiento, y —en modo múltiple— la marca de
 * selección o su número de orden con anillo del acento. Tocar la miniatura
 * expande la fila con la vista previa en línea (GIF más grande, músculos y
 * primeros pasos de técnica si el dataset los trae).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Check, Dumbbell, Minus, MoreHorizontal } from "lucide-react";
import type { CSSProperties } from "react";
import type { Exercise } from "@/types/supabase";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { hapticLight } from "@/lib/haptics";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { ACCENT, DANGER, GLASS, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

interface ExerciseRowProps {
  exercise: Exercise;
  /** Índice 1-based en la selección actual (modo múltiple), null si no está. */
  order: number | null;
  selected: boolean;
  multiSelect: boolean;
  expanded: boolean;
  onSelect: (exercise: Exercise) => void;
  onTogglePreview: (id: string) => void;
  /** Renombra `name` / `name_es` en Supabase y nota el cambio localmente. */
  onRename?: (id: string, name: string, nameEs: string | null) => void;
  /** Soft-delete: oculta el ejercicio del catálogo sin borrar su historial. */
  onHide?: (id: string) => void;
  /** Ya está ocultado del catálogo. */
  hidden?: boolean;
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
  onRename,
  onHide,
  hidden,
}: ExerciseRowProps) {
  const media = useMemo(
    () => resolveMedia("exercise-gif", exercise.id, exercise.gif_url),
    [exercise.id, exercise.gif_url],
  );
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const displayName = useMemo(
    () => getExerciseDisplayName(exercise),
    [exercise],
  );
  const primaryMuscle = exercise.body_part || "—";
  const equipment = exercise.equipment || "—";

  useEffect(() => {
    if (menuOpen) setRenameValue(exercise.name);
  }, [menuOpen, exercise.name]);

  const handleRowSelect = useCallback(() => {
    hapticLight();
    onSelect(exercise);
  }, [exercise, onSelect]);

  const handleThumb = useCallback(() => {
    hapticLight();
    onTogglePreview(exercise.id);
  }, [exercise.id, onTogglePreview]);

  const handleToggleMenu = useCallback(() => {
    hapticLight();
    setMenuOpen((prev) => !prev);
  }, []);

  const handleSaveRename = useCallback(async () => {
    const next = renameValue.trim();
    if (!next || !onRename) return;
    setRenaming(true);
    try {
      await onRename(exercise.id, next, next);
      setMenuOpen(false);
      setRenameValue("");
    } catch {
      // El error se reporta desde la hoja (sheet) con un estado visible.
    } finally {
      setRenaming(false);
    }
  }, [renameValue, onRename, exercise.id]);

  const handleHide = useCallback(async () => {
    if (!onHide) return;
    setRenaming(true);
    try {
      await onHide(exercise.id);
      setMenuOpen(false);
    } catch {
      // El error se reporta desde la hoja (sheet).
    } finally {
      setRenaming(false);
    }
  }, [onHide, exercise.id]);

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

  const menuStyle: CSSProperties = {
    gridColumn: "1 / -1",
    display: "flex",
    flexDirection: "column",
    gap: SPACE.xs,
    padding: `${SPACE.sm} ${SPACE.md} ${SPACE.md}`,
    borderBottom: `1px solid rgba(255,255,255,0.06)`,
    background: "rgba(255,255,255,0.02)",
    contentVisibility: "auto",
    containIntrinsicSize: "0 88px",
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
        {(onRename || onHide) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleMenu();
            }}
            aria-label={T.exerciseMenu}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.round,
              border: `1px solid ${GLASS.border}`,
              background: menuOpen ? ACCENT.subtle : "transparent",
              color: TEXT.secondary,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {menuOpen && (
        <div style={menuStyle}>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={T.exerciseRenamePlaceholder}
            style={{
              width: "100%",
              minHeight: MOTION.minTouchTarget,
              padding: `0 ${SPACE.sm}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: "rgba(255,255,255,0.05)",
              color: TEXT.primary,
              fontSize: TYPE.subhead.size,
              marginBottom: SPACE.xs,
            }}
          />
          <div style={{ display: "flex", gap: SPACE.xs }}>
            <button
              type="button"
              onClick={handleSaveRename}
              disabled={renaming || renameValue.trim() === "" || !onRename}
              style={{
                flex: 1,
                minHeight: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                border: "none",
                background: ACCENT.base,
                color: TEXT.onAccent,
                fontSize: TYPE.subhead.size,
                fontWeight: 600,
                cursor: "pointer",
                opacity: renaming || renameValue.trim() === "" || !onRename ? 0.5 : 1,
              }}
            >
              {renaming ? "Guardando…" : T.exerciseSave}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              disabled={renaming}
              style={{
                minWidth: MOTION.minTouchTarget,
                minHeight: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: "transparent",
                color: TEXT.secondary,
                cursor: "pointer",
                padding: `0 ${SPACE.sm}`,
              }}
            >
              {T.exerciseCancel}
            </button>
          </div>
          <button
            type="button"
            onClick={handleHide}
            disabled={renaming || !onHide}
            style={{
              width: "100%",
              marginTop: SPACE.xs,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.control,
              border: `1px solid ${DANGER.base}`,
              background: "transparent",
              color: DANGER.base,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
              cursor: "pointer",
              opacity: renaming || !onHide ? 0.5 : 1,
            }}
          >
            {hidden ? T.exerciseHidden : T.exerciseHide}
          </button>
        </div>
      )}
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
