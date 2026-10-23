/**
 * ExerciseActions.tsx — the five things you can do to the exercise in front of you.
 *
 * A pill row, and every chip is the same size and weight. That is deliberate: these are
 * not a primary action plus some secondary ones, they are one verb each at the same
 * level, so any of them being visually louder would claim an importance the product has
 * not decided on.
 *
 * They were deliberately *not* all left as inert chips that log to the console. A pill
 * that does nothing is a promise the screen breaks on tap, and this is the screen where
 * the athlete has one hand on a barbell. `onSelect` is a prop rather than a hardcoded
 * `console.log` so the next block passes a different handler instead of rewriting the row.
 */

import type { CSSProperties } from "react";
import { Activity, Cog, Film, Gauge, NotebookPen, Repeat2, SlidersHorizontal } from "lucide-react";
import { GLASS, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

/**
 * The verbs, in the order they appear.
 *
 * Ordered by how often they get used mid-set rather than alphabetically: `Avance` is what
 * an athlete reaches for after the last set, so it belongs where the thumb already is.
 */
export const EXERCISE_ACTIONS = [
  { id: "demo", label: "Demo", Icon: Film },
  { id: "avance", label: "Avance", Icon: Gauge },
  { id: "nota", label: "Nota", Icon: NotebookPen },
  { id: "cambiar", label: "Cambiar", Icon: Repeat2 },
  { id: "ajustar", label: "Ajustar", Icon: SlidersHorizontal },
  { id: "maquina", label: "Máquina / Equipo", Icon: Activity },
  { id: "maneral", label: "Maneral / Accesorio", Icon: Cog },
] as const;
export type ExerciseActionId = (typeof EXERCISE_ACTIONS)[number]["id"];

/** Said by a chip that has no handler yet, so its tap is not a mystery. */
export const ACTION_PENDING_TEXT = "Todavía no disponible";

export interface ExerciseActionsProps {
  /**
   * What each chip does. A missing entry means "not wired yet", and the chip says so
   * rather than pretending.
   */
  onSelect?: Partial<Record<ExerciseActionId, () => void>>;
  /** Names the row for a screen reader. */
  label?: string;
}

/**
 * Standard clip for text that must reach the accessibility tree but not the screen.
 *
 * Not `display: none`, which would remove it from the tree too and leave
 * `aria-describedby` pointing at nothing.
 */
export const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function ExerciseActions({
  onSelect,
  label = "Acciones del ejercicio",
}: ExerciseActionsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: SPACE.sm,
      }}
    >
      {EXERCISE_ACTIONS.map(({ id, label: text, Icon }) => {
        const handler = onSelect?.[id];
        const pendingId = `${id}-pending`;

        return (
          <button
            key={id}
            type="button"
            data-action={id}
            // Not `disabled`. A disabled control reads as one that is *waiting* for
            // something, and the honest answer here is "this one was never built", which
            // is a different thing. The gap is announced instead.
            aria-describedby={handler ? undefined : pendingId}
            onClick={() => {
              if (handler) {
                handler();
                return;
              }
              // Loud on purpose. If this line is ever reached in a shipped build it should
              // be findable rather than silently swallowed.
              console.warn(
                `[cronos] ExerciseActions: "${id}" todavía no está conectado. ` +
                  "Se conectará con el Hub.",
              );
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              minHeight: MOTION.minTouchTarget,
              padding: "0 16px",
              borderRadius: RADIUS.pill,
              border: `1px solid ${handler ? GLASS.borderStrong : GLASS.border}`,
              background: GLASS.fill,
              color: handler ? TEXT.primary : TEXT.tertiary,
              fontSize: TYPE.subhead.size,
              fontWeight: TYPE.subhead.weight,
              cursor: "pointer",
              transition: `border-color ${MOTION.fast} ${MOTION.standard}`,
            }}
          >
            <Icon size={15} aria-hidden="true" />
            {text}
            {!handler && (
              // Visually hidden rather than a visible "próximamente" badge: five badges
              // across the row would bury the four chips that do work.
              <span id={pendingId} style={visuallyHidden}>
                {ACTION_PENDING_TEXT}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}