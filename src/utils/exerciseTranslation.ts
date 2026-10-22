import exercisesEs from "@/data/translations/exercises_es.json";

const dict = exercisesEs as Record<string, string>;
const lowerMap = new Map<string, string>();
for (const [k, v] of Object.entries(dict)) {
  lowerMap.set(k.trim().toLowerCase(), v);
}

export const getExerciseDisplayName = (exercise: { name: string; name_es?: string }): string => {
  if (exercise.name_es) return exercise.name_es;
  const key = exercise.name.trim().toLowerCase();
  return lowerMap.get(key) || exercise.name;
};

