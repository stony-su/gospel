/**
 * The Plan tab.
 *
 * The schedule is the product, so it opens here. Days run as a vertical list
 * of meals; the cycle selector changes how long the schedule runs before
 * repeating, which regenerates it.
 *
 * Every sentence that used to sit under the title is gone. A plan is a table
 * of days and dishes, and saying "the same meals every day" under a heading
 * that already reads DAILY PLAN was telling the reader something the screen
 * had just told them.
 */

import { useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { recipesById } from '@/data/recipes';
import { recipeImage } from '@/data/recipeImages';
import { CYCLE_LABELS, type CycleLength, type MealSlot } from '@/domain/planner/types';
import { useGospel, useTargets } from '@/store/useGospel';
import { grade, radius, space, stroke, surface } from '@/theme/tokens';
import { Segmented } from '@/ui/controls';
import { Plate, formatAmount } from '@/ui/data';
import { Header, Pair, Row, Screen, Section, Tile } from '@/ui/layout';
import { AnimatedNumber, Press, Reveal } from '@/ui/motion';
import { Figure, Heading, Label } from '@/ui/text';

const CYCLE_OPTIONS: { value: CycleLength; label: string }[] = [
  { value: 1, label: '1d' },
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 21, label: '21d' },
  { value: 28, label: '28d' },
];

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The photographs are bundled, so this is no longer about request count - it
 * is about how much of a row a picture should take next to the figures that
 * are the actual point of the row.
 */
const PLATE = 44;

/**
 * Room the swap control is given at the right of every meal row.
 *
 * A fixed width rather than the text's own: the meal beside it is what gives
 * way when a dish has a long name, and it can only do that if the control's
 * width is not part of the negotiation.
 */
