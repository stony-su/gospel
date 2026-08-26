/**
 * A label-and-value line.
 *
 * The most common shape in the app: a name on the left, a measurement on the
 * right, aligned on a baseline so a column of them reads as a table.
 *
 * One step above its panel, so a stack of rows reads as separate lines
 * without a rule between each pair.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, surface, surfaceFade } from '@/theme/tokens';

interface RowProps {
  left: ReactNode;
  right?: ReactNode;
  /** Steps in from its container, breaking the flush column. */
  inset?: boolean;
}

export function Row({ left, right, inset = false }: RowProps) {
  return (
    <View style={[styles.root, inset && styles.inset]}>
      <View style={styles.left}>{left}</View>
      {right !== undefined && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: surface.row,
    experimental_backgroundImage: surfaceFade.row,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.xxs,
    gap: space.md,
  },
  inset: {
    marginLeft: space.md,
  },
  left: {
    flexShrink: 1,
  },
  right: {
    flexShrink: 0,
  },
});
