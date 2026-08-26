/**
 * The onboarding progress rail.
 *
 * Two strands run the width of the screen and converge as questions are
 * answered: wide apart at the first question, meeting on a single line at the
 * last. The braid is the same mark used everywhere else, put to work as a
 * progress indicator that means something - the two halves of the profile
 * coming into agreement.
 */

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ink, signal } from '@/theme/tokens';
import { twineStrands } from '@/theme/twine';

interface TwineRailProps {
  width: number;
  /** 0-1. Drives how tightly the strands braid. */
  progress: number;
  height?: number;
}

function TwineRailComponent({ width, progress, height = 26 }: TwineRailProps) {
  if (width <= 0) return null;

  const clamped = Math.min(Math.max(progress, 0), 1);
  const centreY = height / 2;

  const { a, b, nodes } = twineStrands(width, centreY, {
    amplitude: height / 2 - 3,
    wavelength: width / 2.2,
    convergence: clamped,
    samples: 90,
  });

  return (
    <View style={[styles.root, { height }]}>
      <Svg width={width} height={height}>
        <Path d={a} stroke={ink.lineHot} strokeWidth={1} fill="none" />
        <Path d={b} stroke={ink.muted} strokeWidth={1} fill="none" />

        {nodes.map((node, index) => (
          <Circle
            key={index}
            cx={node.x}
            cy={node.y}
            r={1.6}
            fill={signal.endpoint}
            opacity={0.25 + clamped * 0.55}
          />
        ))}

        {/* The travelling head: how far through the questions you are. */}
        <Circle
          cx={clamped * width}
          cy={centreY}
          r={3}
          fill={signal.endpoint}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});

export const TwineRail = memo(TwineRailComponent);
