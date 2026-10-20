/**
 * ExerciseCarousel.tsx — the session's exercises as a snapping strip.
 *
 * Fixed to the top of the session, which is the whole reason it is a carousel and not a
 * sidebar: the athlete's thumb is already near the top of the screen because that is
 * where the set table is, and the one question this strip answers is "where am I, and
 * what is next".
 *
 * Why scroll-snap is `x mandatory`
 * -------------------------------
 * With `proximity` the strip free-scrolls and a flick leaves two bubbles half-visible,
 * so the answer to "where am I" is ambiguous at exactly the moment the athlete is
 * mid-set and least able to read carefully. `mandatory` says the strip always comes to
 * rest on a bubble, which makes "the centred bubble is the current exercise" a rule the
 * strip keeps on its own. Alignment is `center` rather than `start` so the current
 * exercise lands in the middle of a narrow screen instead of hard against the left edge,
 * where the app's own gutter would clip its label.
 *
 * The three states, and why they are three
 * ---------------------------------------
 * - **Active**: accent border, a scale up, and a full-strength label. It is the only one
 *   that changes size, which is what makes it findable at a glance from across a room.
 * - **Complete**: `STATUS.success`, a tick, and the bubble full. Note the token is a
 *   **blue**, not a green -- `tokens.ts` forbids a saturated green for exactly this
 *   control, because a deuteranope folds green into the amber of `STATUS.warning` and the
 *   two would collapse into "some kind of chip". Shape carries it too: the tick appears,
 *   so the state survives with no colour at all.
 * - **Pending**: an inert hairline and a partial progress ring in the accent.
 *
 * The ring is per exercise rather than one bar for the session, because "3 of 4 on
 * squats, 4 of 4 on bench" and "7 of 8 overall" are different questions and the athlete
 * asks both. The header's overall bar answers the second; this answers the first.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import {
  ACCENT,
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
   *
   * Optional and nullable because both answers are real: a session written
   * before supersets existed has no grouping to carry, and an exercise that is
   * not in a group says so with null rather than by being absent.
   */
  groupId?: string | null;
}

interface ExerciseCarouselProps {
  items: CarouselItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /**
   * Called with `(fromIndex, toIndex)` after a drag-and-drop reorder.
   *
   * Omitted by callers that do not support reordering (e.g. a routine that is
   * fixed in plan order); the items remain draggable for screen-reader users
   * via the tab list, but the visual drag handle is hidden.
   */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /**
   * Called when the '+' button at the end of the strip is tapped.
   * Omitted when adding exercises is not supported.
   */
  onAdd?: () => void;
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

  /*
   * Keeps the active bubble visible when selection comes from elsewhere.
   *
   * Walks the children and compares `data-key` in JS rather than building a selector with
   * `CSS.escape`. Two reasons, and the second is the one that bit: an exercise id is a
   * uuid today so it would be selector-safe, but anything containing a quote or a bracket
   * would need escaping to be selected at all -- and `CSS.escape` is not implemented in
   * every environment this renders into, so a missing global would take the whole strip
   * down on mount rather than on an exotic key.
   */
  useEffect(() => {
    if (!selectedKey || !listRef.current) return;
    const match = [...listRef.current.children].find(
      (child) => (child as HTMLElement).dataset.key === selectedKey,
    );
    match?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedKey]);

  if (items.length === 0) return null;

  /*
   * The group of the exercise on screen.
   *
   * The strip marks the whole group, not just the bubble that happens to be
   * selected: "these two go together" is a fact about the pair, and dimming
   * the partner while the first one is on screen would say the opposite.
   */
  const selectedIndex = items.findIndex((item) => item.key === selectedKey);
  const activeGroupId =
    selectedIndex === -1 ? null : items[selectedIndex].groupId ?? null;

