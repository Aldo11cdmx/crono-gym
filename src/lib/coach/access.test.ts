/**
 * access.test.ts — the shift schedule and the premium rule.
 *
 * Pure arithmetic, no database and no React, and that is exactly why these tests are
 * worth their existence. The two decisions in `access.ts` are the ones the product
 * cannot be wrong about in a way an athlete would forgive: a coach told to work a
 * shift that is not happening, and a paid tier that quietly lapses or, worse, quietly
 * revives. Both are decided by arithmetic on a clock and a timezone, which means both
 * are decided *wrongly* at 2am on a Sunday and never seen in a daytime demo.
 *
 * Every instant below is written as an explicit UTC ISO string and paired with an
 * explicit offset. A test that used `new Date()` or the machine's own timezone would
 * pass in UTC and fail in Mexico City, which is the timezone the schedule was written
 * for -- so the offset is an argument here and never an ambient fact.
 */

import { describe, expect, it } from "vitest";
import {
  COACH_SHIFTS,
  humanCoachStatus,
  isPremiumActive,
  shiftAt,
  startsAt,
  type CoachShift,
} from "./access";

/**
 * America/Mexico_City, UTC-6 year round. The reference zone: the schedule's stated
 * anchors ("06:00-14:00 local is 12:00-20:00 UTC") are this zone's.
 */
const CDMX = 360;

/** UTC+2, a zone far enough from CDMX to move both shift boundaries. */
const MADRID = -120;

/** UTC, to catch arithmetic that silently assumed either of the above. */
const UTC = 0;

/**
 * The local hour:minute an ISO instant reads as in a zone with this offset.
 *
 * Written out rather than imported from `access.ts`, because a test that recomputes
 * the thing under test with the implementation's own helper is a test that cannot
 * fail. The subtraction is the documented convention: local + offset = UTC, so
 * local = UTC - offset.
 */
