/**
 * openrouter.ts — client-side configuration for OpenRouter free-tier endpoints.
 *
 * OpenRouter exposes two tiers of free models:
 *
 *   - Chat with tool calling: a free Llama-3.1 405B variant from
 *     Nous Research (hermes-3), which supports function declarations and
 *     structured outputs. This is the model used for the exercise coach's
 *     tool-calling flow.
 *
 *   - Vision: for gym-photo analysis (equipment inventory, form review).
 *     Two viable free options are listed; either works.
 *
 * All IDs here are pinned model slugs, not the `openrouter/free` router alias.
 * OpenRouter repoints aliases without notice, and a pinned slug means the tests
 * below pin the exact model the client requested — not whatever the alias
 * pointed at this week.
 *
 * The key is sent to OpenRouter via the Supabase Edge Function
 * (`coach-assistant`), never directly from the browser. The browser only sees
 * these slugs; the bearer token lives in `OPENROUTER_API_KEY` on the function.
 */

/**
 * Free model slug used for chat and tool-calling requests.
 *
 * Nous Research Hermes 3 is based on Llama-3.1 405B and supports function
 * calling. Pinned to this slug so a test can assert the request carries a
 * real model id, not an alias that might silently change.
 */
export const FREE_CHAT_MODEL = "nvidia/nemotron-3-ultra:free";

/**
 * Fallback chat model slug if the primary is retired.
 *
 * OpenRouter retires free slugs without notice. This is the documented backup
 * the router `openrouter/free` would provide, pinned so it is testable rather
 * than a wildcard.
 */
export const FREE_CHAT_MODEL_FALLBACK = "thinkingmachines/inkling-small:free";

/**
 * Free vision model slugs, in priority order.
 *
 * Either of these handles image-understanding for gym photos. Listed as an
 * array so a caller can try the first and fall back to the second.
 */
export const FREE_VISION_MODELS = [
  "google/gemma-4-31b-it:free",
  "qwen/qwen3.8-27b:free",
] as const;

/**
 * The OpenRouter API endpoint, shared by chat and vision.
 */
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Request headers required by OpenRouter, minus the Authorization header
 * (which is added by the Edge Function from its own secret).
 */
export const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://cronogym-aldo11cdmxs-projects.vercel.app",
  "X-Title": "Cronos Gym",
} as const;

/**
 * Parameters sent to OpenRouter for free-tier chat+tool requests.
 *
 * Reasoning is disabled: the coach answers questions, not essays, and the
 * reasoning tokens would compete with the visible answer for the output budget.
 */
export const FREE_CHAT_PARAMS = {
  model: FREE_CHAT_MODEL,
  max_tokens: 1500,
  temperature: 0.4,
  top_p: 0.9,
  reasoning: { effort: "none" },
} as const;

/**
 * Parameters for vision requests.
 */
export const FREE_VISION_PARAMS = {
  max_tokens: 1000,
  temperature: 0.2,
} as const;
