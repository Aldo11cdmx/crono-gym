/**
 * QuickActionButton.tsx — a floating action button that opens a dropdown of
 * quick actions.
 *
 * Positioned as `fixed` in the bottom-right corner. Closing: click the
 * button again, click outside, or press Escape.
 */

import { useEffect, useRef, useState } from "react";
import { ACCENT, GLASS, MOTION, RADIUS, TEXT, TYPE, Z_INDEX } from "@/design/tokens";

export interface QuickActionItem {
  id: string;
  label: string;
  icon?: string;
  onChoose: () => void;
}

export interface QuickActionButtonProps {
  icon?: string;
  actions: QuickActionItem[];
  loading?: boolean;
}

export function QuickActionButton({
  icon = "▶",
  actions,
  loading = false,
}: QuickActionButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: Z_INDEX.fab,
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: RADIUS.round,
            background: ACCENT.glow,
            animation: `cronos-pulse ${MOTION.loop.skeleton} ${MOTION.standard} infinite`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: Z_INDEX.fab,
      }}
    >
      {open && actions.length > 0 && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-orientation="vertical"
          style={{
            position: "absolute",
            bottom: "72px",
            right: "0",
            minWidth: "180px",
            borderRadius: RADIUS.control,
            background: GLASS.fill,
            border: `1px solid ${GLASS.borderStrong}`,
            boxShadow: GLASS.shadow,
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              onClick={() => {
                action.onChoose();
                close();
              }}
              style={{
                padding: "10px 12px",
                borderRadius: RADIUS.sm,
                border: "none",
                background: "transparent",
                color: TEXT.primary,
                fontSize: TYPE.subhead.size,
                fontWeight: TYPE.subhead.weight,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: `background ${MOTION.fast} ${MOTION.standard}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = GLASS.fillRaised;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {action.icon && <span style={{ fontSize: "14px" }}>{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        aria-haspopup={actions.length > 1}
        aria-expanded={open && actions.length > 1}
        onClick={actions.length > 1 ? toggle : actions[0]?.onChoose}
        disabled={actions.length === 0}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: RADIUS.round,
          border: "none",
          background: open ? ACCENT.pressed : ACCENT.base,
          color: TEXT.onAccent,
          fontSize: "20px",
          cursor: "pointer",
          boxShadow: ACCENT.ring,
          transition: `background ${MOTION.fast} ${MOTION.standard}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = ACCENT.hover;
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = ACCENT.base;
        }}
      >
        {icon}
      </button>
    </div>
  );
}
