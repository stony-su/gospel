/**
 * Field compositions.
 *
 * The uniform graticule was replaced because it competed with the foreground:
 * every rule, axis and bar edge in the app is also a hairline. The rule that
 * makes the replacement work is that no patch may sit behind content, and that
 * rule is worth enforcing here rather than leaving to the eye - a composition
 * drifts one edit at a time, and the drift is invisible until a gridline runs
 * through a nutrient bar.
 */

import { FIELDS, placeField, type FieldName } from '@/theme/field';

const NAMES = Object.keys(FIELDS) as FieldName[];

describe('field compositions', () => {
  it('defines every named composition', () => {
    expect(NAMES.length).toBeGreaterThan(0);
    for (const name of NAMES) expect(FIELDS[name].length).toBeGreaterThan(0);
  });

  it('keeps every patch in the outer eighth on at least one axis', () => {
    for (const name of NAMES) {
      for (const patch of FIELDS[name]) {
        const inMargin =
          patch.x + patch.w <= 0.125 ||
          patch.x >= 0.875 ||
          patch.y + patch.h <= 0.125 ||
          patch.y >= 0.875;

        // Reported as an object so a failure names the offending composition
        // and patch rather than just saying `false !== true`.
        expect({ name, patch, inMargin }).toEqual({ name, patch, inMargin: true });
      }
    }
  });

  it('keeps every patch inside the viewport', () => {
    for (const name of NAMES) {
      for (const patch of FIELDS[name]) {
        expect(patch.x).toBeGreaterThanOrEqual(0);
        expect(patch.y).toBeGreaterThanOrEqual(0);
        expect(patch.x + patch.w).toBeLessThanOrEqual(1);
        expect(patch.y + patch.h).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives every patch a positive extent', () => {
    for (const name of NAMES) {
      for (const patch of FIELDS[name]) {
        expect(patch.w).toBeGreaterThan(0);
        expect(patch.h).toBeGreaterThan(0);
      }
    }
  });
});

describe('placeField', () => {
  it('scales fractions to pixels', () => {
    const placed = placeField('dense', 400, 800);

    for (const patch of placed) {
      expect(patch.x).toBeGreaterThanOrEqual(0);
      expect(patch.x + patch.w).toBeLessThanOrEqual(400);
      expect(patch.y + patch.h).toBeLessThanOrEqual(800);
    }
  });

  it('returns nothing for a zero-size viewport', () => {
    expect(placeField('dense', 0, 0)).toEqual([]);
    expect(placeField('dense', 400, 0)).toEqual([]);
    expect(placeField('dense', 0, 800)).toEqual([]);
  });

  it('preserves patch count and kind', () => {
    const placed = placeField('landing', 400, 800);

    expect(placed).toHaveLength(FIELDS.landing.length);
    expect(placed.map((patch) => patch.kind)).toEqual(
      FIELDS.landing.map((patch) => patch.kind),
    );
  });

  it('scales with the viewport rather than being fixed', () => {
    const small = placeField('landing', 400, 800);
    const large = placeField('landing', 800, 1600);

    expect(large[0].w).toBeCloseTo(small[0].w * 2);
    expect(large[0].y).toBeCloseTo(small[0].y * 2);
  });
});
