// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { CatalogExercise } from "@/lib/catalog/types";
import { CATALOG_OVERRIDES_KEY, invalidateOverridesSnapshot } from "@/lib/catalog/customExercises";
import { resetCatalogRegistry } from "@/lib/catalog/catalogRegistry";
import {
  DAY_ZERO_REST_SECONDS,
  buildDayZeroPlan,
  dayZeroDraft,
  dayZeroRoutineRow,
  groupOf,
  isAvailableForDayZero,
  toPlanExercise,
  type DayZeroGroup,
} from "./dayZeroPlan";

function row(overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id: "0001",
    name: "Push-up",
    name_es: null,
    category: "strength",
    body_part: "chest",
    equipment: "body weight",
    gif_url: "https://cdn.example/0001.gif",
    image: "https://cdn.example/0001.jpg",
    muscle_group: "chest",
    secondary_muscles: [],
    target: "pectorals",
    availableInCronosGym: true,
    equipment_id: "NONE",
    instructions: {},
    instruction_steps: {},
    media_id: "0001",
    created_at: "2026-01-01T00:00:00.000Z",
    attribution: null,
    ...overrides,
  };
}

/** Enough distinct groups and muscles to fill a six-exercise day. */
const PATTERNS = [
  "squat",
  "hinge",
  "horizontal_push",
  "horizontal_pull",
  "extension",
  "curl",
  "isolation",
] as const;
const MUSCLES = [
  "quadriceps",
  "hamstrings",
  "chest",
  "lats",
  "triceps",
  "biceps",
  "deltoids",
  "abdominals",
];

