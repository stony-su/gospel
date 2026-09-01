/**
 * Replacing one meal in a finished plan.
 *
 * The plan is solved once and then repeats, which is the point of it - but a
 * solver optimising forty-eight nutrient targets will sooner or later put
 * something on a Tuesday that the reader simply does not want to cook. This is
 * the escape hatch: swap that one meal, keep the rest.
 *
 * Ranking is done with the planner's own objective, not a second one written
 * for the purpose. `scoreDay` is what chose the meal in the first place, so
 * ranking replacements by the same penalty means the list agrees with the plan
 * rather than quietly disagreeing with it: the top candidate here is the one
 * the solver would have picked if it had looked harder.
 *
 * Only the affected day is rescored. A swap changes one day's totals, one
 * day's portion scaling and the cycle's averages; every other day is untouched
 * arithmetic, and rebuilding the whole plan would throw away the six other days
 * the reader was happy with.
 */

import type { DietType, ResolvedTargets } from '@/domain/nutrition/types';
import {
  EMPTY_TOTALS,
  addRecipe,
  eligibleRecipes,
  scoreDay,
  servingScaleFor,
  type DayTotals,
} from './planner';
import type { MealPlan, MealSlot, PlanPreferences, Recipe } from './types';

/**
 * The axes of the radar on a candidate card.
 *
 * These are exactly the nutrients `scoreDay` weighs, plus energy and fat -
 * which is to say the axes are the objective, drawn. A reader comparing two
 * cards is looking at the same numbers the ranking used.
 */
export const SHAPE_NUTRIENTS = [
  { id: 'energy_kcal', label: 'energy' },
  { id: 'protein_g', label: 'protein' },
  { id: 'carbohydrate_g', label: 'carbs' },
  { id: 'fat_g', label: 'fat' },
  { id: 'fiber_g', label: 'fibre' },
  { id: 'sodium_mg', label: 'sodium' },
] as const;

export type ShapeNutrientId = (typeof SHAPE_NUTRIENTS)[number]['id'];

export interface Replacement {
  recipe: Recipe;
  /**
   * The day's penalty if this recipe took the slot. Lower is better, and the
   * units are the planner's - meaningless on their own, which is why `fit`
   * exists for display.
   */
  penalty: number;
  /**
   * 0-1, and explicitly *relative to the other candidates for this slot*. The
   * best option is 1 and the ninetieth-percentile option is 0, so a card can
   * show a bar without implying an absolute grade the number cannot support.
   */
  fit: number;
  /** Portions the day would call for, after rescaling to the energy target. */
  servings: number;
  /** What the day would deliver, per nutrient, against its target. */
  dayShare: Record<string, number>;
  /**
   * This meal alone against its fair share of the day - one over the number of
   * meals a day. 1 means a perfectly proportioned meal for its slot, which is
   * what makes the radar readable as a shape rather than a size.
   */
  mealShare: Record<string, number>;
  /** Cost of the portions the plan would eat, in GBP. */
  cost: number;
  /** True for the recipe currently in the slot. */
  current: boolean;
}

export interface RankReplacementsInput {
  plan: MealPlan;
  targets: ResolvedTargets;
  preferences: PlanPreferences;
  recipes: Recipe[];
  recipesById: Map<number, Recipe>;
  dayIndex: number;
  slot: MealSlot;
  dietType?: DietType;
  /** How many to return. The full library is 500 and no one scrolls that. */
  limit?: number;
}

const DEFAULT_LIMIT = 40;

/** Where the fit scale bottoms out, so one absurd candidate cannot flatten it. */
const FIT_PERCENTILE = 0.9;

/**
 * The daily target a radar axis is drawn against.
 *
 * Five of the six are a workbook target read straight off. Fat is not: the
 * workbook gives it as a share of energy, an AMDR window rather than a number,
 * so the gram figure is derived from the middle of that window at nine
 * kilocalories a gram. That is the same quantity `scoreDay` penalises - it
 * just has to be expressed in grams to sit on an axis with the others.
 */
export function targetFor(id: string, targets: ResolvedTargets): number | null {
  if (id === 'fat_g') {
    const energy = targets.byId.energy_kcal?.value;
    const min = targets.byId.fat_pct_energy_min?.value;
    const max = targets.byId.fat_pct_energy_max?.value;
    if (!energy || min === undefined || max === undefined) return null;
    return (energy * ((min + max) / 2 / 100)) / 9;
  }
  return targets.byId[id]?.value ?? null;
}

function shareOf(
  totals: DayTotals,
  targets: ResolvedTargets,
  scale: number,
  divisor: number,
): Record<string, number> {
  const share: Record<string, number> = {};
  for (const { id } of SHAPE_NUTRIENTS) {
    const target = targetFor(id, targets);
    if (!target) continue;
    const achieved = (totals[id as keyof DayTotals] as number) * scale;
    share[id] = achieved / (target / divisor);
  }
  return share;
}

/**
 * Every recipe that could take this slot, best fit first.
 *
 * The recipe currently in the slot is included and marked, because a reader
 * comparing options needs to see what they are comparing against - and
 * because it is genuinely possible that nothing beats it.
 */
