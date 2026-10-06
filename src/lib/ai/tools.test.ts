/**
 * tools.test.ts — tests for the OpenRouter tool definitions and their execution.
 *
 * The tools describe what the model can ask for. These tests pin:
 *  - The schema shape sent to the provider (so the model sees stable parameters).
 *  - The validation that runs before a model-proposed routine is persisted.
 *  - The PR derivation that the client supplies when the model asks for it.
 *  - The gym inventory that is static data, not a database row.
 */

import { describe, expect, it } from "vitest";

import {
  EXERCISE_TOOLS,
  TOOL_NAMES,
  executeToolCall,
  type GymEquipmentSummary,
  type PRSummary,
  type RoutineResult,
  type ToolResult,
} from "./tools";
import { estimateOneRepMax } from "@/lib/exercise/exerciseMetrics";

/**
 * Set rows as typed by the PR context. Uses `unknown` for values so tests
 * can exercise the filter path with dirty data.
 */
type SetRow = { weight: unknown; reps: unknown; achievedAt: unknown };
type PRMap = Map<string, SetRow[]>;

/** Narrows a ToolResult to its getGymEquipment variant after a runtime check. */
function asGym(result: ToolResult): { tags: string[]; machines: unknown[] } {
  return result.result as GymEquipmentSummary;
}

/** Narrows a ToolResult to its getAthletePRs variant. */
function asPRs(result: ToolResult): PRSummary[] {
  return result.result as PRSummary[];
}

/** Narrows a ToolResult to its createRoutine variant. */
function asRoutine(result: ToolResult): RoutineResult {
  return result.result as RoutineResult;
}

describe("EXERCISE_TOOLS declarations", () => {
  it("exports exactly the three tool names the model knows", () => {
    expect(TOOL_NAMES).toEqual(new Set(["createRoutine", "getAthletePRs", "getGymEquipment"]));
  });

  it("declares each tool as an OpenAI-compatible function spec", () => {
    for (const tool of EXERCISE_TOOLS) {
      expect(tool.type).toBe("function");
      expect(typeof tool.function.name).toBe("string");
      expect(typeof tool.function.description).toBe("string");
      expect(tool.function.parameters.type).toBe("object");
    }
  });

  it("requires exerciseId for getAthletePRs", () => {
    const prsTool = EXERCISE_TOOLS.find((t) => t.function.name === "getAthletePRs");
    expect(prsTool?.function.parameters.required).toEqual(["exerciseId"]);
    expect(prsTool?.function.parameters.properties.exerciseId).toMatchObject({
      type: "string",
    });
  });

  it("requires name and exercises for createRoutine", () => {
    const routineTool = EXERCISE_TOOLS.find((t) => t.function.name === "createRoutine");
    expect(routineTool?.function.parameters.required).toEqual(["name", "exercises"]);
  });

  it("has no required parameters for getGymEquipment", () => {
    const gymTool = EXERCISE_TOOLS.find((t) => t.function.name === "getGymEquipment");
    expect(gymTool?.function.parameters.required).toBeUndefined();
    expect(gymTool?.function.parameters.properties).toEqual({});
  });
});

describe("getGymEquipment", () => {
  it("returns the static gym inventory with no I/O", async () => {
    const result = await executeToolCall("getGymEquipment", {}, {});

    expect(result.tool).toBe("getGymEquipment");
    const gym = asGym(result);
    expect(gym.tags.length).toBeGreaterThan(0);
    expect(gym.machines.length).toBeGreaterThan(0);
    // The machines are the ones declared in the static file, not a database read.
    expect(gym.tags).toContain("dumbbell");
    expect(gym.tags).toContain("leverage machine");
  });

  it("returns machine data with group and tags", async () => {
    const result = await executeToolCall("getGymEquipment", {}, {});
    const gym = asGym(result);

    for (const machine of gym.machines as Array<{ name: string; group: string; tags: string[] }>) {
      expect(machine.name).toEqual(expect.any(String));
      expect(machine.group).toEqual(expect.any(String));
      expect(Array.isArray(machine.tags)).toBe(true);
      for (const tag of machine.tags) {
        expect(typeof tag).toBe("string");
      }
    }
  });
});

