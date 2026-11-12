import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { coachEcosystemService } from "@/lib/coach/coachEcosystemService";

type RequestRow = {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  notes: string;
  status: string;
};

export function ExerciseRequestsManager() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await coachEcosystemService.loadAllExerciseRequests();
      setRows(data.map((row) => ({ id: row.id, name: row.name, body_part: row.bodyPart, equipment: row.equipment, notes: row.notes, status: row.status })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las solicitudes");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const approve = async (row: RequestRow) => {
    const { error: insertError } = await (supabase as any).from("exercises").insert({
      id: crypto.randomUUID(),
      name: row.name,
      name_es: row.name,
      body_part: row.body_part || "general",
      target: row.body_part || "general",
      equipment: row.equipment || "Gym",
      gif_url: "",
      instructions: row.notes ? [row.notes] : [],
      is_active: true,
      is_hidden: false,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    const { error: updateError } = await (supabase as any)
      .from("coach_exercise_requests")
      .update({ status: "approved" })
      .eq("id", row.id);
    if (updateError) setError(updateError.message);
    else setRows((current) => current.filter((item) => item.id !== row.id));
  };

  return (
    <GlassCard style={{ padding: 16 }}>
      <h3 style={{ margin: 0, color: "white" }}>Solicitudes de Ejercicios de Coaches</h3>
      {error && <p role="alert" style={{ color: "#FF8A80" }}>{error}</p>}
      {rows.length === 0 ? <p style={{ color: "#A1A1AA" }}>No hay solicitudes pendientes.</p> : rows.map((row) => (
        <div key={row.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#2C2C2E" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ display: "block", color: "white" }}>{row.name}</strong>
            <span style={{ display: "block", color: "#A1A1AA", fontSize: 12 }}>{row.body_part} · {row.equipment}</span>
            {row.notes && <span style={{ display: "block", color: "#A1A1AA", fontSize: 12 }}>{row.notes}</span>}
          </div>
          <button type="button" onClick={() => void approve(row)} style={{ minHeight: 44, border: 0, borderRadius: 12, padding: "0 12px", backgroundColor: "#30D158", color: "#000", fontWeight: 700 }}>
            Aprobar y Agregar al Catálogo
          </button>
        </div>
      ))}
    </GlassCard>
  );
}
