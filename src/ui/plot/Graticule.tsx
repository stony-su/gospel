/**
 * Graph paper.
 *
 * The ground every screen sits on. Minor lines carry texture, major lines
 * carry structure, and both are hairlines at the bottom of the grade ramp so
 * the grid is felt more than read - it should never compete with a number.
 *
 * It fades up on mount rather than being there instantly, which is the only
 * animation in the app whose job is to say "the instrument is on".
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { useMotion } from '@/theme/motion';
import { graticule } from '@/theme/plot';
import { grade, stroke } from '@/theme/tokens';

interface GraticuleProps {
  width: number;
  height: number;
  minor?: number;
  major?: number;
  /** 0-1, scaling the whole field. Lower it under dense content. */
  opacity?: number;
}

export function Graticule({
  width,
  height,
  minor = 8,
  major = 40,
  opacity = 1,
}: GraticuleProps) {
  const motion = useMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(opacity, {
      duration: motion.duration.reveal,
      easing: motion.easing.decel,
    });
  }, [shown, opacity, motion]);

  const animated = useAnimatedStyle(() => ({ opacity: shown.value }));

  // The geometry guards this too, but returning early avoids mounting an Svg
  // with no dimensions during the first layout pass.
  if (width <= 0 || height <= 0) return null;

  const lines = graticule(width, height, minor, major);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animated]} pointerEvents="none">
      <Svg width={width} height={height}>
        {lines.minorX.map((x) => (
          <Line
            key={`mnx-${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            stroke={grade[30]}
            strokeWidth={stroke.hair}
          />
        ))}
        {lines.minorY.map((y) => (
          <Line
            key={`mny-${y}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke={grade[30]}
            strokeWidth={stroke.hair}
          />
        ))}
        {lines.majorX.map((x) => (
          <Line
            key={`mjx-${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            stroke={grade[35]}
            strokeWidth={stroke.hair}
          />
        ))}
        {lines.majorY.map((y) => (
          <Line
            key={`mjy-${y}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke={grade[35]}
            strokeWidth={stroke.hair}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
