/**
 * Onboarding.
 *
 * Twelve questions, one per screen, ending in the moment the targets resolve.
 * Six of them feed the nutrition engine and are exactly the inputs the
 * workbook defines; the rest shape which recipes the planner may choose from.
 *
 * A single stepper rather than twelve routes: the questions share a frame, a
 * progress rail and a back stack, and splitting them across files would spread
 * one flow over twelve places for no benefit.
 *
 * Every question used to carry a paragraph explaining what it fed. Those are
 * gone. A question with a title, a control and a unit is answerable; the
 * explanation of which nutrients it scales belongs on the nutrient screens,
 * where it can be read against the number it changed. What survives is the
 * handful of notes that change the answer rather than describe it - an
 * under-19 warning, a thin recipe library - and those are stated as one line.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { activityLevels } from '@/data/nutrition';
import { availableCuisines, isLibraryThin, recipeCountForDiet } from '@/data/recipes';
import { resolveTargets } from '@/domain/nutrition/resolver';
import { CYCLE_LABELS, type CycleLength } from '@/domain/planner/types';
import { profileFrom, useGospel } from '@/store/useGospel';
import { GUTTER, grade, space, stroke } from '@/theme/tokens';
import { Chip, Option, Slider } from '@/ui/controls';
import { DietSpectrum, NutrientBar, SunMap, formatAmount, markFor } from '@/ui/data';
import { AnimatedNumber, Press } from '@/ui/motion';
import { ProgressRail } from '@/ui/plot';
import { Figure, Label, Title } from '@/ui/text';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Assembly',
  2: 'Simple',
  3: 'Standard',
  4: 'Involved',
  5: 'Ambitious',
};

const STEP_COUNT = 12;

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const answers = useGospel((state) => state.answers);
  const setAnswer = useGospel((state) => state.setAnswer);
  const cycleDays = useGospel((state) => state.cycleDays);
  const setCycleDaysRaw = useGospel.getState().setCycleDays;
  const completeOnboarding = useGospel((state) => state.completeOnboarding);

  const [step, setStep] = useState(0);
  const [dietPosition, setDietPosition] = useState(3);

  const profile = profileFrom(answers);
  const targets = useMemo(() => (profile ? resolveTargets(profile) : null), [profile]);

  const canAdvance = ((): boolean => {
    switch (step) {
      case 0: return answers.sex !== null;
      case 1: return answers.age_years !== null;
      case 2: return answers.weight_kg !== null;
      case 3: return answers.diet_type !== null;
      case 4: return answers.activity_level !== null;
      case 5: return answers.sun_zone !== null;
      case 6: return true; // Cuisine preference is optional.
      case 7: return answers.maxDifficulty !== null;
      case 8: return answers.maxMinutes !== null;
      case 9: return answers.weeklyBudget !== null;
      case 10: return true;
      default: return true;
    }
  })();

  const advance = () => {
    if (step < STEP_COUNT - 1) {
      setStep(step + 1);
      return;
    }
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const goBack = () => {
    if (step === 0) router.back();
    else setStep(step - 1);
  };

  const underAge = answers.age_years !== null && answers.age_years < 19;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerRow}>
          <Press onPress={goBack} plain accessibilityLabel="Previous">
            <Label color={grade[60]}>{step === 0 ? 'back' : 'previous'}</Label>
          </Press>
          <Figure small color={grade[60]}>
            {`${String(step + 1).padStart(2, '0')} / ${STEP_COUNT}`}
          </Figure>
        </View>
        <ProgressRail total={STEP_COUNT} answered={step + 1} width={width - GUTTER * 2} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={step} entering={FadeInRight.duration(280)} style={styles.step}>
          {step === 0 && (
            <Question title="Biological sex">
              <Option
                label="Male"
                selected={answers.sex === 'male'}
                onPress={() => setAnswer('sex', 'male')}
              />
              <Option
                label="Female"
                selected={answers.sex === 'female'}
                onPress={() => setAnswer('sex', 'female')}
              />
            </Question>
          )}

          {step === 1 && (
            <Question title="Age">
              <Slider
                value={answers.age_years ?? 30}
                onChange={(value) => setAnswer('age_years', value)}
                min={16}
                max={100}
                unit="years"
                label="age"
              />
              {underAge && <Note>outside dataset scope — targets unsupported below 19</Note>}
            </Question>
          )}

          {step === 2 && (
            <Question title="Weight">
              <Slider
                value={answers.weight_kg ?? 70}
                onChange={(value) => setAnswer('weight_kg', value)}
                min={35}
                max={200}
                unit="kg"
                label="weight"
              />
            </Question>
          )}

          {step === 3 && (
            <Question title="Diet">
              <DietSpectrum
                position={dietPosition}
                onChange={(position, dietType, fraction) => {
                  setDietPosition(position);
                  setAnswer('diet_type', dietType);
                  setAnswer('animal_food_fraction', fraction);
                }}
              />
              {answers.diet_type && isLibraryThin(answers.diet_type) && (
                <Note>
                  {`only ${recipeCountForDiet(answers.diet_type)} recipes fit — the plan will repeat`}
                </Note>
              )}
            </Question>
          )}

          {step === 4 && (
            <Question title="Activity">
              {activityLevels.map((level) => (
                <Option
                  key={level.activity_level}
                  // No PAL multiplier: it is the resolver's coefficient, not a
                  // fact about the person answering. Showing it invites the
                  // reader to pick the bigger number rather than the true one.
                  label={level.label}
                  selected={answers.activity_level === level.activity_level}
                  onPress={() => setAnswer('activity_level', level.activity_level)}
                />
              ))}
            </Question>
          )}

          {step === 5 && (
            <Question title="Sun exposure" note="latitude only">
              <SunMap
                latitude={answers.latitude}
                longitude={answers.longitude}
                onPick={(latitude, longitude, zone) => {
                  setAnswer('latitude', latitude);
                  setAnswer('longitude', longitude);
                  setAnswer('sun_zone', zone.sun_zone);
                }}
              />
            </Question>
          )}

          {step === 6 && (
            <Question title="Cuisines" note="optional">
              <View style={styles.chips}>
                {availableCuisines.map((cuisine) => (
                  <Chip
                    key={cuisine.id}
                    label={cuisine.label}
                    meta={String(cuisine.count)}
                    selected={answers.cuisines.includes(cuisine.id)}
                    onPress={() =>
                      setAnswer(
                        'cuisines',
                        answers.cuisines.includes(cuisine.id)
                          ? answers.cuisines.filter((id) => id !== cuisine.id)
                          : [...answers.cuisines, cuisine.id],
                      )
                    }
                  />
                ))}
              </View>
            </Question>
          )}

          {step === 7 && (
            <Question title="Difficulty ceiling">
              {[1, 2, 3, 4, 5].map((level) => (
                <Option
                  key={level}
                  label={DIFFICULTY_LABELS[level]}
                  selected={answers.maxDifficulty === level}
                  onPress={() => setAnswer('maxDifficulty', level)}
                />
              ))}
            </Question>
          )}

          {step === 8 && (
            <Question title="Time per meal">
              <Slider
                value={answers.maxMinutes ?? 45}
                onChange={(value) => setAnswer('maxMinutes', value)}
                min={10}
                // The longest dish in the library is a four-hour one - ribs,
                // galbi, pho, cassoulet. A ceiling below it would put six
                // recipes permanently out of reach of every plan.
                max={240}
                step={5}
                unit="min"
                label="ceiling"
              />
            </Question>
          )}

          {step === 9 && (
            <Question title="Weekly budget">
              <Slider
                value={answers.weeklyBudget ?? 70}
                onChange={(value) => setAnswer('weeklyBudget', value)}
                min={20}
                max={250}
                step={5}
                unit="£"
                label="per week"
              />
            </Question>
          )}

          {step === 10 && (
            <Question title="How often it repeats">
              {(Object.keys(CYCLE_LABELS) as unknown as string[]).map(Number).map((days) => (
                <Option
                  key={days}
                  label={CYCLE_LABELS[days as CycleLength]}
                  selected={cycleDays === days}
                  onPress={() => setCycleDaysRaw(days as CycleLength)}
                />
              ))}
            </Question>
          )}

          {step === 11 && targets && <Resolution targets={targets} />}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Press
          onPress={advance}
          plain
          disabled={!canAdvance}
          accessibilityLabel={step === STEP_COUNT - 1 ? 'Build my plan' : 'Continue'}
          style={[styles.cta, !canAdvance && styles.ctaDisabled]}
        >
          <Label color={canAdvance ? grade[0] : grade[50]}>
            {step === STEP_COUNT - 1 ? 'build my plan' : 'continue'}
          </Label>
        </Press>
      </View>
    </View>
  );
}

function Question({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.question}>
      <Title>{title}</Title>
      {note ? (
        <Label color={grade[50]} style={styles.questionNote}>
          {note}
        </Label>
      ) : null}
      <View style={styles.questionBody}>{children}</View>
    </View>
  );
}

/** A note that changes the answer, rather than describing the question. */
function Note({ children }: { children: string }) {
  return (
    <View style={styles.note}>
      <Label color={grade[90]}>{children}</Label>
    </View>
  );
}

