import { Shield } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { ACCENT, SPACE, TEXT, TYPE } from "@/design/tokens";

export function AdminHub() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, padding: SPACE.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.md }}>
        <Shield size={24} strokeWidth={2} color={ACCENT.base} />
        <h1 style={{ fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary, margin: 0 }}>
          Panel de Administración
        </h1>
      </div>
      <GlassCard style={{ padding: SPACE.lg, minHeight: 200 }} />
    </div>
  );
}
