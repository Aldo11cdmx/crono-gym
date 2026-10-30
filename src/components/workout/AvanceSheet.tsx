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
  exercise?: { name_es?: string; name?: string };
  history: HistoryEntry[];
}

const MOCK_HISTORY: HistoryEntry[] = [
  { date: "Hace 3 días", sets: [{ weight: 36, reps: 10 }, { weight: 38, reps: 8 }] },
  { date: "Hace 1 semana", sets: [{ weight: 34, reps: 10 }, { weight: 36, reps: 8 }] },
  { date: "Hace 2 semanas", sets: [{ weight: 32, reps: 12 }] },
  { date: "Hace 3 semanas", sets: [{ weight: 30, reps: 12 }, { weight: 32, reps: 10 }] },
  { date: "Hace 1 mes", sets: [{ weight: 28, reps: 12 }] },
];

export function AvanceSheet({ isOpen, onClose, exerciseName, exercise, history }: AvanceSheetProps) {
  if (!isOpen) return null;
  const name = exercise?.name_es || exercise?.name || exerciseName;
  const data = !history || history.length === 0 ? MOCK_HISTORY : history;
  const allSets = data.flatMap((h) => h.sets.map((s) => ({ weight: s.weight, reps: s.reps })));
  const best1RM = !history || history.length === 0 ? 48 : getBest1RM(allSets);
  const maxWeight = !history || history.length === 0 ? 40 : (allSets.length ? Math.max(...allSets.map((s) => s.weight)) : null);
  const totalVolume = !history || history.length === 0 ? 1440 : allSets.reduce((acc, s) => acc + s.weight * s.reps, 0);
  const recent = data.slice(-5).reverse();
  const points = [28, 30, 32, 34, 36, 38, 40];
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * 40 + 10},${80 - p}`).join(" ");

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
          <h3 style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, color: TEXT.primary }}>Avance · {name}</h3>
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
        <div style={{ marginTop: SPACE.md, padding: SPACE.sm, borderRadius: RADIUS.card, background: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}>
          <svg viewBox="0 0 250 90" width="100%" height="90" preserveAspectRatio="none">
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(239,68,68,0.2)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path d={`${path} L 250,90 L 10,90 Z`} fill="url(#grad)" />
            <path d={path} fill="none" stroke="#ef4444" strokeWidth="2" />
            {points.map((p, i) => (
              <circle key={i} cx={i * 40 + 10} cy={80 - p} r="3" fill="#ef4444" />
            ))}
          </svg>
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
        </div>
      </div>
    </div>
  );
}
