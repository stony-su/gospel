/**
 * The adaptive grocery list.
 *
 * The behaviour the product asks for: a tub of sour cream lasts three weeks,
 * so it must not appear on weeks two and three's lists, and must reappear on
 * the week its stock runs out. Everything here is a test of that idea in its
 * various shapes.
 */

import { simulatePantry } from '../depletion';
import type { Ingredient } from '../types';

const sourCream: Ingredient = {
  id: 'sour cream',
  name: 'Sour cream',
  category: 'dairy_cultured',
  aisle: 'Dairy',
  price_per_kg: 4.2,
  shelf_life_days: 21,
  pack_g: 300,
  staple: false,
  unit_g: 100,
};

const salt: Ingredient = {
  id: 'salt',
  name: 'Salt',
  category: 'spice',
  aisle: 'Spices & Herbs',
  price_per_kg: 0.9,
  shelf_life_days: 3650,
  pack_g: 750,
  staple: true,
  unit_g: 100,
};

const chicken: Ingredient = {
  id: 'chicken breast',
  name: 'Chicken breast',
  category: 'meat_poultry',
  aisle: 'Meat & Fish',
  price_per_kg: 9.5,
  shelf_life_days: 3,
  pack_g: 500,
  staple: false,
  unit_g: 180,
};

const catalogue = Object.fromEntries(
  [sourCream, salt, chicken].map((item) => [item.id, item]),
);

describe('simulatePantry', () => {
  it('buys a full pack when the pantry is empty', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['sour cream', 60]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 1,
    });

    const [line] = result.cycles[0].lines;
    expect(line.ingredientId).toBe('sour cream');
    expect(line.requiredGrams).toBe(60);
    expect(line.availableGrams).toBe(0);
    expect(line.packsToBuy).toBe(1);
    expect(line.gramsToBuy).toBe(300);
    expect(line.cost).toBeCloseTo(1.26, 2);
  });

  it('omits an ingredient the pantry already covers', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['sour cream', 60]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 3,
    });

    // 300 g bought in cycle 0 covers 60 g a week for five weeks on volume,
    // but the 21-day shelf life is what actually decides.
    expect(result.cycles[1].lines).toHaveLength(0);
    expect(result.cycles[1].coveredByPantry).toContain('sour cream');
    expect(result.cycles[2].lines).toHaveLength(0);
  });

  it('puts sour cream back on the list the week its stock expires', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['sour cream', 60]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 5,
    });

    const boughtIn = result.cycles
      .filter((cycle) => cycle.lines.some((line) => line.ingredientId === 'sour cream'))
      .map((cycle) => cycle.cycleIndex);

    // Bought at the start, and again once the 21-day life lapses at day 21.
    expect(boughtIn).toEqual([0, 3]);
  });

  it('reports what expired rather than silently dropping it', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['sour cream', 60]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 4,
    });

    // 300 bought, 180 eaten over three cycles, 120 thrown away at day 21.
    expect(result.cycles[3].expiredGrams).toBeCloseTo(120, 5);
  });

  it('rebuys a short-life ingredient every single cycle', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['chicken breast', 400]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 4,
    });

    for (const cycle of result.cycles) {
      const line = cycle.lines.find((l) => l.ingredientId === 'chicken breast');
      expect(line).toBeDefined();
      expect(line?.packsToBuy).toBe(1);
    }
  });

  it('buys a long-life staple once and never again', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['salt', 5]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 12,
    });

    // Staples are a one-time setup purchase, not a weekly line.
    expect(result.oneTimeItems.map((item) => item.ingredientId)).toContain('salt');
    for (const cycle of result.cycles) {
      expect(cycle.lines.some((line) => line.ingredientId === 'salt')).toBe(false);
    }
  });

  it('buys enough packs to cover a large requirement at once', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['chicken breast', 1700]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 1,
    });

    const [line] = result.cycles[0].lines;
    expect(line.packsToBuy).toBe(4);
    expect(line.gramsToBuy).toBe(2000);
  });

  it('counts leftover stock against the next requirement', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['sour cream', 200]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 2,
    });

    // 300 bought in cycle 0, 200 used, 100 left and still in date.
    const line = result.cycles[1].lines.find((l) => l.ingredientId === 'sour cream');
    expect(line?.availableGrams).toBeCloseTo(100, 5);
    expect(line?.partiallyCovered).toBe(true);
    expect(line?.packsToBuy).toBe(1);
  });

  it('separates equipment into a one-time list', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['sour cream', 60]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 2,
      equipment: ['blender', 'springform pan', 'blender'],
    });

    expect(result.equipment).toEqual(['blender', 'springform pan']);
  });

  it('totals the cost of each cycle', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([
        ['chicken breast', 400],
        ['sour cream', 60],
      ]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 1,
    });

    // One 500 g chicken pack at 9.50/kg plus one 300 g sour cream at 4.20/kg.
    expect(result.cycles[0].totalCost).toBeCloseTo(4.75 + 1.26, 2);
  });

  it('ignores ingredients missing from the catalogue rather than crashing', () => {
    const result = simulatePantry({
      consumptionPerCycle: new Map([['unicorn tears', 10]]),
      ingredients: catalogue,
      cycleDays: 7,
      cycleCount: 1,
    });

    expect(result.cycles[0].lines).toHaveLength(0);
  });
});
