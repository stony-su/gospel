/**
 * The background field.
 *
 * Draws a named composition of patches. Each kind is a different way of
 * saying the same thing quietly - graph paper, a measuring scale, a fix on a
 * point, a bare datum line - and all of them sit at the bottom of the grade
 * ramp, in the margins, where nothing else is drawn.
 *
 * It fades up on mount rather than being there instantly, which is the only
 * animation in the app whose job is to say "the instrument is on".
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { G, Line } from 'react-native-svg';

import { placeField, type FieldName, type PlacedPatch } from '@/theme/field';
import { useMotion } from '@/theme/motion';
import { graticule } from '@/theme/plot';
import { grade, stroke } from '@/theme/tokens';

interface FieldProps {
  name: FieldName;
  width: number;
  height: number;
}

/** Minor grid spacing inside a `grid` patch. */
const MINOR = 8;
const MAJOR = 32;
/** Spacing and length of the marks in a `ticks` patch. */
const TICK_STEP = 10;
const TICK_LEN = 5;

export function Field({ name, width, height }: FieldProps) {
  const motion = useMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(1, {
      duration: motion.duration.reveal,
      easing: motion.easing.decel,
    });
  }, [shown, motion]);

  const animated = useAnimatedStyle(() => ({ opacity: shown.value }));

  if (width <= 0 || height <= 0) return null;

  const patches = placeField(name, width, height);
  if (patches.length === 0) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.inert, animated]}>
      <Svg width={width} height={height}>
        {patches.map((patch, index) => (
          <G key={index} x={patch.x} y={patch.y}>
            {renderPatch(patch)}
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
}

function renderPatch(patch: PlacedPatch) {
  switch (patch.kind) {
    case 'grid':
      return <GridPatch w={patch.w} h={patch.h} />;
    case 'ticks':
      return <TicksPatch w={patch.w} h={patch.h} />;
    case 'cross':
      return <CrossPatch w={patch.w} h={patch.h} />;
    case 'rule':
      return <RulePatch w={patch.w} />;
    default:
      return null;
  }
}

/** A block of graph paper. */
function GridPatch({ w, h }: { w: number; h: number }) {
  const lines = graticule(w, h, MINOR, MAJOR);

  return (
    <G>
      {lines.minorX.map((x) => (
        <Line key={`nx${x}`} x1={x} y1={0} x2={x} y2={h} stroke={grade[30]} strokeWidth={stroke.hair} />
      ))}
      {lines.minorY.map((y) => (
        <Line key={`ny${y}`} x1={0} y1={y} x2={w} y2={y} stroke={grade[30]} strokeWidth={stroke.hair} />
      ))}
      {lines.majorX.map((x) => (
        <Line key={`jx${x}`} x1={x} y1={0} x2={x} y2={h} stroke={grade[35]} strokeWidth={stroke.hair} />
      ))}
      {lines.majorY.map((y) => (
        <Line key={`jy${y}`} x1={0} y1={y} x2={w} y2={y} stroke={grade[35]} strokeWidth={stroke.hair} />
      ))}
    </G>
  );
}

/** A measuring scale: a spine with graduations, running along the long axis. */
function TicksPatch({ w, h }: { w: number; h: number }) {
  const vertical = h >= w;
  const span = vertical ? h : w;
  const count = Math.max(1, Math.floor(span / TICK_STEP));

  return (
    <G>
      {vertical ? (
        <Line x1={0} y1={0} x2={0} y2={h} stroke={grade[35]} strokeWidth={stroke.hair} />
      ) : (
        <Line x1={0} y1={0} x2={w} y2={0} stroke={grade[35]} strokeWidth={stroke.hair} />
      )}
      {Array.from({ length: count + 1 }, (_, index) => {
        const at = index * TICK_STEP;
        // Every fifth graduation runs long, as on a real scale.
        const len = index % 5 === 0 ? TICK_LEN * 1.8 : TICK_LEN;
        return vertical ? (
          <Line key={index} x1={0} y1={at} x2={len} y2={at} stroke={grade[35]} strokeWidth={stroke.hair} />
        ) : (
          <Line key={index} x1={at} y1={0} x2={at} y2={len} stroke={grade[35]} strokeWidth={stroke.hair} />
        );
      })}
    </G>
  );
}

/** A fix on a point: crosshairs with graduated arms. */
function CrossPatch({ w, h }: { w: number; h: number }) {
  const cx = w / 2;
  const cy = h / 2;

  return (
    <G>
      <Line x1={0} y1={cy} x2={w} y2={cy} stroke={grade[35]} strokeWidth={stroke.hair} />
      <Line x1={cx} y1={0} x2={cx} y2={h} stroke={grade[35]} strokeWidth={stroke.hair} />
      {[-1, 1].map((sign) => (
        <G key={sign}>
          <Line
            x1={cx + sign * w * 0.3}
            y1={cy - 3}
            x2={cx + sign * w * 0.3}
            y2={cy + 3}
            stroke={grade[35]}
            strokeWidth={stroke.hair}
          />
          <Line
            x1={cx - 3}
            y1={cy + sign * h * 0.3}
            x2={cx + 3}
            y2={cy + sign * h * 0.3}
            stroke={grade[35]}
            strokeWidth={stroke.hair}
          />
        </G>
      ))}
    </G>
  );
}

/** A bare datum line with one end tick. */
function RulePatch({ w }: { w: number }) {
  return (
    <G>
      <Line x1={0} y1={0} x2={w} y2={0} stroke={grade[35]} strokeWidth={stroke.hair} />
      <Line x1={w} y1={-3} x2={w} y2={3} stroke={grade[35]} strokeWidth={stroke.hair} />
    </G>
  );
}

const styles = StyleSheet.create({
  // pointerEvents belongs in style now; the prop form is deprecated.
  inert: {
    pointerEvents: 'none',
  },
});
