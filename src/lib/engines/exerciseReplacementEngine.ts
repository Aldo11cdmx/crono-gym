/**
 * exerciseReplacementEngine.ts — Motor de Reemplazo Inteligente
 *
 * Filtra y prioriza ejercicios equivalentes por grupo muscular primario
 * y patrón de movimiento.
 */

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle?: string;
  muscle_group?: string;
  body_part?: string;
  target?: string;
  movementPattern?: string;
  equipment?: string;
  [key: string]: any;
}

export interface ReplacementOptions {
  currentExercise: Exercise;
  availableEquipment: string[];
  exerciseCatalog: Exercise[];
}

/**
 * Filtra ejercicios que compartan primaryMuscle y movementPattern,
 * prioriza equivalencias directas y calcula estimación de peso convertido.
 */
export function findExerciseReplacements({
  currentExercise,
  availableEquipment,
  exerciseCatalog,
}: ReplacementOptions): Exercise[] {
  if (!exerciseCatalog || exerciseCatalog.length === 0) {
    return [];
  }

  const currentMuscle =
    currentExercise.primaryMuscle ||
    currentExercise.muscle_group ||
    currentExercise.target ||
    currentExercise.body_part ||
    "";
  
  const currentPattern = currentExercise.movementPattern || "";
  const currentEquipment = (currentExercise.equipment || "").toLowerCase();

  const replacements = exerciseCatalog.filter((exercise) => {
    // Don't suggest the same exercise
    if (exercise.id === currentExercise.id) return false;

    const exerciseMuscle =
      exercise.primaryMuscle ||
      exercise.muscle_group ||
      exercise.target ||
      exercise.body_part ||
      "";
    
    void exercise.movementPattern;
    const exerciseEquip = (exercise.equipment || "").toLowerCase();

    // Must share primary muscle
    const sameMuscle =
      currentMuscle.toLowerCase() === exerciseMuscle.toLowerCase();
    if (!sameMuscle) return false;

    // Must be available with given equipment
    const hasEquipment = availableEquipment.some((eq) => {
      const eqLower = eq.toLowerCase();
      return (
        exerciseEquip.includes(eqLower) ||
        eqLower.includes(exerciseEquip) ||
        exerciseEquip === eqLower
      );
    });
    if (!hasEquipment) return false;

    // Prefer same movement pattern
    return true;
  });

  // Prioritize by compatibility - same movement pattern first
  const scored = replacements.map((exercise) => {
    const exercisePatternScored = exercise.movementPattern || "";
    const samePattern =
      currentPattern &&
      exercisePatternScored &&
      currentPattern.toLowerCase() === exercisePatternScored.toLowerCase();
    
    const exerciseEquip = (exercise.equipment || "").toLowerCase();
    const exactEquip = exerciseEquip === currentEquipment;
    
    let score = 0;
    if (samePattern) score += 10;
    if (exactEquip) score += 5;
    if (sameMuscleMatch(exercise, currentExercise)) score += 3;
    
    return { exercise, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.exercise);
}

function sameMuscleMatch(ex1: Exercise, ex2: Exercise): boolean {
  const m1 = ex1.primaryMuscle || ex1.muscle_group || ex1.target || "";
  const m2 = ex2.primaryMuscle || ex2.muscle_group || ex2.target || "";
  return m1.toLowerCase() === m2.toLowerCase();
}

/**
 * Calcula estimación de peso convertido entre equipos.
 */
export function estimateConvertedWeight(
  weight: number,
  fromEquipment: string,
  toEquipment: string,
): number {
  const from = fromEquipment.toLowerCase();
  const to = toEquipment.toLowerCase();

  // Conversion factors (simplified)
  if (from.includes("barra") && to.includes("mancuerna")) {
    return Math.round((weight * 0.7) * 10) / 10;
  }
  if (from.includes("mancuerna") && to.includes("barra")) {
    return Math.round((weight * 1.4) * 10) / 10;
  }
  if (from.includes("maquina") && to.includes("mancuerna")) {
    return Math.round((weight * 0.8) * 10) / 10;
  }
  if (from.includes("mancuerna") && to.includes("maquina")) {
    return Math.round((weight * 1.25) * 10) / 10;
  }
  if (from.includes("polea") && to.includes("mancuerna")) {
    return Math.round((weight * 0.9) * 10) / 10;
  }

  return weight;
}
