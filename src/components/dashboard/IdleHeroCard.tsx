/**
 * IdleHeroCard.tsx — the hero card shown when no session is active.
 *
 * Layout: two columns on ≥md viewports (left: greeting + suggested routine);
 * right: chips + start button), single column on mobile. Padding SPACE.xl.
 *
 * Props:
 *   - greeting: the precomputed saludo text (from getGreeting)
 *   - routine: suggested routine summary or null
 *   - chips: routine chips (from buildHeroChips)
 *   - onStart: called when "INICIAR ENTRENAMIENTO" is pressed
 *   - onCreate: called when "Crear rutina" is pressed (shown when no routine)
 *   - loading: shows a skeleton instead of real content
 *   - dayName: optional calendar day name (e.g. "Sábado"), rendered as a "HOY • {dayName}" badge
 *   - dayLabel: optional routine day focus (e.g. "Pecho"), shown as "Enfoque: {dayLabel}" when provided
 *   - restDay: when true, renders the "Día de Recuperación" state with sober tones instead of
 *     the start button — the athlete has already trained today.
 */

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { GlassButton } from "@/components/ui/GlassButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeroChip } from "@/components/ui/HeroChip";
import { Dumbbell } from "lucide-react";
import type { RoutineSummary } from "@/lib/dashboard/heroCardModel";
import {
  ACCENT,
  RADIUS,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";

export interface IdleHeroCardProps {
  greeting: string;
  routine: RoutineSummary | null;
  chips: { label: string }[];
  onStart: () => void;
  onCreate: () => void;
  loading?: boolean;
  /** Calendar day name, e.g. "Sábado". */
  dayName?: string;
  /** Routine day focus, e.g. "Pecho". Shown as "Sábado: Pecho". */
  dayLabel?: string | null;
  /** When true, renders rest-day state instead of the start button. */
  restDay?: boolean;
}

export function IdleHeroCard({
  greeting,
  routine,
  chips,
  onStart,
  loading = false,
  dayName,
  dayLabel,
  restDay = false,
}: IdleHeroCardProps) {
  const isMd = useMediaQuery("(min-width: 768px)");

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${SPACE.lg}px`,
          padding: SPACE.xl,
        }}
      >
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="40%" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMd ? "row" : "column",
        alignItems: isMd ? "center" : "stretch",
        justifyContent: isMd ? "space-between" : "flex-start",
        gap: `${SPACE.xl}px`,
        padding: SPACE.xl,
        minWidth: 0,
      }}
    >
      {/* Left column: greeting + routine */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
          flex: 1,
          minWidth: 0,
        }}
      >
        {dayName && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: SPACE.xs,
              padding: `${SPACE.xs}px ${SPACE.md}px`,
              borderRadius: RADIUS.pill,
              background: restDay ? STATUS.success.muted : ACCENT.subtle,
              border: `1px solid ${restDay ? STATUS.success.border : ACCENT.border}`,
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              color: restDay ? STATUS.success.text : ACCENT.text,
              alignSelf: "flex-start",
            }}
          >
            HOY • {dayName}
          </span>
        )}

        {!restDay && dayName && (
          <p
            style={{
              fontSize: TYPE.callout.size,
              fontWeight: TYPE.callout.weight,
              lineHeight: TYPE.callout.lineHeight,
              color: TEXT.secondary,
              margin: 0,
            }}
          >
            Enfoque: {dayLabel || "Rutina del día"}
          </p>
        )}

        <h2
          style={{
            ...TYPE.hero,
            margin: 0,
            color: TEXT.primary,
            wordBreak: "break-word",
          }}
        >
          {greeting}
        </h2>

        {restDay ? (
          <p
            style={{
              fontSize: TYPE.body.size,
              color: TEXT.secondary,
              margin: 0,
            }}
          >
            Ya entrenaste hoy. ¡Buen trabajo!
          </p>
        ) : routine ? (
          <p
            style={{
              fontSize: TYPE.body.size,
              lineHeight: TYPE.body.lineHeight,
              color: TEXT.secondary,
              margin: 0,
            }}
          >
            {routine.title} · {routine.exerciseCount} ejercicios ·{" "}
            {routine.estimatedDurationMin} min
          </p>
        ) : (
          <p
            style={{
              fontSize: TYPE.body.size,
              color: TEXT.secondary,
              margin: 0,
            }}
          >
            {greeting.includes(",")
              ? "¿Lista para un nuevo entrenamiento?"
              : "Empieza hoy creando tu primera rutina."}
          </p>
        )}
      </div>

      {/* Right column: chips + action button */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.sm,
          alignItems: isMd ? "flex-end" : "stretch",
          flexShrink: 0,
        }}
      >
        {restDay ? (
          <span
            style={{
              fontSize: TYPE.caption.size,
              color: STATUS.success.text,
              display: "inline-flex",
              alignItems: "center",
              gap: SPACE.xs,
            }}
          >
            Día de Recuperación
          </span>
        ) : chips.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: SPACE.xs,
            }}
          >
            {chips.map((chip) => (
              <HeroChip key={chip.label} label={chip.label} />
            ))}
          </div>
        ) : null}

        {restDay ? (
          <GlassButton variant="primary" onClick={onStart}>
            Ver progreso
          </GlassButton>
        ) : (
          <GlassButton variant="primary" icon={<Dumbbell size={16} />} onClick={onStart}>
            INICIAR ENTRENAMIENTO
          </GlassButton>
        )}
      </div>
    </div>
  );
}
