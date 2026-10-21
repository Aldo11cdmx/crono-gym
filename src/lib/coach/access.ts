/**
 * access.ts — who is allowed to use which coach, decided by arithmetic.
 *
 * The product has two tiers that look like one feature and behave nothing alike:
 *
 *  - **Cronos**, the AI assistant, is free for every signed-in athlete. It is
 *    never gated, never expires, and reading whether it is available must not cost a
 *    database round trip -- a paywall on the free tier is just a slow no.
 *  - **A human coach** is premium, and only reachable inside a shift.
 *
 * So this module holds the second tier's rules and nothing about the first. That
 * asymmetry is the design: `isPremiumActive` and `shiftAt` are the only things here
 * that can answer "no".
 *
 * Every function is pure and takes the clock and the timezone as arguments. That is
 * not testability theatre -- it is the fix for the two mistakes this logic invites.
 * A shift computed from `new Date()` inside the function cannot be tested at 14:00 on
 * a Tuesday without waiting for Tuesday. And a shift computed from the *server's*
 * timezone would be wrong for every athlete who is not in it: "your coach is on shift
 * until 2pm" means 2pm where the athlete is, not where the database is.
 */

/**
 * The two shifts a human coach works.
 *
 * English keys, Spanish labels. The key is what crosses the network, lands in a URL,
 * and gets compared in a test; the label is what a person reads. Collapsing the two is
 * how a rename of a UI string ends up as a migration.
 */
export type CoachShiftId = "morning" | "evening";

/**
 * A shift, in the athlete's local time.
 *
 * `startHour` and `endHour` are local hours, not UTC. Storing them this way means the
 * schedule reads the same everywhere -- "the morning coach" is 06:00 to 14:00 for
 * every athlete regardless of where they are -- while {@link shiftAt} does the single
 * conversion from local to UTC in one place.
 */
export interface CoachShift {
  id: CoachShiftId;
  /** Local hour the shift opens, 0-23. */
  startHour: number;
  /** Local hour the shift closes, 0-23. The closing hour belongs to the next shift. */
  endHour: number;
}

/** The schedule, in declaration order: morning, then evening. */
export const COACH_SHIFTS: readonly CoachShift[] = [
  { id: "morning", startHour: 6, endHour: 14 },
  { id: "evening", startHour: 14, endHour: 22 },
] as const;

const MINUTES_PER_DAY = 24 * 60;

/** Minutes since local midnight, per shift. Precomputed because they are constants. */
const SHIFT_BOUNDS_MINUTES = COACH_SHIFTS.map((shift) => ({
  id: shift.id,
  start: shift.startHour * 60,
  end: shift.endHour * 60,
}));

/**
 * Whether the athlete can reach a human coach right now, and if not, why.
 *
 * A three-state union rather than two booleans (`isPremium`, `isOnShift`) because
 * those two are not independent and a pair of booleans cannot say which one failed.
 * The two refusals need different words and different next steps: "upgrade" is a
 * commercial message and "come back at 06:00" is a scheduling one. A UI that had to
 * infer the reason would eventually infer it wrong -- most likely by showing the
 * upsell to someone who already pays and merely sent it at 3am.
 *
 * `unavailable` rather than a third boolean `isAvailable`, because the absence of
 * service is the interesting fact and it is the one that has to be rendered.
 */
export type HumanCoachState =
  /** Premium tier, inside a shift. The only state in which children may render. */
  | "available"
  /** Not premium. Nothing about the clock will change this. */
  | "not_premium"
  /** Premium tier, but between shifts. The coach returns. */
  | "off_shift";

export interface HumanCoachStatus {
  state: HumanCoachState;
  /**
   * The shift currently being worked, or null when none is.
   *
   * Null in both `not_premium` and `off_shift`: an athlete who is not premium has no
   * shift, and giving them the next one would advertise a schedule they cannot book.
   */
  shift: CoachShift | null;
  /**
   * When the next shift opens, serialised. Null when there is nothing to wait for.
   *
   * A `{ isoString }` wrapper rather than a `Date` because this object is built once
   * and may cross a render boundary or a cache that stores it as plain data -- and a
   * bare `Date` rehydrates from storage as a string anyway, so a field typed `Date`
   * is a claim the runtime will not honour. The wrapper makes the serialisation
   * explicit at the type level, where it can be seen.
   */
  nextShiftStart: { isoString: string } | null;
}

/**
 * The subset of `profiles` this module needs.
 *
 * Named separately from the app's own `Profile` on purpose: the two answer different
 * questions and one of them is read on every app start, so it must not drag the whole
 * onboarding shape along with it. Every field here is a column from
 * `20261003010000_profiles_premium.sql`, so this interface and that migration cannot
 * drift without the tests noticing a missing column in a type error.
 */
export interface CoachProfile {
  is_premium: boolean;
  premium_expires_at: string | null;
}

