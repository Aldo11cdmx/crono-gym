import { type CSSProperties } from "react";
import { Moon } from "lucide-react";
import {
  ACCENT,
  FONT_SANS,
  GLASS,
  GRADIENT_FILLS,
  MOTION,
  RADIUS,
  SPACE,
  SOLID,
  SURFACE,
  TEXT,
  TYPE,
} from "@/design/tokens";
import type { WeeklyCoverageSummary } from "@/lib/routines/weeklyCoverage";

const LABELS = {
  weeklyCoverageTitle: "Cobertura muscular semanal",
  deloadToggle: "Modo Deload",
  deloadToggleAria: "Activar semana de descarga",
  deloadBadge: "SEMANA DE DESCARGA ACTIVA",
  lowVolumeBadge: "Volumen bajo",
} as const;

const SURFACE_STYLE: CSSProperties = {
  backgroundColor: GLASS.fill,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

export function WeeklyVolumeCoverage({
  coverage,
  deloadActive,
  onToggleDeload,
}: {
  coverage: WeeklyCoverageSummary;
  deloadActive: boolean;
  onToggleDeload: () => void;
}) {
  const hasAssignments = coverage.activeRoutineIds.size > 0;

  return (
    <div
      style={{
        ...SURFACE_STYLE,
        borderRadius: RADIUS.surface,
        padding: SPACE.card,
        marginTop: SPACE.md,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE.sm,
          marginBottom: SPACE.sm,
        }}
      >
        <h3 style={{ ...TYPE.subhead, color: TEXT.primary, margin: 0 }}>{LABELS.weeklyCoverageTitle}</h3>
        {!deloadActive && hasAssignments && (
          <button
            type="button"
            onClick={onToggleDeload}
            aria-label={LABELS.deloadToggleAria}
            title={LABELS.deloadToggleAria}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: SPACE.xs,
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.chip,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.card,
              color: TEXT.secondary,
              fontFamily: FONT_SANS,
              fontSize: TYPE.caption.size,
              cursor: "pointer",
              transition: `background-color ${MOTION.fast} ${MOTION.standard}`,
            }}
          >
            <Moon style={{ width: 12, height: 12 }} strokeWidth={1.5} />
            {LABELS.deloadToggle}
          </button>
        )}
        {deloadActive && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              color: ACCENT.text,
              background: ACCENT.subtle,
              borderRadius: RADIUS.chip,
              padding: "2px 8px",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: RADIUS.round,
                background: ACCENT.base,
              }}
            />
            {LABELS.deloadBadge}
          </span>
        )}
      </div>

      {!hasAssignments ? (
        <p style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, margin: 0 }}>
          Asigna rutinas a la semana para ver la cobertura muscular.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.xs,
          }}
        >
          {coverage.muscles.map((m) => {
            const maxVolume = 16;
            const progressPct = Math.min(100, Math.max(8, Math.round((m.displayedSets / maxVolume) * 100)));
            return (
              <div
                key={m.slug}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: `${SPACE.xs} 0`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: SPACE.sm,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: SPACE.xs,
                      flex: 1,
                    }}
                  >
                    <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>{m.label}</span>
                    {m.lowVolume && (
                  <span
                    style={{
                      fontSize: TYPE.caption.size,
                      fontWeight: TYPE.caption.weight,
                      color: ACCENT.text,
                      background: `${ACCENT.subtle}80`,
                      borderRadius: RADIUS.chip,
                      padding: "2px 6px",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {LABELS.lowVolumeBadge}
                  </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: TYPE.caption.size,
                      color: TEXT.secondary,
                      fontFamily: TYPE.mono.font,
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 60,
                      textAlign: "right",
                      background: GLASS.fill,
                      borderRadius: RADIUS.chip,
                      padding: "1px 6px",
                    }}
                  >
                    {m.displayedSets} series{m.displayedSets !== m.rawSets && deloadActive && ` (orig: ${m.rawSets})`}
                  </span>
                </div>
                {/* Barra fina de progreso estilo Apple Health */}
                <div
                  role="progressbar"
                  aria-valuenow={m.displayedSets}
                  aria-valuemin={0}
                  aria-valuemax={maxVolume}
                  aria-label={`Volumen de ${m.label}`}
                  style={{
                    width: "100%",
                    height: 4,
                    borderRadius: RADIUS.pill,
                    background: SURFACE.sunken,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      borderRadius: RADIUS.pill,
                      background: m.lowVolume ? GRADIENT_FILLS.warm : GRADIENT_FILLS.accent,
                      transition: `width ${MOTION.normal} ${MOTION.easeOut}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
