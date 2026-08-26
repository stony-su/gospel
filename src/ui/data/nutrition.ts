/**
 * Shared nutrition presentation logic.
 *
 * The nutrition index and each category page both need to know what a plan
 * delivers for a nutrient, and both need the same category labels. Two copies
 * of `achievedForNutrient` would drift, and the drift would show as a bar
 * reading differently on two screens that claim to show the same thing.
 */

import type { MealPlan } from '@/domain/planner/types';
import type { ResolvedNutrient } from '@/domain/nutrition/types';
import { MEASURED_NUTRIENTS } from '@/domain/planner/coverage';

export const CATEGORY_LABELS: Record<string, string> = {
  energy: 'Energy',
  macronutrient: 'Macronutrients',
  water: 'Water',
  amino_acid: 'Indispensable amino acids',
  vitamin: 'Vitamins',
  mineral: 'Minerals',
};

/** A category's display label, falling back to its raw id. */
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * What a plan delivers for one nutrient, or null when the recipe data cannot
 * measure it - which is true of most of the 48.
 *
 * Fat-as-a-percentage-of-energy is the one derived case: the corpus gives
 * grams of fat and total energy, so the percentage is computable even though
 * it is not itself a measured field.
 */
export function achievedForNutrient(
  plan: MealPlan | null,
  nutrient: ResolvedNutrient,
): number | null {
  if (!plan) return null;

  if ((MEASURED_NUTRIENTS as readonly string[]).includes(nutrient.nutrient_id)) {
    return plan.averageNutrition[nutrient.nutrient_id] ?? null;
  }

  if (
    nutrient.nutrient_id === 'fat_pct_energy_min' ||
    nutrient.nutrient_id === 'fat_pct_energy_max'
  ) {
    const energy = plan.averageNutrition.energy_kcal ?? 0;
    const fat = plan.averageNutrition.fat_g ?? 0;
    return energy > 0 ? ((fat * 9) / energy) * 100 : null;
  }

  return null;
}

/** How many of a group's targets the plan actually meets. */
export function metCount(
  plan: MealPlan | null,
  nutrients: ResolvedNutrient[],
): number {
  return nutrients.filter((nutrient) => {
    const achieved = achievedForNutrient(plan, nutrient);
    return achieved !== null && achieved >= nutrient.value;
  }).length;
}
