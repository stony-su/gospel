/**
 * A plot frame.
 *
 * Owns the box, the gridlines, the axes and the optional target rule, then
 * hands its scales to the caller as a render prop. Callers plot in data
 * space - milligrams, days, degrees - and never touch a pixel.
 *
 * These gridlines stayed when the background field was deleted: they are how
 * a value is read off a plot, not decoration behind one.
 */

import type { ReactNode } from 'react';
import Svg, { G, Line } from 'react-native-svg';

import { linearScale, niceTicks, type Scale } from '@/theme/plot';
import { grade, stroke } from '@/theme/tokens';
import { Axis } from './Axis';
import { Rule } from './Rule';

export interface PlotScales {
  x: Scale;
  y: Scale;
}

interface PlotProps {
  width: number;
  height: number;
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  /** Draws a dashed reference line at this value on the y axis. */
  target?: number;
  xTicks?: number;
  yTicks?: number;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  /** Extra SVG rendered inside the plot area, in data space. */
  children?: (scales: PlotScales) => ReactNode;
}

/** Room for axis labels. Left is widest because y labels read outward. */
const PAD = { left: 34, right: 8, top: 8, bottom: 20 };

export function Plot({
  width,
  height,
  xDomain,
  yDomain,
  target,
  xTicks = 5,
  yTicks = 4,
  formatX,
  formatY,
  children,
}: PlotProps) {
  if (width <= 0 || height <= 0) return null;

  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = Math.max(0, height - PAD.top - PAD.bottom);
  if (innerWidth <= 0 || innerHeight <= 0) return null;

  // The y range is inverted: SVG pixels grow downward, quantities grow up.
  const x = linearScale(xDomain, [0, innerWidth]);
  const y = linearScale(yDomain, [innerHeight, 0]);

  const gridY = niceTicks(yDomain[0], yDomain[1], yTicks).filter(
    (v) => v >= yDomain[0] && v <= yDomain[1],
  );
  const gridX = niceTicks(xDomain[0], xDomain[1], xTicks).filter(
    (v) => v >= xDomain[0] && v <= xDomain[1],
  );

  return (
    <Svg width={width} height={height}>
      <G x={PAD.left} y={PAD.top}>
        {/* Gridlines first, so everything else sits over them. */}
        {gridY.map((value) => (
          <Line
            key={`gy-${value}`}
            x1={0}
            y1={y(value)}
            x2={innerWidth}
            y2={y(value)}
            stroke={grade[30]}
            strokeWidth={stroke.hair}
          />
        ))}
        {gridX.map((value) => (
          <Line
            key={`gx-${value}`}
            x1={x(value)}
            y1={0}
            x2={x(value)}
            y2={innerHeight}
            stroke={grade[30]}
            strokeWidth={stroke.hair}
          />
        ))}

        {target !== undefined && target >= yDomain[0] && target <= yDomain[1] && (
          <Rule y={y(target)} width={innerWidth} />
        )}

        {children?.({ x, y })}

        <Axis orientation="x" scale={x} length={innerHeight} ticks={xTicks} format={formatX} />
        <Axis orientation="y" scale={y} length={innerHeight} ticks={yTicks} format={formatY} />
      </G>
    </Svg>
  );
}
