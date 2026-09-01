/**
 * Replacing one meal.
 *
 * Two things have to hold. The ranking must agree with the planner - it uses
 * `scoreDay`, so the option it puts first is the one the solver would have
 * chosen - and the swap must leave the plan internally consistent, which is
 * the part that would fail silently: rewriting a recipe id without rescaling
 * the day leaves the plan's own energy figure describing a plan that no
 * longer exists.
 */

import { resolveTargets } from '@/domain/nutrition/resolver';
import { buildPlan } from '../planner';
import { applySwap, rankReplacements, SHAPE_NUTRIENTS } from '../swap';
import type { MealPlan, PlanPreferences, Recipe } from '../types';

const profile = {
  sex: 'male' as const,
  weight_kg: 78,
  age_years: 31,
  diet_type: 'iifym' as const,
  activity_level: 'moderate' as const,
  sun_zone: 'temperate' as const,
};

const preferences: PlanPreferences = {
  cuisines: [],
  maxDifficulty: 5,
  maxMinutes: 240,
  weeklyBudget: 120,
  mealsPerDay: ['breakfast', 'lunch', 'dinner'],
};

function makeRecipe(overrides: Partial<Recipe> & { id: number }): Recipe {
  return {
    slug: `recipe-${overrides.id}`,
    name: `Recipe ${overrides.id}`,
    description: '',
    image: {
      file: 'x.jpg',
      thumb: 'x-thumb.jpg',
      author: 'Test',
      license: 'CC BY-SA 4.0',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg',
    },
    minutes: 30,
    prep_minutes: 10,
    servings: 2,
    cuisine: 'american',
    slot: 'dinner',
    difficulty: 2,
    equipment: [],
    cost_per_serving: 1.8,
    ingredients: [
      { id: 'chicken breast', label: 'chicken', quantity: 2, quantity_text: '2', grams: 360 },
    ],
    instructions: ['Cook it.', 'Serve it.'],
    method_source: { kind: 'authored', url: null, license: null },
    reference_url: null,
    nutrition_coverage: 1,
    diet: {
      vegan: false,
      vegetarian: false,
      paleo: true,
      iifym: true,
      keto: true,
      carnivore: false,
    },
    nutrition: {
      energy_kcal: 520,
      protein_g: 38,
      fat_g: 22,
      saturated_fat_g: 6,
      cholesterol_mg: 90,
      sodium_mg: 620,
      carbohydrate_g: 38,
      fiber_g: 6,
      sugar_g: 7,
    },
    ...overrides,
  };
}

/** A pool with a deliberate best and a deliberate worst in the dinner slot. */
function pool(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const slot of ['breakfast', 'lunch', 'dinner'] as const) {
    for (let index = 0; index < 8; index += 1) {
      recipes.push(
        makeRecipe({
          id: recipes.length + 1,
          slot,
          nutrition: {
            energy_kcal: 400 + index * 60,
            protein_g: 20 + index * 4,
            fat_g: 18,
            saturated_fat_g: 5,
            cholesterol_mg: 70,
            sodium_mg: 500 + index * 40,
            carbohydrate_g: 40,
            fiber_g: 5 + index,
            sugar_g: 6,
          },
        }),
      );
    }
  }
  return recipes;
}

const targets = resolveTargets(profile);
const recipes = pool();
const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

function freshPlan(): MealPlan {
  return buildPlan({
    targets,
    preferences,
    recipes,
    cycleDays: 7,
    seed: 4,
    dietType: 'iifym',
  });
}

