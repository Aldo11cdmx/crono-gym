import exercisesEs from "@/data/translations/exercises_es.json";
import { readNameOverride } from "@/lib/catalog/customExercises";

const dict = exercisesEs as Record<string, string>;
const lowerMap = new Map<string, string>();
for (const [k, v] of Object.entries(dict)) {
  lowerMap.set(k.trim().toLowerCase(), v);
}

/**
 * The name to show for an exercise, whichever screen asks.
 *
 * Order: the name a coach gave it, the Spanish translation, then the English row.
 * The coach's name wins everywhere that passes the catalog id, which is why a
 * rename made in the portal is visible in history, in the picker and in the
 * session without each screen being taught about overrides.
 */
export const getExerciseDisplayName = (exercise: {
  id?: string | null;
  name: string;
  name_es?: string | null;
}): string => {
  if (exercise.id) {
    const custom = readNameOverride(exercise.id);
    if (custom) return custom;
  }
  if (exercise.name_es) return exercise.name_es;
  const key = exercise.name.trim().toLowerCase();
  return lowerMap.get(key) || exercise.name;
};