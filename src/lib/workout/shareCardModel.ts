/**
 * shareCardModel.ts — turns a finished session into the numbers a card draws.
 *
 * Kept apart from the renderer so the counting rules can be tested without a
 * canvas: which sets count, what "volume" means, and which side of the body a
 * muscle belongs to are decisions, not pixels.
 */

import type { DraftExercise } from "../offlineStore";
import { translateMuscle } from "../i18n";
import { getExerciseDisplayName } from "../../utils/exerciseTranslation";
import {
  shareDurationLabel,
  type ShareCardInput,
  type ShareExerciseLine,
  type ShareMuscleSlice,
} from "./shareCard";

/**
 * Targets drawn on the back of the body.
 *
 * The dual map exists to answer "what did I train on each side", so a target
 * that sits on the posterior chain must not be counted as anterior work.
 */
const POSTERIOR_TARGETS = new Set([
  "upper-back",
  "lower-back",
  "trapezius",
  "gluteal",
  "hamstring",
  "calves",
  "neck",
  "triceps",
]);

function setsOf(exercise: DraftExercise, includePending: boolean) {
  return exercise.sets.filter((set) => set.completed || includePending);
}

/** Completed work in kg: weight times reps, for every set that counts. */
export function shareVolumeKg(exercises: readonly DraftExercise[], includePending: boolean): number {
  return exercises.reduce(
    (total, exercise) =>
      total +
      setsOf(exercise, includePending).reduce((sum, set) => {
        const weight = Number.parseFloat(set.weight) || 0;
        const reps = Number.parseInt(set.reps, 10) || 0;
        return sum + weight * reps;
      }, 0),
    0,
  );
}

export function shareSetCount(exercises: readonly DraftExercise[], includePending: boolean): number {
  return exercises.reduce((n, exercise) => n + setsOf(exercise, includePending).length, 0);
}

/**
 * The rows that carry a load but were never checked.
 *
 * A set with nothing typed into it is not "pending", it is empty: saying "you
 * forgot three sets" about a row the athlete never touched would be a lie.
 */
export function pendingSets(exercises: readonly DraftExercise[]) {
  return exercises.flatMap((exercise) =>
    exercise.sets
      .map((set, index) => ({ exercise, set, setNumber: index + 1 }))
      .filter(
        ({ set }) =>
          !set.completed && ((Number.parseFloat(set.weight) || 0) > 0 || (Number.parseInt(set.reps, 10) || 0) > 0),
      ),
  );
}

export function buildShareCardInput(
  exercises: readonly DraftExercise[],
  options: {
    routineTitle: string;
    startedAt: string;
    completedAt: string;
    includePending: boolean;
  },
): ShareCardInput {
  const lines: ShareExerciseLine[] = exercises
    .map((exercise) => {
      const sets = setsOf(exercise, options.includePending);
      const best = sets.reduce(
        (top, set) => {
          const weight = Number.parseFloat(set.weight) || 0;
          const reps = Number.parseInt(set.reps, 10) || 0;
          return weight * reps > top.weight * top.reps ? { weight, reps } : top;
        },
        { weight: 0, reps: 0 },
      );
      return {
        name: getExerciseDisplayName(exercise.exercise),
        sets: sets.length,
        bestWeightKg: best.weight,
        bestReps: best.reps,
      };
    })
    .filter((line) => line.sets > 0)
    .sort((a, b) => b.bestWeightKg * b.bestReps - a.bestWeightKg * a.bestReps);

  const byTarget = new Map<string, { sets: number; posterior: boolean }>();
  exercises.forEach((exercise) => {
    const sets = setsOf(exercise, options.includePending).length;
    if (sets === 0) return;
    const target = exercise.exercise.target;
    if (!target) return;
    const current = byTarget.get(target) ?? {
      sets: 0,
      posterior: POSTERIOR_TARGETS.has(target),
    };
    current.sets += sets;
    byTarget.set(target, current);
  });

  const muscles: ShareMuscleSlice[] = [...byTarget.entries()]
    .map(([target, value]) => ({
      label: translateMuscle(target),
      sets: value.sets,
      region: value.posterior ? ("posterior" as const) : ("anterior" as const),
    }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 8);

  const startedMs = new Date(options.startedAt).getTime();
  const completedMs = new Date(options.completedAt).getTime();
  const durationSeconds = Number.isFinite(startedMs) && Number.isFinite(completedMs)
    ? Math.max(0, (completedMs - startedMs) / 1000)
    : 0;

  return {
    routineTitle: options.routineTitle,
    dateLabel: new Date(options.completedAt).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    }),
    durationLabel: shareDurationLabel(durationSeconds),
    volumeKg: shareVolumeKg(exercises, options.includePending),
    totalSets: shareSetCount(exercises, options.includePending),
    exerciseCount: lines.length,
    exercises: lines,
    muscles,
  };
}