/**
 * Types for the pantry depletion model.
 *
 * The grocery list is not a static copy of the plan's ingredients. It is the
 * difference between what a cycle needs and what the pantry still holds, which
 * means it changes shape from cycle to cycle even though the meals never do.
 */

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  aisle: string;
  /** Estimated supermarket price, GBP per kilogram. */
  price_per_kg: number;
  /** Days the item keeps: after opening for perishables, from purchase for dry goods. */
  shelf_life_days: number;
  /** Smallest realistic purchase unit, in grams. */
  pack_g: number;
  /** Bought once and topped up rarely - belongs in the one-time setup list. */
  staple: boolean;
  /** Grams in "one" of this item, when a recipe counts rather than weighs. */
  unit_g: number;
}

/** One purchase sitting in the pantry. */
export interface PantryLot {
  ingredientId: string;
  /** Cycle index the lot was bought in. */
  purchasedAtCycle: number;
  /** Grams remaining in this lot. */
  grams: number;
  /** Day index the lot stops being usable. */
  expiresOnDay: number;
}

/** One row on a cycle's grocery list. */
export interface GroceryLine {
  ingredientId: string;
  name: string;
  aisle: string;
  /** Grams the cycle's meals need. */
  requiredGrams: number;
  /** Grams already in the pantry and still good. */
  availableGrams: number;
  /** Whole packs to buy. */
  packsToBuy: number;
  /** Grams those packs contain. */
  gramsToBuy: number;
  /** Estimated cost of the purchase. */
  cost: number;
  /** True when existing stock covered part of the requirement. */
  partiallyCovered: boolean;
}

/** What one cycle of the plan demands and costs. */
export interface CycleProjection {
  cycleIndex: number;
  /** Day index the cycle begins. */
  startDay: number;
  lines: GroceryLine[];
  totalCost: number;
  /** Ingredients fully covered by the pantry, so absent from the list. */
  coveredByPantry: string[];
  /** Grams discarded to expiry at the start of this cycle. */
  expiredGrams: number;
}

export interface PantrySimulation {
  cycles: CycleProjection[];
  /** Lots still held after the final simulated cycle. */
  finalPantry: PantryLot[];
  /**
   * Bought once at the start: equipment, and long-life staples like spices.
   * These are separated so the first shop is not mistaken for a weekly one.
   */
  oneTimeItems: GroceryLine[];
  equipment: string[];
}
