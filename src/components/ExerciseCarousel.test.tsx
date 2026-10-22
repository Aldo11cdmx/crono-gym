/**
 * @vitest-environment jsdom
 *
 * ExerciseCarousel.test.tsx — the strip has to answer "where am I" without being read.
 *
 * Almost every assertion here is about a property that is easy to set and easy to lose:
 * the snap type, the scale on the active bubble, the success token on a finished one.
 * Each of them was a specific thing that would silently degrade the strip rather than
 * break it -- a strip that scrolls freely still scrolls, a bubble that stops scaling is
 * still a bubble, and a green tick next to an amber chip still looks like a tick.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ExerciseCarousel, type CarouselItem } from "./ExerciseCarousel";
import { borderColor, sameColor } from "../test-support/color";
import { ACCENT, DIAGRAM, GLASS, STATUS, SUPERSET, SURFACE, TEXT } from "@/design/tokens";
import { getSupersetInfo } from "@/lib/workout/supersetUtils";
import type { Exercise } from "@/types/supabase";

afterEach(cleanup);

/**
 * jsdom implements neither `scrollIntoView` nor CSS colour normalisation, and the strip
 * needs both: the effect scrolls the active bubble into view, and every assertion about
 * a token's colour reads it back off the style as `rgb(...)` rather than as the hex the
 * token holds.
 */
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

/** The colour out of a `border` shorthand. */
function borderColorOf(element: Element): string {
  return borderColor((element as HTMLElement).style.border);
}

function exercise(id: string, name: string, gif = ""): Exercise {
  return {
    id,
    name,
    body_part: "upper legs",
    target: "quads",
    equipment: "barbell",
    gif_url: gif,
  } as Exercise;
}

function item(
  id: string,
  name: string,
  done: number,
  total: number,
  gif = "",
  groupId: string | null = null,
): CarouselItem {
  return { key: id, exercise: exercise(id, name, gif), done, total, groupId };
}

const SQUAT = item("squat", "Sentadilla trasera", 0, 3);
const BENCH = item("bench", "Press banca", 3, 3);
const ROW = item("row", "Remo con barra", 1, 4);

function renderStrip(
  items: CarouselItem[] = [SQUAT, BENCH, ROW],
  selectedKey: string | null = "squat",
  onSelect = vi.fn(),
) {
  const view = render(
    <ExerciseCarousel items={items} selectedKey={selectedKey} onSelect={onSelect} />,
  );
  return { ...view, onSelect, list: view.container.querySelector("[data-testid='exercise-carousel']") as HTMLElement };
}

/** The bubble for an exercise, by its full catalog name. */
function bubble(name: string): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(`^${name}`) });
}

/** The bubble whose *shortened* label matches, for the stripping tests. */
function bubbleByLabel(text: string): HTMLElement {
  return screen
    .getAllByRole("tab")
    .find((tab) => tab.textContent?.includes(text))!;
}

describe("snapping", () => {
  it("snaps on x, mandatorily", () => {
    const { list } = renderStrip();

    // `mandatory`, not `proximity`. With `proximity` a flick can rest between two bubbles,
    // and then "the centred bubble is the current exercise" is not a rule the strip keeps.
    // It is a coincidence, which is the one thing a position indicator cannot be.
    expect(list.style.scrollSnapType).toBe("x mandatory");
  });

  it("gives every bubble a snap point, or `mandatory` has nothing to snap to", () => {
    const { container } = renderStrip();

    // `scroll-snap-align` on the child, not the container: the container is what snaps,
    // its children are what it snaps *to*.
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      expect((tab as HTMLElement).style.scrollSnapAlign).toBe("center");
    }
  });

  it("aligns to center rather than start, so the active bubble is not clipped", () => {
    const { container } = renderStrip();
    const tab = container.querySelector('[role="tab"]') as HTMLElement;

    // `start` would put the first bubble hard against the app's own gutter, where a long
    // name gets its first three letters cut.
    expect(tab.style.scrollSnapAlign).toBe("center");
  });

  it("hides the scrollbar, because the snap and the scale are the affordance", () => {
    const { list } = renderStrip();

    // A bar under a 56px strip on a phone is mostly a place for a thumb to land, and it
    // competes with the one gesture that matters.
    expect(list.className).toContain("cronos-carousel");
    expect(list.style.scrollbarWidth).toBe("none");
  });
});

