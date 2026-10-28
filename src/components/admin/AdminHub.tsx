import { useState } from "react";
import { Shield } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { ACCENT, SPACE, TEXT, TYPE } from "@/design/tokens";
import { AnnouncementsManager } from "./sections/AnnouncementsManager";
import { StoreManager } from "./sections/StoreManager";
import { ClassesManager } from "./sections/ClassesManager";
import { UsersRolesManager } from "./sections/UsersRolesManager";

const TABS = ["avisos", "tienda", "clases", "usuarios"] as const;

export function AdminHub() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("avisos");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, padding: SPACE.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.md }}>
        <Shield size={24} strokeWidth={2} color={ACCENT.base} />
        <h1 style={{ fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary, margin: 0 }}>
          Panel de Administración
        </h1>
      </div>
      <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: `${SPACE.xs} ${SPACE.md}`, borderRadius: 12, border: "1px solid transparent", background: tab === t ? "rgba(255,255,255,0.08)" : "transparent", color: tab === t ? TEXT.primary : TEXT.secondary, textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>
      <GlassCard style={{ padding: SPACE.lg }}>
        {tab === "avisos" && <AnnouncementsManager />}
        {tab === "tienda" && <StoreManager />}
        {tab === "clases" && <ClassesManager />}
        {tab === "usuarios" && <UsersRolesManager />}
      </GlassCard>
    </div>
  );
}
