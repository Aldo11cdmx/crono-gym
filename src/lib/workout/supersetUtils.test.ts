/**
 * supersetUtils.test.ts — where an exercise sits inside its superset.
 *
 * The module is pure arithmetic over a list, so everything here is about the
 * two things that can quietly go wrong: a label that changes when the list is
 * reordered, and a "next" that leaves the group. Both would be invisible in
 * the app -- a wrong label still renders, and a wrong jump still renders --
 * so they are pinned here instead.
 *
 * The colour gets its own section because it is the one thing here that is
 * *seen*: a superset is painted in it, and the palette it comes from has to
 * stay legible on a black canvas and clear of the green the product refuses.
 */

import { describe, expect, it } from "vitest";
import { getNextSupersetTargetIndex, getSupersetInfo } from "./supersetUtils";
import { contrastRatio, flatten, parseColor, rgbToHsl } from "@/design/color";
import { SURFACE, SUPERSET } from "@/design/tokens";

/** The minimum an exercise has to say to be placed in a group. */
function exercise(groupId: string | null): { groupId: string | null } {
  return { groupId };
}

/** A session of two supersets and a lone exercise between them. */
const SESSION = [
  exercise("superset-1"),
  exercise("superset-1"),
  exercise(null),
  exercise("superset-2"),
  exercise("superset-2"),
  exercise("superset-2"),
];

describe("where an exercise sits in its group", () => {
  it("reads as no group at all when the exercise stands alone", () => {
    expect(getSupersetInfo(SESSION, 2)).toBeNull();
  });

  it("says nothing about a group for an index that does not exist", () => {
    expect(getSupersetInfo(SESSION, 99)).toBeNull();
    expect(getSupersetInfo(SESSION, -1)).toBeNull();
  });

  it("counts the exercise inside its group", () => {
    const first = getSupersetInfo(SESSION, 0);
    const second = getSupersetInfo(SESSION, 1);

    expect(first?.position).toBe(1);
    expect(first?.total).toBe(2);
    expect(second?.position).toBe(2);
    expect(second?.total).toBe(2);
  });

  it("counts a group of three as three", () => {
    const info = getSupersetInfo(SESSION, 5);

    expect(info?.position).toBe(3);
    expect(info?.total).toBe(3);
    expect(info?.isLast).toBe(true);
  });

  it("knows the ends of a group", () => {
    expect(getSupersetInfo(SESSION, 0)?.isFirst).toBe(true);
    expect(getSupersetInfo(SESSION, 0)?.isLast).toBe(false);
    expect(getSupersetInfo(SESSION, 1)?.isFirst).toBe(false);
    expect(getSupersetInfo(SESSION, 1)?.isLast).toBe(true);
  });

  it("treats a group of one as both the first and the last", () => {
    const info = getSupersetInfo([exercise("only")], 0);

    expect(info?.position).toBe(1);
    expect(info?.total).toBe(1);
    expect(info?.isFirst).toBe(true);
    expect(info?.isLast).toBe(true);
  });

  it("gives every member of a group the same label", () => {
    expect(getSupersetInfo(SESSION, 0)?.label).toBe(getSupersetInfo(SESSION, 1)?.label);
    expect(getSupersetInfo(SESSION, 3)?.label).toBe(getSupersetInfo(SESSION, 5)?.label);
  });

  it("labels the groups by order of appearance, not by the order they are read", () => {
    // The first group in the list is A and the second is B, whatever their ids
    // happen to be: the id is an opaque string and the label is for a person.
    expect(getSupersetInfo(SESSION, 0)?.label).toBe("A");
    expect(getSupersetInfo(SESSION, 3)?.label).toBe("B");
  });

  it("labels the groups by the order the list is in, so a reorder renames them", () => {
    // The label is a position, not an identity: the group that comes first is
    // A. The *colour* is the identity and it does not move -- which is what
    // the colour test below pins.
    const reordered = [exercise("superset-2"), exercise("superset-1"), exercise("superset-1")];

    expect(getSupersetInfo(reordered, 0)?.label).toBe("A");
    expect(getSupersetInfo(reordered, 0)?.groupId).toBe("superset-2");
    expect(getSupersetInfo(reordered, 1)?.label).toBe("B");
    expect(getSupersetInfo(reordered, 1)?.groupId).toBe("superset-1");
  });

  it("runs out of single letters rather than repeating them", () => {
    const many = Array.from({ length: 27 }, (_, index) => exercise(`group-${index}`));

    expect(getSupersetInfo(many, 0)?.label).toBe("A");
    expect(getSupersetInfo(many, 25)?.label).toBe("Z");
    expect(getSupersetInfo(many, 26)?.label).toBe("AA");
  });
});

