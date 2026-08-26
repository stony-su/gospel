/**
 * A reference line across a plot.
 *
 * Dashed by default, because the thing it marks - a target, an upper limit -
 * is a threshold rather than a measurement, and a solid line at the same
 * weight as the data would read as more data.
 */

import { Line } from 'react-native-svg';

import { grade, stroke } from '@/theme/tokens';

interface RuleProps {
  /** Vertical position in plot coordinates. */
  y: number;
  width: number;
  x?: number;
  dashed?: boolean;
  weight?: number;
  color?: string;
}

export function Rule({
  y,
  width,
  x = 0,
  dashed = true,
  weight = stroke.hair,
  color = grade[50],
}: RuleProps) {
  return (
    <Line
      x1={x}
      y1={y}
      x2={x + width}
      y2={y}
      stroke={color}
      strokeWidth={weight}
      strokeDasharray={dashed ? '3 4' : undefined}
    />
  );
}
