/**
 * The two label functions that can be wrong without looking wrong.
 *
 * Not the whole file: the rest of `i18n.ts` is strings, and a test asserting that a string
 * equals the string next to it protects nothing. These two build text from numbers, and
 * both fail in a way that is invisible in review -- a plural that is wrong, or a countdown
 * that reaches zero while the lockout is still running.
 */

import { describe, expect, it } from "vitest";

import { COACH_PORTAL_LABELS } from "@/lib/i18n";

describe("COACH_PORTAL_LABELS.lockedUntilMinutes", () => {
  it("rounds up so the final minute never reads as zero", () => {
    // The countdown calls this every second with a fractional count. Rounding to nearest
    // shows "0 minutos" from 30 seconds, which tells the coach to type the PIN again and
    // spend another attempt on a lockout that has not lifted.
    expect(COACH_PORTAL_LABELS.lockedUntilMinutes(0.5)).toBe("1 minuto");
    expect(COACH_PORTAL_LABELS.lockedUntilMinutes(1)).toBe("1 minuto");
  });

  it("never returns zero, whatever it is handed", () => {
    // Overshoot is possible: the interval that drives the countdown can fire a frame after
    // the deadline the server gave. Clamping to one is the honest reading -- there is a
    // moment left to wait.
    expect(COACH_PORTAL_LABELS.lockedUntilMinutes(0)).toBe("1 minuto");
    expect(COACH_PORTAL_LABELS.lockedUntilMinutes(-3)).toBe("1 minuto");
  });

  it("uses the plural for anything above one", () => {
    expect(COACH_PORTAL_LABELS.lockedUntilMinutes(2)).toBe("2 minutos");
    expect(COACH_PORTAL_LABELS.lockedUntilMinutes(15)).toBe("15 minutos");
  });
});

describe("COACH_PORTAL_LABELS.shiftHours", () => {
  it("zero-pads both ends", () => {
    expect(COACH_PORTAL_LABELS.shiftHours(6, 14)).toBe("Turno de 06:00 a 14:00");
  });

  it("prints the hours it is given rather than a constant", () => {
    // The closing hour belongs to the next shift, so both ends come from `CoachShift`. A
    // hardcoded end here would make the evening say 06:00 too.
    expect(COACH_PORTAL_LABELS.shiftHours(14, 22)).toBe("Turno de 14:00 a 22:00");
  });
});

describe("COACH_PORTAL_LABELS.requestStatus", () => {
  it("names every status the database can hold", () => {
    // A status with no label does not throw -- it renders the raw wire value, which is how
    // a coach ends up reading "cancelled" in the middle of a Spanish screen. Written by
    // hand from `coach_session_requests_status_check`, so a migration that widens the
    // constraint fails here instead of failing in front of a user.
    expect(Object.keys(COACH_PORTAL_LABELS.requestStatus).sort()).toEqual([
      "active",
      "cancelled",
      "closed",
      "declined",
      "pending",
    ]);
  });
});