describe("the three states", () => {
  it("scales the active bubble and leaves the rest at rest", () => {
    const { container } = renderStrip();

    const active = container.querySelector('[aria-selected="true"]')!;
    const others = [...container.querySelectorAll('[aria-selected="false"]')];

    // The only thing on the strip that changes size, and the reason the current exercise
    // is findable from across a room.
    expect((active.firstElementChild as HTMLElement).style.transform).toBe("scale(1.12)");
    for (const other of others) {
      expect((other.firstElementChild as HTMLElement).style.transform).toBe("scale(1)");
    }
  });

  it("borders the active bubble with the accent", () => {
    const { container } = renderStrip();

    const active = container.querySelector('[aria-selected="true"]')!;
    // A *pending* bubble, not just any unselected one: "Remo" has sets left, so its border
    // is the inert hairline. Bench is also unselected but finished, and it carries the
    // success border.
    const pending = container.querySelector("[data-key='row']")!;

    // The active border is the red accent token, matching the ActiveWorkout theme.
    expect(sameColor(borderColorOf(active.firstElementChild!), ACCENT.base)).toBe(true);
    expect(sameColor(borderColorOf(pending.firstElementChild!), GLASS.border)).toBe(true);
  });

  it("marks a finished exercise with STATUS.success, and the tick with it", () => {
    renderStrip();

    const finished = bubble("Press banca");
    const tick = finished.querySelector("span[aria-hidden='true']:last-child");

    // The token is a blue, not a green, and that is the whole reason to reach for it:
    // `tokens.ts` forbids a saturated green here because a deuteranope folds green into
    // `STATUS.warning`'s amber and the two would collapse.
    expect(finished.innerHTML).toContain(STATUS.success.base.replace("#", "").toLowerCase());
    expect(tick).toBeTruthy();
  });

  it("draws a complete bubble's ring in success and a partial one in the accent", () => {
    const { container } = renderStrip();

    const ringOf = (name: string) =>
      container
        .querySelector(`[data-key='${name}']`)!
        .querySelectorAll("circle")[1]
        .getAttribute("stroke");

    // Complete is success; in progress is the accent, because "being worked on" is not a
    // status, it is progress.
    expect(ringOf("bench")).toBe(STATUS.success.base);
    expect(ringOf("row")).toBe(ACCENT.base);
  });

  it("draws no ring at all for an exercise nothing has been logged against", () => {
    const { container } = renderStrip();

    // A ring at zero would be a full grey circle saying nothing, and the numeral behind
    // it is what identifies the exercise.
    expect(
      container.querySelector("[data-key='squat']")!.querySelectorAll("circle"),
    ).toHaveLength(0);
  });
});

describe("naming a bubble", () => {
  it("says which exercise of how many, and how far in", () => {
    renderStrip();

    // "Sentadilla trasera, 0 de 3 series" says how far into the *exercise*; without
    // "2 de 3" at the front there is no way to navigate the strip without seeing it.
    expect(screen.getByRole("tab", { name: /^Sentadilla trasera, 1 de 3, 0 de 3 series$/ })).toBeTruthy();
  });

  it("strips the equipment prefix so the label fits", () => {
    renderStrip([item("b", "Barbell Bench Press - Neutral Grip", 0, 3)], "b");

    // "Barbell Bench Press - Neutral Grip" truncated at 68px is "Barbell Bench Pr",
    // which names nothing.
    expect(bubbleByLabel("Bench Press")).toBeTruthy();
    expect(within(bubble("Barbell Bench Press - Neutral Grip")).getByText("Bench Press")).toBeTruthy();
  });

  it("keeps the original name when stripping would leave nothing", () => {
    renderStrip([item("o", "Weighted", 0, 3)], "o");
    expect(bubbleByLabel("Weighted")).toBeTruthy();
  });

  it("names the bubble with the Spanish label", () => {
    renderStrip([item("w", "band wrist curl", 0, 3)], "w");

    // The strip reads in the same vocabulary as the rest of the app.
    expect(bubbleByLabel("Curl de muñeca con banda")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: /^Curl de muñeca con banda, 1 de 1, 0 de 3 series$/ }),
    ).toBeTruthy();
  });
});

describe("missing media", () => {
  it("shows the position numeral instead of an image", () => {
    const { container } = renderStrip();

    const first = container.querySelector("[data-key='squat']")!;
    expect(first.querySelector("img")).toBeNull();
    // The numeral is the fallback identity, which is why the tab's name spells the
    // position out too.
    expect(first.textContent).toContain("1");
  });

  it("does not crash on a missing gif_url", () => {
    // `gif_url` is non-nullable in the generated types, but rows written before the
    // column existed reach this screen without one. The old strip asked for truthiness;
    // reading `.trim()` off undefined would blank the session instead.
    //
    // `unknown` in between because the fixture deliberately violates the declared type,
    // which is the whole point of the test.
    const broken = {
      ...SQUAT,
      exercise: { ...SQUAT.exercise, gif_url: undefined },
    } as unknown as CarouselItem;

    expect(() => renderStrip([broken])).not.toThrow();
    expect(screen.getByRole("tab", { name: /^Sentadilla trasera/ })).toBeTruthy();
  });

  it("renders the image when there is one", () => {
    const { container } = renderStrip([item("s", "Sentadilla", 0, 3, "demo.gif")], "s");

    const img = container.querySelector("[data-key='s'] img") as HTMLImageElement;
    // The path is resolved by the shared media resolver, so it is served from
    // the root instead of from whatever route happens to be open.
    expect(img.getAttribute("src")).toBe("/demo.gif");
    // Decorative: the tab's accessible name already carries the exercise.
    expect(img.getAttribute("alt")).toBe("");
  });
});

