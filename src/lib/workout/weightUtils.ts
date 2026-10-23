/**
 * weightUtils.ts — barbell arithmetic.
 *
 * Pure functions, no React and no Supabase. Everything here answers one
 * question: *given this bar and these plates, what can actually be hung on the
 * sleeve?* A target that cannot be built exactly is a normal outcome, not an
 * error, so the API reports the shortfall instead of throwing or quietly
 * rounding.
 *
 * Design notes
 * ------------
 * - All arithmetic runs on a 0.25 kg integer grid (`QUARTER`) rather than raw
 *   kilograms. Plates of 1.25 and 0.5 kg are not exactly representable in binary
 *   floating point, and repeated `remaining -= 1.25` reliably drifts into
 *   values like `99.99999999999999` that then fail an `isExact` check on a
 *   perfectly loadable weight.
 * - `PlateInventory` counts **pairs**, so one `20: 2` means two 20 kg plates per
 *   side. `platesPerSide` is per side for the same reason: the answer to "what
 *   goes on the bar" is always half of what goes on the gym floor.
 * - The greedy pass loads the largest plates first, which minimises the number
 *   of plates on the sleeve. That is what a lifter expects to see and it keeps
 *   the bar balanced without a fiddly re-ordering step.
 */

/** Plate diameters available, smallest to largest. */
export type PlateKg = 0.5 | 1.25 | 2.5 | 5 | 10 | 15 | 20 | 25;

/**
 * Plates on hand, in **pairs per side**. A missing key means "none of that
 * size", which is not the same as zero being allowed to be added later.
 */
export type PlateInventory = Partial<Record<PlateKg, number>>;

export type BarType = "olympic" | "standard" | "ez" | "hex" | "custom";

/**
 * Bar weight in kg, by type.
 *
 * `custom` is 0 rather than 20 so it can pair with a dumbbell, kettlebell or
 * bodyweight "bar" without the caller having to remember to subtract anything.
 */
export const BAR_WEIGHTS: Record<BarType, number> = {
  olympic: 20,
  standard: 15,
  ez: 10,
  hex: 18,
  custom: 0,
};

export interface PlateCalculation {
  /** Plates for **one** side, heaviest first. */
  platesPerSide: { weight: PlateKg; count: number }[];
  /** Weight actually hanging on the bar, in kg. */
  totalWeight: number;
  /**
   * `target - totalWeight`, in kg.
   *
   * Positive means the inventory ran out and the target is out of reach;
   * negative means the empty bar is already heavier than the target, which is
   * the normal answer for a light dumbbell "barbell" movement.
   */
  remainder: number;
  isExact: boolean;
}

/** Discrete steps offered by the load steppers, in kg. */
export const QUICK_INCREMENTS_KG = [2.5, 5, 10, 15, 20] as const;

/**
 * Plates are walked heaviest-first: fewer plates on the sleeve, and the
 * balance is obvious at a glance.
 */
const PLATE_ORDER: readonly PlateKg[] = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

/** Integer units per kilogram. Keeps every sum exact. */
const QUARTER = 4;

function toQuarters(kg: number): number {
  return Math.round(kg * QUARTER);
}

function fromQuarters(quarts: number): number {
  return quarts / QUARTER;
}

/**
 * The heaviest-first loading that lands as close to the target as the inventory
 * allows, always from below.
 *
 * When the inventory cannot reach the target the result is still a real,
 * hangable bar — `remainder` is the weight that stayed on the rack and
 * `isExact` is false, so the caller can decide whether to suggest a different
 * load or to ask for more plates.
 */
export function calculatePlates(
  targetKg: number,
  barKg: number,
  inventory: PlateInventory,
): PlateCalculation {
  const targetQuarters = toQuarters(targetKg);
  const barQuarters = toQuarters(barKg);

  // Only the loaded half of the bar counts, and only when the target clears the
  // bar: asking for 15 kg on a 20 kg bar means no plates, not negative plates.
  let remaining = Math.max(0, Math.floor((targetQuarters - barQuarters) / 2));
  let loadedQuarters = 0;
  const platesPerSide: { weight: PlateKg; count: number }[] = [];

  for (const plate of PLATE_ORDER) {
    const available = inventory[plate] ?? 0;
    const plateQuarters = toQuarters(plate);
    if (available <= 0 || remaining < plateQuarters) continue;

    // Bounded by both what is left to load and what is on the rack.
    const count = Math.min(available, Math.floor(remaining / plateQuarters));
    if (count <= 0) continue;

    platesPerSide.push({ weight: plate, count });
    remaining -= count * plateQuarters;
    loadedQuarters += count * plateQuarters;
  }

  const totalQuarters = barQuarters + 2 * loadedQuarters;
  const remainderQuarters = targetQuarters - totalQuarters;

  return {
    platesPerSide,
    totalWeight: fromQuarters(totalQuarters),
    remainder: fromQuarters(remainderQuarters),
    isExact: remainderQuarters === 0,
  };
}

