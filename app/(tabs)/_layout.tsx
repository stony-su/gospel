/**
 * The tab bar, as a ruled axis.
 *
 * Four stops on a hairline, with one indicator that slides between them. The
 * indicator is a single element rather than a per-tab underline that fades in
 * and out: sliding reports that the selection moved, which is what happened,
 * and it also means the bar reads as an axis with a needle on it rather than
 * four independent buttons.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

import { useMotion } from '@/theme/motion';
import { grade, space, stroke, surface } from '@/theme/tokens';
import { Label } from '@/ui/text';

const TABS = [
  { name: 'index', href: '/', label: 'Plan' },
  { name: 'nutrition', href: '/nutrition', label: 'Nutrition' },
  { name: 'grocery', href: '/grocery', label: 'Grocery' },
  { name: 'pantry', href: '/pantry', label: 'Pantry' },
] as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const motion = useMotion();

  const [barWidth, setBarWidth] = useState(0);
  const [active, setActive] = useState(0);
  const position = useSharedValue(0);

  const segment = barWidth / TABS.length;

  const select = useCallback(
    (index: number) => {
      setActive(index);
      position.value = withSpring(index, motion.spring);
    },
    [position, motion],
  );

  const indicator = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: position.value * segment }],
  }));

  const onLayout = (event: LayoutChangeEvent) => setBarWidth(event.nativeEvent.layout.width);

  return (
    <Tabs>
      <TabSlot />

      <TabList asChild>
        {/* Flattened: expo-router's Slot shim throws on an array style, and it
            does so on every platform, not only web. */}
        <View
          style={StyleSheet.flatten([
            styles.bar,
            { paddingBottom: insets.bottom + space.xs },
          ])}
        >
          <View style={styles.rule} />

          <View style={styles.track} onLayout={onLayout}>
            {barWidth > 0 && <Animated.View style={[styles.indicator, indicator]} />}
          </View>

          {TABS.map((tab, index) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <Pressable
                onPress={() => select(index)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: index === active }}
                accessibilityLabel={tab.label}
              >
                <Label color={index === active ? grade[100] : grade[50]}>{tab.label}</Label>
              </Pressable>
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    // A step above the page, so the bar reads as a fixed chrome rather than
    // as the bottom of whatever is scrolling behind it.
    backgroundColor: surface.panel,
    paddingTop: space.sm,
    position: 'relative',
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: stroke.hair,
    backgroundColor: grade[40],
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: stroke.medium,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: stroke.medium,
    backgroundColor: grade[100],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.xs,
  },
});
