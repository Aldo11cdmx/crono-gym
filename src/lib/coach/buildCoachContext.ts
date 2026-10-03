/**
 * buildCoachContext.ts — assembles the training context from data already loaded.
 *
 * A pure function on purpose. Every input arrives as a view model the hooks
 * already hold, so this file never fetches, never touches React and never reads a
 * clock except through an argument. That is what makes the coach's briefing
 * testable: a fixture in, a context out, with no network and no provider to mock.
 *
 * The other thing it must not do is invent. A missing bodyweight does not become a
 * ratio; an unranked muscle does not become a score of zero presented as a
 * measurement. Absent facts become entries in `dataGaps`, and the UI says which
 * input is missing so the athlete knows what to do about it.
 */

import type { ProgressStats } from "../../hooks/useGymData";
import type { EnergyReport, Profile } from "../profile";
import type { MuscleRank, RankMap } from "../ranks/buildRankMap";
import type {
  CoachBodyweightFact,
  CoachContext,
  CoachDataGap,
  CoachEnergyFact,
  CoachMuscleFact,
} from "./types";

/** How many exercises a muscle reports as its drivers. */
const TOP_EXERCISES = 3;

/**
 * Ceiling on the serialized prompt payload, in characters.
 *
 * Roughly 4k tokens of Spanish prose. Comfortably inside every current model's
 * window while leaving room for the conversation itself, and -- the real reason for
 * the cap -- bounded regardless of how much history a heavy user accumulates. An
 * athlete with three years of sessions must not be able to push the coach's own
 * instructions out of the window.
 */
export const PROMPT_PAYLOAD_MAX_CHARS = 16_000;

/** Everything the builder is allowed to read. All optional, because loading is. */
export interface CoachContextInput {
  profile: Profile | null;
  energy: EnergyReport | null;
  progress: ProgressStats | null;
  /** The whole map, so unranked muscles survive into the context with their reason. */
  ranks: RankMap | null;
  /**
   * Bodyweight as the weigh-in series knows it, separate from the profile field.
   *
   * Two sources because the app has two: the number the athlete typed during
   * onboarding, and a series of logged weigh-ins. The profile value is what the
   * rank standards divide by; the series is what shows a trend. Passing only the
   * profile would leave a coach unable to say which way a cut is moving, which is
   * the question bodyweight is asked for.
   */
  bodyweight?: CoachBodyweightFact | null;
  /** Injectable so a test can pin it and a caller can label the snapshot. */
  now?: Date;
}

function toMuscleFact(entry: MuscleRank): CoachMuscleFact {
  return {
    slug: entry.slug,
    label: entry.label,
    classified: entry.classified,
    rankId: entry.rank.id,
    rankLabel: entry.rank.label,
    score: entry.classified ? entry.score : 0,
    // The scorer's own code, passed through rather than translated here: a reason
    // is a fact about the data, and rendering it is the UI's job.
    unrankedReason: entry.classified ? null : entry.unrankedReason,
    confidence: entry.confidence,
    // Sets and weeks, so a per-muscle weekly volume can be derived downstream. The
    // window-wide volume block cannot answer that: it counts sessions, not which
    // muscle got trained.
    effectiveSets: entry.detail.volume.effectiveSets,
    activeWeeks: entry.detail.volume.activeWeeks,
    // Sorted, because the strongest driver is the one worth naming. `contributions`
    // is already ordered by contribution weight, which is not the same thing once
    // estimated 1RMs disagree.
    topExercises: entry.detail.contributions
      .filter((c) => c.estimatedOneRepMax > 0)
      .sort((a, b) => b.estimatedOneRepMax - a.estimatedOneRepMax)
      .slice(0, TOP_EXERCISES)
      .map((c) => ({
        name: c.name,
        estimatedOneRepMax: c.estimatedOneRepMax,
        bestSet: c.bestSet,
      })),
  };
}

