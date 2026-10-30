import { X } from "lucide-react";
import {
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SOLID,
  SPACE,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { findExerciseReplacements, type Exercise } from "@/lib/engines/exerciseReplacementEngine";

export interface CambiarSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentExercise: Exercise;
  availableEquipment: string[];
  exerciseCatalog: Exercise[];
  onReplace: (exercise: Exercise) => void;
}

export function CambiarSheet({ isOpen, onClose, currentExercise, availableEquipment, exerciseCatalog, onReplace }: CambiarSheetProps) {
  if (!isOpen) return null;
  const replacements = findExerciseReplacements({ currentExercise, availableEquipment, exerciseCatalog }).slice(0, 3);
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: Z_INDEX.sheet, display: "flex", alignItems: "flex-end", background: SCRIM.modal, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] overflow-y-auto pb-10"
        style={{ width: "100%", maxWidth: "560px", margin: "0 auto", display: "flex", flexDirection: "column", gap: SPACE.sm, padding: SPACE.card, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet, border: `1px solid ${GLASS.border}`, background: SOLID.popover, boxShadow: GLASS.shadow }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
          <h3 style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, color: TEXT.primary }}>Cambiar ejercicio</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "36px", minHeight: "36px", borderRadius: RADIUS.sm, border: `1px solid ${GLASS.border}`, background: "transparent", color: TEXT.tertiary, cursor: "pointer" }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
          {replacements.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => { onReplace(ex); onClose(); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: MOTION.minTouchTarget, padding: `${SPACE.sm} ${SPACE.md}`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: SURFACE.sunken, color: TEXT.primary, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>{ex.name}</span>
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{ex.equipment}</span>
            </button>
          ))}
          {replacements.length === 0 && <div style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>Sin alternativas disponibles.</div>}
        </div>
      </div>
    </div>
  );
}
