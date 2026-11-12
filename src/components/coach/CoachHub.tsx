import { PortalPanel } from "./portal/CoachPortal";
import { usePermissions } from "@/hooks/usePermissions";
import { CoachPinGate } from "@/lib/coach/CoachAccessGate";
import { useCoachAuth } from "@/lib/coach/useCoachAuth";

export const COACH_ENUM_LABELS = {
  goal: {
    gain_muscle: "Hipertrofia",
    lose_weight: "Definición",
    maintain: "Mantenimiento",
    strength: "Fuerza",
    endurance: "Resistencia",
  },
  experience: {
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
  },
} as const;

export interface CoachHubProps {
  userId: string;
}

/** The athlete-facing route uses the same E2E coach workspace as /coach/portal. */
export function CoachHub({ userId }: CoachHubProps) {
  const permissions = usePermissions();
  const auth = useCoachAuth();
  if (permissions.loading) return <div className="min-h-60 animate-pulse rounded-2xl bg-[#1C1C1E]" />;
  const panel = <PortalPanel userId={userId} onExit={auth.lock} />;
  return permissions.hasRole(["coach", "admin", "developer"]) ? panel : <CoachPinGate>{panel}</CoachPinGate>;
}
