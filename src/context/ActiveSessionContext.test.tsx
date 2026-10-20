/**
 * @vitest-environment jsdom
 *
 * ActiveSessionContext.test.tsx — the session that outlives the screen.
 *
 * The provider owns three things that used to be scattered: the clock
 * (`startedAt`), the warm-up requests, and -- since the rehydration moved
 * up one level -- the unfinished session that lives on the device.
 *
 * That last one is what this file is about. A reload used to land on the
 * dashboard with a session still running, because the lookup happened
 * inside the workout: a component that only mounts once the app has already
 * decided there is no session. Here the provider is the one that looks, and
 * the tests are about what it does with the answer: it becomes a session, it
 * keeps its own id, and it can be thrown away.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  ActiveSessionProvider,
  useActiveSession,
  type ActiveSessionValue,
} from "./ActiveSessionContext";
import { deleteDraft, loadRecoverableDraft } from "../lib/offlineStore";
import type { SessionDraft } from "../lib/offlineStore";

vi.mock("../lib/offlineStore", () => ({
  loadRecoverableDraft: vi.fn(async () => null),
  deleteDraft: vi.fn(async () => undefined),
  newSessionId: () => "log-test",
}));

/** The value the provider last published, for the assertions. */
let latest: ActiveSessionValue | null = null;

/**
 * Reads the context and, when asked, asks the provider to look for an
 * unfinished session -- the same call the auth gate makes once it knows
 * who is signed in.
 */
function Probe({ userId }: { userId?: string }) {
  const value = useActiveSession();
  latest = value;
  useEffect(() => {
    if (userId) value.rehydrate(userId);
  }, [userId, value.rehydrate]);
  return null;
}

function renderProvider(userId?: string) {
  return render(
    <ActiveSessionProvider>
      <Probe userId={userId} />
    </ActiveSessionProvider>,
  );
}

/** An interrupted session, as the provider finds it on the device. */
function draft(overrides: Partial<SessionDraft> = {}): SessionDraft {
  return {
    logId: "log-draft",
    userId: "user-1",
    routineId: "routine-1",
    routineTitle: "Fuerza",
    startedAt: "2026-10-20T08:00:00.000Z",
    items: [
      {
        key: "squat",
        exercise: {
          id: "squat",
          name: "Sentadilla trasera",
          body_part: "upper legs",
          target: "quadriceps",
          equipment: "barbell",
          gif_url: "",
          instructions: [],
        },
        restSeconds: 90,
        sets: [
          {
            set_number: 1,
            weight: "100",
            reps: "5",
            rpe: "8",
            kind: "normal",
            completed: true,
          },
        ],
      },
    ],
    notes: "",
    finalized: false,
    updatedAt: 1,
    ...overrides,
  };
}

/** Lets the lookup resolve. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  latest = null;
  vi.mocked(loadRecoverableDraft).mockResolvedValue(null);
  vi.mocked(deleteDraft).mockClear();
});

afterEach(() => {
  cleanup();
});

describe("ActiveSessionProvider rehydration", () => {
  it("turns an unfinished session into a session the app can see", async () => {
    vi.mocked(loadRecoverableDraft).mockResolvedValue(draft());
    renderProvider("user-1");
    await settle();

    // The session exists before any workout mounts: that is the whole point
    // of moving the lookup up here.
    expect(latest?.session).not.toBeNull();
    expect(latest?.session?.routineId).toBe("routine-1");
    expect(latest?.session?.title).toBe("Fuerza");
    // The clock starts when the interrupted session started, not now.
    expect(latest?.session?.startedAt).toBe("2026-10-20T08:00:00.000Z");
    expect(latest?.recoverableDraft?.logId).toBe("log-draft");
  });

  it("does not answer before the question is asked", () => {
    renderProvider();
    // The lookup has not run, so the answer is not "no session": it is
    // "not known yet".
    expect(latest?.rehydrating).toBe(true);
    expect(latest?.session).toBeNull();
  });

  it("looks once per user", async () => {
    vi.mocked(loadRecoverableDraft).mockResolvedValue(draft());
    const view = renderProvider("user-1");
    await settle();

    view.rerender(
      <ActiveSessionProvider>
        <Probe userId="user-1" />
      </ActiveSessionProvider>,
    );
    await settle();

    expect(vi.mocked(loadRecoverableDraft)).toHaveBeenCalledTimes(1);
  });

  it("leaves a running session alone", async () => {
    vi.mocked(loadRecoverableDraft).mockResolvedValue(draft());

    function StartsASession() {
      const { start } = useActiveSession();
      useEffect(() => {
        start({ id: "routine-live", title: "Sesión en curso" });
      }, [start]);
      return null;
    }

    render(
      <ActiveSessionProvider>
        <StartsASession />
        <Probe userId="user-1" />
      </ActiveSessionProvider>,
    );
    await settle();

    // The live session wins: the draft belongs to a session nobody chose to
    // continue, and two sessions in one app is one too many.
    expect(latest?.session?.routineId).toBe("routine-live");
    expect(latest?.recoverableDraft).toBeNull();
  });
});

describe("ActiveSessionProvider recovery", () => {
  it("keeps the interrupted session under its own id", async () => {
    vi.mocked(loadRecoverableDraft).mockResolvedValue(draft());
    renderProvider("user-1");
    await settle();

    act(() => {
      latest?.restoreDraft();
    });

    // The row on the server and the record on the device are the same
    // session: a second id would leave an orphan behind.
    expect(latest?.recoveredLogId).toBe("log-draft");
    expect(latest?.recoverableDraft).toBeNull();
  });

  it("throws the interrupted session away when it is discarded", async () => {
    vi.mocked(loadRecoverableDraft).mockResolvedValue(draft());
    renderProvider("user-1");
    await settle();

    act(() => {
      latest?.discardDraft();
    });

    expect(vi.mocked(deleteDraft)).toHaveBeenCalledWith("log-draft");
    expect(latest?.recoverableDraft).toBeNull();
    // The clock of a discarded session does not keep running.
    expect(latest?.session?.startedAt).not.toBe("2026-10-20T08:00:00.000Z");
  });

  it("gives a new session a new id", async () => {
    vi.mocked(loadRecoverableDraft).mockResolvedValue(draft());
    renderProvider("user-1");
    await settle();
    act(() => {
      latest?.restoreDraft();
    });

    act(() => {
      latest?.start({ id: "routine-2", title: " otra " });
    });

    // The recovered id belonged to the session that was recovered.
    expect(latest?.recoveredLogId).toBeNull();
  });
});

describe("ActiveSessionProvider rendering", () => {
  it("renders its children", () => {
    render(
      <ActiveSessionProvider>
        <span>sesión</span>
      </ActiveSessionProvider>,
    );
    expect(screen.getByText("sesión")).toBeTruthy();
  });
});
