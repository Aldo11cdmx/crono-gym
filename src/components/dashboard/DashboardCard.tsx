/**
 * DashboardCard.tsx — a glass-card wrapper with a labelled header and a
 * loading / empty slot, so every dashboard panel shares the same padding,
 * radius and skeleton behaviour.
 *
 * Not a layout primitive: it does not position itself in a grid. The parent
 * (`DashboardPage`) owns the grid. A card is content + chrome only.
 */

import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { SPACE, TEXT, TYPE } from "@/design/tokens";

export interface DashboardCardProps {
  /** Card title, rendered in the header. */
  title: string;
  children?: ReactNode;
  /** Optional action in the top-right of the header. */
  action?: ReactNode;
  /** When true, the body shows a skeleton instead of `children`. */
  loading?: boolean;
  /** When true, `children` is replaced by an empty-state illustration. */
  empty?: boolean;
  /** A short label for the empty state. */
  emptyLabel?: string;
  /** Extra classes for the body area. */
  bodyClass?: string;
  /** Slightly denser glass fill, for a card lifted above the page. */
  raised?: boolean;
}

export function DashboardCard({
  title,
  children,
  action,
  loading = false,
  empty = false,
  emptyLabel = "Nada que mostrar",
  bodyClass,
  raised = false,
}: DashboardCardProps) {
  return (
    <GlassCard
      className={bodyClass}
      raised={raised}
      style={{ padding: SPACE.card, width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE.sm,
          marginBottom: SPACE.md,
        }}
      >
        <h2
          style={{
            fontSize: TYPE.title2.size,
            fontWeight: TYPE.title2.weight,
            lineHeight: TYPE.title2.lineHeight,
            margin: 0,
            color: TEXT.primary,
          }}
        >
          {title}
        </h2>
        {action}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
        </div>
      ) : empty ? (
        <div
          style={{
            textAlign: "center",
            padding: `${SPACE.xl} ${SPACE.card}`,
            color: TEXT.tertiary,
            fontSize: TYPE.body.size,
          }}
        >
          {emptyLabel}
        </div>
      ) : (
        children
      )}
    </GlassCard>
  );
}
