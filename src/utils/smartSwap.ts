export interface ExerciseLite {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  pattern?: string;
  equipment?: string;
  available?: boolean;
}

export interface SwapResult {
  originalId: string;
  substituteId: string;
  name: string;
  score: number;
  reasons: string[];
  equipment: string;
}

export interface SwapOptions {
  requireEquipment?: string[];
  excludeEquipment?: string[];
  limit?: number;
}

function score(a: ExerciseLite, b: ExerciseLite, opts: SwapOptions): number {
  let s = 0;
  const reasons: string[] = [];
  if (a.primaryMuscle === b.primaryMuscle) { s += 40; reasons.push("mismo músculo primario"); }
  if (a.pattern && a.pattern === b.pattern) { s += 25; reasons.push("mismo patrón"); }
  if (a.secondaryMuscles && b.secondaryMuscles) {
    const inter = a.secondaryMuscles.filter((m) => b.secondaryMuscles!.includes(m)).length;
    s += Math.min(15, inter * 5);
  }
  if (b.available !== false) { s += 10; }
  if (opts.excludeEquipment?.includes(b.equipment ?? "")) s -= 100;
  return s;
}

export function smartSwap(original: ExerciseLite, catalog: ExerciseLite[], opts: SwapOptions = {}): SwapResult[] {
  const limit = opts.limit ?? 5;
  const results: SwapResult[] = [];
  for (const c of catalog) {
    if (c.id === original.id) continue;
    if (opts.requireEquipment && !opts.requireEquipment.includes(c.equipment ?? "")) continue;
    if (opts.excludeEquipment?.includes(c.equipment ?? "")) continue;
    const sc = score(original, c, opts);
    if (sc < 0) continue;
    results.push({
      originalId: original.id,
      substituteId: c.id,
      name: c.name,
      score: sc,
      reasons: [],
      equipment: c.equipment ?? "",
    });
  }
  results.sort((a, b) => b.score - a.score || a.substituteId.localeCompare(b.substituteId));
  return results.slice(0, limit);
}