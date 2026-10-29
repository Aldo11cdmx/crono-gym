/**
 * ActionSheet.tsx — hoja de acciones deslizante desde abajo para menús móviles.
 *
 * Sustituye a los popovers flotantes pequeños (menú de tres puntos, filtros,
 * selector de rol) cuando la app se muestra en una pantalla estrecha. Cada acción
 * es un botón ancho de alto táctil cómodo, con icono a la izquierda, texto alineado
 * a la izquierda y respuesta táctil al pulsar.
 *
 * Sigue el mismo scaffold que `SetTypeSheet` y `ExerciseSelectorModal`: un backdrop
 * fijo que cierra al tocar fuera, y una tarjeta que sube desde el fondo.
 */

import { useCallback } from "react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import {
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SOLID,
  SPACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { hapticLight } from "@/lib/haptics";

export interface ActionSheetItem {
  /** Texto de la acción, en español. */
  label: string;
  /** Nombre de acceso para lectores de pantalla. */
  ariaLabel?: string;
  /** Ícono opcional a la izquierda del texto. */
  icon?: ReactNode;
  /** Cuando es cierto, la acción es destructiva (elimina, descarta, cierra sesión). */
  destructive?: boolean;
  /** Se invoca al tocar la acción; la hoja se cierra sola. */
  onClick: () => void;
}

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Título de la hoja. */
  title?: string;
  /** Etiqueta accesible del botón de cierre. */
  closeAriaLabel?: string;
  /** Acciones a mostrar, en orden. */
  items: ActionSheetItem[];
}

export function ActionSheet({
  isOpen,
  onClose,
  title,
  closeAriaLabel = "Cerrar",
  items,
}: ActionSheetProps) {
  if (!isOpen) return null;

  const handleItem = useCallback(
    (item: ActionSheetItem) => {
      hapticLight();
      item.onClick();
      onClose();
    },
    [onClose],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.sheet,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: SCRIM.modal,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "560px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          // Entra subiendo desde abajo; bajo `prefers-reduced-motion` salta directo.
          transform: "translateY(0)",
          transition: `transform ${MOTION.normal} ${MOTION.easeOut}`,
          padding: `${SPACE.card}px ${SPACE.lg}px ${SPACE.lg}px`,
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          border: `1px solid ${GLASS.border}`,
          background: SOLID.popover,
          boxShadow: GLASS.shadow,
        }}
      >
        {/* Drag handle superior */}
        <div
          style={{
            width: 36,
            height: 4,
            margin: "0 auto 8px auto",
            borderRadius: 2,
            background: GLASS.border,
          }}
          aria-hidden="true"
        />

        {title && (
          <h2
            style={{
              margin: `0 0 ${SPACE.md}`,
              fontSize: TYPE.title2.size,
              fontWeight: TYPE.title2.weight,
              color: TEXT.primary,
            }}
          >
            {title}
          </h2>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.xs,
          }}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label + index}
                type="button"
                aria-label={item.ariaLabel ?? item.label}
                onClick={() => handleItem(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE.sm,
                  width: "100%",
                  minHeight: MOTION.minTouchTarget,
                  padding: `${SPACE.sm} ${SPACE.md}`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${
                    item.destructive ? "transparent" : GLASS.border
                  }`,
                  background: item.destructive
                    ? "transparent"
                    : "transparent",
                  color: item.destructive ? TEXT.primary : TEXT.primary,
                  fontSize: TYPE.subhead.size,
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: `transform ${MOTION.instant} ${MOTION.standard}`,
                }}
              >
                {Icon && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: "28px",
                      color: item.destructive ? TEXT.primary : TEXT.secondary,
                    }}
                  >
                    {Icon}
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={closeAriaLabel}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: MOTION.minTouchTarget,
            minHeight: MOTION.minTouchTarget,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: "transparent",
            color: TEXT.secondary,
            fontSize: TYPE.body.size,
            cursor: "pointer",
            marginTop: SPACE.sm,
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
