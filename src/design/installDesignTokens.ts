/**
 * Installs the design system's generated CSS into the document.
 *
 * Imported by `main.tsx` for its side effect; it exports a function only so that a test
 * can install into a stub and read the result back.
 *
 * Why this file exists at all
 * ---------------------------
 * `tokens.ts` projects itself into two things: a set of custom properties
 * ({@link cssVars}) and the global interactive-state rules ({@link stateRules}). Neither
 * had a way to reach the browser -- `cssVars()` had no caller outside this project's own
 * tests, so every `var(--cronos-*)` written in `index.css` was running on its fallback and
 * the whole projection looked alive while being dead weight.
 *
 * Both are installed from here rather than written into the stylesheet, for one reason: they
 * are generated from the token values, so a hand-written copy in `index.css` could drift
 * from them. CSS cannot read a TypeScript object, and the alternative -- restating every
 * value as a literal -- is the thing this change exists to stop.
 *
 * The custom properties are installed alongside the rules even though `stateRules()` does
 * not read them. A custom property is what lets a component reach a token it did not
 * import, and a stylesheet rule written in terms of `var(--cronos-*)` becomes themeable at
 * runtime. What it must not do is be the only place a value lives.
 */

import { cssVars, stateRules } from "./tokens";

/** Marks the node so a re-install replaces it instead of stacking a second copy. */
const MARKER = "data-cronos-tokens";

/**
 * Returns the generated CSS. Exported so the tests can assert on it without a DOM.
 */
export function designTokensCss(): string {
  return `${cssVars()}\n${stateRules()}`;
}

/**
 * Appends the generated CSS to `<head>`, or replaces it if it is already there.
 *
 * Deliberately *not* a React effect. An effect runs after the first commit, which leaves a
 * window where the document is painted without the focus ring and without the custom
 * properties `index.css` reads -- so a stylesheet rule could resolve to its fallback and
 * then change colour a frame later. Global CSS belongs before the paint, which for a Vite
 * app means module scope.
 *
 * The caller is expected to have a document. The auto-install below is not, and that is
 * the whole reason it checks: `tokens.test.ts` imports this module to assert on its output
 * and runs under Vitest's default node environment, where `document` is not defined and an
 * unguarded call takes the whole suite down before a single assertion runs.
 */
export function installDesignTokens(doc: Document): void {
  const existing = doc.head.querySelector<HTMLStyleElement>(`style[${MARKER}]`);

  if (existing) {
    existing.textContent = designTokensCss();
    return;
  }

  const style = doc.createElement("style");
  style.setAttribute(MARKER, "");
  style.textContent = designTokensCss();
  doc.head.appendChild(style);
}

if (typeof document !== "undefined") {
  installDesignTokens(document);
}