  return (
    // In-flow strip, centred by its parent (ActiveWorkout). It lives between the
    // Transparent strip centred by its parent. Floats cleanly over the black canvas,
    // with no card background, border, or shadow.
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
          // The two properties that make this a carousel. `x mandatory` because a strip
          // that can rest between two bubbles cannot answer "which one am I on".
          scrollSnapType: "x mandatory",
          // No visible scrollbar: the snap and the scale are the affordance, and a bar
          // under a 56px strip on a phone is mostly a place for a thumb to land.
          scrollbarWidth: "none",
          // Room for the active bubble's scale-up and its glow, which would otherwise be
          // clipped by the container's own overflow.
          padding: "4px 2px 8px",
        }}
        className="cronos-carousel"
      >
        {items.map((item, index) => {
          const selected = item.key === selectedKey;
          const complete = item.total > 0 && item.done >= item.total;
          const ratio = item.total > 0 ? Math.min(item.done / item.total, 1) : 0;
          /*
           * Where this exercise sits in its superset, if it is in one. Null for
           * an exercise that stands alone, which is the answer that keeps the
           * ordinary bubble ordinary.
           */
          const superset = getSupersetInfo(items, index);

          return (
            <button
              key={item.key}
              type="button"
              data-key={item.key}
              role="tab"
              aria-selected={selected}
              // The accessible name carries the position as well as the count. "Sentadilla,
              // 2 de 4 series" says how far in; adding "ejercicio 3 de 6" is what lets
              // someone navigate the strip without seeing it.
              //
              // A grouped exercise adds its place in the group, because "sentadilla, 1 de
              // 6" does not say that it is the first of two exercises that are performed
              // together, and that is exactly what the athlete needs to know mid-set.
              aria-label={`${item.exercise.name}, ${index + 1} de ${items.length}, ${item.done} de ${item.total} series${
                superset
                  ? `, ${SUPERSET_LABELS.tabAriaLabel(superset.label, superset.position, superset.total)}`
                  : ""
              }`}
              onClick={() => onSelect(item.key)}
              onClickCapture={onReorder ? (e) => {
                // Prevent the select handler from firing when starting a drag.
                if (dragIndex !== null) e.stopPropagation();
              } : undefined}
              draggable={!!onReorder}
              onDragStart={(e) => {
                if (!onReorder) return;
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                // A transparent 1x1 gif prevents the browser from showing a ghost
                // image that obscures the thumb position.
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
                // The snap target. Without this the strip can rest with a bubble anywhere
                // and `mandatory` has nothing to snap *to*.
                scrollSnapAlign: "center",
                flex: "0 0 auto",
                width: 68,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                // The anchor for the group's strip, which hangs off the left edge of
                // this bubble.
                position: "relative",
                // Decorative wrapper: the label below is the tab's name.
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
                  // Red border for the active exercise, per the design spec.
                  border: `2px solid ${borderFor(selected, complete)}`,
                  background: selected ? ACCENT.subtle : SURFACE.raised,
                  // The one thing on this screen that changes size, and the reason the
                  // current exercise is findable without reading. `transform` rather than
                  // `width`/`height` so it does not invalidate layout on every frame of
                  // the transition.
                  transform: selected ? "scale(1.12)" : "scale(1)",
                  transition: reducedMotion
                    ? undefined
                    : `transform ${MOTION.fast} ${MOTION.spring}, border-color ${MOTION.fast} ${MOTION.standard}`,
                }}
              >
                {/*
                  Same defensiveness as `ExerciseStage`: `gif_url` is declared
                  non-nullable in the generated types, but rows written before the column
                  existed reach this screen without one, and reading `.trim()` off
                  undefined would blank the session.
                */}
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
                       // Neutralise the white background baked into the GIF thumbnails,
                       // turning opaque white to black so it blends into the pure-black
                       // surface instead of flashing paper-white. The transparent base
                       // lets any true transparency in the GIF pass through.
                       backgroundColor: "transparent",
                       filter: "invert(1) hue-rotate(180deg)",
                       WebkitFilter: "invert(1) hue-rotate(180deg)",
                     }}
                   />
                ) : (
                  // Same reasoning as `ExerciseStage`'s placeholder, at 56px: no
                  // illustration beats a letterboxed one, and the numbered badge below
                  // already identifies the exercise without reading its name.
                  <span
                    style={{
                      fontFamily: TYPE.mono.font,
                      fontSize: TYPE.headline.size,
                      fontWeight: 700,
                      color: selected ? ACCENT.text : TEXT.disabled,
                    }}
                  >
                    {index + 1}
                  </span>
                )}

                {/* Progress ring: SVG so it needs no extra dependency. */}
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
                      stroke={complete ? STATUS.success.base : ACCENT.base}
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

              {/*
                The group's strip, down the left edge of the bubble.

                It is decorative: the badge below says the same thing in words, and
                the bubble's own accessible name carries it for a screen reader.
              */}
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
                   color: selected ? ACCENT.text : complete ? STATUS.success.text : TEXT.tertiary,
                }}
              >
                {shortName(item.exercise.name)}
              </span>

              {/*
                The chip that names the group. It is the half of the grouping that
                survives a monochrome screen: the strip says "these go together" and
                the chip says which group and where this one sits in it.
              */}
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

        {/* '+' button at the end of the strip to add a new exercise. */}
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
            <span
              style={{
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "center",
                fontSize: TYPE.label.size,
                lineHeight: TYPE.label.lineHeight,
                fontWeight: TYPE.label.weight,
                color: TEXT.secondary,
              }}
            >
              +
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/** The bright red border for the active exercise, and the success blue for complete. */
function borderFor(selected: boolean, complete: boolean): string {
  if (selected) return ACCENT.base;
  if (complete) return STATUS.success.border;
  return GLASS.border;
}

/** The demo URL, or `""` when there isn't one. See the note at the call site. */
function exerciseGif(exercise: Exercise): string {
  return typeof exercise.gif_url === "string" ? resolveMediaUrl(exercise.gif_url) : "";
}

/**
 * Strips the catalog's equipment prefix ("Barbell Bench Press - Neutral Grip")
 * so the bubble label stays readable in 68px.
 */
function shortName(name: string): string {
  const cleaned = name.replace(/^(barbell|dumbbell|cable|kettlebell|weighted)\s+/i, "");
  const withoutSuffix = cleaned.replace(/\s+-\s+.*$/, "");
  return withoutSuffix.length > 0 ? withoutSuffix : cleaned;
}
