/**
 * Recipe detail.
 *
 * Quantities are shown twice: as the recipe wrote them ("1/4 cup") and as the
 * grams the planner actually used, since those grams are what drive the
 * grocery list and the cost. Showing only one would leave either the cook or
 * the shopping unexplained.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/primitives/Screen';
import {
  Body,
  Doctrine,
  Eyebrow,
  Figure,
  Heading,
  Title,
} from '@/components/primitives/Text';
import { cuisineLabels, ingredientsById, recipesById } from '@/data/recipes';
import { fatPercentOfEnergy } from '@/domain/planner/coverage';
import { useGospel } from '@/store/useGospel';
import { ink, radius, signal, space, text } from '@/theme/tokens';

const DIFFICULTY_NAMES = ['', 'Assembly', 'Simple', 'Standard', 'Involved', 'Ambitious'];

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const plan = useGospel((state) => state.plan);

  const recipe = recipesById.get(Number(id));

  if (!recipe) {
    return (
      <Screen>
        <Title>Recipe not found</Title>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Eyebrow color={text.faint}>Close</Eyebrow>
        </Pressable>
      </Screen>
    );
  }

  // How many portions this plan calls for, so quantities can be scaled.
  const meal = plan?.meals.find((entry) => entry.recipeId === recipe.id);
  const servings = meal?.servings ?? 1;
  const portionFraction = servings / Math.max(recipe.servings, 1);

  const fatPercent = fatPercentOfEnergy(recipe.nutrition);

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.close} hitSlop={12}>
        <Eyebrow color={text.faint}>Close</Eyebrow>
      </Pressable>

      <View style={styles.header}>
        <Eyebrow color={signal.endpoint}>
          {cuisineLabels[recipe.cuisine] ?? recipe.cuisine} · {recipe.slot}
        </Eyebrow>
        <Title style={styles.title}>{recipe.name}</Title>
        {recipe.description ? (
          <Doctrine color={text.tertiary} style={styles.description}>
            {recipe.description}
          </Doctrine>
        ) : null}
      </View>

      <View style={styles.statRow}>
        <Stat label="Time" value={`${recipe.minutes}`} unit="min" />
        <Stat label="Difficulty" value={`${recipe.difficulty}`} unit="of 5" />
        <Stat label="Rating" value={recipe.rating.toFixed(1)} unit={`${recipe.reviews} reviews`} />
        <Stat label="Cost" value={`£${(recipe.cost_per_serving * servings).toFixed(2)}`} unit="per portion" />
      </View>

      <Figure tiny color={ink.dim} style={styles.difficultyNote}>
        {DIFFICULTY_NAMES[recipe.difficulty]} · {recipe.prep_minutes} min prep
      </Figure>

      <Section label="Nutrition" meta="per portion as planned">
        <View style={styles.nutritionGrid}>
          <NutritionCell
            label="Energy"
            value={Math.round(recipe.nutrition.energy_kcal * servings)}
            unit="kcal"
          />
          <NutritionCell
            label="Protein"
            value={Math.round(recipe.nutrition.protein_g * servings)}
            unit="g"
          />
          <NutritionCell
            label="Carbs"
            value={Math.round(recipe.nutrition.carbohydrate_g * servings)}
            unit="g"
          />
          <NutritionCell
            label="Fat"
            value={Math.round(recipe.nutrition.fat_g * servings)}
            unit="g"
          />
          <NutritionCell
            label="Fibre"
            value={Math.round(recipe.nutrition.fiber_g * servings)}
            unit="g"
          />
          <NutritionCell
            label="Sodium"
            value={Math.round(recipe.nutrition.sodium_mg * servings)}
            unit="mg"
          />
        </View>
        {fatPercent !== null && (
          <Figure tiny color={text.faint} style={styles.fatNote}>
            Fat supplies {fatPercent.toFixed(0)}% of this dish&apos;s energy.
          </Figure>
        )}
      </Section>

      <Section
        label="Ingredients"
        meta={
          servings === 1
            ? `serves ${recipe.servings}`
            : `${servings} portions of ${recipe.servings}`
        }
      >
        {recipe.ingredients.map((ingredient, index) => {
          const known = ingredientsById[ingredient.id];
          const grams = ingredient.grams * portionFraction;
          return (
            <View key={`${ingredient.id}-${index}`} style={styles.ingredient}>
              <View style={styles.ingredientMain}>
                <Body small color={text.primary}>
                  {ingredient.label}
                </Body>
                {known && (
                  <Figure tiny color={ink.dim}>
                    {known.aisle}
                  </Figure>
                )}
              </View>
              <View style={styles.ingredientAmounts}>
                <Figure color={text.secondary}>{ingredient.quantity_text}</Figure>
                <Figure tiny color={ink.dim}>
                  ≈ {grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`}
                </Figure>
              </View>
            </View>
          );
        })}
      </Section>

      {recipe.equipment.length > 0 && (
        <Section label="Equipment">
          <View style={styles.equipmentRow}>
            {recipe.equipment.map((item) => (
              <View key={item} style={styles.equipmentChip}>
                <Figure tiny color={text.secondary}>
                  {item}
                </Figure>
              </View>
            ))}
          </View>
        </Section>
      )}

      <Section label="Method" meta={`${recipe.instructions.length} steps`}>
        {recipe.instructions.map((step, index) => (
          <View key={index} style={styles.step}>
            <Figure tiny color={signal.endpoint} style={styles.stepNumber}>
              {String(index + 1).padStart(2, '0')}
            </Figure>
            <Body small color={text.secondary} style={styles.stepText}>
              {step}
            </Body>
          </View>
        ))}
      </Section>

      <Body small color={ink.dim} style={styles.footnote}>
        Recipe {recipe.id} from the Food.com corpus. Nutrition is as published
        with the recipe; ingredient weights are estimated from the stated
        quantities.
      </Body>
    </Screen>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Eyebrow>{label}</Eyebrow>
      <Figure color={text.bright} style={styles.statValue}>
        {value}
      </Figure>
      <Figure tiny color={ink.dim}>
        {unit}
      </Figure>
    </View>
  );
}

function NutritionCell({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.nutritionCell}>
      <Eyebrow>{label}</Eyebrow>
      <View style={styles.nutritionValueRow}>
        <Figure color={text.primary} style={styles.nutritionValue}>
          {value}
        </Figure>
        <Figure tiny color={text.faint}>
          {unit}
        </Figure>
      </View>
    </View>
  );
}

function Section({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Eyebrow color={text.tertiary}>{label}</Eyebrow>
        <View style={styles.sectionRule} />
        {meta && <Figure tiny color={ink.dim}>{meta}</Figure>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  close: { alignSelf: 'flex-start', paddingVertical: space.xs },
  header: { gap: space.xxs, marginTop: space.sm },
  title: { marginTop: space.xxs },
  description: { marginTop: space.xs, fontSize: 16, lineHeight: 24 },
  statRow: { flexDirection: 'row', gap: space.lg, marginTop: space.lg, flexWrap: 'wrap' },
  stat: { gap: 2 },
  statValue: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 19 },
  difficultyNote: { marginTop: space.sm },
  section: { marginTop: space.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: ink.line },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  nutritionCell: { width: '28%', gap: 2 },
  nutritionValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  nutritionValue: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 17 },
  fatNote: { marginTop: space.sm },
  ingredient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: ink.raised,
    gap: space.md,
  },
  ingredientMain: { flex: 1, gap: 1 },
  ingredientAmounts: { alignItems: 'flex-end', gap: 1 },
  equipmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  equipmentChip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ink.line,
    backgroundColor: ink.card,
  },
  step: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  stepNumber: { width: 20, paddingTop: 3 },
  stepText: { flex: 1, lineHeight: 21 },
  footnote: { marginTop: space.xl, lineHeight: 18 },
});