export function rankReplacements(input: RankReplacementsInput): Replacement[] {
  const {
    plan,
    targets,
    preferences,
    recipes,
    recipesById,
    dayIndex,
    slot,
    dietType = 'iifym',
    limit = DEFAULT_LIMIT,
  } = input;

  const dayMeals = plan.meals.filter((meal) => meal.dayIndex === dayIndex);
  const currentMeal = dayMeals.find((meal) => meal.slot === slot);
  if (!currentMeal) return [];

  // The rest of the day, held fixed. This is what makes a swap a swap: the
  // candidate is judged on the day it would actually join.
  let rest = EMPTY_TOTALS;
  for (const meal of dayMeals) {
    if (meal.slot === slot) continue;
    const recipe = recipesById.get(meal.recipeId);
    if (recipe) rest = addRecipe(rest, recipe, 1);
  }

  const mealsPerDay = Math.max(dayMeals.length, 1);

  const pool = eligibleRecipes(recipes, preferences, dietType).filter(
    (recipe) => recipe.slot === slot,
  );
  // A slot with nothing in it after filtering falls back to the whole eligible
  // library, exactly as the planner does when it builds the plan.
  const candidates = pool.length > 0
    ? pool
    : eligibleRecipes(recipes, preferences, dietType);

  const scored = candidates.map((recipe) => {
    const totals = addRecipe(rest, recipe, 1);
    const scale = servingScaleFor(totals, targets);
    return {
      recipe,
      penalty: scoreDay(totals, targets, scale),
      scale,
      totals,
    };
  });

  scored.sort((a, b) => a.penalty - b.penalty);

  const best = scored[0]?.penalty ?? 0;
  const ceiling =
    scored[Math.min(scored.length - 1, Math.floor(scored.length * FIT_PERCENTILE))]
      ?.penalty ?? best;
  const spread = Math.max(ceiling - best, 1e-6);

  const top = scored.slice(0, limit);
  // The current meal always appears, even if it ranks below the cut - a list
  // that hides what you are replacing is a list you cannot read.
  if (!top.some((entry) => entry.recipe.id === currentMeal.recipeId)) {
    const existing = scored.find((entry) => entry.recipe.id === currentMeal.recipeId);
    if (existing) top.push(existing);
  }

  return top.map(({ recipe, penalty, scale, totals }) => {
    const mealTotals = addRecipe(EMPTY_TOTALS, recipe, scale);
    return {
      recipe,
      penalty,
      fit: Math.max(0, Math.min(1, 1 - (penalty - best) / spread)),
      servings: Math.round(scale * 100) / 100,
      dayShare: shareOf(totals, targets, scale, 1),
      mealShare: shareOf(mealTotals, targets, 1, mealsPerDay),
      cost: recipe.cost_per_serving * scale,
      current: recipe.id === currentMeal.recipeId,
    };
  });
}

/**
 * A plan with one meal replaced, and the day it sits in put back in balance.
 *
 * Portion scaling is per day, so swapping a 900 kcal dinner for a 400 kcal one
 * changes how much of everything else that day is eaten. Rewriting only the
 * recipe id would leave the day short by five hundred calories and the plan's
 * own energy figure wrong, which is the sort of error that never announces
 * itself.
 */
export function applySwap(
  plan: MealPlan,
  recipesById: Map<number, Recipe>,
  targets: ResolvedTargets,
  dayIndex: number,
  slot: MealSlot,
  recipeId: number,
): MealPlan {
  const meals = plan.meals.map((meal) =>
    meal.dayIndex === dayIndex && meal.slot === slot ? { ...meal, recipeId } : meal,
  );

  // Rescale every day, not just the one that changed. It is the same
  // arithmetic either way and it keeps this function honest if a caller ever
  // hands it a plan whose scales are already stale.
  const byDay = new Map<number, typeof meals>();
  for (const meal of meals) {
    const bucket = byDay.get(meal.dayIndex);
    if (bucket) bucket.push(meal);
    else byDay.set(meal.dayIndex, [meal]);
  }

  let sum = EMPTY_TOTALS;
  let days = 0;

  for (const [, dayMeals] of byDay) {
    let totals = EMPTY_TOTALS;
    for (const meal of dayMeals) {
      const recipe = recipesById.get(meal.recipeId);
      if (recipe) totals = addRecipe(totals, recipe, 1);
    }
    // Round once, then use the rounded value for both the stored portions and
    // the totals. Scaling the totals by the exact figure while showing the
    // reader a rounded one makes the plan's headline energy disagree with the
    // sum of the rows underneath it - by a tenth of a percent, which is small
    // enough never to be noticed and wrong enough to be worth not doing.
    const scale = Math.round(servingScaleFor(totals, targets) * 100) / 100;
    for (const meal of dayMeals) meal.servings = scale;

    let scaled = EMPTY_TOTALS;
    for (const meal of dayMeals) {
      const recipe = recipesById.get(meal.recipeId);
      if (recipe) scaled = addRecipe(scaled, recipe, scale);
    }
    sum = {
      energy_kcal: sum.energy_kcal + scaled.energy_kcal,
      protein_g: sum.protein_g + scaled.protein_g,
      carbohydrate_g: sum.carbohydrate_g + scaled.carbohydrate_g,
      fiber_g: sum.fiber_g + scaled.fiber_g,
      sodium_mg: sum.sodium_mg + scaled.sodium_mg,
      fat_g: sum.fat_g + scaled.fat_g,
      cost: sum.cost + scaled.cost,
    };
    days += 1;
  }

  const dayCount = Math.max(days, 1);
  const costPerCycle = sum.cost;

  return {
    ...plan,
    meals,
    averageNutrition: {
      energy_kcal: sum.energy_kcal / dayCount,
      protein_g: sum.protein_g / dayCount,
      carbohydrate_g: sum.carbohydrate_g / dayCount,
      fiber_g: sum.fiber_g / dayCount,
      sodium_mg: sum.sodium_mg / dayCount,
      fat_g: sum.fat_g / dayCount,
    },
    costPerCycle,
    costPerWeek: costPerCycle / (plan.cycleDays / 7),
  };
}
