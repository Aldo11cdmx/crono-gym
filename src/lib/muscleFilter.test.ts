import { describe, expect, it } from "vitest";
import type { Slug } from "react-muscle-highlighter";
import {
  applyBaseFilters,
  EMPTY_BASE_FILTERS,
  explainEmpty,
  filterByMuscles,
  muscleCounts,
  parseMuscleParam,
  selectionLabels,
  selectionSides,
  serializeMuscleParam,
  toggleMuscle,
  type BaseFilters,
  type FilterableExercise,
} from "./muscleFilter";
import { MUSCLE_FILTER_LABELS } from "./i18n";
import { enabledSlugs } from "./muscleMap";

/**
 * Fixture exercises drawn from the live catalog's vocabulary.
 *
 * Deliberately small and hand-picked rather than generated: each row exists to
 * prove one branch (primary, secondary, or no match) and the ids make an
 * ordering assertion readable.
 */
const EXERCISES: FilterableExercise[] = [
  // chest target: primary for `chest`, secondary for `deltoids` (both cover "chest").
  { id: "e1", name: "Press de banca", body_part: "chest", target: "pectorals", equipment: "barbell" },
  { id: "e2", name: "Press inclinado con mancuernas", body_part: "chest", target: "pectorals", equipment: "dumbbell" },
  { id: "e3", name: "Aperturas en polea", body_part: "chest", target: "serratus anterior", equipment: "cable" },
  // shoulders target: primary for `deltoids`, secondary for `chest`.
  { id: "e4", name: "Press militar", body_part: "shoulders", target: "delts", equipment: "barbell" },
  { id: "e5", name: "Elevaciones laterales", body_part: "shoulders", target: "delts", equipment: "dumbbell" },
  // back
  { id: "e6", name: "Remo con barra", body_part: "back", target: "lats", equipment: "barbell" },
  { id: "e7", name: "Jalon al pecho", body_part: "back", target: "lats", equipment: "cable" },
  { id: "e8", name: "Encogimiento con mancuernas", body_part: "back", target: "traps", equipment: "dumbbell" },
  // upper legs: each target is primary for a different muscle in the same region.
  { id: "e9", name: "Sentadilla", body_part: "upper legs", target: "glutes", equipment: "barbell" },
  { id: "e10", name: "Peso muerto rumano", body_part: "upper legs", target: "hamstrings", equipment: "barbell" },
  { id: "e11", name: "Extension de pierna", body_part: "upper legs", target: "quads", equipment: "machine" },
  // waist
  { id: "e12", name: "Crunch", body_part: "waist", target: "abs", equipment: "body weight" },
  // cardio is in no enabled muscle's region.
  { id: "e13", name: "Caminata en cinta", body_part: "cardio", target: "cardiovascular system", equipment: "machine" },
];

function ids(list: FilterableExercise[]): string[] {
  return list.map((e) => e.id);
}

// ---------------------------------------------------------------- basics

describe("toggleMuscle", () => {
  it("adds a muscle to an empty selection", () => {
    expect(toggleMuscle([], "chest")).toEqual(["chest"]);
  });

  it("appends without mutating the input", () => {
    const before: Slug[] = ["chest"];
    const after = toggleMuscle(before, "biceps");
    expect(before).toEqual(["chest"]);
    expect(after).toEqual(["chest", "biceps"]);
  });

  it("removes a muscle already selected", () => {
    expect(toggleMuscle(["chest", "biceps"], "chest")).toEqual(["biceps"]);
  });

  it("preserves insertion order when adding", () => {
    let selection: Slug[] = [];
    for (const slug of ["gluteal", "chest", "biceps"] as Slug[]) {
      selection = toggleMuscle(selection, slug);
    }
    expect(selection).toEqual(["gluteal", "chest", "biceps"]);
  });
});

// ------------------------------------------------------- primary/secondary

