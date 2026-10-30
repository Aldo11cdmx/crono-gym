/**
 * prCalculatorEngine.ts — Motor de Récords Personales & 1RM
 *
 * Funciones puras para cálculo de 1RM y detección de PRs.
 */

export interface SetData {
  weight: number | null;
  reps: number | null;
}

export interface UserHistoryEntry {
  weight: number | null;
  reps: number | null;
  volume?: number | null;
}

export interface PRCheckResult {
  isNewPR: boolean;
  reason?: string;
}

/**
 * Calcula 1RM usando fórmula de Epley
 */
export function calculateEpley1RM(weight: number | null, reps: number | null): number | null {
  if (weight === null || weight <= 0 || reps === null || reps <= 0) {
    return null;
  }
  
  if (reps === 1) {
    return weight;
  }
  
  // Epley: 1RM = weight * (1 + reps/30)
  const oneRM = weight * (1 + reps / 30);
  return Math.round(oneRM * 10) / 10;
}

/**
 * Calcula volumen (peso * reps)
 */
export function calculateVolume(weight: number | null, reps: number | null): number | null {
  if (weight === null || weight <= 0 || reps === null || reps <= 0) {
    return null;
  }
  return weight * reps;
}

/**
 * Evalúa si el set actual supera el 1RM histórico o el volumen máximo
 * y retorna un flag isNewPR
 */
export function checkPersonalRecord(
  userHistory: UserHistoryEntry[],
  currentSet: SetData,
): PRCheckResult {
  if (!userHistory || userHistory.length === 0) {
    const current1RM = calculateEpley1RM(currentSet.weight, currentSet.reps);
    if (current1RM !== null && current1RM > 0) {
      return {
        isNewPR: true,
        reason: "Primer récord personal",
      };
    }
    return { isNewPR: false };
  }

  const current1RM = calculateEpley1RM(currentSet.weight, currentSet.reps);
  const currentVolume = calculateVolume(currentSet.weight, currentSet.reps);

  // Find historical bests
  let bestHistorical1RM = 0;
  let bestHistoricalVolume = 0;

  for (const entry of userHistory) {
    const hist1RM = calculateEpley1RM(entry.weight, entry.reps);
    if (hist1RM !== null && hist1RM > bestHistorical1RM) {
      bestHistorical1RM = hist1RM;
    }

    const histVolume = entry.volume ?? calculateVolume(entry.weight, entry.reps);
    if (histVolume !== null && histVolume > bestHistoricalVolume) {
      bestHistoricalVolume = histVolume;
    }
  }

  // Check if current set beats historical 1RM
  if (current1RM !== null && current1RM > bestHistorical1RM && bestHistorical1RM > 0) {
    return {
      isNewPR: true,
      reason: "Nuevo récord de 1RM",
    };
  }

  // Check if current set beats historical volume
  if (currentVolume !== null && currentVolume > bestHistoricalVolume && bestHistoricalVolume > 0) {
    return {
      isNewPR: true,
      reason: "Nuevo récord de volumen",
    };
  }

  // First time establishing a PR
  if (current1RM !== null && bestHistorical1RM === 0) {
    return {
      isNewPR: true,
      reason: "Primer récord personal",
    };
  }

  return { isNewPR: false };
}

/**
 * Obtiene el mejor 1RM del historial
 */
export function getBest1RM(userHistory: UserHistoryEntry[]): number | null {
  if (!userHistory || userHistory.length === 0) return null;
  
  let best = 0;
  for (const entry of userHistory) {
    const rm = calculateEpley1RM(entry.weight, entry.reps);
    if (rm !== null && rm > best) {
      best = rm;
    }
  }
  
  return best > 0 ? Math.round(best * 10) / 10 : null;
}
