/**
 * LiveSessionBanner.tsx — the active-session header shown inside
 * HeroWorkoutCard when a workout is running.
 *
 * Shows: an "EN CURSO" badge with a pulsing dot, the elapsed time (updated
 * from a single interval with cleanup), the routine title, the routine
 * chips, and a "Continuar entrenamiento" button.
 *
 * The elapsed value is derived purely from `startedAt` via
 * `getElapsedMs` — there is no pause handling (ActiveWorkout owns that).
 * An invalid `startedAt` suppresses the timer entirely rather than
 * rendering "NaN".
 */

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Play } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { HeroChip } from "@/components/ui/HeroChip";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  ACCENT,
  MOTION,
  RADIUS,
  SPACE,
  SOLID,
  TEXT,
  TYPE,
} from "@/design/tokens";
import {
  formatElapsed,
  getElapsedMs,
  getSessionProgress,
  type RoutineSummary,
  buildHeroChips,
} from "@/lib/dashboard/heroCardModel";

export interface LiveSessionBannerProps {
  /** ISO 8601 timestamp of when the session started. */
  startedAt: string;
  /** Routine name displayed as the title. */
  routineName: string;
  /** Routine summary for chip data. */
  routine: RoutineSummary | null;
  /** Sets completed / planned for progress bar. */
  doneSets?: number | null;
  plannedSets?: number | null;
  /** Called when "Continuar entrenamiento" is pressed. */
  onContinue: () => void;
}

const TABULAR_NUMS: CSSProperties["fontVariantNumeric"] = "tabular-nums";

export function LiveSessionBanner({
  startedAt,
  routineName,
  routine,
  doneSets = null,
  plannedSets = null,
  onContinue,
}: LiveSessionBannerProps) {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);

  // Single interval: recomputes from the timestamp every second. The cleanup
  // runs on unmount and when `visibilitychange` fires so the timer pauses in
  // background tabs rather than burning CPU.
  const now = useMemo(() => Date.now() + tick, [tick]);
  const elapsedMs = getElapsedMs(startedAt, now);

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    // Immediate tick so the display is fresh on mount without waiting 1s.
    update();

    const id = window.setInterval(update, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        clearInterval(id);
      } else {
        update();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const progress = getSessionProgress(doneSets, plannedSets);
  const chips = buildHeroChips({
    exerciseCount: routine?.exerciseCount ?? null,
    minutes: routine?.estimatedDurationMin ?? null,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: `${SPACE.sm}px`,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.sm,
          flexWrap: "wrap",
        }}
      >
        <span
          aria-label="Sesión activa"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: SPACE.xs,
            fontSize: TYPE.caption.size,
            fontWeight: TYPE.caption.weight,
            color: ACCENT.base,
            lineHeight: 1,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: SPACE.sm,
              height: SPACE.sm,
              borderRadius: RADIUS.round,
              background: ACCENT.base,
              boxShadow: ACCENT.ring,
              ...(reduced
                ? {}
                : {
                    animation: `cronos-pulse ${MOTION.loop.session} ${MOTION.standard} infinite`,
                  }),
            }}
          />
          EN CURSO
        </span>

        {elapsedMs !== null && (
          <span
            style={{
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: TABULAR_NUMS,
              fontSize: TYPE.headline.size,
              fontWeight: TYPE.headline.weight,
              color: TEXT.primary,
            }}
            aria-label={`Tiempo transcurrido: ${formatElapsed(elapsedMs)}`}
            aria-live="polite"
          >
            {formatElapsed(elapsedMs)}
          </span>
        )}
      </div>

      <h3
        style={{
          ...TYPE.hero,
          margin: 0,
          color: TEXT.primary,
          wordBreak: "break-word",
        }}
      >
        {routineName}
      </h3>

      {chips.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: SPACE.xs,
            alignItems: "center",
          }}
        >
          {chips.map((chip) => (
            <HeroChip key={chip.label} label={chip.label} />
          ))}
        </div>
      )}

      {progress !== null && (
        <div
          style={{
            width: "100%",
            height: 4,
            borderRadius: RADIUS.sm,
            background: SOLID.card,
            overflow: "hidden",
            marginTop: SPACE.xs,
          }}
        >
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: ACCENT.base,
              transition: `width ${MOTION.fast} ${MOTION.standard}`,
            }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: SPACE.sm,
        }}
      >
        <GlassButton variant="primary" onClick={onContinue} icon={<Play size={16} />}>
          Continuar entrenamiento
        </GlassButton>
      </div>
    </div>
  );
}
