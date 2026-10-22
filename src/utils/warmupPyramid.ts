export interface WarmupSet { weight: number; reps: number; }

export interface WarmupInput {
  targetWeight: number;
  increment?: number;
}

export function warmupPyramid(input: WarmupInput): WarmupSet[] {
  const inc = input.increment && input.increment > 0 ? input.increment : 2.5;
  const round = (w: number) => Math.round(w / inc) * inc;
  const steps = [
    { pct: 0.4, reps: 10 },
    { pct: 0.6, reps: 5 },
    { pct: 0.85, reps: 2 },
  ];
  const out: WarmupSet[] = [];
  const seen = new Set<string>();
  for (const st of steps) {
    const w = round(input.targetWeight * st.pct);
    if (w <= 0 || w >= input.targetWeight) continue;
    const key = `${w}-${st.reps}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ weight: w, reps: st.reps });
  }
  return out;
}