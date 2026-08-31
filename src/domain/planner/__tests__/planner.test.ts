/**
 * The planner turns resolved targets plus preferences into a repeating
 * schedule. These tests pin the properties that matter: it must respect the
 * hard constraints absolutely, produce the same plan for the same inputs, and
 * land near the energy target.
 */

import { resolveTargets } from '@/domain/nutrition/resolver';
import { buildPlan } from '../planner';
import type { PlanPreferences, Recipe } from '../types';

const baseProfile = {
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
  maxMinutes: 120,
  weeklyBudget: 90,
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

/** A pool wide enough that the solver has real choices to make. */
function makePool(): Recipe[] {
  const slots = ['breakfast', 'lunch', 'dinner'] as const;
  const cuisines = ['italian', 'east_asian', 'mexican', 'american'];
  const pool: Recipe[] = [];

  for (let index = 0; index < 60; index += 1) {
    const slot = slots[index % slots.length];
    pool.push(
      makeRecipe({
        id: 100 + index,
        slot,
        cuisine: cuisines[index % cuisines.length],
        difficulty: (index % 5) + 1,
        minutes: 15 + (index % 6) * 20,
        cost_per_serving: 1 + (index % 5) * 0.7,
        nutrition: {
          energy_kcal: 300 + (index % 7) * 90,
          protein_g: 12 + (index % 9) * 4,
          fat_g: 8 + (index % 5) * 5,
          saturated_fat_g: 3,
          cholesterol_mg: 40,
          sodium_mg: 200 + (index % 8) * 180,
          carbohydrate_g: 20 + (index % 6) * 14,
          fiber_g: 2 + (index % 7) * 2,
          sugar_g: 5,
        },
      }),
    );
  }

  // A few plant-only options so diet filtering has something to select.
  for (let index = 0; index < 12; index += 1) {
    pool.push(
      makeRecipe({
        id: 900 + index,
        slot: slots[index % slots.length],
        cuisine: 'mediterranean',
        diet: {
          vegan: true,
          vegetarian: true,
          paleo: false,
          iifym: true,
          keto: false,
          carnivore: false,
        },
        ingredients: [
          { id: 'lentil', label: 'lentils', quantity: 1, quantity_text: '1', grams: 200 },
        ],
      }),
    );
  }

  return pool;
}

const targets = resolveTargets(baseProfile);
const pool = makePool();

describe('buildPlan', () => {
  it('fills every slot of every day in the cycle', () => {
    const plan = buildPlan({ targets, preferences, recipes: pool, cycleDays: 7, seed: 1 });
    expect(plan.meals).toHaveLength(7 * 3);

    for (let day = 0; day < 7; day += 1) {
      const dayMeals = plan.meals.filter((meal) => meal.dayIndex === day);
      expect(dayMeals.map((meal) => meal.slot).sort()).toEqual([
        'breakfast',
        'dinner',
        'lunch',
      ]);
    }
  });

  it('produces an identical plan for an identical seed', () => {
    const first = buildPlan({ targets, preferences, recipes: pool, cycleDays: 7, seed: 42 });
    const second = buildPlan({ targets, preferences, recipes: pool, cycleDays: 7, seed: 42 });
    expect(second.meals).toEqual(first.meals);
    expect(second.score).toBeCloseTo(first.score, 10);
  });

  it('produces a different plan for a different seed', () => {
    const first = buildPlan({ targets, preferences, recipes: pool, cycleDays: 7, seed: 1 });
    const second = buildPlan({ targets, preferences, recipes: pool, cycleDays: 7, seed: 7 });
    expect(second.meals).not.toEqual(first.meals);
  });

  it('never selects a recipe the diet forbids', () => {
    const veganTargets = resolveTargets({ ...baseProfile, diet_type: 'vegan' });
    const plan = buildPlan({
      targets: veganTargets,
      preferences,
      recipes: pool,
      cycleDays: 7,
      seed: 3,
      dietType: 'vegan',
    });

    const byId = new Map(pool.map((recipe) => [recipe.id, recipe]));
    for (const meal of plan.meals) {
      expect(byId.get(meal.recipeId)?.diet.vegan).toBe(true);
    }
  });

  it('never exceeds the difficulty or time ceiling', () => {
    const plan = buildPlan({
      targets,
      preferences: { ...preferences, maxDifficulty: 2, maxMinutes: 40 },
      recipes: pool,
      cycleDays: 7,
      seed: 5,
    });

    const byId = new Map(pool.map((recipe) => [recipe.id, recipe]));
    for (const meal of plan.meals) {
      const recipe = byId.get(meal.recipeId)!;
      expect(recipe.difficulty).toBeLessThanOrEqual(2);
      expect(recipe.minutes).toBeLessThanOrEqual(40);
    }
  });

  it('lands daily energy near the resolved target', () => {
    const plan = buildPlan({ targets, preferences, recipes: pool, cycleDays: 7, seed: 11 });
    const achieved = plan.averageNutrition.energy_kcal;
    const target = targets.byId.energy_kcal.value;
    expect(Math.abs(achieved - target) / target).toBeLessThan(0.12);
  });

  it('warns instead of failing when the pool is too thin to satisfy a slot', () => {
    const plan = buildPlan({
      targets,
      preferences: { ...preferences, maxDifficulty: 1, maxMinutes: 10 },
      recipes: pool,
      cycleDays: 7,
      seed: 2,
    });

    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('reports cost per week so it can be checked against the budget', () => {
    const plan = buildPlan({ targets, preferences, recipes: pool, cycleDays: 14, seed: 9 });
    expect(plan.costPerWeek).toBeGreaterThan(0);
    expect(plan.costPerCycle).toBeCloseTo(plan.costPerWeek * 2, 5);
  });

  it('prefers the cuisines the user asked for', () => {
    const plan = buildPlan({
      targets,
      preferences: { ...preferences, cuisines: ['italian'] },
      recipes: pool,
      cycleDays: 7,
      seed: 4,
    });

    const byId = new Map(pool.map((recipe) => [recipe.id, recipe]));
    const italian = plan.meals.filter(
      (meal) => byId.get(meal.recipeId)?.cuisine === 'italian',
    ).length;

    // Italian is a quarter of the pool; asking for it should beat chance.
    expect(italian / plan.meals.length).toBeGreaterThan(0.4);
  });
});
