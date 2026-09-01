/**
 * Replacing one meal.
 *
 * The plan is solved once and repeats, which is the point of it - and it is
 * also why a single dish the reader will not cook poisons the whole cycle.
 * This is the one place the solver's answer is up for negotiation, so it shows
 * its working: every option is ranked by the same objective that built the
 * plan, and each card opens onto why it sits where it does.
 *
 * The cards are closed by default and one at a time. A radar is a shape to be
 * looked at, and forty of them stacked is a texture rather than a comparison;
 * the closed row carries the three figures a reader scans on - fit, energy,
 * time - and the open one carries the argument.
 */

import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { recipes, recipesById } from '@/data/recipes';
import { recipeImage } from '@/data/recipeImages';
import type { MealSlot } from '@/domain/planner/types';
import {
  SHAPE_NUTRIENTS,
  rankReplacements,
  targetFor,
  type Replacement,
} from '@/domain/planner/swap';
import { preferencesFrom, useGospel, useTargets } from '@/store/useGospel';
import { GUTTER, grade, radius, space, stroke, surface } from '@/theme/tokens';
import { Plate, formatAmount } from '@/ui/data';
import { Header, Screen } from '@/ui/layout';
import { Press, Reveal } from '@/ui/motion';
import { Radar, type RadarAxis } from '@/ui/plot';
import { Figure, Heading, Label, Prose } from '@/ui/text';

