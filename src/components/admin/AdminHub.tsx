import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

export function AdminHub() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"promo" | "notice" | "event">("notice");
  const [expires, setExpires] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    const { error } = await (supabase as any).from("announcements").insert({
      title,
      message,
      kind,
      expires_at: expires || new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    setStatus(error ? error.message : "Creado");
  }

  return (
    <GlassCard style={{ padding: 20 }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Admin Ã‚Â· Anuncios</h2>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="TÃƒÂ­tulo" style={{ width: "100%", marginBottom: 8 }} />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensaje" style={{ width: "100%", marginBottom: 8 }} />
      <select value={kind} onChange={(e) => setKind(e.target.value as any)} style={{ marginBottom: 8 }}>
        <option value="promo">PromociÃƒÂ³n</option>
        <option value="notice">Aviso</option>
        <option value="event">Evento</option>
      </select>
      <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} style={{ marginBottom: 8 }} />
      <GlassButton variant="primary" onClick={submit}>Crear</GlassButton>
      {status && <p style={{ marginTop: 8 }}>{status}</p>}
    </GlassCard>
  );
}