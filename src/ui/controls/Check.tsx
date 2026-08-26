/**
 * A checkable line, for the grocery list.
 *
 * The mark draws itself in rather than appearing, and a checked line drops
 * down the grade ramp instead of being struck through - the item is done,
 * not deleted, and it still has to be findable in the list.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { grade, space, stroke } from '@/theme/tokens';
import { Press } from '@/ui/motion';
import { Figure } from '@/ui/text';

interface CheckProps {
  label: string;
  meta?: string;
  checked: boolean;
  onPress: () => void;
}

const BOX = 12;

export function Check({ label, meta, checked, onPress }: CheckProps) {
  const motion = useMotion();
  const on = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(checked ? 1 : 0, {
      duration: motion.duration.fast,
      easing: motion.easing.standard,
    });
  }, [on, checked, motion]);

  // The mark grows from the box's own corner, so it reads as being drawn.
  const mark = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: on.value }],
  }));

  return (
    <Press
      onPress={onPress}
      plain
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      style={styles.root}
    >
      <View style={styles.body}>
        <View style={styles.box}>
          <Animated.View style={[styles.mark, mark]} />
        </View>
        <Figure color={checked ? grade[50] : grade[90]} style={styles.label}>
          {label}
        </Figure>
        {meta ? <Figure small color={checked ? grade[40] : grade[60]}>{meta}</Figure> : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: stroke.hair,
    borderBottomColor: grade[30],
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    gap: space.sm,
  },
  box: {
    width: BOX,
    height: BOX,
    borderWidth: stroke.thin,
    borderColor: grade[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: BOX - 6,
    height: BOX - 6,
    backgroundColor: grade[100],
  },
  label: {
    flex: 1,
  },
});
