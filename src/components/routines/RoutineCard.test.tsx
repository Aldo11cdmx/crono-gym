/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { RoutineCard } from "./RoutineCard";
import type { RoutineWithExercises } from "@/hooks/useGymData";

function makeRoutine(overrides: Partial<RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" }> = {}): RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" } {
  return {
    id: "routine-1",
    user_id: "user-1",
    title: "Mi rutina",
    description: "Rutina de prueba",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    exercises: [],
    routineMode: "single",
    ...overrides,
  } as unknown as RoutineWithExercises & { routineMode: "single" | "weekly" | "legacy" };
}

describe("RoutineCard (visual limpia)", () => {
  it("renderiza base vacía sin romper", () => {
    const { container } = render(
      <RoutineCard routine={makeRoutine()} onTrain={vi.fn()} onEdit={vi.fn()} />,
    );
    expect(container).toBeTruthy();
  });
});
