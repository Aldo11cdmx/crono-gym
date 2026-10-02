/**
 * useReducedMotion.ts — tracks the `prefers-reduced-motion` media query.
 *
 * A hook rather than a CSS-only solution because the rank map's promotion
 * animation has a stateful part: the "¡Pecho subió a Oro!" notice must not appear
 * at all when the user has asked for reduced motion, and `prefers-reduced-motion`
 * in a stylesheet cannot remove an element, only its transitions.
 *
 * Returns `false` during SSR and in very old browsers, which means animations
 * play -- the graceful direction, since a missing media query means the browser
 * never advertised the preference.
 */

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const list = window.matchMedia(QUERY);
    setReduced(list.matches);

    // Older Safari only has the deprecated listener API; both are supported so
    // the preference is live without a reload on either.
    if (typeof list.addEventListener === "function") {
      const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    }

    if (typeof list.addListener === "function") {
      const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
      list.addListener(onChange);
      return () => list.removeListener(onChange);
    }
    return undefined;
  }, []);

  return reduced;
}