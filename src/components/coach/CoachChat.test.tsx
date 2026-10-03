/**
 * @vitest-environment jsdom
 *
 * CoachChat's interesting behaviour is all in what happens when a request does not go
 * to plan, because that is where a chat either stays usable or loses the athlete's
 * conversation: a stream that stops halfway, a rate limit, an over-long question, a
 * device with no IndexedDB.
 *
 * `askCoach` is mocked at the module boundary so the streaming contract can be driven
 * frame by frame -- a real network call cannot be made to fail on cue, and the point of
 * these tests is the handling, not the transport. `toAssistantContext` is deliberately
 * *not* mocked: what the model is told is a product claim, and this file asserts it
 * against the same projection the hub uses.
 *
 * `chatStorage` is mocked because jsdom has no IndexedDB. Its pure helpers are tested
 * for real in `chatStorage.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CoachChat } from "./CoachChat";
import { COACH_LABELS as T } from "@/lib/i18n";
import { DEFAULT_GYM_SETTINGS, type GymSettings } from "@/context/GymSettingsContext";
import { CoachRequestError, type CoachError, type ChatMessage } from "@/lib/ai/types";
import type { CoachContext } from "@/lib/coach/types";

// --------------------------------------------------------------- fixtures

const CONTEXT: CoachContext = {
  generatedAt: "2026-06-01T12:00:00.000Z",
  profile: {
    sex: "female",
    weightKg: 62,
    heightCm: 168,
    experienceLevel: "intermediate",
    activityLevel: "moderate",
    goal: "gain_muscle",
    unitSystem: "metric",
  },
  bodyweight: { latestKg: 62, changeLast30Days: -0.4, seriesCount: 9 },
  volume: {
    totalWorkouts: 24,
    workoutsThisMonth: 6,
    monthlyVolume: 42_000,
    weeklyPoints: [],
  },
  muscles: [
    {
      slug: "chest",
      label: "Pectorales",
      classified: true,
      rankId: "gold",
      rankLabel: "Oro",
      unrankedReason: null,
      confidence: "high",
      score: 72,
      activeWeeks: 4,
      effectiveSets: 40,
      topExercises: [
        { name: "Press de banca", bestSet: { weight: 90, reps: 5 }, estimatedOneRepMax: 105 },
      ],
    },
  ],
  energy: { targetKcal: 2400, proteinGrams: 130 },
  dataGaps: [],
};

const GYM: GymSettings = { ...DEFAULT_GYM_SETTINGS };

// ------------------------------------------------------------------ mocks

/**
 * `vi.hoisted` rather than plain `const`s: `vi.mock` is hoisted above every top-level
 * statement in this file, so a factory referencing a `const` declared here would run
 * before its initialisation and throw `Cannot access before initialization`.
 */
const { askCoach, saveChat, loadChat, pruneChatHistory } = vi.hoisted(() => ({
  askCoach: vi.fn(),
  // The parameters are typed even though the factories ignore them: without them
  // `vi.fn(async () => true)` infers a zero-argument signature, and `mock.calls[0][0]`
  // would not typecheck even though the component does pass a transcript.
  saveChat: vi.fn((_messages: unknown[]) => Promise.resolve(true)),
  loadChat: vi.fn((_day?: string) => Promise.resolve([] as unknown[])),
  pruneChatHistory: vi.fn((_day?: string) => Promise.resolve(0)),
}));

vi.mock("@/lib/ai/coachAssistant", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/coachAssistant")>();
  return { ...original, askCoach };
});

vi.mock("@/lib/ai/chatStorage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/chatStorage")>();
  return { ...original, saveChat, loadChat, pruneChatHistory };
});

// -------------------------------------------------------------- lifecycle

beforeEach(() => {
  askCoach.mockReset().mockResolvedValue({ message: "ok" });
  saveChat.mockClear().mockResolvedValue(true);
  loadChat.mockReset().mockResolvedValue([]);
  pruneChatHistory.mockReset().mockResolvedValue(0);
});

afterEach(() => {
  cleanup();
});

function renderChat(overrides: Partial<GymSettings> = {}) {
  return render(<CoachChat context={CONTEXT} gymSettings={{ ...GYM, ...overrides }} />);
}

/** Types into the box and submits. */
async function ask(text: string) {
  const box = screen.getByPlaceholderText(T.chatPlaceholder);
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: T.chatSend }));
}

// -------------------------------------------------------------------- tests

