/**
 * @vitest-environment jsdom
 *
 * MuscleSelector serves two very different jobs from one component: an anatomy
 * *filter* in the catalog, and a read-only rank *display* in the progress view.
 * The read-only path is the risky one, because it inherits every affordance of a
 * filter -- hover brightening, pressed styling, a "clear selection" button, a
 * filter hint -- and any of those surviving would tell the user their rank is
 * something they can toggle.
 *
 * So this file pins the differences between the two modes rather than testing the
 * geometry, which `verifyMuscleMap` already covers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Slug } from "react-muscle-highlighter";
import { MuscleSelector } from "./MuscleSelector";
import { enabledSlugs } from "../lib/muscleMap";
import { RANKS } from "../lib/ranks/rankConfig";

const COLORS = new Map<Slug, string>([
  ["chest", "#0ea5e9"],
  ["upper-back", "#a5b4fc"],
]);

afterEach(cleanup);

/**
 * Body of the rule block whose selector ends with `selector`.
 *
 * String search rather than a RegExp: the selectors contain `[id="chest"]`, which
 * is a character class in a pattern and would silently match the wrong thing. The
 * scope id comes from `useId`, so it is unknown to the test; matching on the
 * selector suffix keeps the assertion about behaviour rather than React's ids.
 */
function styleFor(selector: string): string {
  const css = [...document.querySelectorAll("style")]
    .map((s) => s.textContent ?? "")
    .join("\n");
  const at = css.indexOf(selector);
  if (at === -1) return "";
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  if (open === -1 || close === -1) return "";
  return css.slice(open + 1, close);
}

describe("MuscleSelector in read-only mode", () => {
  it("renders one real button per trainable muscle, named in Spanish", () => {
    render(
      <MuscleSelector
        selected={[]}
        onChange={() => undefined}
        readOnly
        colorByMuscle={COLORS}
      />,
    );
    const legend = screen.getByRole("list", { name: "Músculos" });
    const buttons = within(legend).getAllByRole("button");
    expect(buttons).toHaveLength(enabledSlugs().length);
    // Named in Spanish, never by slug.
    expect(within(legend).getByRole("button", { name: /Pecho/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^chest$/ })).toBeNull();
  });

  it("does not offer aria-pressed, because nothing is pressed", () => {
    render(
      <MuscleSelector selected={[]} onChange={() => undefined} readOnly colorByMuscle={COLORS} />,
    );
    const buttons = screen.getAllByRole("button");
    const legendButtons = buttons.filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(legendButtons).toHaveLength(0);
  });

  it("hides the clear-selection control and the filter hint", () => {
    render(
      <MuscleSelector selected={[]} onChange={() => undefined} readOnly colorByMuscle={COLORS} />,
    );
    expect(screen.queryByText(/Quitar selección|Limpiar/i)).toBeNull();
    // The hint explains filtering, which is not what this view does.
    expect(screen.queryByText(/tocando|selecciona/i)).toBeNull();
  });

  it("routes a click to onSelectMuscle and never to onChange", () => {
    let changed = 0;
    let picked: Slug | null = null;
    render(
      <MuscleSelector
        selected={[]}
        onChange={() => {
          changed += 1;
        }}
        readOnly
        colorByMuscle={COLORS}
        onSelectMuscle={(slug) => {
          picked = slug;
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Pecho/ }));
    expect(picked).toBe("chest");
    expect(changed).toBe(0);
  });

  it("highlights a hovered region toward its own rank colour, not grey", () => {
    // Brightening toward grey would discard the rank the user came here to read.
    render(
      <MuscleSelector selected={[]} onChange={() => undefined} readOnly colorByMuscle={COLORS} />,
    );
    const chest = styleFor('path[id="chest"]:hover');
    expect(chest).toContain("fill:");
    expect(chest).not.toContain("#2f2f38");
    expect(chest.toLowerCase()).toContain("#0ea5e9");
  });

  it("emits no hover affordance for a muscle with no rank", () => {
    render(
      <MuscleSelector selected={[]} onChange={() => undefined} readOnly colorByMuscle={COLORS} />,
    );
    // `gluteal` is trainable but absent from the colour map.
    expect(styleFor('path[id="gluteal"]:hover')).toBe("");
  });

  it("emits valid CSS when several muscles are highlighted", () => {
    // Regression: the hover rules used to be comma-joined, which produces
    // `a { ... }, b { ... }` -- a syntax error the browser discards wholesale, so
    // hover silently died on every muscle as soon as a second one was coloured.
    render(
      <MuscleSelector selected={[]} onChange={() => undefined} readOnly colorByMuscle={COLORS} />,
    );
    const css = [...document.querySelectorAll("style")]
      .map((s) => s.textContent ?? "")
      .join("\n");
    // A stray `}` before a `,` is the exact shape of that bug.
    expect(css).not.toMatch(/\}\s*,/);
    // Both muscles still get their own rule.
    expect(styleFor('path[id="chest"]:hover')).toContain("fill:");
    expect(styleFor('path[id="upper-back"]:hover')).toContain("fill:");
  });

  it("paints the rank colour over the base fill", () => {
    render(
      <MuscleSelector selected={[]} onChange={() => undefined} readOnly colorByMuscle={COLORS} />,
    );
    const path = document.querySelector('path[id="chest"]') as SVGPathElement | null;
    expect(path).not.toBeNull();
    // The library applies `styles.fill` as a plain attribute.
    expect(path!.getAttribute("fill")).toBe("#0ea5e9");
  });

  it("still renders the front/back switch, so back muscles are reachable", () => {
    render(
      <MuscleSelector selected={[]} onChange={() => undefined} readOnly colorByMuscle={COLORS} />,
    );
    const group = screen.getByRole("radiogroup");
    expect(within(group).getByRole("radio", { name: "Frontal" })).toBeTruthy();
    expect(within(group).getByRole("radio", { name: "Posterior" })).toBeTruthy();
  });

  it("lets a per-muscle badge carry the rank glyph into the text alternative", () => {
    const gold = RANKS.find((r) => r.id === "gold")!;
    render(
      <MuscleSelector
        selected={[]}
        onChange={() => undefined}
        readOnly
        colorByMuscle={COLORS}
        renderBadge={() => <span>{gold.glyph}</span>}
      />,
    );
    // Glyphs alone are not readable text, so the view also names the rank; what
    // this asserts is that the badge reaches the DOM at all.
    expect(screen.getAllByText(gold.glyph).length).toBeGreaterThan(0);
  });
});