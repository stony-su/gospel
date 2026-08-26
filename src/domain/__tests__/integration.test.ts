/**
 * End-to-end check against the real bundled data.
 *
 * The unit tests use small fixtures, which proves the logic but not that it
 * survives contact with 1,600 real recipes and 48 real targets. This runs the
 * whole chain - resolve, plan, consume, project - for several profiles across
 * the diet spectrum and asserts the result is actually usable.
 */

import { ingredientsById, recipes, recipesById } from '@/data/recipes';
import { resolveTargets } from '@/domain/nutrition/resolver';
import type { DietType, NutritionProfile } from '@/domain/nutrition/types';
import { simulatePantry } from '@/domain/pantry/depletion';
import {
  buildPlan,
  consumptionForPlan,
  equipmentForPlan,
} from '@/domain/planner/planner';
import type { MealSlot } from '@/domain/planner/types';

const MEALS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

const PROFILES: { name: string; profile: NutritionProfile }[] = [
  {
    name: 'omnivore male',
    profile: {
      sex: 'male',
      weight_kg: 82,
      age_years: 34,
      diet_type: 'iifym',
      activity_level: 'moderate',
      sun_zone: 'temperate',
    },
  },
  {
    name: 'vegan female',
    profile: {
      sex: 'female',
      weight_kg: 61,
      age_years: 27,
      diet_type: 'vegan',
      activity_level: 'active',
      sun_zone: 'high_latitude',
    },
  },
  {
    name: 'keto male',
    profile: {
      sex: 'male',
      weight_kg: 95,
      age_years: 52,
      diet_type: 'keto',
      activity_level: 'light',
      sun_zone: 'subtropical',
    },
  },
  {
    name: 'vegetarian female',
    profile: {
      sex: 'female',
      weight_kg: 70,
      age_years: 45,
      diet_type: 'vegetarian',
      activity_level: 'sedentary',
      sun_zone: 'tropical',
    },
  },
];

const preferences = {
  cuisines: [] as string[],
  maxDifficulty: 4,
  maxMinutes: 90,
  weeklyBudget: 80,
  mealsPerDay: MEALS,
};

describe('bundled data', () => {
  it('ships a usable recipe library', () => {
    expect(recipes.length).toBeGreaterThan(1000);
    expect(Object.keys(ingredientsById).length).toBeGreaterThan(500);
  });

  it('gives every recipe the fields the planner depends on', () => {
    for (const recipe of recipes) {
      expect(recipe.nutrition.energy_kcal).toBeGreaterThan(0);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.instructions.length).toBeGreaterThan(0);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(['breakfast', 'lunch', 'dinner', 'snack']).toContain(recipe.slot);
    }
  });

  it('resolves every ingredient a recipe references', () => {
    const missing = new Set<string>();
    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) {
        if (!ingredientsById[ingredient.id]) missing.add(ingredient.id);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe.each(PROFILES.map((entry) => [entry.name, entry.profile] as const))(
  'full chain for %s',
  (_name, profile) => {
    const targets = resolveTargets(profile);
    const plan = buildPlan({
      targets,
      preferences,
      recipes,
      cycleDays: 7,
      seed: 2024,
      dietType: profile.diet_type,
    });

    it('resolves 48 targets', () => {
      expect(targets.nutrients).toHaveLength(48);
      expect(targets.energy_kcal).toBeGreaterThan(1200);
    });

    it('fills a full week of meals', () => {
      expect(plan.meals).toHaveLength(21);
    });

    it('only uses recipes the diet allows', () => {
      for (const meal of plan.meals) {
        const recipe = recipesById.get(meal.recipeId);
        expect(recipe?.diet[profile.diet_type as DietType]).toBe(true);
      }
    });

    it('lands daily energy within 15% of target', () => {
      const achieved = plan.averageNutrition.energy_kcal;
      const target = targets.byId.energy_kcal.value;
      expect(Math.abs(achieved - target) / target).toBeLessThan(0.15);
    });

    it('produces a grocery projection with real costs', () => {
      const consumption = consumptionForPlan(plan, recipesById);
      expect(consumption.size).toBeGreaterThan(5);

      const projection = simulatePantry({
        consumptionPerCycle: consumption,
        ingredients: ingredientsById,
        cycleDays: 7,
        cycleCount: 6,
        equipment: equipmentForPlan(plan, recipesById),
      });

      expect(projection.cycles).toHaveLength(6);
      expect(projection.cycles[0].lines.length).toBeGreaterThan(0);
      expect(projection.cycles[0].totalCost).toBeGreaterThan(0);
    });

    it('shops less in later cycles than the first, as stock carries over', () => {
      const consumption = consumptionForPlan(plan, recipesById);
      const projection = simulatePantry({
        consumptionPerCycle: consumption,
        ingredients: ingredientsById,
        cycleDays: 7,
        cycleCount: 6,
      });

      const first = projection.cycles[0].lines.length;
      const later = projection.cycles[1].lines.length;
      expect(later).toBeLessThanOrEqual(first);
    });
  },
);

describe('performance', () => {
  it('builds a monthly plan from the full library quickly enough for a tap', () => {
    const targets = resolveTargets(PROFILES[0].profile);
    const started = Date.now();

    buildPlan({
      targets,
      preferences,
      recipes,
      cycleDays: 28,
      seed: 7,
      dietType: 'iifym',
    });

    // Generous: this runs on a phone, and the user is watching a button.
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
