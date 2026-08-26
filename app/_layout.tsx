/**
 * Root layout: fonts, theme, and the onboarding gate.
 *
 * The splash screen is held until fonts and persisted state are both ready, so
 * the app never flashes system-font text before settling into its own.
 */

import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

// Imported from per-weight subpaths, not the package barrel. Each barrel
// `require`s every weight it ships, so importing three faces from it pulls all
// forty into the bundle - about 4 MB of fonts the app never renders.
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';

import { useGospel } from '@/store/useGospel';
import { ink } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable in this environment. Neither is fatal.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  const [storeReady, setStoreReady] = useState(
    () => useGospel.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsubscribe = useGospel.persist.onFinishHydration(() =>
      setStoreReady(true),
    );
    if (useGospel.persist.hasHydrated()) setStoreReady(true);
    return unsubscribe;
  }, []);

  const ready = (fontsLoaded || Boolean(fontError)) && storeReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: ink.base },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="recipe/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="nutrient/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ink.base,
  },
});
