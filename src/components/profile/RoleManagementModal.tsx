/**
 * RoleManagementModal.tsx — modal para ascender o degradar usuarios por correo.
 *
 * Solo accesible a cuentas con rol `developer` o `admin`. La escritura pasa
 * por el RPC `grant_user_role` (seguridad en el servidor: RLS + el propio RPC
 * verifican que el actor sea developer o admin). La lista de coaches y
 * administradores se lee de `public.user_roles`, a la que ahora pueden leer
 * completo developer y admin.
 */

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { supabase } from "@lib/supabase";
import { GlassButton, GlassCard } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/i18n";
import {
  DANGER,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";

type GrantRole = "athlete" | "coach" | "admin";

const ROLE_TO_LABEL: Record<GrantRole, string> = {
  athlete: ROLE_LABELS.athlete,
  coach: ROLE_LABELS.coach,
  admin: ROLE_LABELS.admin,
};

const ROLE_TO_COLOR: Record<GrantRole, string> = {
  athlete: STATUS.comeback.base,
  coach: STATUS.progression.base,
  admin: STATUS.pr.base,
};

export interface RoleManagementModalProps {
  open: boolean;
  onClose: () => void;
}

export function RoleManagementModal({ open, onClose }: RoleManagementModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GrantRole>("athlete");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [roster, setRoster] = useState<{ user_id: string; role: string; granted_at: string }[]>(
    [],
  );
  const [editing, setEditing] = useState<{ user_id: string; role: string } | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<GrantRole>("athlete");
  const [editLoading, setEditLoading] = useState(false);

  const loadRoster = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role, granted_at")
      .in("role", ["coach", "admin"])
      .order("granted_at", { ascending: false });
    if (error) {
      setMessage(error.message);
      setStatus("error");
      setRoster([]);
      return;
    }
    setRoster((data ?? []) as { user_id: string; role: string; granted_at: string }[]);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadRoster();
  }, [open, loadRoster]);

  const assignRole = useCallback(
    async (targetEmail: string, newRole: GrantRole, isEdit: boolean) => {
      if (isEdit) setEditLoading(true);
      else setLoading(true);
      setStatus("idle");
      setMessage("");
      try {
        const { error } = await (supabase as any).rpc("grant_user_role", {
          target_email: targetEmail,
          new_role: newRole,
        });
        if (error) throw error;
        setStatus("success");
        setMessage(ROLE_LABELS.successMsg(newRole));
        if (!isEdit) {
          setEmail("");
          setRole("athlete");
        } else {
          setEditing(null);
          setEditEmail("");
          setEditRole("athlete");
        }
        void loadRoster();
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : ROLE_LABELS.error,
        );
      } finally {
        if (isEdit) setEditLoading(false);
        else setLoading(false);
      }
    },
    [loadRoster],
  );

  const handleGrant = () => {
    void assignRole(email, role, false);
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    void assignRole(editEmail, editRole, true);
  };

  const shortId = (userId: string) => `…${userId.slice(-8)}`;

  if (!open) return null;

  return (
    <GlassCard
      raised
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 90,
        padding: SPACE.lg,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: SPACE.card,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.md, marginBottom: SPACE.lg }}>
          <h2
            style={{
              margin: 0,
              fontSize: TYPE.title2.size,
              lineHeight: TYPE.title2.lineHeight,
              fontWeight: TYPE.title2.weight,
              color: TEXT.primary,
            }}
          >
            {ROLE_LABELS.title}
          </h2>
          <GlassButton
            variant="ghost"
            icon={<X size={18} aria-hidden="true" />}
            onClick={onClose}
            aria-label="Cerrar"
          />
        </div>

        <p
          style={{
            margin: `0 0 ${SPACE.lg}`,
            fontSize: TYPE.callout.size,
            lineHeight: TYPE.callout.lineHeight,
            color: TEXT.secondary,
          }}
        >
          {ROLE_LABELS.subtitle}
        </p>

        {/* ------------------------------------------------------- form */}
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, marginBottom: SPACE.lg }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: SPACE.xs,
                fontSize: TYPE.label.size,
                fontWeight: 600,
                letterSpacing: TYPE.label.tracking,
                textTransform: "uppercase",
                color: TEXT.tertiary,
              }}
            >
              {ROLE_LABELS.emailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={ROLE_LABELS.emailPlaceholder}
              disabled={loading}
              style={inputStyle}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: SPACE.xs,
                fontSize: TYPE.label.size,
                fontWeight: 600,
                letterSpacing: TYPE.label.tracking,
                textTransform: "uppercase",
                color: TEXT.tertiary,
              }}
            >
              {ROLE_LABELS.roleLabel}
            </label>
            <div
              role="radiogroup"
              aria-label={ROLE_LABELS.roleLabel}
              style={{ display: "flex", gap: SPACE.xs }}
            >
              {(["athlete", "coach", "admin"] as GrantRole[]).map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRole(r)}
                    style={chipStyle(active, ROLE_TO_COLOR[r])}
                  >
                    {ROLE_TO_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </div>
          <GlassButton
            variant="primary"
            block
            disabled={loading || !email}
            onClick={handleGrant}
            style={{ minHeight: MOTION.minTouchTarget }}
          >
            {loading ? ROLE_LABELS.granting : ROLE_LABELS.grant}
          </GlassButton>
        </div>

        {/* ----------------------------------------------------- feedback */}
        {status !== "idle" && message && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: `${SPACE.sm} ${SPACE.md}`,
              borderRadius: RADIUS.control,
              marginBottom: SPACE.lg,
              backgroundColor:
                status === "success"
                  ? STATUS.success.muted
                  : DANGER.muted,
              color: status === "success" ? STATUS.success.text : DANGER.text,
              border: `1px solid ${
                status === "success" ? STATUS.success.border : DANGER.border
              }`,
              fontSize: TYPE.caption.size,
              lineHeight: TYPE.caption.lineHeight,
              display: "flex",
              alignItems: "center",
              gap: SPACE.xs,
            }}
          >
            {status === "success" ? ROLE_LABELS.success : ROLE_LABELS.error}
            <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
              {message}
            </span>
          </div>
        )}

        {/* ---------------------------------------------------- roster */}
        <h3
          style={{
            margin: `0 0 ${SPACE.md}`,
            fontSize: TYPE.subhead.size,
            lineHeight: TYPE.subhead.lineHeight,
            fontWeight: TYPE.subhead.weight,
            color: TEXT.primary,
          }}
        >
          {ROLE_LABELS.listTitle}
        </h3>

        {roster.length === 0 ? (
          <p style={{ ...mutedStyle, color: TEXT.tertiary }}>{ROLE_LABELS.listEmpty}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
            {roster.map((row) => {
              const isEditing = editing?.user_id === row.user_id;
              const rowRole = row.role as GrantRole;
              const rowColor = rowColorFor(row.role);
              return (
                <div
                  key={row.user_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: SPACE.md,
                    padding: `${SPACE.sm} ${SPACE.md}`,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${GLASS.border}`,
                    backgroundColor: GLASS.fill,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: TYPE.body.size,
                        color: TEXT.primary,
                        fontVariantNumeric: "tabular-nums",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={row.user_id}
                    >
                      {shortId(row.user_id)}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 1,
                        fontSize: TYPE.caption.size,
                        color: TEXT.tertiary,
                      }}
                    >
                      {row.granted_at}
                    </span>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: SPACE.xs,
                      padding: "2px 8px",
                      borderRadius: RADIUS.pill,
                      border: `1px solid ${rowColor}`,
                      backgroundColor: isEditing ? "transparent" : roleChipBg(rowColor),
                      color: isEditing ? TEXT.primary : roleChipText(),
                      fontSize: TYPE.caption.size,
                      fontWeight: 600,
                      letterSpacing: TYPE.label.tracking,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {isEditing ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as GrantRole)}
                        disabled={editLoading}
                        style={selectStyle}
                      >
                        {(["athlete", "coach", "admin"] as GrantRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_TO_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      rowRole === "admin" ? ROLE_LABELS.admin : rowRole === "coach" ? ROLE_LABELS.coach : ROLE_LABELS.athlete
                    )}
                  </span>
                  {isEditing ? (
                    <>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder={ROLE_LABELS.emailPlaceholder}
                        disabled={editLoading}
                        style={inputStyle}
                      />
                      <GlassButton
                        variant="ghost"
                        disabled={editLoading || !editEmail}
                        onClick={handleSaveEdit}
                        style={{ minHeight: 36, padding: "0 12px" }}
                      >
                        {ROLE_LABELS.save}
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        disabled={editLoading}
                        onClick={() => {
                          setEditing(null);
                          setEditEmail("");
                          setEditRole("athlete");
                        }}
                        style={{ minHeight: 36, padding: "0 12px", color: TEXT.tertiary }}
                      >
                        {ROLE_LABELS.cancel}
                      </GlassButton>
                    </>
                  ) : (
                    <GlassButton
                      variant="ghost"
                      onClick={() => {
                        setEditing({ user_id: row.user_id, role: row.role });
                        setEditRole(rowRole);
                        setEditEmail("");
                      }}
                      style={{ minHeight: 36, padding: "0 12px", color: TEXT.tertiary }}
                    >
                      {ROLE_LABELS.edit}
                    </GlassButton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </GlassCard>
  );
}

function chipStyle(active: boolean, color: string): CSSProperties {
  return {
    minHeight: 36,
    padding: "0 14px",
    borderRadius: RADIUS.pill,
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: active ? color : GLASS.border,
    background: active ? color : "transparent",
    color: active ? TEXT.onAccent : TEXT.secondary,
    fontSize: TYPE.body.size,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function roleChipBg(color: string): string {
  return color;
}

function roleChipText(): string {
  return TEXT.primary;
}

function rowColorFor(role: string): string {
  if (role === "admin") return STATUS.pr.base;
  if (role === "coach") return STATUS.progression.base;
  return STATUS.comeback.base;
}

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: "8px 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.primary,
  fontSize: TYPE.body.size,
};

const selectStyle: CSSProperties = {
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: "8px 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.primary,
  fontSize: TYPE.body.size,
};

const mutedStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.body.size,
  color: TEXT.tertiary,
};
