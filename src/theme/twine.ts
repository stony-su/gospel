/**
 * Twining line geometry - Gospel's signature mark.
 *
 * Every curve in the app is two braided strands: a reference strand (what you
 * should hit) and an achieved strand (what the plan delivers). They cross
 * wherever the plan passes through its target, so the braid itself reports
 * agreement, and a wide gap reports drift.
 *
 * The same primitive serves three jobs at three scales:
 *   - ambient page backgrounds, at very low opacity
 *   - the onboarding progress rail, where the strands converge as answers land
 *   - real data plots on the nutrition screen
 *
 * Pure geometry, no rendering. Callers feed the paths to react-native-svg.
 */

export interface Point {
  x: number;
  y: number;
}

export interface TwineOptions {
  /** Peak vertical displacement of each strand from the centre line. */
  amplitude?: number;
  /** Horizontal distance for one full cycle. */
  wavelength?: number;
  /** Phase offset in radians, shifting where the crossings land. */
  phase?: number;
  /**
   * 0 keeps the strands at full amplitude; 1 collapses them onto one line.
   * The onboarding rail drives this from answered-question count.
   */
  convergence?: number;
  /** Points sampled per strand. More is smoother and costlier. */
  samples?: number;
}

export interface TwineResult {
  /** SVG path for the first strand. */
  a: string;
  /** SVG path for the second strand, half a wavelength out of phase. */
  b: string;
  /** Where the two strands cross. Good anchors for node dots. */
  nodes: Point[];
}

const DEFAULTS: Required<TwineOptions> = {
  amplitude: 12,
  wavelength: 120,
  phase: 0,
  convergence: 0,
  samples: 64,
};

function toPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return (
    `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}` +
    rest.map((point) => ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join('')
  );
}

/**
 * Two strands braiding along a horizontal centre line.
 *
 * The strands are a sine and its inversion, so they meet exactly where the
 * sine crosses zero - every half wavelength.
 */
export function twineStrands(
  width: number,
  centreY: number,
  options: TwineOptions = {},
): TwineResult {
  const { amplitude, wavelength, phase, convergence, samples } = {
    ...DEFAULTS,
    ...options,
  };

  const effectiveAmplitude = amplitude * (1 - Math.min(Math.max(convergence, 0), 1));
  const step = width / Math.max(samples - 1, 1);
  const angularFrequency = (Math.PI * 2) / Math.max(wavelength, 1);

  const strandA: Point[] = [];
  const strandB: Point[] = [];

  for (let index = 0; index < samples; index += 1) {
    const x = index * step;
    const offset = Math.sin(x * angularFrequency + phase) * effectiveAmplitude;
    strandA.push({ x, y: centreY + offset });
    strandB.push({ x, y: centreY - offset });
  }

  // Crossings occur where sin(...) is zero: x = (n*pi - phase) / w.
  const nodes: Point[] = [];
  const firstIndex = Math.ceil((phase * -1) / Math.PI);
  for (let n = firstIndex; ; n += 1) {
    const x = (n * Math.PI - phase) / angularFrequency;
    if (x > width) break;
    if (x >= 0) nodes.push({ x, y: centreY });
  }

  return { a: toPath(strandA), b: toPath(strandB), nodes };
}

/**
 * Braid two real data series instead of a sine.
 *
 * `reference` is the target line and `achieved` is what the plan delivers,
 * both as fractions of the plot height where 0 is the bottom. Returns paths
 * plus the crossing points, which are the moments the plan meets its target.
 */
export function twineSeries(
  reference: number[],
  achieved: number[],
  width: number,
  height: number,
): TwineResult {
  const count = Math.min(reference.length, achieved.length);
  if (count === 0) return { a: '', b: '', nodes: [] };

  const step = count > 1 ? width / (count - 1) : width;
  const toY = (value: number) => height - Math.min(Math.max(value, 0), 1) * height;

  const referencePoints: Point[] = [];
  const achievedPoints: Point[] = [];

  for (let index = 0; index < count; index += 1) {
    const x = index * step;
    referencePoints.push({ x, y: toY(reference[index]) });
    achievedPoints.push({ x, y: toY(achieved[index]) });
  }

  // Linear interpolation for the crossing between each pair of samples.
  const nodes: Point[] = [];
  for (let index = 1; index < count; index += 1) {
    const previousGap = achieved[index - 1] - reference[index - 1];
    const gap = achieved[index] - reference[index];
    if (previousGap === 0) {
      nodes.push(referencePoints[index - 1]);
      continue;
    }
    if (previousGap < 0 !== gap < 0) {
      const t = previousGap / (previousGap - gap);
      nodes.push({
        x: (index - 1 + t) * step,
        y: toY(
          reference[index - 1] + (reference[index] - reference[index - 1]) * t,
        ),
      });
    }
  }
  if (achieved[count - 1] === reference[count - 1]) {
    nodes.push(referencePoints[count - 1]);
  }

  return { a: toPath(referencePoints), b: toPath(achievedPoints), nodes };
}

/**
 * A field of slow twining curves for page backgrounds.
 *
 * Each band gets its own wavelength and phase so the field never reads as a
 * repeating texture. Intended at very low opacity behind content.
 */
export function ambientTwine(
  width: number,
  height: number,
  bands = 5,
): TwineResult[] {
  const results: TwineResult[] = [];
  for (let index = 0; index < bands; index += 1) {
    const centreY = (height / (bands + 1)) * (index + 1);
    results.push(
      twineStrands(width, centreY, {
        amplitude: 10 + index * 6,
        wavelength: 150 + index * 55,
        phase: index * 0.9,
        samples: 48,
      }),
    );
  }
  return results;
}
