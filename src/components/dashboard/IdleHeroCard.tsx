/**
 * IdleHeroCard.tsx — the hero card shown when no session is active.
 *
 * Layout: two columns on ≥md viewports (left: greeting + suggested routine;
 * right: chips + start button), single column on mobile. Padding SPACE.xl.
 *
 * Props:
 *   - greeting: the precomputed saludo text (from getGreeting)
 *   - routine: suggested routine summary or null
 *   - chips: routine chips (from buildHeroChips)
 *   - onStart: called when "Empezar entrenamiento" is pressed
 *   - onCreate: called when "Crear rutina" is pressed (shown when no routine)
 *   - loading: shows a skeleton instead of real content
 */

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { GlassButton } from "@/components/ui/GlassButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeroChip } from "@/components/ui/HeroChip";
import { Dumbbell } from "lucide-react";
import type { RoutineSummary } from "@/lib/dashboard/heroCardModel";
import {
  SPACE,
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
}

export function IdleHeroCard({
  greeting,
  routine,
  chips,
  onStart,
  onCreate,
  loading = false,
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

        {routine ? (
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
        {chips.length > 0 && (
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
        )}

        {!routine ? (
          <GlassButton variant="secondary" icon={<Dumbbell size={16} />} onClick={onCreate}>
            Crear rutina
          </GlassButton>
        ) : (
          <GlassButton variant="primary" onClick={onStart}>
            Empezar entrenamiento
          </GlassButton>
        )}
      </div>
    </div>
  );
}
