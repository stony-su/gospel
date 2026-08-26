/**
 * The nutrient target resolver.
 *
 * A direct port of the resolution algorithm published in the workbook's
 * `_readme` sheet. Every behaviour here traces to a line in that sheet, and the
 * whole thing is verified against the 4 x 48 golden vectors in
 * `expected_output`. When the two disagree, the workbook is right.
 *
 * The algorithm, in short:
 *   1. Establish a base value per nutrient (energy equation, per-kg scaling,
 *      derivation from energy, or a flat sex-specific base).
 *   2. Apply matching modifier rules in priority order: a single winning `set`,
 *      then all `multiply` rules compounding, then all `add` rules summing,
 *      then `flag` rules which carry no numeric effect.
 *   3. Compare the result against the tolerable upper intake level.
 */

import {
  activityById,
  dietById,
  equations,
  modifiers,
  nutrients,
} from '@/data/nutrition';
import type {
  Confidence,
  ModifierRow,
  NutrientRow,
  NutritionProfile,
  ResolvedNutrient,
  ResolvedTargets,
  Sex,
} from './types';

/** Below this age the dataset makes no claim. */
const MINIMUM_AGE = 19;

/** The workbook warns at 80% of the upper limit and breaches above 100%. */
const APPROACHING_UL_FRACTION = 0.8;

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

// --- Rule matching -----------------------------------------------------------

/** Read the profile field a rule tests against. */
function profileValue(profile: NutritionProfile, inputKey: string): unknown {
  switch (inputKey) {
    case 'sex':
      return profile.sex;
    case 'weight_kg':
      return profile.weight_kg;
    case 'age_years':
      return profile.age_years;
    case 'diet_type':
      return profile.diet_type;
    case 'activity_level':
      return profile.activity_level;
    case 'sun_zone':
      return profile.sun_zone;
    default:
      return undefined;
  }
}

/**
 * Does this rule apply to this profile?
 *
 * Per the _readme: a rule matches when sex_scope is 'any' or equals the user's
 * sex, AND the operator test passes. When an eq/in rule also carries value_min
 * and value_max, those are a secondary age window rather than a second test on
 * the rule's own input_key - see SEX_01, which applies to females aged 15-50.
 */
function ruleMatches(rule: ModifierRow, profile: NutritionProfile): boolean {
  if (rule.sex_scope !== 'any' && rule.sex_scope !== profile.sex) return false;

  const value = profileValue(profile, rule.input_key);
  if (value === undefined) return false;

  let matched: boolean;

  switch (rule.operator) {
    case 'eq':
      matched = String(value) === String(rule.value_text);
      break;

    case 'in':
      matched = String(rule.value_text ?? '')
        .split(';')
        .map((entry) => entry.trim())
        .includes(String(value));
      break;

    case 'gte':
      matched = rule.value_min !== null && Number(value) >= rule.value_min;
      break;

    case 'lt':
      matched = rule.value_max !== null && Number(value) < rule.value_max;
      break;

    case 'between':
      matched =
        rule.value_min !== null &&
        rule.value_max !== null &&
        Number(value) >= rule.value_min &&
        Number(value) <= rule.value_max;
      break;

    default:
      matched = false;
  }

  if (!matched) return false;

  // Secondary age window on an eq/in rule.
  if (
    (rule.operator === 'eq' || rule.operator === 'in') &&
    rule.value_min !== null &&
    rule.value_max !== null
  ) {
    if (profile.age_years < rule.value_min || profile.age_years > rule.value_max) {
      return false;
    }
  }

  return true;
}

// --- Base values -------------------------------------------------------------

/** Schofield weight-only BMR, selected by sex and age band. */
export function basalMetabolicRate(sex: Sex, ageYears: number, weightKg: number): number {
  const row =
    equations.find(
      (equation) =>
        equation.output === 'bmr_kcal' &&
        equation.sex === sex &&
        ageYears >= equation.age_min &&
        ageYears < equation.age_max,
    ) ??
    // Above the top band, hold the oldest coefficients rather than fail.
    equations
      .filter((equation) => equation.output === 'bmr_kcal' && equation.sex === sex)
      .sort((a, b) => b.age_min - a.age_min)[0];

  return row.weight_coef * weightKg + row.constant;
}

