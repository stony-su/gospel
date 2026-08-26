/**
 * Plot geometry - the mathematics the interface is drawn on.
 *
 * Every ruled line in the app comes from here: the axes on the nutrition and
 * pantry plots, their gridlines, the tick marks under a slider. Keeping it
 * pure and separate means the geometry can be reasoned about and tested
 * without rendering anything.
 *
 * Pure geometry, no rendering. Callers feed the results to react-native-svg.
 */

export interface Scale {
  (value: number): number;
  /** Range back to domain. The map is invertible; sliders need both ways. */
  invert(pixel: number): number;
  domain: readonly [number, number];
  range: readonly [number, number];
}

/**
 * A linear domain-to-range map.
 *
 * The range is routinely inverted - `[height, 0]` rather than `[0, height]` -
 * because screen pixels grow downward while the quantities being plotted grow
 * upward. That is the normal case here, not an edge case.
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  // A single-valued domain is real - one nutrient, one reading - and dividing
  // by its zero span would put NaN into an SVG coordinate. Pin it to the
  // start of the range instead.
  const scale = ((value: number) =>
    span === 0 ? r0 : r0 + ((value - d0) / span) * (r1 - r0)) as Scale;

  scale.invert = (pixel: number) => {
    const rangeSpan = r1 - r0;
    if (rangeSpan === 0) return d0;
    return d0 + ((pixel - r0) / rangeSpan) * span;
  };
  scale.domain = domain;
  scale.range = range;

  return scale;
}

/** The only step sizes an axis is allowed to use, per decade. */
const STEPS = [1, 2, 5, 10] as const;

/**
 * Axis tick values, rounded to 1/2/5 x 10^n.
 *
 * The standard axis-rounding algorithm. Without it an axis over a real
 * nutrient range reads `0, 3.7142, 7.4284` - arithmetically correct and
 * useless to look at. The returned ticks always cover the requested domain,
 * so a caller can use the first and last as the plot's actual bounds.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max === min) return [min];

  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = (STEPS.find((s) => s * power >= raw) ?? 10) * power;

  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  // Accumulating `+= step` drifts: ten additions of 0.2 land on
  // 2.0000000000000004, which renders as an eighteen-character tick label.
  // Multiply from the index instead and round to the step's own precision.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: number[] = [];
  for (let i = 0; start + i * step <= end + step / 2; i += 1) {
    ticks.push(Number((start + i * step).toFixed(decimals)));
  }

  return ticks;
}
