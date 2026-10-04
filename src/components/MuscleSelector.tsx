/**
 * MuscleSelector.tsx €€” interactive anatomy map.
 *
 * Built on `react-muscle-highlighter` (MIT), which supplies the body geometry.
 * This component owns the product behaviour: the Spanish legend, the OLED/amber
 * visual language, the front/back navigation, and screen-reader access.
 *
 * Why the library's `disabledParts` is deliberately NOT used: it hardcodes a
 * bright beige fill (`#EBEBE4`) that would glare on a true-black OLED panel.
 * Regions are styled through `styles.fill` instead, and regions with no
 * exercises in the catalog are made inert with scoped CSS rather than hidden --
 * a body with holes in it reads as a rendering bug.
 *
 * The library renders each muscle as `<path id={slug}>`. Those ids are stable,
 * so hover, inert and selected behaviour is expressed as generated CSS scoped
 * to this component. No DOM mutation, no extra render pass.
 *
 * Accessibility
 * -------------
 * The map itself is not exposed as an interactive widget: the SVG paths carry no
 * roles, names or keyboard handlers, and adding them to ~90 raw paths would be
 * both noisy for a screen reader and unusable by keyboard. Instead the figure is
 * `aria-hidden` and the legend below it is a real list of buttons with Spanish
 * names. The map is a redundant, pointer-only enhancement over that list; every
 * muscle is reachable without it.
 */

import { useId, useMemo, useState } from "react";
import Body from "react-muscle-highlighter";
import type { Slug } from "react-muscle-highlighter";
import {
  enabledSlugs,
  disabledSlugs,
  muscleDefinition,
  MUSCLE_DEFINITIONS,
} from "../lib/muscleMap";
import { selectionSides, selectionLabels } from "../lib/muscleFilter";
import { lighten } from "../lib/ranks/rankColors";
import { ACCENT, DIAGRAM } from "../design/tokens";
import { MUSCLE_FILTER_LABELS as T } from "../lib/i18n";

// --- OLED palette ---------------------------------------------------------
/**
 * The map's own four-state palette, and it is local rather than taken from `tokens`.
 *
 * These are silhouette values, not roles: a muscle that is neither selected nor in the
 * catalog has to sit *between* the canvas and the selection, and no general surface token
 * happens to land there. The selected pair, though, is the product's accent and is taken
 * from it -- the map is how an athlete picks which muscles to train, so a muscle picked
 * here should be the same red as the button that will act on it.
 *
 * `DIAGRAM.selectedStroke` is a lighter tint of the fill rather than `ACCENT.text`, because it
 * has to survive *on* the fill: at equal luminance the region would read as one flat
 * silhouette with no edge.
 */
const BASE_FILL = DIAGRAM.regionFill;
/**
 * A region with exercises in the catalog.
 *
 * `DIAGRAM.regionStroke` rather than an alpha written here: the map used to draw a body
 * in seven different greys, and on a diagram where weight is supposed to mean something,
 * seven arbitrary values means there is nothing consistent for an athlete to learn.
 */
const BASE_STROKE = DIAGRAM.regionStroke;
/**
 * No exercises in the catalog: recedes into the background.
 *
 * Its edge is `DIAGRAM.inert` -- the same value as the rest ring's track and the
 * carousel's inactive dot. Those were 0.07, 0.08 and 0.08, which is one role written
 * three times with a rounding difference, not three roles.
 */
const INERT_FILL = DIAGRAM.inertFill;
const INERT_STROKE = DIAGRAM.inert;

/** Slug -> CSS selector. Slugs are valid identifiers; `lower-back` is fine. */
function pathSelector(scopeId: string, slug: Slug): string {
  return `#${scopeId} path[id="${slug}"]`;
}

export type ViewSide = "front" | "back";

