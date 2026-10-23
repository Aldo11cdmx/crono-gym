/**
 * @vitest-environment jsdom
 *
 * ExerciseActions.test.tsx — the verbs, none of them primary.
 *
 * The row is the one place on the immersive screen where a design decision has to be
 * defended rather than assumed, because it looks like an oversight:
 *
 *   1. **Nothing here is red.** The accent on this screen means "the action the screen is
 *      offering", and that is completing a set. Five accent pills would say the screen
 *      offers five equally primary things -- the same failure as a form with five primary
 *      buttons, where the only way to find out what matters is to read all five.
 *   2. **An unwired chip is not `disabled`.** A disabled control reads as one that is
 *      *waiting* for something; the honest answer is "this one was never built". The
 *      distinction is announced through `aria-describedby` rather than by greying the
 *      control out and hoping.
 *   3. **The pending state is announced, not decorated.** Five "próximamente" badges across
 *      the row would bury the four chips that do work.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  ACTION_PENDING_TEXT,
  EXERCISE_ACTIONS,
  ExerciseActions,
  type ExerciseActionId,
} from "./ExerciseActions";
import { borderColor, sameColor } from "../../test-support/color";
import { ACCENT, GLASS, MOTION, RADIUS, TEXT } from "@/design/tokens";

afterEach(cleanup);

const IDS: readonly ExerciseActionId[] = EXERCISE_ACTIONS.map((a) => a.id);

function chip(id: ExerciseActionId): HTMLElement {
  return within(screen.getByRole("group", { name: "Acciones del ejercicio" })).getByText(
    new RegExp(`^${EXERCISE_ACTIONS.find((a) => a.id === id)!.label}$`),
  ).closest("button")!;
}

/** Every handler wired, which is the state `ActiveWorkout` renders the row in. */
const ALL_WIRED: Record<ExerciseActionId, () => void> = Object.fromEntries(
  IDS.map((id) => [id, vi.fn()]),
) as unknown as Record<ExerciseActionId, () => void>;

describe("the row", () => {
  it("renders all five verbs, in the order they appear", () => {
    render(<ExerciseActions onSelect={ALL_WIRED} />);

    expect(IDS).toEqual(["demo", "avance", "nota", "cambiar", "ajustar", "maquina", "maneral"]);
    expect(screen.getAllByRole("button")).toHaveLength(7);
  });

  it("names itself, so the row is not five anonymous buttons", () => {
    render(<ExerciseActions onSelect={ALL_WIRED} />);
    expect(screen.getByRole("group", { name: "Acciones del ejercicio" })).toBeTruthy();
  });

  it("takes a custom label", () => {
    render(<ExerciseActions onSelect={ALL_WIRED} label="Acciones de sentadilla" />);
    expect(screen.getByRole("group", { name: "Acciones de sentadilla" })).toBeTruthy();
  });
});

describe("the accent is not spent here", () => {
  it("leaves every chip on glass", () => {
    render(<ExerciseActions onSelect={ALL_WIRED} />);

    // The one red thing on this screen is the set-completion control. A red chip here would
    // compete with it for the meaning of "primary".
    for (const id of IDS) {
      expect(sameColor((chip(id) as HTMLElement).style.background, ACCENT.base)).toBe(false);
    }
  });

  it("keeps the fill consistent across wired and unwired chips", () => {
    render(<ExerciseActions onSelect={{ nota: vi.fn() }} />);

    expect(sameColor((chip("nota") as HTMLElement).style.background, GLASS.fill)).toBe(true);
    expect(sameColor((chip("demo") as HTMLElement).style.background, GLASS.fill)).toBe(true);
  });

  it("gives a wired chip a stronger hairline, so the working ones read first", () => {
    render(<ExerciseActions onSelect={{ nota: vi.fn() }} />);

    // Same weight buttons, different border: the hierarchy is "which do something", not
    // "which is bigger", because on this screen size means nothing.
    expect(sameColor(borderColor((chip("nota") as HTMLElement).style.border), GLASS.borderStrong)).toBe(true);
    expect(sameColor(borderColor((chip("demo") as HTMLElement).style.border), GLASS.border)).toBe(true);
  });

  it("keeps every chip the same size", () => {
    render(<ExerciseActions onSelect={ALL_WIRED} />);
    const heights = new Set(
      screen.getAllByRole("button").map((b) => (b as HTMLElement).style.minHeight),
    );

    expect(heights).toEqual(new Set([MOTION.minTouchTarget]));
  });

  it("pills them, and centres the row", () => {
    render(<ExerciseActions onSelect={ALL_WIRED} />);
    const row = screen.getByRole("group", { name: "Acciones del ejercicio" });

    expect((row as HTMLElement).style.borderRadius).toBe("");
    expect((row as HTMLElement).style.justifyContent).toBe("center");
    for (const id of IDS) {
      expect((chip(id) as HTMLElement).style.borderRadius).toBe(RADIUS.pill);
    }
  });
});

