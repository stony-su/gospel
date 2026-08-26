/**
 * A number that travels.
 *
 * Numbers are what this app is for, so they never cut from one value to the
 * next - a jump has to be re-read, whereas a value that moves tells you which
 * direction it went before you have finished looking at it.
 *
 * Reanimated cannot animate `Text` children, because children are not a prop
 * it can drive on the UI thread. The standard way around that is an animated
 * TextInput whose `text` prop is animated instead, which is what this does:
 * a non-editable input, stripped of every affordance, so it is visually a
 * piece of text and nothing else.
 */

import { useEffect } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { grade, registers } from '@/theme/tokens';

const AnimatedInput = Animated.createAnimatedComponent(TextInput);

type Variant = 'display' | 'figure' | 'figureSmall';

interface AnimatedNumberProps {
  value: number;
  /** Decimal places. Defaults to whole numbers. */
  precision?: number;
  prefix?: string;
  suffix?: string;
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function AnimatedNumber({
  value,
  precision = 0,
  prefix = '',
  suffix = '',
  variant = 'figure',
  color,
  style,
}: AnimatedNumberProps) {
  const motion = useMotion();
  const current = useSharedValue(value);

  useEffect(() => {
    current.value = withTiming(value, {
      duration: motion.duration.slow,
      easing: motion.easing.standard,
    });
  }, [current, value, motion]);

  const animatedProps = useAnimatedProps(() => ({
    text: `${prefix}${current.value.toFixed(precision)}${suffix}`,
    // `value` keeps the web renderer in sync; on native `text` is the one
    // that lands, and setting both is what makes this work on either.
    value: `${prefix}${current.value.toFixed(precision)}${suffix}`,
  })) as Partial<{ text: string; value: string }>;

  return (
    <AnimatedInput
      editable={false}
      // Not focusable, not selectable, not a form control - a readout.
      accessibilityRole="text"
      underlineColorAndroid="transparent"
      defaultValue={`${prefix}${value.toFixed(precision)}${suffix}`}
      animatedProps={animatedProps}
      style={[
        registers[variant],
        styles.reset,
        { color: color ?? (variant === 'display' ? grade[100] : grade[70]) },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  reset: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});
