/**
 * One nutrient category.
 *
 * The rows the index hands off to. Everything here was previously one sixth
 * of a very long scroll; on its own page a category is a readable table
 * rather than a stretch of one.
 */

import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useGospel, useTargets } from '@/store/useGospel';
import { grade, space } from '@/theme/tokens';
import { NutrientBar, achievedForNutrient, categoryLabel, markFor, metCount } from '@/ui/data';
import { Header, Screen } from '@/ui/layout';
import { Press, Reveal } from '@/ui/motion';
import { Label } from '@/ui/text';

export default function NutrientCategory() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const targets = useTargets();
  const plan = useGospel((state) => state.plan);

  const items = useMemo(
    () => targets?.nutrients.filter((nutrient) => nutrient.category === category) ?? [],
    [targets, category],
  );

  if (!targets || items.length === 0) {
    return (
      <Screen>
        <Header title="Not found" />
        <Press onPress={() => router.back()} plain accessibilityLabel="Close">
          <Label color={grade[70]}>close</Label>
        </Press>
      </Screen>
    );
  }

  const met = metCount(plan, items);

  return (
    <Screen>
      <Press onPress={() => router.back()} plain accessibilityLabel="Close" style={styles.close}>
        <Label color={grade[70]}>back</Label>
      </Press>

      <Header
        title={categoryLabel(String(category))}
        refButton
        right={<Label>{`${met}/${items.length} met`}</Label>}
      />

      {items.map((nutrient, position) => {
        const achieved = achievedForNutrient(plan, nutrient);
        return (
          <Reveal key={nutrient.nutrient_id} index={position}>
            <NutrientBar
              name={nutrient.nutrient_name}
              unit={nutrient.unit}
              target={nutrient.value}
              intake={achieved}
              mark={markFor(nutrient, achieved)}
              ul={nutrient.ul_value}
              onPress={() => router.push(`/nutrient/${nutrient.nutrient_id}`)}
            />
          </Reveal>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: {
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
    marginBottom: space.xs,
  },
});
