import { X } from "lucide-react";
import { useState } from "react";
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

export interface AjustarSheetProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentName: string;
  equipmentImage?: string;
  notes: string;
  onNotesChange: (v: string) => void;
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: SPACE.sm, borderRadius: RADIUS.control, background: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}>
      <span style={{ color: TEXT.primary, fontSize: TYPE.subhead.size }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
        <button type="button" onClick={() => onChange(value - 1)} style={{ minWidth: MOTION.minTouchTarget, minHeight: MOTION.minTouchTarget, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: "transparent", color: TEXT.primary, cursor: "pointer" }}>-</button>
        <span style={{ minWidth: "24px", textAlign: "center", color: TEXT.primary, fontSize: TYPE.subhead.size, fontWeight: 600 }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} style={{ minWidth: MOTION.minTouchTarget, minHeight: MOTION.minTouchTarget, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: "transparent", color: TEXT.primary, cursor: "pointer" }}>+</button>
      </div>
    </div>
  );
}

export function AjustarSheet({ isOpen, onClose, equipmentName, equipmentImage, notes, onNotesChange }: AjustarSheetProps) {
  const [seat, setSeat] = useState(0);
  const [incline, setIncline] = useState(0);
  const [pin, setPin] = useState(0);
  if (!isOpen) return null;
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
          <h3 style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, color: TEXT.primary }}>Ajustar · {equipmentName}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "36px", minHeight: "36px", borderRadius: RADIUS.sm, border: `1px solid ${GLASS.border}`, background: "transparent", color: TEXT.tertiary, cursor: "pointer" }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {equipmentImage && <img src={equipmentImage} alt={equipmentName} style={{ width: "100%", borderRadius: RADIUS.card, objectFit: "cover", maxHeight: "160px" }} />}
        <Stepper label="Altura de asiento" value={seat} onChange={setSeat} />
        <Stepper label="Inclinación del banco" value={incline} onChange={setIncline} />
        <Stepper label="Pin de polea / carga inicial" value={pin} onChange={setPin} />
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Notas de la máquina (ej. usar agarre ancho en nivel 4)"
          style={{ width: "100%", minHeight: "80px", padding: SPACE.sm, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: SURFACE.sunken, color: TEXT.primary, fontSize: TYPE.subhead.size, resize: "vertical" }}
        />
      </div>
    </div>
  );
}
