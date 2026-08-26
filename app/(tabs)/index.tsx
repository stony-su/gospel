/**
 * The Plan tab.
 *
 * The schedule is the product, so it opens here. Days run as a vertical list
 * of meal cards; the cycle selector at the top changes how long the schedule
 * runs before repeating, which regenerates it.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/primitives/Screen';
import { Segmented } from '@/components/primitives/Choice';
import {
  Body,
  Doctrine,
  Eyebrow,
  Figure,
  Heading,
  Title,
} from '@/components/primitives/Text';
import { recipesById } from '@/data/recipes';
import { CYCLE_LABELS, type CycleLength, type MealSlot } from '@/domain/planner/types';
import { useGospel, useTargets } from '@/store/useGospel';
import { ink, radius, signal, space, text } from '@/theme/tokens';

const CYCLE_OPTIONS: { value: CycleLength; label: string }[] = [
  { value: 1, label: 'Daily' },
  { value: 7, label: 'Weekly' },
  { value: 14, label: '2 wk' },
  { value: 21, label: '3 wk' },
  { value: 28, label: 'Month' },
];

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanTab() {
  const router = useRouter();
  const plan = useGospel((state) => state.plan);
  const cycleDays = useGospel((state) => state.cycleDays);
  const setCycleDays = useGospel((state) => state.setCycleDays);
  const regeneratePlan = useGospel((state) => state.regeneratePlan);
  const targets = useTargets();

  const days = useMemo(() => {
    if (!plan) return [];
    const grouped = new Map<number, typeof plan.meals>();
    for (const meal of plan.meals) {
      const bucket = grouped.get(meal.dayIndex);
      if (bucket) bucket.push(meal);
      else grouped.set(meal.dayIndex, [meal]);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([dayIndex, meals]) => ({
        dayIndex,
        meals: [...meals].sort(
          (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot),
        ),
      }));
  }, [plan]);

  if (!plan || !targets) {
    return (
      <Screen bottomInset={70}>
        <Title>No plan yet</Title>
        <Body color={text.faint} style={styles.empty}>
          Finish onboarding and Gospel will resolve your targets and build a
          schedule.
        </Body>
      </Screen>
    );
  }

  const energyTarget = targets.byId.energy_kcal?.value ?? 0;
  const energyAchieved = plan.averageNutrition.energy_kcal ?? 0;
  const energyDelta = energyTarget ? (energyAchieved - energyTarget) / energyTarget : 0;

  return (
    <Screen bottomInset={70}>
      <View style={styles.header}>
        <Eyebrow color={signal.endpoint}>The schedule</Eyebrow>
        <Title>{CYCLE_LABELS[plan.cycleDays]} plan</Title>
        <Doctrine color={text.tertiary} style={styles.subtitle}>
          {plan.cycleDays === 1
            ? 'The same meals every day.'
            : `${plan.cycleDays} days, then it begins again.`}
        </Doctrine>
      </View>

      <View style={styles.cycleRow}>
        <Segmented
          options={CYCLE_OPTIONS}
          value={cycleDays}
          onChange={(value) => setCycleDays(value)}
        />
      </View>

      <View style={styles.summary}>
        <Metric
          label="Energy"
          value={`${Math.round(energyAchieved)}`}
          unit="kcal/day"
          tone={Math.abs(energyDelta) < 0.08 ? 'endpoint' : 'neutral'}
          note={`${energyDelta >= 0 ? '+' : ''}${(energyDelta * 100).toFixed(0)}% vs target`}
        />
        <Metric
          label="Cost"
          value={`£${plan.costPerWeek.toFixed(0)}`}
          unit="per week"
          tone="neutral"
          note={`£${plan.costPerCycle.toFixed(0)} per cycle`}
        />
        <Metric
          label="Protein"
          value={`${Math.round(plan.averageNutrition.protein_g ?? 0)}`}
          unit="g/day"
          tone="neutral"
          note={`target ${Math.round(targets.byId.protein_g?.value ?? 0)} g`}
        />
      </View>

      {plan.warnings.length > 0 && (
        <View style={styles.warnings}>
          {plan.warnings.map((warning) => (
            <View key={warning} style={styles.warning}>
              <Body small color={signal.caution} style={styles.warningText}>
                {warning}
              </Body>
            </View>
          ))}
        </View>
      )}

      <View style={styles.days}>
        {days.map(({ dayIndex, meals }) => (
          <View key={dayIndex} style={styles.day}>
            <View style={styles.dayHeader}>
              <Eyebrow color={text.tertiary}>
                {plan.cycleDays === 1
                  ? 'Every day'
                  : plan.cycleDays === 7
                    ? DAY_NAMES[dayIndex % 7]
                    : `Day ${String(dayIndex + 1).padStart(2, '0')}`}
              </Eyebrow>
              <View style={styles.dayRule} />
            </View>

            {meals.map((meal) => {
              const recipe = recipesById.get(meal.recipeId);
              if (!recipe) return null;
              return (
                <Pressable
                  key={`${meal.dayIndex}-${meal.slot}`}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  style={({ pressed }) => [styles.meal, pressed && styles.mealPressed]}
                  accessibilityRole="button"
                >
                  <View style={styles.mealSlot}>
                    <Eyebrow color={text.faint}>{meal.slot.slice(0, 3)}</Eyebrow>
                  </View>

                  <View style={styles.mealBody}>
                    <Heading color={text.primary} numberOfLines={2}>
                      {recipe.name}
                    </Heading>
                    <View style={styles.mealMeta}>
                      <Figure tiny color={text.faint}>
                        {recipe.minutes} min
                      </Figure>
                      <Figure tiny color={text.faint}>
                        L{recipe.difficulty}
                      </Figure>
                      <Figure tiny color={text.faint}>
                        {Math.round(recipe.nutrition.energy_kcal * meal.servings)} kcal
                      </Figure>
                      {meal.servings !== 1 && (
                        <Figure tiny color={signal.endpoint}>
                          ×{meal.servings}
                        </Figure>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => regeneratePlan()}
        style={({ pressed }) => [styles.regenerate, pressed && styles.mealPressed]}
        accessibilityRole="button"
      >
        <Eyebrow color={text.tertiary}>Build a different plan</Eyebrow>
      </Pressable>

      <Figure tiny color={ink.dim} style={styles.seed}>
        seed {plan.seed}
      </Figure>
    </Screen>
  );
}

function Metric({
  label,
  value,
  unit,
  note,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  tone: 'endpoint' | 'neutral';
}) {
  return (
    <View style={styles.metric}>
      <Eyebrow>{label}</Eyebrow>
      <View style={styles.metricValueRow}>
        <Body
          style={styles.metricValue}
          color={tone === 'endpoint' ? signal.endpoint : text.bright}
        >
          {value}
        </Body>
      </View>
      <Figure tiny color={text.faint}>
        {unit}
      </Figure>
      <Figure tiny color={ink.dim}>
        {note}
      </Figure>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xxs },
  subtitle: { marginTop: space.xxs },
  empty: { marginTop: space.md, lineHeight: 21 },
  cycleRow: { marginTop: space.lg },
  summary: {
    flexDirection: 'row',
    marginTop: space.lg,
    gap: space.md,
  },
  metric: { flex: 1, gap: 2 },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  metricValue: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 22,
    letterSpacing: -0.8,
  },
  warnings: { marginTop: space.lg, gap: space.xs },
  warning: {
    borderLeftWidth: 2,
    borderLeftColor: signal.caution,
    paddingLeft: space.sm,
    paddingVertical: space.xxs,
  },
  warningText: { lineHeight: 18 },
  days: { marginTop: space.xl, gap: space.lg },
  day: { gap: space.xs },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dayRule: { flex: 1, height: 1, backgroundColor: ink.line },
  meal: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    backgroundColor: ink.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ink.line,
  },
  mealPressed: { opacity: 0.65 },
  mealSlot: { width: 34, paddingTop: 3 },
  mealBody: { flex: 1, gap: space.xxs },
  mealMeta: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  regenerate: {
    marginTop: space.xl,
    alignItems: 'center',
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ink.line,
  },
  seed: { marginTop: space.sm, textAlign: 'center' },
});
