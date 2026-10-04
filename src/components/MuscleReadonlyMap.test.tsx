/**
 * @vitest-environment jsdom
 *
 * MuscleReadonlyMap.test.tsx — a picture that does not behave like a control.
 *
 * The risk in this component is not that it draws the wrong muscle. It is that it draws the
 * right muscle *and invites a tap that goes nowhere*. `MuscleSelector` in `readOnly` mode
 * looks almost exactly like this and is full of affordances: a front/back radiogroup, a
 * hover rule per muscle, a legend of buttons wired to `onSelectMuscle`. Copying its look
 * without its wiring would ship dead controls onto the workout screen.
 *
 * So the tests are mostly about absence -- what must *not* be there -- plus the counting,
 * which has to agree with the rest of the product or the pre-workout summary lies.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Slug } from "react-muscle-highlighter";
import { MuscleReadonlyMap, countMuscleSets } from "./MuscleReadonlyMap";
import { MUSCLE_DEFINITIONS } from "../lib/muscleMap";
import { ACCENT, DIAGRAM } from "../design/tokens";

afterEach(cleanup);

/** A counts map, so the tests read as the session they describe. */
function counts(...entries: [Slug, number][]): Map<Slug, number> {
  return new Map(entries);
}

const EMPTY = new Map<Slug, number>();

/**
 * The map's own figure, by test id.
 *
 * Not `getByRole("img")`: the library's `<svg>` carries `role="img"` too, and the wrapper is
 * there precisely to replace that label. Two elements with the role is the intended result.
 */
function figure(container: HTMLElement): HTMLElement {
  return container.querySelector("[data-testid='muscle-readonly-map']")!;
}

/** The label this component announces, not the library's. */
function announced(container: HTMLElement): string {
  return figure(container).getAttribute("aria-label") ?? "";
}

/**
 * The fill chosen for each muscle.
 *
 * Keyed on the library's `id={slug}` -- that is the only per-muscle attribute it writes --
 * and collapsed, because a muscle can be drawn from several `<path>` elements that all share
 * the one id.
 */
function allFills(): Map<string, string> {
  const out = new Map<string, string>();
  for (const shape of document.querySelectorAll("svg [id]")) {
    out.set(shape.getAttribute("id")!, shape.getAttribute("fill") ?? "");
  }
  return out;
}

/** Every `<style>` rule this component wrote. */
function rules(container: HTMLElement): string {
  return [...container.querySelectorAll("style")]
    .map((s) => s.textContent ?? "")
    .join("");
}

