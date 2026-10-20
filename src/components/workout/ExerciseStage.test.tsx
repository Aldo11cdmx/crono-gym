/**
 * @vitest-environment jsdom
 *
 * ExerciseStage.test.tsx — one exercise, centred, and the media above it.
 *
 * The claims here are all about *stability*, not looks. This screen has a set table under
 * the media, and the athlete is looking at the table, so anything that moves the media
 * moves the numbers they are reading:
 *
 *   1. The frame owns the ratio, so the space exists before the image does.
 *   2. A real image reserves its box too, so a 404 -- common in this catalog -- does not
 *      collapse the row and shove the inputs up.
 *   3. A missing `gif_url` renders a labelled placeholder rather than a blank screen. The
 *      column is declared non-nullable; rows written before it existed still arrive empty.
 *   4. `Quitar` is a prop, not a header button: taking an exercise out of a session is a
 *      correction, and the only way to do it must not be rebuilding the session.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExerciseStage } from "./ExerciseStage";
import type { Exercise } from "../../types/supabase";
import { borderColor, sameColor } from "../../test-support/color";
import { DIAGRAM, DANGER, GLASS, SURFACE } from "@/design/tokens";

afterEach(cleanup);

function exercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: "press-banca",
    name: "Press banca",
    body_part: "chest",
    target: "pectorals",
    equipment: "barbell",
    gif_url: "https://example.test/bench.gif",
    instructions: [],
    ...over,
  };
}

/**
 * The media frame.
 *
 * Not `container.firstElementChild`: that is the `<section>`, because `render` wraps
 * everything. The frame is the section's first child, and the whole point of several tests
 * below is that this element owns the ratio rather than the image.
 */
function mediaFrame(container: HTMLElement): HTMLElement {
  return container.querySelector("section")!.firstElementChild as HTMLElement;
}

/** The mono pill holding the progress and the last-session reference. */
function progressBadge(): HTMLElement {
  return screen.getByText(/^\d+ de \d+$/).closest("p") as HTMLElement;
}

function renderStage(over: Partial<Parameters<typeof ExerciseStage>[0]> = {}) {
  const props: Parameters<typeof ExerciseStage>[0] = {
    exercise: exercise(),
    progress: "1 de 3",
    ...over,
  };
  const view = render(<ExerciseStage {...props} />);
  return { ...view, props };
}

