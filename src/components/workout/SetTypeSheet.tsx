/**
 * SetTypeSheet.tsx — the bottom sheet for selecting a set's kind.
 *
 * Replaces the inline `KindChips` row on the immersive screen: a badge shows
 * the current kind abbreviation, and tapping it opens this sheet with the
 * four kinds plus a destructive "Eliminar serie" option.
 *
 * Follows the `FilterSheet` scaffold: a fixed backdrop and a card that rises
 * from the bottom, scrollable when the content outgrows the screen.
 */

import { X } from "lucide-react";
import {
  DANGER,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SOLID,
  SPACE,
  STATUS,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { SET_TYPE_LABELS, SET_LOGGER_LABELS } from "@/lib/i18n";
import { SET_KINDS, type SetKind } from "@/lib/workout/setKind";

export interface SetTypeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The kind currently on the row. The sheet marks it selected. */
  currentKind: SetKind;
  /** Called when a kind is chosen. The sheet closes itself. */
  onSelect: (kind: SetKind) => void;
  /**
   * Destructive action: removes the set.
   *
   * Kept separate from `onSelect` so a deletion can never be mistaken for a
   * kind change -- the two travel on different props and a sheet that only
   * knows `onSelect` cannot delete.
   */
  onRemove?: () => void;
  setNumber?: number;
}

const KIND_GLYPH: Record<SetKind, string> = {
  normal: "1",
  warmup: "W",
  failure: "F",
  drop: "D",
};

export function SetTypeSheet({
  isOpen,
  onClose,
  currentKind,
  onSelect,
  onRemove,
  setNumber,
}: SetTypeSheetProps) {
  if (!isOpen) return null;

  const handleSelect = (kind: SetKind) => {
    onSelect(kind);
    onClose();
  };

  const handleRemove = () => {
    onRemove?.();
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.sheet,
        display: "flex",
        alignItems: "flex-end",
        background: SCRIM.modal,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "560px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: SPACE.sm,
          padding: SPACE.card,
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          border: `1px solid ${GLASS.border}`,
          background: SOLID.popover,
          boxShadow: GLASS.shadow,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: SPACE.md,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: TYPE.title2.size,
              fontWeight: TYPE.title2.weight,
              color: TEXT.primary,
            }}
          >
            {setNumber
              ? SET_LOGGER_LABELS.setNumber(setNumber)
              : "Tipo de serie"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "36px",
              minHeight: "36px",
              borderRadius: RADIUS.sm,
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.xs,
          }}
        >
          {SET_KINDS.map((kind) => {
            const selected = kind === currentKind;
            const label = SET_TYPE_LABELS[kind];
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={selected}
                aria-label={SET_LOGGER_LABELS.setTypeAriaLabel(label, setNumber ?? 1)}
                onClick={() => handleSelect(kind)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE.sm,
                  minHeight: MOTION.minTouchTarget,
                  padding: `${SPACE.sm} ${SPACE.md}`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${selected ? STATUS.progression.border : GLASS.border}`,
                  background: selected ? STATUS.progression.muted : "transparent",
                  color: selected ? STATUS.progression.text : TEXT.secondary,
                  fontSize: TYPE.subhead.size,
                  fontWeight: selected ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "24px",
                    height: "24px",
                    fontFamily: TYPE.mono.font,
                    fontSize: TYPE.caption.size,
                    fontWeight: 700,
                    borderRadius: RADIUS.round,
                    background: selected ? STATUS.progression.base : SURFACE.sunken,
                    color: selected ? TEXT.onAccent : TEXT.tertiary,
                  }}
                >
                  {KIND_GLYPH[kind]}
                </span>
                {label}
              </button>
            );
          })}
        </div>

        {onRemove && setNumber && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.sm,
              minHeight: MOTION.minTouchTarget,
              padding: `${SPACE.sm} ${SPACE.md}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${DANGER.border}`,
              background: DANGER.muted,
              color: DANGER.text,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Eliminar la serie {setNumber}
          </button>
        )}
      </div>
    </div>
  );
}