describe("a wired chip", () => {
  it("calls its own handler and nobody else's", () => {
    render(<ExerciseActions onSelect={ALL_WIRED} />);
    fireEvent.click(chip("cambiar"));

    expect(ALL_WIRED.cambiar).toHaveBeenCalledOnce();
    expect(ALL_WIRED.nota).not.toHaveBeenCalled();
  });

  it("says nothing about being pending", () => {
    render(<ExerciseActions onSelect={ALL_WIRED} />);
    const button = chip("nota") as HTMLButtonElement;

    expect(button.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByText(ACTION_PENDING_TEXT)).toBeNull();
  });

  it("is drawn in primary ink, against a tertiary one", () => {
    render(<ExerciseActions onSelect={{ nota: vi.fn() }} />);

    expect(sameColor((chip("nota") as HTMLElement).style.color, TEXT.primary)).toBe(true);
    expect(sameColor((chip("demo") as HTMLElement).style.color, TEXT.tertiary)).toBe(true);
  });
});

describe("an unwired chip", () => {
  it("stays focusable and enabled", () => {
    render(<ExerciseActions onSelect={{ nota: vi.fn() }} />);
    const button = chip("demo") as HTMLButtonElement;

    // Not `disabled`. A disabled control announces as one that is *waiting* for something,
    // and the true reason -- it was never built -- is a different thing entirely.
    expect(button.disabled).toBe(false);
  });

  it("announces the gap through aria-describedby", () => {
    render(<ExerciseActions onSelect={{ nota: vi.fn() }} />);
    const button = chip("demo") as HTMLButtonElement;
    const describedBy = button.getAttribute("aria-describedby")!;

    // The id is per-action, so two pending chips cannot point at the same note.
    expect(describedBy).toBe("demo-pending");
    expect(document.getElementById(describedBy)!.textContent).toBe(ACTION_PENDING_TEXT);
  });

  it("gives every pending chip its own description", () => {
    render(<ExerciseActions onSelect={{}} />);
    const ids = screen.getAllByRole("button").map((b) => b.getAttribute("aria-describedby"));

    expect(new Set(ids).size).toBe(7);
    expect(ids.every((id) => id !== null)).toBe(true);
  });

  it("keeps the note out of sight without taking it out of the tree", () => {
    render(<ExerciseActions onSelect={{ nota: vi.fn() }} />);
    const note = document.getElementById("demo-pending")!;

    // `display: none` would remove it from the accessibility tree too and leave
    // `aria-describedby` pointing at nothing, which is worse than silence. So: collapsed
    // to nothing on screen, still present in the tree.
    expect(note.style.position).toBe("absolute");
    expect(note.style.display).not.toBe("none");
    expect(note.style.width).toBe("1px");
    expect(note.style.overflow).toBe("hidden");
  });

  it("warns on the console when tapped, rather than swallowing it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      render(<ExerciseActions onSelect={{ nota: vi.fn() }} />);
      fireEvent.click(chip("demo"));

      // Loud on purpose. If this line is ever reached in a shipped build it should be
      // findable: a chip that does nothing is a promise the screen breaks on tap, and this
      // is the screen where the athlete has one hand on a barbell.
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain("demo");
    } finally {
      warn.mockRestore();
    }
  });

  it("says nothing when the row is fully wired", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      render(<ExerciseActions onSelect={ALL_WIRED} />);
      for (const id of IDS) fireEvent.click(chip(id));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("no handlers at all", () => {
  it("renders the row instead of crashing", () => {
    // `onSelect` is optional so the row can be dropped into a screen that has not wired it
    // yet. Throwing here would make the row unshippable until all five exist.
    expect(() => render(<ExerciseActions />)).not.toThrow();
    expect(screen.getAllByRole("button")).toHaveLength(7);
  });

  it("marks every chip as pending", () => {
    render(<ExerciseActions />);
    expect(screen.getAllByText(ACTION_PENDING_TEXT)).toHaveLength(7);
  });
});