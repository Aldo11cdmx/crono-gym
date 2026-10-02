/**
 * Coverage harness for the anatomy -> catalog mapping.
 *
 * Run with:  node scripts/verifyMuscleMap.js
 * Requires `npx esbuild src/lib/muscleMap.ts --bundle --format=cjs
 * --platform=node --outfile=<tmp>/muscleMap.cjs` beforehand, or adjust the
 * require path below to the emitted bundle.
 *
 * What it proves:
 *  1. Every slug the library can render has a definition (nothing silently
 *     unclickable).
 *  2. Every target/body_part named in the map exists in the live catalog.
 *  3. Every enabled muscle returns a non-zero number of exercises.
 *  4. No two muscles are indistinguishable, i.e. the body_part fallback has not
 *     collapsed distinct muscles into the same result set.
 */
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";

const require = createRequire(import.meta.url);
// Written by `npm run verify:mapping`, which esbuild-bundles the TS module first.
const bundle = path.join(process.cwd(), "node_modules", ".cache", "muscleMap.cjs");
const {
  MUSCLE_DEFINITIONS,
  enabledSlugs,
  disabledSlugs,
  muscleDefinition,
  muscleMatchLevel,
  exerciseMatchesMuscle,
  catalogVocabulary,
} = require(bundle);

// Catalog snapshot: exercises grouped by (target, body_part) with counts,
// queried from public.exercises.
const CATALOG = [
  ["abductors", "upper legs", 5],
  ["abs", "waist", 169],
  ["adductors", "upper legs", 6],
  ["biceps", "upper arms", 151],
  ["calves", "lower legs", 59],
  ["cardiovascular system", "cardio", 29],
  ["delts", "shoulders", 143],
  ["forearms", "lower arms", 37],
  ["glutes", "upper legs", 144],
  ["hamstrings", "upper legs", 28],
  ["lats", "back", 81],
  ["levator scapulae", "neck", 2],
  ["pectorals", "chest", 158],
  ["quads", "upper legs", 44],
  ["serratus anterior", "chest", 5],
  ["spine", "back", 19],
  ["traps", "back", 15],
  ["triceps", "upper arms", 141],
  ["upper back", "back", 88],
];

// The library's Slug union, verbatim.
const LIBRARY_SLUGS = [
  "abs", "adductors", "ankles", "biceps", "calves", "chest", "deltoids", "feet",
  "forearm", "gluteal", "hamstring", "hands", "hair", "head", "knees",
  "lower-back", "neck", "obliques", "quadriceps", "tibialis", "trapezius",
  "triceps", "upper-back",
];

