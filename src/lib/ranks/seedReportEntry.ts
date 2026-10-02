/**
 * Bundle entry for `scripts/seedDemoTraining.js --report`.
 *
 * The seed script is plain Node and cannot import the TypeScript scorer, so it
 * needs a compiled copy. This file exists purely as the entry point: it re-exports
 * the real modules rather than reimplementing anything, which is the whole point.
 * If the maths ever changes in `src/`, the report changes with it.
 *
 * Compile with:
 *   npx esbuild src/lib/ranks/seedReportEntry.ts --bundle --format=cjs \
 *     --platform=node --outfile=node_modules/.cache/rankScorer.cjs --log-level=error
 */

export { buildRankMap } from "./buildRankMap";
export { calculateMuscleScore, type SetRow, type ExerciseRow } from "./muscleScore";
export { scoreToRankWithHysteresis } from "./scoreToRank";
export { RANKS, STANDARD_RATIOS, TARGET_STANDARD } from "./rankConfig";
export { MUSCLE_DEFINITIONS, enabledSlugs } from "../muscleMap";
