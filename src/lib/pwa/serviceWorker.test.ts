/**
 * serviceWorker.test.ts — the rules the shell follows.
 *
 * The worker is a plain file the browser installs without a build step, so
 * its behaviour cannot be exercised from a test: a service worker only runs
 * inside a service worker. What can be checked is the *policy* the file
 * states, and the policy is the whole risk of the file: a worker that serves a
 * stale shell, or that caches somebody else's responses, is worse than no
 * worker at all.
 *
 * The assertions are therefore about the rules, read off the source.
 */

import { describe, expect, it } from "vitest";
// Imported as source text rather than read off disk with `node:fs`: the
// project has no `@types/node` and adding one for a single guard is not worth
// it, and Vite's `?raw` needs no extra dependency or config.
import swSource from "../../../public/sw.js?raw";

describe("the service worker", () => {
  it("keeps a versioned cache, and deletes the old ones when it takes over", () => {
    expect(swSource).toMatch(/const CACHE = "cronos-shell-v\d+"/);
    expect(swSource).toMatch(/\.keys\(\)/);
    expect(swSource).toMatch(/caches\.delete\(key\)/);
  });

  it("asks the network first for the shell, so a new deployment arrives at once", () => {
    const navigation = swSource.slice(swSource.indexOf('request.mode === "navigate"'));
    const fetchAt = navigation.indexOf("fetch(request)");
    const cacheAt = navigation.indexOf("caches.match");

    expect(fetchAt).toBeGreaterThan(-1);
    expect(cacheAt).toBeGreaterThan(fetchAt);
  });

  it("falls back to the stored shell when there is no network", () => {
    expect(swSource).toMatch(/catch\(\(\) => caches\.match\("\/index\.html"\)\)/);
  });

  it("leaves other origins alone", () => {
    expect(swSource).toMatch(/url\.origin !== self\.location\.origin/);
  });

  it("only stores what it can serve again", () => {
    // The assets are cache-first because their names carry a hash, and only a
    // response of the same origin is worth keeping.
    expect(swSource).toMatch(/response\.type === "basic"/);
  });

  it("does not touch anything that is not a GET", () => {
    expect(swSource).toMatch(/request\.method !== "GET"/);
  });
});
