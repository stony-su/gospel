/**
 * The approaching-upper-limit fill.
 *
 * A real SVG pattern rather than drawn lines, so it tiles correctly at any
 * bar width - a nutrient two percent from its UL gets a sliver of bar, and
 * hand-placed hatch lines would either miss it entirely or crowd into a
 * smear. The pattern does not care.
 *
 * Render `<Hatch />` once inside each `<Svg>` that references it.
 */

import { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { grade, stroke } from '@/theme/tokens';

export const HATCH_ID = 'gospel-hatch';

/** Tile size. Small enough to read as texture in a 6pt-tall bar. */
const TILE = 4;

export function Hatch() {
  return (
    <Defs>
      <Pattern
        id={HATCH_ID}
        patternUnits="userSpaceOnUse"
        width={TILE}
        height={TILE}
      >
        <Rect x={0} y={0} width={TILE} height={TILE} fill={grade[0]} />
        {/* One diagonal, plus the two corner stubs that make it continuous
            across tile boundaries. */}
        <Line x1={0} y1={TILE} x2={TILE} y2={0} stroke={grade[100]} strokeWidth={stroke.hair} />
        <Line x1={-1} y1={1} x2={1} y2={-1} stroke={grade[100]} strokeWidth={stroke.hair} />
        <Line
          x1={TILE - 1}
          y1={TILE + 1}
          x2={TILE + 1}
          y2={TILE - 1}
          stroke={grade[100]}
          strokeWidth={stroke.hair}
        />
      </Pattern>
    </Defs>
  );
}

/** The fill string consumers pass to a shape. */
export const HATCH_FILL = `url(#${HATCH_ID})`;
