/**
 * useDebouncedValue.ts — devuelve el valor tras ~150 ms sin pulsaciones.
 *
 * Útil para diferir una filtración costosa sin perder la respuesta del input.
 * El primer render ya lleva el valor (no se retrasa la muestra inicial).
 */

import { useEffect, useRef, useState } from "react";

export function useDebouncedValue(value: string, delayMs = 150): string {
  const [debounced, setDebounced] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