/** What {@link useCoachAccess} returns: the whole answer to "what can this athlete do". */
export interface CoachAccess {
  /** Still reading the profile. Entitlements are unknown and reported as absent. */
  isLoading: boolean;
  error: string | null;
  /** The premium tier, active right now. False while loading and for free athletes. */
  isPremium: boolean;
  /**
   * Vía A. Always true for a signed-in athlete, premium or not.
   *
   * A constant that exists as a field so the UI can ask one question instead of
   * knowing which tier it is in -- and so that if this ever stops being free, there is
   * exactly one line to change and the gates that read it are already in place.
   */
  canChat: boolean;
  /** Vía A, routine generation. Free for the same reason and on the same terms. */
  canGenerateAiRoutine: boolean;
  humanCoachStatus: HumanCoachStatus;
  /** Forces a re-read, bypassing the cache. Called after a purchase, or by a retry. */
  refresh: () => Promise<void>;
}

// --------------------------------------------------------------- entitlements

/**
 * Is the premium tier active at this moment?
 *
 * Two flags, not one, because the two questions are separate: `is_premium` is a fact
 * about the account and the expiry is a fact about the clock, and either can be the
 * one that says no. A subscribed athlete whose term lapsed an hour ago is not premium
 * now, however emphatically their row says they used to be.
 *
 * A null `premium_expires_at` means *perpetual*, not *unknown*. That distinction is the
 * whole reason this is two columns rather than one boolean, and reading null as
 * "expired" would lock out every lifetime subscriber the moment their flag is set.
 *
 * An unparseable date is treated as expired rather than as perpetual. That is the
 * asymmetry to be deliberate about: the two failures are an athlete who cannot see
 * the coach they paid for, and an athlete who can. Only one of those is a breach, and
 * it is not the one this branch takes.
 */
export function isPremiumActive(
  profile: Pick<CoachProfile, "is_premium" | "premium_expires_at">,
  now: Date = new Date(),
): boolean {
  if (!profile.is_premium) return false;
  if (profile.premium_expires_at === null) return true;

  const expiresAt = Date.parse(profile.premium_expires_at);
  // NaN here means the string was not a date. It falls through the comparison as
  // false, which is the expired branch, for the reason given above.
  return expiresAt > now.getTime();
}

// ------------------------------------------------------------------- timezone

/**
 * The browser's current offset from UTC, in minutes.
 *
 * **`Date.getTimezoneOffset()` semantics: minutes to ADD to LOCAL time to get UTC.**
 * Mexico City is UTC-6 and therefore 360 here; Madrid is UTC+2 and therefore -120.
 *
 * This is the opposite sign to the ISO-8601 `+01:00` form and to `Intl`'s
 * `timeZoneName: "longOffset"`, and getting it backwards shifts every shift by twice
 * the offset -- 13:59 would read as 01:59 -- so the convention is stated here once and
 * asserted in the tests rather than being discovered by an athlete at the wrong end of
 * their coach's day.
 *
 * Read at call time rather than cached, because it *changes*: a laptop that crosses a
 * timezone, or a country that changes its rules, moves the local hours a shift is
 * anchored to. `Intl.DateTimeFormat().resolvedOptions().timeZone` names the zone; this
 * is the same zone resolved to a number at this instant, DST included.
 */
export function localOffsetMinutes(date: Date = new Date()): number {
  return date.getTimezoneOffset();
}

/** Wraps any minute count into `[0, 1440)`, so a shift crossing midnight still works. */
function wrapMinutes(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Minutes since local midnight for `date`, in the zone at offset `tzOffsetMinutes`.
 *
 * Exported because two callers need it and the convention is the easy thing to get
 * wrong: `useCoachAccess` uses it to aim its boundary timer, and a second copy of this
 * arithmetic in another file is a second thing to get the sign of right.
 *
 * Local = UTC - offset, because the offset *is* the amount local time lags UTC.
 * Verifying against the documented example: 12:00 UTC with a 360-minute offset is
 * 06:00 local, and 720 - 360 = 360 is 06:00.
 */
export function localMinutesSinceMidnight(date: Date, tzOffsetMinutes: number): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return wrapMinutes(utcMinutes - tzOffsetMinutes);
}

/**
 * The local clock for `date`, as a minute-of-day plus the day shift it implies.
 *
 * The day shift is the part that is easy to miss. Subtracting the offset from the
 * minute-of-day goes negative for a zone behind UTC in the evening, and knowing *that
 * it went negative* is the only way to tell which local calendar day the instant
 * belongs to -- 23:00 yesterday and 23:00 today are the same minute count and opposite
 * days.
 *
 * Deriving it by adding the offset to the timestamp and reading the UTC fields off the
 * result does not work: adding six hours to an instant moves it six hours, it does not
 * relabel it. At 23:00 local the shifted timestamp reads as the *next* day, which is
 * the correct hour on the wrong date, and the resulting date is silently wrong for
 * every late-evening answer.
 */
function localClock(
  date: Date,
  tzOffsetMinutes: number,
): { dayShift: number; minutes: number } {
  const raw = date.getUTCHours() * 60 + date.getUTCMinutes() - tzOffsetMinutes;
  // `Math.floor` rather than `Math.trunc`: the raw value is negative by exactly one
  // day's worth at the low end, and truncating toward zero would report a day shift of
  // 0 for local times between 00:00 and the offset, putting them on the wrong date.
  const dayShift = Math.floor(raw / MINUTES_PER_DAY);
  return { dayShift, minutes: raw - dayShift * MINUTES_PER_DAY };
}

