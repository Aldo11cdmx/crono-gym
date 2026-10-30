/**
 * routineTemplates.ts — plantillas base que el coach puede clonar en el plan de un atleta.
 *
 * Los nombres de ejercicio se resuelven contra el catálogo en tiempo de ejecución
 * (`catalog.find(name)`). Un ejercicio que no exista en el catálogo se descarta
 * del día, y un día que se queda vacío se descarta de la plantilla. Nunca se
 * asigna una plantilla con cero días válidos.
 */

export interface RoutineTemplate {
  id: string;
  title: string;
  days: Array<{
    label: string;
    exercises: Array<{
      /** Nombre del ejercicio tal como aparece en el catálogo. */
      name: string;
      sets: number;
      repsMin: number;
      repsMax: number;
      restSeconds: number;
    }>;
  }>;
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: "template-fullbody-3d",
    title: "Principiante - Fullbody 3 Días",
    days: [
      {
        label: "Día A - Cuerpo completo",
        exercises: [
          { name: "Sentadilla", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
          { name: "Press de banca", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
          { name: "Remo con barra", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
          { name: "Press militar", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
        ],
      },
      {
        label: "Día B - Cuerpo completo",
        exercises: [
          { name: "Peso muerto", sets: 3, repsMin: 6, repsMax: 10, restSeconds: 120 },
          { name: "Dominadas", sets: 3, repsMin: 6, repsMax: 10, restSeconds: 90 },
          { name: "Zancadas", sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60 },
          { name: "Curl con barra", sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    id: "template-push-pull-legs",
    title: "Push / Pull / Legs",
    days: [
      {
        label: "Push",
        exercises: [
          { name: "Press de banca", sets: 4, repsMin: 6, repsMax: 10, restSeconds: 120 },
          { name: "Press militar", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
          { name: "Elevaciones laterales", sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60 },
          { name: "Extensión de tríceps en polea", sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60 },
        ],
      },
      {
        label: "Pull",
        exercises: [
          { name: "Peso muerto", sets: 3, repsMin: 6, repsMax: 10, restSeconds: 120 },
          { name: "Dominadas", sets: 3, repsMin: 6, repsMax: 10, restSeconds: 90 },
          { name: "Remo con barra", sets: 4, repsMin: 8, repsMax: 12, restSeconds: 90 },
          { name: "Curl con barra", sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60 },
        ],
      },
      {
        label: "Legs",
        exercises: [
          { name: "Sentadilla", sets: 4, repsMin: 6, repsMax: 10, restSeconds: 120 },
          { name: "Zancadas", sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60 },
          { name: "Curl femoral", sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60 },
          { name: "Elevación de gemelos", sets: 4, repsMin: 12, repsMax: 15, restSeconds: 45 },
        ],
      },
    ],
  },
];