const SWAP_WIDTH = 46;

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
        meals: [...meals].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)),
      }));
  }, [plan]);

  // Targets but no plan is a recoverable state, not a dead end: onboarding is
  // done, so everything a plan needs is already known. It happens when the
  // recipe library is replaced under a saved plan and the store drops it on
  // rehydrate rather than leaving half of it pointing at recipes that no
  // longer exist. Rebuilding is what the reader would press the button for.
  useEffect(() => {
    if (targets && !plan) regeneratePlan();
  }, [targets, plan, regeneratePlan]);

  if (!plan || !targets) {
    return (
      <Screen bottomInset={70}>
        <Header title="No plan" />
        <Label color={grade[50]}>
          {targets ? 'building a plan' : 'finish onboarding to resolve targets'}
        </Label>
      </Screen>
    );
  }

  const energyTarget = targets.byId.energy_kcal?.value ?? 0;
  const energyAchieved = plan.averageNutrition.energy_kcal ?? 0;
  const energyDelta = energyTarget ? (energyAchieved - energyTarget) / energyTarget : 0;
  const proteinTarget = targets.byId.protein_g?.value ?? 0;

  return (
    <Screen bottomInset={70}>
      <Header title={`${CYCLE_LABELS[plan.cycleDays]} plan`} refButton />

      <Reveal index={0} style={styles.cycle}>
        <Segmented options={CYCLE_OPTIONS} value={cycleDays} onChange={setCycleDays} />
      </Reveal>

      <Section label="Per day" index={1}>
        <Pair>
          <Tile label="energy">
            <AnimatedNumber value={energyAchieved} color={grade[96]} suffix=" kcal" />
            <Figure small color={grade[60]}>
              {`${energyDelta >= 0 ? '+' : ''}${(energyDelta * 100).toFixed(0)}% vs ${Math.round(energyTarget)}`}
            </Figure>
          </Tile>

          <Tile label="protein">
            <AnimatedNumber
              value={plan.averageNutrition.protein_g ?? 0}
              color={grade[96]}
              suffix=" g"
            />
            <Figure small color={grade[60]}>{`target ${formatAmount(proteinTarget)}`}</Figure>
          </Tile>

          <Tile label="cost" wide>
            <AnimatedNumber value={plan.costPerWeek} color={grade[96]} prefix="£" suffix="/wk" />
            <Figure small color={grade[60]}>
              {`£${plan.costPerCycle.toFixed(0)} per cycle`}
            </Figure>
          </Tile>
        </Pair>
      </Section>

      {plan.warnings.length > 0 && (
        <Section label="Unmet" index={2}>
          {plan.warnings.map((warning) => (
            <Row
              key={warning}
              inset
              left={<Figure small color={grade[70]}>{warning}</Figure>}
            />
          ))}
        </Section>
      )}

      {days.map(({ dayIndex, meals }, position) => (
        <Reveal key={dayIndex} index={3 + position} style={styles.day}>
          <View style={styles.dayHead}>
            <Label>
              {plan.cycleDays === 1
                ? 'every day'
                : plan.cycleDays === 7
                  ? DAY_NAMES[dayIndex % 7]
                  : `day ${String(dayIndex + 1).padStart(2, '0')}`}
            </Label>
            <View style={styles.dayRule} />
          </View>

          {meals.map((meal) => {
            const recipe = recipesById.get(meal.recipeId);
            if (!recipe) return null;
            return (
              <View key={`${meal.dayIndex}-${meal.slot}`} style={styles.meal}>
                <Press
                  grow
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  plain
                  accessibilityLabel={recipe.name}
                  style={styles.mealMain}
                >
                  <Plate
                    source={recipeImage(recipe.slug)?.thumb ?? null}
                    width={PLATE}
                    height={PLATE}
                    fallbackLabel={meal.slot.slice(0, 3)}
                  />
                  <View style={styles.mealBody}>
                    {/* The description belongs on the recipe screen, not in a
                        list row: a row is scanned, and a sentence in one is
                        read past rather than read. */}
                    <Heading numberOfLines={2}>{recipe.name}</Heading>
                    <View style={styles.mealMeta}>
                      <Label color={grade[50]}>{meal.slot.slice(0, 3)}</Label>
                      <Figure small color={grade[60]}>{`${recipe.minutes} min`}</Figure>
                      <Figure small color={grade[60]}>{`L${recipe.difficulty}`}</Figure>
                      <Figure small color={grade[60]}>
                        {`${Math.round(recipe.nutrition.energy_kcal * meal.servings)} kcal`}
                      </Figure>
                      {meal.servings !== 1 && (
                        <Figure small color={grade[96]}>{`×${meal.servings}`}</Figure>
                      )}
                    </View>
                  </View>
                </Press>

                {/* Its own target rather than a gesture on the row: the row
                    already opens the recipe, and a plan you cannot argue with
                    is one you stop following in week two. */}
                <Press
                  onPress={() => router.push(`/swap/${meal.dayIndex}/${meal.slot}`)}
                  plain
                  accessibilityLabel={`Replace ${recipe.name}`}
                  style={styles.swap}
                >
                  <Label color={grade[60]}>swap</Label>
                </Press>
              </View>
            );
          })}
        </Reveal>
      ))}

      <Press
        onPress={() => regeneratePlan()}
        plain
        accessibilityLabel="Build a different plan"
        style={styles.regenerate}
      >
        <Label color={grade[90]}>rebuild</Label>
      </Press>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cycle: {
    marginBottom: space.xl,
  },
  metric: {
    alignItems: 'flex-end',
  },
  day: {
    marginBottom: space.lg,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  dayRule: {
    flex: 1,
    height: stroke.hair,
    backgroundColor: grade[30],
  },
  meal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: surface.row,
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.xxs,
    gap: space.sm,
  },
  mealMain: {
    flex: 1,
    // A flex child will not shrink below its content unless it is told it
    // may. Without this the plate and the figures set the row's minimum
    // width and push the swap control past the card's right edge.
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  swap: {
    width: SWAP_WIDTH,
    alignItems: 'flex-end',
    paddingVertical: space.sm,
  },
  mealBody: {
    flex: 1,
    // Without this the meta row's figures set the row's minimum width and
    // push the swap control off the right edge rather than wrapping.
    minWidth: 0,
    gap: space.xxs,
  },
  mealMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  regenerate: {
    alignSelf: 'flex-start',
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: surface.row,
    borderRadius: radius.sm,
  },
});