/** The payoff: the six inputs become 48 resolved targets. */
function Resolution({ targets }: { targets: ReturnType<typeof resolveTargets> }) {
  const highlights = [
    'energy_kcal',
    'protein_g',
    'fiber_g',
    'vitamin_d_ug',
    'iron_mg',
    'calcium_mg',
  ];

  return (
    <View style={styles.question}>
      <Title>Your daily targets</Title>
      <Label color={grade[50]} style={styles.questionNote}>
        {`${targets.nutrients.length} resolved`}
      </Label>

      <View style={styles.energy}>
        <Label color={grade[60]}>
          {`basal ${formatAmount(targets.bmr_kcal)} × pal ${targets.pal_multiplier}`}
        </Label>
        <View style={styles.energyRow}>
          <AnimatedNumber value={targets.energy_kcal} variant="display" color={grade[96]} />
          <Figure color={grade[70]}>kcal / day</Figure>
        </View>
      </View>

      <View style={styles.highlights}>
        {highlights.map((id) => {
          const nutrient = targets.byId[id];
          if (!nutrient) return null;
          return (
            <NutrientBar
              key={id}
              name={nutrient.nutrient_name}
              unit={nutrient.unit}
              target={nutrient.value}
              intake={null}
              mark={markFor(nutrient, null)}
              ul={nutrient.ul_value}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: grade[0],
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: GUTTER,
    paddingBottom: space.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: space.lg,
  },
  step: {
    flex: 1,
  },
  question: {
    gap: space.xs,
  },
  questionNote: {
    marginTop: space.xxs,
  },
  questionBody: {
    marginTop: space.lg,
  },
  note: {
    marginTop: space.md,
    paddingLeft: space.sm,
    borderLeftWidth: stroke.medium,
    borderLeftColor: grade[96],
    paddingVertical: space.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  energy: {
    marginTop: space.lg,
    marginBottom: space.md,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  highlights: {
    marginTop: space.sm,
  },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    borderTopWidth: stroke.hair,
    borderTopColor: grade[40],
    backgroundColor: grade[0],
  },
  cta: {
    alignItems: 'center',
    backgroundColor: grade[96],
    paddingVertical: space.sm,
  },
  ctaDisabled: {
    backgroundColor: grade[20],
  },
});
