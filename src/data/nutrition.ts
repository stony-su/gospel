/**
 * Typed access to the generated nutrition dataset.
 *
 * The JSON is produced by scripts/build_nutrient_data.py straight from
 * nutrient_targets.xlsx. Nothing here interprets it - that is the resolver's
 * job. This module only attaches types and builds lookup indices.
 */

import raw from './generated/nutrition.json';
import type {
  ActivityLevelRow,
  DietSpectrumRow,
  DietType,
  NutritionDataset,
  SourceRow,
  SunZoneRow,
} from '@/domain/nutrition/types';

export const dataset = raw as unknown as NutritionDataset;

export const nutrients = dataset.nutrients;
export const modifiers = dataset.modifiers;
export const equations = dataset.equations;
export const activityLevels = dataset.activity_levels;
export const dietSpectrum = dataset.diet_spectrum;
export const sunZones = dataset.sun_zones;
export const extraInputs = dataset.recommended_extra_inputs;

export const sourcesById: Record<string, SourceRow> = Object.fromEntries(
  dataset.sources.map((source) => [source.source_id, source]),
);

export const activityById: Record<string, ActivityLevelRow> = Object.fromEntries(
  activityLevels.map((row) => [row.activity_level, row]),
);

export const dietById: Record<DietType, DietSpectrumRow> = Object.fromEntries(
  dietSpectrum.map((row) => [row.diet_type, row]),
) as Record<DietType, DietSpectrumRow>;

export const sunZoneById: Record<string, SunZoneRow> = Object.fromEntries(
  sunZones.map((row) => [row.sun_zone, row]),
);

/** Sun zones ordered by latitude band, for the map picker. */
export const sunZonesByLatitude = [...sunZones].sort(
  (a, b) => a.abs_latitude_min - b.abs_latitude_min,
);

/** Diet anchors in the display order the product asked for. */
export const dietAnchors = [...dietSpectrum].sort(
  (a, b) => a.display_order - b.display_order,
);

/**
 * Map an absolute latitude to its sun zone. The `inputs` sheet lists only four
 * zones but the `sun_zones` and `enum_values` sheets both list five; the zone
 * tables are authoritative, so very_high_latitude is included.
 */
export function sunZoneForLatitude(latitude: number): SunZoneRow {
  const absolute = Math.min(Math.abs(latitude), 90);
  const match = sunZonesByLatitude.find(
    (zone) => absolute >= zone.abs_latitude_min && absolute < zone.abs_latitude_max,
  );
  return match ?? sunZonesByLatitude[sunZonesByLatitude.length - 1];
}

/** Nutrient categories in a stable display order for the nutrition screen. */
export const CATEGORY_ORDER = [
  'energy',
  'macronutrient',
  'water',
  'amino_acid',
  'fatty_acid',
  'vitamin',
  'mineral',
  'electrolyte',
] as const;

export function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
  return index === -1 ? CATEGORY_ORDER.length : index;
}