describe("the colour a group is painted in", () => {
  it("is one of the palette's colours", () => {
    const info = getSupersetInfo(SESSION, 0);

    expect(SUPERSET.palette.map((tone) => tone.base)).toContain(info?.color);
  });

  it("is the same for every member of the group", () => {
    expect(getSupersetInfo(SESSION, 0)?.color).toBe(getSupersetInfo(SESSION, 1)?.color);
  });

  it("is the same every time the same group is asked about", () => {
    // A colour that changed between renders would be a colour the athlete
    // stops trusting, so the answer has to be a function of the id alone.
    const first = getSupersetInfo(SESSION, 0)?.color;
    const second = getSupersetInfo(SESSION, 0)?.color;

    expect(first).toBe(second);
  });

  it("is the same whatever order the list is in", () => {
    const reordered = [exercise("superset-1"), exercise("superset-2"), exercise("superset-1")];

    expect(getSupersetInfo(reordered, 0)?.color).toBe(getSupersetInfo(SESSION, 0)?.color);
  });

  it("spreads different groups over more than one colour", () => {
    const ids = Array.from({ length: 16 }, (_, index) => `group-${index}`);
    const colours = new Set(ids.map((id) => getSupersetInfo([exercise(id)], 0)?.color));

    // Not a uniqueness claim -- a hash can collide -- but a group that painted
    // every group the same colour would make the whole strip monochrome.
    expect(colours.size).toBeGreaterThan(1);
  });

  it("paints every colour of the palette readably on the canvas", () => {
    for (const tone of SUPERSET.palette) {
      const ratio = contrastRatio(tone.base, SURFACE.base);

      // The badge is a label, not a decoration, so the colour has to clear the
      // text floor on true black rather than only the floor for a graphic.
      expect(ratio, `${tone.base} sobre el lienzo: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("paints every colour of the palette readably on its own tint", () => {
    for (const tone of SUPERSET.palette) {
      // The chip's fill is translucent, so the ink is read against what the
      // fill actually becomes over the canvas -- not against the fill itself.
      const background = flatten(tone.muted, SURFACE.base);
      const ratio = contrastRatio(tone.text, background);

      // The chip's ink sits on the chip's own fill, not on the canvas.
      expect(ratio, `${tone.text} sobre ${background}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps every colour of the palette clear of the green the product refuses", () => {
    for (const tone of SUPERSET.palette) {
      const rgb = parseColor(tone.base);
      if (!rgb) throw new Error(`no se pudo leer ${tone.base}`);
      const { h, s } = rgbToHsl(rgb);
      if (s < 0.6) continue;

      // The same rule `tokens.test.ts` enforces across the token set: a
      // saturated green is refused, and a mint that reads as green under
      // deuteranopia would put a superset chip next to the success chip.
      expect(Math.min(Math.abs(h - 120), 360 - Math.abs(h - 120)), tone.base).toBeGreaterThan(25);
    }
  });
});

describe("where the group goes next", () => {
  it("moves to the next exercise of the same group", () => {
    expect(getNextSupersetTargetIndex(SESSION, 0)).toBe(1);
  });

  it("does not move at all for an exercise that stands alone", () => {
    expect(getNextSupersetTargetIndex(SESSION, 2)).toBe(-1);
  });

  it("does not move at all for an index that does not exist", () => {
    expect(getNextSupersetTargetIndex(SESSION, 99)).toBe(-1);
  });

  it("does not move for a group of one, because there is nowhere to go", () => {
    expect(getNextSupersetTargetIndex([exercise("only")], 0)).toBe(-1);
  });

  it("never leaves the group", () => {
    // The exercise after the second member of a group belongs to another
    // group, and a jump there would be a jump out of the superset.
    expect(getNextSupersetTargetIndex(SESSION, 1)).toBe(0);
    expect(getNextSupersetTargetIndex(SESSION, 3)).toBe(4);
    expect(getNextSupersetTargetIndex(SESSION, 4)).toBe(5);
  });

  it("comes back to the first exercise of the group after the last one", () => {
    // A superset is a rotation -- A, B, A, B -- and the rotation is what makes
    // the strip advance by itself.
    expect(getNextSupersetTargetIndex(SESSION, 5)).toBe(3);
  });

  it("keeps the rotation inside the group even when the list is not contiguous", () => {
    const scattered = [
      exercise("superset-1"),
      exercise("other"),
      exercise("superset-1"),
    ];

    expect(getNextSupersetTargetIndex(scattered, 0)).toBe(2);
    expect(getNextSupersetTargetIndex(scattered, 2)).toBe(0);
  });
});
