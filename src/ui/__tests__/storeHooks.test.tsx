/**
 * Derived store hooks, rendered.
 *
 * useProfile and useTargets build objects that exist nowhere in the store, and
 * zustand compares selector results with Object.is. Deriving inside the
 * selector therefore makes every snapshot look changed and sends
 * useSyncExternalStore into an unbounded render loop - which only fires once
 * the answers are complete enough for profileFrom to return an object, so the
 * null path cannot catch it. This renders the complete path.
 */

import { render, screen } from '@testing-library/react';

import { Display } from '@/ui/text';
import { planMatchesLibrary, useGospel, useProfile, useTargets } from '@/store/useGospel';
import { recipes } from '@/data/recipes';

function Probe() {
  const profile = useProfile();
  const targets = useTargets();
  return <Display>{profile ? String(targets?.energy_kcal ?? 'no targets') : 'no profile'}</Display>;
}

describe('useProfile / useTargets', () => {
  it('renders once with a complete profile rather than looping', () => {
    useGospel.setState({
      answers: {
        ...useGospel.getState().answers,
        sex: 'male',
        weight_kg: 75,
        age_years: 30,
        diet_type: 'iifym',
        activity_level: 'moderate',
        sun_zone: 'temperate',
      },
    });

    expect(() => render(<Probe />)).not.toThrow();
    expect(screen.queryByText('no profile')).toBeNull();
  });

  it('yields null on both hooks while onboarding is incomplete', () => {
    useGospel.setState({ answers: { ...useGospel.getState().answers, sex: null } });

    render(<Probe />);

    expect(screen.getByText('no profile')).toBeTruthy();
  });
});

/**
 * The corpus can be replaced under a saved plan, and was: the library went
 * from 1,600 Food.com rows to 100 dishes built from Wikimedia pages, and not
 * one id survived. A plan that outlives its library does not fail loudly -
 * the plan tab renders nothing for the meals it cannot resolve - so the
 * check has to happen on the way in.
 */
describe('planMatchesLibrary', () => {
  const meal = (recipeId: number) => ({
    dayIndex: 0,
    slot: 'dinner' as const,
    recipeId,
    servings: 1,
  });

  const planWith = (recipeIds: number[]) =>
    ({
      cycleDays: 7 as const,
      meals: recipeIds.map(meal),
      averageNutrition: {},
      costPerCycle: 0,
      costPerWeek: 0,
      score: 0,
      warnings: [],
      seed: 1,
    });

  it('accepts no plan at all', () => {
    expect(planMatchesLibrary(null)).toBe(true);
  });

  it('accepts a plan whose recipes are all in the library', () => {
    const known = recipes.slice(0, 3).map((recipe) => recipe.id);
    expect(known).toHaveLength(3);
    expect(planMatchesLibrary(planWith(known))).toBe(true);
  });

  it('rejects a plan holding an id the library no longer has', () => {
    const known = recipes[0].id;
    expect(planMatchesLibrary(planWith([known, -1]))).toBe(false);
  });
});
