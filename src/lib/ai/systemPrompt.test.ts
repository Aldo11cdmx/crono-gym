/**
 * systemPrompt.test.ts — structural contract for the exercise prompt.
 *
 * The prompt is a constant sent to OpenRouter for exercise-specific queries.
 * These tests pin the properties that matter: flat text (no markdown), the
 * language boundary, and the response structure the client parser depends on.
 */

import { describe, expect, it } from "vitest";
import { EXERCISE_SYSTEM_PROMPT, parseExerciseResponse } from "./systemPrompt";

describe("EXERCISE_SYSTEM_PROMPT structure", () => {
  it("is a non-empty trimmed string", () => {
    expect(typeof EXERCISE_SYSTEM_PROMPT).toBe("string");
    expect(EXERCISE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(EXERCISE_SYSTEM_PROMPT).toBe(EXERCISE_SYSTEM_PROMPT.trim());
  });

  it("contains no asterisks — flat text only", () => {
    // The parser splits on line structure, not markup. A stray `*` once
    // caused a tool call to be swallowed as italic text.
    expect(EXERCISE_SYSTEM_PROMPT).not.toMatch(/\*/);
  });

  it("contains no markdown headers or bold markers", () => {
    expect(EXERCISE_SYSTEM_PROMPT).not.toContain("**");
    expect(EXERCISE_SYSTEM_PROMPT).not.toMatch(/#{1,6}\s/);
  });

  it("pins the output language to Mexican Spanish", () => {
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/español de México/);
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/NUNCA.*inglés/i);
  });

  it("forbids bot greetings and visible reasoning", () => {
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/No saludes/);
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/NUNCA muestres razonamiento/i);
  });

  it("describes the required response structure: header, body, tip", () => {
    expect(EXERCISE_SYSTEM_PROMPT).toContain("Músculos principales");
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/agarres, biomecánica o ejecución/i);
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/tip rápido/i);
  });

  it("carries the Epley formula and confidence window", () => {
    expect(EXERCISE_SYSTEM_PROMPT).toContain("1 + repeticiones / 30");
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/10 repeticiones/i);
  });

  it("carries the medical boundary as a product rule", () => {
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/NUNCA.*consejos médicos/i);
    expect(EXERCISE_SYSTEM_PROMPT).toMatch(/NUNCA.*suplementos/i);
  });

  it("does not carry data interpolation into the instructions", () => {
    expect(EXERCISE_SYSTEM_PROMPT).not.toContain("${");
    expect(EXERCISE_SYSTEM_PROMPT).not.toContain("undefined");
  });
});

describe("parseExerciseResponse", () => {
  it("splits a well-formed response into header and body", () => {
    const raw =
      "[Press de banca] — Pectorales\n\nLa técnica clave es mantener el arco lumbar.\nApoya los codos al 45°.\n\nTip: siempre empieza con el peso en los estacas.";
    const parsed = parseExerciseResponse(raw);
    expect(parsed?.header).toBe("[Press de banca] — Pectorales");
    expect(parsed?.body).toContain("La técnica clave");
    expect(parsed?.body).toContain("Tip: siempre empieza");
  });

  it("returns null for prose that does not start with a bracket", () => {
    expect(parseExerciseResponse("Hola, sobre el press de banca...")).toBeNull();
    expect(parseExerciseResponse("Press de banca — Pectorales")).toBeNull();
  });

  it("returns null for a missing closing bracket", () => {
    expect(parseExerciseResponse("[Press de banca — Pectorales\n\nCuerpo")).toBeNull();
  });

  it("handles a header-only response", () => {
    const parsed = parseExerciseResponse("[Sentadilla] — Cuádriceps");
    expect(parsed?.header).toBe("[Sentadilla] — Cuádriceps");
    expect(parsed?.body).toBe("");
  });

  it("does not leak the header into the body", () => {
    const parsed = parseExerciseResponse("[Curl] — Bíceps\nbody text here");
    expect(parsed?.body).not.toContain("[Curl]");
    expect(parsed?.body).toBe("body text here");
  });

  it("is never fooled by brackets inside the body", () => {
    const raw = "[Press militar] — Hombros\n\nUsa [grip neutral] para el codo.";
    const parsed = parseExerciseResponse(raw);
    expect(parsed?.header).toBe("[Press militar] — Hombros");
    expect(parsed?.body).toBe("Usa [grip neutral] para el codo.");
  });

  it("trims surrounding whitespace from both parts", () => {
    const parsed = parseExerciseResponse("  [Curl] — Bíceps\n\n  body  ");
    expect(parsed?.header).toBe("[Curl] — Bíceps");
    expect(parsed?.body).toBe("body");
  });
});
