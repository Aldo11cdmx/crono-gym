/**
 * useMediaQuery.ts — tracks an arbitrary CSS media query.
 *
 * Returns `false` during SSR and in browsers without `matchMedia`, which is
 * the graceful direction for layout queries: the component falls back to its
 * default spacing until the client hydrates.
 */

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const list = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(list.matches);

    if (typeof list.addEventListener === "function") {
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    }

    list.addListener(onChange);
    return () => list.removeListener(onChange);
  }, [query]);

  return matches;
}
