/**
 * Types for the nutrient target engine.
 *
 * The shapes here mirror nutrient_targets.xlsx exactly. The workbook is the
 * authority: if a field is nullable there, it is nullable here.
 */

export type Sex = 'male' | 'female';

export type DietType =
  | 'vegan'
  | 'vegetarian'
  | 'paleo'
  | 'iifym'
  | 'keto'
  | 'carnivore';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type SunZone =
  | 'tropical'
  | 'subtropical'
  | 'temperate'
  | 'high_latitude'
  | 'very_high_latitude';

export type Confidence = 'high' | 'medium' | 'low';

/** The six inputs that drive nutrition. Recipe preferences live elsewhere. */
export interface NutritionProfile {
  sex: Sex;
  weight_kg: number;
  age_years: number;
  diet_type: DietType;
  activity_level: ActivityLevel;
  sun_zone: SunZone;
  /**
   * Optional continuous position on the diet spectrum, expressed as
   * animal_food_fraction (0 = vegan, 1 = carnivore). When present, numeric
   * modifier effects interpolate between the two bracketing anchors. Flags and
   * `set` rules never interpolate - see the workbook's _readme.
   */
  animal_food_fraction?: number;
}

// --- Workbook row shapes -----------------------------------------------------

export interface NutrientRow {
  nutrient_id: string;
  nutrient_name: string;
  category: string;
  unit: string;
  basis: string;
  scales_with_bodyweight: boolean | null;
  per_kg_male: number | null;
  per_kg_female: number | null;
  base_male: number | null;
  base_female: number | null;
  ul_value: number | null;
  ul_applies_to: string | null;
  derived_from: string | null;
  derived_coef_per_1000kcal: number | null;
  source_ids: string[] | null;
  notes: string | null;
}

export type ModifierOperator = 'eq' | 'in' | 'gte' | 'lt' | 'between';
export type EffectType = 'set' | 'set_per_kg' | 'multiply' | 'add' | 'flag';

export interface ModifierRow {
  rule_id: string;
  nutrient_id: string;
  factor: string;
  input_key: string;
  operator: ModifierOperator;
  value_text: string | null;
  value_min: number | null;
  value_max: number | null;
  sex_scope: string;
  effect_type: EffectType;
  effect_value: number | null;
  flag_code: string | null;
  priority: number;
  confidence: Confidence;
  source_ids: string[] | null;
  note: string | null;
}

export interface ActivityLevelRow {
  activity_level: ActivityLevel;
  display_order: number;
  label: string;
  pal_multiplier: number;
  description: string;
}

export interface DietSpectrumRow {
  diet_type: DietType;
  display_order: number;
  label: string;
  animal_food_fraction: number;
  spectrum_position: number;
  phytate_load: string;
  description: string;
}

export interface SunZoneRow {
  sun_zone: SunZone;
  display_order: number;
  label: string;
  abs_latitude_min: number;
  abs_latitude_max: number;
  vitamin_d_multiplier: number;
  vitamin_d_winter_months: number;
  example_locations: string;
}

export interface EquationRow {
  output: string;
  sex: Sex;
  age_min: number;
  age_max: number;
  weight_coef: number;
  constant: number;
  source_ids: string[] | null;
  note: string | null;
}

export interface SourceRow {
  source_id: string;
  citation: string;
  url: string | null;
  year: string | null;
  full_citation: string | null;
}

export interface InputRow {
  input_key: string;
  label: string;
  type: string;
  allowed_values: string[] | null;
  min: number | null;
  max: number | null;
  default: string | null;
  required: boolean | null;
  notes: string | null;
}

export interface ExtraInputRow {
  input_key: string;
  impact: string;
  affects_nutrient_ids: string[] | null;
  rationale: string;
}

export interface NutritionDataset {
  inputs: InputRow[];
  enum_values: { input_key: string; value: string; display_order: number }[];
  nutrients: NutrientRow[];
  modifiers: ModifierRow[];
  activity_levels: ActivityLevelRow[];
  diet_spectrum: DietSpectrumRow[];
  sun_zones: SunZoneRow[];
  equations: EquationRow[];
  recommended_extra_inputs: ExtraInputRow[];
  sources: SourceRow[];
}

// --- Resolver output ---------------------------------------------------------

export interface ResolvedNutrient {
  nutrient_id: string;
  nutrient_name: string;
  category: string;
  unit: string;
  basis: string;
  /** The personalised daily target. */
  value: number;
  ul_value: number | null;
  /** value / ul_value * 100, or null when the nutrient has no upper limit. */
  pct_of_ul: number | null;
  over_ul: boolean;
  approaching_ul: boolean;
  rules_applied: string[];
  flags: string[];
  /** Lowest confidence among the rules that fired. Null when none fired. */
  lowest_confidence: Confidence | null;
  source_ids: string[];
  notes: string | null;
}

export interface ResolvedTargets {
  nutrients: ResolvedNutrient[];
  byId: Record<string, ResolvedNutrient>;
  /** Basal metabolic rate before the activity multiplier. */
  bmr_kcal: number;
  pal_multiplier: number;
  energy_kcal: number;
  /** Every flag raised across all nutrients, deduplicated. */
  flags: string[];
  /** True when age is outside the dataset's 19+ scope. */
  outOfScope: boolean;
}
