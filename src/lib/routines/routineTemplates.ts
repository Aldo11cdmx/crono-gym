/**
 * routineTemplates.ts — plantillas base que el coach puede clonar en el plan de un atleta.
 *
 * Los nombres de ejercicio se resuelven contra el catálogo en tiempo de ejecución.
 * El matching es tolerante: intenta primero el nombre exacto normalizado, luego
 * un "slug" (solo alfanuméricos) y finalmente una coincidencia de contención.
 * Un ejercicio que no exista en el catálogo se descarta del día, y un día que se
 * queda vacío se descarta de la plantilla. Nunca se asigna una plantilla con cero
 * días válidos.
 */

import { normaliseExerciseName } from "@/hooks/useExerciseCatalog";

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

/** Solo alfanuméricos, para comparar nombres que difieren en espacios o guiones. */
function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Intenta resolver un nombre de plantilla contra una fila del catálogo.
 *
 * Estrategias, en orden:
 *  1. Coincidencia exacta normalizada (case/acento insensible)
 *  2. Coincidencia de slug (sin espacios ni signos)
 *  3. Contención: el nombre de la plantilla está dentro del del catálogo o viceversa
 *
 * Devuelve null cuando no hay match confiable: mejor omitir un ejercicio que
 * asignar una serie al movimiento equivocado.
 */
export function resolveExercise(
  name: string,
  catalog: Array<{ id: string; name: string; name_es?: string | null }>,
): { id: string; name: string; name_es: string | null } | null {
  const wanted = normaliseExerciseName(name);
  const wantedSlug = slug(name);
  if (wanted === "" && wantedSlug === "") return null;

  // 1. Exacto normalizado
  const exact = catalog.find((e) => normaliseExerciseName(e.name) === wanted);
  if (exact) return { id: exact.id, name: exact.name, name_es: exact.name_es ?? null };

  // 2. Slug (ej. "press militar" vs "press-militar")
  const bySlug = catalog.find((e) => slug(e.name) === wantedSlug);
  if (bySlug) return { id: bySlug.id, name: bySlug.name, name_es: bySlug.name_es ?? null };

  // 3. Contención (ej. "sentadilla" dentro de "sentadilla trasera")
  const byContain = catalog.find(
    (e) => {
      const en = normaliseExerciseName(e.name);
      return en.includes(wanted) || wanted.includes(en);
    },
  );
  if (byContain) return { id: byContain.id, name: byContain.name, name_es: byContain.name_es ?? null };

  return null;
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
