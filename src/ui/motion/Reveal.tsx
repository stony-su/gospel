/**
 * Staggered entrance.
 *
 * Sections arrive in sequence rather than all at once, which gives the eye an
 * order to read the screen in. The stagger is driven by `index`, so a screen
 * expresses its reading order by numbering its sections and nothing has to
 * coordinate timers.
 */

import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';

interface RevealProps {
  children: ReactNode;
  /** Position in the stagger. Section 0 arrives first. */
  index?: number;
  /** Extra delay in ms, on top of the index stagger. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const RISE = 12;

export function Reveal({ children, index = 0, delay = 0, style }: RevealProps) {
  const motion = useMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    const wait = index * motion.stagger + delay;
    progress.value = withDelay(
      wait,
      withTiming(1, { duration: motion.duration.base, easing: motion.easing.decel }),
    );
  }, [progress, index, delay, motion]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * RISE }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