function catalogOf(count = 24): CatalogExercise[] {
  return Array.from({ length: count }, (_, index) =>
    row({
      id: String(index + 1).padStart(4, "0"),
      name: `Exercise ${index + 1}`,
      body_part: MUSCLES[index % MUSCLES.length],
      muscle_group: MUSCLES[index % MUSCLES.length],
      movement_pattern: PATTERNS[index % PATTERNS.length] as CatalogExercise["movement_pattern"],
      equipment: index % 2 === 0 ? "body weight" : "barbell",
      equipment_id: index % 2 === 0 ? "NONE" : "CG-EQP-0003",
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetCatalogRegistry();
  invalidateOverridesSnapshot();
});

describe("isAvailableForDayZero", () => {
  it("takes a normal row", () => {
    expect(isAvailableForDayZero(row())).toBe(true);
  });

  it("drops a row the dataset marked unavailable", () => {
    expect(isAvailableForDayZero(row({ availableInCronosGym: false }))).toBe(false);
  });

  it("drops a row that claims availability but has no station", () => {
    expect(isAvailableForDayZero(row({ availableInCronosGym: true, station_key: "unavailable_station" }))).toBe(false);
  });

  it("drops a row the coach removed from the catalog", () => {
    window.localStorage.setItem(CATALOG_OVERRIDES_KEY, JSON.stringify({ "0001": { deleted: true } }));
    invalidateOverridesSnapshot();
    expect(isAvailableForDayZero(row())).toBe(false);
  });
});

describe("buildDayZeroPlan", () => {
  it("never plans an exercise the gym cannot host", () => {
    const catalog = [
      ...catalogOf(7),
      row({ id: "9001", availableInCronosGym: false, movement_pattern: "squat" }),
      row({ id: "9002", station_key: "unavailable_station", movement_pattern: "squat" }),
    ];
    const plan = buildDayZeroPlan({ catalog, frequency: 3, goal: "hypertrophy", level: "beginner" });

    // Seven available rows fill one day and part of a second; the third cannot be trained, so it is not written.
    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.days.every((day) => day.exercises.length > 0)).toBe(true);
    expect(plan.days.flatMap((day) => day.exercises).every((exercise) => isAvailableForDayZero(exercise.row))).toBe(true);
    expect(plan.days.flatMap((day) => day.exercises).map((exercise) => exercise.row.id)).not.toContain("9001");
    expect(plan.days.flatMap((day) => day.exercises).map((exercise) => exercise.row.id)).not.toContain("9002");
  });

  it("splits the days by anatomical group, not by movement pattern", () => {
    const plan = buildDayZeroPlan({
      catalog: catalogOf(),
      frequency: 2,
      goal: "general_fitness",
      level: "beginner",
    });
    const groups = plan.days[0].exercises.map((exercise) =>
      groupOf(exercise.row),
    );
    // Day one is "Full body A": quads, chest, back, posterior chain and core.
    expect(new Set(groups)).toEqual(
      new Set<DayZeroGroup>(["quads", "chest", "back", "posterior_leg", "core"]),
    );
    expect(plan.days.map((day) => day.label)).toEqual(["Full body A", "Full body B"]);
  });

  it("names the split of the frequency the coach asked for", () => {
    const pushPullLegs = buildDayZeroPlan({
      catalog: catalogOf(21),
      frequency: 3,
      goal: "hypertrophy",
      level: "beginner",
    });
    expect(pushPullLegs.days.map((day) => day.label)).toEqual(["Empuje", "Tirón", "Pierna"]);

    const upperLower = buildDayZeroPlan({
      catalog: catalogOf(28),
      frequency: 4,
      goal: "hypertrophy",
      level: "intermediate",
    });
    expect(upperLower.days.map((day) => day.label)).toEqual([
      "Tren superior A",
      "Tren inferior A",
      "Tren superior B",
      "Tren inferior B",
    ]);

    const vTaper = buildDayZeroPlan({
      catalog: catalogOf(35),
      frequency: 5,
      goal: "hypertrophy",
      level: "advanced",
    });
    expect(vTaper.days.map((day) => day.label)).toEqual([
      "Empuje A",
      "Tirón A",
      "Pierna",
      "Empuje B",
      "Tirón B",
    ]);
  });

  it("takes the machine before the free weight inside a group", () => {
    const catalog = [
      row({ id: "1001", muscle_group: "quadriceps", movement_pattern: "squat", equipment_id: "CG-EQP-0021", station_key: "leg_extension" }),
      row({ id: "1002", muscle_group: "quadriceps", movement_pattern: "squat", equipment_id: "NONE", station_key: "free_weight_area" }),
    ];
    const plan = buildDayZeroPlan({ catalog, frequency: 2, goal: "hypertrophy", level: "beginner" });
    const quads = plan.days[0].exercises
      .map((exercise) => exercise.row)
      .filter((row) => groupOf(row) === "quads");
    expect(quads[0].id).toBe("1001");
  });

  it("never repeats an exercise across days", () => {
    const plan = buildDayZeroPlan({
      catalog: catalogOf(),
      frequency: 2,
      goal: "general_fitness",
      level: "intermediate",
    });
    const ids = plan.days.flatMap((day) => day.exercises.map((exercise) => exercise.row.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every day its own ids and a readable label", () => {
    let counter = 0;
    const plan = buildDayZeroPlan({
      catalog: catalogOf(),
      frequency: 3,
      goal: "hypertrophy",
      level: "beginner",
      newId: () => `id-${++counter}`,
    });
    expect(plan.days.map((day) => day.label)).toEqual(["Empuje", "Tirón", "Pierna"]);
    expect(new Set(plan.days.map((day) => day.id)).size).toBe(3);
    const rowIds = plan.days.flatMap((day) => day.exercises.map((exercise) => exercise.rowId));
    expect(new Set(rowIds).size).toBe(rowIds.length);
    expect(plan.days.every((day) => day.exercises.length > 0)).toBe(true);
  });

  it("resizes a day without dropping its main lift", () => {
    const plan = buildDayZeroPlan({
      catalog: catalogOf(28),
      frequency: 3,
      goal: "hypertrophy",
      level: "beginner",
      perDay: 3,
    });
    expect(plan.days.every((day) => day.exercises.length <= 3)).toBe(true);
    // A short "Empuje" keeps its chest work: the first slot is the main lift.
    expect(groupOf(plan.days[0].exercises[0].row)).toBe("chest");
  });

  it("scales sets and reps with the goal", () => {
    const strength = buildDayZeroPlan({ catalog: catalogOf(), frequency: 2, goal: "strength", level: "advanced" });
    const hypertrophy = buildDayZeroPlan({ catalog: catalogOf(), frequency: 2, goal: "hypertrophy", level: "intermediate" });

    const setsOf = (plan: typeof strength) => plan.days[0].exercises[0].sets;
    const repsOf = (plan: typeof strength) => plan.days[0].exercises[0].reps;
    expect(setsOf(strength)).toBeGreaterThan(setsOf(hypertrophy));
    expect(repsOf(strength)).toBeLessThan(repsOf(hypertrophy));
  });

  it("yields no days when the gym cannot host anything", () => {
    const plan = buildDayZeroPlan({
      catalog: [row({ availableInCronosGym: false }), row({ station_key: "unavailable_station" })],
      frequency: 4,
      goal: "hypertrophy",
      level: "beginner",
    });
    expect(plan.days).toEqual([]);
  });

  it("promises only the days it can actually write", () => {
    const catalog = [
      row({ id: "2001", muscle_group: "chest", movement_pattern: "horizontal_push" }),
      row({ id: "2002", muscle_group: "chest", movement_pattern: "horizontal_push" }),
    ];
    const plan = buildDayZeroPlan({
      catalog,
      frequency: 5,
      goal: "hypertrophy",
      level: "beginner",
    });
    // Two chest rows fill the push day; the rest of the split has nothing to
    // train, so it is not written and the title does not promise it.
    expect(plan.days).toHaveLength(1);
    expect(plan.title).toBe("Cronos Day 0 · 1 día");
  });
  it("is stable for the same catalog and answers", () => {
    const first = buildDayZeroPlan({ catalog: catalogOf(), frequency: 2, goal: "hypertrophy", level: "beginner" });
    const second = buildDayZeroPlan({ catalog: catalogOf(), frequency: 2, goal: "hypertrophy", level: "beginner" });
    expect(first.days.map((day) => day.exercises.map((exercise) => exercise.row.id))).toEqual(
      second.days.map((day) => day.exercises.map((exercise) => exercise.row.id)),
    );
  });
});

describe("dayZeroDraft", () => {
  it("writes one training day per plan day, with sets and rest", () => {
    const plan = buildDayZeroPlan({ catalog: catalogOf(), frequency: 2, goal: "hypertrophy", level: "beginner" });
    const draft = dayZeroDraft(plan, null);

    expect(draft.id).toBeNull();
    expect(draft.mode).toBe("single");
    expect(draft.days).toHaveLength(2);
    expect(draft.days.every((day) => day.kind === "training" && day.weekday === null)).toBe(true);
    expect(draft.days[0].exercises[0].target_sets).toBe(3);
    expect(draft.days[0].exercises[0].rest_seconds).toBe(DAY_ZERO_REST_SECONDS);
    expect(draft.days[0].exercises[0].target_reps_min).toBeLessThanOrEqual(
      draft.days[0].exercises[0].target_reps_max as number,
    );
  });

  it("keeps the routine id when it is known, so a retry does not fork", () => {
    const plan = buildDayZeroPlan({ catalog: catalogOf(), frequency: 2, goal: "hypertrophy", level: "beginner" });
    expect(dayZeroDraft(plan, "routine-1").id).toBe("routine-1");
  });
});

describe("dayZeroRoutineRow", () => {
  it("is a routine card the list can render before the server answers", () => {
    const plan = buildDayZeroPlan({ catalog: catalogOf(), frequency: 2, goal: "hypertrophy", level: "beginner" });
    const row = dayZeroRoutineRow(plan, "routine-1", "user-1", "2026-01-01T00:00:00.000Z");

    expect(row.id).toBe("routine-1");
    expect(row.user_id).toBe("user-1");
    expect(row.routineMode).toBe("single");
    expect(row.exercises).toHaveLength(12);
    expect(row.exercises[0].dayIndex).toBe(0);
    expect(row.exercises.at(-1)?.dayIndex).toBe(1);
    expect(row.description).toContain("single");
  });
});

describe("toPlanExercise", () => {
  it("carries the coach's rename and machine into the routine link", () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({ "0001": { equipment_id: "CG-EQP-0012", customNameEs: "Press de banca" } }),
    );
    const exercise = toPlanExercise(catalogOf(1)[0]);

    expect(exercise.name_es).toBe("Press de banca");
    expect(exercise.equipment).toBe("body weight");
    expect(exercise.id).toBe("0001");
  });

  it("keeps the raw equipment the smart engine reads", () => {
    expect(toPlanExercise(catalogOf(2)[1]).equipment).toBe("barbell");
  });
});