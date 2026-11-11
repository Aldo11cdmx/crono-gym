/**
 * ExerciseCarousel.tsx — the session's exercises as a snapping strip.
 *
 * Redesigned to Apple HIG / Apple Fitness+ standards:
 *   - Polished circular indicators (68px) with subtle glass surface
 *   - Active exercise: Crimson (#FF3B30) ring + scale(1.12) + glow
 *   - Complete exercise: STATUS.success blue ring + checkmark badge
 *   - Pending: inert hairline + partial progress ring in Crimson
 *   - Superset grouping: vertical strip on left edge + chip badge
 *   - Exercise GIF thumbnails with inverted filter for OLED blending
 *   - Scroll-snap mandatory, center-aligned for thumb-zone accessibility
 */

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import {
  ACCENT,
  CRIMSON,
  DIAGRAM,
  GLASS,
  MOTION,
  RADIUS,
  STATUS,
  SURFACE,
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

function borderFor(selected: boolean, complete: boolean): string {
  if (selected) return CRIMSON.base;
  if (complete) return STATUS.success.border;
  return GLASS.border;
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
          gap: 10,
          overflowX: "auto",
          justifyContent: "center",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          padding: "4px 2px 8px",
        }}
        className="cronos-carousel"
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
              style={{
                scrollSnapAlign: "center",
                flex: "0 0 auto",
                width: 68,
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
                  width: 56,
                  height: 56,
                  overflow: "hidden",
                  borderRadius: RADIUS.round,
                  border: `2px solid ${borderFor(selected, complete)}`,
                  background: selected ? CRIMSON.subtle : SURFACE.raised,
                  boxShadow: selected ? CRIMSON.ring : "none",
                  transform: selected ? "scale(1.12)" : "scale(1)",
                  transition: reducedMotion
                    ? undefined
                    : `transform ${MOTION.fast} ${MOTION.spring}, border-color ${MOTION.fast} ${MOTION.standard}, box-shadow ${MOTION.fast} ${MOTION.standard}`,
                }}
              >
                {exerciseGif(item.exercise) ? (
                  <img
                    src={exerciseGif(item.exercise)}
                    alt=""
                    loading="lazy"
                    width={56}
                    height={56}
                    style={{
                      width: "100%",
                      height: "100%",
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
                      color: selected ? CRIMSON.text : TEXT.disabled,
                    }}
                  >
                    {index + 1}
                  </span>
                )}

                {/* Progress ring */}
                {ratio > 0 && (
                  <svg
                    viewBox="0 0 36 36"
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
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke={DIAGRAM.inert}
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke={complete ? STATUS.success.base : CRIMSON.base}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${ratio * 100.5} 100.5`}
                    />
                  </svg>
                )}

                {complete && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      right: -2,
                      bottom: -2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 20,
                      height: 20,
                      borderRadius: RADIUS.round,
                      background: SURFACE.base,
                      color: STATUS.success.base,
                    }}
                  >
                    <Check size={13} strokeWidth={3} />
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
                  width: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  fontSize: TYPE.label.size,
                  lineHeight: TYPE.label.lineHeight,
                  fontWeight: selected ? 600 : TYPE.label.weight,
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
            style={{
              scrollSnapAlign: "center",
              flex: "0 0 auto",
              width: 68,
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
                width: 56,
                height: 56,
                overflow: "hidden",
                borderRadius: RADIUS.round,
                border: `2px solid ${ACCENT.border}`,
                background: SURFACE.raised,
              }}
            >
              <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}