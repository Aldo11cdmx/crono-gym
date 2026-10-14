import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Grip } from "@/data/gripMap";
import { GLASS, RADIUS, SPACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";

export interface GripPopoverProps {
  grip: Grip | null;
  anchorEl: Element | null;
  onClose: () => void;
}

export function GripPopover({ grip, anchorEl, onClose }: GripPopoverProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (anchorEl) {
      setOpen(true);
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      setOpen(false);
    };
  }, [anchorEl, onClose]);

  if (!open || !anchorEl || !grip) return null;

  const anchorRect = anchorEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  
  const popoverWidth = 260;
  const popoverHeight = 120;
  let left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
  let top = anchorRect.top - popoverHeight - 8; // above
  if (top < 0) {
    top = anchorRect.bottom + 8;
  }
  if (left < 8) left = 8;
  if (left + popoverWidth > viewportWidth - 8) left = viewportWidth - popoverWidth - 8;

  return (
    <div
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        height: `${popoverHeight}px`,
        backgroundColor: "rgba(20,20,20,0.85)",
        border: `1px solid ${GLASS.border}`,
        borderRadius: RADIUS.card,
        boxShadow: GLASS.shadow,
        zIndex: Z_INDEX.modal,
        padding: SPACE.md,
        display: "flex",
        flexDirection: "column",
        gap: SPACE.sm,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h3 style={{ color: TEXT.primary, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight }}>
          {grip.name}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-xl p-1"
          style={{ color: TEXT.tertiary }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p style={{ color: TEXT.secondary, fontSize: TYPE.caption.size }}>{grip.description}</p>
      <div className="flex gap-4">
        <div>
          <span style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>Primario:</span>
          <span style={{ color: TEXT.primary, fontSize: TYPE.caption.size }}>
            {grip.primaryMuscles.map((m) => m).join(", ") || "—"}
          </span>
        </div>
        <div>
          <span style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>Secundario:</span>
          <span style={{ color: TEXT.primary, fontSize: TYPE.caption.size }}>
            {grip.secondaryMuscles.map((m) => m).join(", ") || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}


