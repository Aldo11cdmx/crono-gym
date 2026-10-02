#!/usr/bin/env node
/**
 * scripts/seedDemoTraining.js — fills one account with a plausible training
 * history so the ranks map has something real to render.
 *
 * Two things make this different from `runSeed.js`:
 *
 *  1. It writes to a *user's* rows, not to the catalog. `workout_logs` and
 *     `completed_sets` are RLS-protected, so this uses SERVICE_ROLE_KEY exactly
 *     like the catalog seed does. Never expose that key to the browser.
 *  2. It is scoped to one email and marks everything it writes, so `--clean`
 *     can remove exactly this data and nothing else. Deleting a real user's
 *     training history by accident is not recoverable.
 *
 * Usage:
 *   node scripts/seedDemoTraining.js --email someone@example.com          # write
 *   node scripts/seedDemoTraining.js --email someone@example.com --dry-run # plan only
 *   node scripts/seedDemoTraining.js --email someone@example.com --clean   # remove
 *   node scripts/seedDemoTraining.js --report --email ...                # predict ranks
 *
 * The `--report` flag is the important one. It runs the *real* scorer over the
 * data it is about to write and prints the ranks each muscle will land on, so
 * the numbers below can be tuned against what the app will actually show rather
 * than against arithmetic done by hand in a comment.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MARKER = "[seed:demo-training]";
const WEEKS = 12;
const BATCH_SIZE = 200;
const MAX_ATTEMPTS = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------

function loadEnvFile() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(ROOT, file), "utf8");
      for (const line of text.split("\n")) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const value = match[2].replace(/^["']|["']$/g, "");
        if (!(match[1] in process.env)) process.env[match[1]] = value;
      }
    } catch {
      /* file absent -- rely on the ambient environment */
    }
  }
}
loadEnvFile();

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`\n[seed-demo] ERROR: ${message}\n`);
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] ?? "";
}
const has = (name) => process.argv.includes(`--${name}`);

// ---------------------------------------------------------------------------
// The program
// ---------------------------------------------------------------------------

/**
 * Levels are expressed as multiples of the movement's Gold standard ratio, not
 * as absolute kilograms, because the scorer compares e1RM/bodyweight against
 * `STANDARD_RATIOS`. A level of 1.00 lands exactly on the Gold reference; 1.30
 * is meaningfully above it. Expressing the plan in the same unit the scorer uses
 * is what makes the resulting ranks predictable instead of accidental.
 *
 * These describe an *advanced* trainee on purpose. The ladder asks ~1.2-2.4x the
 * Gold ratio for Platino, and Gold is already 1.25x bodyweight on the bench and
 * 2.0x on the deadlift, so realistic beginner numbers top out near Bronze/Silver
 * and would never exercise the colours this demo exists to show.
 */
/**
 * `level` is the FINAL-WEEK level: a multiple of the movement's Gold standard
 * ratio, where 1.00 lands exactly on the Gold reference. It is not the starting
 * load. The generator back-loads the progression to hit it, so these numbers read
 * directly against `STANDARD_RATIOS` and can be tuned without mentally inverting
 * the progression curve.
 *
 * `strengthRatioToPercent` turns that into `(level - 0.4) / 1.7 * 100`, and the
 * score is `0.7 * strength + 0.3 * volume`, so a level around 1.6-1.7 lands
 * Diamante, 1.3-1.45 Platino and 0.9-1.05 Oro. `--report` is the real check: it
 * runs the scorer itself and prints the ranks.
 */
