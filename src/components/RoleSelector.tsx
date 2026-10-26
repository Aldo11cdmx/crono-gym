/**
 * RoleSelector.tsx — "Hola, [Nombre] — ¿Cómo quieres acceder hoy?"
 *
 * Offered when a signed-in user has more than one server role. Each card is
 * tappable at `MOTION.minTouchTarget` and the selected one carries the accent
 * ring; the role name and a one-line description are the only copy, so the
 * panel reads in under a second on a phone held in a gym.
 *
 * The selector is not authorization. It decides which chrome renders; the
 * server still decides what the user can do, and `usePermissions` reads the
 * *server* roles through `my_roles`. Selecting "coach" as an athlete shows the
 * coach chrome and nothing else -- the coach views that need a real coach
 * account refuse at the RPC/RLS layer, which is where the refusal belongs.
 */

import { useMemo } from "react";
import { User, Briefcase, Shield, Cpu } from "lucide-react";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";
import { ROLE_LABELS } from "@/lib/i18n";

export interface RoleOption {
  role: "athlete" | "coach" | "admin" | "developer";
  /** Whether the server says this user actually has this role. */
  available: boolean;
}

const ROLE_META: Record<
  RoleOption["role"],
  { icon: typeof User; label: string; description: string; color: string }
> = {
  athlete: {
    icon: User,
    label: ROLE_LABELS.athlete,
    description: "Entrenar, progresar y ver tus marcas.",
    color: STATUS.comeback.base,
  },
  coach: {
    icon: Briefcase,
    label: ROLE_LABELS.coach,
    description: "Ver a tus atletas y guiar sus sesiones.",
    color: STATUS.progression.base,
  },
  admin: {
    icon: Shield,
    label: ROLE_LABELS.admin,
    description: "Gestionar usuarios, roles y anuncios.",
    color: STATUS.pr.base,
  },
  developer: {
    icon: Cpu,
    label: ROLE_LABELS.developer,
    description: "Herramientas, diagnóstico y configuración.",
    color: STATUS.pr.base,
  },
};

export interface RoleSelectorProps {
  /** Roles the server says this user actually has. */
  availableRoles: readonly string[];
  /** The currently selected role. */
  activeRole: "athlete" | "coach" | "admin" | "developer";
  /** Called when the user picks a card. */
  onSelect: (role: RoleOption["role"]) => void;
  /** Display name to greet. */
  displayName?: string | null;
  /** Optional heading override; defaults to the standard greeting. */
  title?: string;
  className?: string;
}

export function RoleSelector({
  availableRoles,
  activeRole,
  onSelect,
  displayName,
  title,
  className,
}: RoleSelectorProps) {
  const options = useMemo<RoleOption[]>(
    () =>
      (["athlete", "coach", "admin", "developer"] as const)
        .map((role) => ({
          role,
          available: availableRoles.includes(role),
        }))
        .filter((opt) => opt.available),
    [availableRoles],
  );

  if (options.length === 0) return null;

  const heading = title ?? (displayName ? `Hola, ${displayName}` : "¿Cómo quieres acceder hoy?");

  return (
    <div className={className}>
      <h3
        style={{
          fontSize: TYPE.title2.size,
          lineHeight: TYPE.title2.lineHeight,
          fontWeight: TYPE.title2.weight,
          color: TEXT.primary,
          textAlign: "center",
          marginBottom: SPACE.md,
        }}
      >
        {heading}
      </h3>
      <p
        style={{
          fontSize: TYPE.body.size,
          lineHeight: TYPE.body.lineHeight,
          color: TEXT.secondary,
          textAlign: "center",
          marginBottom: SPACE.lg,
        }}
      >
        ¿Cómo quieres acceder hoy?
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: SPACE.sm,
        }}
      >
        {options.map((opt) => {
          const meta = ROLE_META[opt.role];
          const Icon = meta.icon;
          const isSelected = opt.role === activeRole;

          return (
            <button
              key={opt.role}
              type="button"
              onClick={() => onSelect(opt.role)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: SPACE.xs,
                padding: SPACE.lg,
                minHeight: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: isSelected ? ACCENT.base : GLASS.borderStrong,
                background: isSelected ? ACCENT.subtle : GLASS.fill,
                color: TEXT.primary,
                cursor: "pointer",
                transition: `border-color ${MOTION.fast} ${MOTION.spring}, background ${MOTION.fast} ${MOTION.standard}`,
              }}
            >
              <Icon
                size={28}
                style={{ color: isSelected ? ACCENT.text : meta.color }}
                aria-hidden="true"
              />
              <span
                style={{
                  fontSize: TYPE.subhead.size,
                  fontWeight: TYPE.subhead.weight,
                  color: TEXT.primary,
                }}
              >
                {meta.label}
              </span>
              <span
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.tertiary,
                  textAlign: "center",
                  lineHeight: TYPE.caption.lineHeight,
                }}
              >
                {meta.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}