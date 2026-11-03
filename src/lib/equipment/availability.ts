/**
 * availability.ts — contrato tri-state de disponibilidad de equipamiento.
 *
 * Dominio puro: sin React, Supabase ni IndexedDB. Reutilizable por los motores
 * de sustitución y por el selector de ejercicios sin acoplarlos a datos estáticos.
 */

export type EquipmentAvailability = "available" | "unavailable" | "unknown";

export interface EquipmentScope {
  /** Conjunto de tags considerados por esta fuente. */
  readonly tags: ReadonlySet<string>;
  /** true si la fuente declara inventario completo y aplicable. */
  readonly complete: boolean;
}

/**
 * Resuelve la disponibilidad de un tag dentro de una única fuente.
 *
 * - pertenencia confirmada → available
 * - ausencia en fuente completa → unavailable
 * - ausencia en fuente parcial → unknown
 */
export function resolveAvailability(
  tag: string,
  scope: EquipmentScope,
): EquipmentAvailability {
  if (scope.tags.has(tag)) return "available";
  if (scope.complete) return "unavailable";
  return "unknown";
}

/**
 * Resuelve la disponibilidad combinando varias fuentes.
 *
 * Fuentes contradictorias (available vs unavailable) → unknown.
 * Si alguna fuente confirma disponibilidad y ninguna la contradice → available.
 * Si todas las fuentes completas confirman ausencia → unavailable.
 * En cualquier otro caso → unknown.
 */
export function resolveAvailabilityFromScopes(
  tag: string,
  scopes: readonly EquipmentScope[],
): EquipmentAvailability {
  if (scopes.length === 0) return "unknown";

  const results = scopes.map((scope) => resolveAvailability(tag, scope));
  const hasAvailable = results.includes("available");
  const hasUnavailable = results.includes("unavailable");

  if (hasAvailable && hasUnavailable) return "unknown";
  if (hasAvailable) return "available";
  if (results.every((result) => result === "unavailable")) return "unavailable";
  return "unknown";
}

/**
 * Adaptador conservador hacia el contrato booleano legacy.
 *
 * Pierde información (unknown → false) y solo debe usarse en consumidores
 * antiguos; el estado tri-state interno no se modifica.
 */
export function toLegacyBoolean(value: EquipmentAvailability): boolean {
  return value === "available";
}
