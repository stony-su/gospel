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

import { Readout } from '@/components/primitives/Text';
import { useGospel, useProfile, useTargets } from '@/store/useGospel';

function Probe() {
  const profile = useProfile();
  const targets = useTargets();
  return <Readout>{profile ? String(targets?.energy_kcal ?? 'no targets') : 'no profile'}</Readout>;
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
