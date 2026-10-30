/**
 * warmupEngine.ts — Motor de calentamiento dinámico
 *
 * Función pura que genera 3 series de aproximación escalonadas
 * a partir del peso objetivo.
 */

export interface WarmupSet {
  weight: number;
  reps: number;
}

export function calculateWarmupSets(targetWeight: number): WarmupSet[] {
  if (targetWeight <= 0 || !Number.isFinite(targetWeight)) return [];
  const round = (v: number) => Math.round(v * 10) / 10;
  return [
    { weight: round(targetWeight * 0.45), reps: 10 },
    { weight: round(targetWeight * 0.65), reps: 5 },
    { weight: round(targetWeight * 0.85), reps: 2 },
  ];
}
