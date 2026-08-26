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
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';

import { DietSpectrum } from '@/components/DietSpectrum';
import { SunMap } from '@/components/SunMap';
import { TwineRail } from '@/components/charts/TwineRail';
import { Chip, OptionRow, Segmented } from '@/components/primitives/Choice';
import { InstrumentSlider } from '@/components/primitives/InstrumentSlider';
import {
  Body,
  Doctrine,
  Eyebrow,
  Figure,
  Title,
} from '@/components/primitives/Text';
import { NutrientBar, formatValue } from '@/components/charts/NutrientBar';
import { activityLevels, dietAnchors } from '@/data/nutrition';
import { availableCuisines, isLibraryThin, recipeCountForDiet } from '@/data/recipes';
import { resolveTargets } from '@/domain/nutrition/resolver';
import { coverageFor } from '@/domain/planner/coverage';
import { CYCLE_LABELS, type CycleLength } from '@/domain/planner/types';
import { profileFrom, useGospel } from '@/store/useGospel';
import { GUTTER, ink, radius, signal, space, text } from '@/theme/tokens';

const DIFFICULTY_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: 'Assembly', description: 'Almost no technique. Combine and serve.' },
  2: { label: 'Simple', description: 'One pan, few steps, nothing to time carefully.' },
  3: { label: 'Standard', description: 'Normal home cooking with a little multitasking.' },
  4: { label: 'Involved', description: 'Several components, real technique, some timing pressure.' },
  5: { label: 'Ambitious', description: 'Long builds and advanced technique. Cook because you want to.' },
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
  const targets = useMemo(
    () => (profile ? resolveTargets(profile) : null),
    [profile],
  );

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
          <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
            <Eyebrow color={text.faint}>{step === 0 ? 'Back' : 'Previous'}</Eyebrow>
          </Pressable>
          <Figure tiny color={text.faint}>
            {String(step + 1).padStart(2, '0')} / {STEP_COUNT}
          </Figure>
        </View>
        <TwineRail width={width - GUTTER * 2} progress={step / (STEP_COUNT - 1)} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={step} entering={FadeInRight.duration(280)} style={styles.step}>
          {step === 0 && (
            <Question
              eyebrow="Question one"
              title="Biological sex"
              note="Selects the base column for every nutrient. The workbook publishes separate values for male and female across most of the 48 targets."
            >
              <OptionRow
                label="Male"
                selected={answers.sex === 'male'}
                onPress={() => setAnswer('sex', 'male')}
              />
              <OptionRow
                label="Female"
                selected={answers.sex === 'female'}
                onPress={() => setAnswer('sex', 'female')}
              />
            </Question>
          )}

          {step === 1 && (
            <Question
              eyebrow="Question two"
              title="Age"
              note="Several targets step at 31, 51, 65 and 71 years. Below 19 the dataset makes no claim."
            >
              <InstrumentSlider
                value={answers.age_years ?? 30}
                onChange={(value) => setAnswer('age_years', value)}
                min={16}
                max={100}
                unit="years"
                minLabel="16"
                maxLabel="100"
              />
              {underAge && (
                <Callout tone="breach">
                  Under 19 is outside this dataset&apos;s scope. Targets shown
                  after this point would not be supported by the sources.
                </Callout>
              )}
            </Question>
          )}

          {step === 2 && (
            <Question
              eyebrow="Question three"
              title="Weight"
              note="Scales energy, water, protein and the nine indispensable amino acids. Vitamins and minerals are never scaled by body mass."
            >
              <InstrumentSlider
                value={answers.weight_kg ?? 70}
                onChange={(value) => setAnswer('weight_kg', value)}
                min={35}
                max={200}
                unit="kg"
                minLabel="35 kg"
                maxLabel="200 kg"
              />
            </Question>
          )}

          {step === 3 && (
            <Question
              eyebrow="Question four"
              title="Diet"
              note="A spectrum, not a category. Plant-heavy positions raise iron, zinc and B12 targets because the baseline assumes an omnivorous diet."
            >
              <DietSpectrum
                position={dietPosition}
                onChange={(position, dietType, fraction) => {
                  setDietPosition(position);
                  setAnswer('diet_type', dietType);
                  setAnswer('animal_food_fraction', fraction);
                }}
              />
              {answers.diet_type && isLibraryThin(answers.diet_type) && (
                <Callout tone="caution">
                  Only {recipeCountForDiet(answers.diet_type)} recipes in the
                  library fit this diet, so the plan will repeat more than
                  usual. Moving one notch along the spectrum opens it up.
                </Callout>
              )}
            </Question>
          )}

          {step === 4 && (
            <Question
              eyebrow="Question five"
              title="Activity"
              note="Sets the PAL multiplier on basal metabolic rate, and raises protein and several B vitamins."
            >
              {activityLevels.map((level) => (
                <OptionRow
                  key={level.activity_level}
                  label={level.label}
                  description={level.description}
                  meta={`×${level.pal_multiplier}`}
                  selected={answers.activity_level === level.activity_level}
                  onPress={() => setAnswer('activity_level', level.activity_level)}
                />
              ))}
            </Question>
          )}

          {step === 5 && (
            <Question
              eyebrow="Question six"
              title="Sun exposure"
              note="Only latitude matters. It sets the vitamin D multiplier and how many months a year synthesis is not possible."
            >
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
            <Question
              eyebrow="Question seven"
              title="Cuisines"
              note="A pull, not a filter. Nutrition targets always win, so a narrow choice never makes the plan unreachable."
            >
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
              <Body small color={text.faint} style={styles.hint}>
                Leave all unselected for no preference.
              </Body>
            </Question>
          )}

          {step === 7 && (
            <Question
              eyebrow="Question eight"
              title="Difficulty ceiling"
              note="Derived per recipe from ingredient count, step count, time and technique."
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <OptionRow
                  key={level}
                  label={DIFFICULTY_LABELS[level].label}
                  description={DIFFICULTY_LABELS[level].description}
                  meta={`${level}/5`}
                  selected={answers.maxDifficulty === level}
                  onPress={() => setAnswer('maxDifficulty', level)}
                />
              ))}
            </Question>
          )}

          {step === 8 && (
            <Question
              eyebrow="Question nine"
              title="Time per meal"
              note="Total time, including preparation. Recipes above this are excluded outright."
            >
              <InstrumentSlider
                value={answers.maxMinutes ?? 45}
                onChange={(value) => setAnswer('maxMinutes', value)}
                min={10}
                max={180}
                step={5}
                format={(value) =>
                  value >= 60
                    ? `${Math.floor(value / 60)}h ${value % 60 ? `${value % 60}m` : ''}`.trim()
                    : `${value} min`
                }
                minLabel="10 min"
                maxLabel="3 hours"
              />
            </Question>
          )}

          {step === 9 && (
            <Question
              eyebrow="Question ten"
              title="Weekly budget"
              note="Ingredient cost is estimated from supermarket averages, so treat it as a guide rather than a quote."
            >
              <InstrumentSlider
                value={answers.weeklyBudget ?? 70}
                onChange={(value) => setAnswer('weeklyBudget', value)}
                min={20}
                max={250}
                step={5}
                format={(value) => `£${value}`}
                minLabel="£20"
                maxLabel="£250"
              />
            </Question>
          )}

          {step === 10 && (
            <Question
              eyebrow="Question eleven"
              title="How often it repeats"
              note="The schedule is fixed for a full cycle and then repeats. A shorter cycle is easier to shop for; a longer one gives more variety."
            >
              <View style={styles.cycleGrid}>
                {(Object.keys(CYCLE_LABELS) as unknown as string[])
                  .map(Number)
                  .map((days) => (
                    <OptionRow
                      key={days}
                      label={CYCLE_LABELS[days as CycleLength]}
                      description={
                        days === 1
                          ? 'The same three meals every single day.'
                          : `${days} days of meals, repeating.`
                      }
                      meta={`${days}d`}
                      selected={cycleDays === days}
                      onPress={() => setCycleDaysRaw(days as CycleLength)}
                    />
                  ))}
              </View>
            </Question>
          )}

          {step === 11 && targets && (
            <Reveal targets={targets} />
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          onPress={advance}
          disabled={!canAdvance}
          style={({ pressed }) => [
            styles.cta,
            !canAdvance && styles.ctaDisabled,
            pressed && styles.ctaPressed,
          ]}
          accessibilityRole="button"
        >
          <Eyebrow color={canAdvance ? ink.void : text.faint}>
            {step === STEP_COUNT - 1 ? 'Build my plan' : 'Continue'}
          </Eyebrow>
        </Pressable>
      </View>
    </View>
  );
}