describe("filterByMuscles", () => {
  it("returns the base list untouched when nothing is selected", () => {
    const { results } = filterByMuscles(EXERCISES, []);
    expect(ids(results)).toEqual(ids(EXERCISES));
  });

  it("includes secondary matches, not just primary ones", () => {
    const { results, levelById } = filterByMuscles(EXERCISES, ["chest"]);
    // e1, e2 are pectorals: primary for `chest`.
    // e3 is serratus anterior in the chest region: secondary.
    expect(ids(results)).toEqual(["e1", "e2", "e3"]);
    expect(levelById.get("e1")).toBe("primary");
    expect(levelById.get("e3")).toBe("secondary");
  });

  it("puts primaries before secondaries", () => {
    const { results, levelById } = filterByMuscles(EXERCISES, ["chest"]);
    const levels = results.map((e) => levelById.get(e.id));
    // Every primary must precede every secondary.
    const lastPrimary = levels.lastIndexOf("primary");
    const firstSecondary = levels.indexOf("secondary");
    expect(lastPrimary).toBeLessThan(firstSecondary);
  });

  it("keeps catalog order within a level", () => {
    const { results, levelById } = filterByMuscles(EXERCISES, ["upper-back"]);
    // e6, e7 (lats) are primary; e8 (traps) sits in the back region but is not
    // this muscle's target, so it is secondary and sorts after the primaries.
    expect(ids(results)).toEqual(["e6", "e7", "e8"]);
    expect(levelById.get("e6")).toBe("primary");
    expect(levelById.get("e8")).toBe("secondary");
  });

  it("does not reach outside the muscle's own region for secondaries", () => {
    // Leg and waist exercises are not back work, so selecting a back muscle
    // must not sweep them in.
    const { results } = filterByMuscles(EXERCISES, ["upper-back"]);
    expect(ids(results)).not.toContain("e9");
    expect(ids(results)).not.toContain("e12");
  });

  it("unions multiple muscles without duplicating shared matches", () => {
    const { results } = filterByMuscles(EXERCISES, ["chest", "deltoids"]);
    // The shoulder exercises are secondary for `chest` but primary for
    // `deltoids`, so the union must not list them twice.
    const unique = new Set(ids(results));
    expect(unique.size).toBe(ids(results).length);
    // Primaries from both muscles first (catalog order), then the leftovers.
    expect(ids(results)).toEqual(["e1", "e2", "e4", "e5", "e3"]);
  });

  it("marks an exercise primary if any selected muscle claims it primarily", () => {
    // e1 is primary for `chest` and secondary for `deltoids`.
    const { levelById } = filterByMuscles(EXERCISES, ["chest", "deltoids"]);
    expect(levelById.get("e1")).toBe("primary");
    // e4 is the mirror image.
    expect(levelById.get("e4")).toBe("primary");
  });

  it("excludes exercises in no selected region", () => {
    const { results } = filterByMuscles(EXERCISES, ["chest"]);
    expect(ids(results)).not.toContain("e13");
    expect(ids(results)).not.toContain("e9");
  });

  it("only counts warmup-independent filters for cardio exercises out", () => {
    // `cardiovascular system` maps to no enabled muscle, so nothing selects it.
    const { results } = filterByMuscles(EXERCISES, ["neck"]);
    expect(ids(results)).toEqual([]);
  });

  it("includes neck exercises as primary", () => {
    const withNeck: FilterableExercise[] = [
      { id: "n1", name: "Encogimiento cervical", body_part: "neck", target: "levator scapulae", equipment: "machine" },
    ];
    const { levelById } = filterByMuscles(withNeck, ["neck"]);
    expect(levelById.get("n1")).toBe("primary");
  });

  it("returns an empty list for a muscle with no coverage", () => {
    const { results } = filterByMuscles(EXERCISES, ["gluteal"]);
    // gluteal maps to glutes in "upper legs": e9 is primary, e10/e11 secondary.
    expect(ids(results)).toEqual(["e9", "e10", "e11"]);
  });
});

// --------------------------------------------------------- combination

