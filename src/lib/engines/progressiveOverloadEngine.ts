/**
 * progressiveOverloadEngine.ts — Motor de Sobrecarga Progresiva
 *
 * Algoritmo de Doble Progresión puro, sin React/Supabase.
 */

export interface WorkoutHistoryEntry {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
}

export interface TargetRepRange {
  minReps: number;
  maxReps: number;
}

export type OverloadReason =
  | "Aumento por RPE bajo"
  | "Consolidando rango"
  | "Deload por estancamiento";

export interface ProgressiveOverloadSuggestion {
  suggestedWeight: number | null;
  suggestedReps: number;
  reason: OverloadReason;
}

/**
 * Sugiere el siguiente objetivo según el algoritmo de doble progresión.
 * 
 * Reglas:
 * - Si RPE <= 8 y reps >= maxReps -> Sube +2.5kg / +5lb y resetea a minReps.
 * - Si RPE >= 9.5 o reps < minReps por 2+ sesiones -> Sugiere -10% de peso o alerta de descarga.
 */
export function suggestProgressiveOverload(
  lastWorkoutHistory: WorkoutHistoryEntry[],
  targetRepRange: TargetRepRange,
): ProgressiveOverloadSuggestion {
  const { minReps, maxReps } = targetRepRange;

  if (!lastWorkoutHistory || lastWorkoutHistory.length === 0) {
    return {
      suggestedWeight: null,
      suggestedReps: minReps,
      reason: "Consolidando rango",
    };
  }

  // Take the most recent session as reference
  const lastSession = lastWorkoutHistory[0];

  const lastWeight = lastSession.weight;
  const lastReps = lastSession.reps;
  const lastRpe = lastSession.rpe;

  // Case 1: Deload conditions - RPE >= 9.5 or reps < minReps for 2+ sessions
  if (lastRpe !== null && lastRpe >= 9.5) {
    if (lastWeight !== null && lastWeight > 0) {
      const deloadWeight = Math.round(lastWeight * 0.9 * 10) / 10;
      return {
        suggestedWeight: deloadWeight,
        suggestedReps: lastReps ?? minReps,
        reason: "Deload por estancamiento",
      };
    }
    return {
      suggestedWeight: lastWeight,
      suggestedReps: Math.max(1, (lastReps ?? minReps) - 2),
      reason: "Deload por estancamiento",
    };
  }

  // Check if reps < minReps for 2+ sessions
  const repsBelowMin = lastWorkoutHistory.filter(
    (h) => h.reps !== null && h.reps < minReps,
  ).length;
  if (repsBelowMin >= 2) {
    if (lastWeight !== null && lastWeight > 0) {
      const deloadWeight = Math.round(lastWeight * 0.9 * 10) / 10;
      return {
        suggestedWeight: deloadWeight,
        suggestedReps: minReps,
        reason: "Deload por estancamiento",
      };
    }
    return {
      suggestedWeight: lastWeight,
      suggestedReps: minReps,
      reason: "Deload por estancamiento",
    };
  }

  // Case 2: RPE <= 8 and reps >= maxReps -> increase weight, reset to minReps
  if (
    lastRpe !== null &&
    lastRpe <= 8 &&
    lastReps !== null &&
    lastReps >= maxReps
  ) {
    if (lastWeight !== null && lastWeight > 0) {
      const increasedWeight = Math.round((lastWeight + 2.5) * 10) / 10;
      return {
        suggestedWeight: increasedWeight,
        suggestedReps: minReps,
        reason: "Aumento por RPE bajo",
      };
    }
    // Bodyweight case
    return {
      suggestedWeight: lastWeight,
      suggestedReps: lastReps + 1,
      reason: "Aumento por RPE bajo",
    };
  }

  // Case 3: Consolidating range
  if (lastReps !== null && lastReps < maxReps) {
    return {
      suggestedWeight: lastWeight,
      suggestedReps: lastReps + 1,
      reason: "Consolidando rango",
    };
  }

  return {
    suggestedWeight: lastWeight,
    suggestedReps: Math.max(minReps, lastReps ?? minReps),
    reason: "Consolidando rango",
  };
}
