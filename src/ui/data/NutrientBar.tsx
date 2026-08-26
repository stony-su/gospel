/**
 * One nutrient against its target.
 *
 * The app's densest piece of information and the place the monochrome
 * decision has to earn itself. Four states, all drawn rather than coloured:
 *
 *   hollow    an outlined track with a mid-grey fill - short of target
 *   solid     a white fill, no outline - target met
 *   hatch     white, overlaid with diagonals - approaching the upper limit
 *   inverted  white, value knocked out in black, heavy rule at the UL - over
 *
 * Width and state animate independently. A bar that grows while its status
 * changes is reporting two different facts, and coupling them would make the
 * moment a nutrient crosses its target invisible.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { useMotion } from '@/theme/motion';
import { grade, space, stroke } from '@/theme/tokens';
import { HATCH_FILL, Hatch } from '@/ui/plot';
import { Press } from '@/ui/motion';
import { Figure, Heading } from '@/ui/text';
import { barFraction, formatAmount, type Mark } from './mark';

interface NutrientBarProps {
  name: string;
  unit: string;
  intake: number;
  target: number;
  mark: Mark;
  /** Upper limit, drawn as a heavy rule when the bar is inverted. */
  ul?: number | null;
  onPress?: () => void;
}

const HEIGHT = 10;

export function NutrientBar({
  name,
  unit,
  intake,
  target,
  mark,
  ul,
  onPress,
}: NutrientBarProps) {
  const motion = useMotion();

  const fraction = barFraction(intake, target);
  const fill = useSharedValue(fraction);
  const state = useSharedValue(0);

  useEffect(() => {
    fill.value = withSpring(fraction, motion.spring);
  }, [fill, fraction, motion]);

  useEffect(() => {
    // Re-run on any mark change so the overlay cross-fades rather than cuts.
    state.value = 0;
    state.value = withTiming(1, {
      duration: motion.duration.base,
      easing: motion.easing.standard,
    });
  }, [state, mark, motion]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const overlayStyle = useAnimatedStyle(() => ({ opacity: state.value }));

  const inverted = mark === 'inverted';
  const body = (
    <View style={styles.root}>
      <View style={styles.head}>
        <Heading color={inverted ? grade[100] : grade[90]}>{name}</Heading>
        <Figure color={inverted ? grade[100] : grade[70]}>
          {`${formatAmount(intake)} / ${formatAmount(target)} ${unit}`}
        </Figure>
      </View>

      <View style={[styles.track, mark === 'hollow' && styles.tracked]}>
        <Animated.View style={[styles.fill, fillStyle, FILL_STYLE[mark]]} />

        {mark === 'hatch' && (
          <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="none">
            <Svg width="100%" height={HEIGHT}>
              <Hatch />
              <Rect x={0} y={0} width="100%" height={HEIGHT} fill={HATCH_FILL} />
            </Svg>
          </Animated.View>
        )}

        {inverted && ul ? <View style={styles.breach} /> : null}
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Press onPress={onPress} plain accessibilityLabel={name}>
      {body}
    </Press>
  );
}

const FILL_STYLE: Record<Mark, { backgroundColor: string }> = {
  hollow: { backgroundColor: grade[50] },
  solid: { backgroundColor: grade[100] },
  hatch: { backgroundColor: grade[100] },
  inverted: { backgroundColor: grade[100] },
};

const styles = StyleSheet.create({
  root: {
    paddingVertical: space.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.xs,
    gap: space.sm,
  },
  track: {
    height: HEIGHT,
    backgroundColor: grade[15],
    position: 'relative',
    overflow: 'hidden',
  },
  tracked: {
    borderWidth: stroke.hair,
    borderColor: grade[40],
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  breach: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: stroke.heavy,
    backgroundColor: grade[0],
  },
});