describe("an empty conversation", () => {
  it("invites a question and sends nothing until there is one", async () => {
    renderChat();
    expect(await screen.findByText(T.chatEmpty)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: T.chatSend }));
    expect(askCoach).not.toHaveBeenCalled();
  });

  it("disables the send button on an empty draft", async () => {
    renderChat();
    await screen.findByText(T.chatEmpty);
    expect((screen.getByRole("button", { name: T.chatSend }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it("states that it is not a medical professional", async () => {
    // A product boundary, and the one thing on this screen that must not be quietly
    // dropped for space.
    renderChat();
    expect(screen.getByText(T.chatDisclaimer)).toBeTruthy();
  });
});

describe("a successful exchange", () => {
  it("shows the question and the answer, streamed", async () => {
    askCoach.mockImplementation(async (_req: unknown, onChunk: (c: string) => void) => {
      onChunk("Tu ");
      onChunk("volumen está bajo.");
      return { message: "Tu volumen está bajo." };
    });

    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("¿Cómo entreno esta semana?");

    expect(await screen.findByText("Tu volumen está bajo.")).toBeTruthy();
    expect(screen.getByText("¿Cómo entreno esta semana?")).toBeTruthy();
  });

  it("tells the model the athlete's own data", async () => {
    // The claim this component makes is that the coach sees what the app knows, so it
    // is asserted against the real projection rather than a fixture of it.
    askCoach.mockResolvedValue({ message: "ok" });
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("¿Qué tal?");

    await waitFor(() => expect(askCoach).toHaveBeenCalledTimes(1));
    const sent = askCoach.mock.calls[0][0];
    expect(sent.context.currentGoal).toBe("volume");
    expect(sent.context.recentPRs[0]).toMatchObject({ exercise: "Press de banca", weightKg: 90 });
    expect(sent.context.availablePlates).toEqual([2.5, 5, 10, 15, 20]);
    expect(sent.context.barWeightKg).toBe(20);
    expect(sent.context.bodyWeightKg).toBe(62);
  });

  it("reports the plate inventory the user actually owns", async () => {
    askCoach.mockResolvedValue({ message: "ok" });
    renderChat({ inventory: { 20: 2, 2.5: 2 } });
    await screen.findByText(T.chatEmpty);
    await ask("¿Qué tal?");

    await waitFor(() => expect(askCoach).toHaveBeenCalledTimes(1));
    // A rack with no 15s must not be described to the model as having them.
    expect(askCoach.mock.calls[0][0].context.availablePlates).toEqual([2.5, 20]);
  });

  it("sends the prior turns as history, but not the question just asked", async () => {
    renderChat();
    await screen.findByText(T.chatEmpty);

    await ask("primera");
    await screen.findByText("ok");
    await ask("segunda");

    // The second request carries the first exchange. The second question is the
    // `userMessage`; putting it in both would duplicate it.
    await waitFor(() => expect(askCoach).toHaveBeenCalledTimes(2));
    const second = askCoach.mock.calls[1][0];
    expect(second.conversationHistory).toEqual([
      { role: "user", content: "primera" },
      { role: "assistant", content: "ok" },
    ]);
    expect(second.userMessage).toBe("segunda");
  });

  it("sends on Enter and breaks the line on Shift+Enter", async () => {
    askCoach.mockResolvedValue({ message: "ok" });
    renderChat();
    await screen.findByText(T.chatEmpty);

    const box = screen.getByPlaceholderText(T.chatPlaceholder);
    fireEvent.change(box, { target: { value: "con enter" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(askCoach).toHaveBeenCalledTimes(1));

    fireEvent.change(box, { target: { value: "con mayús" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(askCoach).toHaveBeenCalledTimes(1);
    expect((box as HTMLTextAreaElement).value).toBe("con mayús");
  });

  it("shows an answer that arrived without a single chunk", async () => {
    // Legal upstream: a provider can return a complete answer having emitted no
    // fragments. Updating in place would then find no bubble to update and drop the
    // answer, leaving the question on screen with no reply and no error -- which reads
    // as a silent failure rather than as a bug.
    askCoach.mockResolvedValue({ message: "Respuesta entera." });
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("¿algo?");

    expect(await screen.findByText("Respuesta entera.")).toBeTruthy();
  });

  it("keeps streamed prose when the answer was only an action block", async () => {
    askCoach.mockImplementation(async (_req: unknown, onChunk: (c: string) => void) => {
      onChunk("Cambia el ejercicio.");
      // A model whose whole reply was the fence leaves nothing after parsing.
      return { message: "" };
    });
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("¿qué hago?");

    expect(await screen.findByText("Cambia el ejercicio.")).toBeTruthy();
  });

  it("clears the box after sending", async () => {
    askCoach.mockResolvedValue({ message: "ok" });
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("hola");

    await waitFor(() =>
      expect((screen.getByPlaceholderText(T.chatPlaceholder) as HTMLTextAreaElement).value)
        .toBe(""),
    );
  });
});

describe("a structured recommendation", () => {
  it("renders the action and its reason", async () => {
    askCoach.mockResolvedValue({
      message: "Sube un poco el press.",
      action: {
        type: "training_adjustment",
        field: "weight",
        delta: 2.5,
        reason: "Completaste todas las reps",
      },
    });
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("¿subo?");

    expect(await screen.findByText(T.chatActions.training_adjustment)).toBeTruthy();
    // Derived from the discriminant, never a stored string.
    expect(screen.getByText(/weight \+2\.5/)).toBeTruthy();
    expect(screen.getByText(/Completaste todas las reps/)).toBeTruthy();
  });

  it("describes an exercise swap as a swap", async () => {
    askCoach.mockResolvedValue({
      message: "Cambia el ejercicio.",
      action: {
        type: "exercise_swap",
        fromExercise: "Press inclinado",
        toExercise: "Press plano",
        reason: "Molestia en el hombro",
      },
    });
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("¿qué hago?");

    expect(await screen.findByText(T.chatActions.exercise_swap)).toBeTruthy();
    expect(screen.getByText(/Press inclinado → Press plano/)).toBeTruthy();
  });

  it("does not repeat the action as raw JSON", async () => {
    // The whole point of parsing it out: a user shown the fence has learned nothing.
    askCoach.mockResolvedValue({
      message: "Sube el press.",
      action: { type: "calorie_adjustment", deltaKcal: 150, reason: "Déficit marcado" },
    });
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("?");

    await screen.findByText("Sube el press.");
    expect(screen.queryByText(/deltaKcal/)).toBeNull();
  });
});

describe("failures", () => {
  it("puts a rate limit in the transcript, where it can still be read", async () => {
    askCoach.mockRejectedValue(
      new CoachRequestError({ code: "RATE_LIMITED", retryAfterMs: 60_000 }),
    );
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("hola");

    // A toast would be gone in four seconds; an alert in the scroll stays next to the
    // question that caused it.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(T.chatErrors.RATE_LIMITED);
  });

  it("gives a different message per failure kind", async () => {
    // Each failure kind gets its own message: one generic notice would collapse a rate
    // limit, an auth failure and an outage into the same indistinguishable thing.
    const codes = [
      { code: "RATE_LIMITED", retryAfterMs: 1000 },
      { code: "AUTH_ERROR" },
      { code: "NETWORK_ERROR", message: "offline" },
      { code: "INPUT_TOO_LONG" },
      { code: "SERVICE_UNAVAILABLE" },
    ] satisfies CoachError[];

    for (const code of codes) {
      askCoach.mockRejectedValue(new CoachRequestError(code));
      renderChat();
      await screen.findByText(T.chatEmpty);
      await ask("hola");
      expect((await screen.findByRole("alert")).textContent).toBe(T.chatErrors[code.code]);
      cleanup();
    }
  });

  it("keeps the question when the request fails", async () => {
    askCoach.mockRejectedValue(new CoachRequestError({ code: "SERVICE_UNAVAILABLE" }));
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("¿por qué falló?");

    // Losing the typed question would be the worst possible outcome of a failure.
    expect(await screen.findByText("¿por qué falló?")).toBeTruthy();
  });

  it("does not show an internal message", async () => {
    askCoach.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("hola");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(T.chatErrors.SERVICE_UNAVAILABLE);
    expect(alert.textContent).not.toContain("ECONNREFUSED");
  });

  it("refuses a question over the limit without spending a request", async () => {
    renderChat();
    await screen.findByText(T.chatEmpty);

    const box = screen.getByPlaceholderText(T.chatPlaceholder);
    // maxLength is one over, so the box accepts the paste and the component refuses it.
    fireEvent.change(box, { target: { value: "a".repeat(501) } });

    expect((screen.getByRole("button", { name: T.chatSend }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(askCoach).not.toHaveBeenCalled();
  });
});

describe("stopping a stream", () => {
  it("keeps the partial answer", async () => {
    askCoach.mockImplementation(
      (_req: unknown, onChunk: (c: string) => void) =>
        new Promise((_resolve, reject) => {
          onChunk("Parcial");
          const timer = setTimeout(() => reject(new DOMException("aborted", "AbortError")), 5);
          void timer;
        }),
    );

    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("cuéntame");

    // Two sentences arrived before the stop. Throwing them away would punish a change
    // of mind, and the text was true when it was written.
    fireEvent.click(await screen.findByRole("button", { name: T.chatStop }));
    expect(await screen.findByText("Parcial")).toBeTruthy();
  });

  it("does not record an abort as a failure", async () => {
    askCoach.mockImplementation(
      (_req: unknown, onChunk: (c: string) => void) =>
        new Promise((_resolve, reject) => {
          onChunk("Parcial");
          reject(new DOMException("aborted", "AbortError"));
        }),
    );

    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("cuéntame");

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("offers Stop instead of Send while streaming", async () => {
    askCoach.mockImplementation(() => new Promise(() => undefined));
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("espera");

    expect(await screen.findByRole("button", { name: T.chatStop })).toBeTruthy();
    expect(screen.queryByRole("button", { name: T.chatSend })).toBeNull();
  });
});

describe("persistence", () => {
  it("saves the question before the answer arrives", async () => {
    // If the tab is killed mid-stream, the question is the part worth finding again.
    askCoach.mockImplementation(() => new Promise(() => undefined));
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("no pierdas esto");

    await waitFor(() => expect(saveChat).toHaveBeenCalled());
    const firstSaved = saveChat.mock.calls[0][0] as ChatMessage[];
    expect(firstSaved.at(-1)).toMatchObject({ role: "user", content: "no pierdas esto" });
  });

  it("restores today's conversation on mount", async () => {
    loadChat.mockResolvedValue([
      { id: "m1", role: "user", content: "ayer", timestamp: 1 },
      { id: "m2", role: "assistant", content: "hoy", timestamp: 2 },
    ]);
    renderChat();

    expect(await screen.findByText("ayer")).toBeTruthy();
    expect(screen.getByText("hoy")).toBeTruthy();
    // A restored day is not an empty state, so the invitation is gone.
    expect(screen.queryByText(T.chatEmpty)).toBeNull();
  });

  it("warns when the device cannot save", async () => {
    // IndexedDB can be absent, blocked or out of quota. Losing a reload silently is
    // worse than saying so.
    saveChat.mockResolvedValue(false);
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("hola");

    expect(await screen.findByText(T.chatNotSaved)).toBeTruthy();
  });

  it("clears today's conversation on request", async () => {
    loadChat.mockResolvedValue([
      { id: "m1", role: "user", content: "borrar esto", timestamp: 1 },
    ]);
    renderChat();
    await screen.findByText("borrar esto");

    fireEvent.click(screen.getByRole("button", { name: T.chatClear }));

    await waitFor(() => expect(screen.queryByText("borrar esto")).toBeNull());
    expect(await screen.findByText(T.chatEmpty)).toBeTruthy();
  });

  it("hides the clear control on an empty conversation", async () => {
    renderChat();
    await screen.findByText(T.chatEmpty);
    expect(screen.queryByRole("button", { name: T.chatClear })).toBeNull();
  });

  it("prunes on load, not only on write", async () => {
    renderChat();
    await screen.findByText(T.chatEmpty);
    // A user who stopped chatting would otherwise never be pruned.
    expect(pruneChatHistory).toHaveBeenCalledTimes(1);
  });
});

describe("accessibility", () => {
  it("announces politely rather than assertively", async () => {
    // A stream emits dozens of updates; an assertive region would announce every one.
    askCoach.mockImplementation(async (_req: unknown, onChunk: (c: string) => void) => {
      onChunk("a");
      onChunk("b");
      return { message: "ab" };
    });
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("hola");

    const region = await screen.findByText("ab");
    let node: HTMLElement | null = region;
    while (node && node.getAttribute("aria-live") === null) node = node.parentElement;
    expect(node?.getAttribute("aria-live")).toBe("polite");
  });

  it("exposes the busy state while streaming", async () => {
    askCoach.mockImplementation(() => new Promise(() => undefined));
    renderChat();
    await screen.findByText(T.chatEmpty);
    await ask("espera");

    await waitFor(() => {
      const region = document.querySelector("[aria-busy]");
      expect(region?.getAttribute("aria-busy")).toBe("true");
    });
  });

  it("labels the input", async () => {
    renderChat();
    await screen.findByText(T.chatEmpty);
    // The textarea's accessible name comes from its own label element.
    expect(screen.getByLabelText(T.chatPlaceholder)).toBeTruthy();
  });
});