import { type ReactNode } from "react";
import { useAuthModal } from "@/context/AuthModalContext";
import { useNavigate } from "react-router-dom";
import { RoleGate } from "./RoleGate";
import { GlassButton, GlassCard } from "@/components/ui";
import { ACCENT, SPACE, TEXT, TYPE } from "@/design/tokens";
import { Lock } from "lucide-react";

export interface AdminGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminGate({ children, fallback }: AdminGateProps) {
  const navigate = useNavigate();
  const authModal = useAuthModal();
  const denied =
    fallback ?? (
      <div style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: SPACE.lg }}>
        <GlassCard style={{ padding: SPACE.lg, maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, alignItems: "center" }}>
            <Lock size={40} color={ACCENT.base} />
            <h2 style={{ fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary, margin: 0 }}>
              Acceso Denegado
            </h2>
            <p style={{ fontSize: TYPE.body.size, color: TEXT.secondary, margin: 0 }}>
              Área de Administración. Requiere rol de administrador.
            </p>
            <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap", justifyContent: "center" }}>
              <GlassButton variant="primary" onClick={() => authModal.open()}>
                Iniciar sesión como Admin
              </GlassButton>
              <GlassButton variant="ghost" onClick={() => navigate("/")}>
                Volver al Inicio
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  return <RoleGate allow={["admin"]} fallback={denied}>{children}</RoleGate>;
}