describe("navigation", () => {
  it("reports the chosen key", () => {
    const { onSelect } = renderStrip();
    fireEvent.click(bubble("Remo con barra"));
    expect(onSelect).toHaveBeenCalledWith("row");
  });

  it("brings the active bubble into view when selection changes from outside", () => {
    // Without this, selecting from the journal or the "Avance" chip would swap the
    // exercise while the strip was still showing the old one centred.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <ExerciseCarousel items={[SQUAT, BENCH, ROW]} selectedKey="squat" onSelect={vi.fn()} />,
    );
    rerender(
      <ExerciseCarousel items={[SQUAT, BENCH, ROW]} selectedKey="row" onSelect={vi.fn()} />,
    );
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("renders nothing at all with no exercises", () => {
    const { container } = renderStrip([], null);
    expect(container.firstChild).toBeNull();
  });
});

describe("reduced motion", () => {
  function withReducedMotion(prefers: boolean) {
    const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: prefers && query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    return () => {
      if (original) Object.defineProperty(window, "matchMedia", original);
    };
  }

  it("drops the scale transition but keeps the scale", () => {
    const restore = withReducedMotion(true);
    const { container } = renderStrip();

    const active = container.querySelector('[aria-selected="true"]')!.firstElementChild as HTMLElement;

    // The scale is not the motion -- it is how the current bubble is identified. What
    // goes is the tween between the two sizes, which is what actually moves.
    expect(active.style.transform).toBe("scale(1.12)");
    expect(active.style.transition).toBe("");
    restore();
  });

  it("transitions the scale when motion is allowed", () => {
    const restore = withReducedMotion(false);
    const { container } = renderStrip();

    const active = container.querySelector('[aria-selected="true"]')!.firstElementChild as HTMLElement;
    // On `transform`, which is the property the scale is written to. Asserting for the
    // word "scale" would read as if the scale were its own transitioned property.
    expect(active.style.transition).toContain("transform");
    restore();
  });
});

describe("colour discipline", () => {
  it("reads every colour from the token table", () => {
    const { container } = renderStrip([SQUAT, BENCH, ROW]);

    /*
     * The rewrite replaced a Tailwind palette (`emerald-400`, `neutral-900`,
     * `border-accent`) with token reads. A raw literal creeping back is the whole failure
     * this guards, and it is invisible in review because the numbers look plausible.
     *
     * Compared against `CSS.escape`-free string equality against the tokens the component
     * is allowed to use, plus the `rgb(...)` form jsdom normalises hexes into.
     */
    const html = container.innerHTML;

    const allowed = [
      ACCENT.base,
      ACCENT.subtle,
      ACCENT.glow,
      ACCENT.text,
      ACCENT.border,
      GLASS.border,
      GLASS.fill,
      STATUS.success.base,
      STATUS.success.text,
      STATUS.success.border,
      STATUS.progression.base,
      STATUS.progression.text,
      STATUS.progression.border,
      STATUS.progression.muted,
      TEXT.disabled,
      TEXT.secondary,
      TEXT.tertiary,
      SURFACE.raised,
      SURFACE.base,
      DIAGRAM.inert,
      // The superset palette: the only colours on the strip that are allowed
      // to change hue, and they come from the token table like the rest.
      ...SUPERSET.palette.flatMap((tone) => [tone.base, tone.text, tone.muted, tone.border]),
    ];

    for (const literal of html.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? []) {
      expect(
        allowed.some((token) => sameColor(token, literal)),
        `unexpected literal ${literal} — is it in tokens.ts?`,
      ).toBe(true);
    }
  });

  it("uses the success token's own tint for the finished label", () => {
    renderStrip();

    // Not just the bubble: the label has to change too, or a finished exercise reads as
    // merely inactive from across the room.
    const finished = bubble("Press banca");
    const label = within(finished).getAllByText(/Press banca/)[0] as HTMLElement;
    expect(sameColor(label.style.color, STATUS.success.text)).toBe(true);
    expect(sameColor(label.style.color, TEXT.tertiary)).toBe(false);
  });

  it("keeps an unfinished label in the tertiary tier", () => {
    // The contrast case: if both labels resolved to the same colour the tint would be
    // decoration, and the strip would only mark completion on the bubble.
    renderStrip();
    const label = within(bubble("Remo con barra")).getAllByText(/Remo/)[0] as HTMLElement;
    expect(sameColor(label.style.color, TEXT.tertiary)).toBe(true);
  });
});

/**
 * The superset group.
 *
 * Two claims are being made at once on the strip: which bubbles belong
 * together, and where the athlete is inside the group. The first is carried by
 * the colour, the second by the badge -- and both have to survive a screen
 * that cannot show the colour at all, which is why the badge says the same
 * thing in words.
 */
describe("supersets", () => {
  const SQUAT_A = item("squat", "Sentadilla trasera", 0, 3, "", "superset-1");
  const BENCH_A = item("bench", "Press banca", 3, 3, "", "superset-1");
  const CURL_B = item("curl", "Curl con barra", 0, 3, "", "superset-2");
  const ROW = item("row", "Remo con barra", 1, 4);

  const SESSION = [SQUAT_A, BENCH_A, CURL_B, ROW];

  it("names the group on the bubble", () => {
    renderStrip(SESSION, "squat");

    const badge = within(bubble("Sentadilla trasera")).getByTestId("superset-badge");

    // The letter says which group, the fraction says where this exercise sits
    // in it. Both are read in the same glance, mid-set.
    expect(badge.textContent).toContain("SUPERSET A");
    expect(badge.textContent).toContain("1/2");
  });

  it("counts the second exercise of the group as the second", () => {
    renderStrip(SESSION, "squat");

    const badge = within(bubble("Press banca")).getByTestId("superset-badge");
    expect(badge.textContent).toContain("2/2");
  });

  it("labels the second group B", () => {
    renderStrip(SESSION, "squat");

    const badge = within(bubble("Curl con barra")).getByTestId("superset-badge");
    expect(badge.textContent).toContain("SUPERSET B");
  });

  it("leaves an exercise that stands alone without a badge", () => {
    renderStrip(SESSION, "squat");

    // "No group" is an answer, not an omission: an ordinary bubble stays an
    // ordinary bubble.
    expect(within(bubble("Remo con barra")).queryByTestId("superset-badge")).toBeNull();
  });

  it("says the group in the bubble's accessible name", () => {
    renderStrip(SESSION, "squat");

    // The visible chip is not read by a screen reader, so the name has to say
    // it too: the strip is a tablist and its tabs are navigated by name.
    expect(
      screen.getByRole("tab", {
        name: /^Sentadilla trasera, 1 de 4, 0 de 3 series, superset A, 1 de 2$/,
      }),
    ).toBeTruthy();
  });

  it("leaves the accessible name of an ungrouped exercise alone", () => {
    renderStrip(SESSION, "squat");

    expect(
      screen.getByRole("tab", { name: /^Remo con barra, 4 de 4, 1 de 4 series$/ }),
    ).toBeTruthy();
  });

  it("paints the group's colour down the side of its bubbles", () => {
    const { container } = renderStrip(SESSION, "squat");

    const bars = [...container.querySelectorAll("[data-testid='superset-bar']")];
    // One strip per grouped bubble, and none for the exercise that stands alone.
    expect(bars).toHaveLength(3);

    const tone = getSupersetInfo(SESSION, 0)?.tone;
    expect(tone).toBeTruthy();

    // The strip is painted in the group's own colour, not in a colour of its
    // own: the two bubbles of a group have to match.
    expect(sameColor((bars[0] as HTMLElement).style.background, tone!.base)).toBe(true);
    expect(sameColor((bars[1] as HTMLElement).style.background, tone!.base)).toBe(true);
  });

  it("lights the whole group while one of its exercises is on screen", () => {
    const { container } = renderStrip(SESSION, "bench");

    const bars = [...container.querySelectorAll("[data-testid='superset-bar']")];
    const tone = getSupersetInfo(SESSION, 0)?.tone;
    const other = getSupersetInfo(SESSION, 2)?.tone;

    // "These two go together" is a fact about the pair, so the partner is lit
    // too: dimming it would say the opposite.
    expect(sameColor((bars[0] as HTMLElement).style.background, tone!.base)).toBe(true);
    expect(sameColor((bars[1] as HTMLElement).style.background, tone!.base)).toBe(true);

    // The group that is not on screen is dimmed, but it is still a group.
    expect(sameColor((bars[2] as HTMLElement).style.background, other!.border)).toBe(true);
  });
});
