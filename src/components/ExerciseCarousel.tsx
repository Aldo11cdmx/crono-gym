/**
 * ExerciseCarousel.tsx — the session's exercises as a snapping strip.
 *
 * Redesigned to Apple HIG / Apple Fitness+ standards:
 *   - Polished circular indicators (60px) with 52px inner thumbnail
 *   - Active exercise: Crimson (#FF3B30) ring + glow effect
 *   - Complete exercise: STATUS.success blue ring + checkmark badge
 *   - Pending: inert hairline + partial progress ring in Crimson
 *   - Superset grouping: vertical strip on left edge + chip badge
 *   - Exercise GIF thumbnails with inverted filter for OLED blending
 *   - Scroll-snap mandatory, center-aligned for thumb-zone accessibility
 *   - Text labels: w-[72px] text-[11px] font-semibold
 */

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import {
  ACCENT,
  CRIMSON,
  DIAGRAM,
  MOTION,
  RADIUS,
  SURFACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SUPERSET_LABELS } from "@/lib/i18n";
import { getSupersetInfo } from "@/lib/workout/supersetUtils";
import { resolveMediaUrl } from "@/lib/media/mediaResolver";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { SupersetBadge } from "./workout/SupersetBadge";
import { SupersetBar } from "./workout/SupersetBar";

export interface CarouselItem {
  key: string;
  exercise: Exercise;
  /** Completed sets / total sets for this exercise. */
  done: number;
  total: number;
  /**
   * The superset this exercise belongs to, or null when it stands alone.
   */
  groupId?: string | null;
}

interface ExerciseCarouselProps {
  items: CarouselItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onAdd?: () => void;
}

/** Strips catalog ID suffixes like " • 0028", " - 0123", "· 0045" from exercise names. */
function cleanExerciseName(name: string): string {
  return name.replace(/\s*[•·-]\s*\d{3,5}$/, "");
}

function exerciseGif(exercise: Exercise): string {
  return typeof exercise.gif_url === "string" ? resolveMediaUrl(exercise.gif_url) : "";
}

function shortName(name: string): string {
  const cleaned = name.replace(/^(barbell|dumbbell|cable|kettlebell|weighted)\s+/i, "");
  const withoutSuffix = cleaned.replace(/\s+-\s+.*$/, "");
  return cleanExerciseName(withoutSuffix.length > 0 ? withoutSuffix : cleaned);
}

