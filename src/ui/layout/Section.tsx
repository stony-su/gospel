/**
 * A titled block, revealed in sequence.
 *
 * The `index` is the screen's reading order: sections arrive one stagger step
 * apart, so a screen composes its own entrance simply by numbering itself.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, surface, surfaceFade } from '@/theme/tokens';
import { Reveal } from '@/ui/motion';
import { Label } from '@/ui/text';

interface SectionProps {
  label: string;
  children: ReactNode;
  index?: number;
}

export function Section({ label, children, index = 0 }: SectionProps) {
  return (
    <Reveal index={index} style={styles.root}>
      <Label style={styles.label}>{label}</Label>
      <View style={styles.body}>{children}</View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: space.lg,
    backgroundColor: surface.panel,
    // Flat colour underneath, gradient over it: a platform that does not
    // render the gradient still lands on the right level.
    experimental_backgroundImage: surfaceFade.panel,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  label: {
    marginBottom: space.sm,
    // Overhangs its panel's padding, so the label sits on the edge of the
    // block rather than politely inside it.
    marginLeft: -space.xs,
  },
  body: {
    gap: space.xxs,
  },
});
