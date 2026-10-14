export interface Grip {
  id: string;
  name: string;
  description: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  image?: string;
}

export const gripMap: Record<string, Grip> = {
  'GRIP-001': {
    id: 'GRIP-001',
    name: 'Agarre estándar',
    description: 'Agarre típico para ejercicios de empuje y tracción.',
    primaryMuscles: ['pectorales', 'deltoides'],
    secondaryMuscles: ['tríceps'],
  },
  'GRIP-002': {
    id: 'GRIP-002',
    name: 'Agarre neutro',
    description: 'Agarre con palomas enfrentadas, reduce tensión en muñecas.',
    primaryMuscles: ['dorsales', 'bíceps'],
    secondaryMuscles: ['antebrazos'],
  },
  'GRIP-003': {
    id: 'GRIP-003',
    name: 'Agarre ancho',
    description: 'Agarre más ancho que el estándar, enfoca más en dorsales.',
    primaryMuscles: ['dorsales'],
    secondaryMuscles: ['trapezoides'],
  },
};

export function getGripForExercise(exerciseId: string): Grip | undefined {
  // Placeholder mapping: assign based on exerciseId modulo
  // In real app, this would come from exercise data.
  const map: Record<string, string> = {
    // example: map some exercise IDs to grip IDs
    // We'll just return first grip for demo
  };
  const gripId = map[exerciseId] ?? Object.keys(gripMap)[0];
  return gripMap[gripId];
}
