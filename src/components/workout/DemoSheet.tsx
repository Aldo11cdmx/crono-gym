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

export interface DemoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  exercise?: { name_es?: string; name?: string; gif_url?: string; gifUrl?: string; target?: string };
  primaryMuscle: string;
  secondaryMuscles?: string[];
}

const STEPS = [
  { n: 1, title: "Posición inicial", body: "Postura estable, core activo, mirada al frente." },
  { n: 2, title: "Fase concéntrica", body: "Ejecuta el movimiento controlado sin impulso." },
  { n: 3, title: "Tip de seguridad", body: "No bloquees articulaciones; detente si hay dolor." },
];

export function DemoSheet({ isOpen, onClose, exerciseName, exercise, primaryMuscle, secondaryMuscles = [] }: DemoSheetProps) {
  if (!isOpen) return null;
  const name = exercise?.name_es || exercise?.name || exerciseName;
  const gif = exercise?.gif_url || exercise?.gifUrl;
  const translateMuscle = (m: string) => (m === "abs" ? "Abdominales" : m);
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
          <h3 style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, color: TEXT.primary }}>{name}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "36px", minHeight: "36px", borderRadius: RADIUS.sm, border: `1px solid ${GLASS.border}`, background: "transparent", color: TEXT.tertiary, cursor: "pointer" }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div style={{ borderRadius: RADIUS.card, background: SURFACE.sunken, border: `1px solid ${GLASS.border}`, padding: SPACE.md, minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {gif ? (
            <img src={gif} alt={name} className="h-full w-full object-contain mx-auto" style={{ filter: "invert(1) hue-rotate(180deg) contrast(125%) brightness(110%)" }} />
          ) : (
            <span style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>Animación del ejercicio</span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs, marginTop: SPACE.sm }}>
          <span style={{ padding: `4px 10px`, borderRadius: RADIUS.pill, background: "rgba(255,255,255,0.05)", border: `1px solid ${GLASS.border}`, color: TEXT.primary, fontSize: TYPE.caption.size }}>Primario: {translateMuscle(primaryMuscle)}</span>
          {secondaryMuscles.map((m) => (
            <span key={m} style={{ padding: `4px 10px`, borderRadius: RADIUS.pill, background: "rgba(255,255,255,0.05)", border: `1px solid ${GLASS.border}`, color: TEXT.secondary, fontSize: TYPE.caption.size }}>{translateMuscle(m)}</span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm, marginTop: SPACE.md }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: SPACE.sm, alignItems: "flex-start" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: RADIUS.round, background: SURFACE.sunken, color: TEXT.primary, fontSize: TYPE.caption.size, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
              <div>
                <div style={{ fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>{s.title}</div>
                <div style={{ fontSize: TYPE.caption.size, color: TEXT.secondary }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