function baseValue(
  nutrient: NutrientRow,
  profile: NutritionProfile,
  resolvedEnergy: number,
): number {
  // Energy is computed, not looked up.
  if (nutrient.nutrient_id === 'energy_kcal') {
    const pal = activityById[profile.activity_level]?.pal_multiplier ?? 1;
    return basalMetabolicRate(profile.sex, profile.age_years, profile.weight_kg) * pal;
  }

  // Nutrients derived from energy intake, e.g. fibre at 14 g per 1000 kcal.
  if (nutrient.derived_from && nutrient.derived_coef_per_1000kcal !== null) {
    const source = nutrient.derived_from === 'energy_kcal' ? resolvedEnergy : 0;
    return nutrient.derived_coef_per_1000kcal * (source / 1000);
  }

  // Energy, water, protein and the nine indispensable amino acids scale with
  // body mass. Vitamins and minerals never do - see the _readme.
  if (nutrient.scales_with_bodyweight) {
    const perKg =
      profile.sex === 'male' ? nutrient.per_kg_male : nutrient.per_kg_female;
    if (perKg !== null) return perKg * profile.weight_kg;
  }

  const base = profile.sex === 'male' ? nutrient.base_male : nutrient.base_female;
  return base ?? 0;
}

// --- Diet spectrum interpolation --------------------------------------------

/**
 * Scale a numeric effect for a continuous position on the diet spectrum.
 *
 * The workbook permits linear interpolation of `multiply` and `add` effects
 * between the two bracketing anchors, on animal_food_fraction rather than
 * display order (the anchors are not monotonic in display order). Flags and
 * `set` rules never interpolate.
 *
 * Returns a weight in 0..1 for how strongly a diet rule applies.
 */
