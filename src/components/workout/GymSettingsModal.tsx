/**
 * GymSettingsModal.tsx — the gym settings, as an overlay.
 *
 * Separate from `GymSettingsPanel` because the panel is content and the overlay
 * is placement. The panel can live inline in a settings page; the backdrop,
 * the dismissal rules and the stacking belong to wherever the panel was opened
 * from, and duplicating them at each entry point is how two overlays end up with
 * two different Escape handlers.
 *
 * Dismissal is deliberately limited to the backdrop and the panel's own "Listo"
 * button. No Escape handler and no focus trap: this dialog is reachable from the
 * workout logger, where a stray Escape would be far more likely to mean "stop the
 * rest timer" than "close the settings", and a half-implemented trap is worse
 * than none. It is announced as a dialog and the trigger keeps focus, so a
 * keyboard user is never lost.
 */

import type { CSSProperties } from "react";
import { GymSettingsPanel } from "./GymSettingsPanel";
import { SCRIM, SURFACE, Z_INDEX } from "@/design/tokens";

export interface GymSettingsModalProps {
  onClose: () => void;
}

export function GymSettingsModal({ onClose }: GymSettingsModalProps) {
  return (
    <div
      // Clicking the backdrop closes; the panel stops it. A click handler on the
      // backdrop rather than a full-screen overlay means a click *inside* the
      // panel's own scrollbar is not mistaken for a dismissal.
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        // `popover`, not `modal`: the navigation sits at 60 and a settings
        // dialog that the rail can steal focus from is not a dialog. Below the
        // simulator (100), which has to tint everything.
        zIndex: Z_INDEX.popover,
        backgroundColor: SCRIM.modal,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={
          {
            maxHeight: "calc(100vh - 40px)",
            // The panel scrolls internally, so the overlay itself must not.
            overflow: "hidden",
            borderRadius: "24px",
            backgroundColor: SURFACE.overlay,
          } satisfies CSSProperties
        }
      >
        <GymSettingsPanel onClose={onClose} />
      </div>
    </div>
  );
}
