/**
 * FilterChips.tsx — fila horizontal de chips de filtro (músculo / equipamiento).
 *
 * Cada chip es un botón de 44 px mínimo, texto a la izquierda, estado activo
 * con anillo del acento y color de fondo sutil. La fila se desplaza horizontal
 * con snap y sin barra de scroll visible.
 */

import { useCallback } from "react";
import { ACCENT, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

export interface FilterChip {
  /** Valor del filtro (clave estable). */
  key: string;
  /** Texto visible, en español. */
  label: string;
  /** Está el filtro activo. */
  active: boolean;
  /** Se invoca al tocar; recibe la nueva clave del filtro. */
  onToggle: (key: string) => void;
}

interface FilterChipsProps {
  /** Etiqueta de grupo mostrada sobre los chips (p. ej. "Músculo"). */
  groupLabel: string;
  chips: FilterChip[];
}

export function FilterChips({ groupLabel, chips }: FilterChipsProps) {
  const handleToggle = useCallback(
    (chip: FilterChip) => {
      chip.onToggle(chip.key);
    },
    [],
  );

  if (chips.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.sm,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: TYPE.label.size,
          fontWeight: TYPE.label.weight,
          letterSpacing: TYPE.label.tracking,
          textTransform: "uppercase",
          color: TEXT.tertiary,
        }}
      >
        {groupLabel}
      </p>
      <div
        style={{
          display: "flex",
          gap: SPACE.xs,
          overflowX: "auto",
          paddingBottom: SPACE.xs,
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {chips.map((chip) => {
          const active = chip.active;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => handleToggle(chip)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: SPACE.xs,
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.md}`,
                borderRadius: RADIUS.pill,
                border: `1px solid ${
                  active ? ACCENT.border : "rgba(255,255,255,0.10)"
                }`,
                background: active ? ACCENT.subtle : "transparent",
                color: active ? TEXT.primary : TEXT.secondary,
                fontSize: TYPE.subhead.size,
                fontWeight: TYPE.subhead.weight,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: `background ${MOTION.fast} ${MOTION.easeOut}, border-color ${MOTION.fast} ${MOTION.easeOut}`,
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