function Question({
  eyebrow,
  title,
  note,
  children,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.question}>
      <Eyebrow color={signal.endpoint}>{eyebrow}</Eyebrow>
      <Title style={styles.questionTitle}>{title}</Title>
      {note && (
        <Body small color={text.faint} style={styles.note}>
          {note}
        </Body>
      )}
      <View style={styles.questionBody}>{children}</View>
    </View>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: 'caution' | 'breach';
  children: React.ReactNode;
}) {
  const colour = tone === 'breach' ? signal.breach : signal.caution;
  return (
    <View style={[styles.callout, { borderLeftColor: colour }]}>
      <Body small color={colour} style={styles.calloutText}>
        {children}
      </Body>
    </View>
  );
}

/** The payoff: the six inputs become 48 resolved targets. */
function Reveal({ targets }: { targets: ReturnType<typeof resolveTargets> }) {
  const highlights = [
    'energy_kcal',
    'protein_g',
    'fiber_g',
    'vitamin_d_ug',
    'iron_mg',
    'calcium_mg',
  ];

  const breaches = targets.nutrients.filter((nutrient) => nutrient.over_ul);

  return (
    <View style={styles.question}>
      <Eyebrow color={signal.endpoint}>Resolved</Eyebrow>
      <Title style={styles.questionTitle}>Your daily targets</Title>
      <Doctrine color={text.tertiary} style={styles.revealDoctrine}>
        Forty-eight values, derived from your six answers.
      </Doctrine>

      <View style={styles.energyBlock}>
        <Figure tiny color={text.faint}>
          BASAL {formatValue(targets.bmr_kcal)} kcal × PAL {targets.pal_multiplier}
        </Figure>
        <View style={styles.energyRow}>
          <Animated.Text entering={FadeIn.delay(200)} style={styles.energyValue}>
            {formatValue(targets.energy_kcal)}
          </Animated.Text>
          <Figure color={text.tertiary} style={styles.energyUnit}>
            kcal / day
          </Figure>
        </View>
      </View>

      <View style={styles.revealList}>
        {highlights.map((id) => {
          const nutrient = targets.byId[id];
          if (!nutrient) return null;
          return (
            <NutrientBar
              key={id}
              name={nutrient.nutrient_name}
              unit={nutrient.unit}
              target={nutrient.value}
              achieved={null}
              coverage={coverageFor(id)}
              compact
            />
          );
        })}
      </View>

      {breaches.length > 0 && (
        <Callout tone="breach">
          {breaches.map((n) => n.nutrient_name).join(', ')}{' '}
          {breaches.length === 1 ? 'resolves' : 'resolve'} above the tolerable
          upper intake level once your modifiers compound. Treat that as a
          prompt to speak to a clinician, not as a shopping target.
        </Callout>
      )}

      <Body small color={text.faint} style={styles.disclaimer}>
        Gospel implements published intake guidance. It is not medical advice
        and does not model pregnancy, lactation, medication or disease.
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ink.base },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: GUTTER,
    gap: space.xs,
    backgroundColor: ink.base,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: space.lg,
  },
  step: { flex: 1 },
  question: { gap: space.xs },
  questionTitle: { marginTop: space.xxs },
  note: { lineHeight: 19, marginTop: space.xxs },
  questionBody: { marginTop: space.lg, gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  hint: { marginTop: space.sm },
  cycleGrid: { gap: 0 },
  callout: {
    borderLeftWidth: 2,
    paddingLeft: space.sm,
    paddingVertical: space.xs,
    marginTop: space.md,
  },
  calloutText: { lineHeight: 19 },
  revealDoctrine: { marginTop: space.xs },
  energyBlock: { marginTop: space.lg, gap: space.xxs },
  energyRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  energyValue: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 46,
    letterSpacing: -2,
    color: signal.endpoint,
  },
  energyUnit: { marginBottom: 6 },
  revealList: { marginTop: space.lg },
  disclaimer: { marginTop: space.lg, lineHeight: 18 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    backgroundColor: ink.base,
    borderTopWidth: 1,
    borderTopColor: ink.line,
  },
  cta: {
    alignItems: 'center',
    backgroundColor: signal.endpoint,
    paddingVertical: space.sm + 3,
    borderRadius: radius.pill,
  },
  ctaDisabled: { backgroundColor: ink.elevated },
  ctaPressed: { opacity: 0.75 },
});