const PROGRAM = [
  {
    id: "pierna-1",
    label: "Pierna · squat",
    slots: [
      // The two strongest signals in the plan, and the reason the map has a
      // Diamante to show at all.
      { exerciseId: "0043", level: 1.76, sets: 4, reps: 5 }, // barbell full squat
      { exerciseId: "0124", level: 1.58, sets: 3, reps: 8 }, // barbell wide squat
      { exerciseId: "0044", level: 1.22, sets: 3, reps: 8 }, // barbell good morning
      // Accessories trained every other week. Frequency alone drops them to
      // Bronce however heavy the load is, which is what volume consistency means.
      { exerciseId: "0168", level: 0.62, sets: 3, reps: 10, everyOtherWeek: true },
      { exerciseId: "1372", level: 0.60, sets: 3, reps: 10, everyOtherWeek: true },
    ],
  },
  {
    id: "pierna-2",
    label: "Pierna · bisagra",
    slots: [
      { exerciseId: "0117", level: 1.78, sets: 4, reps: 5 }, // barbell sumo deadlift
      { exerciseId: "0085", level: 1.56, sets: 3, reps: 8 }, // barbell romanian deadlift
      { exerciseId: "0116", level: 1.26, sets: 3, reps: 10 }, // barbell straight leg deadlift
      // Machine-loaded, so the lumbar gets a real strength signal. A bodyweight
      // variant would be worth only ~5 kg per rep of load.
      { exerciseId: "0573", level: 0.95, sets: 3, reps: 10, everyOtherWeek: true },
    ],
  },
  {
    id: "empuje-1",
    label: "Empuje · banca",
    slots: [
      // Pecho is the most frequent compound in the plan: four sessions a week
      // across the two push days, so it clears Diamante on volume alone.
      { exerciseId: "0025", level: 1.70, sets: 4, reps: 5 }, // barbell bench press
      { exerciseId: "0047", level: 1.50, sets: 3, reps: 6 }, // barbell incline bench press
      { exerciseId: "1719", level: 1.34, sets: 3, reps: 8 }, // incline close grip bench
      { exerciseId: "0092", level: 1.05, sets: 3, reps: 10 }, // seated overhead triceps ext
      { exerciseId: "0031", level: 0.95, sets: 3, reps: 10, everyOtherWeek: true },
    ],
  },
  {
    id: "tiron-1",
    label: "Tirón · espalda",
    slots: [
      { exerciseId: "0027", level: 1.52, sets: 4, reps: 6 }, // barbell bent over row
      { exerciseId: "3017", level: 1.36, sets: 3, reps: 8 }, // barbell pendlay row
      { exerciseId: "2330", level: 1.44, sets: 3, reps: 10 }, // cable lat pulldown
      { exerciseId: "0095", level: 0.68, sets: 4, reps: 10, everyOtherWeek: true },
      { exerciseId: "0126", level: 0.60, sets: 3, reps: 10, everyOtherWeek: true },
    ],
  },
  {
    id: "empuje-2",
    label: "Empuje · hombros",
    slots: [
      { exerciseId: "1456", level: 1.28, sets: 4, reps: 5 }, // close grip military press
      { exerciseId: "0120", level: 1.05, sets: 3, reps: 10 }, // barbell upright row
      // Bench and row repeat here to hold chest and back at 2 sessions a week.
      // Volume is half the score, so frequency matters as much as load.
      { exerciseId: "0025", level: 1.58, sets: 3, reps: 6 },
      { exerciseId: "0027", level: 1.34, sets: 3, reps: 8 },
      { exerciseId: "0212", level: 0.62, sets: 3, reps: 10, everyOtherWeek: true },
      { exerciseId: "0031", level: 0.88, sets: 3, reps: 10, everyOtherWeek: true },
    ],
  },
];

/**
 * Weekly rotation, Monday-first.
 *
 * Four sessions a week: two lower, two upper, with chest and back appearing in
 * both upper days. That frequency is what the volume half of the score measures,
 * so it is the main lever on which muscles reach the top of the ladder.
 */
const WEEK_PLAN = [
  { weekday: 1, programId: "pierna-1" }, // Monday
  { weekday: 2, programId: "empuje-1" }, // Tuesday
  { weekday: 4, programId: "pierna-2" }, // Thursday
  { weekday: 5, programId: "tiron-1" }, // Friday
  { weekday: 6, programId: "empuje-2" }, // Saturday
];

