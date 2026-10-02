import { beforeEach, describe, expect, it } from "vitest";
import {
  notifyTrainingDataChanged,
  resetTrainingEventListeners,
  subscribeTrainingData,
  trainingListenerCount,
} from "./trainingEvents";

describe("trainingEvents", () => {
  beforeEach(() => {
    resetTrainingEventListeners();
  });

  it("notifies every subscriber", () => {
    let a = 0;
    let b = 0;
    subscribeTrainingData(() => {
      a += 1;
    });
    subscribeTrainingData(() => {
      b += 1;
    });
    notifyTrainingDataChanged();
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("stops notifying after unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribeTrainingData(() => {
      calls += 1;
    });
    notifyTrainingDataChanged();
    unsubscribe();
    notifyTrainingDataChanged();
    expect(calls).toBe(1);
    expect(trainingListenerCount()).toBe(0);
  });

  it("is a no-op with no subscribers", () => {
    expect(() => notifyTrainingDataChanged()).not.toThrow();
  });

  it("keeps notifying the others when one subscriber throws", () => {
    let reached = false;
    subscribeTrainingData(() => {
      throw new Error("boom");
    });
    subscribeTrainingData(() => {
      reached = true;
    });
    // A throwing subscriber must not stop the ranks view from updating.
    expect(() => notifyTrainingDataChanged()).not.toThrow();
    expect(reached).toBe(true);
  });

  it("survives a subscriber unsubscribing during dispatch", () => {
    // `Set.forEach` over the live set would skip the next listener when one
    // removes itself mid-dispatch, silently losing an update.
    let second = 0;
    const secondUnsubscribe = subscribeTrainingData(() => {
      second += 1;
    });
    subscribeTrainingData(() => {
      secondUnsubscribe();
    });

    notifyTrainingDataChanged();
    expect(second).toBe(1);
  });

  it("does not double-notify when the same function subscribes twice", () => {
    // A `Set` deduplicates, so a component that re-subscribes before cleanup
    // cannot receive two copies of every event.
    let calls = 0;
    const listener = () => {
      calls += 1;
    };
    subscribeTrainingData(listener);
    subscribeTrainingData(listener);
    notifyTrainingDataChanged();
    expect(calls).toBe(1);
    expect(trainingListenerCount()).toBe(1);
  });

  it("reports its subscriber count", () => {
    expect(trainingListenerCount()).toBe(0);
    const first = subscribeTrainingData(() => {});
    const second = subscribeTrainingData(() => {});
    expect(trainingListenerCount()).toBe(2);
    first();
    second();
    expect(trainingListenerCount()).toBe(0);
  });
});