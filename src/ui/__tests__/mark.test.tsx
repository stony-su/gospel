/**
 * Status marks.
 *
 * Four branches with a precedence order that is easy to get subtly wrong,
 * and the wrong answer is a nutrient silently reported as fine while it is
 * over its upper limit. Worth pinning every branch.
 */

import type { ResolvedNutrient } from '@/domain/nutrition/types';
import { barFraction, formatAmount, markFor } from '@/ui/data/mark';

const nutrient = (over: Partial<ResolvedNutrient>): ResolvedNutrient =>
  ({
    nutrient_id: 'iron',
    nutrient_name: 'Iron',
    category: 'mineral',
    unit: 'mg',
    basis: 'RDA',
    value: 18,
    ul_value: 45,
    pct_of_ul: null,
    over_ul: false,
    approaching_ul: false,
    rules_applied: [],
    flags: [],
    lowest_confidence: null,
    source_ids: [],
    notes: null,
    ...over,
  }) as ResolvedNutrient;

describe('markFor', () => {
  it('is hollow below target', () => {
    expect(markFor(nutrient({}), 12)).toBe('hollow');
  });

  it('is solid at exactly the target', () => {
    expect(markFor(nutrient({}), 18)).toBe('solid');
  });

  it('is solid above target', () => {
    expect(markFor(nutrient({}), 30)).toBe('solid');
  });

  it('is hatched when approaching the upper limit', () => {
    expect(markFor(nutrient({ approaching_ul: true }), 40)).toBe('hatch');
  });

  it('is inverted over the upper limit', () => {
    expect(markFor(nutrient({ over_ul: true }), 60)).toBe('inverted');
  });

  it('reports a breach rather than a met target when both are true', () => {
    expect(markFor(nutrient({ over_ul: true, approaching_ul: true }), 60)).toBe('inverted');
  });

  it('reports a breach even when intake is somehow below target', () => {
    expect(markFor(nutrient({ over_ul: true }), 1)).toBe('inverted');
  });
});

describe('barFraction', () => {
  it('is the plain ratio below target', () => {
    expect(barFraction(9, 18)).toBe(0.5);
  });

  it('caps at the full track on an overshoot', () => {
    expect(barFraction(60, 18)).toBe(1);
  });

  it('fills nothing for a zero target rather than dividing by it', () => {
    expect(barFraction(5, 0)).toBe(0);
  });

  it('fills nothing for a non-finite intake', () => {
    expect(barFraction(Number.NaN, 18)).toBe(0);
  });

  it('never goes negative', () => {
    expect(barFraction(-5, 18)).toBe(0);
  });
});

describe('formatAmount', () => {
  it('drops decimals on large values', () => {
    expect(formatAmount(2444)).toBe('2444');
  });

  it('keeps one decimal in the tens', () => {
    expect(formatAmount(18)).toBe('18.0');
  });

  it('keeps two decimals on small values, where the precision is real', () => {
    expect(formatAmount(1.5)).toBe('1.50');
  });

  it('renders a dash rather than NaN', () => {
    expect(formatAmount(Number.NaN)).toBe('—');
  });
});

describe('markFor, unmeasured intake', () => {
  it('is unmeasured when the recipe data cannot measure the nutrient', () => {
    expect(markFor(nutrient({}), null)).toBe('unmeasured');
  });

  it('distinguishes unmeasured from a genuine zero intake', () => {
    expect(markFor(nutrient({}), 0)).toBe('hollow');
  });

  it('still reports a target that breaches its UL when intake is unknown', () => {
    expect(markFor(nutrient({ over_ul: true }), null)).toBe('inverted');
  });

  it('still reports an approaching UL when intake is unknown', () => {
    expect(markFor(nutrient({ approaching_ul: true }), null)).toBe('hatch');
  });
});

describe('formatAmount, absent values', () => {
  it('renders a dash for null rather than a zero', () => {
    expect(formatAmount(null)).toBe('—');
  });
});