function localTimeOf(iso: string, tzOffsetMinutes: number): string {
  const minutes = wrapMinutes(Date.parse(iso) / 60_000 - tzOffsetMinutes);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

const MINUTES_PER_DAY = 1440;

function wrapMinutes(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** The id of the shift working at an instant, or "off" for none. */
function shiftIdAt(iso: string, tzOffsetMinutes: number): CoachShift["id"] | "off" {
  return shiftAt(new Date(iso), tzOffsetMinutes)?.id ?? "off";
}

describe("the schedule itself", () => {
  it("is the two shifts, morning before evening, with no gap between them", () => {
    expect(COACH_SHIFTS).toEqual([
      { id: "morning", startHour: 6, endHour: 14 },
      { id: "evening", startHour: 14, endHour: 22 },
    ]);
    // Contiguous, and 22:00 -> 06:00 is the only gap. An overlap or a hole inside the
    // day would mean an instant belonging to two shifts or to none, and every caller
    // would then need to break the tie itself.
    expect(COACH_SHIFTS[0].endHour).toBe(COACH_SHIFTS[1].startHour);
    expect(COACH_SHIFTS[0].startHour).toBe(6);
    expect(COACH_SHIFTS[1].endHour).toBe(22);
  });
});

describe("shiftAt", () => {
  it("returns morning inside the morning shift", () => {
    // 12:00Z is 06:00 in CDMX -- the exact opening.
    expect(shiftIdAt("2026-10-05T12:00:00Z", CDMX)).toBe("morning");
    // Mid-morning.
    expect(shiftIdAt("2026-10-05T18:30:00Z", CDMX)).toBe("morning");
    // One minute before the handover.
    expect(shiftIdAt("2026-10-05T19:59:00Z", CDMX)).toBe("morning");
  });

  it("returns evening inside the evening shift", () => {
    // 20:00Z is 14:00 in CDMX -- the exact handover.
    expect(shiftIdAt("2026-10-05T20:00:00Z", CDMX)).toBe("evening");
    // Mid-evening.
    expect(shiftIdAt("2026-10-05T23:15:00Z", CDMX)).toBe("evening");
    // One minute before the close.
    expect(shiftIdAt("2026-10-06T03:59:00Z", CDMX)).toBe("evening");
  });

  it("returns null outside both shifts", () => {
    // 04:00Z is 22:00 in CDMX -- the exact close, and the first off-shift minute.
    expect(shiftIdAt("2026-10-06T04:00:00Z", CDMX)).toBe("off");
    // 05:00Z is 23:00, an hour into the overnight gap.
    expect(shiftIdAt("2026-10-06T05:00:00Z", CDMX)).toBe("off");
    // 11:00Z is 05:00 in CDMX, one minute before the morning opens.
    expect(shiftIdAt("2026-10-05T11:00:00Z", CDMX)).toBe("off");
  });

it("reads the clock in the athlete's zone, not in UTC", () => {
    // One instant, two zones, two different answers -- which is the entire reason the
    // offset is a parameter. 06:00Z is 00:00 in CDMX (off shift) and 08:00 in Madrid
    // (morning). A `shiftAt` that ignored its offset would return the same answer for
    // both, and would be wrong for every athlete not on UTC.
    expect(localTimeOf("2026-10-05T06:00:00Z", CDMX)).toBe("00:00");
    expect(localTimeOf("2026-10-05T06:00:00Z", MADRID)).toBe("08:00");
    expect(shiftIdAt("2026-10-05T06:00:00Z", CDMX)).toBe("off");
    expect(shiftIdAt("2026-10-05T06:00:00Z", MADRID)).toBe("morning");

    // Midnight UTC: 18:00 the previous day in CDMX -- inside the evening -- and 02:00
    // in Madrid, two hours short of the morning. Three zones, three answers, one call.
    expect(shiftIdAt("2026-10-05T00:00:00Z", CDMX)).toBe("evening");
    expect(shiftIdAt("2026-10-05T00:00:00Z", MADRID)).toBe("off");
    expect(shiftIdAt("2026-10-05T00:00:00Z", UTC)).toBe("off");
    expect(shiftIdAt("2026-10-05T00:00:00Z", UTC)).not.toBe(
      shiftIdAt("2026-10-05T00:00:00Z", CDMX),
    );

    // Madrid reaching the evening from a UTC midnight instant: 18:00 local is 16:00Z.
    expect(shiftIdAt("2026-10-05T16:00:00Z", MADRID)).toBe("evening");
  });

  it("hands an exact shift boundary to exactly one shift", () => {
    // Every minute around the 14:00 handover, in CDMX local time.
    const aroundHandover = [
      ["2026-10-05T19:57:00Z", "morning"], // 13:57 local
      ["2026-10-05T19:58:00Z", "morning"],
      ["2026-10-05T19:59:00Z", "morning"],
      ["2026-10-05T19:59:59Z", "morning"], // 13:59:59 -- still morning
      ["2026-10-05T20:00:00Z", "evening"], // 14:00:00 -- the evening, not both
      ["2026-10-05T20:01:00Z", "evening"],
    ] as const;

    for (const [iso, expected] of aroundHandover) {
      expect(`${iso} -> ${shiftIdAt(iso, CDMX)}`).toBe(`${iso} -> ${expected}`);
    }
  });

  it("treats the opening minute as inside the shift", () => {
    expect(shiftIdAt("2026-10-05T11:59:59Z", CDMX)).toBe("off"); // 05:59:59 local
    expect(shiftIdAt("2026-10-05T12:00:00Z", CDMX)).toBe("morning"); // 06:00:00 local
  });

  it("agrees with the stated UTC anchors for a UTC-6 zone", () => {
    // The brief: "morning = 12:00-20:00 UTC (6am-2pm Ciudad de Mexico UTC-6)". Checked
    // from both ends, so a regression that moved only one boundary would be caught.
    expect(shiftIdAt("2026-10-05T12:00:00Z", CDMX)).toBe("morning");
    expect(shiftIdAt("2026-10-05T19:59:00Z", CDMX)).toBe("morning");
    expect(shiftIdAt("2026-10-05T20:00:00Z", CDMX)).toBe("evening");
    // And the evening's UTC span is 20:00-04:00Z, the local 14:00-22:00.
    expect(shiftIdAt("2026-10-06T03:59:00Z", CDMX)).toBe("evening");
    expect(shiftIdAt("2026-10-06T04:00:00Z", CDMX)).toBe("off");
  });

  it("survives an offset that pushes local midnight into the previous or next UTC day", () => {
    // Kiritimati is UTC+14 (offset -840): its 06:00 local is 16:00Z the *previous* day.
    // A correct answer here requires the offset arithmetic to be applied on both
    // sides, which is what the UTC-anchored minute count is for.
    expect(localTimeOf("2026-10-05T16:00:00Z", -840)).toBe("06:00");
    expect(shiftIdAt("2026-10-05T16:00:00Z", -840)).toBe("morning");

    // UTC-12 (offset 720): 04:00Z is 16:00 local, inside the evening shift -- and the
    // UTC date and the local date agree here, so this is the plain case.
    expect(localTimeOf("2026-10-06T04:00:00Z", 720)).toBe("16:00");
    expect(shiftIdAt("2026-10-06T04:00:00Z", 720)).toBe("evening");

    // The case that separates a UTC-day anchor from a local-day one: 06:00Z is 18:00
    // on Oct 5 in UTC-12, so the UTC day is already Oct 6 while the local day is still
    // Oct 5. Tomorrow's morning is Oct 6 06:00 local = Oct 6 18:00Z.
    expect(localTimeOf("2026-10-06T06:00:00Z", 720)).toBe("18:00");
    const next = startsAt(new Date("2026-10-06T06:00:00Z"), 720);
    expect(next.isoString).toBe("2026-10-06T18:00:00.000Z");
    expect(localTimeOf(next.isoString, 720)).toBe("06:00");
  });
});

describe("startsAt", () => {
  it("returns this morning's opening when the morning has not begun", () => {
    const at = new Date("2026-10-05T11:00:00Z"); // 05:00 local
    const next = new Date(startsAt(at, CDMX).isoString);

    expect(next.toISOString()).toBe("2026-10-05T12:00:00.000Z"); // 06:00 local
    expect(localTimeOf(next.toISOString(), CDMX)).toBe("06:00");
    expect(next.getTime()).toBeGreaterThan(at.getTime());
  });

  it("returns this evening's opening while the morning is being worked", () => {
    const at = new Date("2026-10-05T17:00:00Z"); // 11:00 local
    const next = new Date(startsAt(at, CDMX).isoString);

    expect(next.toISOString()).toBe("2026-10-05T20:00:00.000Z"); // 14:00 local
    expect(localTimeOf(next.toISOString(), CDMX)).toBe("14:00");
  });

  it("waits for tomorrow's morning during the evening shift", () => {
    const at = new Date("2026-10-05T23:00:00Z"); // 17:00 local
    const next = new Date(startsAt(at, CDMX).isoString);

    // Tomorrow 06:00 local. Not tonight's 22:00 close, and not "tonight" in a way
    // that could be mistaken for a shift the athlete can still join.
    expect(localTimeOf(next.toISOString(), CDMX)).toBe("06:00");
    expect(next.toISOString().startsWith("2026-10-06")).toBe(true);
  });

  it("waits for tomorrow's morning during the overnight gap", () => {
    const at = new Date("2026-10-06T05:00:00Z"); // 23:00 local
    const next = new Date(startsAt(at, CDMX).isoString);

    expect(localTimeOf(next.toISOString(), CDMX)).toBe("06:00");
    expect(next.toISOString().startsWith("2026-10-06")).toBe(true);
  });

  it("is always in the future, including on the exact boundary minute", () => {
    // At 06:00 local the morning has opened, so the next opening is tomorrow's -- and
    // returning the instant that has already arrived would hand a caller a shift that
    // started before it asked.
    const boundaries = [
      "2026-10-05T12:00:00Z", // 06:00 local, morning opens
      "2026-10-05T20:00:00Z", // 14:00 local, evening opens
      "2026-10-06T04:00:00Z", // 22:00 local, evening closes
    ];

    for (const iso of boundaries) {
      const at = new Date(iso);
      const next = new Date(startsAt(at, CDMX).isoString);
      expect(next.getTime()).toBeGreaterThan(at.getTime());
    }
  });

it("always returns a shift boundary in the future, and never the shift already being worked", () => {
    // Sweep a full day in CDMX. Deliberately *not* asserting a local calendar date
    // here: that would mean re-deriving the very day arithmetic `startsAt` exists to
    // get right, in a second place, free to drift. The absolute instants are pinned by
    // the zones above; what this sweep adds is coverage of every minute.
    //
    // The properties asserted are the ones a caller can rely on without knowing the
    // calendar: the result is a shift that has not begun, and it is a *different* shift
    // from the one in progress -- or a shift at all, when there was none.
    let checked = 0;
    for (let minute = 0; minute < MINUTES_PER_DAY; minute += 7) {
      const at = new Date(Date.UTC(2026, 9, 5, 0, minute));
      const working = shiftAt(at, CDMX);
      const next = new Date(startsAt(at, CDMX).isoString);

      // Strictly ahead. A boundary that has already passed is the classic off-by-one
      // here: at 06:00 the answer must be tomorrow's, not the instant just reached.
      expect(next.getTime()).toBeGreaterThan(at.getTime());
      // And never more than a day out, which is what makes it the *next* shift.
      expect(next.getTime() - at.getTime()).toBeLessThanOrEqual(MINUTES_PER_DAY * 60_000);

      const atNext = shiftAt(next, CDMX);
      expect(atNext).not.toBeNull();

      if (working) {
        // A different shift: while the morning runs, the answer is the evening; while
        // the evening runs, the answer is tomorrow's morning. Returning the *same*
        // shift's own opening is the bug this pins -- and it is one the `next > at`
        // assertion alone would not catch.
        expect(atNext?.id).not.toBe(working.id);
      }

      // Whichever boundary it names, it is one of the two real ones.
      expect(["06:00", "14:00"]).toContain(localTimeOf(next.toISOString(), CDMX));
      checked += 1;
    }
    // A sweep that ran fewer iterations than expected would silently skip whole shifts.
    expect(checked).toBeGreaterThan(200);
  });

  it("keeps the local opening hour at 06:00 across a full day in several zones", () => {
    for (const offset of [UTC, CDMX, MADRID, 720, -840]) {
      for (let hour = 0; hour < 24; hour += 3) {
        const at = new Date(Date.UTC(2026, 9, 5, hour));
        const next = new Date(startsAt(at, offset).isoString);
        // The *next* opening is either 06:00 or 14:00 local, and never anything else.
        expect(["06:00", "14:00"]).toContain(localTimeOf(next.toISOString(), offset));
      }
    }
  });
});

describe("isPremiumActive", () => {
  const now = new Date("2026-10-05T12:00:00Z");

  it("is false for an athlete who is not premium, whatever the expiry says", () => {
    expect(
      isPremiumActive({ is_premium: false, premium_expires_at: null }, now),
    ).toBe(false);
    // A stale expiry left over from a lapsed subscription must not read as active.
    expect(
      isPremiumActive({ is_premium: false, premium_expires_at: "2030-01-01T00:00:00Z" }, now),
    ).toBe(false);
  });

  it("is true for a premium athlete with no expiry, which means perpetual", () => {
    expect(isPremiumActive({ is_premium: true, premium_expires_at: null }, now)).toBe(true);
  });

  it("is true for a premium athlete whose expiry is in the future", () => {
    expect(
      isPremiumActive({ is_premium: true, premium_expires_at: "2026-10-05T12:00:01Z" }, now),
    ).toBe(true);
    expect(
      isPremiumActive({ is_premium: true, premium_expires_at: "2027-01-01T00:00:00Z" }, now),
    ).toBe(true);
  });

  it("is false for a premium athlete whose expiry has passed", () => {
    expect(
      isPremiumActive({ is_premium: true, premium_expires_at: "2026-10-05T11:59:59Z" }, now),
    ).toBe(false);
  });

  it("treats the expiry instant itself as expired, not as active", () => {
    // `expires_at > now` and not `>=`: at the exact millisecond the term ends the
    // athlete is no longer entitled, so the boundary belongs to the non-premium side.
    expect(
      isPremiumActive({ is_premium: true, premium_expires_at: now.toISOString() }, now),
    ).toBe(false);
    expect(
      isPremiumActive({ is_premium: true, premium_expires_at: "2026-10-05T12:00:00.001Z" }, now),
    ).toBe(true);
  });

  it("treats an unparseable expiry as expired rather than perpetual", () => {
    // The asymmetry that matters: an athlete wrongly denied is a support ticket, an
    // athlete wrongly allowed a lapsed tier is the breach. Same branch, chosen once.
    expect(isPremiumActive({ is_premium: true, premium_expires_at: "not-a-date" }, now)).toBe(
      false,
    );
    expect(isPremiumActive({ is_premium: true, premium_expires_at: "" }, now)).toBe(false);
  });

  it("reads the clock it is given, so a lapsed tier lapses on its own", () => {
    const profile = { is_premium: true, premium_expires_at: "2026-10-05T12:00:00Z" };

    expect(isPremiumActive(profile, new Date("2026-10-05T11:59:59Z"))).toBe(true);
    expect(isPremiumActive(profile, new Date("2026-10-05T12:00:00Z"))).toBe(false);
    // No re-read, no flag change: the same row, a day later, is simply not premium.
    expect(isPremiumActive(profile, new Date("2026-10-06T12:00:00Z"))).toBe(false);
  });
});

describe("humanCoachStatus", () => {
  it("says not_premium without consulting the clock", () => {
    const onShift = new Date("2026-10-05T18:00:00Z"); // 12:00 local, mid-morning

    const status = humanCoachStatus(onShift, CDMX, false);

    expect(status.state).toBe("not_premium");
    expect(status.shift).toBeNull();
    // No timetable for a coach the athlete cannot reach -- and no time they could be
    // told to come back, because the answer would not change by waiting.
    expect(status.nextShiftStart).toBeNull();
  });

  it("is not_premium off shift too, so the clock can never make it read as available", () => {
    const offShift = new Date("2026-10-06T05:00:00Z"); // 23:00 local
    expect(humanCoachStatus(offShift, CDMX, false).state).toBe("not_premium");
    expect(humanCoachStatus(offShift, CDMX, true).state).toBe("off_shift");
  });

  it("is available on shift, with the shift and no next opening", () => {
    const status = humanCoachStatus(new Date("2026-10-05T18:00:00Z"), CDMX, true);

    expect(status.state).toBe("available");
    expect(status.shift).toEqual({ id: "morning", startHour: 6, endHour: 14 });
    // Offering a "next shift" while inside one would point an athlete at a booking
    // for a shift they are already in.
    expect(status.nextShiftStart).toBeNull();
  });

  it("is off_shift between shifts, with the opening it will return at", () => {
    const at = new Date("2026-10-06T05:00:00Z"); // 23:00 local

    const status = humanCoachStatus(at, CDMX, true);

    expect(status.state).toBe("off_shift");
    expect(status.shift).toBeNull();
    expect(status.nextShiftStart).not.toBeNull();
    const next = new Date((status.nextShiftStart as { isoString: string }).isoString);
    expect(localTimeOf(next.toISOString(), CDMX)).toBe("06:00");
    expect(next.getTime()).toBeGreaterThan(at.getTime());
  });

  it("returns a serialisable status in every state", () => {
    // The point of `{ isoString }`: this survives a JSON round trip unchanged, which a
    // bare `Date` in the payload would not.
    const statuses = [
      humanCoachStatus(new Date("2026-10-05T18:00:00Z"), CDMX, true),
      humanCoachStatus(new Date("2026-10-06T05:00:00Z"), CDMX, true),
      humanCoachStatus(new Date("2026-10-06T05:00:00Z"), CDMX, false),
    ];

    for (const status of statuses) {
      const revived = JSON.parse(JSON.stringify(status)) as typeof status;
      expect(revived).toEqual(status);
      if (revived.nextShiftStart) {
        expect(revived.nextShiftStart.isoString).toBe(
          new Date(revived.nextShiftStart.isoString).toISOString(),
        );
      }
    }
  });
});