/** Weekly load increase, applied to the top set. */
const WEEKLY_PROGRESSION = 0.03;
/** Warm-up sets per exercise, as a fraction of the working load. */
const WARMUP_STEPS = [
  { factor: 0.5, reps: 10 },
  { factor: 0.75, reps: 5 },
];

// ---------------------------------------------------------------------------
// Catalog metadata the plan needs
// ---------------------------------------------------------------------------

/**
 * Catalog rows for every exercise the plan references, plus their Gold ratio.
 *
 * Hardcoded rather than queried so `--dry-run` and `--report` work without a
 * network round trip and so the plan's assumptions are reviewable in one place.
 * `TARGET_STANDARD` is duplicated here from `rankConfig.ts`: the script is plain
 * Node and cannot import the TS module, so the values are asserted to match by
 * the `verifySeedPlan` check below.
 */
const EXERCISES = {
  "0025": { name: "barbell bench press", target: "pectorals", body_part: "chest", standard: 1.25 },
  "0027": { name: "barbell bent over row", target: "upper back", body_part: "back", standard: 1.35 },
  "0031": { name: "barbell curl", target: "biceps", body_part: "upper arms", standard: 1.35 },
  "0043": { name: "barbell full squat", target: "glutes", body_part: "upper legs", standard: 1.75 },
  "0044": { name: "barbell good morning", target: "hamstrings", body_part: "upper legs", standard: 2.0 },
  "0047": { name: "barbell incline bench press", target: "pectorals", body_part: "chest", standard: 1.25 },
  "0085": { name: "barbell romanian deadlift", target: "glutes", body_part: "upper legs", standard: 1.75 },
  "0092": { name: "barbell seated overhead triceps extension", target: "triceps", body_part: "upper arms", standard: 0.85 },
  "0095": { name: "barbell shrug", target: "traps", body_part: "back", standard: 1.35 },
  "0116": { name: "barbell straight leg deadlift", target: "hamstrings", body_part: "upper legs", standard: 2.0 },
  "0117": { name: "barbell sumo deadlift", target: "glutes", body_part: "upper legs", standard: 1.75 },
  "0120": { name: "barbell upright row", target: "delts", body_part: "shoulders", standard: 0.85 },
  "0124": { name: "barbell wide squat", target: "quads", body_part: "upper legs", standard: 1.75 },
  "0126": { name: "barbell wrist curl", target: "forearms", body_part: "lower arms", standard: 1.35 },
  "0168": { name: "cable hip adduction", target: "adductors", body_part: "upper legs", standard: 1.75 },
  "0212": { name: "cable seated crunch", target: "abs", body_part: "waist", standard: 1.75 },
  "0573": { name: "lever back extension", target: "spine", body_part: "back", standard: 2.0 },
  "1372": { name: "barbell standing calf raise", target: "calves", body_part: "lower legs", standard: 1.75 },
  "1456": {
    name: "barbell standing close grip military press",
    target: "delts",
    body_part: "shoulders",
    standard: 0.85,
  },
  "1719": { name: "barbell incline close grip bench press", target: "triceps", body_part: "upper arms", standard: 0.85 },
  "3017": { name: "barbell pendlay row", target: "upper back", body_part: "back", standard: 1.35 },
  "2330": { name: "cable lat pulldown full range of motion", target: "lats", body_part: "back", standard: 1.35 },
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Epley, matching `muscleScore.ts`. Reps above 10 are ignored by the scorer. */
function estimateOneRepMax(weight, reps) {
  return weight * (1 + reps / 30);
}

/** Barbell-friendly rounding, so the numbers look like a real log book. */
function roundLoad(value) {
  if (value >= 20) return Math.round(value / 2.5) * 2.5;
  if (value >= 5) return Math.round(value / 2.5) * 2.5;
  return Math.round(value * 2) / 2;
}

/**
 * Sessions for one account, oldest first.
 *
 * `now` is the anchor rather than `Date.now()` so the output is reproducible and
 * so the decay maths can be reasoned about: the newest session is deliberately
 * one day old, well inside the 42-day window where no decay applies.
 */
/**
 * Every catalog id the plan references must have metadata here.
 *
 * Checked up front rather than at the first `EXERCISES[id].standard` lookup: a
 * missing id would otherwise surface as `Cannot read properties of undefined`
 * from deep inside the generator, which says nothing about which id is wrong.
 */
function verifyPlan() {
  const missing = [];
  for (const program of PROGRAM) {
    for (const slot of program.slots) {
      if (!EXERCISES[slot.exerciseId]) missing.push(`${program.id}: ${slot.exerciseId}`);
    }
  }
  if (missing.length > 0) {
    fail(`EXERCISES is missing catalog metadata for:\n  ${missing.join("\n  ")}`);
  }

  // The generator's arithmetic only lines up with the scorer if the standards
  // copied into EXERCISES still match rankConfig.ts.
  const scorer = loadScorer();
  for (const [id, meta] of Object.entries(EXERCISES)) {
    const expected = scorer.TARGET_STANDARD[meta.target];
    if (expected === undefined) {
      fail(`${id} (${meta.target}) has no standard in TARGET_STANDARD.`);
    }
    const ratio = scorer.STANDARD_RATIOS[expected].male;
    if (Math.abs(ratio - meta.standard) > 1e-9) {
      fail(
        `${id}: standard drift. rankConfig says ${meta.target} -> ${expected} = ${ratio}, ` +
          `script says ${meta.standard}.`,
      );
    }
  }
  console.log(`[seed-demo] plan verified: ${Object.keys(EXERCISES).length} exercises, standards in sync.`);
}

function buildSessions(now, bodyweightKg) {
  const logs = [];
  const sets = [];
  const anchor = new Date(now);

  // Newest session lands `startOffsetDays` before `anchor`.
  const startOffsetDays = 1;

  for (let week = WEEKS - 1; week >= 0; week -= 1) {
    const weekStart = new Date(anchor);
    weekStart.setUTCDate(weekStart.getUTCDate() - startOffsetDays - week * 7);
    weekStart.setUTCHours(17, 30, 0, 0);

    for (const entry of WEEK_PLAN) {
      const program = PROGRAM.find((p) => p.id === entry.programId);
      if (!program) throw new Error(`Unknown program: ${entry.programId}`);

      const startedAt = new Date(weekStart);
      startedAt.setUTCDate(startedAt.getUTCDate() + (entry.weekday - 1));

      // Never in the future, even if the anchor is early in a week.
      if (startedAt.getTime() > anchor.getTime()) continue;

      const logId = cryptoRandomUuid();
      const sessionSets = [];

      for (const slot of program.slots) {
        // `everyOtherWeek` is how the deliberately under-trained muscles are
        // modelled: a real trainee who skips calves every other week.
        if (slot.everyOtherWeek && week % 2 === 1) continue;

        // `level` is the final-week level, so the curve is scaled to hit it on
        // the last week rather than compounding past it. A plan whose numbers
        // depend on the length of the block is a plan nobody can reason about
        // when they tune it.
        const weekFactor = 1 + WEEKLY_PROGRESSION * (week - (WEEKS - 1));
        const targetOneRepMax =
          slot.level * EXERCISES[slot.exerciseId].standard * bodyweightKg * weekFactor;

        let setNumber = 0;
        for (const warmup of WARMUP_STEPS) {
          setNumber += 1;
          sessionSets.push({
            log_id: logId,
            exercise_id: slot.exerciseId,
            set_number: setNumber,
            weight: roundLoad((targetOneRepMax / (1 + slot.reps / 30)) * warmup.factor),
            reps: warmup.reps,
            is_warmup: true,
          });
        }

        // Working sets descend slightly, the way a real top set does.
        for (let i = 0; i < slot.sets; i += 1) {
          setNumber += 1;
          const setFactor = 1 - i * 0.045;
          const load = roundLoad(
            (targetOneRepMax / (1 + slot.reps / 30)) * setFactor,
          );
          sessionSets.push({
            log_id: logId,
            exercise_id: slot.exerciseId,
            set_number: setNumber,
            weight: load,
            reps: slot.reps,
            is_warmup: false,
          });
        }
      }

      if (sessionSets.length === 0) continue;

      logs.push({
        id: logId,
        started_at: startedAt.toISOString(),
        completed_at: new Date(startedAt.getTime() + 55 * 60_000).toISOString(),
        journal_notes: MARKER,
      });
      sets.push(...sessionSets);
    }
  }

  return { logs, sets };
}

function cryptoRandomUuid() {
  // Node 18+ exposes the same primitive the browser does.
  return globalThis.crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

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
      const body = (await res.text()).slice(0, 400);
      lastError = new Error(
        `${init.method ?? "GET"} ${path} -> HTTP ${res.status}: ${body || "(empty body)"}`,
      );
      if ((res.status === 408 || res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }

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

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

async function loadAccount(email) {
  // auth.users is not exposed through PostgREST, so the id comes from the admin
  // API. Profiles alone would work too, but a user without a profile row would
  // then be invisible instead of reported as unrankable.
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) fail(`auth admin -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const payload = await res.json();
  const users = payload.users ?? payload;
  const user = users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (!user) fail(`No user with email ${email}.`);

  const profile = await rest(`profiles?user_id=eq.${user.id}&select=weight_kg,sex`)
    .then((rows) => rows?.[0]);

  if (!profile?.weight_kg) {
    fail(
      `Account ${email} has no weight_kg in its profile.\n` +
        "  The scorer divides e1RM by bodyweight, so without it nothing is rankable\n" +
        "  and the seed would look like it did nothing. Complete onboarding first.",
    );
  }

  return {
    id: user.id,
    email,
    weightKg: Number(profile.weight_kg),
    sex: profile.sex,
  };
}

async function clearMarked(userId) {
  const logs = await rest(
    `workout_logs?user_id=eq.${userId}&journal_notes=eq.${encodeURIComponent(MARKER)}&select=id`,
  );
  const ids = (logs ?? []).map((l) => l.id);
  if (ids.length === 0) {
    console.log("[seed-demo] nothing marked to remove.");
    return 0;
  }
  // completed_sets has ON DELETE CASCADE, so deleting the logs is enough.
  for (const id of ids) {
    await rest(`workout_logs?id=eq.${id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }
  console.log(`[seed-demo] removed ${ids.length} marked logs (and their sets).`);
  return ids.length;
}

// ---------------------------------------------------------------------------
// Report: run the real scorer over the plan
// ---------------------------------------------------------------------------

/**
 * Loads the bundled scorer.
 *
 * `npm run seed:report` bundles `src/lib/ranks` first. Failing loudly when the
 * bundle is missing is deliberate: a silent fallback to a copy of the maths in
 * this file would drift from the app and quietly report the wrong ranks.
 */
function loadScorer() {
  try {
    return require(
      resolve(ROOT, "node_modules", ".cache", "rankScorer.cjs"),
    );
  } catch {
    fail(
      "Missing node_modules/.cache/rankScorer.cjs.\n" +
        "  Run `npm run seed:bundle` first; it compiles the real scorer from src/.",
    );
  }
}

function report(account, { logs, sets }) {
  const scorer = loadScorer();
  const now = new Date();

  const map = scorer.buildRankMap({
    sets: sets.map((s) => ({
      exerciseId: s.exercise_id,
      weight: s.weight,
      reps: s.reps,
      isWarmup: s.is_warmup,
      performedAt: logs.find((l) => l.id === s.log_id)?.started_at ?? now.toISOString(),
    })),
    exercises: Object.entries(EXERCISES).map(([id, e]) => ({
      id,
      name: e.name,
      target: e.target,
      body_part: e.body_part,
      equipment: "barbell",
    })),
    context: { bodyweightKg: account.weightKg, sex: account.sex ?? "other", now },
  });

  const rows = [...map.muscles.values()].sort((a, b) => b.score - a.score);
  console.log(`\n  Rango previsto para ${account.email}`);
  console.log(`  peso ${account.weightKg} kg · sexo ${account.sex ?? "sin definir"}`);
  console.log(`  ${logs.length} sesiones · ${sets.length} series · ${WEEKS} semanas\n`);
  console.log(
    `  ${"Músculo".padEnd(16)}${"Rango".padEnd(12)}${"Score".padStart(6)}${"Sesiones".padStart(10)}  Motivo`,
  );
  for (const m of rows) {
    const reason = m.classified ? "" : ` (${m.unrankedReason})`;
    console.log(
      `  ${m.label.padEnd(16)}${m.rank.label.padEnd(12)}${String(m.score).padStart(6)}${String(
        m.detail.sessions,
      ).padStart(10)}${reason}`,
    );
  }
  console.log(
    `\n  Global: ${map.globalRank ? map.globalRank.label : "sin clasificar"}` +
      `${map.globalScore !== null ? ` (${map.globalScore}/100)` : ""}` +
      ` · clasificados ${map.classifiedCount}/${map.muscles.size}\n`,
  );

  // A demo that renders an empty map is not a demo.
  if (map.classifiedCount < 5) {
    console.warn(
      "  WARNING: fewer than 5 muscles classified. The map will look mostly grey.\n",
    );
  }
  return map;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  if (!url) fail("Missing SUPABASE_URL / VITE_SUPABASE_URL.");
  if (!serviceKey) {
    fail(
      "Missing SERVICE_ROLE_KEY.\n" +
        "  This script writes workout_logs/completed_sets, which RLS forbids for the\n" +
        "  browser's anon key, so the service role is required.",
    );
  }

  const email = arg("email");
  if (!email) fail("Pass --email someone@example.com.");

  const account = await loadAccount(email);

  console.log(`[seed-demo] project : ${url.replace(/\/+$/, "")}`);
  console.log(`[seed-demo] account : ${account.email} (${account.id})`);
  console.log(`[seed-demo] profile : ${account.weightKg} kg · ${account.sex ?? "sin sexo"}`);

  if (has("clean")) {
    await clearMarked(account.id);
    return;
  }

  verifyPlan();

  // Idempotent: the plan is regenerated, so a second run would otherwise double
  // the history and shift every rank.
  if (!has("dry-run") && !has("report")) await clearMarked(account.id);

  const { logs, sets } = buildSessions(new Date(), account.weightKg);
  report(account, { logs, sets });

  if (has("dry-run") || has("report")) {
    console.log("[seed-demo] dry run: nothing written.");
    return;
  }

  // Generating ids client-side is required: completed_sets needs the log id in
  // the same batch, and letting Postgres generate them would mean a second round
  // trip to learn what they were.
  const withUser = logs.map((l) => ({ ...l, user_id: account.id, routine_id: null }));

  await rest("workout_logs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(withUser),
  });
  console.log(`[seed-demo] wrote ${withUser.length} logs.`);

  for (let i = 0; i < sets.length; i += BATCH_SIZE) {
    const batch = sets.slice(i, i + BATCH_SIZE);
    await rest("completed_sets", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(batch),
    });
    console.log(`[seed-demo] sets ${Math.min(i + BATCH_SIZE, sets.length)}/${sets.length}`);
  }

  console.log(
    "\n[seed-demo] done. Open Progreso -> Rangos; the map reacts to local writes\n" +
      "            only, so reload the tab if the ranks view is already open.\n",
  );
}

main().catch((error) => fail(error.message));
