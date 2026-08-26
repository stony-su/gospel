/**
 * A small set of mutually exclusive choices, shown at once.
 *
 * The active indicator is one element that slides between segments rather
 * than a highlight that cross-fades from one to another. Sliding says the
 * selection moved; cross-fading says two different things happened.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { grade, space, stroke } from '@/theme/tokens';
import { Label } from '@/ui/text';

interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const motion = useMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const position = useSharedValue(index);

  useEffect(() => {
    position.value = withSpring(index, motion.spring);
  }, [position, index, motion]);

  const segment = options.length > 0 ? width / options.length : 0;

  const indicator = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: position.value * segment }],
  }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.root} onLayout={onLayout}>
      {width > 0 && <Animated.View style={[styles.indicator, indicator]} />}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={styles.segment}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <Label color={active ? grade[0] : grade[70]}>{option.label}</Label>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    position: 'relative',
    borderWidth: stroke.hair,
    borderColor: grade[40],
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: grade[100],
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.xs,
  },
});
