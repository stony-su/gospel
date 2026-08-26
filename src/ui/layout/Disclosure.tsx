/**
 * A collapsible section.
 *
 * The app's screens were carrying too much at once - forty-eight targets on
 * one scroll, a recipe's stats and nutrition and ingredients and equipment
 * and method stacked end to end. A page that shows everything shows nothing
 * in particular.
 *
 * The header always states what is inside and how much of it, so collapsing
 * hides the content without hiding its existence: `INGREDIENTS 12` tells you
 * as much as you usually need, and one tap tells you the rest.
 *
 * Height is animated from a measured value rather than a guess. The content
 * is laid out once, invisibly, so the first open animates to a known height
 * instead of snapping - a collapse that jumps the first time and glides
 * afterwards reads as a bug.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { grade, radius, space, stroke, surface } from '@/theme/tokens';
import { Press, Reveal } from '@/ui/motion';
import { Figure, Label } from '@/ui/text';

interface DisclosureProps {
  label: string;
  /** Shown in the header: an item count, a subtotal, a step count. */
  meta?: string;
  defaultOpen?: boolean;
  /** Position in the screen's stagger, as for Section. */
  index?: number;
  children: ReactNode;
}

export function Disclosure({
  label,
  meta,
  defaultOpen = false,
  index = 0,
  children,
}: DisclosureProps) {
  const motion = useMotion();
  const [open, setOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState(0);

  const progress = useSharedValue(defaultOpen ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: motion.duration.base,
      easing: motion.easing.standard,
    });
  }, [progress, open, motion]);

  const body = useAnimatedStyle(() => ({
    height: contentHeight * progress.value,
    opacity: progress.value,
  }));

  const caret = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  const onMeasure = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    if (measured > 0 && measured !== contentHeight) setContentHeight(measured);
  };

  return (
    <Reveal index={index} style={styles.root}>
      <Press
        onPress={() => setOpen((was) => !was)}
        plain
        accessibilityLabel={label}
        style={styles.header}
      >
        <Animated.View style={caret}>
          <Label color={open ? grade[100] : grade[60]}>›</Label>
        </Animated.View>
        <Label color={open ? grade[100] : grade[80]}>{label}</Label>
        <View style={styles.rule} />
        {meta ? (
          <Figure small color={grade[50]}>
            {meta}
          </Figure>
        ) : null}
      </Press>

      {/* Measured once, off-screen, so the first open knows where it is
          going. Zero height and no pointer events, so it costs a layout pass
          and nothing else. */}
      <View style={styles.measure} onLayout={onMeasure}>
        {children}
      </View>

      <Animated.View style={[styles.body, body]}>{children}</Animated.View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: space.md,
    backgroundColor: surface.panel,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  rule: {
    flex: 1,
    height: stroke.hair,
    backgroundColor: grade[30],
  },
  measure: {
    pointerEvents: 'none',
    position: 'absolute',
    opacity: 0,
    left: space.md,
    right: space.md,
    top: 0,
  },
  body: {
    overflow: 'hidden',
    paddingHorizontal: space.md,
  },
});
