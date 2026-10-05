/**
 * MuscleReadonlyMap.tsx — the muscle diagram as a picture, not a control.
 *
 * Why this is not `MuscleSelector` with `readOnly`
 * ------------------------------------------------
 * `readOnly` on `MuscleSelector` means "does not change the selection", not "is not
 * interactive". In that mode it still renders a front/back radiogroup, a hover rule for
 * every trainable muscle, and a legend of buttons that call `onSelectMuscle` -- the panel
 * behaviour is deliberately kept, because the ranks view needs it. Using it here would give
 * the workout screen a front/back toggle, a legend that opens panels, and hover glows on
 * muscles the athlete cannot act on: three affordances that promise something and do
 * nothing.
 *
 * So this renders `react-muscle-highlighter`'s `Body` directly and owns nothing but the
 * paint. The muscle vocabulary -- `MUSCLE_DEFINITIONS`, `enabledSlugs`, the labels -- comes
 * from `muscleMap`, which is the same source `MuscleSelector` reads, so a muscle added
 * there shows up here without either component being touched.
 *
 * The lighting
 * ------------
 * `ACCENT.base` for a muscle in the session, and the diagram's own tokens for everything
 * else. That ordering matters: a muscle with content must never be *less* prominent than
 * one without, so the lit fill is applied on top of whatever state the base would have and
 * never the reverse.
 *
 * The tint scales with how much of the session that muscle has, so a routine with four
 * chest exercises and one calf exercise reads as four chest and one calf without needing a
 * legend to say so. Three steps, not a continuous ramp: below about four distinguishable
 * levels this is decoration, and a legend explaining four shades of red is worse than a
 * binary lit/unlit that needs no legend.
 */

import { useId, useMemo } from "react";
import Body from "react-muscle-highlighter";
import type { Slug } from "react-muscle-highlighter";
import {
  MUSCLE_DEFINITIONS,
  enabledSlugs,
  muscleDefinition,
} from "../lib/muscleMap";
import { ACCENT, DIAGRAM, RADIUS } from "../design/tokens";

/** Fills for a muscle with nothing, something, and a lot in the session. */
const UNLIT_FILL = DIAGRAM.inert;
/** A little. Still visibly lit -- this is the base case, not the dimmed one. */
const LIT_FILL = DIAGRAM.selectedFill;
/** The most present muscle in the session. */
const MOST_LIT_FILL = ACCENT.muted;

const UNLIT_STROKE = DIAGRAM.inert;
const LIT_STROKE = DIAGRAM.regionStroke;

/** Fraction of the session's sets above which a muscle counts as "most present". */
const MOST_PRESENT_RATIO = 0.34;

export interface MuscleReadonlyMapProps {
  /**
   * How many sets each muscle accounts for in this session.
   *
   * A map rather than a slug list, because the pre-workout summary needs the *distribution*
   * -- which muscles this routine is actually going to hit and in what proportion. A list
   * says which muscles are in and the map says where the session's volume is going, which
   * is the thing that catches a routine that is all chest.
   */
  counts: ReadonlyMap<Slug, number>;
  side?: "front" | "back";
  /** Fixed aspect ratio. 2:3 is the library's own body proportion. */
  aspectRatio?: number;
  className?: string;
  /** Names the figure for a screen reader. */
  label: string;
}

