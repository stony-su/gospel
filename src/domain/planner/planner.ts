/**
 * The meal planner.
 *
 * Gospel's premise is that the schedule repeats: the same meals every cycle,
 * chosen once and chosen well. That makes this an optimisation over a fixed
 * set of slots rather than a day-to-day suggestion engine, and it means the
 * plan is worth spending real search effort on.
 *
 * Approach:
 *   1. Filter the library to what the user can and will actually cook.
 *   2. Fill every slot greedily, each pick scored against the running daily
 *      nutrient profile so gaps get filled rather than reinforced.
 *   3. Scale each day's portions so energy lands on target - nutrient ratios
 *      are what recipe choice controls; absolute amounts are what portion size
 *      controls, and separating the two makes both tractable.
 *   4. Hill-climb by swapping single meals, keeping improvements.
 *
 * The search is seeded, so the same answers always produce the same plan and
 * a user can regenerate deliberately rather than by accident.
 */

import type { DietType, ResolvedTargets } from '@/domain/nutrition/types';
import { fatPercentOfEnergy, measure } from './coverage';
import type {
  CycleLength,
  MealPlan,
  MealSlot,
  PlanPreferences,
  PlannedMeal,
  Recipe,
} from './types';

export interface BuildPlanInput {
  targets: ResolvedTargets;
  preferences: PlanPreferences;
  recipes: Recipe[];
  cycleDays: CycleLength;
  seed?: number;
  dietType?: DietType;
}

/** Portion scaling stays inside what a person would plausibly eat. */
const MIN_SERVINGS = 0.5;
const MAX_SERVINGS = 3.0;

const HILL_CLIMB_ITERATIONS = 900;
/** Candidates ranked per iteration before one is tested against the full plan. */
const HILL_CLIMB_SAMPLE = 14;

/**
 * How hard each nutrient pulls on the objective, and which direction hurts.
 * Shortfalls in protein and fibre matter more than overshoot; sodium is the
 * reverse, since the target doubles as a ceiling.
 */
const NUTRIENT_WEIGHTS: {
  id: string;
  weight: number;
  shortfallBias: number;
  excessBias: number;
}[] = [
  { id: 'protein_g', weight: 3.0, shortfallBias: 1.0, excessBias: 0.15 },
  { id: 'fiber_g', weight: 1.4, shortfallBias: 1.0, excessBias: 0.05 },
  { id: 'carbohydrate_g', weight: 0.8, shortfallBias: 0.6, excessBias: 0.3 },
  { id: 'sodium_mg', weight: 1.5, shortfallBias: 0.0, excessBias: 1.0 },
];

/** Deterministic PRNG, so a seed reproduces a plan exactly. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DayTotals {
  energy_kcal: number;
  protein_g: number;
  carbohydrate_g: number;
  fiber_g: number;
  sodium_mg: number;
  fat_g: number;
  cost: number;
}

const EMPTY_TOTALS: DayTotals = {
  energy_kcal: 0,
  protein_g: 0,
  carbohydrate_g: 0,
  fiber_g: 0,
  sodium_mg: 0,
  fat_g: 0,
  cost: 0,
};

function addRecipe(totals: DayTotals, recipe: Recipe, servings: number): DayTotals {
  return {
    energy_kcal: totals.energy_kcal + recipe.nutrition.energy_kcal * servings,
    protein_g: totals.protein_g + recipe.nutrition.protein_g * servings,
    carbohydrate_g: totals.carbohydrate_g + recipe.nutrition.carbohydrate_g * servings,
    fiber_g: totals.fiber_g + recipe.nutrition.fiber_g * servings,
    sodium_mg: totals.sodium_mg + recipe.nutrition.sodium_mg * servings,
    fat_g: totals.fat_g + recipe.nutrition.fat_g * servings,
    cost: totals.cost + recipe.cost_per_serving * servings,
  };
}

/** Filter the library down to what this user can and will cook. */
export function eligibleRecipes(
  recipes: Recipe[],
  preferences: PlanPreferences,
  dietType: DietType,
): Recipe[] {
  return recipes.filter(
    (recipe) =>
      recipe.diet[dietType] === true &&
      recipe.difficulty <= preferences.maxDifficulty &&
      recipe.minutes <= preferences.maxMinutes,
  );
}

/**
 * Penalty for one day's nutrition against the targets.
 *
 * Everything is expressed as a fraction of target, so nutrients measured in
 * milligrams do not drown out ones measured in grams.
 */
