/**
 * HubSkeleton — the loading state shown while the lazy ExerciseHub chunk streams in.
 *
 * Reuses the shared `Skeleton` pulse so the skeleton's shimmer lives on the same
 * token as every other loading surface, and inherits reduced-motion handling from
 * it. Three blocks approximate the hub's layout: a header, a tab strip, and the
 * panel body.
 */

import { Skeleton } from "@/components/ui/Skeleton";
import { GLASS, SPACE } from "@/design/tokens";
import { HUB_LABELS } from "@/lib/i18n";

export function HubSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.md,
        padding: SPACE.md,
      }}
    >
      <Skeleton
        height="24px"
        width="60%"
        aria-label={HUB_LABELS.skeleton.title}
      />

      <div
        style={{
          display: "flex",
          gap: SPACE.sm,
          borderBottom: `1px solid ${GLASS.border}`,
        }}
      >
        {(["demo", "progress", "records"] as const).map((tab) => (
          <Skeleton
            key={tab}
            height="40px"
            width="80px"
            aria-label={`Cargando pestaña ${tab}`}
          />
        ))}
      </div>

      <Skeleton
        height="200px"
        aria-label={HUB_LABELS.skeleton.content}
      />
    </div>
  );
}
