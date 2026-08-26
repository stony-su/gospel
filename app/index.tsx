/**
 * The title screen, and the gate.
 *
 * Returning users are sent straight to their plan. First-time users get the
 * one screen in the app that is allowed to be mostly empty: a name, two
 * counts, and a way in.
 *
 * The motto that used to sit here is gone with the serif that set it. What
 * replaces it is the only claim worth making up front - how many published
 * targets and how many recipes are actually behind this - stated as figures
 * rather than as a sentence about figures.
 */

import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { nutrients } from '@/data/nutrition';
import { recipes } from '@/data/recipes';
import { useGospel } from '@/store/useGospel';
import { grade, space, stroke } from '@/theme/tokens';
import { Press, Reveal } from '@/ui/motion';
import { Display, Label } from '@/ui/text';

export default function Landing() {
  const router = useRouter();
  const complete = useGospel((state) => state.onboardingComplete);

  if (complete) return <Redirect href="/(tabs)" />;

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Reveal index={0}>
          <Label color={grade[96]}>gospel</Label>
        </Reveal>

        <Reveal index={2} style={styles.figures}>
          <View style={styles.figure}>
            <Display>{String(nutrients.length)}</Display>
            <Label>nutrient targets</Label>
          </View>
          <View style={styles.rule} />
          <View style={styles.figure}>
            <Display>{recipes.length.toLocaleString('en-GB')}</Display>
            <Label>recipes</Label>
          </View>
        </Reveal>

        <Reveal index={5}>
          <Press
            onPress={() => router.push('/onboarding')}
            plain
            accessibilityLabel="Begin"
            style={styles.cta}
          >
            <Label color={grade[0]}>begin</Label>
          </Press>
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: grade[0],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    gap: space.xxl,
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
  },
  figure: {
    gap: space.xxs,
  },
  rule: {
    width: stroke.hair,
    alignSelf: 'stretch',
    backgroundColor: grade[40],
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: grade[96],
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
});
