/**
 * A plotted axis.
 *
 * Tick marks and their labels, drawn from `niceTicks` so the values shown are
 * always round ones. The axis line itself is the heaviest thing on the plot
 * after the data, because it is what tells you the marks are measurements
 * rather than decoration.
 */

import { G, Line, Text as SvgText } from 'react-native-svg';

import { niceTicks, type Scale } from '@/theme/plot';
import { grade, registers, stroke } from '@/theme/tokens';

interface AxisProps {
  orientation: 'x' | 'y';
  scale: Scale;
  /** Length of the perpendicular extent, i.e. where the axis line sits. */
  length: number;
  ticks?: number;
  format?: (value: number) => string;
}

const TICK = 4;
const GAP = 4;

export function Axis({ orientation, scale, length, ticks = 5, format }: AxisProps) {
  const [min, max] = scale.domain;
  const values = niceTicks(min, max, ticks).filter((v) => v >= min && v <= max);
  const label = format ?? ((v: number) => String(v));

  if (orientation === 'x') {
    return (
      <G>
        <Line
          x1={scale(min)}
          y1={length}
          x2={scale(max)}
          y2={length}
          stroke={grade[40]}
          strokeWidth={stroke.thin}
        />
        {values.map((value) => (
          <G key={`x-${value}`}>
            <Line
              x1={scale(value)}
              y1={length}
              x2={scale(value)}
              y2={length + TICK}
              stroke={grade[40]}
              strokeWidth={stroke.thin}
            />
            <SvgText
              x={scale(value)}
              y={length + TICK + GAP + registers.figureSmall.fontSize * 0.8}
              fill={grade[60]}
              fontSize={registers.figureSmall.fontSize}
              fontFamily={registers.figureSmall.fontFamily}
              textAnchor="middle"
            >
              {label(value)}
            </SvgText>
          </G>
        ))}
      </G>
    );
  }

  return (
    <G>
      <Line
        x1={0}
        y1={scale(min)}
        x2={0}
        y2={scale(max)}
        stroke={grade[40]}
        strokeWidth={stroke.thin}
      />
      {values.map((value) => (
        <G key={`y-${value}`}>
          <Line
            x1={-TICK}
            y1={scale(value)}
            x2={0}
            y2={scale(value)}
            stroke={grade[40]}
            strokeWidth={stroke.thin}
          />
          <SvgText
            x={-TICK - GAP}
            y={scale(value) + registers.figureSmall.fontSize * 0.35}
            fill={grade[60]}
            fontSize={registers.figureSmall.fontSize}
            fontFamily={registers.figureSmall.fontFamily}
            textAnchor="end"
          >
            {label(value)}
          </SvgText>
        </G>
      ))}
    </G>
  );
}
