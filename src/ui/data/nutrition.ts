/**
 * Shared nutrition presentation logic.
 *
 * The nutrition index and each category page both need to know what a plan
 * delivers for a nutrient, and both need the same category labels. Two copies
 * of `achievedForNutrient` would drift, and the drift would show as a bar
 * reading differently on two screens that claim to show the same thing.
 */

import type { IntakeResult } from '@/domain/nutrition/intake';
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
 * What a plan delivers for one nutrient, or null when nothing can measure it.
 *
 * Two sources, in order. The recipe corpus publishes nine nutrients per
 * serving and wins for the five that map to a target - those figures are what
 * the app has always shown and they stay put, even though the ingredient sum
 * would give a slightly different answer for the same nutrient.
 *
 * Everything else comes from the FDC ingredient panels. That total can
 * understate where FDC lacks data for some of a recipe's ingredients; see
 * intake.ts, and `intake.coverage` for how much of the mass was actually
 * measured.
 *
 * Fat-as-a-percentage-of-energy stays derived from the corpus: it is computed
 * from two corpus figures, so taking it from anywhere else would make it
 * disagree with the energy shown beside it.
 */
export function achievedForNutrient(
  plan: MealPlan | null,
  nutrient: ResolvedNutrient,
  intake?: IntakeResult | null,
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

  return intake?.perServing[nutrient.nutrient_id] ?? null;
}

/** How many of a group's targets the plan actually meets. */
export function metCount(
  plan: MealPlan | null,
  nutrients: ResolvedNutrient[],
  intake?: IntakeResult | null,
): number {
  return nutrients.filter((nutrient) => {
    const achieved = achievedForNutrient(plan, nutrient, intake);
    return achieved !== null && achieved >= nutrient.value;
  }).length;
}