function dietRuleWeight(rule: ModifierRow, profile: NutritionProfile): number {
  if (rule.input_key !== 'diet_type') return 1;
  if (profile.animal_food_fraction === undefined) return 1;
  if (rule.effect_type !== 'multiply' && rule.effect_type !== 'add') return 1;

  const anchors = String(rule.value_text ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .map((diet) => dietById[diet as keyof typeof dietById])
    .filter(Boolean);

  if (anchors.length === 0) return 1;

  // Distance from the user's position to the nearest anchor the rule targets.
  const position = profile.animal_food_fraction;
  const nearest = anchors.reduce((best, anchor) => {
    const distance = Math.abs(anchor.animal_food_fraction - position);
    return distance < Math.abs(best.animal_food_fraction - position) ? anchor : best;
  }, anchors[0]);

  const distance = Math.abs(nearest.animal_food_fraction - position);
  // Full strength at the anchor, fading to nothing a quarter of the way across
  // the spectrum. Keeps a nudge off an anchor from cancelling a rule outright.
  return Math.max(0, 1 - distance / 0.25);
}

// --- Resolution --------------------------------------------------------------

function resolveOne(
  nutrient: NutrientRow,
  profile: NutritionProfile,
  applicable: ModifierRow[],
  resolvedEnergy: number,
): ResolvedNutrient {
  const rulesApplied: string[] = [];
  const flags: string[] = [];
  let lowestConfidence: Confidence | null = null;

  const noteConfidence = (rule: ModifierRow) => {
    if (!rule.confidence) return;
    if (
      lowestConfidence === null ||
      CONFIDENCE_RANK[rule.confidence] < CONFIDENCE_RANK[lowestConfidence]
    ) {
      lowestConfidence = rule.confidence;
    }
  };

  let value = baseValue(nutrient, profile, resolvedEnergy);

  // 1. A single winning `set` / `set_per_kg`. Highest priority wins; on a tie
  //    the later rule in sheet order wins. Losing set rules are not recorded.
  const setRules = applicable.filter(
    (rule) => rule.effect_type === 'set' || rule.effect_type === 'set_per_kg',
  );

  if (setRules.length > 0) {
    const winner = setRules.reduce((best, rule) =>
      rule.priority >= best.priority ? rule : best,
    );
    value =
      winner.effect_type === 'set_per_kg'
        ? (winner.effect_value ?? 0) * profile.weight_kg
        : (winner.effect_value ?? 0);
    rulesApplied.push(winner.rule_id);
    noteConfidence(winner);
  }

  // 2. Every matching `multiply` compounds.
  for (const rule of applicable.filter((r) => r.effect_type === 'multiply')) {
    const weight = dietRuleWeight(rule, profile);
    if (weight <= 0) continue;
    const factor = 1 + ((rule.effect_value ?? 1) - 1) * weight;
    value *= factor;
    rulesApplied.push(rule.rule_id);
    noteConfidence(rule);
  }

  // 3. Every matching `add` sums.
  for (const rule of applicable.filter((r) => r.effect_type === 'add')) {
    const weight = dietRuleWeight(rule, profile);
    if (weight <= 0) continue;
    value += (rule.effect_value ?? 0) * weight;
    rulesApplied.push(rule.rule_id);
    noteConfidence(rule);
  }

  // 4. Flags carry no numeric effect; they surface to the user instead.
  for (const rule of applicable.filter((r) => r.effect_type === 'flag')) {
    if (rule.flag_code && !flags.includes(rule.flag_code)) {
      flags.push(rule.flag_code);
    }
  }

  // 5. Compare against the tolerable upper intake level.
  const ul = nutrient.ul_value;
  const pctOfUl = ul !== null && ul > 0 ? (value / ul) * 100 : null;

  return {
    nutrient_id: nutrient.nutrient_id,
    nutrient_name: nutrient.nutrient_name,
    category: nutrient.category,
    unit: nutrient.unit,
    basis: nutrient.basis,
    value,
    ul_value: ul,
    pct_of_ul: pctOfUl,
    over_ul: pctOfUl !== null && pctOfUl > 100,
    approaching_ul:
      pctOfUl !== null &&
      pctOfUl >= APPROACHING_UL_FRACTION * 100 &&
      pctOfUl <= 100,
    rules_applied: rulesApplied,
    flags,
    lowest_confidence: lowestConfidence,
    source_ids: nutrient.source_ids ?? [],
    notes: nutrient.notes,
  };
}

/**
 * Resolve a full daily nutrient target set for one profile.
 *
 * Energy is resolved first because fibre derives from it.
 */
export function resolveTargets(profile: NutritionProfile): ResolvedTargets {
  const outOfScope = profile.age_years < MINIMUM_AGE;

  // Index applicable rules once per nutrient rather than rescanning 64 rows
  // for each of 48 nutrients.
  const applicableByNutrient = new Map<string, ModifierRow[]>();
  for (const rule of modifiers) {
    if (!ruleMatches(rule, profile)) continue;
    const bucket = applicableByNutrient.get(rule.nutrient_id);
    if (bucket) bucket.push(rule);
    else applicableByNutrient.set(rule.nutrient_id, [rule]);
  }

  const energyRow = nutrients.find((n) => n.nutrient_id === 'energy_kcal');
  const pal = activityById[profile.activity_level]?.pal_multiplier ?? 1;
  const bmr = basalMetabolicRate(profile.sex, profile.age_years, profile.weight_kg);

  const resolvedEnergy = energyRow
    ? resolveOne(
        energyRow,
        profile,
        applicableByNutrient.get('energy_kcal') ?? [],
        bmr * pal,
      ).value
    : bmr * pal;

  const resolved = nutrients.map((nutrient) =>
    resolveOne(
      nutrient,
      profile,
      applicableByNutrient.get(nutrient.nutrient_id) ?? [],
      resolvedEnergy,
    ),
  );

  const byId: Record<string, ResolvedNutrient> = {};
  const allFlags: string[] = [];
  for (const nutrient of resolved) {
    byId[nutrient.nutrient_id] = nutrient;
    for (const flag of nutrient.flags) {
      if (!allFlags.includes(flag)) allFlags.push(flag);
    }
  }

  if (outOfScope) allFlags.unshift('AGE_OUT_OF_SCOPE');

  return {
    nutrients: resolved,
    byId,
    bmr_kcal: bmr,
    pal_multiplier: pal,
    energy_kcal: resolvedEnergy,
    flags: allFlags,
    outOfScope,
  };
}