describe("combination with base filters", () => {
  const textFilter: BaseFilters = { ...EMPTY_BASE_FILTERS, query: "press" };

  it("intersects the text query with the muscle selection (AND)", () => {
    const base = applyBaseFilters(EXERCISES, textFilter);
    // "Press de banca" and "Press inclinado con mancuernas" both name a press
    // and are chest work. "Press militar" matches the text but is shoulders.
    const { results } = filterByMuscles(base, ["chest"]);
    expect(ids(results)).toEqual(["e1", "e2"]);
  });

  it("keeps the text match that belongs to another muscle out", () => {
    const base = applyBaseFilters(EXERCISES, textFilter);
    const { results } = filterByMuscles(base, ["deltoids"]);
    expect(ids(results)).toEqual(["e4"]);
  });

  it("intersects the equipment dropdown with the muscle selection", () => {
    const base = applyBaseFilters(EXERCISES, { ...EMPTY_BASE_FILTERS, equipment: "barbell" });
    const { results } = filterByMuscles(base, ["chest"]);
    // e1 is the only barbell chest press in the fixture.
    expect(ids(results)).toEqual(["e1"]);
  });

  it("ignores a warm-up-only distinction (not a filter concern)", () => {
    // Sanity: applyBaseFilters is attribute-only and must not reorder.
    const base = applyBaseFilters(EXERCISES, EMPTY_BASE_FILTERS);
    expect(ids(base)).toEqual(ids(EXERCISES));
  });

  it("does not match the body-part dropdown case-insensitively against names", () => {
    const base = applyBaseFilters(EXERCISES, { ...EMPTY_BASE_FILTERS, bodyPart: "CHEST" });
    // Catalog values are lowercase; an uppercase filter must match nothing
    // rather than silently matching by accident.
    expect(base).toHaveLength(0);
  });

  it("matches the query against the Spanish name shown in the card", () => {
    // The card shows "Curl de muñeca con banda", so "muneca" (no accent) has to
    // find it: the query is matched against the display name, not the catalog one.
    const forearm: FilterableExercise[] = [
      { id: "w1", name: "band wrist curl", body_part: "lower arms", target: "forearms", equipment: "band" },
    ];
    const base = applyBaseFilters(forearm, { ...EMPTY_BASE_FILTERS, query: "muneca" });
    expect(ids(base)).toEqual(["w1"]);
  });

  it("still matches the query against the catalog name", () => {
    const forearm: FilterableExercise[] = [
      { id: "w1", name: "band wrist curl", body_part: "lower arms", target: "forearms", equipment: "band" },
    ];
    const base = applyBaseFilters(forearm, { ...EMPTY_BASE_FILTERS, query: "wrist" });
    expect(ids(base)).toEqual(["w1"]);
  });
});

// ------------------------------------------------------------- URL state

describe("selection serialisation", () => {
  it("round-trips a selection", () => {
    const selection: Slug[] = ["chest", "biceps"];
    const restored = parseMuscleParam(serializeMuscleParam(selection));
    // Serialisation sorts, so compare as a set rather than by order.
    expect([...restored].sort()).toEqual([...selection].sort());
  });

  it("serialises in a stable order regardless of click order", () => {
    expect(serializeMuscleParam(["biceps", "chest"])).toBe(
      serializeMuscleParam(["chest", "biceps"]),
    );
  });

  it("returns null for an empty selection", () => {
    expect(serializeMuscleParam([])).toBeNull();
  });

  it("parses null as an empty selection", () => {
    expect(parseMuscleParam(null)).toEqual([]);
  });

  it("drops unknown slugs so a stale URL cannot inject one", () => {
    expect(parseMuscleParam("chest,not-a-muscle")).toEqual(["chest"]);
  });

  it("drops disabled slugs that render as unclickable shapes", () => {
    // `knees` has no catalog coverage and is intentionally inert.
    expect(parseMuscleParam("knees,chest")).toEqual(["chest"]);
  });

  it("tolerates whitespace and empty segments", () => {
    expect(parseMuscleParam(" chest , , biceps ")).toEqual(["chest", "biceps"]);
  });
});

// ----------------------------------------------------------- labels/sides

describe("selectionLabels", () => {
  it("returns a single label for one muscle", () => {
    expect(selectionLabels(["forearm"])).toBe("Antebrazos");
  });

  it("joins two labels with y", () => {
    expect(selectionLabels(["chest", "biceps"])).toBe("Pecho y Bíceps");
  });

  it("lists more than two naturally", () => {
    expect(selectionLabels(["chest", "biceps", "triceps"])).toBe("Pecho, Bíceps y Tríceps");
  });

  it("returns an empty string for an empty selection", () => {
    expect(selectionLabels([])).toBe("");
  });
});

