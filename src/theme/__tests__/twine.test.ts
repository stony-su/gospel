/**
 * Twine geometry.
 *
 * The braided curves are the app's signature, and the part of them that can
 * actually be wrong is the maths: where the strands cross, how convergence
 * collapses them, and whether a data series crossing its reference is detected
 * at the right place. The SVG that consumes these paths is declarative, so this
 * is where the risk lives.
 */

import { sunZoneForLatitude } from '@/data/nutrition';
import { ambientTwine, twineSeries, twineStrands } from '../twine';

describe('twineStrands', () => {
  it('produces two paths of equal sample count', () => {
    const { a, b } = twineStrands(300, 50, { samples: 32 });
    expect(a.split('L')).toHaveLength(32);
    expect(b.split('L')).toHaveLength(32);
  });

  it('mirrors the strands about the centre line', () => {
    const centreY = 40;
    const { a, b } = twineStrands(200, centreY, { samples: 9, wavelength: 100 });

    const ys = (path: string) =>
      path
        .split(/[ML]\s*/)
        .filter(Boolean)
        .map((pair) => Number(pair.trim().split(/\s+/)[1]));

    const above = ys(a);
    const below = ys(b);
    above.forEach((y, index) => {
      expect(y + below[index]).toBeCloseTo(centreY * 2, 4);
    });
  });

  it('collapses both strands onto the centre line at full convergence', () => {
    const { a, b } = twineStrands(200, 25, { convergence: 1, samples: 8 });
    expect(a).toBe(b);
    expect(a).toContain('25.00');
  });

  it('crosses every half wavelength', () => {
    const { nodes } = twineStrands(400, 30, { wavelength: 100, samples: 64 });
    // 400px at 100px per cycle: crossings at 0, 50, 100 ... 400.
    expect(nodes.length).toBe(9);
    expect(nodes[0].x).toBeCloseTo(0, 4);
    expect(nodes[1].x).toBeCloseTo(50, 4);
    expect(nodes.every((node) => node.y === 30)).toBe(true);
  });

  it('keeps every point inside the requested width', () => {
    const { nodes } = twineStrands(120, 10, { wavelength: 40 });
    expect(nodes.every((node) => node.x >= 0 && node.x <= 120)).toBe(true);
  });
});

describe('twineSeries', () => {
  it('returns empty paths for an empty series', () => {
    const result = twineSeries([], [], 100, 50);
    expect(result.a).toBe('');
    expect(result.nodes).toEqual([]);
  });

  it('finds no crossing when the plan stays below target', () => {
    const { nodes } = twineSeries([0.5, 0.5, 0.5], [0.2, 0.3, 0.4], 100, 50);
    expect(nodes).toHaveLength(0);
  });

  it('finds the crossing where the plan passes through target', () => {
    const { nodes } = twineSeries([0.5, 0.5, 0.5], [0.3, 0.7, 0.9], 100, 50);
    expect(nodes).toHaveLength(1);
    // Between sample 0 and 1, the achieved series crosses 0.5 halfway.
    expect(nodes[0].x).toBeCloseTo(25, 4);
  });

  it('finds a crossing at every alternation', () => {
    const { nodes } = twineSeries(
      [0.5, 0.5, 0.5, 0.5, 0.5],
      [0.2, 0.8, 0.2, 0.8, 0.2],
      100,
      50,
    );
    expect(nodes).toHaveLength(4);
  });

  it('inverts the y axis so a higher value sits higher on screen', () => {
    const { b } = twineSeries([0.5], [1], 100, 50);
    // A value of 1 maps to y = 0, the top of the plot.
    expect(b).toContain('0.00');
  });
});

describe('ambientTwine', () => {
  it('gives every band its own wavelength so the field never tiles', () => {
    const fields = ambientTwine(320, 600, 5);
    expect(fields).toHaveLength(5);
    const nodeCounts = fields.map((field) => field.nodes.length);
    expect(new Set(nodeCounts).size).toBeGreaterThan(1);
  });
});

describe('sunZoneForLatitude', () => {
  it.each([
    [1.35, 'tropical'],
    [30.04, 'subtropical'],
    [40.71, 'temperate'],
    [51.5, 'high_latitude'],
    [59.33, 'very_high_latitude'],
  ])('maps %s degrees to %s', (latitude, expected) => {
    expect(sunZoneForLatitude(latitude).sun_zone).toBe(expected);
  });

  it('treats southern latitudes the same as northern', () => {
    expect(sunZoneForLatitude(-33.87).sun_zone).toBe(
      sunZoneForLatitude(33.87).sun_zone,
    );
  });

  it('places a boundary latitude in the band above it', () => {
    // The bands are [min, max), so 45 belongs to high_latitude, not temperate.
    expect(sunZoneForLatitude(45).sun_zone).toBe('high_latitude');
    expect(sunZoneForLatitude(44.99).sun_zone).toBe('temperate');
  });

  it('handles the poles without falling off the end of the table', () => {
    expect(sunZoneForLatitude(90).sun_zone).toBe('very_high_latitude');
    expect(sunZoneForLatitude(-90).sun_zone).toBe('very_high_latitude');
  });
});
