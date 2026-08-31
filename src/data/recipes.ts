/**
 * Typed access to the curated recipe library.
 *
 * One hundred dishes, built by scripts/build_recipe_library.py. Seventy-one
 * take their ingredients and method from a Wikibooks Cookbook page; the other
 * twenty-nine are written in scripts/authored/ because no source whose
 * licence permits reuse publishes a recipe for them. Every one has a
 * description from Wikipedia and a freely-licensed photograph from Wikimedia
 * Commons, bundled into the app.
 *
 * The library is chosen rather than sampled: Japanese, Italian, American,
 * French and Spanish carry it, with a scattering of everyday dishes from
 * elsewhere, and every meal slot has enough in it for the planner to have
 * real choices.
 */

import ingredientData from './generated/ingredients.json';
import recipeData from './generated/recipes.json';
import type { Ingredient } from '@/domain/pantry/types';
import type { DietType } from '@/domain/nutrition/types';
import type { Recipe } from '@/domain/planner/types';

export const recipes = recipeData as unknown as Recipe[];

const ingredientPayload = ingredientData as unknown as {
  ingredients: Ingredient[];
  categories: Record<string, { aisle: string; staple: boolean }>;
  cuisine_labels: Record<string, string>;
};

export const ingredients = ingredientPayload.ingredients;
export const cuisineLabels = ingredientPayload.cuisine_labels;

export const ingredientsById: Record<string, Ingredient> = Object.fromEntries(
  ingredients.map((ingredient) => [ingredient.id, ingredient]),
);

export const recipesById = new Map<number, Recipe>(
  recipes.map((recipe) => [recipe.id, recipe]),
);

/** Cuisines actually present in the library, with counts, most common first. */
export const availableCuisines = (() => {
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    counts.set(recipe.cuisine, (counts.get(recipe.cuisine) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: cuisineLabels[id] ?? id,
      count,
    }))
    .filter((entry) => entry.id !== 'unspecified')
    .sort((a, b) => b.count - a.count);
})();

/** How many recipes remain for a given diet. Drives the thin-library warning. */
export function recipeCountForDiet(diet: DietType): number {
  return recipes.filter((recipe) => recipe.diet[diet]).length;
}

/**
 * Diets with too few recipes to build a varied plan.
 *
 * Almost nothing anyone actually cooks is purely animal products, so a
 * carnivore plan draws from a handful of dishes; vegan is thin for the
 * opposite reason, that a library built around five meat-eating cuisines is.
 * The app says so during onboarding rather than quietly serving the same four
 * dishes for a month.
 *
 * Twenty of a hundred is roughly a fortnight of dinners before the plan has to
 * repeat itself, which is where a cycle stops feeling like a plan.
 */
export const THIN_LIBRARY_THRESHOLD = 20;

export function isLibraryThin(diet: DietType): boolean {
  return recipeCountForDiet(diet) < THIN_LIBRARY_THRESHOLD;
}