function scoreDay(
  totals: DayTotals,
  targets: ResolvedTargets,
  servingScale: number,
): number {
  let penalty = 0;

  // Energy dominates deliberately, and grows faster than linearly.
  //
  // Portion size is the lever that controls absolute intake, so energy is the
  // one target the planner can almost always hit; every other nutrient is a
  // consequence of which recipes were chosen. Weighting them comparably lets a
  // sodium or fibre penalty buy its improvement by shrinking portions, which
  // under-feeds the user to tidy a secondary number. The quadratic term makes
  // a large energy miss unattractive at any price.
  const energyTarget = targets.byId.energy_kcal?.value ?? 2000;
  const energy = totals.energy_kcal * servingScale;
  const energyError = Math.abs(energy - energyTarget) / energyTarget;
  penalty += energyError * 6 + energyError * energyError * 40;

  for (const { id, weight, shortfallBias, excessBias } of NUTRIENT_WEIGHTS) {
    const target = targets.byId[id]?.value;
    if (!target) continue;

    const achieved =
      (id === 'protein_g'
        ? totals.protein_g
        : id === 'fiber_g'
          ? totals.fiber_g
          : id === 'carbohydrate_g'
            ? totals.carbohydrate_g
            : totals.sodium_mg) * servingScale;

    const deviation = (achieved - target) / target;
    penalty +=
      weight * (deviation < 0 ? -deviation * shortfallBias : deviation * excessBias);
  }

  // Fat as a share of energy, against the AMDR window.
  const fatMin = targets.byId.fat_pct_energy_min?.value;
  const fatMax = targets.byId.fat_pct_energy_max?.value;
  if (fatMin !== undefined && fatMax !== undefined && energy > 0) {
    const fatPercent = ((totals.fat_g * servingScale * 9) / energy) * 100;
    if (fatPercent < fatMin) penalty += ((fatMin - fatPercent) / fatMin) * 1.2;
    if (fatPercent > fatMax) penalty += ((fatPercent - fatMax) / fatMax) * 1.2;
  }

  return penalty;
}

/** Score one day's chosen recipes in isolation, to rank candidates cheaply. */
function scoreRecipeDay(dayRecipes: Recipe[], targets: ResolvedTargets): number {
  let totals = EMPTY_TOTALS;
  for (const recipe of dayRecipes) totals = addRecipe(totals, recipe, 1);
  return scoreDay(totals, targets, servingScaleFor(totals, targets));
}

/** The portion multiplier that puts a day closest to its energy target. */
function servingScaleFor(totals: DayTotals, targets: ResolvedTargets): number {
  const energyTarget = targets.byId.energy_kcal?.value ?? 2000;
  if (totals.energy_kcal <= 0) return 1;
  const ideal = energyTarget / totals.energy_kcal;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, ideal));
}

/** Full objective for a candidate plan: nutrition, cost, repetition, cuisine. */
function scorePlan(
  selection: Recipe[][],
  targets: ResolvedTargets,
  preferences: PlanPreferences,
  cycleDays: number,
): { score: number; scales: number[]; costPerCycle: number } {
  let score = 0;
  let costPerCycle = 0;
  const scales: number[] = [];

  for (const dayRecipes of selection) {
    let totals = EMPTY_TOTALS;
    for (const recipe of dayRecipes) totals = addRecipe(totals, recipe, 1);

    const scale = servingScaleFor(totals, targets);
    scales.push(scale);
    score += scoreDay(totals, targets, scale);
    costPerCycle += totals.cost * scale;
  }

  score /= Math.max(selection.length, 1);

  // Cost. Only overrun is penalised; coming in under budget is not a virtue
  // the plan should chase at nutrition's expense.
  const weeks = cycleDays / 7;
  const costPerWeek = weeks > 0 ? costPerCycle / weeks : costPerCycle;
  if (preferences.weeklyBudget > 0 && costPerWeek > preferences.weeklyBudget) {
    score += ((costPerWeek - preferences.weeklyBudget) / preferences.weeklyBudget) * 3;
  }

  // Repetition. The plan is meant to repeat between cycles, not within one.
  const counts = new Map<number, number>();
  for (const dayRecipes of selection) {
    for (const recipe of dayRecipes) {
      counts.set(recipe.id, (counts.get(recipe.id) ?? 0) + 1);
    }
  }
  for (const count of counts.values()) {
    if (count > 1) score += (count - 1) * 0.55;
  }

  // Cuisine preference, as a gentle pull rather than a filter, so nutrition
  // never becomes unreachable because of a narrow taste.
  if (preferences.cuisines.length > 0) {
    let matches = 0;
    let total = 0;
    for (const dayRecipes of selection) {
      for (const recipe of dayRecipes) {
        total += 1;
        if (preferences.cuisines.includes(recipe.cuisine)) matches += 1;
      }
    }
    if (total > 0) score += (1 - matches / total) * 2.5;
  }

  return { score, scales, costPerCycle };
}

