import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { TYPE } from "@/design/tokens";

export function DevConsole() {
  const [logs] = useState<string[]>([]);
  const [role, setRole] = useState("athlete");
  return (
    <GlassCard style={{ padding: 20 }}>
      <h2 style={{ fontSize: TYPE.body.size, marginBottom: 12 }}>Dev Tools</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Ver como: </label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="athlete">Atleta</option>
          <option value="coach">Coach</option>
          <option value="admin">Admin</option>
          <option value="developer">Developer</option>
        </select>
      </div>
      <div style={{ maxHeight: 200, overflow: "auto", background: "transparent", padding: 8, borderRadius: 8 }}>
        {logs.length === 0 ? <span style={{ color: "inherit" }}>Sin logs</span> : logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </GlassCard>
  );
}