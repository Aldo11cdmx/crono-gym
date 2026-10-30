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

import { resolveMediaUrl } from "@/lib/media/mediaResolver";
import type { Exercise } from "@/types/supabase";
import type { CatalogExercise } from "./types";

/** One catalog row as an exercise row. */
export function toExercise(row: CatalogExercise): Exercise {
  return {
    id: row.id,
    name: row.name,
    name_es: null,
    body_part: row.body_part,
    target: row.target,
    equipment: row.equipment,
    gif_url: resolveMediaUrl(row.gif_url),
    instructions: row.instruction_steps?.es ?? [],
    is_active: true,
    is_hidden: false,
  };
}

/** The whole catalog as exercise rows. */
export function toExercises(rows: CatalogExercise[]): Exercise[] {
  return rows.map(toExercise);
}
