/**
 * Plot geometry.
 *
 * Every axis in the app is drawn from these two functions, so their edge
 * cases are the app's edge cases: a zero-width
 * domain (one nutrient, one reading), an inverted range (every screen y-axis,
 * where pixels grow downward), and tick values that must never surface a
 * float artefact to the user.
 */

import { linearScale, niceTicks } from '@/theme/plot';

describe('linearScale', () => {
  it('maps the domain onto the range', () => {
    const s = linearScale([0, 100], [0, 200]);
    expect(s(0)).toBe(0);
    expect(s(50)).toBe(100);
    expect(s(100)).toBe(200);
  });

  it('inverts', () => {
    const s = linearScale([0, 100], [0, 200]);
    expect(s.invert(100)).toBe(50);
  });

  it('handles an inverted range, as screen y-axes need', () => {
    const s = linearScale([0, 100], [200, 0]);
    expect(s(0)).toBe(200);
    expect(s(100)).toBe(0);
  });

  it('collapses a zero-width domain onto the range start rather than dividing by zero', () => {
    const s = linearScale([5, 5], [0, 200]);
    expect(Number.isFinite(s(5))).toBe(true);
    expect(s(5)).toBe(0);
  });

  it('carries its domain and range for callers that need to re-derive', () => {
    const s = linearScale([0, 10], [0, 50]);
    expect(s.domain).toEqual([0, 10]);
    expect(s.range).toEqual([0, 50]);
  });
});

describe('niceTicks', () => {
  it('rounds to 1/2/5 x 10^n', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('never emits a long fraction', () => {
    for (const t of niceTicks(0, 3.7142, 4)) {
      expect(String(t).replace('-', '').replace('.', '').length).toBeLessThanOrEqual(4);
    }
  });

  it('spans negative domains', () => {
    const ticks = niceTicks(-50, 50, 4);
    expect(ticks[0]).toBeLessThanOrEqual(-50);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(50);
    expect(ticks).toContain(0);
  });

  it('returns a single tick for a zero-width domain instead of looping forever', () => {
    expect(niceTicks(7, 7, 5)).toEqual([7]);
  });

  it('covers the whole domain it was given', () => {
    const ticks = niceTicks(3, 97, 5);
    expect(ticks[0]).toBeLessThanOrEqual(3);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(97);
  });
});
