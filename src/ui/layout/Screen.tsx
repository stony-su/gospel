/**
 * The page shell.
 *
 * Every screen sits on the same black ground with the same graticule behind
 * it, so moving between tabs feels like moving around one instrument rather
 * than between separate documents. There is no way to turn the grid off: a
 * screen without it would read as a different application.
 */

import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GUTTER, grade, space } from '@/theme/tokens';
import { Graticule } from '@/ui/plot';

interface ScreenProps {
  children: ReactNode;
  /** Wrap the content in a ScrollView. Off for screens that manage their own list. */
  scroll?: boolean;
  /** Extra bottom padding, e.g. to clear a tab bar. */
  bottomInset?: number;
  /** Lower the grid under unusually dense content. */
  gridOpacity?: number;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scroll = true,
  bottomInset = 0,
  gridOpacity = 1,
  contentStyle,
}: ScreenProps) {
  const { width, height } = useWindowDimensions();
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
      <Graticule width={width} height={height} opacity={gridOpacity} />
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
