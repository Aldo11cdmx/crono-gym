/**
 * ComingSoon.tsx — placeholder for a route whose screen does not exist yet.
 *
 * The alternative -- leaving the path out of the table -- makes a deep link land
 * on the router's error screen, which reads as a crash. An empty route renders
 * as "not built yet" instead, and keeps every `<NavLink>` pointing at something
 * that resolves.
 */

import { GlassCard } from "@/components/ui";
import { COMING_SOON_LABEL } from "@/lib/i18n";
import { TEXT } from "@/design/tokens";

export function ComingSoon({ title }: { title: string }) {
  return (
    <GlassCard style={{ textAlign: "center" }}>
      <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: "8px 0 0", fontSize: "13px", color: TEXT.tertiary }}>
        {COMING_SOON_LABEL}
      </p>
    </GlassCard>
  );
}