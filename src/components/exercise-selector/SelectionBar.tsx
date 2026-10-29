/**
 * SelectionBar.tsx — barra flotante inferior, modo múltiple.
 *
 * Solo se muestra cuando hay al menos una selección. El botón primario confirma
 * el lote (`hapticSuccess`) y el secundario "Limpiar" descarta la selección.
 * El padding inferior respeta el safe area (notch / indicador de inicio).
 */

import { useCallback } from "react";
import { hapticSuccess } from "@/lib/haptics";
import { ACCENT, MOTION, RADIUS, SPACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";

interface SelectionBarProps {
  selectedCount: number;
  onAdd: () => void;
  onClear: () => void;
}

export function SelectionBar({ selectedCount, onAdd, onClear }: SelectionBarProps) {
  if (selectedCount <= 0) return null;

  const handleAdd = useCallback(() => {
    hapticSuccess();
    onAdd();
  }, [onAdd]);

  const label =
    selectedCount === 1
      ? "Agregar 1 ejercicio"
      : `Agregar ${selectedCount} ejercicios`;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: `env(safe-area-inset-bottom, 0px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.md,
        padding: `${SPACE.md} ${SPACE.lg} ${calcBottom()}`,
        zIndex: Z_INDEX.modal,
        borderTop: `1px solid rgba(255,255,255,0.10)`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        background: "rgba(10, 10, 12, 0.85)",
      }}
    >
      <span
        style={{
          fontSize: TYPE.subhead.size,
          fontWeight: TYPE.subhead.weight,
          color: TEXT.primary,
        }}
      >
        {selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.sm,
        }}
      >
        <button
          type="button"
          onClick={onClear}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: MOTION.minTouchTarget,
            minWidth: MOTION.minTouchTarget,
            padding: `0 ${SPACE.md}`,
            borderRadius: RADIUS.control,
            border: `1px solid rgba(255,255,255,0.10)`,
            background: "transparent",
            color: TEXT.secondary,
            fontSize: TYPE.subhead.size,
            fontWeight: TYPE.subhead.weight,
            cursor: "pointer",
            transition: `background ${MOTION.fast} ${MOTION.easeOut}`,
          }}
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={handleAdd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE.xs,
            minHeight: MOTION.minTouchTarget,
            padding: `0 ${SPACE.xl}`,
            borderRadius: RADIUS.control,
            border: `1px solid ${ACCENT.base}`,
            background: ACCENT.base,
            color: TEXT.onAccent,
            fontSize: TYPE.subhead.size,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 0 0 0 rgba(255,59,48,0)",
            transition: `transform ${MOTION.instant} ${MOTION.standard}, background ${MOTION.fast} ${MOTION.easeOut}`,
          }}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function calcBottom(): string {
  return `calc(16px + env(safe-area-inset-bottom, 0px))`;
}
