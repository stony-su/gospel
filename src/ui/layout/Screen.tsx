/**
 * The page shell.
 *
 * Every screen sits on the same black ground. Nothing is drawn behind the
 * content: an earlier version put a field of grid marks back there and it
 * competed with the rules, axes and bar edges in front of it, which are all
 * hairlines too. Depth comes from surfaces now - see `surface` in tokens.ts -
 * where a shade means a level rather than a texture.
 */

import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GUTTER, grade, space } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** Wrap the content in a ScrollView. Off for screens that manage their own list. */
  scroll?: boolean;
  /** Extra bottom padding, e.g. to clear a tab bar. */
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scroll = true,
  bottomInset = 0,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: insets.top + space.sm,
    paddingBottom: insets.bottom + bottomInset + space.xl,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, padding, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, padding, contentStyle]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: grade[0],
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: GUTTER,
  },
});
