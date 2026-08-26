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
import { grade, stroke } from '@/theme/tokens';

interface PressProps {
  children: ReactNode;
  onPress: () => void;
  /** Draws the selection rule. */
  selected?: boolean;
  /** Hides the selection rule entirely, for surfaces that are not choices. */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
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
}: PressProps) {
  const motion = useMotion();
  const scale = useSharedValue(1);
  const rule = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    rule.value = withTiming(selected ? 1 : 0, {
      duration: motion.duration.base,
      easing: motion.easing.standard,
    });
  }, [rule, selected, motion]);

  const surface = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
    >
      <Animated.View style={[styles.row, style, surface]}>
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
  rule: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: RULE_WIDTH,
    backgroundColor: grade[100],
  },
});

export const RULE = { width: RULE_WIDTH, weight: stroke.medium };
