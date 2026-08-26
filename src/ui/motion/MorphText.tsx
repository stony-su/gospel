/**
 * Text that changes without snapping.
 *
 * When a label's content changes - a zone name, a unit, a step title - it
 * fades out, swaps, and fades back in. Half a beat, but it stops the eye
 * being yanked to a word that simply appeared where a different word was.
 */

import { useEffect, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { Figure, Heading, Label, Prose, Title } from '@/ui/text';

type Variant = 'title' | 'heading' | 'label' | 'figure' | 'prose';

const RENDERERS = {
  title: Title,
  heading: Heading,
  label: Label,
  figure: Figure,
  prose: Prose,
} as const;

interface MorphTextProps {
  children: string;
  variant?: Variant;
  color?: string;
}

export function MorphText({ children, variant = 'figure', color }: MorphTextProps) {
  const motion = useMotion();
  const opacity = useSharedValue(1);

  // Held one beat behind `children` so the outgoing text is still on screen
  // while it fades. Swapping immediately would fade the *new* text in and out.
  const [shown, setShown] = useState(children);

  useEffect(() => {
    if (children === shown) return;

    opacity.value = withSequence(
      withTiming(0, { duration: motion.duration.fast, easing: motion.easing.accel }),
      withTiming(1, { duration: motion.duration.fast, easing: motion.easing.decel }),
    );

    const swap = setTimeout(() => setShown(children), motion.duration.fast);
    return () => clearTimeout(swap);
  }, [children, shown, opacity, motion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const Render = RENDERERS[variant];

  return (
    <Animated.View style={animated}>
      <Render color={color}>{shown}</Render>
    </Animated.View>
  );
}
