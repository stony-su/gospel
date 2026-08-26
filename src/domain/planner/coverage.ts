/**
 * What the recipe data can and cannot say about nutrition.
 *
 * The workbook resolves 48 daily targets. The recipe dataset publishes nine
 * nutrients per serving, and only six of those correspond to a target. The
 * other 42 targets need per-ingredient data from FoodData Central, which is a
 * backend concern.
 *
 * The app never invents the missing numbers. It shows the computed target and
 * marks the intake side as awaiting enrichment, so nothing on screen is a
 * guess dressed as a measurement.
 */

import type { RecipeNutrition } from './types';

/**
 * Targets no source can measure, and which are therefore not shown.
 *
 * FoodData Central does not carry these nutrients at all - not sparsely, but
 * absent from its schema, on every one of the ~1,100 ingredient panels
 * fetched. The workbook still resolves a target for each, and the resolver
 * still computes it; they are filtered at the point of display rather than
 * deleted, so the derivation stays intact and restoring one is a single-line
 * change here.
 *
 * Biotin is a vitamin, the other four are minerals. They are the complete set
 * of workbook targets with no possible intake figure.
 */
export const UNMEASURABLE_NUTRIENTS = [
  'iodine_ug',
  'chloride_mg',
  'chromium_ug',
  'molybdenum_ug',
  'biotin_ug',
] as const;

/** True when no data source can ever supply an intake for this nutrient. */
export function isUnmeasurable(nutrientId: string): boolean {
  return (UNMEASURABLE_NUTRIENTS as readonly string[]).includes(nutrientId);
}

/** Nutrient ids the recipe dataset can measure directly. */
export const MEASURED_NUTRIENTS = [
  'energy_kcal',
  'protein_g',
  'carbohydrate_g',
  'fiber_g',
  'sodium_mg',
] as const;

export type MeasuredNutrient = (typeof MEASURED_NUTRIENTS)[number];

/** Read a measured nutrient off a recipe's per-serving nutrition. */
export function measure(
  nutrition: RecipeNutrition,
  nutrientId: string,
): number | null {
  switch (nutrientId) {
    case 'energy_kcal':
      return nutrition.energy_kcal;
    case 'protein_g':
      return nutrition.protein_g;
    case 'carbohydrate_g':
      return nutrition.carbohydrate_g;
    case 'fiber_g':
      return nutrition.fiber_g;
    case 'sodium_mg':
      return nutrition.sodium_mg;
    default:
      return null;
  }
}

/**
 * Fat is published in grams but targeted as a share of energy, so it is
 * handled separately from the direct mappings above.
 */
export function fatPercentOfEnergy(nutrition: RecipeNutrition): number | null {
  if (!nutrition.energy_kcal) return null;
  return ((nutrition.fat_g * 9) / nutrition.energy_kcal) * 100;
}

/** Nutrients the data reports but the workbook sets no target for. */
export const UNTARGETED_MEASURES = [
  { key: 'saturated_fat_g', label: 'Saturated fat', unit: 'g' },
  { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg' },
  { key: 'sugar_g', label: 'Sugars', unit: 'g' },
] as const;

export type NutrientCoverage = 'measured' | 'derived' | 'awaiting_fdc';

/** How the app can currently report on a given nutrient. */
export function coverageFor(nutrientId: string): NutrientCoverage {
  if ((MEASURED_NUTRIENTS as readonly string[]).includes(nutrientId)) {
    return 'measured';
  }
  if (nutrientId === 'fat_pct_energy_min' || nutrientId === 'fat_pct_energy_max') {
    return 'derived';
  }
  return 'awaiting_fdc';
}

export const COVERAGE_LABEL: Record<NutrientCoverage, string> = {
  measured: 'Measured',
  derived: 'Derived',
  awaiting_fdc: 'Awaiting FDC',
};