export interface MuscleSelectorProps {
  /** Zero or more selected muscles; the filter is their union. */
  selected: Slug[];
  /** Called with the full next selection. */
  onChange: (next: Slug[]) => void;
  /** Exercise count per muscle, shown in the legend. */
  counts?: Map<Slug, number>;
  className?: string;
  /**
   * Per-muscle fill override, used by the ranks map to paint by rank.
   *
   * Kept separate from the selection palette so the same component serves both
   * the filter and the progression view without either one special-casing the
   * other's colours.
   */
  colorByMuscle?: Map<Slug, string>;
  /**
   * Read-only mode.
   *
   * The ranks map reuses this component but must not read as a filter: no
   * selection highlight, no "clear selection", no filter hint, and a click opens
   * a detail panel instead of toggling anything. The hover *brightening* is
   * what makes a region look pressable, so it points at the muscle's own rank
   * colour rather than at grey.
   */
  readOnly?: boolean;
  /** Opens a detail panel for a muscle. Used only in read-only mode. */
  onSelectMuscle?: (slug: Slug) => void;
  /**
   * Extra trailing content per legend button, read-only mode only.
   *
   * The ranks map renders each muscle's rank glyph here, so the accessible
   * alternative carries the rank as well as the colour.
   */
  renderBadge?: (slug: Slug) => React.ReactNode;
  /** Accessible name for the legend list; overrides the filter phrasing. */
  legendLabel?: string;
}

