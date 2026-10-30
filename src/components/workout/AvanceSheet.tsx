import { X } from "lucide-react";
import {
  GLASS,
  RADIUS,
  SCRIM,
  SOLID,
  SPACE,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { getBest1RM } from "@/lib/engines/prCalculatorEngine";

export interface HistoryEntry {
  date: string;
  sets: { weight: number; reps: number }[];
}

export interface AvanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  history: HistoryEntry[];
}

export function AvanceSheet({ isOpen, onClose, exerciseName, history }: AvanceSheetProps) {
  if (!isOpen) return null;
  const allSets = history.flatMap((h) => h.sets.map((s) => ({ weight: s.weight, reps: s.reps })));
  const best1RM = getBest1RM(allSets);
  const maxWeight = allSets.length ? Math.max(...allSets.map((s) => s.weight)) : null;
  const totalVolume = allSets.reduce((acc, s) => acc + s.weight * s.reps, 0);
  const recent = history.slice(-5).reverse();

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
          <h3 style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, color: TEXT.primary }}>Avance · {exerciseName}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "36px", minHeight: "36px", borderRadius: RADIUS.sm, border: `1px solid ${GLASS.border}`, background: "transparent", color: TEXT.tertiary, cursor: "pointer" }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: SPACE.sm }}>
          <div style={{ padding: SPACE.md, borderRadius: RADIUS.card, background: SURFACE.sunken, border: `1px solid ${GLASS.border}`, textAlign: "center" }}>
            <div style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>1RM est.</div>
            <div style={{ fontSize: TYPE.title2.size, fontWeight: 700, color: TEXT.primary }}>{best1RM ?? "—"} kg</div>
          </div>
          <div style={{ padding: SPACE.md, borderRadius: RADIUS.card, background: SURFACE.sunken, border: `1px solid ${GLASS.border}`, textAlign: "center" }}>
            <div style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>Peso máx.</div>
            <div style={{ fontSize: TYPE.title2.size, fontWeight: 700, color: TEXT.primary }}>{maxWeight ?? "—"} kg</div>
          </div>
          <div style={{ padding: SPACE.md, borderRadius: RADIUS.card, background: SURFACE.sunken, border: `1px solid ${GLASS.border}`, textAlign: "center" }}>
            <div style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>Volumen total</div>
            <div style={{ fontSize: TYPE.title2.size, fontWeight: 700, color: TEXT.primary }}>{totalVolume} kg</div>
          </div>
        </div>
        <h4 style={{ margin: `${SPACE.md} 0 ${SPACE.xs}`, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>Últimas sesiones</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
          {recent.map((h, i) => (
            <div key={i} style={{ padding: SPACE.sm, borderRadius: RADIUS.control, background: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}>
              <div style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{h.date}</div>
              <div style={{ fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                {h.sets.map((s) => `${s.weight}×${s.reps}`).join(" · ")}
              </div>
            </div>
          ))}
          {recent.length === 0 && <div style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>Sin historial aún.</div>}
        </div>
      </div>
    </div>
  );
}
