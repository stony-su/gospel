/**
 * A pressable that acknowledges the press.
 *
 * Two behaviours, both cheap: the surface takes a small scale on press-down
 * so a tap is felt as well as seen, and a selected row grows a rule from its
 * left edge rather than having one appear. The rule is the only selection
 * marker in the app now that colour is gone, so it is worth drawing well.
 */

import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { grade, radius, stroke, surface, surfaceFade } from '@/theme/tokens';

interface PressProps {
  children: ReactNode;
  onPress: () => void;
  /** Draws the selection rule. */
  selected?: boolean;
  /** Hides the selection rule entirely, for surfaces that are not choices. */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Lets the pressable take part in its parent's flex row.
   *
   * `style` is applied to the inner animated view, because that is the thing
   * that scales on press and the padding has to scale with it. The Pressable
   * outside it therefore stays `flex: 0 0 auto`, which is invisible until a
   * caller puts one in a row and expects it to give way - at which point it
   * silently overflows instead.
   */
  grow?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link' | 'checkbox' | 'radio';
  disabled?: boolean;
}

const RULE_WIDTH = 2;

export function Press({
  children,
  onPress,
  selected = false,
  plain = false,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled = false,
  grow = false,
}: PressProps) {
  const motion = useMotion();
  const scale = useSharedValue(1);
  const rule = useSharedValue(selected ? 1 : 0);
  const lift = useSharedValue(0);

  useEffect(() => {
    rule.value = withTiming(selected ? 1 : 0, {
      duration: motion.duration.base,
      easing: motion.easing.standard,
    });
  }, [rule, selected, motion]);

  const body = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Presses lift a step as well as scaling: with no colour, a change of level
  // is the clearest way to say "this one". Drawn as an overlay rather than as
  // a background, so it composes with whatever surface the caller set instead
  // of replacing it.
  const liftStyle = useAnimatedStyle(() => ({ opacity: lift.value }));

  // Scales from the left edge, so it reads as sweeping in rather than growing
  // out of its own middle.
  const ruleStyle = useAnimatedStyle(() => ({
    opacity: rule.value,
    transform: [{ scaleY: rule.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, motion.spring);
        lift.value = withTiming(1, { duration: motion.duration.instant });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
        lift.value = withTiming(0, { duration: motion.duration.fast });
      }}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      style={grow ? styles.grow : undefined}
    >
      <Animated.View style={[styles.row, style, body]}>
        <Animated.View style={[styles.lift, liftStyle]} />
        {!plain && <Animated.View style={[styles.rule, ruleStyle]} />}
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
  },
  grow: {
    flex: 1,
    // Without this the pressable will not shrink below the width of the text
    // inside it, which is the whole point of asking it to grow.
    minWidth: 0,
  },
  lift: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
    backgroundColor: surface.raised,
    experimental_backgroundImage: surfaceFade.raised,
    borderRadius: radius.md,
  },
  rule: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: RULE_WIDTH,
    backgroundColor: grade[96],
  },
});

export const RULE = { width: RULE_WIDTH, weight: stroke.medium };
