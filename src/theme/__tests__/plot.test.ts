/**
 * Plot geometry.
 *
 * Every axis in the app is drawn from these two functions, so their edge
 * cases are the app's edge cases: a zero-width
 * domain (one nutrient, one reading), an inverted range (every screen y-axis,
 * where pixels grow downward), and tick values that must never surface a
 * float artefact to the user.
 */

import { linearScale, niceTicks, radarPoint } from '@/theme/plot';

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

describe('radarPoint', () => {
  const CENTRE = 100;
  const RADIUS = 80;

  it('puts the first axis at twelve o’clock', () => {
    const [x, y] = radarPoint(0, 6, 2, 2, RADIUS, CENTRE);
    expect(x).toBeCloseTo(CENTRE, 6);
    expect(y).toBeCloseTo(CENTRE - RADIUS, 6);
  });

  it('runs clockwise', () => {
    // A quarter of the way round a four-axis chart is three o'clock.
    const [x, y] = radarPoint(1, 4, 2, 2, RADIUS, CENTRE);
    expect(x).toBeCloseTo(CENTRE + RADIUS, 6);
    expect(y).toBeCloseTo(CENTRE, 6);
  });

  it('puts the reference ring at half the radius when the ceiling is two', () => {
    const [, y] = radarPoint(0, 6, 1, 2, RADIUS, CENTRE);
    expect(CENTRE - y).toBeCloseTo(RADIUS / 2, 6);
  });

  it('clamps beyond the ceiling rather than drawing off the canvas', () => {
    const far = radarPoint(0, 6, 9, 2, RADIUS, CENTRE);
    const edge = radarPoint(0, 6, 2, 2, RADIUS, CENTRE);
    expect(far).toEqual(edge);
  });

  it('puts a zero at the centre, not behind it', () => {
    expect(radarPoint(0, 6, 0, 2, RADIUS, CENTRE)).toEqual([CENTRE, CENTRE]);
    expect(radarPoint(0, 6, -3, 2, RADIUS, CENTRE)).toEqual([CENTRE, CENTRE]);
  });

  it('spaces the axes evenly all the way round', () => {
    const count = 6;
    const angles = Array.from({ length: count }, (_, index) => {
      const [x, y] = radarPoint(index, count, 2, 2, RADIUS, CENTRE);
      return Math.atan2(y - CENTRE, x - CENTRE);
    });
    for (let index = 1; index < count; index += 1) {
      const step = angles[index] - angles[index - 1];
      const normalised = ((step % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      expect(normalised).toBeCloseTo((Math.PI * 2) / count, 6);
    }
  });
});