export function ExerciseCarousel({
  items,
  selectedKey,
  onSelect,
  onReorder,
  onAdd,
}: ExerciseCarouselProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedKey || !listRef.current) return;
    const match = [...listRef.current.children].find(
      (child) => (child as HTMLElement).dataset.key === selectedKey,
    );
    match?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedKey]);

  if (items.length === 0) return null;

  const selectedIndex = items.findIndex((item) => item.key === selectedKey);
  const activeGroupId = selectedIndex === -1 ? null : items[selectedIndex].groupId ?? null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        margin: 0,
      }}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label="Ejercicios de la sesión"
        data-testid="exercise-carousel"
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          justifyContent: "flex-start",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          padding: "12px 16px",
        }}
        className="cronos-carousel px-4 py-3"
      >
        {items.map((item, index) => {
          const selected = item.key === selectedKey;
          const complete = item.total > 0 && item.done >= item.total;
          const ratio = item.total > 0 ? Math.min(item.done / item.total, 1) : 0;
          const superset = getSupersetInfo(items, index);
          const displayName = getExerciseDisplayName(item.exercise);

          return (
            <button
              key={item.key}
              type="button"
              data-key={item.key}
              role="tab"
              aria-selected={selected}
              aria-label={`${shortName(displayName)}, ${index + 1} de ${items.length}, ${item.done} de ${item.total} series${
                superset
                  ? `, ${SUPERSET_LABELS.tabAriaLabel(superset.label, superset.position, superset.total)}`
                  : ""
              }`}
              onClick={() => onSelect(item.key)}
              onClickCapture={onReorder ? (e) => {
                if (dragIndex !== null) e.stopPropagation();
              } : undefined}
              draggable={!!onReorder}
              onDragStart={(e) => {
                if (!onReorder) return;
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                const dt = e.dataTransfer as DataTransfer & {
                  setImage: (img: HTMLImageElement, x: number, y: number) => void;
                };
                dt.setImage(new Image(), 0, 0);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (onReorder && dragIndex !== null && dragIndex !== index) {
                  onReorder(dragIndex, index);
                }
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className="shrink-0"
              style={{
                scrollSnapAlign: "center",
                flex: "0 0 auto",
                flexShrink: 0,
                width: 72,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                position: "relative",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 60,
                  height: 60,
                  overflow: "hidden",
                  borderRadius: RADIUS.round,
                  border: selected
                    ? `3px solid ${CRIMSON.base}`
                    : complete
                    ? `3px solid ${STATUS.success.base}`
                    : `2px solid ${DIAGRAM.inert}`,
                  background: selected
                    ? CRIMSON.subtle
                    : complete
                    ? "rgba(48, 209, 88, 0.10)"
                    : "rgba(255, 255, 255, 0.04)",
                  boxShadow: selected
                    ? `0 0 20px ${CRIMSON.glow}, 0 0 0 1px ${CRIMSON.base}`
                    : complete
                    ? `0 0 12px ${STATUS.success.muted}`
                    : "none",
                  transform: selected ? "scale(1.08)" : "scale(1)",
                  opacity: selected || complete ? 1 : 0.6,
                  transition: reducedMotion
                    ? undefined
                    : `transform ${MOTION.fast} ${MOTION.spring}, border-color ${MOTION.fast} ${MOTION.standard}, box-shadow ${MOTION.fast} ${MOTION.standard}, opacity ${MOTION.fast} ${MOTION.standard}`,
                }}
              >
                {exerciseGif(item.exercise) ? (
                  <img
                    src={exerciseGif(item.exercise)}
                    alt=""
                    loading="lazy"
                    width={52}
                    height={52}
                    style={{
                      width: 52,
                      height: 52,
                      objectFit: "cover",
                      display: "block",
                      backgroundColor: "transparent",
                      filter: "invert(1) hue-rotate(180deg)",
                      WebkitFilter: "invert(1) hue-rotate(180deg)",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: TYPE.mono.font,
                      fontSize: TYPE.headline.size,
                      fontWeight: 700,
                      color: selected ? CRIMSON.text : complete ? STATUS.success.text : TEXT.disabled,
                    }}
                  >
                    {index + 1}
                  </span>
                )}

                {/* Progress ring */}
                {ratio > 0 && !complete && (
                  <svg
                    viewBox="0 0 60 60"
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      transform: "rotate(-90deg)",
                      pointerEvents: "none",
                    }}
                  >
                    <circle
                      cx="30"
                      cy="30"
                      r="27"
                      fill="none"
                      stroke={DIAGRAM.inert}
                      strokeWidth="3"
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="27"
                      fill="none"
                      stroke={complete ? STATUS.success.base : CRIMSON.base}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${ratio * 169.6} 169.6`}
                    />
                  </svg>
                )}

                {complete && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      right: -4,
                      bottom: -4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: RADIUS.round,
                      background: STATUS.success.base,
                      color: "#000",
                      border: "2px solid #000",
                    }}
                  >
                    <Check size={15} strokeWidth={3} />
                  </span>
                )}
              </span>

              {/* Superset grouping strip */}
              {superset && (
                <SupersetBar
                  tone={superset.tone}
                  isFirst={superset.isFirst}
                  isLast={superset.isLast}
                  active={superset.groupId === activeGroupId}
                />
              )}

              <span
                style={{
                  width: 72,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  fontSize: "11px",
                  lineHeight: "14px",
                  fontWeight: 600,
                  color: selected ? CRIMSON.text : complete ? STATUS.success.text : TEXT.tertiary,
                }}
              >
                {shortName(displayName)}
              </span>

              {superset && (
                <SupersetBadge
                  label={superset.label}
                  position={superset.position}
                  total={superset.total}
                  tone={superset.tone}
                />
              )}
            </button>
          );
        })}

        {/* '+' button at the end of the strip */}
        {onAdd && (
          <button
            type="button"
            role="tab"
            aria-label="Agregar ejercicio"
            onClick={onAdd}
            className="shrink-0"
            style={{
              scrollSnapAlign: "center",
              flex: "0 0 auto",
              flexShrink: 0,
              width: 72,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 60,
                height: 60,
                overflow: "hidden",
                borderRadius: RADIUS.round,
                border: `2px solid ${ACCENT.border}`,
                background: SURFACE.raised,
              }}
            >
              <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span
              style={{
                width: 72,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "center",
                fontSize: "11px",
                lineHeight: "14px",
                fontWeight: 600,
                color: TEXT.tertiary,
              }}
            >
              Nuevo
            </span>
          </button>
        )}
      </div>
    </div>
  );
}