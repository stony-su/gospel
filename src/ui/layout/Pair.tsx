/**
 * Two or more blocks abreast.
 *
 * Every screen used to be a single column of full-width rectangles, which is
 * legible and completely rigid - the eye tracks straight down and nothing
 * ever asks it to move sideways. Putting related measurements next to each
 * other breaks that, and it is also the truer arrangement: energy and protein
 * are peers, and stacking them implied a precedence that does not exist.
 *
 * Children wrap, so three tiles on a narrow screen become two and one rather
 * than three squeezed ones.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, surface, surfaceFade } from '@/theme/tokens';
import { Label } from '@/ui/text';

export function Pair({ children }: { children: ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

interface TileProps {
  label: string;
  children: ReactNode;
  /** Takes twice the width of a plain tile. */
  wide?: boolean;
}

/** One block within a Pair. */
export function Tile({ label, children, wide = false }: TileProps) {
  return (
    <View style={[styles.tile, wide && styles.wide]}>
      <Label style={styles.label}>{label}</Label>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginBottom: space.xs,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: surface.row,
    experimental_backgroundImage: surfaceFade.row,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  wide: {
    flexBasis: '100%',
  },
  label: {
    marginBottom: space.xxs,
  },
});
