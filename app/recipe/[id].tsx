/**
 * Recipe detail.
 *
 * Quantities are shown twice: as the recipe wrote them ("1/4 cup") and as the
 * grams the planner actually used, since those grams are what drive the
 * grocery list and the cost. Showing only one would leave either the cook or
 * the shopping unexplained.
 *
 * The recipe's own description is never rendered. It is Food.com corpus copy -
 * "simple, easy, and tastes great", "great for lunches, picnics, cook outs" -
 * which cannot be fixed at the source and says nothing the name, the time and
 * the nutrition do not. The field stays on the type and goes unread.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { cuisineLabels, ingredientsById, recipesById } from '@/data/recipes';
import { fatPercentOfEnergy } from '@/domain/planner/coverage';
import { useGospel } from '@/store/useGospel';
import { grade, space, stroke } from '@/theme/tokens';
import { formatMass } from '@/ui/data';
import { Header, Row, Screen, Section } from '@/ui/layout';
import { AnimatedNumber, Press, Reveal } from '@/ui/motion';
import { Figure, Label, Prose } from '@/ui/text';

const DIFFICULTY_NAMES = ['', 'Assembly', 'Simple', 'Standard', 'Involved', 'Ambitious'];

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const plan = useGospel((state) => state.plan);

  const recipe = recipesById.get(Number(id));

  if (!recipe) {
    return (
      <Screen>
        <Header title="Not found" />
        <Press onPress={() => router.back()} plain accessibilityLabel="Close">
          <Label color={grade[70]}>close</Label>
        </Press>
      </Screen>
    );
  }

  const meal = plan?.meals.find((entry) => entry.recipeId === recipe.id);
  const servings = meal?.servings ?? 1;
  const portionFraction = servings / Math.max(recipe.servings, 1);
  const fatPercent = fatPercentOfEnergy(recipe.nutrition);

  return (
    <Screen>
      <Press onPress={() => router.back()} plain accessibilityLabel="Close" style={styles.close}>
        <Label color={grade[70]}>close</Label>
      </Press>

      <Header
        title={recipe.name}
        right={<Label>{cuisineLabels[recipe.cuisine] ?? recipe.cuisine}</Label>}
      />

      <Reveal index={0} style={styles.stats}>
        <Stat label="time" value={recipe.minutes} unit="min" />
        <Stat label="difficulty" value={recipe.difficulty} unit="of 5" />
        <Stat label="rating" value={recipe.rating} unit={`${recipe.reviews} rev`} precision={1} />
        <Stat
          label="cost"
          value={recipe.cost_per_serving * servings}
          unit="per portion"
          precision={2}
          prefix="£"
        />
      </Reveal>

      <Label color={grade[50]} style={styles.difficulty}>
        {`${DIFFICULTY_NAMES[recipe.difficulty]} · ${recipe.prep_minutes} min prep`}
      </Label>

      <Section label="Per portion" index={1}>
        <Row
          left={<Label>energy</Label>}
          right={
            <Figure color={grade[100]}>
              {`${Math.round(recipe.nutrition.energy_kcal * servings)} kcal`}
            </Figure>
          }
        />
        <Row
          left={<Label>protein</Label>}
          right={
            <Figure color={grade[100]}>
              {`${Math.round(recipe.nutrition.protein_g * servings)} g`}
            </Figure>
          }
        />
        <Row
          left={<Label>carbohydrate</Label>}
          right={
            <Figure color={grade[100]}>
              {`${Math.round(recipe.nutrition.carbohydrate_g * servings)} g`}
            </Figure>
          }
        />
        <Row
          left={<Label>fat</Label>}
          right={
            <Figure color={grade[100]}>
              {`${Math.round(recipe.nutrition.fat_g * servings)} g${
                fatPercent !== null ? ` · ${Math.round(fatPercent)}% energy` : ''
              }`}
            </Figure>
          }
        />
        <Row
          left={<Label>fibre</Label>}
          right={
            <Figure color={grade[100]}>
              {`${Math.round(recipe.nutrition.fiber_g * servings)} g`}
            </Figure>
          }
        />
        <Row
          left={<Label>sodium</Label>}
          right={
            <Figure color={grade[100]}>
              {`${Math.round(recipe.nutrition.sodium_mg * servings)} mg`}
            </Figure>
          }
        />
      </Section>

      <Section
        label={`Ingredients · ${
          servings === 1 ? `serves ${recipe.servings}` : `${servings} of ${recipe.servings}`
        }`}
        index={2}
      >
        {recipe.ingredients.map((ingredient, index) => {
          const known = ingredientsById[ingredient.id];
          const grams = ingredient.grams * portionFraction;
          return (
            <View key={`${ingredient.id}-${index}`} style={styles.ingredient}>
              <View style={styles.ingredientMain}>
                <Figure color={grade[90]}>{ingredient.label}</Figure>
                {known ? (
                  <Figure small color={grade[50]}>
                    {known.aisle}
                  </Figure>
                ) : null}
              </View>
              <View style={styles.amounts}>
                <Figure color={grade[80]}>{ingredient.quantity_text}</Figure>
                <Figure small color={grade[50]}>{`≈ ${formatMass(grams)}`}</Figure>
              </View>
            </View>
          );
        })}
      </Section>

      {recipe.equipment.length > 0 && (
        <Section label="Equipment" index={3}>
          <View style={styles.equipment}>
            {recipe.equipment.map((item) => (
              <Label key={item} color={grade[80]} style={styles.chip}>
                {item}
              </Label>
            ))}
          </View>
        </Section>
      )}

      <Section label={`Method · ${recipe.instructions.length} steps`} index={4}>
        {recipe.instructions.map((step, index) => (
          <View key={index} style={styles.step}>
            <Label color={grade[60]} style={styles.stepNumber}>
              {String(index + 1).padStart(2, '0')}
            </Label>
            <Prose color={grade[80]} style={styles.stepText}>
              {step}
            </Prose>
          </View>
        ))}
      </Section>

      <Label color={grade[40]} style={styles.footnote}>
        {`food.com · recipe ${recipe.id}`}
      </Label>
    </Screen>
  );
}

function Stat({
  label,
  value,
  unit,
  precision = 0,
  prefix,
}: {
  label: string;
  value: number;
  unit: string;
  precision?: number;
  prefix?: string;
}) {
  return (
    <View style={styles.stat}>
      <Label>{label}</Label>
      <AnimatedNumber value={value} precision={precision} prefix={prefix} color={grade[100]} />
      <Figure small color={grade[50]}>
        {unit}
      </Figure>
    </View>
  );
}

const styles = StyleSheet.create({
  close: {
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
    marginBottom: space.xs,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
  },
  stat: {
    gap: space.xxs,
  },
  difficulty: {
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: stroke.hair,
    borderBottomColor: grade[20],
  },
  ingredientMain: {
    flex: 1,
    gap: space.xxs,
  },
  amounts: {
    alignItems: 'flex-end',
    gap: space.xxs,
  },
  equipment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  chip: {
    borderWidth: stroke.hair,
    borderColor: grade[40],
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
  },
  step: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.sm,
  },
  stepNumber: {
    paddingTop: space.xxs,
    width: 20,
  },
  stepText: {
    flex: 1,
  },
  footnote: {
    marginTop: space.lg,
  },
});