describe('rankReplacements', () => {
  const plan = freshPlan();

  it('offers only recipes that fit the slot and the preferences', () => {
    const options = rankReplacements({
      plan, targets, preferences, recipes, recipesById,
      dayIndex: 0, slot: 'dinner',
    });

    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.recipe.slot).toBe('dinner');
      expect(option.recipe.difficulty).toBeLessThanOrEqual(preferences.maxDifficulty);
      expect(option.recipe.minutes).toBeLessThanOrEqual(preferences.maxMinutes);
    }
  });

  it('sorts by the planner’s own penalty, best first', () => {
    const options = rankReplacements({
      plan, targets, preferences, recipes, recipesById,
      dayIndex: 0, slot: 'dinner',
    });

    const penalties = options.map((option) => option.penalty);
    expect([...penalties].sort((a, b) => a - b)).toEqual(penalties);
  });

  it('always includes the meal being replaced, and marks it', () => {
    const options = rankReplacements({
      plan, targets, preferences, recipes, recipesById,
      dayIndex: 0, slot: 'dinner',
    });

    const current = plan.meals.find((m) => m.dayIndex === 0 && m.slot === 'dinner');
    const marked = options.filter((option) => option.current);
    expect(marked).toHaveLength(1);
    expect(marked[0].recipe.id).toBe(current?.recipeId);
  });

  it('scores fit from best to ninetieth percentile, clamped', () => {
    const options = rankReplacements({
      plan, targets, preferences, recipes, recipesById,
      dayIndex: 0, slot: 'dinner',
    });

    expect(options[0].fit).toBeCloseTo(1, 5);
    for (const option of options) {
      expect(option.fit).toBeGreaterThanOrEqual(0);
      expect(option.fit).toBeLessThanOrEqual(1);
    }
  });

  it('gives every radar axis a share of the day’s target', () => {
    const [best] = rankReplacements({
      plan, targets, preferences, recipes, recipesById,
      dayIndex: 0, slot: 'dinner',
    });

    for (const { id } of SHAPE_NUTRIENTS) {
      expect(best.mealShare[id]).toBeGreaterThan(0);
      expect(Number.isFinite(best.mealShare[id])).toBe(true);
    }
  });

  it('returns nothing for a slot the plan does not fill', () => {
    expect(
      rankReplacements({
        plan, targets, preferences, recipes, recipesById,
        dayIndex: 0, slot: 'snack',
      }),
    ).toEqual([]);
  });
});

describe('applySwap', () => {
  const plan = freshPlan();
  const options = rankReplacements({
    plan, targets, preferences, recipes, recipesById,
    dayIndex: 2, slot: 'lunch',
  });
  const replacement = options.find((option) => !option.current)!;

  it('puts the chosen recipe in the slot and leaves every other meal alone', () => {
    const swapped = applySwap(plan, recipesById, targets, 2, 'lunch', replacement.recipe.id);

    const changed = swapped.meals.find((m) => m.dayIndex === 2 && m.slot === 'lunch');
    expect(changed?.recipeId).toBe(replacement.recipe.id);

    for (const meal of swapped.meals) {
      if (meal.dayIndex === 2) continue;
      const before = plan.meals.find(
        (m) => m.dayIndex === meal.dayIndex && m.slot === meal.slot,
      );
      expect(meal.recipeId).toBe(before?.recipeId);
    }
  });

  it('rescales the day so it still lands on its energy target', () => {
    const swapped = applySwap(plan, recipesById, targets, 2, 'lunch', replacement.recipe.id);
    const dayMeals = swapped.meals.filter((m) => m.dayIndex === 2);

    const energy = dayMeals.reduce((total, meal) => {
      const recipe = recipesById.get(meal.recipeId)!;
      return total + recipe.nutrition.energy_kcal * meal.servings;
    }, 0);

    // Not exact: portion scaling is clamped to what a person would eat, so a
    // day of very light dishes can still fall short. Within a quarter is the
    // promise the planner itself makes.
    const target = targets.byId.energy_kcal.value;
    expect(Math.abs(energy - target) / target).toBeLessThan(0.25);
  });

  it('rewrites the cycle averages the swap invalidated', () => {
    const swapped = applySwap(plan, recipesById, targets, 2, 'lunch', replacement.recipe.id);

    const recomputed = swapped.meals.reduce((total, meal) => {
      const recipe = recipesById.get(meal.recipeId)!;
      return total + recipe.nutrition.protein_g * meal.servings;
    }, 0) / swapped.cycleDays;

    expect(swapped.averageNutrition.protein_g).toBeCloseTo(recomputed, 4);
  });

  it('recomputes the cost the plan reports', () => {
    const swapped = applySwap(plan, recipesById, targets, 2, 'lunch', replacement.recipe.id);

    const cost = swapped.meals.reduce((total, meal) => {
      const recipe = recipesById.get(meal.recipeId)!;
      return total + recipe.cost_per_serving * meal.servings;
    }, 0);

    expect(swapped.costPerCycle).toBeCloseTo(cost, 4);
    expect(swapped.costPerWeek).toBeCloseTo(cost / (swapped.cycleDays / 7), 4);
  });

  it('does not mutate the plan it was given', () => {
    const before = JSON.stringify(plan);
    applySwap(plan, recipesById, targets, 2, 'lunch', replacement.recipe.id);
    expect(JSON.stringify(plan)).toBe(before);
  });
});
