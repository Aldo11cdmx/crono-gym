/**
 * openrouter.test.ts — pins the free-tier endpoint configuration.
 *
 * These constants are the one place the client-side code says which free
 * model to ask for. Pinning them in tests catches a silent change: OpenRouter
 * retires free slugs, and an alias that gets repointed would swap the model
 * under the same code without this file noticing.
 */

import { describe, expect, it } from "vitest";
import {
  FREE_CHAT_MODEL,
  FREE_CHAT_MODEL_FALLBACK,
  FREE_VISION_MODELS,
  OPENROUTER_API_URL,
  OPENROUTER_HEADERS,
  FREE_CHAT_PARAMS,
} from "./openrouter";

describe("Free model slugs", () => {
  it("pins the chat+tool model to a real slug, not an alias", () => {
    expect(FREE_CHAT_MODEL).toBe("nousresearch/hermes-3-llama-3.1-405b:free");
    expect(FREE_CHAT_MODEL).not.toBe("openrouter/free");
  });

  it("names a fallback model", () => {
    expect(FREE_CHAT_MODEL_FALLBACK).toBe("openrouter/free");
  });

  it("lists at least one vision model", () => {
    expect(FREE_VISION_MODELS.length).toBeGreaterThanOrEqual(1);
  });

  it("specifies the requested vision models", () => {
    expect(FREE_VISION_MODELS).toContain("google/gemma-4-31b-it:free");
    expect(FREE_VISION_MODELS).toContain("qwen/qwen3.8-27b:free");
  });
});

describe("OpenRouter endpoint", () => {
  it("targets the production API URL", () => {
    expect(OPENROUTER_API_URL).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("sets the HTTP-Referer to the app origin", () => {
    expect(OPENROUTER_HEADERS["HTTP-Referer"]).toBe("https://cronos.app");
  });

  it("sets X-Title for the app", () => {
    expect(OPENROUTER_HEADERS["X-Title"]).toBe("Cronos Coach");
  });
});

describe("Request parameters", () => {
  it("uses the pinned model for chat requests", () => {
    expect(FREE_CHAT_PARAMS.model).toBe(FREE_CHAT_MODEL);
  });

  it("disables reasoning to keep answers short", () => {
    expect(FREE_CHAT_PARAMS.reasoning).toEqual({ effort: "none" });
  });

  it("caps tokens at a budget that fits a short answer", () => {
    expect(FREE_CHAT_PARAMS.max_tokens).toBeLessThanOrEqual(2048);
    expect(FREE_CHAT_PARAMS.max_tokens).toBeGreaterThan(0);
  });
});
