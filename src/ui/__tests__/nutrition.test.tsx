/**
 * Shared nutrition presentation logic.
 *
 * Three branches - measured, derived, unmeasurable - and getting the third
 * wrong means reporting a zero intake as a real one.
 */

import type { MealPlan } from '@/domain/planner/types';
import type { ResolvedNutrient } from '@/domain/nutrition/types';
import { achievedForNutrient, categoryLabel, metCount } from '@/ui/data/nutrition';

const nutrient = (over: Partial<ResolvedNutrient>): ResolvedNutrient =>
  ({
    nutrient_id: 'protein_g',
    nutrient_name: 'Protein',
    category: 'macronutrient',
    unit: 'g',
    basis: 'RDA',
    value: 56,
    ul_value: null,
    pct_of_ul: null,
    over_ul: false,
    approaching_ul: false,
    rules_applied: [],
    flags: [],
    lowest_confidence: null,
    source_ids: [],
    notes: null,
    ...over,
  }) as ResolvedNutrient;

const plan = (nutrition: Record<string, number>) =>
  ({ averageNutrition: nutrition }) as unknown as MealPlan;

describe('achievedForNutrient', () => {
  it('reads a measured nutrient straight from the plan', () => {
    expect(achievedForNutrient(plan({ protein_g: 71 }), nutrient({}))).toBe(71);
  });

  it('derives fat as a percentage of energy', () => {
    // 100 g fat x 9 kcal/g = 900 kcal of 1800 = 50%.
    const result = achievedForNutrient(
      plan({ fat_g: 100, energy_kcal: 1800 }),
      nutrient({ nutrient_id: 'fat_pct_energy_max' }),
    );

    expect(result).toBeCloseTo(50);
  });

  it('returns null for fat percentage when energy is zero, not Infinity', () => {
    const result = achievedForNutrient(
      plan({ fat_g: 100, energy_kcal: 0 }),
      nutrient({ nutrient_id: 'fat_pct_energy_max' }),
    );

    expect(result).toBeNull();
  });

  it('returns null for a nutrient the recipe data cannot measure', () => {
    expect(achievedForNutrient(plan({}), nutrient({ nutrient_id: 'selenium_ug' }))).toBeNull();
  });

  it('returns null when there is no plan at all', () => {
    expect(achievedForNutrient(null, nutrient({}))).toBeNull();
  });
});

describe('metCount', () => {
  it('counts only targets the plan actually reaches', () => {
    const count = metCount(plan({ protein_g: 71, fiber_g: 10 }), [
      nutrient({ nutrient_id: 'protein_g', value: 56 }),
      nutrient({ nutrient_id: 'fiber_g', value: 38 }),
    ]);

    expect(count).toBe(1);
  });

  it('does not count an unmeasurable target as met', () => {
    expect(metCount(plan({}), [nutrient({ nutrient_id: 'selenium_ug', value: 55 })])).toBe(0);
  });

  it('counts a target hit exactly', () => {
    expect(metCount(plan({ protein_g: 56 }), [nutrient({ value: 56 })])).toBe(1);
  });
});

describe('categoryLabel', () => {
  it('labels a known category', () => {
    expect(categoryLabel('amino_acid')).toBe('Indispensable amino acids');
  });

  it('falls back to the raw id rather than rendering undefined', () => {
    expect(categoryLabel('unheard_of')).toBe('unheard_of');
  });
});
