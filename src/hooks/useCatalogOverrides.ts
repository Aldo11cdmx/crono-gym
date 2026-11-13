import { useEffect, useState } from "react";
import { subscribeCatalogOverrides } from "@/lib/catalog/customExercises";

/**
 * A counter that changes whenever a coach's overrides change.
 *
 * Components that render catalog rows keep them in state, so they need a reason
 * to re-resolve. The version is that reason: it changes in the tab that wrote
 * and in every other tab, and it is cheap to compare.
 */
export function useCatalogOverridesVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(
    () => subscribeCatalogOverrides(() => setVersion((current) => current + 1)),
    [],
  );
  return version;
}