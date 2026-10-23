export type RirEstimate = { rir: number | null; source: "reported" | "insufficient-data" };

export function estimateRir(reportedRpe: number | null): RirEstimate {
  if (reportedRpe == null) return { rir: null, source: "insufficient-data" };
  const rir = Math.max(0, Math.min(10, 10 - reportedRpe));
  return { rir, source: "reported" };
}