export function MuscleSelector({
  selected,
  onChange,
  counts,
  className = "",
  colorByMuscle,
  onSelectMuscle,
  readOnly = false,
  renderBadge,
  legendLabel,
}: MuscleSelectorProps) {
  const [side, setSide] = useState<ViewSide>("front");
  const scopeId = useId().replace(/[:]/g, "");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  /**
   * Per-muscle paint, with three layers in priority order:
   *
   * 1. `colorByMuscle` (the ranks map) -- the muscle's own rank colour.
   * 2. Selection fill (the library filter).
   * 3. The inactive base.
   *
   * `colorByMuscle` wins so rank stays readable while a filter is applied.
   */
  const data = useMemo(
    () =>
      MUSCLE_DEFINITIONS.map((muscle) => {
        const isSelected = selectedSet.has(muscle.slug);
        const override = colorByMuscle?.get(muscle.slug);
        const fill = override ?? (!muscle.enabled ? INERT_FILL : isSelected ? DIAGRAM.selectedFill : BASE_FILL);
        return {
          slug: muscle.slug,
          styles: {
            fill,
            stroke: !muscle.enabled
              ? INERT_STROKE
              : isSelected
                ? DIAGRAM.selectedStroke
                : BASE_STROKE,
            strokeWidth: isSelected ? 2 : 1,
          },
        };
      }),
    [selectedSet, colorByMuscle],
  );

  const trainable = useMemo(() => enabledSlugs(), []);
  const inert = useMemo(() => disabledSlugs(), []);
  const sides = useMemo(() => selectionSides(selected), [selected]);

  /**
   * Generated, scoped rules for hover, inert regions and the selected glow.
   *
   * In read-only mode the hover rule is emitted with a lighter version of each
   * muscle's own fill rather than a neutral grey: brightening toward grey would
   * discard the rank colour the user is reading, which is the whole content of
   * the map.
   */
  const rules = useMemo(() => {
    const hoverTargets = readOnly
      ? trainable.filter((slug) => colorByMuscle?.has(slug))
      : trainable;
    /**
 * One block per muscle, newline-joined.
 *
 * Deliberately not a comma-joined selector list. A rule body has to be inside the
 * braces, so joining finished blocks with `,` produces `a { ... }, b { ... }`,
 * which is a syntax error that makes the browser discard the *whole* list. With
 * two or more highlighted muscles that silently killed hover on every one of them.
 */
const hoverRules = hoverTargets
      .map((slug) => {
        const hoverFill = readOnly
          ? lighten(colorByMuscle?.get(slug) ?? BASE_FILL, 0.12)
          : DIAGRAM.regionHoverFill;
        const glow = readOnly
          ? (colorByMuscle?.get(slug) ?? ACCENT.glow)
          : ACCENT.glow;
        return `${pathSelector(scopeId, slug)}:hover {\n  fill: ${hoverFill} !important;\n  filter: drop-shadow(0 0 6px ${glow});\n}`;
      })
      .join("\n");

    const inertRule = inert.map((slug) => pathSelector(scopeId, slug)).join(",\n");
    const selectedRules = [...selected]
      .map((slug) => pathSelector(scopeId, slug))
      .join(",\n");

    return [
      `#${scopeId} path { transition: fill 140ms ease, filter 140ms ease; }`,
      hoverRules,
      selectedRules
        ? `${selectedRules} {\n  filter: drop-shadow(0 0 10px ${DIAGRAM.selectedGlow});\n}`
        : "",
      // Must come after the hover rule and be at least as specific, otherwise
      // hovering a selected muscle overwrites its fill with the hover grey and
      // the selection appears to drop out.
      selectedRules
        ? `${selectedRules}:hover {\n  fill: ${DIAGRAM.selectedFill} !important;\n  filter: drop-shadow(0 0 14px ${DIAGRAM.selectedHoverGlow});\n}`
        : "",
      inertRule ? `${inertRule} {\n  pointer-events: none;\n  cursor: default;\n}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [trainable, inert, selected, scopeId, readOnly, colorByMuscle]);

  const toggle = (slug: Slug) => {
    // Read-only still opens a panel; it just never changes the selection.
    if (readOnly) {
      onSelectMuscle?.(slug);
      return;
    }
    onChange(selectedSet.has(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
  };

  const hasSelection = selected.length > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      <style>{rules}</style>

      <div className="flex items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label={T.viewLabel}
          className="flex rounded-lg border border-white/10 bg-neutral-950/60 p-0.5"
        >
          {(["front", "back"] as const).map((option) => {
            const active = side === option;
            // Badge the tab that holds a selection the user cannot currently
            // see, so flipping views never looks like losing the filter.
            const hiddenSelection =
              hasSelection && !sides[option] && (option === "front" ? sides.back : sides.front);
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSide(option)}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs transition ${
                  active
                    ? "bg-accent text-neutral-950"
                    : "text-neutral-400 hover:text-neutral-100"
                }`}
              >
                {option === "front" ? T.front : T.back}
                {hiddenSelection && (
                  <span
                    aria-hidden="true"
                    title="Hay más músculos seleccionados en la otra vista"
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                  />
                )}
                {hiddenSelection && <span className="sr-only">(selección en la otra vista)</span>}
              </button>
            );
          })}
        </div>

        {!readOnly && hasSelection && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
          >
            {T.removeSelection}
          </button>
        )}
      </div>

      {/* Decorative: the legend below is the accessible control. */}
      <div className="flex justify-center rounded-2xl border border-white/10 bg-black p-3">
        <div id={scopeId} aria-hidden="true">
          <Body
            data={data}
            side={side}
            scale={0.82}
            border={DIAGRAM.figureStroke}
            defaultFill={BASE_FILL}
            defaultStroke={BASE_STROKE}
            defaultStrokeWidth={1}
            onBodyPartPress={(part) => {
              const slug = part.slug;
              if (!slug) return;
              const def = muscleDefinition(slug);
              // Inert regions are pointer-events:none, but guard anyway so a
              // future library change cannot open a dead filter.
              if (!def || !def.enabled) return;
              toggle(slug);
            }}
          />
        </div>
      </div>

      {/* The accessible control: one real button per muscle, Spanish names. */}
      <ul aria-label={legendLabel ?? T.alternateList} className="flex flex-wrap gap-1.5">
        {trainable.map((slug) => {
          const def = muscleDefinition(slug);
          if (!def) return null;
          const active = readOnly ? false : selectedSet.has(slug);
          const count = counts?.get(slug);
          const onOtherSide = !sides[side];
          return (
            <li key={slug}>
              <button
                type="button"
                aria-pressed={readOnly ? undefined : active}
                onClick={() => toggle(slug)}
                className={`flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200"
                }`}
              >
                {def.label}
                {count !== undefined && (
                  <span className={active ? "text-accent/70" : "text-neutral-600"}>
                    {count}
                  </span>
                )}
                {renderBadge?.(slug)}
                {active && onOtherSide && (
                  <span aria-hidden="true" className="text-[9px] text-accent/70">
                    {side === "front" ? "· espalda" : "· frente"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* A filter hint would be a lie here: nothing is being filtered. */}
      {!readOnly && (
        <p className="text-[11px] text-neutral-500">
          {hasSelection ? T.hintActive(selectionLabels(selected)) : T.hint}
        </p>
      )}
    </div>
  );
}
