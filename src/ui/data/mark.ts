/**
 * How a nutrient's status is drawn.
 *
 * Colour used to carry this: magenta for a target reached, orange near the
 * upper limit, red past it. With the palette down to one axis, status is
 * encoded by form instead - whether the bar is filled, hatched, or inverted.
 *
 * That is arguably the better encoding anyway. Form survives a greyscale
 * screenshot, a colour-blind reader and direct sunlight, none of which a
 * magenta-versus-orange distinction does.
 */

import type { ResolvedNutrient } from '@/domain/nutrition/types';

export type Mark = 'hollow' | 'solid' | 'hatch' | 'inverted' | 'unmeasured';

/**
 * Precedence, highest first: over the upper limit, approaching it,
 * unmeasurable, target met, short of target.
 *
 * A breach outranks a met target because both are true at once whenever a
 * nutrient overshoots - and which of the two you need to know is never the
 * good news. Both UL states outrank `unmeasured` because they are properties
 * of the resolved target itself, not of intake, and so are worth reporting
 * even when the plan cannot be measured against them.
 *
 * A null intake means the recipe data cannot measure this nutrient - true of
 * most of the 48. It renders as an empty track rather than a zero, because a
 * zero is a measurement and this is the absence of one.
 */
export function markFor(nutrient: ResolvedNutrient, intake: number | null): Mark {
  if (nutrient.over_ul) return 'inverted';
  if (nutrient.approaching_ul) return 'hatch';
  if (intake === null || !Number.isFinite(intake)) return 'unmeasured';
  if (intake >= nutrient.value) return 'solid';
  return 'hollow';
}

/**
 * How much of the track a bar fills.
 *
 * Capped at 1: the readout still shows the true figure, so an overshoot stays
 * legible as a number without distorting the scale every other bar is read
 * against. A zero or missing target fills nothing rather than dividing by it.
 */
export function barFraction(intake: number, target: number): number {
  if (!Number.isFinite(intake) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(1, Math.max(0, intake / target));
}

/**
 * A nutrient amount, at a precision that suits its magnitude.
 *
 * Selenium is dosed in tens of micrograms and vitamin D in single ones;
 * printing both to the same number of decimals makes one unreadable and the
 * other falsely precise.
 */
export function formatAmount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
