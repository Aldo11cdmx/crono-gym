/**
 * LoadingSpinner.tsx — indicador de carga para los límites de `Suspense`.
 *
 * Estética Apple Dark: fondo negro puro (`SURFACE.base`), un solo anillo del
 * color de acento (`ACCENT.base`), girando sobre `transform` para no mover el
 * layout. Respeta `prefers-reduced-motion` deteniendo la animación.
 */

import type { CSSProperties } from "react";
import { ACCENT, MOTION, RADIUS, SPACE, SURFACE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface LoadingSpinnerProps {
  /** Texto de estado anunciado a lectores de pantalla. */
  label?: string;
  size?: number;
}

export function LoadingSpinner({ label = "Cargando…", size = 40 }: LoadingSpinnerProps) {
  const reducedMotion = useReducedMotion();

  const ringStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `3px solid ${SURFACE.base}`,
    borderTopColor: ACCENT.base,
    animation: reducedMotion
      ? undefined
      : `cronos-spin ${MOTION.loop.session} ${MOTION.standard} infinite`,
  };

  return (
    <div
      role="status"
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.sm,
        padding: SPACE.md,
        borderRadius: RADIUS.card,
        backgroundColor: SURFACE.base,
        border: `1px solid ${ACCENT.base}33`,
      }}
    >
      <div style={ringStyle} />
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: ACCENT.base,
        }}
      >
        {label}
      </span>
    </div>
  );
}
