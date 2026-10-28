/**
 * haptics.ts — feedback háptico nativo para el gym.
 *
 * `navigator.vibrate` no está garantizado en todos los navegadores (Safari iOS lo
 * soporta desde 17.4; Chrome Android desde hace años), así que cada función se guarda
 * tras una comprobación de soporte y nunca lanza. Un entrenamiento con guantes o con el
 * teléfono en el bolsillo no debe romperse por una vibración que no se puede emitir.
 */

export function hapticLight(): void {
  vibrate([10]);
}

export function hapticSuccess(): void {
  vibrate([10, 30, 20]);
}

export function hapticHeavy(): void {
  vibrate([20, 40, 20, 40, 60]);
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Sin permiso o dispositivo sin motor: no es un error de la app.
  }
}
