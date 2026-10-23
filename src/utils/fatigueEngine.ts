export type FatigueStatus = "insufficient-data" | "normal" | "watch" | "deload-suggested";

export interface SeriesInput {
  muscle: string;
  date: string; // ISO date
  rpe: number | null;
  isWarmup: boolean;
  completed: boolean;
}

export interface WeeklyRpe {
  week: string;
  avgRpe: number;
  count: number;
}

export interface FatigueResult {
  status: FatigueStatus;
  muscle: string;
  consecutiveHighWeeks: number;
  weekly: WeeklyRpe[];
  reason: string;
}

function weekKey(date: string): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const onejan = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function computeWeeklyRpe(series: SeriesInput[], muscle: string, minPerWeek = 3): WeeklyRpe[] {
  const byWeek = new Map<string, number[]>();
  for (const s of series) {
    if (s.muscle !== muscle) continue;
    if (s.isWarmup || !s.completed || s.rpe == null) continue;
    const w = weekKey(s.date);
    if (!byWeek.has(w)) byWeek.set(w, []);
    byWeek.get(w)!.push(s.rpe);
  }
  const out: WeeklyRpe[] = [];
  for (const [w, vals] of byWeek) {
    if (vals.length < minPerWeek) continue;
    out.push({ week: w, avgRpe: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length });
  }
  out.sort((a, b) => a.week.localeCompare(b.week));
  return out;
}

export function evaluateFatigue(series: SeriesInput[], muscle: string, threshold = 8.5, minPerWeek = 3): FatigueResult {
  const weekly = computeWeeklyRpe(series, muscle, minPerWeek);
  if (weekly.length < 3) {
    return { status: "insufficient-data", muscle, consecutiveHighWeeks: 0, weekly, reason: "Historial insuficiente" };
  }
  // last 3 consecutive weeks
  let consecutive = 0;
  for (let i = weekly.length - 1; i >= 0; i--) {
    if (weekly[i].avgRpe > threshold) consecutive++;
    else break;
  }
  if (consecutive >= 3) {
    return { status: "deload-suggested", muscle, consecutiveHighWeeks: consecutive, weekly, reason: "RPE alto 3+ semanas" };
  }
  if (consecutive >= 2) {
    return { status: "watch", muscle, consecutiveHighWeeks: consecutive, weekly, reason: "RPE alto 2 semanas" };
  }
  return { status: "normal", muscle, consecutiveHighWeeks: consecutive, weekly, reason: "Sin patrón de fatiga" };
}