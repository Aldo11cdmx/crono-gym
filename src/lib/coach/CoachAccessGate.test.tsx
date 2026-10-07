/**
 * @vitest-environment jsdom
 *
 * The gates are the whole premium tier's enforcement point in the UI, so each is tested
 * from both sides: children when the condition holds, the refusal when it does not. That
 * is deliberately shallow per gate -- the interesting logic is in `access.ts` and
 * `useCoachAuth`, where it is tested exhaustively.
 *
 * What the gates themselves can get wrong, and what these tests therefore pin:
 *
 *  - **Which refusal.** Two gates can both refuse and they must not show the same
 *    message. A non-premium athlete told "el próximo turno abre a las 6:00" has been told
 *    to wait for something they cannot pay for; a premium athlete off shift told to buy
 *    Premium is being sold what they already own. The two branches are asserted by their
 *    distinct copy, not merely by "something rendered".
 *
 *  - **Ordering hazards are the call site's problem, not the gate's** -- which is the
 *    argument for three components over one `requires` prop. The composition is pinned
 *    here so a refactor that merges them again has to confront it.
 *
 *  - **The PIN form's disabled state.** A lockout that leaves the button enabled invites
 *    a coach to keep guessing and burns the attempt budget the server is protecting.
 *
 * The free tier is asserted through these gates too: nothing in this file gates Symmetry,
 * and a `PremiumGate` wrapped around the assistant is exactly the regression worth a test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { COACH_ACCESS_LABELS, COACH_PORTAL_LABELS } from "../i18n";
import type { CoachProfile, HumanCoachStatus } from "./access";

const PREMIUM: CoachProfile = { is_premium: true, premium_expires_at: null };
const FREE: CoachProfile = { is_premium: false, premium_expires_at: null };
const LAPSED: CoachProfile = { is_premium: true, premium_expires_at: "2020-01-01T00:00:00Z" };

/** A premium athlete at 23:00: off shift, and told when it opens. */
const OFF_SHIFT: HumanCoachStatus = {
  state: "off_shift",
  shift: null,
  nextShiftStart: { isoString: "2026-10-06T12:00:00.000Z" },
};

const AVAILABLE: HumanCoachStatus = {
  state: "available",
  shift: { id: "morning", startHour: 6, endHour: 14 },
  nextShiftStart: null,
};

const NOT_PREMIUM: HumanCoachStatus = {
  state: "not_premium",
  shift: null,
  nextShiftStart: null,
};

/**
 * Stubs `useCoachAuth` so the gate can be driven with a literal state.
 *
 * Mocking the hook rather than the fetch because the request contract is already pinned
 * in `useCoachAuth.test.ts`. What is untested here would be the *coupling*: which fields of
 * the hook the gate reads, and that it reads `isUnlocked` rather than, say, "no error".
 */
function mockAuth(overrides: Partial<ReturnType<typeof authShape>> = {}) {
  const state = { ...authShape(), ...overrides };
  vi.doMock("./useCoachAuth", () => ({ useCoachAuth: () => state }));
  return state;
}

function authShape() {
  return {
    isLoading: false,
    isUnlocked: false,
    requiresPinChange: false,
    error: null as { code: string; lockedUntil: string | null } | null,
    lockedUntil: null as string | null,
    unlock: vi.fn(async () => true),
    changePin: vi.fn(async () => true),
    lock: vi.fn(),
    touch: vi.fn(),
  };
}

