import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

export function FatigueAlertCard({ status, muscle }: { status: string; muscle: string }) {
  if (status !== "deload-suggested") return null;
  return (
    <GlassCard style={{ padding: 16, border: "1px solid #f59e0b" }}>
      <p style={{ margin: 0 }}>Fatiga elevada en {muscle}. Considera una descarga.</p>
      <GlassButton variant="ghost" onClick={() => {}}>Entendido</GlassButton>
    </GlassCard>
  );
}