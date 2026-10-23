export interface NeonLevel {
  level: number;
  tier: "hierro" | "bronce" | "oro" | "cyan" | "leyenda";
  label: string;
  color: string;
}

export const NEON_LEVELS: NeonLevel[] = [
  { level: 1, tier: "hierro", label: "Hierro I", color: "#27272A" },
  { level: 2, tier: "hierro", label: "Hierro II", color: "#3F3F46" },
  { level: 3, tier: "hierro", label: "Hierro III", color: "#52525B" },
  { level: 4, tier: "bronce", label: "Bronce I", color: "#78350F" },
  { level: 5, tier: "bronce", label: "Bronce II", color: "#92400E" },
  { level: 6, tier: "bronce", label: "Bronce III", color: "#D97706" },
  { level: 7, tier: "oro", label: "Oro I", color: "#EAB308" },
  { level: 8, tier: "oro", label: "Oro II", color: "#FACC15" },
  { level: 9, tier: "oro", label: "Oro III", color: "#FDE047" },
  { level: 10, tier: "cyan", label: "Cyan I", color: "#0891B2" },
  { level: 11, tier: "cyan", label: "Cyan II", color: "#06B6D4" },
  { level: 12, tier: "cyan", label: "Cyan III", color: "#22D3EE" },
  { level: 13, tier: "leyenda", label: "Leyenda I", color: "#C084FC" },
  { level: 14, tier: "leyenda", label: "Leyenda II", color: "#FF3B30" },
  { level: 15, tier: "leyenda", label: "Mítico Cronos", color: "#EF4444" },
];

export interface NeonStyle {
  hex: string;
  glow: string | null;
  tier: NeonLevel["tier"];
  label: string;
}

export function neonLevelByNumber(level: number): NeonLevel {
  const clamped = Math.min(15, Math.max(1, Math.round(level)));
  return NEON_LEVELS[clamped - 1];
}

export function getNeonStyleForMuscle(
  _muscleId: string,
  currentScoreOrLevel: number,
): NeonStyle {
  const lvl = neonLevelByNumber(currentScoreOrLevel);
  const glow =
    lvl.level >= 10
      ? `drop-shadow(0 0 8px ${lvl.color})`
      : null;
  return { hex: lvl.color, glow, tier: lvl.tier, label: lvl.label };
}
