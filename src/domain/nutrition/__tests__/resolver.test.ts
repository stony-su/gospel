/**
 * The resolver is checked against the workbook's own golden vectors:
 * 4 personas x 48 nutrients, with the expected value, UL comparison, the
 * exact set of rule ids that should have fired, and the flags each should
 * raise. If the TypeScript port drifts from the published algorithm, these
 * fail loudly.
 */

import goldenVectors from '@/data/generated/golden_vectors.json';
import { resolveTargets } from '../resolver';
import type { NutritionProfile } from '../types';

interface GoldenExpectation {
  nutrient_id: string;
  unit: string;
  value: number | null;
  ul_value: number | null;
  pct_of_ul: number | null;
  over_ul: boolean;
  approaching_ul: boolean;
  rules_applied: string[];
  flags: string[];
}

interface GoldenPersona {
  persona_id: string;
  profile: NutritionProfile;
  expected: GoldenExpectation[];
}

const personas = (goldenVectors as { personas: GoldenPersona[] }).personas;

/** The workbook rounds published values, so allow a hair of slack. */
function closeEnough(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= Math.max(0.01, Math.abs(expected) * 1e-4);
}

describe('resolveTargets against workbook golden vectors', () => {
  it('has loaded all four personas', () => {
    expect(personas).toHaveLength(4);
    expect(personas.every((p) => p.expected.length === 48)).toBe(true);
  });

  describe.each(personas.map((p) => [p.persona_id, p] as const))(
    '%s',
    (_id, persona) => {
      const resolved = resolveTargets(persona.profile);

      it('resolves every nutrient in the dataset', () => {
        expect(resolved.nutrients).toHaveLength(persona.expected.length);
      });

      it('matches every published target value', () => {
        const mismatches = persona.expected
          .filter((exp) => exp.value !== null)
          .map((exp) => {
            const actual = resolved.byId[exp.nutrient_id];
            if (!actual) return `${exp.nutrient_id}: missing from output`;
            if (!closeEnough(actual.value, exp.value as number)) {
              return `${exp.nutrient_id}: got ${actual.value}, want ${exp.value} ${exp.unit}`;
            }
            return null;
          })
          .filter(Boolean);

        expect(mismatches).toEqual([]);
      });

      it('applies exactly the rules the workbook says apply', () => {
        const mismatches = persona.expected
          .map((exp) => {
            const actual = resolved.byId[exp.nutrient_id];
            if (!actual) return `${exp.nutrient_id}: missing from output`;
            const got = [...actual.rules_applied].sort().join(',');
            const want = [...exp.rules_applied].sort().join(',');
            return got === want
              ? null
              : `${exp.nutrient_id}: rules [${got}] want [${want}]`;
          })
          .filter(Boolean);

        expect(mismatches).toEqual([]);
      });

      it('raises exactly the flags the workbook says apply', () => {
        const mismatches = persona.expected
          .map((exp) => {
            const actual = resolved.byId[exp.nutrient_id];
            if (!actual) return `${exp.nutrient_id}: missing from output`;
            const got = [...actual.flags].sort().join(',');
            const want = [...exp.flags].sort().join(',');
            return got === want
              ? null
              : `${exp.nutrient_id}: flags [${got}] want [${want}]`;
          })
          .filter(Boolean);

        expect(mismatches).toEqual([]);
      });

      it('agrees on upper-limit breaches', () => {
        const mismatches = persona.expected
          .map((exp) => {
            const actual = resolved.byId[exp.nutrient_id];
            if (!actual) return `${exp.nutrient_id}: missing from output`;
            if (actual.over_ul !== exp.over_ul) {
              return `${exp.nutrient_id}: over_ul ${actual.over_ul} want ${exp.over_ul}`;
            }
            if (actual.approaching_ul !== exp.approaching_ul) {
              return `${exp.nutrient_id}: approaching_ul ${actual.approaching_ul} want ${exp.approaching_ul}`;
            }
            return null;
          })
          .filter(Boolean);

        expect(mismatches).toEqual([]);
      });
    },
  );
});

describe('scope handling', () => {
  it('marks under-19 profiles as out of scope', () => {
    const resolved = resolveTargets({
      sex: 'female',
      weight_kg: 55,
      age_years: 16,
      diet_type: 'iifym',
      activity_level: 'moderate',
      sun_zone: 'temperate',
    });

    expect(resolved.outOfScope).toBe(true);
    expect(resolved.flags).toContain('AGE_OUT_OF_SCOPE');
  });

  it('keeps adults in scope', () => {
    const resolved = resolveTargets({
      sex: 'female',
      weight_kg: 55,
      age_years: 19,
      diet_type: 'iifym',
      activity_level: 'moderate',
      sun_zone: 'temperate',
    });

    expect(resolved.outOfScope).toBe(false);
  });
});

describe('the compounding caution the workbook documents', () => {
  it('flags iron over the upper limit for a vegan very-active premenopausal woman', () => {
    const resolved = resolveTargets({
      sex: 'female',
      weight_kg: 62,
      age_years: 30,
      diet_type: 'vegan',
      activity_level: 'very_active',
      sun_zone: 'temperate',
    });

    const iron = resolved.byId.iron_mg;
    expect(iron.value).toBeGreaterThan(45);
    expect(iron.over_ul).toBe(true);
  });
});
