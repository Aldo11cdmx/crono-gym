import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  DANGER,
  GLASS,
  RADIUS,
  SPACE,
  TEXT,
  TYPE,
} from "@/design/tokens";

export interface RecoverableDraftSectionProps {
  onContinue: () => void;
  onDiscard: () => void;
  routineTitle?: string | null;
}

export function RecoverableDraftSection({
  onContinue,
  onDiscard,
  routineTitle,
}: RecoverableDraftSectionProps) {
  const [confirm, setConfirm] = useState(false);
  const title = routineTitle?.trim() ? routineTitle : "Entrenamiento";
  return (
    <GlassCard
      raised
      style={{
        padding: SPACE.card,
        border: `1px solid ${DANGER.base}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} color={DANGER.base} />
        <span style={{ ...TYPE.subhead, color: TEXT.primary }}>Sesión interrumpida</span>
      </div>
      <p style={{ ...TYPE.body, color: TEXT.secondary, marginBottom: SPACE.sm }}>
        Tienes un entrenamiento sin finalizar: <strong>{title}</strong>. ¿Deseas continuar o descartar?
      </p>
      <div className="flex gap-2">
        <GlassButton variant="primary" onClick={onContinue}>
          Recuperar entrenamiento
        </GlassButton>
        <GlassButton variant="destructive" onClick={() => setConfirm(true)}>
          Descartar
        </GlassButton>
      </div>
      {confirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            marginTop: SPACE.sm,
            padding: SPACE.card,
            borderRadius: RADIUS.card,
            background: GLASS.fill,
          }}
        >
          <p style={{ ...TYPE.body, color: TEXT.primary, marginBottom: SPACE.sm }}>
            Se perdera el progreso no sincronizado. ¿Confirmar descarte?
          </p>
          <div className="flex gap-2">
            <GlassButton variant="destructive" onClick={onDiscard}>
              Confirmar descarte
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </GlassButton>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
