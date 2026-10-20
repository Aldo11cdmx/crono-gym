/**
 * types.ts — the shape of a row in the local exercise catalog.
 *
 * The catalog is the 1,324-exercise dataset shipped with the app. It is richer
 * than the `exercises` table: it keeps the nine-language instruction map, the
 * static photo, the secondary muscles and the media id, none of which the
 * server copy preserves.
 *
 * The type lives here, and not in the component that renders it, because the
 * catalog is now loaded at runtime: the loader, the picker and the importers
 * all need to agree on the shape without importing the data itself.
 */

export interface CatalogExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  gif_url: string;
  image: string;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  availableInCronosGym: boolean;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
  media_id: string;
  created_at: string;
  attribution: string | null;
}

/**
 * A catalog row is only usable if it can be identified and rendered: a name to
 * show and an id to key the list on. Rows missing those are dropped instead of
 * crashing the picker.
 */
export function isCatalogExercise(value: unknown): value is CatalogExercise {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CatalogExercise>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.name === "string" &&
    typeof row.gif_url === "string"
  );
}
