#!/usr/bin/env node
/**
 * scripts/runSeed.js — one-time server-side seed of the exercise catalog.
 *
 * Uses SERVICE_ROLE_KEY to bypass RLS: `exercises_select_authenticated` is
 * SELECT-only, so the anon key used by the browser can never write here.
 *
 * Safe to re-run: upserts on the `id` primary key (merge-duplicates), so a
 * failed run can simply be retried.
 *
 * Usage:
 *   node scripts/runSeed.js            # upsert the full catalog
 *   node scripts/runSeed.js --check    # report row count, write nothing
 *
 * NOTE: the normalizeRecord() logic below is duplicated from
 * src/services/seedExercises.ts. Keep the two in sync -- the EXPECTED_COUNT
 * assertion catches a divergence in record volume, not in field mapping.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EXPECTED_COUNT = 1324;
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 4;
const RAW_BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Minimal .env.local loader (avoids a dotenv dependency).
// ---------------------------------------------------------------------------
function loadEnvFile() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(ROOT, file), "utf8");
      for (const line of text.split("\n")) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const value = match[2].replace(/^["']|["']$/g, "");
        // Real env vars win over the file.
        if (!(match[1] in process.env)) process.env[match[1]] = value;
      }
    } catch {
      // File absent -- rely on the ambient environment.
    }
  }
}
loadEnvFile();

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SERVICE_ROLE_KEY;
const dataUrl =
  process.env.EXERCISES_DATA_URL ??
  process.env.VITE_EXERCISES_DATA_URL ??
  `${RAW_BASE}/data/exercises.json`;

const checkOnly = process.argv.includes("--check");

function fail(message) {
  console.error(`\n[seed] ERROR: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Normalization -- mirrors normalizeRecord() in src/services/seedExercises.ts
// ---------------------------------------------------------------------------
function normalizeRecord(raw) {
  if (!raw || typeof raw.id !== "string" || !raw.gif_url) return null;

  const steps = raw.instruction_steps?.es;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return {
    id: raw.id,
    name: raw.name,
    body_part: raw.body_part,
    target: raw.target,
    equipment: raw.equipment,
    gif_url: raw.gif_url.startsWith("http") ? raw.gif_url : `${RAW_BASE}/${raw.gif_url}`,
    instructions: steps,
  };
}

/** HTTP status codes worth retrying: rate limits and gateway hiccups. */
function isTransient(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

/**
 * POST/GET against PostgREST.
 *
 * Returns null for an empty body. This matters: with `Prefer: return=minimal`
 * a successful upsert replies 201 with NO body, and calling res.json() on that
 * throws "Unexpected end of JSON input" *after* the rows were written.
 */
async function rest(path, init = {}) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let res;
    try {
      res = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch (networkError) {
      lastError = new Error(`network: ${networkError.message}`);
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await sleep(500 * 2 ** (attempt - 1));
      continue;
    }

    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      lastError = new Error(
        `${init.method ?? "GET"} ${path} -> HTTP ${res.status}: ${body || "(empty body)"}`,
      );
      if (isTransient(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }

    // Empty body is a valid success (return=minimal -> 201, no content).
    const text = await res.text();
    if (text.length === 0) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  throw lastError;
}

async function countRows() {
  const res = await fetch(`${url}/rest/v1/exercises?select=id`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`count exercises -> HTTP ${res.status}: ${body}`);
  }
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

async function main() {
  if (!url) fail("Missing SUPABASE_URL / VITE_SUPABASE_URL.");
  if (!serviceKey) {
    fail(
      "Missing SERVICE_ROLE_KEY.\n" +
        "  Supabase Dashboard -> Project Settings -> API Keys -> service_role.\n" +
        "  Add it to .env.local as SERVICE_ROLE_KEY=...  (do NOT prefix with VITE_;\n" +
        "  VITE_ vars are bundled into the client and would leak the key.)",
    );
  }

  console.log(`[seed] project : ${url.replace(/\/+$/, "")}`);
  console.log(`[seed] dataset : ${dataUrl}`);

  let before;
  try {
    before = await countRows();
  } catch (error) {
    fail(`Cannot read the exercises table (is SERVICE_ROLE_KEY correct?)\n  ${error.message}`);
  }
  console.log(`[seed] current : ${before} rows in public.exercises`);

  if (checkOnly) {
    console.log("[seed] --check: no changes written.");
    return;
  }

  if (before >= EXPECTED_COUNT) {
    console.log(
      `[seed] already seeded (${before}/${EXPECTED_COUNT}); re-running to confirm idempotency.`,
    );
  }

  console.log("[seed] fetching dataset (17 MB, first run only)...");
  const datasetRes = await fetch(dataUrl);
  if (!datasetRes.ok) fail(`Dataset fetch failed: HTTP ${datasetRes.status}`);
  const raw = await datasetRes.json();
  if (!Array.isArray(raw)) fail("Dataset did not return a JSON array.");

  const rows = raw.map(normalizeRecord).filter(Boolean);
  console.log(`[seed] dataset : ${raw.length} records, ${rows.length} usable`);
  if (rows.length !== EXPECTED_COUNT) {
    console.warn(
      `[seed] WARNING: expected ${EXPECTED_COUNT} usable records, got ${rows.length}. ` +
        "This usually means normalizeRecord() has drifted from src/services/seedExercises.ts.",
    );
  }

  const started = Date.now();
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await rest("exercises?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(batch),
    });
    written += batch.length;
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[seed] batch ${i / BATCH_SIZE + 1}: ${written}/${rows.length} upserted (${elapsed}s)`);
  }

  const after = await countRows();
  console.log(`[seed] done    : ${after} rows in public.exercises`);

  if (after < rows.length) {
    fail(`Expected ${rows.length} rows after seeding, found ${after}. Re-run the script.`);
  }
  console.log("[seed] The client-side dataset fallback is no longer required.");
}

main().catch((error) => fail(error.message));