describe("not being a control", () => {
  it("renders no button anywhere", () => {
    render(<MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución muscular" />);

    // A diagram on a workout screen is decoration. A button is a promise to do something,
    // and this component's whole reason for existing is that it does not.
    expect(document.querySelectorAll("button")).toHaveLength(0);
  });

  it("gives the figure a single image role, not a radiogroup", () => {
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución muscular" />,
    );

    // `MuscleSelector` would put a radiogroup here with one radio per muscle. The role
    // matters more than the count: a radiogroup announces "choose one of these" to a
    // screen reader whether or not the markup looks pressable.
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(figure(container).getAttribute("role")).toBe("img");
  });

  it("replaces the library's English asset name with its own label", () => {
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución" />,
    );

    // `react-muscle-highlighter` labels its own svg `male-body-front`: an internal string in
    // English naming the asset rather than the content. Wrapping it in `role="img"` makes
    // that subtree presentational, so the announced name is the Spanish description and
    // "male-body-front" never reaches the user.
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe("male-body-front");
    expect(announced(container)).toBe("Pecho");
  });

  it("makes no focusable element", () => {
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución muscular" />,
    );
    // Tab stops are the other half of "interactive": a shape you can focus but not activate
    // strands keyboard users on a dead stop with no explanation.
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("[aria-disabled='true']")).toHaveLength(0);
  });

  it("makes the whole subtree untargetable, defeating the library's own cursor", () => {
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución muscular" />,
    );

    /*
     * The important part is that this is not one selector for the wrapper. The library sets
     * `style="cursor: pointer"` on every muscle path itself, and `pointer-events` is
     * inherited behaviour rather than an inherited property -- a wrapper's `none` is enough
     * to make descendants untargetable, but the descendant's *own* `cursor: pointer` is what
     * the pointer would pick up, so the rule has to name the subtree too.
     */
    expect(rules(container)).toContain("pointer-events: none");
    expect(rules(container)).toContain("cursor: default");
    expect(rules(container)).toMatch(/#\S+ \*/);

    // And the library really does paint a pointer cursor on all twenty shapes, which is what
    // makes the override necessary rather than paranoia.
    const cursors = [...container.querySelectorAll("svg path[id]")].map(
      (p) => (p as HTMLElement).style.cursor,
    );
    expect(cursors.length).toBeGreaterThan(0);
    expect(cursors.every((c) => c === "pointer")).toBe(true);
  });

  it("writes no hover rule for any muscle", () => {
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 4], ["quadriceps", 3])} label="Distribución" />,
    );
    // `MuscleSelector` writes one rule per muscle. A rule that changes colour on hover is
    // the visible half of an affordance -- removing the handler but keeping the glow would
    // leave the reader hunting for the tap that does nothing.
    expect(rules(container)).not.toContain(":hover");
  });

  it("scopes its one rule to its own figure", () => {
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución" />,
    );
    // The id is generated per instance, so two maps on a page cannot disable each other's
    // pointer events through a shared selector.
    const id = figure(container).id;
    expect(id).not.toBe("");
    expect(rules(container)).toContain(`#${id}`);
  });
});