const SLOT_NAMES: Record<MealSlot, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SwapMeal() {
  const params = useLocalSearchParams<{ day: string; slot: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const plan = useGospel((state) => state.plan);
  const answers = useGospel((state) => state.answers);
  const mealsPerDay = useGospel((state) => state.mealsPerDay);
  const replaceMeal = useGospel((state) => state.replaceMeal);
  const targets = useTargets();

  const [open, setOpen] = useState<number | null>(null);

  const dayIndex = Number(params.day);
  const slot = params.slot as MealSlot;

  const options = useMemo(() => {
    if (!plan || !targets) return [];
    return rankReplacements({
      plan,
      targets,
      preferences: preferencesFrom(answers, mealsPerDay),
      recipes,
      recipesById,
      dayIndex,
      slot,
      dietType: answers.diet_type ?? 'iifym',
    });
  }, [plan, targets, answers, mealsPerDay, dayIndex, slot]);

  const current = options.find((option) => option.current);

  if (!plan || !targets || options.length === 0) {
    return (
      <Screen>
        <Press onPress={() => router.back()} plain accessibilityLabel="Close">
          <Label color={grade[70]}>close</Label>
        </Press>
        <Header title="Nothing to swap" />
        <Prose color={grade[70]}>
          No other recipe fits this slot within your time, difficulty and diet
          limits. Loosening one of them in onboarding widens the choice.
        </Prose>
      </Screen>
    );
  }

  const dayLabel =
    plan.cycleDays === 1
      ? 'every day'
      : plan.cycleDays === 7
        ? DAY_NAMES[dayIndex % 7]
        : `day ${String(dayIndex + 1).padStart(2, '0')}`;

  return (
    <Screen>
      <Press
        onPress={() => router.back()}
        plain
        accessibilityLabel="Close"
        style={styles.close}
      >
        <Label color={grade[70]}>close</Label>
      </Press>

      <Header
        title={`${dayLabel} ${SLOT_NAMES[slot]}`}
        right={<Label>{`${options.length} options`}</Label>}
      />

      <Prose color={grade[60]} style={styles.blurb}>
        {current
          ? `Ranked by how close each one leaves the day to its targets — the same measure that chose ${current.recipe.name}.`
          : 'Ranked by how close each one leaves the day to its targets.'}
      </Prose>

      {options.map((option, position) => (
        <Reveal key={option.recipe.id} index={Math.min(position, 8)}>
          <Card
            option={option}
            reference={current}
            targets={targets}
            mealsPerDay={mealsPerDay.length}
            width={width - GUTTER * 2}
            open={open === option.recipe.id}
            onToggle={() =>
              setOpen((wasOpen) =>
                wasOpen === option.recipe.id ? null : option.recipe.id,
              )
            }
            onChoose={() => {
              replaceMeal(dayIndex, slot, option.recipe.id);
              router.back();
            }}
          />
        </Reveal>
      ))}
    </Screen>
  );
}

interface CardProps {
  option: Replacement;
  reference?: Replacement;
  targets: NonNullable<ReturnType<typeof useTargets>>;
  mealsPerDay: number;
  width: number;
  open: boolean;
  onToggle: () => void;
  onChoose: () => void;
}

function Card({
  option,
  reference,
  targets,
  mealsPerDay,
  width,
  open,
  onToggle,
  onChoose,
}: CardProps) {
  const { recipe } = option;

  const axes: RadarAxis[] = SHAPE_NUTRIENTS.map(({ id, label }) => ({
    id,
    label,
    value: option.mealShare[id] ?? 0,
  }));

  const referenceAxes: RadarAxis[] | undefined =
    reference && reference.recipe.id !== recipe.id
      ? SHAPE_NUTRIENTS.map(({ id, label }) => ({
          id,
          label,
          value: reference.mealShare[id] ?? 0,
        }))
      : undefined;

  const chart = Math.min(width - space.md * 2, 260);

  return (
    <View style={[styles.card, option.current && styles.cardCurrent]}>
      <Press
        onPress={onToggle}
        plain
        accessibilityLabel={`${recipe.name}, ${Math.round(option.fit * 100)} per cent fit`}
        style={styles.head}
      >
        <Plate
          source={recipeImage(recipe.slug)?.thumb ?? null}
          width={44}
          height={44}
          fallbackLabel={recipe.slot.slice(0, 3)}
        />

        <View style={styles.headBody}>
          <Heading numberOfLines={2}>{recipe.name}</Heading>
          <View style={styles.meta}>
            {option.current ? (
              <Label color={grade[96]}>in the plan</Label>
            ) : (
              <Label color={grade[50]}>{`${Math.round(option.fit * 100)}% fit`}</Label>
            )}
            <Figure small color={grade[60]}>
              {`${Math.round(recipe.nutrition.energy_kcal * option.servings)} kcal`}
            </Figure>
            <Figure small color={grade[60]}>{`${recipe.minutes} min`}</Figure>
            <Figure small color={grade[60]}>{`£${option.cost.toFixed(2)}`}</Figure>
          </View>
        </View>

        <Label color={grade[50]}>{open ? '−' : '+'}</Label>
      </Press>

      {/* The fit rail. Relative to the other options for this slot, which is
          the only comparison the number can honestly support. */}
      <View style={styles.rail}>
        <View style={[styles.railFill, { width: `${Math.max(option.fit, 0.02) * 100}%` }]} />
      </View>

      {open && (
        <View style={styles.body}>
          <View style={styles.chartRow}>
            <Radar axes={axes} reference={referenceAxes} size={chart} />
          </View>

          <Prose color={grade[60]} style={styles.legend}>
            {referenceAxes
              ? 'Solid is this dish, dashed is the one it replaces. On the ring is in proportion.'
              : 'On the ring is in proportion for one meal of the day.'}
          </Prose>

          <View style={styles.figures}>
            {SHAPE_NUTRIENTS.map(({ id, label }) => {
              const target = targetFor(id, targets);
              const share = option.mealShare[id] ?? 0;
              const amount = target ? (share * target) / mealsPerDay : 0;
              return (
                <View key={id} style={styles.figureRow}>
                  <Label color={grade[50]}>{label}</Label>
                  <View style={styles.figureRight}>
                    <Figure color={grade[90]}>{formatAmount(amount)}</Figure>
                    <Figure small color={grade[share > 1.35 || share < 0.65 ? 96 : 50]}>
                      {`${Math.round(share * 100)}% of share`}
                    </Figure>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.stats}>
            <Stat label="portions" value={`×${option.servings}`} />
            <Stat label="difficulty" value={`${recipe.difficulty} / 5`} />
            <Stat label="prep" value={`${recipe.prep_minutes} min`} />
            <Stat label="cuisine" value={recipe.cuisine.replace(/_/g, ' ')} />
          </View>

          {option.current ? (
            <Label color={grade[50]} style={styles.choose}>
              already in the plan
            </Label>
          ) : (
            <Press
              onPress={onChoose}
              plain
              accessibilityLabel={`Put ${recipe.name} in the plan`}
              style={styles.chooseButton}
            >
              <Label color={grade[96]}>use this instead</Label>
            </Press>
          )}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Label color={grade[50]}>{label}</Label>
      <Figure color={grade[90]}>{value}</Figure>
    </View>
  );
}

const styles = StyleSheet.create({
  close: {
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
    marginBottom: space.xs,
  },
  blurb: {
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  card: {
    backgroundColor: surface.panel,
    borderRadius: radius.lg,
    borderWidth: stroke.hair,
    borderColor: grade[20],
    marginBottom: space.xs,
    overflow: 'hidden',
  },
  cardCurrent: {
    borderColor: grade[50],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
  },
  headBody: {
    flex: 1,
    gap: space.xxs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  rail: {
    height: 2,
    backgroundColor: grade[15],
  },
  railFill: {
    height: 2,
    backgroundColor: grade[70],
  },
  body: {
    padding: space.md,
    gap: space.md,
  },
  chartRow: {
    alignItems: 'center',
  },
  legend: {
    textAlign: 'center',
  },
  figures: {
    gap: space.xxs,
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: surface.row,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  figureRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  stat: {
    gap: space.xxs,
  },
  choose: {
    textAlign: 'center',
    paddingVertical: space.sm,
  },
  chooseButton: {
    alignItems: 'center',
    backgroundColor: surface.raised,
    borderRadius: radius.md,
    borderWidth: stroke.hair,
    borderColor: grade[40],
    paddingVertical: space.sm,
  },
});
