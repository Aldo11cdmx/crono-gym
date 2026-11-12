import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

interface AdminUser {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  roles: string[];
  granted_at: string | null;
}

export function UsersRolesManager() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("coach");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: profiles, error: profilesError }, { data: roleRows, error: rolesError }] = await Promise.all([
        (supabase as any).from("profiles").select("id,display_name,email,avatar_url"),
        (supabase as any).from("user_roles").select("user_id,role,granted_at"),
      ]);
      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;
      const rolesByUser = new Map<string, { roles: string[]; grantedAt: string | null }>();
      (roleRows ?? []).forEach((row: any) => {
        const existing = rolesByUser.get(row.user_id) ?? { roles: [], grantedAt: null };
        existing.roles.push(row.role);
        existing.grantedAt = row.granted_at ?? existing.grantedAt;
        rolesByUser.set(row.user_id, existing);
      });
      setUsers((profiles ?? []).map((profile: any) => ({
        user_id: profile.id,
        display_name: profile.display_name ?? null,
        email: profile.email ?? null,
        avatar_url: profile.avatar_url ?? null,
        roles: rolesByUser.get(profile.id)?.roles ?? [],
        granted_at: rolesByUser.get(profile.id)?.grantedAt ?? null,
      })));
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = useCallback(async () => {
    if (!email.trim()) return;
    setErr(null);
    setStatus(null);
    try {
      const { error } = await (supabase as any).rpc("grant_user_role", {
        target_email: email.trim(),
        new_role: role,
      });
      if (error) throw error;
      setEmail("");
      setStatus("Rol asignado");
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Error al asignar");
    }
  }, [email, role, load]);

  const revoke = useCallback(async (userId: string, targetRole: string) => {
    setErr(null);
    setStatus(null);
    const { error } = await (supabase as any).rpc("admin_revoke_role", {
      target_user_id: userId,
      target_role: targetRole,
    });
    if (error) {
      setErr(error.message);
      return;
    }
    setStatus("Rol revocado");
    await load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      `${user.display_name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(query),
    );
  }, [search, users]);

  if (loading) return <Skeleton variant="block" height="160px" />;

  return (
    <GlassCard style={{ padding: SPACE.lg }}>
      <h3 style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight, color: TEXT.primary, margin: `0 0 ${SPACE.md} 0` }}>
        Gestor de Usuarios y Roles
      </h3>
      <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap", marginBottom: SPACE.md }}>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email del usuario" style={{ flex: 1, minWidth: 240, padding: `8px ${SPACE.md}`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: GLASS.fill, color: TEXT.primary }} />
        <select value={role} onChange={(event) => setRole(event.target.value)} style={{ padding: `8px ${SPACE.md}`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: GLASS.fill, color: TEXT.primary }}>
          <option value="athlete">Atleta</option>
          <option value="coach">Entrenador</option>
          <option value="admin">Administrador</option>
        </select>
        <GlassButton variant="primary" onClick={() => void grant}>Asignar rol</GlassButton>
      </div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo" style={{ width: "100%", marginBottom: SPACE.md, padding: `8px ${SPACE.md}`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: GLASS.fill, color: TEXT.primary }} />
      {status && <p style={{ color: TEXT.secondary, margin: `0 0 ${SPACE.sm} 0` }}>{status}</p>}
      {err && <p style={{ color: TEXT.tertiary, margin: `0 0 ${SPACE.sm} 0` }}>{err}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
        {filteredUsers.map((user) => (
          <div key={user.user_id} style={{ display: "flex", alignItems: "center", gap: SPACE.sm, padding: `${SPACE.sm} ${SPACE.md}`, borderRadius: RADIUS.control, border: `1px solid ${GLASS.border}`, background: GLASS.fill }}>
            {user.avatar_url ? <img src={user.avatar_url} alt="" width={32} height={32} style={{ borderRadius: "9999px" }} /> : <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: "9999px", backgroundColor: GLASS.border }} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ display: "block", color: TEXT.primary }}>{user.display_name || "Sin nombre"}</strong>
              <span style={{ display: "block", color: TEXT.secondary, fontSize: TYPE.caption.size }}>{user.email || "Sin correo"}</span>
            </div>
            <div style={{ display: "flex", gap: SPACE.xs, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {user.roles.map((userRole) => <button key={userRole} type="button" onClick={() => void revoke(user.user_id, userRole)} title={`Revocar ${userRole}`} style={{ border: `1px solid ${GLASS.border}`, borderRadius: RADIUS.pill, background: GLASS.fill, color: TEXT.secondary, padding: "4px 8px", cursor: "pointer" }}>{userRole} ×</button>)}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