describe("the lighting", () => {
  it("lights a muscle that has sets and leaves the rest inert", () => {
    render(<MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución" />);

    const fills = allFills();
    // Calves has nothing in this session, so it is the control. Comparing two *lit*
    // muscles would prove nothing -- the first version of this test compared chest against
    // quadriceps when both had sets, and both came back lit.
    expect(fills.get("chest")).not.toBe(fills.get("calves"));
    expect(fills.get("calves")).toBe(DIAGRAM.inert);
  });

  it("changes at least one muscle's fill between an empty and a full session", () => {
    const { unmount } = render(<MuscleReadonlyMap counts={EMPTY} label="Distribución" />);
    const empty = allFills();
    unmount();

    render(<MuscleReadonlyMap counts={counts(["chest", 9])} label="Distribución" />);
    const full = allFills();

    // A routine that is all chest has to look like it, and the way to check that without
    // hardcoding the library's internal slugs is: at least one muscle changed.
    const changed = [...empty.keys()].filter((k) => empty.get(k) !== full.get(k));
    expect(changed).toContain("chest");
  });

  it("uses the accent for the muscle carrying the most volume", () => {
    render(<MuscleReadonlyMap counts={counts(["chest", 12], ["calves", 1])} label="Distribución" />);
    const fills = allFills();

    // Three steps, not a ramp: the point is that the biggest muscle is identifiable, and
    // a fourth shade of the same red would need a legend nobody reads. The rarer muscle
    // stays on the plainer lit fill rather than going dim, because "present" must never
    // look like "absent".
    expect(fills.get("chest")).toBe(ACCENT.muted);
    expect(fills.get("calves")).toBe(DIAGRAM.selectedFill);
    expect(fills.get("calves")).not.toBe(DIAGRAM.inert);
  });

  it("lights no muscle at all for an empty session", () => {
    render(<MuscleReadonlyMap counts={EMPTY} label="Distribución" />);
    const fills = [...allFills().values()];

    // An all-inert figure is the honest state for a session with nothing planned, and it is
    // distinguishable from a figure that failed to render.
    expect(fills.length).toBeGreaterThan(0);
    expect(new Set(fills).size).toBe(1);
    expect(fills[0]).toBe(DIAGRAM.inert);
  });

  it("leaves a muscle the catalog cannot train inert even if a count reaches it", () => {
    // The catalog has no exercises for knees, ankles, hands or head. Lighting one would
    // promise a muscle the athlete cannot train anywhere in the product.
    const unreachable = MUSCLE_DEFINITIONS.find((m) => !m.enabled)!;
    render(
      <MuscleReadonlyMap counts={counts([unreachable.slug, 5])} label="Distribución" />,
    );

    const fills = [...allFills().values()];
    expect(new Set(fills).size).toBe(1);
    expect(fills[0]).toBe(DIAGRAM.inert);
  });

  it("never dims a muscle that has sets below the empty fill", () => {
    // Ordering matters: a muscle with content must never be *less* prominent than one
    // without, or the light has to be read backwards.
    render(<MuscleReadonlyMap counts={counts(["calves", 1])} label="Distribución" />);
    const fills = allFills();

    expect(fills.get("calves")).not.toBe(DIAGRAM.inert);
  });

  it("gives a lit muscle a heavier stroke than an inert one", () => {
    // Weight, not just colour: this has to survive being printed, and it has to survive
    // being looked at by someone who cannot distinguish the hues.
    render(<MuscleReadonlyMap counts={counts(["chest", 9])} label="Distribución" />);
    const widths = [...document.querySelectorAll("svg [id]")]
      .map((el) => el.getAttribute("stroke-width"))
      .filter((s): s is string => s !== null)
      .map(Number);

    expect(new Set(widths).size).toBeGreaterThan(1);
  });
});

describe("the description", () => {
  it("names the muscles it is about, in Spanish, biggest first", () => {
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 8], ["quadriceps", 4], ["biceps", 1])} label="Distribución" />,
    );
    const label = announced(container);

    // A diagram with no text alternative is the most common accessibility failure in a
    // fitness app, and a list of internal slugs would be useless to whoever reads it.
    expect(label).toContain("Pecho");
    expect(label.indexOf("Pecho")).toBeLessThan(label.indexOf("Cuádriceps"));
  });

  it("says what is in it, not what it is not", () => {
    const { container } = render(<MuscleReadonlyMap counts={EMPTY} label="Distribución" />);
    // Nothing planned: no sentence, and the figure falls back to its own label. An empty
    // inventory has nothing to report, and "no muscles" would read as a failure.
    expect(announced(container)).toBe("Distribución");
  });

  it("counts the rest rather than listing every muscle on three lines", () => {
    const { container } = render(
      <MuscleReadonlyMap
        counts={counts(
          ["chest", 8],
          ["quadriceps", 6],
          ["hamstring", 4],
          ["biceps", 3],
          ["triceps", 2],
          ["deltoids", 1],
        )}
        label="Distribución"
      />,
    );
    const text = announced(container);

    // Two names then a count: the figure has to stay a figure on a phone, and the count
    // carries the rest of the information without the wall of text.
    expect(text).toContain("Pecho y Cuádriceps");
    expect(text).toContain("4 más");
  });

  it("uses the singular when only one muscle is in play", () => {
    const { container } = render(<MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución" />);
    expect(announced(container)).toBe("Pecho");
  });

  it("shows the same sentence as visible text", () => {
    // The description is not only for screen readers. A muscle map with no visible caption
    // leaves sighted users guessing which shape is which, and the tint has no legend.
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 8], ["calves", 1])} label="Distribución" />,
    );
    expect(screen.getByText("Pecho y Pantorrillas")).toBeTruthy();
    expect(container.querySelector("figcaption, p")).toBeTruthy();
  });
});

