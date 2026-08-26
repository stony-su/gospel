/**
 * The background field.
 *
 * The first version of this was a uniform sheet of graph paper behind every
 * screen, and it was a mistake: every rule, axis, divider and bar edge in the
 * app is also a hairline at the bottom of the grade ramp, so the ground and
 * the figure were drawn in the same voice and competed.
 *
 * What replaces it is a composition - a handful of discrete patches placed
 * where content is not. The mathematics still shows, but as marginalia: a
 * block of grid in a corner, a run of ticks down an edge, one crosshair in
 * the space below a short list. It reads as the graph paper a page was torn
 * from rather than a grid the content sits on top of.
 *
 * Coordinates are fractions of the viewport so a composition scales rather
 * than needing a tuned variant per device. The invariant that makes the whole
 * idea work - no patch behind content - is enforced by test, because it is
 * exactly the kind of rule that erodes one edit at a time.
 */

export type PatchKind = 'grid' | 'ticks' | 'cross' | 'rule';

export interface Patch {
  kind: PatchKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FieldName = 'landing' | 'plan' | 'dense' | 'list' | 'detail' | 'onboarding';

/**
 * Named compositions.
 *
 * Density tracks how busy the screen is: `dense` - nutrition and pantry, which
 * carry dozens of bars - gets two small corner marks and nothing else, while
 * `landing` can afford a large block because the screen is mostly empty.
 */
export const FIELDS: Record<FieldName, Patch[]> = {
  // Mostly empty screen; the field can carry it.
  landing: [
    { kind: 'grid', x: 0, y: 0, w: 0.42, h: 0.12 },
    { kind: 'ticks', x: 0.94, y: 0.18, w: 0.06, h: 0.5 },
    { kind: 'cross', x: 0.06, y: 0.9, w: 0.1, h: 0.08 },
  ],

  // A list of days: keep clear of the centre column entirely.
  plan: [
    { kind: 'grid', x: 0.72, y: 0, w: 0.28, h: 0.1 },
    { kind: 'cross', x: 0.04, y: 0.9, w: 0.09, h: 0.07 },
  ],

  // Nutrition and pantry. Dozens of bars and a plot; two small marks, no more.
  dense: [
    { kind: 'rule', x: 0.82, y: 0, w: 0.18, h: 0.04 },
    { kind: 'ticks', x: 0.96, y: 0.9, w: 0.04, h: 0.08 },
  ],

  // Grocery: ticks under the header, a block at the foot.
  list: [
    { kind: 'ticks', x: 0, y: 0.02, w: 0.12, h: 0.06 },
    { kind: 'grid', x: 0.66, y: 0.9, w: 0.34, h: 0.1 },
  ],

  // Recipe, nutrient, references, category pages.
  detail: [
    { kind: 'grid', x: 0, y: 0, w: 0.22, h: 0.09 },
    { kind: 'rule', x: 0.88, y: 0.93, w: 0.12, h: 0.03 },
  ],

  onboarding: [
    { kind: 'grid', x: 0.78, y: 0, w: 0.22, h: 0.08 },
    { kind: 'ticks', x: 0, y: 0.92, w: 0.14, h: 0.06 },
  ],
};

export interface PlacedPatch {
  kind: PatchKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolve a composition to pixel-space patches.
 *
 * Returns nothing for a zero-sized viewport, which is the state during the
 * first layout pass - mounting an Svg with no dimensions is wasted work at
 * best and a division by zero downstream at worst.
 */
export function placeField(name: FieldName, width: number, height: number): PlacedPatch[] {
  if (width <= 0 || height <= 0) return [];

  return FIELDS[name].map((patch) => ({
    kind: patch.kind,
    x: patch.x * width,
    y: patch.y * height,
    w: patch.w * width,
    h: patch.h * height,
  }));
}
