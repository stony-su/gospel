/**
 * Onboarding progress, as an axis.
 *
 * One tick per question on a baseline. Answered ticks are full height and at
 * the top of the ramp; unanswered ones are half height and near the bottom.
 * Reading how far along you are is then the same act as reading any other
 * axis in the app, which is the point - the questionnaire is an instrument
 * being calibrated, not a form being filled in.
 *
 * Each tick owns its own animation and springs to its new height when it is
 * answered, so the rail grows a mark at a time rather than redrawing.
 */

import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { useMotion } from '@/theme/motion';
import { grade, stroke } from '@/theme/tokens';

const AnimatedLine = Animated.createAnimatedComponent(Line);

const HEIGHT = 14;
const BASELINE = HEIGHT;

interface TickProps {
  x: number;
  done: boolean;
}

function Tick({ x, done }: TickProps) {
  const motion = useMotion();
  const extent = useSharedValue(done ? 0 : BASELINE / 2);

  useEffect(() => {
    extent.value = withSpring(done ? 0 : BASELINE / 2, motion.spring);
  }, [extent, done, motion]);

  const animatedProps = useAnimatedProps(() => ({ y2: extent.value })) as Partial<{ y2: number }>;

  return (
    <AnimatedLine
      x1={x}
      y1={BASELINE}
      x2={x}
      stroke={done ? grade[100] : grade[40]}
      strokeWidth={done ? stroke.thin : stroke.hair}
      animatedProps={animatedProps}
    />
  );
}

interface ProgressRailProps {
  total: number;
  answered: number;
  width: number;
}

export function ProgressRail({ total, answered, width }: ProgressRailProps) {
  if (width <= 0 || total <= 0) return null;

  // Inset by a hairline so the first and last ticks sit inside the box rather
  // than half-clipped by its edges.
  const inset = stroke.thin;
  const span = width - inset * 2;
  const step = total > 1 ? span / (total - 1) : 0;

  return (
    <Svg width={width} height={HEIGHT + stroke.thin}>
      <Line
        x1={inset}
        y1={BASELINE}
        x2={width - inset}
        y2={BASELINE}
        stroke={grade[40]}
        strokeWidth={stroke.hair}
      />
      {Array.from({ length: total }, (_, index) => (
        <Tick key={index} x={inset + index * step} done={index < answered} />
      ))}
    </Svg>
  );
}
