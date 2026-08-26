/**
 * Reanimated wiring under jsdom.
 *
 * The animated primitives are only testable in this environment because
 * `src/test/reanimatedMock.ts` resolves every animation to its final value.
 * This suite guards that arrangement: if the mapping in package.json is lost
 * or the mock drifts from the API the primitives use, this fails here rather
 * than as a confusing TurboModule error inside an unrelated component test.
 */

import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';

function Probe() {
  const motion = useMotion();
  const opacity = useSharedValue(0);
  opacity.value = withTiming(1, { duration: motion.duration.base });
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={style}>
      <Text>{`settled:${opacity.value}`}</Text>
    </Animated.View>
  );
}

describe('reanimated under jsdom', () => {
  it('renders an animated view at its settled value', () => {
    render(<Probe />);
    expect(screen.getByText('settled:1')).toBeTruthy();
  });
});

describe('useMotion', () => {
  it('reports motion enabled and carries the full duration scale', () => {
    let seen: ReturnType<typeof useMotion> | null = null;

    function Reader() {
      seen = useMotion();
      return <Text>read</Text>;
    }

    render(<Reader />);

    expect(seen).not.toBeNull();
    expect(seen!.enabled).toBe(true);
    expect(seen!.duration.base).toBe(240);
    expect(seen!.stagger).toBe(40);
  });
});
