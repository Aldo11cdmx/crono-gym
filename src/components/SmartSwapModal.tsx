import { GlassCard } from "@/components/ui/GlassCard";

export function SmartSwapModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <GlassCard style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: 20, zIndex: 60 }}>
      <p>Sustituir ejercicio</p>
      <button onClick={onClose}>Cerrar</button>
    </GlassCard>
  );
}