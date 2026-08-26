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
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { cuisineLabels, ingredientsById, recipesById } from '@/data/recipes';
import { fatPercentOfEnergy } from '@/domain/planner/coverage';
import { useGospel } from '@/store/useGospel';
import { GUTTER, grade, radius, space, stroke, surface } from '@/theme/tokens';
import { Plate, formatMass } from '@/ui/data';
import { Disclosure, Header, Pair, Screen, Section, Tile } from '@/ui/layout';
import { AnimatedNumber, Press, Reveal } from '@/ui/motion';
import { Figure, Label, Prose } from '@/ui/text';

const DIFFICULTY_NAMES = ['', 'Assembly', 'Simple', 'Standard', 'Involved', 'Ambitious'];

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const plan = useGospel((state) => state.plan);
  const { width } = useWindowDimensions();

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

      <Plate
        uri={recipe.image ?? null}
        width={width - GUTTER * 2}
        height={(width - GUTTER * 2) * 0.6}
        fallbackLabel="no photograph"
      />

      <View style={styles.afterPlate}>
        <Header
          title={recipe.name}
          right={<Label>{cuisineLabels[recipe.cuisine] ?? recipe.cuisine}</Label>}
        />
      </View>

      <Reveal index={0}>
        <Pair>
          <Tile label="time">
            <AnimatedNumber value={recipe.minutes} color={grade[96]} suffix=" min" />
          </Tile>
          <Tile label="difficulty">
            <AnimatedNumber value={recipe.difficulty} color={grade[96]} suffix=" / 5" />
          </Tile>
          <Tile label="rating">
            <AnimatedNumber value={recipe.rating} precision={1} color={grade[96]} />
            <Figure small color={grade[50]}>{`${recipe.reviews} reviews`}</Figure>
          </Tile>
          <Tile label="cost">
            <AnimatedNumber
              value={recipe.cost_per_serving * servings}
              precision={2}
              prefix="£"
              color={grade[96]}
            />
            <Figure small color={grade[50]}>per portion</Figure>
          </Tile>
        </Pair>
      </Reveal>

      <Label color={grade[50]} style={styles.difficulty}>
        {`${DIFFICULTY_NAMES[recipe.difficulty]} · ${recipe.prep_minutes} min prep`}
      </Label>

      <Section label="Per portion" index={1}>
        <Pair>
          <Tile label="energy">
            <Figure color={grade[92]}>
              {`${Math.round(recipe.nutrition.energy_kcal * servings)} kcal`}
            </Figure>
          </Tile>
          <Tile label="protein">
            <Figure color={grade[92]}>
              {`${Math.round(recipe.nutrition.protein_g * servings)} g`}
            </Figure>
          </Tile>
          <Tile label="carbohydrate">
            <Figure color={grade[92]}>
              {`${Math.round(recipe.nutrition.carbohydrate_g * servings)} g`}
            </Figure>
          </Tile>
          <Tile label="fat">
            <Figure color={grade[92]}>
              {`${Math.round(recipe.nutrition.fat_g * servings)} g`}
            </Figure>
            {fatPercent !== null ? (
              <Figure small color={grade[50]}>{`${Math.round(fatPercent)}% energy`}</Figure>
            ) : null}
          </Tile>
          <Tile label="fibre">
            <Figure color={grade[92]}>
              {`${Math.round(recipe.nutrition.fiber_g * servings)} g`}
            </Figure>
          </Tile>
          <Tile label="sodium">
            <Figure color={grade[92]}>
              {`${Math.round(recipe.nutrition.sodium_mg * servings)} mg`}
            </Figure>
          </Tile>
        </Pair>
      </Section>

      <Disclosure
        label="Ingredients"
        meta={`${recipe.ingredients.length} · ${
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
      </Disclosure>

      {recipe.equipment.length > 0 && (
        <Disclosure label="Equipment" meta={String(recipe.equipment.length)} index={3}>
          <View style={styles.equipment}>
            {recipe.equipment.map((item) => (
              <Label key={item} color={grade[80]} style={styles.chip}>
                {item}
              </Label>
            ))}
          </View>
        </Disclosure>
      )}

      {/* Open by default: the method is what the page was opened for. */}
      <Disclosure
        label="Method"
        meta={`${recipe.instructions.length} steps`}
        defaultOpen
        index={4}
      >
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
      </Disclosure>

      <Label color={grade[40]} style={styles.footnote}>
        {`food.com · recipe ${recipe.id}`}
      </Label>
    </Screen>
  );
}

const styles = StyleSheet.create({
  afterPlate: {
    marginTop: space.md,
  },
  close: {
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
    marginBottom: space.xs,
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
    backgroundColor: surface.row,
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.xxs,
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