export function MuscleReadonlyMap({
  counts,
  side = "front",
  aspectRatio = 3 / 2,
  className = "",
  label,
}: MuscleReadonlyMapProps) {
  const scopeId = useId().replace(/[^a-zA-Z0-9]/g, "");

  const total = useMemo(
    () => [...counts.values()].reduce((sum, count) => sum + count, 0),
    [counts],
  );
  const mostPresent = total * MOST_PRESENT_RATIO;

  const data = useMemo(
    () =>
      MUSCLE_DEFINITIONS.map((muscle) => {
        const count = counts.get(muscle.slug) ?? 0;
        const lit = count > 0;

        return {
          slug: muscle.slug,
          styles: {
            // Inert regions stay inert even if a count somehow reached them: a disabled
            // muscle is not selectable in the rest of the product either, and lighting it
            // here would promise a muscle the athlete cannot train.
            fill: !muscle.enabled
              ? DIAGRAM.inert
              : count >= mostPresent && mostPresent > 0
                ? MOST_LIT_FILL
                : lit
                  ? LIT_FILL
                  : UNLIT_FILL,
            stroke: !muscle.enabled ? DIAGRAM.inert : lit ? LIT_STROKE : UNLIT_STROKE,
            strokeWidth: lit ? 2 : 1,
          },
        };
      }),
    [counts, mostPresent],
  );

  /*
   * The one rule this component does emit, and it is about *not* being interactive.
   *
   * `react-muscle-highlighter` puts `cursor: pointer` and an `onClick` on **every** muscle
   * path regardless of whether `onBodyPartPress` was passed -- the handler is
   * `() => onBodyPartPress?.(part)`, so with no callback the click still has a target and
   * fires into nothing. Passing no callback is therefore not enough on its own: the cursor
   * would still say "press me" on all twenty shapes.
   *
   * So the rule is load-bearing rather than decorative. `pointer-events: none` on the figure
   * makes the whole subtree untargetable, which both removes the cursor and stops a tap on
   * the diagram reaching anything behind it. On a scrollable workout screen a torso-sized
   * dead zone would otherwise swallow the athlete's swipe.
   */
  const rules = `#${scopeId}, #${scopeId} * { pointer-events: none; cursor: default; }`;

  /*
   * The description, as a sentence rather than a list of slugs.
   *
   * A diagram with no text alternative is the single most common accessibility failure in a
   * fitness app, and a list of internal slugs would be useless to the person reading it.
   * Ordered by count so the biggest muscle is named first, which is also the order that
   * makes sense when truncating.
   */
  const description = describeDistribution(counts, total);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
      }}
    >
      <style>{rules}</style>

      <div
        style={{
          width: "100%",
          /*
           * The aspect ratio is what keeps the layout from collapsing while the figure is
           * still loading. The brief asked for a placeholder rather than a broken layout
           * where the GIFs are missing; here the figure is always renderable, but the same
           * reasoning applies -- the space is reserved by the ratio alone, so nothing above
           * or below it moves when the diagram paints.
           */
          aspectRatio: String(aspectRatio),
          borderRadius: RADIUS.card,
          backgroundColor: DIAGRAM.inert,
          overflow: "hidden",
        }}
      >
        {/*
         * `role="img"` here, even though the library's own `<svg>` already carries one.
         *
         * The library labels its figure `male-body-front`: an internal string, in English,
         * on a Spanish screen, and it names the asset rather than the content. `role="img"`
         * makes its subtree presentational, so wrapping it here replaces that label with
         * this one and collapses two announced images into one -- which is the correct
         * outcome rather than a duplicate. The alternative, leaving the library's label in
         * place and putting the description in the caption, would announce "male body
         * front" and then a separate run of Spanish text.
         *
         * `data-testid` because two elements legitimately have the role and the tests need
         * to name this one.
         */}
        <div
          id={scopeId}
          role="img"
          data-testid="muscle-readonly-map"
          aria-label={description || label}
          style={{ width: "100%", height: "100%" }}
        >
          <Body
            data={data}
            side={side}
            scale={0.82}
            border={DIAGRAM.figureStroke}
            defaultFill={UNLIT_FILL}
            defaultStroke={UNLIT_STROKE}
            defaultStrokeWidth={1}
            /*
             * No `onBodyPartPress`. This is the substantive difference from
             * `MuscleSelector` and it is a prop that is simply absent rather than a handler
             * that returns early -- a handler that does nothing is still a tap target the
             * athlete can aim at.
             */
          />
        </div>
      </div>

      {description && (
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            lineHeight: "16px",
            color: "inherit",
            textAlign: "center",
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/** The muscles present, biggest first, as a Spanish sentence. */
function describeDistribution(counts: ReadonlyMap<Slug, number>, total: number): string {
  const present = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (present.length === 0 || total === 0) return "";

  const names = present
    .map(([slug]) => muscleDefinition(slug)?.label)
    .filter((name): name is string => typeof name === "string");

  if (names.length === 0) return "";

  // The top two, then a count of the rest. Every name listed would wrap to three lines on a
  // phone and bury the figure; the count keeps the information without the wall.
  const [first, second, ...rest] = names;
  const head = second ? `${first} y ${second}` : first;
  const tail = rest.length > 0 ? ` y ${rest.length} más` : "";

  return `${head}${tail}`;
}

/**
 * Counts sets per muscle for a planned routine.
 *
 * Exported because the pre-workout summary and this component must agree, and the way they
 * would silently disagree is each counting slightly differently -- one including warm-ups,
 * the other not. One function, called twice.
 *
 * Only `target_sets` counts: a warm-up set is not a set the athlete is working towards, and
 * counting them would inflate every muscle equally and make the distribution say nothing.
 *
 * Matched on both `target` and `bodyParts`, because that is what the library filter does
 * (`muscleFilter`'s matcher and `MUSCLE_DEFINITIONS`' own docblock). Matching only `target`
 * would under-report every muscle whose exercises are filed under a region -- lower back and
 * obliques in particular -- and the pre-workout summary would say a routine hits less of the
 * body than it does.
 *
 * `target` is a single string, not a list: that is the catalog's shape
 * (`exercises.target` in the generated types), and a muscle covers it when the string is
 * one of its `targets`.
 *
 * A muscle the catalog lists under several keys is counted once per exercise, not once per
 * matching key: `chest` covers both `target: "pectorals"` and `body_part: "chest"`, and a
 * bench press that matches both must be three sets of chest, not six.
 *
 * The same holds for an alias, and `canonicalSlug` is where it happens. `obliques` declares
 * `aliasOf: "abs"` precisely so that it is *not* a second muscle -- the catalog has no
 * obliques row, so the two names cover the same thing. Counting both would put one plank in
 * two rows of the summary and count it twice in the denominator ("Abdominales 33%, Oblicuos
 * 33%" for a session that is half abs and half chest), and it would inflate the total the tint
 * thresholds read, shading a muscle the athlete never trained.
 *
 * Folded here, in the one function both consumers read, rather than in the summary: folding
 * downstream would let the list and the figure disagree, which is the single failure this
 * function exists to prevent.
 */
export function countMuscleSets(
  planned: readonly {
    exercise: { target: string; body_part: string };
    target_sets: number;
  }[],
): Map<Slug, number> {
  const definitions = enabledSlugs();
  const counts = new Map<Slug, number>();

  for (const item of planned) {
    const touched = new Set<Slug>();

    for (const slug of definitions) {
      const definition = muscleDefinition(slug);
      if (!definition) continue;

      const byTarget = definition.targets.includes(item.exercise.target);
      const byBodyPart = definition.bodyParts.includes(item.exercise.body_part);
      if (!byTarget && !byBodyPart) continue;

      touched.add(canonicalSlug(slug));
    }

    for (const slug of touched) {
      counts.set(slug, (counts.get(slug) ?? 0) + item.target_sets);
    }
  }

  return counts;
}

/**
 * The muscle a slug should be counted as.
 *
 * An alias resolves to the muscle it aliases. `abs` maps to itself, so every non-aliased
 * muscle needs no special case and the caller can apply this unconditionally.
 */
function canonicalSlug(slug: Slug): Slug {
  const definition = muscleDefinition(slug);
  if (!definition?.aliasOf) return slug;

  // Only follow the alias when the muscle it names is one the product can actually show. A
  // typo in `aliasOf` would otherwise move every set into a region that renders inert --
  // the count would still add up, and the athlete would just be told they trained nothing.
  const canonical = muscleDefinition(definition.aliasOf);
  return canonical?.enabled ? definition.aliasOf : slug;
}