describe("the heading", () => {
  it("names the exercise, and the section carries the same name", () => {
    renderStage({ exercise: exercise({ name: "Sentadilla trasera" }) });

    // Two names is the redundancy that lets a screen reader announce the region without
    // reading the heading first.
    expect(screen.getByRole("region", { name: "Sentadilla trasera" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Sentadilla trasera" })).toBeTruthy();
  });

  it("joins target, body part and equipment with middots", () => {
    renderStage();

    // The line is a caption for the movement, and a list without separators reads as a
    // sentence about nothing in particular.
    expect(screen.getByText("Pectorales · Pecho · Barra")).toBeTruthy();
  });

  it("falls back to the raw value when the catalog has no label for it", () => {
    // An imported row can carry a `target` this build has no translation for. Showing
    // nothing would silently drop a third of the caption.
    renderStage({ exercise: exercise({ target: "antebrazos", body_part: "arm" }) });
    expect(screen.getByText(/antebrazos/)).toBeTruthy();
  });

  it("puts the progress in a mono run, because it is a number", () => {
    renderStage({ progress: "2 de 4" });

    // `tabular-nums` on a figure the athlete compares across the session: a proportional
    // digit would make "2 de 4" jitter as the numbers change.
    const badge = screen.getByText("2 de 4").closest("p") as HTMLElement;
    expect(badge.style.fontVariantNumeric).toBe("tabular-nums");
  });
});

describe("the last session", () => {
  it("shows it next to the progress when there is one", () => {
    renderStage({ progress: "1 de 3", lastSession: "80 kg × 6" });
    expect(progressBadge().textContent).toContain("80 kg × 6");
  });

  it("shows nothing extra when the movement is new", () => {
    renderStage({ progress: "1 de 3", lastSession: null });

    // The separator is `aria-hidden`, so a null here must remove both halves of the pair
    // or the progress ends up reading "1 de 3 ·".
    expect(progressBadge().textContent).toBe("1 de 3");
  });

  it("treats an empty string as no reference", () => {
    renderStage({ lastSession: "" });
    expect(progressBadge().textContent).toBe("1 de 3");
  });
});

describe("the media frame", () => {
  it("owns the ratio, so the space is reserved before the image arrives", () => {
    const { container } = renderStage();
    const frame = mediaFrame(container);

    // Declared on the frame rather than on the image: an image arriving into an unreserved
    // space pushes the set table down the screen, and the set table is the point.
    expect(frame.style.aspectRatio).toBe("16 / 9");
    expect(frame.style.overflow).toBe("hidden");
  });

  it("fits the whole GIF without clipping, so no anatomy is cut off", () => {
    const { container } = renderStage();
    const image = container.querySelector("img")!;

    // The catalog's demos are inconsistent aspect ratios. `contain` guarantees
    // the full figure is visible even if it means letterboxing, which is better
    // than losing the bar or the athlete's hands at the top of the frame.
    expect(image.style.objectFit).toBe("contain");
  });

  it("renders the demo eagerly, because it is above the set table", () => {
    renderStage();

    // A lazy image that has not loaded when the athlete looks up is a blank frame in the
    // most-watched 300ms of the screen.
    expect(screen.getByRole("img").getAttribute("loading")).toBe("eager");
  });

  it("reserves the image's own box, so a 404 does not collapse the row", () => {
    renderStage();
    const image = screen.getByRole("img");

    // Catalog GIFs 404. Without the reservation the frame collapses and the numbers below
    // jump, which is the one thing this screen cannot do mid-set.
    expect(image.getAttribute("width")).toBe("640");
    expect(image.getAttribute("height")).toBe("360");
  });

  it("paints the frame black, so a load does not flash white", () => {
    const { container } = renderStage();

    // The container carries the black backing; the image itself is transparent
    // so its filter + screen blend integrate with the dark frame.
    expect(sameColor((mediaFrame(container) as HTMLElement).style.backgroundColor, SURFACE.base)).toBe(true);
    expect((screen.getByRole("img") as HTMLElement).style.backgroundColor).toBe("transparent");
  });

  it("names the demo in its alt text", () => {
    renderStage({ exercise: exercise({ name: "Remo con barra" }) });
    expect(screen.getByAltText("Demostración de Remo con barra")).toBeTruthy();
  });

  it("trims the url, so a stray space does not become a broken request", () => {
    renderStage({ exercise: exercise({ gif_url: "  https://example.test/bench.gif  " }) });
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.test/bench.gif");
  });
});

describe("the placeholder", () => {
  it("shows one when there is no gif_url", () => {
    const { container } = renderStage({ exercise: exercise({ gif_url: "" }) });

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.textContent).toContain("Sin demostración para Press banca");
  });

  it("shows one for a missing gif_url rather than crashing", () => {
    // The column is declared non-nullable, but rows written before it existed -- or by an
    // import -- arrive without one. Reading `.trim()` off undefined would turn a missing
    // demo into a blank screen, the exact failure the placeholder exists to prevent.
    const broken = { ...exercise(), gif_url: undefined } as unknown as Exercise;

    expect(() => renderStage({ exercise: broken })).not.toThrow();
    expect(screen.getByRole("region", { name: "Press banca" })).toBeTruthy();
  });

  it("shows one for whitespace, which is a url that will not resolve", () => {
    renderStage({ exercise: exercise({ gif_url: "   " }) });
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("holds the same reserved height as a real demo", () => {
    const { container } = renderStage({ exercise: exercise({ gif_url: "" }) });
    const frame = mediaFrame(container);

    // Same frame, same ratio. A placeholder of a different height would move the set
    // table the moment an athlete switched to an exercise that has a demo.
    expect(frame.style.aspectRatio).toBe("16 / 9");
  });

  it("stays out of the accessibility tree, because the heading already says it", () => {
    const { container } = renderStage({ exercise: exercise({ gif_url: "" }) });
    const placeholder = container.querySelector("[aria-hidden='true']") as HTMLElement;

    // Announcing "no demonstration available" under a heading that already names the
    // exercise would be the same sentence twice.
    expect(placeholder.textContent).toContain("Sin demostración para Press banca");
  });

  it("uses the figure fill, not the panel fill", () => {
    const { container } = renderStage({ exercise: exercise({ gif_url: "" }) });
    const placeholder = container.querySelector("[aria-hidden='true']") as HTMLElement;

    // This is a figure drawing an illustration, not a panel. `regionFill` is the token for
    // the inside of a drawn region, and it is what stops it reading as a flat grey box.
    expect(sameColor(placeholder.style.backgroundColor, DIAGRAM.regionFill)).toBe(true);
  });
});

describe("removing the exercise", () => {
  it("offers no button when the screen cannot remove it", () => {
    renderStage();

    // A button that does nothing is a promise the screen breaks on tap, and the tap lands
    // on a screen where one hand is on a barbell.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the exercise in the label, so the verb is unambiguous", () => {
    renderStage({ exercise: exercise({ name: "Sentadilla trasera" }), onRemove: vi.fn() });

    expect(screen.getByRole("button", { name: /Quitar Sentadilla trasera de la sesión/ })).toBeTruthy();
  });

  it("calls through, once", () => {
    const onRemove = vi.fn();
    renderStage({ onRemove });
    fireEvent.click(screen.getByRole("button", { name: /^Quitar/ }));

    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("marks it as a correction rather than a destination", () => {
    renderStage({ onRemove: vi.fn() });
    const button = screen.getByRole("button", { name: /^Quitar/ }) as HTMLElement;

    // Danger ink and an underline, no fill, no pill. It is not a navigation target, and it
    // should not look like one.
    expect(button.style.background).toBe("transparent");
    expect(sameColor(button.style.color, DANGER.text)).toBe(true);
    expect(button.style.textDecoration).toContain("underline");
  });
});

describe("the slot below", () => {
  it("spans the full width, so the inputs do not march off both edges", () => {
    // The table is the reason the screen exists. A centred set table leaves its inputs
    // running to the margins on a phone, which is where a thumb is not.
    renderStage({ children: <input aria-label="Repeticiones" /> });
    const slot = screen.getByLabelText("Repeticiones").closest("div")! as HTMLElement;

    expect(slot.style.width).toBe("100%");
  });

  it("renders the actions row when it is given one, and nothing when it is not", () => {
    const { unmount } = renderStage({ actions: <span>chips</span> });
    expect(screen.getByText("chips")).toBeTruthy();
    unmount();

    renderStage();
    expect(screen.queryByText("chips")).toBeNull();
  });

  it("keeps the hairline off the frame's outer edge", () => {
    const { container } = renderStage();
    expect(sameColor(borderColor(mediaFrame(container).style.border), GLASS.border)).toBe(true);
  });
});