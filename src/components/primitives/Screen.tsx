/**
 * The page shell.
 *
 * Every screen sits on the same near-black ground with the ambient twine
 * field behind it, so moving between tabs feels like moving around one
 * instrument rather than between separate documents.
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

import { TwineField } from '@/components/charts/TwineField';
import { GUTTER, ink, space } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** Wrap the content in a ScrollView. Off for screens that manage their own list. */
  scroll?: boolean;
  /** Hide the ambient background, for screens dense enough to need the quiet. */
  plain?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding, e.g. to clear a tab bar. */
  bottomInset?: number;
}

export function Screen({
  children,
  scroll = true,
  plain = false,
  contentStyle,
  bottomInset = 0,
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
      {!plain && <TwineField width={width} height={height} />}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ink.base,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: GUTTER,
  },
});
