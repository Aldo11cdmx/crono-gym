import { GlassCard } from "@/components/ui/GlassCard";
import { GLASS } from "@/design/tokens";

export function FatigueAlertCard({ status, muscle }: { status: string; muscle: string }) {
  if (status !== "deload-suggested") return null;
  return (
    <GlassCard style={{ padding: 16, border: "1px solid " + GLASS.border }}>
      <p style={{ margin: 0 }}>Fatiga elevada en {muscle}. Considera una descarga.</p>
    </GlassCard>
  );
}