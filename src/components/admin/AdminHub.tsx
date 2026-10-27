/**
 * AdminHub.tsx — `/admin`, el panel de administración de Cronos.
 *
 * Renderizado solo para cuentas con rol `admin` (vía `AdminGate` → `RoleGate`).
 * Tres secciones en tarjetas Glass:
 *
 *  1. Anuncios del sistema — listar y crear anuncios activos.
 *  2. Usuarios y roles — tabla de `user_roles` y formulario para asignar roles.
 *  3. Estado del sistema — conteo de roles y premium.
 *
 * Todos los datos leídos por el cliente respetan RLS: `user_roles` es legible
 * por admin/developer (política extendida en `20261026020000`), `announcements`
 * es escribible por admin (`announcements_admin_write`), y `profiles` solo se
 * lee propia (por lo que el resumen premium es del usuario actual).
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/i18n";
import { ACCENT, DANGER, GLASS, RADIUS, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";

type RoleChip = "athlete" | "coach" | "admin" | "developer";

const ROLE_COLOR: Record<RoleChip, string> = {
  athlete: STATUS.comeback.base,
  coach: STATUS.progression.base,
  admin: STATUS.pr.base,
  developer: STATUS.pr.base,
};

interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  kind: "promo" | "notice" | "event";
  expires_at: string;
  created_at: string;
}

interface UserRoleRow {
  user_id: string;
  role: RoleChip;
  granted_by: string | null;
  granted_at: string;
}

function sectionTitle(): React.CSSProperties {
  return {
    fontSize: TYPE.subhead.size,
    fontWeight: TYPE.subhead.weight,
    letterSpacing: TYPE.subhead.tracking,
    color: TEXT.secondary,
    marginBottom: SPACE.md,
    textTransform: "uppercase",
  };
}

function statCard(label: string, value: string | number): JSX.Element {
  return (
    <GlassCard style={{ padding: SPACE.md, minWidth: 140 }}>
      <p style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, marginBottom: SPACE.xs, textTransform: "uppercase", letterSpacing: TYPE.subhead.tracking }}>
        {label}
      </p>
      <p style={{ fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary, margin: 0 }}>
        {value}
      </p>
    </GlassCard>
  );
}

export function AdminHub() {
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newKind, setNewKind] = useState<"promo" | "notice" | "event">("notice");
  const [grantEmail, setGrantEmail] = useState("");
  const [grantRole, setGrantRole] = useState<RoleChip>("coach");
  const [status, setStatus] = useState<{ message: string; kind: "ok" | "error" } | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setErrMsg(null);

        const [rolesRes, announcementsRes] = await Promise.all([
          (supabase as any).from("user_roles").select("*").order("granted_at", { ascending: false }),
          (supabase as any)
            .from("announcements")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (!mounted) return;

        if (rolesRes.error) throw rolesRes.error;
        if (announcementsRes.error) throw announcementsRes.error;

        setUserRoles((rolesRes.data ?? []) as UserRoleRow[]);
        setAnnouncements((announcementsRes.data ?? []) as AnnouncementRow[]);
      } catch (err) {
        if (!mounted) return;
        setErrMsg(err instanceof Error ? err.message : "Error al cargar el panel");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCreateAnnouncement = useCallback(async () => {
    if (!newTitle.trim() || !newMessage.trim()) return;
    setErrMsg(null);
    try {
      const { error } = await (supabase as any).from("announcements").insert({
        title: newTitle.trim(),
        message: newMessage.trim(),
        kind: newKind,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      if (error) throw error;
      setNewTitle("");
      setNewMessage("");
      setStatus({ message: "Anuncio creado", kind: "ok" });
      const { data, error: refreshError } = await (supabase as any)
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (!refreshError && data) setAnnouncements(data as AnnouncementRow[]);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Error al crear anuncio");
      setStatus(null);
    }
  }, [newTitle, newMessage, newKind]);

  const handleGrantRole = useCallback(async () => {
    if (!grantEmail.trim()) return;
    setErrMsg(null);
    try {
      const { error } = await (supabase as any).rpc("grant_user_role", {
        target_email: grantEmail.trim(),
        new_role: grantRole,
      });
      if (error) throw error;
      setGrantEmail("");
      setStatus({ message: `Rol asignado a ${grantEmail}`, kind: "ok" });
      const { data, error: refreshError } = await (supabase as any)
        .from("user_roles")
        .select("*")
        .order("granted_at", { ascending: false });
      if (!refreshError && data) setUserRoles(data as UserRoleRow[]);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Error al asignar rol");
      setStatus(null);
    }
  }, [grantEmail, grantRole]);

  const premiumCount = userRoles.filter((r) => r.role === "athlete").length;
  const coachCount = userRoles.filter((r) => r.role === "coach").length;
  const adminCount = userRoles.filter((r) => r.role === "admin").length;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, padding: SPACE.lg }}>
        <h2 style={{ fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary, margin: 0 }}>
          Panel de Administración
        </h2>
        <GlassCard style={{ padding: SPACE.lg }}>
          <Skeleton variant="block" height="20px" width="40%" style={{ marginBottom: SPACE.md }} />
          <Skeleton variant="block" height="16px" width="80%" style={{ marginBottom: SPACE.md }} />
          <Skeleton variant="block" height="16px" width="60%" />
          <Skeleton variant="block" height="16px" width="100%" style={{ marginTop: SPACE.md }} />
        </GlassCard>
      </div>
    );
  }

  if (errMsg) {
    return (
      <GlassCard style={{ padding: SPACE.lg, borderColor: DANGER.border }}>
        <h2 style={{ fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary, margin: 0 }}>
          Error
        </h2>
        <p style={{ color: TEXT.secondary, margin: `${SPACE.xs} 0 ${SPACE.md} 0` }}>{errMsg}</p>
        <GlassButton variant="ghost" onClick={() => window.location.reload()}>
          <ArrowRight size={16} /> Reintentar
        </GlassButton>
      </GlassCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, padding: SPACE.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.md }}>
        <Shield size={24} strokeWidth={2} color={ACCENT.base} />
        <h1 style={{ fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary, margin: 0 }}>
          Panel de Administración
        </h1>
      </div>

      {status && (
        <p
          style={{
            margin: `0 0 ${SPACE.lg} 0`,
            padding: `${SPACE.xs} ${SPACE.md}`,
            borderRadius: RADIUS.control,
            background: status.kind === "ok" ? GLASS.fill : DANGER.muted,
            color: status.kind === "ok" ? TEXT.primary : DANGER.text,
            fontSize: TYPE.caption.size,
          }}
        >
          {status.message}
        </p>
      )}

      {/* ------------------------------------------------------- anuncios */}
      <GlassCard>
        <p style={sectionTitle()} />
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
          <div style={{ display: "flex", gap: SPACE.sm, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título del anuncio"
              style={{
                flex: 1,
                minWidth: 180,
                padding: `8px ${SPACE.md}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: GLASS.fill,
                color: TEXT.primary,
                fontSize: TYPE.body.size,
              }}
            />
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as "promo" | "notice" | "event")}
              style={{
                minWidth: 140,
                padding: `8px ${SPACE.md}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: GLASS.fill,
                color: TEXT.primary,
                fontSize: TYPE.body.size,
              }}
            >
              <option value="notice">Aviso</option>
              <option value="promo">Promoción</option>
              <option value="event">Evento</option>
            </select>
            <GlassButton variant="primary" onClick={handleCreateAnnouncement} disabled={!newTitle.trim()}>
              Crear
            </GlassButton>
          </div>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mensaje del anuncio"
            rows={2}
            style={{
              width: "100%",
              minHeight: 80,
              padding: `${SPACE.sm} ${SPACE.md}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
              color: TEXT.primary,
              fontSize: TYPE.body.size,
              resize: "vertical",
            }}
          />
        </div>
        <div style={{ marginTop: SPACE.md }}>
          {announcements.length === 0 ? (
            <p style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size, margin: 0 }}>
              No hay anuncios activos.
            </p>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `${SPACE.xs} 0`,
                  borderTop: `1px solid ${GLASS.border}`,
                }}
              >
                <div>
                  <p style={{ fontSize: TYPE.body.size, fontWeight: 600, color: TEXT.primary, margin: 0 }}>
                    {a.title}
                  </p>
                  <p style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, margin: `${SPACE.xs} 0 0 0` }}>
                    {a.message}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: TYPE.caption.size,
                    color: TEXT.tertiary,
                    background: GLASS.fill,
                    padding: `2px 8px`,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${GLASS.border}`,
                  }}
                >
                  {a.kind}
                </span>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      {/* ------------------------------------------------------- roles */}
      <GlassCard>
        <p style={sectionTitle()} />
        <div style={{ display: "flex", gap: SPACE.sm, alignItems: "center", flexWrap: "wrap", marginBottom: SPACE.md }}>
          <input
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            placeholder={ROLE_LABELS.emailPlaceholder}
            style={{
              flex: 1,
              minWidth: 220,
              padding: `8px ${SPACE.md}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
              color: TEXT.primary,
              fontSize: TYPE.body.size,
            }}
          />
          <select
            value={grantRole}
            onChange={(e) => setGrantRole(e.target.value as RoleChip)}
            style={{
              minWidth: 140,
              padding: `8px ${SPACE.md}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
              color: TEXT.primary,
              fontSize: TYPE.body.size,
            }}
          >
            <option value="athlete">{ROLE_LABELS.athlete}</option>
            <option value="coach">{ROLE_LABELS.coach}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
          <GlassButton variant="primary" onClick={handleGrantRole} disabled={!grantEmail.trim()}>
            {ROLE_LABELS.grant}
          </GlassButton>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPE.body.size }}>
            <thead>
              <tr style={{ textAlign: "left", color: TEXT.tertiary, borderBottom: `1px solid ${GLASS.border}` }}>
                <th style={{ padding: `${SPACE.xs} 0` }}>{ROLE_LABELS.userId}</th>
                <th style={{ padding: `${SPACE.xs} 0`, width: 120 }}>{ROLE_LABELS.roleCol}</th>
                <th style={{ padding: `${SPACE.xs} 0`, width: 140 }}>{ROLE_LABELS.grantedAt}</th>
              </tr>
            </thead>
            <tbody>
              {userRoles.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      padding: SPACE.md,
                      color: TEXT.tertiary,
                      textAlign: "center",
                    }}
                  >
                    {ROLE_LABELS.listEmpty}
                  </td>
                </tr>
              ) : (
                userRoles.map((r) => (
                  <tr
                    key={r.user_id}
                    style={{ borderBottom: `1px solid ${GLASS.border}`, padding: `${SPACE.xs} 0` }}
                  >
                    <td style={{ color: TEXT.primary }}>{r.user_id}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: SPACE.xs,
                          fontSize: TYPE.caption.size,
                          fontWeight: 600,
                          color: ROLE_COLOR[r.role],
                          background: GLASS.fill,
                          padding: `2px 8px`,
                          borderRadius: RADIUS.control,
                          border: `1px solid ${GLASS.border}`,
                        }}
                      >
                        {r.role}
                      </span>
                    </td>
                    <td style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>
                      {new Date(r.granted_at).toLocaleDateString("es-ES")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* ------------------------------------------------------- sistema */}
      <GlassCard>
        <p style={sectionTitle()} />
        <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
          {statCard("Atletas", premiumCount)}
          {statCard("Coaches", coachCount)}
          {statCard("Administradores", adminCount)}
          {statCard("Anuncios activos", announcements.length)}
        </div>
      </GlassCard>
    </div>
  );
}
