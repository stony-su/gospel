/**
 * A radar of one meal's nutrition against what that meal ought to carry.
 *
 * The ring is the point. Every axis is scaled so that 1.0 - the solid ring -
 * is this meal's fair share of the day: the daily target divided by the number
 * of meals a day. A dish that is exactly in proportion draws a regular hexagon
 * sitting on the ring, and everything else reads immediately as a shape
 * pulled out of true. Which is what a reader choosing between two dinners
 * actually wants to know: not how many grams of protein, but whether this dish
 * is the shape of the day they are trying to eat.
 *
 * Absolute amounts are deliberately not what this shows. Portion size is the
 * lever that fixes those, and the planner already pulls it; the shape is the
 * part that recipe choice controls, so the shape is what gets drawn.
 *
 * Monochrome like everything else. The reference ring is the brightest line on
 * the chart, the shape is hatched rather than filled - a solid white polygon
 * would be the loudest thing on the screen - and the grid recedes to two steps
 * off the ground.
 */

import { useId } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  Pattern,
  Polygon,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { radarPoint } from '@/theme/plot';
import { font, grade, stroke } from '@/theme/tokens';

export interface RadarAxis {
  id: string;
  label: string;
  /** 1 is exactly this meal's share of the daily target. */
  value: number;
}

interface RadarProps {
  axes: RadarAxis[];
  size: number;
  /**
   * Where the outer edge sits, as a multiple of the target ring. Anything
   * beyond is clamped to the edge and marked, rather than being allowed to
   * blow the chart's scale apart for the sake of one salty dish.
   */
  ceiling?: number;
  /** Drawn faintly behind, for comparing a candidate against what it replaces. */
  reference?: RadarAxis[];
}

const CEILING = 2;
/** Grid rings, as multiples of the target. */
const RINGS = [0.5, 1, 1.5];

export function Radar({ axes, size, ceiling = CEILING, reference }: RadarProps) {
  // Several radars render at once on the swap screen, and a shared pattern id
  // would make every one of them use the first chart's fill.
  const hatchId = `radar-${useId().replace(/:/g, '')}`;

  const centre = size / 2;
  // Room for the axis labels outside the plot. The widest is "protein" at
  // nine-point mono, which is about 38pt - and it is anchored at its inner
  // edge, so the plot has to give back that much on each side or the label
  // runs off the canvas.
  const outer = centre - 40;

  const angleAt = (index: number) => (Math.PI * 2 * index) / axes.length - Math.PI / 2;

  /** A point at `magnitude` target-rings from the centre, clamped to the edge. */
  const point = (index: number, magnitude: number) =>
    radarPoint(index, axes.length, magnitude, ceiling, outer, centre);

  /** Label anchors sit outside the plot, so they are placed in pixels. */
  const labelAt = (index: number) => {
    const angle = angleAt(index);
    return [centre + Math.cos(angle) * (outer + 9), centre + Math.sin(angle) * (outer + 9)];
  };

  const polygon = (values: RadarAxis[]) =>
    values.map((axis, index) => point(index, axis.value).join(',')).join(' ');

  const ringPolygon = (magnitude: number) =>
    axes.map((_, index) => point(index, magnitude).join(',')).join(' ');

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <Pattern id={hatchId} patternUnits="userSpaceOnUse" width={4} height={4}>
            <Rect x={0} y={0} width={4} height={4} fill="transparent" />
            <Line x1={0} y1={4} x2={4} y2={0} stroke={grade[60]} strokeWidth={stroke.hair} />
            <Line x1={-1} y1={1} x2={1} y2={-1} stroke={grade[60]} strokeWidth={stroke.hair} />
            <Line x1={3} y1={5} x2={5} y2={3} stroke={grade[60]} strokeWidth={stroke.hair} />
          </Pattern>
        </Defs>

        {/* Grid. The target ring is the one that carries meaning, so it is a
            step brighter and a step heavier than the others. */}
        {RINGS.map((magnitude) => (
          <Polygon
            key={magnitude}
            points={ringPolygon(magnitude)}
            fill="none"
            stroke={magnitude === 1 ? grade[50] : grade[25]}
            strokeWidth={magnitude === 1 ? stroke.thin : stroke.hair}
          />
        ))}

        {/* Spokes. */}
        {axes.map((axis, index) => {
          const [x, y] = point(index, ceiling);
          return (
            <Line
              key={axis.id}
              x1={centre}
              y1={centre}
              x2={x}
              y2={y}
              stroke={grade[20]}
              strokeWidth={stroke.hair}
            />
          );
        })}

        {reference && reference.length === axes.length && (
          <Polygon
            points={polygon(reference)}
            fill="none"
            stroke={grade[40]}
            strokeWidth={stroke.hair}
            strokeDasharray="3 3"
          />
        )}

        <Polygon
          points={polygon(axes)}
          fill={`url(#${hatchId})`}
          stroke={grade[92]}
          strokeWidth={stroke.medium}
          strokeLinejoin="round"
        />

        {/* A vertex that hit the ceiling is marked, so a clamped axis is not
            mistaken for one that merely happens to be large. */}
        {axes.map((axis, index) => {
          if (axis.value <= ceiling) return null;
          const [x, y] = point(index, ceiling);
          return <Circle key={axis.id} cx={x} cy={y} r={2.5} fill={grade[100]} />;
        })}

        {axes.map((axis, index) => {
          const [x, y] = labelAt(index);
          return (
            <SvgText
              key={axis.id}
              x={x}
              y={y + 3}
              fill={grade[60]}
              fontSize={9}
              fontFamily={font.monoMedium}
              textAnchor={x > centre + 1 ? 'start' : x < centre - 1 ? 'end' : 'middle'}
            >
              {axis.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