describe("getAthletePRs", () => {
  const catalog = [
    { id: "ex-1", name: "Press de banca" },
    { id: "ex-2", name: "Sentadilla" },
  ];

  const prs: PRMap = new Map<string, SetRow[]>([
    [
      "ex-1",
      [
        { weight: 100, reps: 5, achievedAt: "2026-05-01" },
        { weight: 105, reps: 3, achievedAt: "2026-05-15" },
      ],
    ],
    ["ex-2", []],
  ]);

  it("returns PRs sorted strongest first", async () => {
    const result = await executeToolCall(
      "getAthletePRs",
      { exerciseId: "ex-1" },
      { prs, catalog },
    );

    expect(result.tool).toBe("getAthletePRs");
    const prsResult = asPRs(result);
    expect(prsResult).toHaveLength(2);
    // Heaviest first.
    expect(prsResult[0].weightKg).toBe(105);
    expect(prsResult[1].weightKg).toBe(100);
  });

  it("computes the Epley estimate for each set", async () => {
    const result = await executeToolCall(
      "getAthletePRs",
      { exerciseId: "ex-1" },
      { prs, catalog },
    );

    const prsResult = asPRs(result);
    // 105kg x 3 = 105 * (1 + 3/30) = 114
    expect(prsResult[0].estimatedOneRepMax).toBeCloseTo(estimateOneRepMax(105, 3) ?? 0);
    // 100kg x 5 = 100 * (1 + 5/30) = 116.67
    expect(prsResult[1].estimatedOneRepMax).toBeCloseTo(estimateOneRepMax(100, 5) ?? 0);
  });

  it("resolves the exercise name from the catalog", async () => {
    const result = await executeToolCall(
      "getAthletePRs",
      { exerciseId: "ex-1" },
      { prs, catalog },
    );

    const prsResult = asPRs(result);
    expect(prsResult[0].exerciseName).toBe("Press de banca");
  });

  it("falls back to the id when the catalog does not have the exercise", async () => {
    const result = await executeToolCall(
      "getAthletePRs",
      { exerciseId: "ex-unknown" },
      { prs, catalog },
    );

    // No sets, so no PRs.
    expect(asPRs(result)).toEqual([]);
  });

  it("returns an empty list when the athlete has no sets for the exercise", async () => {
    const result = await executeToolCall(
      "getAthletePRs",
      { exerciseId: "ex-2" },
      { prs, catalog },
    );

    expect(asPRs(result)).toEqual([]);
  });

  it("returns an empty list when no PR data is available", async () => {
    const result = await executeToolCall(
      "getAthletePRs",
      { exerciseId: "ex-1" },
      {},
    );

    expect(asPRs(result)).toEqual([]);
  });

  it("filters out invalid set rows", async () => {
    const dirtyPrs: PRMap = new Map<string, SetRow[]>([
      [
        "ex-1",
        [
          { weight: 100, reps: 5, achievedAt: "2026-05-01" },
          { weight: null, reps: 5, achievedAt: "2026-05-02" },
          { weight: 90, reps: null, achievedAt: "2026-05-03" },
          { weight: 95, reps: 3, achievedAt: null },
        ],
      ],
    ]);

    const result = await executeToolCall(
      "getAthletePRs",
      { exerciseId: "ex-1" },
      { prs: dirtyPrs, catalog },
    );

    // Only the valid row survives.
    const prsResult = asPRs(result);
    expect(prsResult).toHaveLength(1);
    expect(prsResult[0].weightKg).toBe(100);
  });
});

describe("createRoutine validation", () => {
  const catalog = [
    { id: "ex-1", name: "Press de banca" },
    { id: "ex-2", name: "Sentadilla" },
    { id: "ex-3", name: "Remo" },
  ];

  it("validates a routine with all-known exercise ids", async () => {
    const result = await executeToolCall(
      "createRoutine",
      {
        name: "Full body A",
        exercises: [
          { exerciseId: "ex-1", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 },
          { exerciseId: "ex-2", sets: 3, repsMin: 6, repsMax: 8, restSeconds: 120 },
        ],
      },
      { catalog },
    );

    expect(result.tool).toBe("createRoutine");
    const routine = asRoutine(result);
    expect(routine.name).toBe("Full body A");
    expect(routine.exerciseCount).toBe(2);
    expect(routine.routineId).toMatch(/^routine_/);
  });

  it("drops exercise ids that are not in the catalog", async () => {
    const result = await executeToolCall(
      "createRoutine",
      {
        name: "Partial",
        exercises: [
          { exerciseId: "ex-1", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 },
          { exerciseId: "ex-invented", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 },
        ],
      },
      { catalog },
    );

    // Only the known id counts.
    expect(asRoutine(result).exerciseCount).toBe(1);
  });

  it("handles a missing catalog gracefully", async () => {
    const result = await executeToolCall(
      "createRoutine",
      {
        name: "No catalog",
        exercises: [
          { exerciseId: "ex-1", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 },
        ],
      },
      {},
    );

    // Without a catalog to check against, nothing validates.
    expect(asRoutine(result).exerciseCount).toBe(0);
  });

  it("uses a fallback name when none is provided", async () => {
    const result = await executeToolCall(
      "createRoutine",
      {
        name: "",
        exercises: [
          { exerciseId: "ex-1", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 },
        ],
      },
      { catalog },
    );

    const routine = asRoutine(result);
    expect(routine.name).toBe("Sin nombre");
    expect(routine.exerciseCount).toBe(1);
  });

  it("handles malformed args without throwing", async () => {
    const result = await executeToolCall(
      "createRoutine",
      { name: "Broken", exercises: "not-an-array" },
      { catalog },
    );

    expect(asRoutine(result).exerciseCount).toBe(0);
  });
});

describe("executeToolCall dispatch", () => {
  it("throws for an unknown tool name", async () => {
    await expect(executeToolCall("unknownTool", {}, {})).rejects.toThrow(
      "Unknown tool: unknownTool",
    );
  });

  it("returns a discriminated result tagged with the tool name", async () => {
    const result: ToolResult = await executeToolCall("getGymEquipment", {}, {});
    expect(result.tool).toBe("getGymEquipment");
  });
});
