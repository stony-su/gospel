/**
 * Types for the meal planner.
 */

import type { DietType } from '@/domain/nutrition/types';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Cycle lengths the product offers, in days. */
export type CycleLength = 1 | 7 | 14 | 21 | 28;

export const CYCLE_LABELS: Record<CycleLength, string> = {
  1: 'Daily',
  7: 'Weekly',
  14: 'Bi-weekly',
  21: 'Tri-weekly',
  28: 'Monthly',
};

export interface RecipeIngredient {
  id: string;
  label: string;
  quantity: number | null;
  quantity_text: string;
  grams: number;
}

/** Nutrition per serving, as published in the recipe dataset. */
export interface RecipeNutrition {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  saturated_fat_g: number;
  cholesterol_mg: number;
  sodium_mg: number;
  carbohydrate_g: number;
  fiber_g: number;
  sugar_g: number;
}

/**
 * A dish photograph and the credit it is used under.
 *
 * Nearly every one of these is CC BY-SA or CC BY, so naming the author and
 * the licence is a condition of using it, not a courtesy. Carrying the credit
 * on the recipe rather than in a separate table is what makes it impossible
 * to ship a photograph whose attribution got lost.
 */
export interface RecipeImage {
  /** Bundled asset filename; resolve it through `src/data/recipeImages.ts`. */
  file: string;
  /** Small square crop, for lists. */
  thumb: string;
  author: string;
  license: string;
  license_url: string;
  /** The Wikimedia Commons file page. */
  source_url: string;
}

/** Where a recipe's ingredients and method came from. */
export interface MethodSource {
  kind: 'wikibooks' | 'authored';
  url: string | null;
  license: string | null;
}

export interface Recipe {
  id: number;
  /** Stable across rebuilds; the id is derived from it. */
  slug: string;
  name: string;
  /** One sentence from the dish's Wikipedia article. */
  description: string;
  /**
   * Required, not optional. Every recipe in the library has a photograph and
   * the build fails if one does not, so a call site never has to handle the
   * absence - and a fixture that omits it is a fixture that has drifted from
   * what the data actually guarantees.
   *
   * Display only: nothing in the planner, resolver or pantry ledger reads it.
   */
  image: RecipeImage;
  minutes: number;
  prep_minutes: number;
  servings: number;
  cuisine: string;
  slot: MealSlot;
  difficulty: number;
  equipment: string[];
  cost_per_serving: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  method_source: MethodSource;
  /** The dish's Wikipedia article, where the description came from. */
  reference_url: string | null;
  diet: Record<DietType, boolean>;
  /**
   * Per serving, computed from FoodData Central panels over the ingredient
   * weights - not published by any source, because no source publishes it.
   */
  nutrition: RecipeNutrition;
  /**
   * Share of the recipe's mass that carried an FDC energy value. Below 1 the
   * figures above understate, and by roughly this much.
   */
  nutrition_coverage: number;
}

export interface PlanPreferences {
  /** Preferred cuisines. Empty means no preference. */
  cuisines: string[];
  /** Highest difficulty the user will cook, 1-5. */
  maxDifficulty: number;
  /** Longest a single meal may take, in minutes. */
  maxMinutes: number;
  /** Spend ceiling per week, in GBP. */
  weeklyBudget: number;
  /** Which meals the plan should fill each day. */
  mealsPerDay: MealSlot[];
}

export interface PlannedMeal {
  dayIndex: number;
  slot: MealSlot;
  recipeId: number;
  /** Portions eaten, scaled so the day lands on its energy target. */
  servings: number;
}

export interface MealPlan {
  cycleDays: CycleLength;
  meals: PlannedMeal[];
  /** Mean daily intake across the cycle, keyed by workbook nutrient id. */
  averageNutrition: Record<string, number>;
  /** Estimated ingredient cost for one full cycle. */
  costPerCycle: number;
  /** Same cost expressed weekly, for comparison against the budget. */
  costPerWeek: number;
  /** Objective value; lower is better. Useful for comparing regenerations. */
  score: number;
  /** Anything the user should know: thin recipe pool, budget overrun, etc. */
  warnings: string[];
  /** The seed used, so a plan can be reproduced exactly. */
  seed: number;
}
