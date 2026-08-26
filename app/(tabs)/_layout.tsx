/**
 * Tab shell.
 *
 * A text-only tab bar: mono labels with a magenta rule under the active one.
 * Icons would add a second visual language for no gain in a four-tab app, and
 * the labels sit in the same typographic register as the rest of the
 * interface.
 *
 * Built on expo-router's headless `ui` tabs rather than the default tab
 * navigator, which is the supported way to supply a custom bar in SDK 57.
 */

import { forwardRef } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import * as Haptics from 'expo-haptics';

import { Eyebrow } from '@/components/primitives/Text';
import { ink, signal, space, text } from '@/theme/tokens';

type TabButtonProps = PressableProps & {
  label: string;
  isFocused?: boolean;
};

/**
 * `asChild` on TabTrigger forwards navigation props and `isFocused` down to
 * whatever it wraps, so the button only has to render.
 */
const TabButton = forwardRef<View, TabButtonProps>(
  ({ label, isFocused, onPress, ...rest }, ref) => (
    <Pressable
      ref={ref}
      {...rest}
      onPress={(event) => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.(event);
      }}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <Eyebrow color={isFocused ? signal.endpoint : text.faint}>{label}</Eyebrow>
      <View style={[styles.rule, isFocused && styles.ruleActive]} />
    </Pressable>
  ),
);

TabButton.displayName = 'TabButton';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />

      <TabList asChild>
        <View
          style={StyleSheet.flatten([
            styles.bar,
            { paddingBottom: insets.bottom + space.xs },
          ])}
        >
          <TabTrigger name="index" href="/" asChild>
            <TabButton label="Plan" />
          </TabTrigger>
          <TabTrigger name="nutrition" href="/nutrition" asChild>
            <TabButton label="Nutrition" />
          </TabTrigger>
          <TabTrigger name="grocery" href="/grocery" asChild>
            <TabButton label="Grocery" />
          </TabTrigger>
          <TabTrigger name="pantry" href="/pantry" asChild>
            <TabButton label="Pantry" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: ink.abyss,
    borderTopWidth: 1,
    borderTopColor: ink.line,
    paddingTop: space.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
  },
  rule: {
    height: 1,
    width: 22,
    backgroundColor: 'transparent',
  },
  ruleActive: {
    backgroundColor: signal.endpoint,
  },
});
