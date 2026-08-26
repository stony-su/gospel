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

export interface Recipe {
  id: number;
  name: string;
  description: string;
  minutes: number;
  prep_minutes: number;
  servings: number;
  rating: number;
  reviews: number;
  cuisine: string;
  slot: MealSlot;
  difficulty: number;
  equipment: string[];
  cost_per_serving: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  diet: Record<DietType, boolean>;
  nutrition: RecipeNutrition;
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
