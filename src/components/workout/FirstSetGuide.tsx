import { GlassCard } from "@/components/ui/GlassCard";

export function FirstSetGuide() {
  return (
    <GlassCard style={{ padding: 12, position: "fixed", bottom: 80, left: 16, right: 16, zIndex: 50 }}>
      <p style={{ margin: 0 }}>Objetivo: 20 kg × 10 reps</p>
    </GlassCard>
  );
}