describe("countMuscleSets", () => {
  const press = (target: string[], body_part: string, target_sets = 3) => ({
    exercise: { target, body_part },
    target_sets,
  });

  it("adds the sets for a matching exercise", () => {
    const counts = countMuscleSets([press(["pectorals"], "chest", 4)]);
    expect(counts.get("chest")).toBe(4);
  });

  it("counts a muscle once per exercise, not once per matching key", () => {
    // Chest is covered by `targets: ["pectorals"]` *and* `bodyParts: ["chest"]`, so a bench
    // press matches it twice. Counting both would report eight sets of chest for a four-set
    // exercise, and the tint thresholds would be scaled off a fictional total.
    const counts = countMuscleSets([press(["pectorals"], "chest", 4)]);

    expect(counts.get("chest")).toBe(4);
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("matches on body part as well as target, like the exercise filter does", () => {
    // Lumbar is reached through `bodyParts: ["waist", "back"]`. Matching only `target` would
    // under-report it and the summary would claim a routine hits less of the body than it
    // does -- the exact mistake the pre-workout panel exists to catch.
    const counts = countMuscleSets([press(["glutes"], "waist", 3)]);

    expect(counts.get("lower-back")).toBe(3);
    expect(counts.get("abs")).toBe(3);
  });

  it("accumulates across exercises", () => {
    const counts = countMuscleSets([
      press(["pectorals"], "chest", 4),
      press(["pectorals"], "chest", 3),
      press(["quads"], "upper legs", 5),
    ]);

    expect(counts.get("chest")).toBe(7);
    expect(counts.get("quadriceps")).toBe(5);
  });

  it("ignores an exercise that matches nothing", () => {
    const counts = countMuscleSets([press(["kettlebell swings"], "core", 3)]);
    // Not an error: the catalog is broader than the anatomy map, and inventing a muscle for
    // an unmapped target would light a region the routine does not train.
    expect(counts.size).toBe(0);
  });

  it("never counts a muscle the catalog has no exercises for", () => {
    const unreachable = MUSCLE_DEFINITIONS.find((m) => !m.enabled)!;
    const counts = countMuscleSets([press(["knees"], unreachable.bodyParts[0] ?? "", 3)]);

    for (const [slug] of counts) {
      expect(MUSCLE_DEFINITIONS.find((m) => m.slug === slug)!.enabled).toBe(true);
    }
  });

  it("returns an empty map for no exercises, so the figure renders inert", () => {
    expect(countMuscleSets([]).size).toBe(0);
  });

  it("agrees with the map it feeds, and credits a leg exercise to the whole leg", () => {
    // The two halves are one feature. A summary that counts differently from the figure it
    // sits next to is worse than no summary, because both look authoritative.
    const planned = [press(["pectorals"], "chest", 4), press(["quads"], "upper legs", 4)];
    const counts = countMuscleSets(planned);
    const { container } = render(<MuscleReadonlyMap counts={counts} label="Distribución" />);

    // Chest leads on its own four sets, and the four upper-leg muscles tie -- all of them are
    // genuinely worked by a squat, so all four are lit and the caption says "y 3 más" rather
    // than pretending one of them is the answer.
    expect(counts.get("chest")).toBe(4);
    for (const leg of ["gluteal", "quadriceps", "hamstring", "adductors"] as Slug[]) {
      expect(counts.get(leg)).toBe(4);
    }
    expect(announced(container)).toContain("Pecho y Glúteos");
    expect(announced(container)).toContain("3 más");
  });
});

describe("layout", () => {
  it("reserves the figure's space by its aspect ratio, before the diagram paints", () => {
    const { container } = render(
      <MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución" aspectRatio={3 / 2} />,
    );
    // A panel whose height is unknown until a library's assets load shifts everything below
    // it. The ratio alone fixes the space, so nothing above or below moves when it paints.
    const frame = container.querySelector("div[style*='aspect-ratio']") as HTMLElement;
    expect(frame.style.aspectRatio).toBe("1.5");
  });

  it("renders the back when asked, and the front by default", () => {
    const { container, rerender } = render(
      <MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución" />,
    );
    const front = container.innerHTML;

    rerender(<MuscleReadonlyMap counts={counts(["chest", 4])} label="Distribución" side="back" />);
    // Posterior musculature is a different figure entirely -- traps and glutes only exist
    // here -- so "same component, different SVG" is the observable that matters.
    expect(container.innerHTML).not.toBe(front);
  });
});
