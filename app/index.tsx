/**
 * The title screen, and the gate.
 *
 * Returning users are sent straight to their plan. First-time users get the
 * motto, which is the only place in the app where the type is allowed to be
 * the whole point.
 */

import { useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { TwineField } from '@/components/charts/TwineField';
import { Body, Doctrine, Eyebrow } from '@/components/primitives/Text';
import { recipes } from '@/data/recipes';
import { nutrients } from '@/data/nutrition';
import { useGospel } from '@/store/useGospel';
import { ink, radius, signal, space, text } from '@/theme/tokens';

export default function Landing() {
  const router = useRouter();
  const complete = useGospel((state) => state.onboardingComplete);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    // Nothing to prefetch; the datasets are bundled and parsed on import.
  }, []);

  if (complete) return <Redirect href="/(tabs)" />;

  return (
    <View style={styles.root}>
      <TwineField width={width} height={height} intensity={1.8} liveNodes bands={7} />

      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(700)}>
          <Eyebrow color={signal.endpoint}>Gospel</Eyebrow>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(800)}>
          <Doctrine large color={text.primary} style={styles.motto}>
            Let science be my gospel{'\n'}and life be my creed
          </Doctrine>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(700).duration(700)} style={styles.stats}>
          <View style={styles.statRow}>
            <Eyebrow>{nutrients.length} nutrient targets</Eyebrow>
            <Eyebrow>{recipes.length.toLocaleString('en-GB')} recipes</Eyebrow>
          </View>
          <Body small color={text.faint} style={styles.blurb}>
            A meal schedule that repeats, built from published intake standards
            and sized to your body. Answer eleven questions and it resolves.
          </Body>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(950).duration(700)}>
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
          >
            <Eyebrow color={ink.void}>Begin</Eyebrow>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ink.base,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    gap: space.xl,
  },
  motto: {
    marginTop: space.md,
  },
  stats: {
    gap: space.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  blurb: {
    lineHeight: 21,
    maxWidth: 320,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: signal.endpoint,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
  },
  ctaPressed: {
    opacity: 0.75,
  },
});
