/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { hasValidConsent, CONSENT_VERSION } from "../consent";

describe("consent module", () => {
  it("defines consent version", () => {
    expect(CONSENT_VERSION).toBe(1);
  });

  it("honours an explicit value, even in DEV", () => {
    expect(hasValidConsent({ shareAiContext: true }, true)).toBe(true);
    expect(hasValidConsent({ shareAiContext: false }, true)).toBe(false);
  });

  it("falls back to isDev when shareAiContext is absent", () => {
    expect(hasValidConsent(undefined, true)).toBe(true);
    expect(hasValidConsent({}, true)).toBe(true);
    expect(hasValidConsent(undefined, false)).toBe(false);
    expect(hasValidConsent({}, false)).toBe(false);
  });

  it("never grants consent in production without an explicit row", () => {
    expect(hasValidConsent({ shareAiContext: true }, false)).toBe(true);
    expect(hasValidConsent({ shareAiContext: false }, false)).toBe(false);
    expect(hasValidConsent(undefined, false)).toBe(false);
  });
});