export function buildCoachContext(input: CoachContextInput): CoachContext {
  const { profile, energy, progress, ranks } = input;
  const now = input.now ?? new Date();
  const dataGaps: CoachDataGap[] = [];

  const muscles = ranks ? [...ranks.muscles.values()].map(toMuscleFact) : [];
  const classified = muscles.filter((m) => m.classified);

  // Readiness is a permanent gap in this build. It is added unconditionally rather
  // than probed, because the absence is structural: `session_checkins` has no
  // writer, so there is no state in which this gap is closed and checking for it
  // would be theatre.
  dataGaps.push("no_readiness_checkins");

  if (!profile) dataGaps.push("no_profile");

  // The newest number wins. A logged weigh-in is more recent and more deliberate
  // than whatever was typed at onboarding, so the series overrides the profile
  // rather than the other way round.
  const latestWeightKg = input.bodyweight?.latestKg ?? profile?.weight_kg ?? null;

  // Either source is enough to relativize a 1RM, so the gap is real only when
  // both are silent. No ratio is computed here for exactly that case.
  if (latestWeightKg === null) dataGaps.push("no_bodyweight");
  if (!energy || energy.proteinGrams === null || energy.target <= 0) {
    dataGaps.push("no_profile_energy");
  }
  if (!progress || progress.totalWorkouts === 0) dataGaps.push("no_workouts");
  if (classified.length === 0) dataGaps.push("no_classified_muscles");

  const energyFact: CoachEnergyFact | null =
    energy && energy.target > 0
      ? { targetKcal: energy.target, proteinGrams: energy.proteinGrams }
      : null;

  return {
    generatedAt: now.toISOString(),
    profile: profile
      ? {
          sex: profile.sex,
          weightKg: latestWeightKg,
          heightCm: profile.height_cm,
          experienceLevel: profile.experience_level,
          activityLevel: profile.activity_level,
          goal: profile.goal,
          unitSystem: profile.unit_system,
        }
      : null,
    bodyweight: {
      latestKg: latestWeightKg,
      changeLast30Days: input.bodyweight?.changeLast30Days ?? null,
      seriesCount: input.bodyweight?.seriesCount ?? 0,
    },
    volume: {
      totalWorkouts: progress?.totalWorkouts ?? 0,
      workoutsThisMonth: progress?.workoutsThisMonth ?? 0,
      monthlyVolume: progress?.monthlyVolume ?? 0,
      weeklyPoints: progress?.week ?? [],
    },
    energy: energyFact,
    muscles,
    dataGaps,
  };
}

/**
 * The exact object the Step 2 system prompt will carry.
 *
 * Kept separate from `CoachContext` on purpose. The context is the app's full
 * record and is allowed to grow; the payload is a wire format with a budget, and
 * conflating them is how a prompt silently outgrows its window. Anything trimmed
 * here is trimmed deliberately, and the caller is told when it happened.
 */
export interface CoachPromptPayload {
  context: unknown;
  /**
   * Characters dropped to fit the budget, across every trimming step.
   *
   * Measured against the original serialization, not against the last one: a caller
   * that saw "0 characters trimmed" while the weekly history had in fact been
   * discarded would be told the payload is complete when it is not.
   */
  truncatedChars: number;
}

export function toCoachPromptPayload(context: CoachContext): CoachPromptPayload {
  const full = JSON.stringify(context);
  if (full.length <= PROMPT_PAYLOAD_MAX_CHARS) {
    return { context: JSON.parse(full) as unknown, truncatedChars: 0 };
  }

  /*
   * Trim the history, never the facts.
   *
   * Dropping the weakest exercises is the right sacrifice: the per-week series is a
   * long tail a coach can do without, while the bodyweight and the ranks are the
   * inputs every piece of advice is derived from. Cutting in that order means a
   * capped payload still answers "how strong am I", which a payload missing the
   * bodyweight cannot.
   */
  const trimmed: CoachContext = {
    ...context,
    volume: { ...context.volume, weeklyPoints: [] },
    muscles: context.muscles.map((m) => ({ ...m, topExercises: [] })),
  };
  let serialized = JSON.stringify(trimmed);

  if (serialized.length > PROMPT_PAYLOAD_MAX_CHARS) {
    /*
     * Still over. Drop the unranked muscles: a coach can advise on a muscle the
     * athlete has not trained, but it does not need the full anatomy of them, and
     * the classified ones are what the conversation is about.
     */
    serialized = JSON.stringify({
      ...trimmed,
      muscles: trimmed.muscles.filter((m) => m.classified),
    });
  }

  const clipped = serialized.slice(0, PROMPT_PAYLOAD_MAX_CHARS);
  return {
    context: JSON.parse(clipped) as unknown,
    // Against the original, so the history dropped by the first trim is counted too.
    truncatedChars: full.length - clipped.length,
  };
}
