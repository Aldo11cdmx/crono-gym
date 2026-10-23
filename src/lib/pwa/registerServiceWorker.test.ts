/**
 * @vitest-environment jsdom
 *
 * registerServiceWorker.test.ts — installing the shell must never be the
 * thing that breaks the app.
 *
 * A service worker that fails to register is not a problem the athlete can do
 * anything about, and one that registers in development turns every hot
 * reload into a mystery. Both are pinned here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SERVICE_WORKER_URL,
  registerServiceWorker,
  unregisterServiceWorker,
} from "./registerServiceWorker";

const register = vi.fn(async () => ({ unregister: vi.fn(async () => undefined) }));
const getRegistration = vi.fn(async () => ({ unregister: vi.fn(async () => undefined) }));

beforeEach(() => {
  register.mockClear();
  getRegistration.mockClear();
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register, getRegistration },
    configurable: true,
  });
  // The app registers after `load`; in a test the document is already loaded,
  // so the listener would never fire and the registration would look absent.
  Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("registerServiceWorker", () => {
  it("registers the worker when it is enabled", () => {
    registerServiceWorker();

    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL);
  });

  it("does not register anything when it is disabled", () => {
    registerServiceWorker({ enabled: false });

    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing when the browser has no service workers", () => {
    Reflect.deleteProperty(navigator, "serviceWorker");

    expect(() => registerServiceWorker()).not.toThrow();
    expect(register).not.toHaveBeenCalled();
  });

  it("swallows a registration that the browser refuses", () => {
    register.mockRejectedValueOnce(new Error("insecure origin"));

    expect(() => registerServiceWorker()).not.toThrow();
  });
});

describe("unregisterServiceWorker", () => {
  it("removes the registration", async () => {
    const unregister = vi.fn(async () => undefined);
    getRegistration.mockResolvedValueOnce({ unregister });

    await unregisterServiceWorker();

    expect(unregister).toHaveBeenCalled();
  });

  it("swallows a browser that will not let go", async () => {
    getRegistration.mockRejectedValueOnce(new Error("nope"));

    await expect(unregisterServiceWorker()).resolves.toBeUndefined();
  });
});
