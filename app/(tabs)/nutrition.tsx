/**
 * The Nutrition tab, as an index.
 *
 * Forty-eight targets on one scroll was a wall. What a reader wants first is
 * the shape of the answer - which groups are covered and which are not - and
 * only then the rows. So this screen answers that in six lines and hands off
 * to a page per category.
 *
 * The energy plot stays here because it is the one genuinely cross-cutting
 * view: it belongs to no category and reads against all of them.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Polyline } from 'react-native-svg';

import { categoryRank } from '@/data/nutrition';
import { recipesById } from '@/data/recipes';
import type { ResolvedNutrient } from '@/domain/nutrition/types';
import { coverageFor } from '@/domain/planner/coverage';
import { useGospel, useTargets } from '@/store/useGospel';
import { GUTTER, grade, radius, space, stroke, surface } from '@/theme/tokens';
import { categoryLabel, metCount } from '@/ui/data';
import { Header, Screen, Section } from '@/ui/layout';
import { Press, Reveal } from '@/ui/motion';
import { Plot } from '@/ui/plot';
import { Figure, Label } from '@/ui/text';

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

  const measuredCount = targets.nutrients.filter(
    (nutrient) => coverageFor(nutrient.nutrient_id) !== 'awaiting_fdc',
  ).length;

  const energyTarget = targets.byId.energy_kcal?.value ?? 0;
  const plotWidth = width - GUTTER * 2;
  const energyMax = Math.max(energyTarget, ...dailyEnergy) * 1.1;

  return (
    <Screen bottomInset={70}>
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

      <Label style={styles.groupsLabel}>Groups</Label>

      {grouped.map(([category, items], position) => {
        const met = metCount(plan, items);
        return (
          <Reveal key={category} index={1 + position}>
            <Press
              // Object form: `/nutrition` is also a tab route, so typed
              // routes emit the category page as a static pathname rather
              // than a template. This is the canonical syntax regardless.
              onPress={() =>
                router.push({ pathname: '/nutrition/[category]', params: { category } })
              }
              plain
              accessibilityLabel={categoryLabel(category)}
              style={styles.row}
            >
              <View style={styles.rowHead}>
                <Label color={grade[90]}>{categoryLabel(category)}</Label>
                <View style={styles.rowRule} />
                <Figure small color={grade[70]}>{`${met}/${items.length}`}</Figure>
                <Label color={grade[50]}>›</Label>
              </View>

              {/* One bar per group: how much of it the plan reaches. The
                  detail is a tap away; this is the shape of the answer. */}
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${items.length > 0 ? (met / items.length) * 100 : 0}%` },
                  ]}
                />
              </View>
            </Press>
          </Reveal>
        );
      })}

    </Screen>
  );
}

const styles = StyleSheet.create({
  groupsLabel: {
    marginBottom: space.sm,
  },
  row: {
    backgroundColor: surface.row,
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.xxs,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  rowRule: {
    flex: 1,
    height: stroke.hair,
    backgroundColor: grade[30],
  },
  track: {
    height: 6,
    borderWidth: stroke.hair,
    borderColor: grade[40],
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: grade[100],
  },
});