/**
 * Every per-side loading the inventory can actually produce, in quarter-kg.
 *
 * Bounded knapsack, run as a 0/1 update per plate instance. The gap matters:
 * with one pair of 25 kg plates on the rack, 10 kg per side is not a lighter
 * load, it is an impossible one, and a nearest-weight search that ignores that
 * will happily suggest it.
 */
function reachablePerSide(inventory: PlateInventory): number[] {
  const sizes = PLATE_ORDER.filter((plate) => (inventory[plate] ?? 0) > 0);
  const maxQuarters = sizes.reduce(
    (sum, plate) => sum + toQuarters(plate) * (inventory[plate] ?? 0),
    0,
  );
  if (maxQuarters === 0) return [0];

  const reachable = new Array<boolean>(maxQuarters + 1).fill(false);
  reachable[0] = true;

  // Descending over the per-side total is what makes each *instance* usable
  // once. Sweeping upwards would let a plate just placed be placed again on the
  // same pass, and the "inventory" would stop being a bound.
  for (const plate of sizes) {
    const plateQuarters = toQuarters(plate);
    const available = inventory[plate] ?? 0;
    for (let instance = 0; instance < available; instance++) {
      for (let q = maxQuarters; q >= plateQuarters; q--) {
        if (reachable[q - plateQuarters]) reachable[q] = true;
      }
    }
  }

  return reachable.flatMap((isReachable, q) => (isReachable ? [q] : []));
}

/**
 * The real weight nearest the target, whether that is above or below it.
 *
 * Both directions matter: a limited rack may overshoot the target before it can
 * reach it, and rounding down when rounding up was nearer would be wrong.
 * Ties resolve to the **lighter** load, because suggesting less weight is the
 * recoverable mistake.
 */
export function nearestLoadable(
  targetKg: number,
  barKg: number,
  inventory: PlateInventory,
): number {
  const targetQuarters = toQuarters(targetKg);
  const barQuarters = toQuarters(barKg);

  let bestQuarters = barQuarters; // The empty bar is always loadable.
  let bestDistance = Infinity;

  for (const perSide of reachablePerSide(inventory)) {
    const totalQuarters = barQuarters + 2 * perSide;
    const distance = Math.abs(totalQuarters - targetQuarters);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestQuarters = totalQuarters;
    }
  }

  return fromQuarters(bestQuarters);
}

/** Percentages of the working weight used for the warm-up ramp. */
export const WARMUP_RAMP = [0.4, 0.6, 0.8] as const;

/**
 * A warm-up ramp for a working weight, each step snapped to something the rack
 * can actually build.
 *
 * Two guarantees, both of which a raw percentage ramp breaks: no step is below
 * the empty bar (you cannot warm up on less than the bar you are about to lift),
 * and no step repeats, since the same weight twice in a row is not a ramp.
 */
export function warmupSets(
  workingWeightKg: number,
  barKg: number,
  inventory: PlateInventory,
): number[] {
  const floorWeight = Math.max(barKg, 0);
  const seen = new Set<number>();
  const sets: number[] = [];

  for (const fraction of WARMUP_RAMP) {
    const loadable = nearestLoadable(workingWeightKg * fraction, barKg, inventory);
    const weight = Math.max(loadable, floorWeight);
    if (seen.has(weight)) continue;
    seen.add(weight);
    sets.push(weight);
  }

  return sets;
}

/**
 * The step increments offered by the load steppers, in kg.
 *
 * A fresh array each call: it is handed to inputs and menu items that are
 * liable to sort or splice it in place, and a shared constant would then change
 * behaviour somewhere else.
 */
export function quickIncrements(): number[] {
  return [...QUICK_INCREMENTS_KG];
}