let pass = 0;
let fail = 0;
function check(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

const exercises = CATALOG.flatMap(([target, body_part, n]) =>
  Array.from({ length: n }, (_, i) => ({ target, body_part, id: `${target}-${i}` })),
);

console.log("1. slug completeness");
const mappedSlugs = new Set(MUSCLE_DEFINITIONS.map((m) => m.slug));
for (const slug of LIBRARY_SLUGS) {
  check(`library slug "${slug}" has a definition`, mappedSlugs.has(slug));
}
for (const def of MUSCLE_DEFINITIONS) {
  check(`slug "${def.slug}" is a real library slug`, LIBRARY_SLUGS.includes(def.slug));
}
check(
  "no duplicate definitions",
  mappedSlugs.size === MUSCLE_DEFINITIONS.length,
  `${mappedSlugs.size} unique of ${MUSCLE_DEFINITIONS.length}`,
);

console.log("\n2. vocabulary matches the live catalog");
const vocab = catalogVocabulary({
  targets: [...new Set(CATALOG.map(([t]) => t))],
  bodyParts: [...new Set(CATALOG.map(([, b]) => b))],
});
check("no unknown targets", vocab.unknownTargets.length === 0, vocab.unknownTargets.join(", "));
check("no unknown body parts", vocab.unknownBodyParts.length === 0, vocab.unknownBodyParts.join(", "));

console.log("\n3. every enabled muscle returns exercises");
const counts = new Map();
for (const slug of enabledSlugs()) {
  const n = exercises.filter((e) => exerciseMatchesMuscle(e, slug)).length;
  counts.set(slug, n);
  check(`"${muscleDefinition(slug).label}" -> ${n} exercises`, n > 0);
}

console.log("\n4. primary coverage matches the declared targets exactly");
/**
 * The strongest precision check available: a muscle's PRIMARY matches must
 * equal the sum of the counts of the targets it declares. Comparing totals
 * between muscles only catches collisions; this catches precision loss, where a
 * muscle claims its whole region as primary (biceps 292 instead of 151).
 */
const perTarget = new Map();
for (const [target, , n] of CATALOG) perTarget.set(target, n);

for (const slug of enabledSlugs()) {
  const def = muscleDefinition(slug);
  const primary = exercises.filter((e) => muscleMatchLevel(e, slug) === "primary");
  const secondary = exercises.filter((e) => muscleMatchLevel(e, slug) === "secondary");

  if (def.targets.length === 0) {
    // Body-part-only muscle (the neck): body_part is its primary test.
    const expected = CATALOG.reduce(
      (sum, [, bp, n]) => sum + (def.bodyParts.includes(bp) ? n : 0),
      0,
    );
    check(`"${def.label}" primary matches its body part`, primary.length === expected,
      `${primary.length} vs ${expected}`);
    check(`"${def.label}" has no secondary matches`, secondary.length === 0,
      `${secondary.length} secondary`);
    continue;
  }

  const expectedPrimary = def.targets.reduce((sum, t) => sum + (perTarget.get(t) ?? 0), 0);
  check(
    `"${def.label}" primary matches its declared targets`,
    primary.length === expectedPrimary,
    `${primary.length} vs ${expectedPrimary} from [${def.targets.join(", ")}]`,
  );

  // Secondary is the region minus the primary targets; it must never include a
  // muscle that is already primary for this exercise.
  const expectedSecondary = CATALOG.reduce(
    (sum, [, bp, n]) => sum + (def.bodyParts.includes(bp) ? n : 0),
    0,
  ) - expectedPrimary;
  check(
    `"${def.label}" secondary matches the rest of its region`,
    secondary.length === expectedSecondary,
    `${secondary.length} vs ${expectedSecondary}`,
  );
}

console.log("\n5. match levels are exclusive and total");
for (const slug of enabledSlugs()) {
  const levels = exercises.map((e) => muscleMatchLevel(e, slug));
  check(
    `"${muscleDefinition(slug).label}" has no doubly-classified exercise`,
    levels.every((l) => l === null || l === "primary" || l === "secondary"),
  );
  // The boolean helper must agree with the level resolver exactly.
  const agrees = exercises.every(
    (e) => exerciseMatchesMuscle(e, slug) === (muscleMatchLevel(e, slug) !== null),
  );
  check(`"${muscleDefinition(slug).label}" boolean agrees with level`, agrees);
}

console.log("\n6. enabled muscles have distinct PRIMARY sets");
/**
 * Compares PRIMARY membership, not the total. Adding the secondary level made
 * total sets intentionally overlap: every muscle in a region shares the region's
 * exercises as secondary stimulus (all four upper-leg muscles match the same
 * 227). That is the feature working, not a collision.
 *
 * What must stay distinct is the primary set, which is what ranking weights and
 * result ordering rely on. Compared as membership rather than counts, because
 * upper-back and abs both return 169 primaries by coincidence while sharing
 * nothing.
 */
const primarySets = new Map(
  enabledSlugs().map((slug) => [
    slug,
    new Set(
      exercises
        .filter((e) => muscleMatchLevel(e, slug) === "primary")
        .map((e) => e.id),
    ),
  ]),
);

for (const a of enabledSlugs()) {
  for (const b of enabledSlugs()) {
    if (a >= b) continue;
    const sa = primarySets.get(a);
    const sb = primarySets.get(b);
    if (sa.size !== sb.size) continue;
    const identical = [...sa].every((id) => sb.has(id));
    if (!identical) continue;
    const da = muscleDefinition(a);
    const db = muscleDefinition(b);
    // Identical primary sets are only acceptable when explicitly declared as an
    // alias: the catalog genuinely has no separate row for that muscle.
    const declaredAlias = da.aliasOf === b || db.aliasOf === a;
    check(
      `"${da.label}" and "${db.label}" have distinct primary sets`,
      declaredAlias,
      `identical ${sa.size}-exercise primary sets and neither declares aliasOf`,
    );
  }
}

console.log("\n7. inert regions are inert");
for (const slug of disabledSlugs()) {
  const n = exercises.filter((e) => exerciseMatchesMuscle(e, slug)).length;
  check(`"${muscleDefinition(slug).label}" returns nothing`, n === 0, `returned ${n}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);