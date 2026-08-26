/**
 * The adaptive grocery list.
 *
 * A Gospel plan repeats: the same meals every cycle, forever. The shopping
 * does not repeat, because most ingredients arrive in packs bigger than one
 * cycle uses. A 300 g tub of sour cream against 60 g a week is covered for
 * weeks two and three and reappears in week four - or sooner, if its 21-day
 * life runs out before the tub does.
 *
 * This module simulates that forward: it walks the cycles, ages the pantry,
 * throws away what has expired, and reports what each cycle actually needs to
 * buy. Both quantity and time have to be tracked, since either can be the
 * binding constraint.
 */

import type {
  CycleProjection,
  GroceryLine,
  Ingredient,
  PantryLot,
  PantrySimulation,
} from './types';

export interface SimulatePantryInput {
  /** Grams of each ingredient one full cycle of the plan consumes. */
  consumptionPerCycle: Map<string, number>;
  ingredients: Record<string, Ingredient>;
  /** Days in one cycle: 1, 7, 14, 21 or 28. */
  cycleDays: number;
  /** How many cycles to project. */
  cycleCount: number;
  /** Equipment the plan's recipes call for. Deduplicated into a one-time list. */
  equipment?: string[];
  /** Lots already in the pantry when the simulation starts. */
  initialPantry?: PantryLot[];
}

/** Cost of a purchase, in GBP. */
function costOf(grams: number, ingredient: Ingredient): number {
  return (grams / 1000) * ingredient.price_per_kg;
}

/**
 * Build the one-time setup list.
 *
 * Staples - salt, spices, oil, flour - keep for a year or more and are bought
 * once rather than weekly. Showing them on every cycle's list would bury the
 * handful of items that genuinely change.
 */
function buildOneTimeList(
  consumptionPerCycle: Map<string, number>,
  ingredients: Record<string, Ingredient>,
): GroceryLine[] {
  const lines: GroceryLine[] = [];

  for (const [ingredientId, grams] of consumptionPerCycle) {
    const ingredient = ingredients[ingredientId];
    if (!ingredient || !ingredient.staple) continue;

    const packsToBuy = Math.max(1, Math.ceil(grams / ingredient.pack_g));
    const gramsToBuy = packsToBuy * ingredient.pack_g;

    lines.push({
      ingredientId,
      name: ingredient.name,
      aisle: ingredient.aisle,
      requiredGrams: grams,
      availableGrams: 0,
      packsToBuy,
      gramsToBuy,
      cost: costOf(gramsToBuy, ingredient),
      partiallyCovered: false,
    });
  }

  return lines.sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name));
}

export function simulatePantry(input: SimulatePantryInput): PantrySimulation {
  const {
    consumptionPerCycle,
    ingredients,
    cycleDays,
    cycleCount,
    equipment = [],
    initialPantry = [],
  } = input;

  const pantry: PantryLot[] = initialPantry.map((lot) => ({ ...lot }));
  const cycles: CycleProjection[] = [];

  const oneTimeItems = buildOneTimeList(consumptionPerCycle, ingredients);
  const stapleIds = new Set(oneTimeItems.map((item) => item.ingredientId));

  // Staples are stocked by the one-time shop, so they start in the pantry and
  // never reach a weekly list.
  for (const item of oneTimeItems) {
    const ingredient = ingredients[item.ingredientId];
    pantry.push({
      ingredientId: item.ingredientId,
      purchasedAtCycle: 0,
      grams: item.gramsToBuy,
      expiresOnDay: ingredient.shelf_life_days,
    });
  }

  for (let cycleIndex = 0; cycleIndex < cycleCount; cycleIndex += 1) {
    const startDay = cycleIndex * cycleDays;

    // Age the pantry. A lot is gone the day its life is up.
    let expiredGrams = 0;
    for (let index = pantry.length - 1; index >= 0; index -= 1) {
      if (pantry[index].expiresOnDay <= startDay) {
        expiredGrams += pantry[index].grams;
        pantry.splice(index, 1);
      }
    }

    const lines: GroceryLine[] = [];
    const coveredByPantry: string[] = [];

    for (const [ingredientId, requiredGrams] of consumptionPerCycle) {
      const ingredient = ingredients[ingredientId];
      if (!ingredient) continue;

      const lots = pantry.filter((lot) => lot.ingredientId === ingredientId);
      const availableGrams = lots.reduce((total, lot) => total + lot.grams, 0);

      if (availableGrams >= requiredGrams) {
        if (!stapleIds.has(ingredientId)) coveredByPantry.push(ingredientId);
      } else {
        const shortfall = requiredGrams - availableGrams;
        const packsToBuy = Math.ceil(shortfall / ingredient.pack_g);
        const gramsToBuy = packsToBuy * ingredient.pack_g;

        pantry.push({
          ingredientId,
          purchasedAtCycle: cycleIndex,
          grams: gramsToBuy,
          expiresOnDay: startDay + ingredient.shelf_life_days,
        });

        // A staple that runs out mid-plan is restocked quietly rather than
        // reappearing as a weekly line.
        if (!stapleIds.has(ingredientId)) {
          lines.push({
            ingredientId,
            name: ingredient.name,
            aisle: ingredient.aisle,
            requiredGrams,
            availableGrams,
            packsToBuy,
            gramsToBuy,
            cost: costOf(gramsToBuy, ingredient),
            partiallyCovered: availableGrams > 0,
          });
        }
      }

      // Consume oldest stock first, so nothing sits and spoils behind newer lots.
      let remaining = requiredGrams;
      const ordered = pantry
        .filter((lot) => lot.ingredientId === ingredientId)
        .sort((a, b) => a.expiresOnDay - b.expiresOnDay);

      for (const lot of ordered) {
        if (remaining <= 0) break;
        const taken = Math.min(lot.grams, remaining);
        lot.grams -= taken;
        remaining -= taken;
      }

      for (let index = pantry.length - 1; index >= 0; index -= 1) {
        if (pantry[index].grams <= 1e-9) pantry.splice(index, 1);
      }
    }

    lines.sort(
      (a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name),
    );

    cycles.push({
      cycleIndex,
      startDay,
      lines,
      totalCost: lines.reduce((total, line) => total + line.cost, 0),
      coveredByPantry,
      expiredGrams,
    });
  }

  return {
    cycles,
    finalPantry: pantry,
    oneTimeItems,
    equipment: [...new Set(equipment)],
  };
}