/** Midnight, in UTC terms, of the local calendar day `date` falls on. */
function localMidnightUtc(date: Date, tzOffsetMinutes: number): number {
  const { dayShift } = localClock(date, tzOffsetMinutes);
  // Whole days added to a UTC midnight, which is exact: no DST, no month arithmetic,
  // nothing to accumulate. `Date.UTC` normalises out-of-range day numbers itself.
  const shifted = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) +
      dayShift * MINUTES_PER_DAY * 60_000,
  );
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

// ---------------------------------------------------------------------- shifts

/**
 * Which shift is being worked at `date`, or null if none is.
 *
 * Half-open intervals: a shift runs from its start *inclusive* to its end
 * *exclusive*, and the schedule is contiguous -- 06:00-14:00 then 14:00-22:00. So
 * 14:00 belongs to the evening and nothing belongs to both or to neither. The
 * alternative, treating both ends as inclusive, makes 14:00 answer to two shifts and
 * forces every caller to pick a winner; the alternative of not sharing endpoints makes
 * 14:00 belong to nobody, which reads to an athlete as a coach who vanished.
 *
 * The gap between 22:00 and 06:00 is real and returns null. Inventing an overnight
 * shift would mean a promise nobody staffs.
 */
export function shiftAt(date: Date, tzOffsetMinutes: number): CoachShift | null {
  const localMinutes = localMinutesSinceMidnight(date, tzOffsetMinutes);

  for (const bound of SHIFT_BOUNDS_MINUTES) {
    if (localMinutes >= bound.start && localMinutes < bound.end) {
      const shift = COACH_SHIFTS.find((candidate) => candidate.id === bound.id);
      if (shift) return shift;
    }
  }
  return null;
}

/**
 * When the next shift opens, as an ISO string.
 *
 * Local wall-clock arithmetic, not absolute minutes, because the answer is a civil
 * time: "06:00 tomorrow" has to stay 06:00 tomorrow after a timezone change, whereas
 * accumulating a fixed 24-hour offset would drift by an hour across a DST boundary
 * and open the shift an hour early.
 *
 * Every branch resolves to one of three instants: today's morning opening, today's
 * evening opening, or tomorrow's morning opening. Tomorrow's *evening* is unreachable
 * because tomorrow's morning always comes first -- and in fact any time from 14:00
 * onwards waits through the night for the next morning, which is the honest answer at
 * 23:00 rather than a shift starting in fifteen hours.
 *
 * Note that when the morning shift is being worked, "the next opening" is the evening,
 * which is also the moment the morning closes. Sharing that instant is deliberate: the
 * handover is a real event that athletes can act on.
 *
 * Always in the future: the boundary itself belongs to the shift opening, so at
 * exactly 06:00 this returns 06:00 *tomorrow* (the next one), not the instant that has
 * just arrived.
 */
export function startsAt(date: Date, tzOffsetMinutes: number): { isoString: string } {
  const { minutes: localMinutes } = localClock(date, tzOffsetMinutes);

  const firstStart = SHIFT_BOUNDS_MINUTES[0].start;
  const secondStart = SHIFT_BOUNDS_MINUTES[1].start;

  // Minutes from local midnight at which the next shift opens. May exceed 1440, which
  // is how "tomorrow" is expressed without ever naming a date.
  const nextStartMinutes =
    localMinutes < firstStart
      ? firstStart
      : localMinutes < secondStart
        ? secondStart
        : firstStart + MINUTES_PER_DAY;

  /*
   * Anchor on the *local* calendar day -- see {@link localMidnightUtc} for why the UTC
   * day is the wrong anchor -- and convert back by adding the offset, since
   * `local + offset = UTC` is the convention stated on {@link localOffsetMinutes}.
   */
  const nextStart = new Date(
    localMidnightUtc(date, tzOffsetMinutes) + (nextStartMinutes + tzOffsetMinutes) * 60_000,
  );

  return { isoString: nextStart.toISOString() };
}

// --------------------------------------------------------------------- status

/**
 * The athlete's human-coach standing, resolved from a premium flag and a clock.
 *
 * Premium is checked first and short-circuits. Beyond the obvious efficiency, the
 * order is the message: someone who is not premium should be told about the tier, not
 * shown a shift timetable for a coach they cannot reach, and checking the clock first
 * risks handing them the schedule as the first thing they see.
 */
export function humanCoachStatus(
  now: Date,
  tzOffsetMinutes: number,
  isPremium: boolean,
): HumanCoachStatus {
  if (!isPremium) {
    return { state: "not_premium", shift: null, nextShiftStart: null };
  }

  const shift = shiftAt(now, tzOffsetMinutes);
  if (shift) {
    // On shift: there is nothing to wait for, and advertising the 22:00 close as a
    // "next shift" would send an athlete to book a shift they are already inside.
    return { state: "available", shift, nextShiftStart: null };
  }

  return { state: "off_shift", shift: null, nextShiftStart: startsAt(now, tzOffsetMinutes) };
}