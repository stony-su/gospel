/**
 * The Nutrition tab.
 *
 * Every one of the 48 resolved targets, grouped by category, each against
 * what the plan actually delivers. Where the recipe data cannot measure a
 * nutrient, the bar is an empty track rather than a zero - most of them are,
 * and drawing the absence is the point.
 *
 * This is the screen the monochrome decision has to survive. Status is fill,
 * hatch and inversion; the only thing colour used to say that form does not
 * is nothing.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Polyline } from 'react-native-svg';

import { categoryRank } from '@/data/nutrition';
import { recipesById } from '@/data/recipes';
import type { ResolvedNutrient } from '@/domain/nutrition/types';
import { MEASURED_NUTRIENTS, coverageFor } from '@/domain/planner/coverage';
import { useGospel, useTargets } from '@/store/useGospel';
import { GUTTER, grade, space, stroke } from '@/theme/tokens';
import { NutrientBar, markFor } from '@/ui/data';
import { Header, Screen, Section } from '@/ui/layout';
import { Reveal } from '@/ui/motion';
import { Plot } from '@/ui/plot';
import { Figure, Label } from '@/ui/text';

const CATEGORY_LABELS: Record<string, string> = {
  energy: 'Energy',
  macronutrient: 'Macronutrients',
  water: 'Water',
  amino_acid: 'Indispensable amino acids',
  vitamin: 'Vitamins',
  mineral: 'Minerals',
};

const CHART_HEIGHT = 150;

export default function NutritionTab() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const plan = useGospel((state) => state.plan);
  const targets = useTargets();

  /** Per-day energy, the only series with a genuine sequence on its x axis. */
  const dailyEnergy = useMemo(() => {
    if (!plan) return [];
    const byDay = new Map<number, number>();
    for (const meal of plan.meals) {
      const recipe = recipesById.get(meal.recipeId);
      if (!recipe) continue;
      byDay.set(
        meal.dayIndex,
        (byDay.get(meal.dayIndex) ?? 0) + recipe.nutrition.energy_kcal * meal.servings,
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
    return [...buckets.entries()].sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]));
  }, [targets]);

  if (!targets || !plan) {
    return (
      <Screen bottomInset={70}>
        <Header title="Nutrition" refButton />
        <Label color={grade[50]}>build a plan to resolve targets</Label>
      </Screen>
    );
  }

  /** What the plan delivers for a nutrient, or null if unmeasurable. */
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

  const energyTarget = targets.byId.energy_kcal?.value ?? 0;
  const plotWidth = width - GUTTER * 2;
  const energyMax = Math.max(energyTarget, ...dailyEnergy) * 1.1;

  return (
    <Screen bottomInset={70} gridOpacity={0.6}>
      <Header
        title="Nutrition"
        refButton
        right={<Label>{`${measuredCount}/${targets.nutrients.length} measured`}</Label>}
      />

      {dailyEnergy.length > 1 && (
        <Section label="Energy across the cycle" index={0}>
          <Plot
            width={plotWidth}
            height={CHART_HEIGHT}
            xDomain={[1, dailyEnergy.length]}
            yDomain={[0, energyMax]}
            target={energyTarget}
            xTicks={Math.min(7, dailyEnergy.length)}
            formatY={(v) => String(Math.round(v))}
          >
            {({ x, y }) => (
              <Polyline
                points={dailyEnergy
                  .map((value, index) => `${x(index + 1)},${y(value)}`)
                  .join(' ')}
                fill="none"
                stroke={grade[100]}
                strokeWidth={stroke.thin}
              />
            )}
          </Plot>
        </Section>
      )}

      {grouped.map(([category, items], position) => (
        <Reveal key={category} index={1 + position} style={styles.group}>
          <View style={styles.groupHead}>
            <Label>{CATEGORY_LABELS[category] ?? category}</Label>
            <View style={styles.groupRule} />
            <Figure small color={grade[50]}>
              {String(items.length)}
            </Figure>
          </View>

          {items.map((nutrient) => {
            const achieved = achievedFor(nutrient);
            return (
              <NutrientBar
                key={nutrient.nutrient_id}
                name={nutrient.nutrient_name}
                unit={nutrient.unit}
                target={nutrient.value}
                intake={achieved}
                mark={markFor(nutrient, achieved)}
                ul={nutrient.ul_value}
                onPress={() => router.push(`/nutrient/${nutrient.nutrient_id}`)}
              />
            );
          })}
        </Reveal>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: space.xl,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  groupRule: {
    flex: 1,
    height: stroke.hair,
    backgroundColor: grade[30],
  },
});
