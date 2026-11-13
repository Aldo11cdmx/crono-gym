/**
 * exerciseAdapter.ts — the catalog in the shape the app already speaks.
 *
 * The catalog keeps more than the `exercises` table does: the static photo, the
 * secondary muscles, the nine-language instructions, the media id. The table
 * keeps a flat row: an id, a name, a muscle, a piece of equipment and a list
 * of steps.
 *
 * The adapter is the one place that knows how to go from one to the other, so
 * the components that read an `Exercise` never have to care where it came
 * from. The steps it produces are the same ones the table was seeded with:
 * the Spanish ones.
 */

import type { Exercise } from "@/types/supabase";
import { readOverridesSnapshot } from "./customExercises";
import { resolveCatalogExercise } from "./resolveExercise";
import type { CatalogExercise } from "./types";

/**
 * Curated, explicit translations for complete exercise names only.
 * No word-by-word substitution. No hybrid translations.
 */
const EXERCISE_NAME_ES_MAP: Record<string, string> = {
  "barbell bench press": "Press de banca con barra",
  "incline barbell bench press": "Press inclinado con barra",
  "decline barbell bench press": "Press declinado con barra",
  "dumbbell bench press": "Press de banca con mancuernas",
  "incline dumbbell bench press": "Press inclinado con mancuernas",
  "decline dumbbell bench press": "Press declinado con mancuernas",
  "barbell squat": "Sentadilla con barra",
  "front squat": "Sentadilla frontal",
  "dumbbell squat": "Sentadilla con mancuernas",
  "romanian deadlift": "Peso muerto rumano",
  "barbell deadlift": "Peso muerto con barra",
  "conventional deadlift": "Peso muerto convencional",
  "lat pulldown": "Jalón al pecho",
  "wide grip lat pulldown": "Jalón al pecho con agarre amplio",
  "pull up": "Dominadas",
  "chin up": "Dominadas con agarre supino",
  "barbell row": "Remo con barra",
  "bent over row": "Remo inclinado con barra",
  "dumbbell row": "Remo con mancuerna a una mano",
  "one arm dumbbell row": "Remo a una mano con mancuerna",
  "barbell shoulder press": "Press militar con barra",
  "dumbbell shoulder press": "Press de hombros con mancuernas",
  "shoulder press": "Press de hombros",
  "dumbbell lateral raise": "Elevación lateral con mancuernas",
  "lateral raise": "Elevación lateral",
  "dumbbell front raise": "Elevación frontal con mancuernas",
  "front raise": "Elevación frontal",
  "dumbbell rear lateral raise": "Elevación posterior con mancuernas",
  "rear lateral raise": "Elevación posterior",
  "dumbbell bicep curl": "Curl de bíceps con mancuernas",
  "barbell curl": "Curl de bíceps con barra",
  "bicep curl": "Curl de bíceps",
  "dumbbell hammer curl": "Curl martillo con mancuernas",
  "hammer curl": "Curl martillo",
  "triceps pushdown": "Extensión de tríceps en polea",
  "cable pushdown": "Extensión de tríceps en polea",
  "leg extension": "Extensión de cuádriceps",
  "leg curl": "Curl femoral",
  "lying leg curl": "Curl femoral tumbado",
  "seated leg curl": "Curl femoral sentado",
  "leg press": "Prensa de piernas",
  "dumbbell lunge": "Zancada con mancuernas",
  "walking lunge": "Zancada caminando",
  "lunge": "Zancada",
  "standing calf raise": "Elevación de talones de pie",
  "seated calf raise": "Elevación de talones sentado",
  "calf raise": "Elevación de talones",
  "plank": "Plancha",
  "crunch": "Crunch abdominal",
  "cable fly": "Aperturas en polea",
  "dumbbell fly": "Aperturas con mancuernas",
  "pec fly": "Aperturas en máquina",
};

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function deriveNameEs(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const key = normalizeKey(name);
  const translated = EXERCISE_NAME_ES_MAP[key];
  if (translated) {
    return translated;
  }
  return null;
}

/** One catalog row as an exercise row, with the coach's overrides applied. */
export function toExercise(row: CatalogExercise): Exercise {
  const resolved = resolveCatalogExercise(withCuratedName(row));
  return {
    id: resolved.id,
    name: resolved.name,
    name_es: resolved.nameEs,
    body_part: resolved.body_part,
    target: resolved.target,
    equipment: resolved.equipment,
    gif_url: resolved.effectiveGifUrl,
    instructions: resolved.instruction_steps?.es ?? [],
    is_active: true,
    is_hidden: false,
  };
}

/** The whole catalog as exercise rows, resolved with a single read of the overrides. */
export function toExercises(rows: CatalogExercise[]): Exercise[] {
  const overrides = readOverridesSnapshot();
  return rows.map((row) => {
    const resolved = resolveCatalogExercise(withCuratedName(row), overrides);
    return {
      id: resolved.id,
      name: resolved.name,
      name_es: resolved.nameEs,
      body_part: resolved.body_part,
      target: resolved.target,
      equipment: resolved.equipment,
      gif_url: resolved.effectiveGifUrl,
      instructions: resolved.instruction_steps?.es ?? [],
      is_active: true,
      is_hidden: false,
    };
  });
}

/**
 * The curated Spanish name, when the dataset has none.
 *
 * The resolver reads `name_es` and the shared dictionary; this map is the third
 * fallback the adapter has always had, and it is kept in front of the resolver so
 * a row without `name_es` keeps its curated translation.
 */
function withCuratedName(row: CatalogExercise): CatalogExercise {
  if (row.name_es) return row;
  const derived = deriveNameEs(row.name);
  return derived ? { ...row, name_es: derived } : row;
}