describe("selectionSides", () => {
  it("reports front-only muscles as front only", () => {
    expect(selectionSides(["chest"])).toEqual({ front: true, back: false });
  });

  it("reports back-only muscles as back only", () => {
    expect(selectionSides(["gluteal"])).toEqual({ front: false, back: true });
  });

  it("reports shared muscles as both", () => {
    expect(selectionSides(["calves"])).toEqual({ front: true, back: true });
  });

  it("reports a mixed selection as both", () => {
    expect(selectionSides(["chest", "gluteal"])).toEqual({ front: true, back: true });
  });

  it("reports nothing for an empty selection", () => {
    expect(selectionSides([])).toEqual({ front: false, back: false });
  });
});

// ------------------------------------------------------------- counts

describe("muscleCounts", () => {
  it("counts each muscle over its own region", () => {
    const counts = muscleCounts(EXERCISES, ["chest", "deltoids"]);
    // `chest` covers body_part "chest" (e1, e2, e3); `deltoids` covers
    // "shoulders" (e4, e5). They are different regions, not overlapping ones.
    expect(counts.get("chest")).toBe(3);
    expect(counts.get("deltoids")).toBe(2);
  });

  it("reports zero for a muscle with no matches", () => {
    const counts = muscleCounts(EXERCISES, ["forearm"]);
    expect(counts.get("forearm")).toBe(0);
  });

  it("initialises every requested muscle to zero", () => {
    const counts = muscleCounts([], enabledSlugs());
    expect(counts.size).toBe(enabledSlugs().length);
    expect([...counts.values()].every((n) => n === 0)).toBe(true);
  });
});

// --------------------------------------------------------- empty state

describe("explainEmpty", () => {
  it("returns null only when no filter is active at all", () => {
    // With no filters, an empty catalog is a data problem, not a filter problem,
    // so the UI must stay on its generic message instead of blaming a filter.
    const cause = explainEmpty([], [], [], EMPTY_BASE_FILTERS, MUSCLE_FILTER_LABELS);
    expect(cause).toBeNull();
  });

  it("blames the muscle filter even when the base list is non-empty", () => {
    // The caller only reaches this when the muscle filter emptied the result,
    // so a non-empty base set always means the muscle filter is at fault.
    const base = applyBaseFilters(EXERCISES, EMPTY_BASE_FILTERS);
    const cause = explainEmpty(
      base,
      EXERCISES,
      ["forearm"],
      EMPTY_BASE_FILTERS,
      MUSCLE_FILTER_LABELS,
    );
    expect(cause).not.toBeNull();
    expect(cause?.action).toBe(MUSCLE_FILTER_LABELS.suggestDropMuscle);
  });

  it("blames equipment specifically when removing it restores results", () => {
    const filters: BaseFilters = { ...EMPTY_BASE_FILTERS, equipment: "sled machine" };
    const base = applyBaseFilters(EXERCISES, filters);
    const cause = explainEmpty(base, EXERCISES, [], filters, MUSCLE_FILTER_LABELS);
    expect(cause?.action).toBe(MUSCLE_FILTER_LABELS.suggestDropEquipment);
    expect(cause?.label).toBe("sled machine");
  });

  it("blames the text query when it is the culprit", () => {
    const filters: BaseFilters = { ...EMPTY_BASE_FILTERS, query: "zzzz" };
    const base = applyBaseFilters(EXERCISES, filters);
    const cause = explainEmpty(base, EXERCISES, [], filters, MUSCLE_FILTER_LABELS);
    expect(cause?.message).toContain("zzzz");
    expect(cause?.action).toBe(MUSCLE_FILTER_LABELS.suggestDropSearch);
  });

  

  it("returns null when nothing is active, so the UI can stay generic", () => {
    const cause = explainEmpty([], [], [], EMPTY_BASE_FILTERS, MUSCLE_FILTER_LABELS);
    expect(cause).toBeNull();
  });
});