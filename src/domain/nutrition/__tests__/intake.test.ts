/**
 * Intake computed from ingredient panels.
 *
 * The interesting cases are all about missing data. FDC does not carry every
 * nutrient for every food - amino acids in particular are present only where
 * USDA ran a full protein analysis - so a recipe's total for a nutrient is
 * routinely the sum over a subset of its ingredients.
 *
 * The policy is to sum whatever exists rather than withhold the number, which
 * means a total can understate. `coverage` is what makes that legible: it is
 * the share of the recipe's mass that actually carried a value, so an
 * undercount is knowable even though it is still reported.
 */

import { averageDailyIntake, intakeForRecipe, type PanelIndex } from '@/domain/nutrition/intake';

const panels: PanelIndex = {
  butter: { per_100g: { energy_kcal: 717, calcium_mg: 24, aa_lysine_mg: 61 } },
  sugar: { per_100g: { energy_kcal: 387, calcium_mg: 1 } },
  eggs: { per_100g: { energy_kcal: 143, calcium_mg: 56, aa_lysine_mg: 912 } },
};

describe('intakeForRecipe', () => {
  it('sums per 100g values scaled by grams, then divides by servings', () => {
    const result = intakeForRecipe(
      [{ id: 'butter', grams: 100 }],
      2,
      panels,
    );

    expect(result.perServing.energy_kcal).toBeCloseTo(717 / 2);
    expect(result.perServing.calcium_mg).toBeCloseTo(24 / 2);
  });

  it('scales by the ingredient weight', () => {
    const result = intakeForRecipe([{ id: 'butter', grams: 50 }], 1, panels);

    expect(result.perServing.energy_kcal).toBeCloseTo(717 * 0.5);
  });

  it('adds contributions across ingredients', () => {
    const result = intakeForRecipe(
      [
        { id: 'butter', grams: 100 },
        { id: 'sugar', grams: 100 },
      ],
      1,
      panels,
    );

    expect(result.perServing.energy_kcal).toBeCloseTo(717 + 387);
    expect(result.perServing.calcium_mg).toBeCloseTo(24 + 1);
  });

  it('reports full coverage when every ingredient carries the nutrient', () => {
    const result = intakeForRecipe(
      [
        { id: 'butter', grams: 100 },
        { id: 'sugar', grams: 100 },
      ],
      1,
      panels,
    );

    expect(result.coverage.energy_kcal).toBeCloseTo(1);
  });

  it('sums a partially covered nutrient and says how partial it was', () => {
    // Sugar has no lysine figure, so half the mass contributes nothing.
    const result = intakeForRecipe(
      [
        { id: 'butter', grams: 100 },
        { id: 'sugar', grams: 100 },
      ],
      1,
      panels,
    );

    expect(result.perServing.aa_lysine_mg).toBeCloseTo(61);
    expect(result.coverage.aa_lysine_mg).toBeCloseTo(0.5);
  });

  it('weights coverage by mass, not by ingredient count', () => {
    const result = intakeForRecipe(
      [
        { id: 'butter', grams: 10 },
        { id: 'sugar', grams: 90 },
      ],
      1,
      panels,
    );

    expect(result.coverage.aa_lysine_mg).toBeCloseTo(0.1);
  });

  it('treats an unknown ingredient as uncovered rather than as zero', () => {
    const result = intakeForRecipe(
      [
        { id: 'butter', grams: 100 },
        { id: 'unobtainium', grams: 100 },
      ],
      1,
      panels,
    );

    expect(result.perServing.energy_kcal).toBeCloseTo(717);
    expect(result.coverage.energy_kcal).toBeCloseTo(0.5);
  });

  it('omits a nutrient no ingredient carries rather than reporting zero', () => {
    const result = intakeForRecipe([{ id: 'sugar', grams: 100 }], 1, panels);

    expect(result.perServing.aa_lysine_mg).toBeUndefined();
    expect(result.coverage.aa_lysine_mg ?? 0).toBe(0);
  });

  it('returns nothing for an empty recipe', () => {
    expect(intakeForRecipe([], 4, panels).perServing).toEqual({});
  });

  it('guards a zero serving count rather than dividing by it', () => {
    const result = intakeForRecipe([{ id: 'butter', grams: 100 }], 0, panels);

    expect(Number.isFinite(result.perServing.energy_kcal)).toBe(true);
    expect(result.perServing.energy_kcal).toBeCloseTo(717);
  });

  it('ignores an ingredient with no weight', () => {
    const result = intakeForRecipe(
      [
        { id: 'butter', grams: 100 },
        { id: 'sugar', grams: 0 },
      ],
      1,
      panels,
    );

    expect(result.coverage.energy_kcal).toBeCloseTo(1);
  });
});

describe('averageDailyIntake', () => {
  const recipes = new Map([
    [1, { ingredients: [{ id: 'butter', grams: 100 }], servings: 1 }],
    [2, { ingredients: [{ id: 'sugar', grams: 100 }], servings: 1 }],
  ]);

  it('averages across the days of the cycle', () => {
    const result = averageDailyIntake(
      [
        { recipeId: 1, servings: 1 },
        { recipeId: 2, servings: 1 },
      ],
      recipes,
      panels,
      2,
    );

    expect(result.perServing.energy_kcal).toBeCloseTo((717 + 387) / 2);
  });

  it('multiplies a meal by its serving count', () => {
    const result = averageDailyIntake([{ recipeId: 1, servings: 2 }], recipes, panels, 1);

    expect(result.perServing.energy_kcal).toBeCloseTo(717 * 2);
  });

  it('skips a meal whose recipe is missing', () => {
    const result = averageDailyIntake([{ recipeId: 99, servings: 1 }], recipes, panels, 1);

    expect(result.perServing).toEqual({});
  });

  it('guards a zero-day cycle', () => {
    const result = averageDailyIntake([{ recipeId: 1, servings: 1 }], recipes, panels, 0);

    expect(Number.isFinite(result.perServing.energy_kcal)).toBe(true);
  });
});
