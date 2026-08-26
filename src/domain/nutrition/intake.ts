/**
 * What a plan actually delivers, computed from its ingredients.
 *
 * The recipe corpus publishes nine nutrients per serving. The workbook
 * resolves forty-eight targets. This closes that gap by summing USDA
 * FoodData Central panels over each recipe's ingredient weights.
 *
 * The hard part is missing data, not arithmetic. FDC does not carry every
 * nutrient for every food - amino acids in particular exist only where USDA
 * ran a full protein analysis - so a total is routinely the sum over a subset
 * of a recipe's ingredients.
 *
 * The policy here is to report that sum rather than withhold it. A total can
 * therefore understate: a recipe whose lysine data covers half its mass
 * reports roughly half its lysine. `coverage` is what keeps that honest - it
 * records the share of the recipe's mass that carried a value for each
 * nutrient, so an undercount is measurable by anything that cares to look,
 * even though the number is still shown.
 */

/** A nutrient panel per 100g, keyed by the workbook's nutrient ids. */
export interface IngredientPanel {
  per_100g: Record<string, number>;
}

export type PanelIndex = Record<string, IngredientPanel>;

export interface IntakeResult {
  /** Nutrient totals per serving, for every nutrient some ingredient had. */
  perServing: Record<string, number>;
  /** 0-1 share of the recipe's mass that carried a value, per nutrient. */
  coverage: Record<string, number>;
}

interface WeighedIngredient {
  id: string;
  grams: number;
}

interface RecipeShape {
  ingredients: WeighedIngredient[];
  servings: number;
}

const EMPTY: IntakeResult = { perServing: {}, coverage: {} };

/**
 * Per-serving nutrient totals for one recipe.
 *
 * A zero or missing serving count is treated as one rather than divided by:
 * a recipe that forgot to say how many it serves should report the whole
 * dish, not Infinity.
 */
export function intakeForRecipe(
  ingredients: WeighedIngredient[],
  servings: number,
  panels: PanelIndex,
): IntakeResult {
  if (ingredients.length === 0) return { perServing: {}, coverage: {} };

  const portions = servings > 0 ? servings : 1;

  const totals: Record<string, number> = {};
  /** Mass that carried a value, per nutrient. */
  const covered: Record<string, number> = {};
  let mass = 0;

  for (const ingredient of ingredients) {
    const grams = Number.isFinite(ingredient.grams) ? ingredient.grams : 0;
    if (grams <= 0) continue;

    mass += grams;

    // An ingredient with no panel still counts toward the mass, which is what
    // makes coverage fall when a match is missing rather than silently
    // reporting a total over the ingredients that happened to resolve.
    const panel = panels[ingredient.id];
    if (!panel) continue;

    const scale = grams / 100;
    for (const [nutrientId, per100g] of Object.entries(panel.per_100g)) {
      if (!Number.isFinite(per100g)) continue;
      totals[nutrientId] = (totals[nutrientId] ?? 0) + per100g * scale;
      covered[nutrientId] = (covered[nutrientId] ?? 0) + grams;
    }
  }

  if (mass <= 0) return { perServing: {}, coverage: {} };

  const perServing: Record<string, number> = {};
  for (const [nutrientId, total] of Object.entries(totals)) {
    perServing[nutrientId] = total / portions;
  }

  const coverage: Record<string, number> = {};
  for (const [nutrientId, weight] of Object.entries(covered)) {
    coverage[nutrientId] = weight / mass;
  }

  return { perServing, coverage };
}

interface Meal {
  recipeId: number;
  servings: number;
}

/**
 * Average daily intake across a plan's cycle.
 *
 * Coverage is carried through as a mass-weighted average, so a cycle whose
 * lysine data is thin in most meals reports thin coverage overall rather than
 * inheriting the best-covered meal's figure.
 */
export function averageDailyIntake(
  meals: Meal[],
  recipes: Map<number, RecipeShape>,
  panels: PanelIndex,
  cycleDays: number,
): IntakeResult {
  if (meals.length === 0) return { perServing: {}, coverage: {} };

  const days = cycleDays > 0 ? cycleDays : 1;

  const totals: Record<string, number> = {};
  const coverageWeight: Record<string, number> = {};
  const coverageMass: Record<string, number> = {};

  for (const meal of meals) {
    const recipe = recipes.get(meal.recipeId);
    if (!recipe) continue;

    const single = intakeForRecipe(recipe.ingredients, recipe.servings, panels);
    const portions = Number.isFinite(meal.servings) && meal.servings > 0 ? meal.servings : 1;

    for (const [nutrientId, amount] of Object.entries(single.perServing)) {
      totals[nutrientId] = (totals[nutrientId] ?? 0) + amount * portions;
    }

    // Weight each meal's coverage by its portions, so a dish eaten twice
    // counts twice toward how well covered the cycle is.
    for (const [nutrientId, share] of Object.entries(single.coverage)) {
      coverageWeight[nutrientId] = (coverageWeight[nutrientId] ?? 0) + share * portions;
      coverageMass[nutrientId] = (coverageMass[nutrientId] ?? 0) + portions;
    }
  }

  const perServing: Record<string, number> = {};
  for (const [nutrientId, total] of Object.entries(totals)) {
    perServing[nutrientId] = total / days;
  }

  const coverage: Record<string, number> = {};
  for (const [nutrientId, weight] of Object.entries(coverageWeight)) {
    const denominator = coverageMass[nutrientId];
    if (denominator > 0) coverage[nutrientId] = weight / denominator;
  }

  return { perServing, coverage };
}

export { EMPTY as EMPTY_INTAKE };