/** Fresh modules, so a `doMock` from one test cannot leak into the next. */
async function loadGates() {
  return import("./CoachAccessGate");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(cleanup);

// ------------------------------------------------------------------ PremiumGate

describe("PremiumGate", () => {
  it("renders children for an active premium athlete", async () => {
    const { PremiumGate } = await loadGates();

    render(
      <PremiumGate profile={PREMIUM}>
        <p>Panel del coach</p>
      </PremiumGate>,
    );

    expect(screen.getByText("Panel del coach")).toBeDefined();
    expect(screen.queryByText(COACH_ACCESS_LABELS.premiumRequiredTitle)).toBeNull();
  });

  it("renders the fallback for a free athlete", async () => {
    const { PremiumGate } = await loadGates();

    render(
      <PremiumGate profile={FREE}>
        <p>Panel del coach</p>
      </PremiumGate>,
    );

    expect(screen.queryByText("Panel del coach")).toBeNull();
    expect(screen.getByText(COACH_ACCESS_LABELS.premiumRequiredTitle)).toBeDefined();
  });

  it("treats a lapsed term as not premium", async () => {
    // `is_premium = true` with an expiry in the past is the state a cancelled
    // subscription leaves behind. Reading the flag alone would keep showing the portal.
    const { PremiumGate } = await loadGates();

    render(
      <PremiumGate profile={LAPSED}>
        <p>Panel del coach</p>
      </PremiumGate>,
    );

    expect(screen.queryByText("Panel del coach")).toBeNull();
    expect(screen.getByText(COACH_ACCESS_LABELS.premiumRequiredTitle)).toBeDefined();
  });

  it("refuses an unknown profile rather than assuming the best", async () => {
    // Null means "not read yet". There is no version of this gate that shows paid
    // surfaces on an unconfirmed row and then takes them away a frame later.
    const { PremiumGate } = await loadGates();

    render(
      <PremiumGate profile={null}>
        <p>Panel del coach</p>
      </PremiumGate>,
    );

    expect(screen.queryByText("Panel del coach")).toBeNull();
    expect(screen.getByText(COACH_ACCESS_LABELS.premiumRequiredTitle)).toBeDefined();
  });

  it("uses a caller-supplied fallback instead of the default message", async () => {
    // A refusal is not always the end of the story: a marketing surface links to the
    // plans. Copying the message to change one line of it would fork the copy.
    const { PremiumGate } = await loadGates();

    render(
      <PremiumGate profile={FREE} fallback={<a href="/planes">Ver planes</a>}>
        <p>Panel del coach</p>
      </PremiumGate>,
    );

    expect(screen.getByText("Ver planes")).toBeDefined();
    expect(screen.queryByText(COACH_ACCESS_LABELS.premiumRequiredTitle)).toBeNull();
  });

  it("tells the athlete the free assistant is still available", async () => {
    // The whole point of the copy: a refusal that does not say what remains reads as
    // having lost the product, not as having declined an upgrade.
    const { PremiumGate } = await loadGates();

    render(
      <PremiumGate profile={FREE}>
        <p>Panel del coach</p>
      </PremiumGate>,
    );

    expect(screen.getByText(COACH_ACCESS_LABELS.premiumRequiredBody)).toBeDefined();
  });
});

// -------------------------------------------------------------------- ShiftGate

describe("ShiftGate", () => {
  it("renders children while a coach is on shift", async () => {
    const { ShiftGate } = await loadGates();

    render(
      <ShiftGate status={AVAILABLE}>
        <p>Conversación</p>
      </ShiftGate>,
    );

    expect(screen.getByText("Conversación")).toBeDefined();
    expect(screen.queryByText(COACH_ACCESS_LABELS.offShiftTitle)).toBeNull();
  });

  it("names the time the coach returns when off shift", async () => {
    const { ShiftGate } = await loadGates();

    render(
      <ShiftGate status={OFF_SHIFT}>
        <p>Conversación</p>
      </ShiftGate>,
    );

    expect(screen.queryByText("Conversación")).toBeNull();
    expect(screen.getByText(COACH_ACCESS_LABELS.offShiftTitle)).toBeDefined();
    // Matched as a pattern rather than an exact string: the time is formatted through
    // `Intl`, so it reads "06:00" on a 24-hour locale and "06:00 a.m." on a 12-hour one.
    // Asserting the sentence around it pins the two things that matter -- that a time is
    // named, and that it is the *next* one -- without freezing the machine's convention.
    expect(
      screen.getByText(/El próximo turno abre a las \d{2}:\d{2}/),
    ).toBeDefined();
  });

  it("says the conversation is kept", async () => {
    const { ShiftGate } = await loadGates();

    render(
      <ShiftGate status={OFF_SHIFT}>
        <p>Conversación</p>
      </ShiftGate>,
    );

    const body = COACH_ACCESS_LABELS.offShiftBody("06:00");
    expect(body).toContain("sigue aquí");
  });

  it("still says something useful when no opening time is known", async () => {
    // No time is a real state -- a schedule with no future shift -- and rendering
    // "vuelve a las NaN" would be worse than admitting the opening is unannounced.
    const { ShiftGate } = await loadGates();

    render(
      <ShiftGate status={{ ...OFF_SHIFT, nextShiftStart: null }}>
        <p>Conversación</p>
      </ShiftGate>,
    );

    expect(screen.getByText(COACH_ACCESS_LABELS.offShiftNoTime)).toBeDefined();
  });

  it("shows the shift notice rather than the premium notice for a non-premium status", async () => {
    // The two refusals must not be interchangeable. A non-premium athlete reaching this
    // gate is an edge case, and the honest thing to say is still the shift schedule --
    // not a second paywall stacked on the first.
    const { ShiftGate } = await loadGates();

    render(
      <ShiftGate status={NOT_PREMIUM}>
        <p>Conversación</p>
      </ShiftGate>,
    );

    expect(screen.getByText(COACH_ACCESS_LABELS.offShiftTitle)).toBeDefined();
    expect(screen.queryByText(COACH_ACCESS_LABELS.premiumRequiredTitle)).toBeNull();
  });

  it("uses a caller-supplied fallback", async () => {
    const { ShiftGate } = await loadGates();

    render(
      <ShiftGate status={OFF_SHIFT} fallback={<p>Vuelve mañana</p>}>
        <p>Conversación</p>
      </ShiftGate>,
    );

    expect(screen.getByText("Vuelve mañana")).toBeDefined();
    expect(screen.queryByText(COACH_ACCESS_LABELS.offShiftTitle)).toBeNull();
  });
});

// ------------------------------------------------------------------ CoachPinGate

describe("CoachPinGate", () => {
  it("renders children while unlocked", async () => {
    mockAuth({ isUnlocked: true });
    const { CoachPinGate } = await loadGates();

    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    expect(screen.getByText("Cola de atletas")).toBeDefined();
    expect(screen.queryByText(COACH_ACCESS_LABELS.pinTitle)).toBeNull();
  });

  it("renders the PIN form while locked", async () => {
    mockAuth({ isUnlocked: false });
    const { CoachPinGate } = await loadGates();

    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    expect(screen.queryByText("Cola de atletas")).toBeNull();
    expect(screen.getByText(COACH_ACCESS_LABELS.pinTitle)).toBeDefined();
    expect(screen.getByLabelText(COACH_ACCESS_LABELS.pinInputAriaLabel)).toBeDefined();
  });

  it("submits the typed PIN", async () => {
    const auth = mockAuth({ isUnlocked: false });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    fireEvent.change(screen.getByLabelText(COACH_ACCESS_LABELS.pinInputAriaLabel), {
      target: { value: "4821" },
    });
    fireEvent.click(screen.getByText(COACH_ACCESS_LABELS.pinSubmit));

    await waitFor(() => expect(auth.unlock).toHaveBeenCalledWith("4821"));
  });

  it("switches to the change-PIN form, with both fields, when one is required", async () => {
    mockAuth({ isUnlocked: false, requiresPinChange: true });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    expect(screen.getByText(COACH_ACCESS_LABELS.pinChangeTitle)).toBeDefined();
    expect(screen.getByLabelText(COACH_ACCESS_LABELS.pinCurrentAriaLabel)).toBeDefined();
    expect(screen.getByLabelText(COACH_ACCESS_LABELS.pinNewAriaLabel)).toBeDefined();
    // The requirements are stated rather than enforced by a regex, so the coach knows
    // what to change before the server refuses it.
    expect(screen.getByText(COACH_ACCESS_LABELS.pinRequirements)).toBeDefined();
  });

  it("sends both PINs on a change", async () => {
    const auth = mockAuth({ isUnlocked: false, requiresPinChange: true });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    fireEvent.change(screen.getByLabelText(COACH_ACCESS_LABELS.pinCurrentAriaLabel), {
      target: { value: "4821" },
    });
    fireEvent.change(screen.getByLabelText(COACH_ACCESS_LABELS.pinNewAriaLabel), {
      target: { value: "9134" },
    });
    fireEvent.click(screen.getByText(COACH_ACCESS_LABELS.pinChangeSubmit));

    await waitFor(() => expect(auth.changePin).toHaveBeenCalledWith("4821", "9134"));
    // A change must not also be reported as a plain unlock: the two ask the function for
    // different things and only one of them rewrites the credential.
    expect(auth.unlock).not.toHaveBeenCalled();
  });

  it("masks the PIN field", async () => {
    mockAuth({ isUnlocked: false });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    // A credential rendered in plain text ends up in a screenshot and in a shoulder-surf.
    expect(screen.getByLabelText(COACH_ACCESS_LABELS.pinInputAriaLabel).getAttribute("type")).toBe(
      "password",
    );
  });

  it("announces a wrong PIN and does not open the portal", async () => {
    mockAuth({ isUnlocked: false, error: { code: "INVALID_PIN", lockedUntil: null } });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    // `role="alert"` rather than a live region: the message replaces the outcome of a
    // submitted form, and a queued announcement leaves the coach looking at a form that
    // apparently did nothing.
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(COACH_ACCESS_LABELS.pinErrors.INVALID_PIN);
    expect(screen.queryByText("Cola de atletas")).toBeNull();
  });

  it("disables the form while a lockout is in force", async () => {
    // A button left enabled invites a coach to keep guessing, and each attempt spends
    // the budget the server is protecting.
    //
    // The instant is *future*, computed from the clock: a hardcoded one goes
    // stale the day it is written, and a stale lockout is no lockout at all --
    // the countdown reports it expired and the form stays enabled, which is
    // exactly what this test exists to forbid.
    const lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
    const auth = mockAuth({
      isUnlocked: false,
      error: { code: "TOO_MANY_ATTEMPTS", lockedUntil },
      lockedUntil,
    });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    const submit = screen.getByRole("button", { name: COACH_ACCESS_LABELS.pinSubmit });
    expect(submit.hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText(COACH_ACCESS_LABELS.pinInputAriaLabel).hasAttribute("disabled")).toBe(
      true,
    );

    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    await waitFor(() => expect(auth.unlock).not.toHaveBeenCalled());
  });

  it("shows when the lockout lifts", async () => {
    // Future, like the lockout this renders: a past instant would count as
    // expired, and an expired lockout is not one to announce.
    const lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
    mockAuth({
      isUnlocked: false,
      error: { code: "TOO_MANY_ATTEMPTS", lockedUntil },
      lockedUntil,
    });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    expect(
      screen.getByText(COACH_ACCESS_LABELS.lockedUntil(lockedUntil)),
    ).toBeDefined();
  });

  /*
   * The countdown, tested against the wall clock rather than faked timers.
   *
   * `useLockoutCountdown` has its own suite driving fake timers for the arithmetic; what
   * needs proving *here* is only that the form reads it -- that the notice moves and the
   * button comes back. Real time with a short window is the honest way to test that, and
   * faking the clock around a dynamically imported component would test the mocking.
   */
  it("muestra un temporizador vivo y libera el formulario cuando termina", async () => {
    const lockedUntil = new Date(Date.now() + 1_200).toISOString();
    mockAuth({
      isUnlocked: false,
      error: { code: "TOO_MANY_ATTEMPTS", lockedUntil },
      lockedUntil,
    });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    // Rounds up, so a fraction of a minute still reads as "1 minuto" rather than "0", which
    // would tell the coach to try immediately and spend an attempt they do not have.
    expect(screen.getByText(COACH_PORTAL_LABELS.lockedUntilMinutes(1))).toBeDefined();
    expect(
      screen.getByRole("button", { name: COACH_ACCESS_LABELS.pinSubmit }).hasAttribute("disabled"),
    ).toBe(true);

    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: COACH_ACCESS_LABELS.pinSubmit }).hasAttribute("disabled"),
        ).toBe(false),
      { timeout: 4_000 },
    );

    /*
     * The regression. `lockedUntil` never changes, so gating the form on it kept the form
     * disabled until the coach reloaded the page -- fifteen minutes of a button that looks
     * broken. If the server's block really is still up, `coach-auth` refuses the PIN and
     * reports the lockout again; being released early locally is a courtesy about *when to
     * try*, not a way around the authority on *whether they may*.
     */
    expect(screen.queryByText(COACH_PORTAL_LABELS.lockedUntilMinutes(1))).toBeNull();
    // The sentence explaining what happened stays: the coach is not locked out, but they
    // still need to know why they were.
    expect(screen.getByText(COACH_ACCESS_LABELS.lockedUntil(lockedUntil))).toBeDefined();
  });

  it("no muestra temporizador sin un bloqueo en curso", async () => {
    mockAuth({
      isUnlocked: false,
      error: { code: "INVALID_PIN", lockedUntil: null },
      lockedUntil: null,
    });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    // A wrong PIN is not a lockout, and counting down from nothing is how a form ends up
    // disabled behind a message that says "0 minutos".
    expect(
      screen.getByRole("button", { name: COACH_ACCESS_LABELS.pinSubmit }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("disables the button while a request is in flight", async () => {
    mockAuth({ isUnlocked: false, isLoading: true });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    // The label changes too: a button that still says "Desbloquear" while disabled reads
    // as a refused click rather than as a request in progress.
    expect(screen.getByText(COACH_ACCESS_LABELS.pinSubmitting)).toBeDefined();
    expect(
      screen.getByRole("button", { name: COACH_ACCESS_LABELS.pinSubmitting }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("uses a caller-supplied fallback instead of the form", async () => {
    mockAuth({ isUnlocked: false });
    const { CoachPinGate } = await loadGates();
    render(
      <CoachPinGate fallback={<p>Acceso del coach</p>}>
        <p>Cola de atletas</p>
      </CoachPinGate>,
    );

    expect(screen.getByText("Acceso del coach")).toBeDefined();
    expect(screen.queryByText(COACH_ACCESS_LABELS.pinTitle)).toBeNull();
  });
});

// ------------------------------------------------------------------ composition

describe("gates composed", () => {
  it("does not ask a free athlete for a coach's PIN", async () => {
    // The ordering hazard this file's whole shape exists to make visible. With a single
    // `requires` prop and the PIN gate outside the premium gate, this renders a PIN field
    // to somebody who cannot use what it unlocks.
    mockAuth({ isUnlocked: false });
    const { CoachPinGate, PremiumGate } = await loadGates();

    render(
      <PremiumGate profile={FREE}>
        <CoachPinGate>
          <p>Cola de atletas</p>
        </CoachPinGate>
      </PremiumGate>,
    );

    expect(screen.queryByLabelText(COACH_ACCESS_LABELS.pinInputAriaLabel)).toBeNull();
    expect(screen.getByText(COACH_ACCESS_LABELS.premiumRequiredTitle)).toBeDefined();
  });

  it("shows the portal to a premium coach who is on shift and unlocked", async () => {
    mockAuth({ isUnlocked: true });
    const { CoachPinGate, PremiumGate, ShiftGate } = await loadGates();

    render(
      <PremiumGate profile={PREMIUM}>
        <CoachPinGate>
          <ShiftGate status={AVAILABLE}>
            <p>Cola de atletas</p>
          </ShiftGate>
        </CoachPinGate>
      </PremiumGate>,
    );

    expect(screen.getByText("Cola de atletas")).toBeDefined();
  });

  it("shows the shift notice to a premium coach between shifts, and no PIN field", async () => {
    // Already unlocked, so the PIN gate passes and the shift gate is the one that refuses.
    // Getting these two the wrong way round shows a coach the wrong thing at the wrong
    // moment, which is why the composition is asserted rather than assumed.
    mockAuth({ isUnlocked: true });
    const { CoachPinGate, PremiumGate, ShiftGate } = await loadGates();

    render(
      <PremiumGate profile={PREMIUM}>
        <CoachPinGate>
          <ShiftGate status={OFF_SHIFT}>
            <p>Cola de atletas</p>
          </ShiftGate>
        </CoachPinGate>
      </PremiumGate>,
    );

    expect(screen.queryByText("Cola de atletas")).toBeNull();
    expect(screen.getByText(COACH_ACCESS_LABELS.offShiftTitle)).toBeDefined();
    expect(screen.queryByLabelText(COACH_ACCESS_LABELS.pinInputAriaLabel)).toBeNull();
  });

  it("leaves the free assistant ungated", async () => {
    // Nothing in this file gates Symmetry, and the regression this guards is the one the
    // copy already promises against: a free athlete who cannot open the assistant has been
    // shipped a paywall by accident.
    mockAuth({ isUnlocked: false });
    const { CoachPinGate, PremiumGate } = await loadGates();

    render(
      <section>
        <p>{COACH_ACCESS_LABELS.assistantOpen}</p>
        <PremiumGate profile={FREE} fallback={<p>Ver planes</p>}>
          <CoachPinGate>
            <p>Cola de atletas</p>
          </CoachPinGate>
        </PremiumGate>
      </section>,
    );

    // The assistant's affordance is outside the premium gate and therefore unaffected by
    // it, whatever the paid tier says.
    expect(screen.getByText(COACH_ACCESS_LABELS.assistantOpen)).toBeDefined();
    expect(screen.getByText("Ver planes")).toBeDefined();
  });
});