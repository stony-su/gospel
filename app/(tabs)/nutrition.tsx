/**
 * The Nutrition tab.
 *
 * Every one of the 48 resolved targets, grouped by category, each against what
 * the plan actually delivers. Where the recipe data cannot measure a nutrient,
 * the row says so instead of inventing a number - which is most of them, and
 * saying it plainly is the point.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { NutrientBar } from '@/components/charts/NutrientBar';
import { TwineChart } from '@/components/charts/TwineChart';
import { Screen } from '@/components/primitives/Screen';
import {
  Body,
  Doctrine,
  Eyebrow,
  Figure,
  Title,
} from '@/components/primitives/Text';
import { categoryRank } from '@/data/nutrition';
import { recipesById } from '@/data/recipes';
import {
  MEASURED_NUTRIENTS,
  UNTARGETED_MEASURES,
  coverageFor,
} from '@/domain/planner/coverage';
import type { ResolvedNutrient } from '@/domain/nutrition/types';
import { GUTTER, ink, radius, signal, space, text } from '@/theme/tokens';
import { useGospel, useTargets } from '@/store/useGospel';

const CATEGORY_LABELS: Record<string, string> = {
  energy: 'Energy',
  macronutrient: 'Macronutrients',
  water: 'Water',
  amino_acid: 'Indispensable amino acids',
  vitamin: 'Vitamins',
  mineral: 'Minerals',
};

export default function NutritionTab() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const plan = useGospel((state) => state.plan);
  const targets = useTargets();

  /** Per-day energy, for the only chart with a genuine sequence on its x axis. */
  const dailyEnergy = useMemo(() => {
    if (!plan) return [];
    const byDay = new Map<number, number>();
    for (const meal of plan.meals) {
      const recipe = recipesById.get(meal.recipeId);
      if (!recipe) continue;
      byDay.set(
        meal.dayIndex,
        (byDay.get(meal.dayIndex) ?? 0) +
          recipe.nutrition.energy_kcal * meal.servings,
      );
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value);
  }, [plan]);

  const grouped = useMemo(() => {
    if (!targets) return [];
    const buckets = new Map<string, ResolvedNutrient[]>();
    for (const nutrient of targets.nutrients) {
      const bucket = buckets.get(nutrient.category);
      if (bucket) bucket.push(nutrient);
      else buckets.set(nutrient.category, [nutrient]);
    }
    return [...buckets.entries()].sort(
      (a, b) => categoryRank(a[0]) - categoryRank(b[0]),
    );
  }, [targets]);

  if (!targets || !plan) {
    return (
      <Screen bottomInset={70}>
        <Title>Nutrition</Title>
        <Body color={text.faint} style={styles.empty}>
          Build a plan and this fills with your resolved targets.
        </Body>
      </Screen>
    );
  }

  /** What the plan delivers for a given nutrient, or null if unmeasurable. */
  const achievedFor = (nutrient: ResolvedNutrient): number | null => {
    if ((MEASURED_NUTRIENTS as readonly string[]).includes(nutrient.nutrient_id)) {
      return plan.averageNutrition[nutrient.nutrient_id] ?? null;
    }
    if (
      nutrient.nutrient_id === 'fat_pct_energy_min' ||
      nutrient.nutrient_id === 'fat_pct_energy_max'
    ) {
      const energy = plan.averageNutrition.energy_kcal ?? 0;
      const fat = plan.averageNutrition.fat_g ?? 0;
      return energy > 0 ? ((fat * 9) / energy) * 100 : null;
    }
    return null;
  };

  const measuredCount = targets.nutrients.filter(
    (nutrient) => coverageFor(nutrient.nutrient_id) !== 'awaiting_fdc',
  ).length;
  const awaiting = targets.nutrients.length - measuredCount;

  const energyTarget = targets.byId.energy_kcal?.value ?? 0;

  return (
    <Screen bottomInset={70}>
      <View style={styles.header}>
        <Eyebrow color={signal.endpoint}>Against your targets</Eyebrow>
        <Title>Nutrition</Title>
        <Doctrine color={text.tertiary} style={styles.subtitle}>
          Colour arrives only when a target does.
        </Doctrine>
      </View>

      {dailyEnergy.length > 1 && (
        <View style={styles.chartBlock}>
          <Eyebrow>Energy across the cycle</Eyebrow>
          <TwineChart
            values={dailyEnergy}
            target={energyTarget}
            width={width - GUTTER * 2}
          />
        </View>
      )}

      <View style={styles.coverage}>
        <View style={styles.coverageRow}>
          <Figure color={text.primary}>{measuredCount}</Figure>
          <Body small color={text.faint}>
            of {targets.nutrients.length} targets can be measured from the recipe
            data.
          </Body>
        </View>
        <Body small color={text.faint} style={styles.coverageNote}>
          The remaining {awaiting} need per-ingredient values from FoodData
          Central. Their targets are resolved and shown; their intake is left
          blank rather than estimated.
        </Body>
      </View>

      {grouped.map(([category, items]) => (
        <View key={category} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Eyebrow color={text.tertiary}>
              {CATEGORY_LABELS[category] ?? category}
            </Eyebrow>
            <View style={styles.sectionRule} />
            <Figure tiny color={ink.dim}>
              {items.length}
            </Figure>
          </View>

          {items.map((nutrient) => (
            <Pressable
              key={nutrient.nutrient_id}
              onPress={() => router.push(`/nutrient/${nutrient.nutrient_id}`)}
              style={({ pressed }) => pressed && styles.pressed}
              accessibilityRole="button"
              accessibilityLabel={`${nutrient.nutrient_name} details`}
            >
              <NutrientBar
                name={nutrient.nutrient_name}
                unit={nutrient.unit}
                target={nutrient.value}
                achieved={achievedFor(nutrient)}
                coverage={coverageFor(nutrient.nutrient_id)}
                ulValue={nutrient.ul_value}
                overUl={nutrient.over_ul}
                approachingUl={nutrient.approaching_ul}
                lowConfidence={nutrient.lowest_confidence === 'low'}
              />
            </Pressable>
          ))}
        </View>
      ))}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Eyebrow color={text.tertiary}>Measured without a target</Eyebrow>
          <View style={styles.sectionRule} />
        </View>
        <Body small color={text.faint} style={styles.coverageNote}>
          The recipe data reports these, but the workbook sets no reference
          intake for them, so there is nothing to compare against.
        </Body>
        {UNTARGETED_MEASURES.map((measure) => (
          <View key={measure.key} style={styles.plainRow}>
            <Body small color={text.secondary}>
              {measure.label}
            </Body>
            <Figure color={text.tertiary}>
              {Math.round(plan.averageNutrition[measure.key] ?? 0)} {measure.unit}
            </Figure>
          </View>
        ))}
      </View>

      {targets.flags.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Eyebrow color={signal.caution}>Flags raised</Eyebrow>
            <View style={styles.sectionRule} />
          </View>
          {targets.flags.map((flag) => (
            <View key={flag} style={styles.flag}>
              <Figure tiny color={signal.caution}>
                {flag}
              </Figure>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xxs },
  subtitle: { marginTop: space.xxs },
  empty: { marginTop: space.md, lineHeight: 21 },
  chartBlock: { marginTop: space.xl, gap: space.sm },
  coverage: {
    marginTop: space.xl,
    padding: space.md,
    backgroundColor: ink.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ink.line,
    gap: space.xs,
  },
  coverageRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  coverageNote: { lineHeight: 18 },
  section: { marginTop: space.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: ink.line },
  pressed: { opacity: 0.6 },
  plainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: space.xs,
  },
  flag: { paddingVertical: 3 },
});