export function buildPlan(input: BuildPlanInput): MealPlan {
  const { targets, preferences, recipes, cycleDays } = input;
  const seed = input.seed ?? 1;
  const dietType = input.dietType ?? 'iifym';
  const random = mulberry32(seed);
  const warnings: string[] = [];

  const eligible = eligibleRecipes(recipes, preferences, dietType);

  if (eligible.length === 0) {
    return {
      cycleDays,
      meals: [],
      averageNutrition: {},
      costPerCycle: 0,
      costPerWeek: 0,
      score: Number.POSITIVE_INFINITY,
      warnings: [
        'No recipes match this combination of diet, difficulty and time. Loosen one of them.',
      ],
      seed,
    };
  }

  // Bucket by slot, falling back to the whole pool when a slot is unpopulated
  // so the plan is still complete.
  const bySlot = new Map<MealSlot, Recipe[]>();
  for (const slot of preferences.mealsPerDay) {
    const matching = eligible.filter((recipe) => recipe.slot === slot);
    if (matching.length === 0) {
      warnings.push(
        `No ${slot} recipes fit your limits, so other meals are standing in.`,
      );
      bySlot.set(slot, eligible);
    } else {
      if (matching.length < cycleDays) {
        warnings.push(
          `Only ${matching.length} ${slot} recipes fit your limits, so some repeat.`,
        );
      }
      bySlot.set(slot, matching);
    }
  }

  if (eligible.length < preferences.mealsPerDay.length * cycleDays * 0.5) {
    warnings.push(
      `The library has ${eligible.length} recipes for these settings. Raising the time or difficulty limit will improve the fit.`,
    );
  }

  // 1. Greedy fill. Each pick is scored against the day's running totals, so
  //    the solver closes gaps instead of compounding them.
  const selection: Recipe[][] = [];

  for (let day = 0; day < cycleDays; day += 1) {
    const dayRecipes: Recipe[] = [];
    let totals = EMPTY_TOTALS;

    for (const slot of preferences.mealsPerDay) {
      const candidates = bySlot.get(slot) ?? eligible;

      // Sample rather than scan the whole library for every slot: with a
      // 1600-recipe pool an exhaustive scan is wasted work, and the hill-climb
      // recovers anything the sample misses.
      const sampleSize = Math.min(candidates.length, 40);
      let best: Recipe | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (let attempt = 0; attempt < sampleSize; attempt += 1) {
        const candidate = candidates[Math.floor(random() * candidates.length)];
        const projected = addRecipe(totals, candidate, 1);
        const scale = servingScaleFor(projected, targets);
        let candidateScore = scoreDay(projected, targets, scale);

        if (dayRecipes.some((recipe) => recipe.id === candidate.id)) {
          candidateScore += 2;
        }
        if (
          preferences.cuisines.length > 0 &&
          !preferences.cuisines.includes(candidate.cuisine)
        ) {
          candidateScore += 1.2;
        }

        if (candidateScore < bestScore) {
          bestScore = candidateScore;
          best = candidate;
        }
      }

      const chosen = best ?? candidates[0];
      dayRecipes.push(chosen);
      totals = addRecipe(totals, chosen, 1);
    }

    selection.push(dayRecipes);
  }

  // 2. Hill-climb.
  //
  // Best-of-K rather than one random swap per iteration. Against a pool of
  // several hundred recipes a single uniform draw almost never improves on an
  // already-decent pick, so the search stalls and days whose portion scaling
  // has hit its cap stay short of their energy target. Ranking a handful of
  // candidates on the affected day first - which is cheap, since only that day
  // changes - and then validating the winner against the whole plan finds
  // those improvements for roughly the same cost.
  let current = scorePlan(selection, targets, preferences, cycleDays);

  for (let iteration = 0; iteration < HILL_CLIMB_ITERATIONS; iteration += 1) {
    const day = Math.floor(random() * cycleDays);
    const slotIndex = Math.floor(random() * preferences.mealsPerDay.length);
    const slot = preferences.mealsPerDay[slotIndex];
    const candidates = bySlot.get(slot) ?? eligible;
    const previous = selection[day][slotIndex];

    let best: Recipe | null = null;
    let bestDayScore = Number.POSITIVE_INFINITY;

    for (let draw = 0; draw < HILL_CLIMB_SAMPLE; draw += 1) {
      const candidate = candidates[Math.floor(random() * candidates.length)];
      if (candidate.id === previous.id) continue;

      selection[day][slotIndex] = candidate;
      let dayScore = scoreRecipeDay(selection[day], targets);

      if (
        preferences.cuisines.length > 0 &&
        !preferences.cuisines.includes(candidate.cuisine)
      ) {
        dayScore += 1.2;
      }

      if (dayScore < bestDayScore) {
        bestDayScore = dayScore;
        best = candidate;
      }
    }

    selection[day][slotIndex] = previous;
    if (!best) continue;

    selection[day][slotIndex] = best;
    const candidateScore = scorePlan(selection, targets, preferences, cycleDays);

    if (candidateScore.score < current.score) {
      current = candidateScore;
    } else {
      selection[day][slotIndex] = previous;
    }
  }

  // 3. Emit the plan with per-day portion scaling applied.
  const meals: PlannedMeal[] = [];
  const totalsAcrossCycle: DayTotals[] = [];

  for (let day = 0; day < cycleDays; day += 1) {
    const scale = current.scales[day] ?? 1;
    let dayTotals = EMPTY_TOTALS;

    preferences.mealsPerDay.forEach((slot, slotIndex) => {
      const recipe = selection[day][slotIndex];
      meals.push({
        dayIndex: day,
        slot,
        recipeId: recipe.id,
        servings: Math.round(scale * 100) / 100,
      });
      dayTotals = addRecipe(dayTotals, recipe, scale);
    });

    totalsAcrossCycle.push(dayTotals);
  }

  const dayCount = Math.max(totalsAcrossCycle.length, 1);
  const sum = totalsAcrossCycle.reduce(
    (accumulator, day) => ({
      energy_kcal: accumulator.energy_kcal + day.energy_kcal,
      protein_g: accumulator.protein_g + day.protein_g,
      carbohydrate_g: accumulator.carbohydrate_g + day.carbohydrate_g,
      fiber_g: accumulator.fiber_g + day.fiber_g,
      sodium_mg: accumulator.sodium_mg + day.sodium_mg,
      fat_g: accumulator.fat_g + day.fat_g,
      cost: accumulator.cost + day.cost,
    }),
    EMPTY_TOTALS,
  );

  const averageNutrition: Record<string, number> = {
    energy_kcal: sum.energy_kcal / dayCount,
    protein_g: sum.protein_g / dayCount,
    carbohydrate_g: sum.carbohydrate_g / dayCount,
    fiber_g: sum.fiber_g / dayCount,
    sodium_mg: sum.sodium_mg / dayCount,
    fat_g: sum.fat_g / dayCount,
  };

  const costPerCycle = sum.cost;
  const costPerWeek = costPerCycle / (cycleDays / 7);

  if (preferences.weeklyBudget > 0 && costPerWeek > preferences.weeklyBudget * 1.05) {
    warnings.push(
      `This plan runs about ${costPerWeek.toFixed(0)} a week against a ${preferences.weeklyBudget.toFixed(0)} budget.`,
    );
  }

  return {
    cycleDays,
    meals,
    averageNutrition,
    costPerCycle,
    costPerWeek,
    score: current.score,
    warnings,
    seed,
  };
}

/** Total grams of each ingredient one cycle of a plan consumes. */
export function consumptionForPlan(
  plan: MealPlan,
  recipesById: Map<number, Recipe>,
): Map<string, number> {
  const consumption = new Map<string, number>();

  for (const meal of plan.meals) {
    const recipe = recipesById.get(meal.recipeId);
    if (!recipe) continue;

    // Recipe ingredient weights are for the whole dish; a portion is one
    // serving of it, scaled by how many portions the plan calls for.
    const portionFraction = meal.servings / Math.max(recipe.servings, 1);

    for (const ingredient of recipe.ingredients) {
      const grams = ingredient.grams * portionFraction;
      consumption.set(
        ingredient.id,
        (consumption.get(ingredient.id) ?? 0) + grams,
      );
    }
  }

  return consumption;
}

/** Every distinct piece of equipment a plan's recipes call for. */
export function equipmentForPlan(
  plan: MealPlan,
  recipesById: Map<number, Recipe>,
): string[] {
  const equipment = new Set<string>();
  for (const meal of plan.meals) {
    for (const item of recipesById.get(meal.recipeId)?.equipment ?? []) {
      equipment.add(item);
    }
  }
  return [...equipment].sort();
}

export { measure, fatPercentOfEnergy };
