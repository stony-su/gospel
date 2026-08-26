/**
 * A single choice in a list.
 *
 * There is no `description` prop, and that absence is deliberate. The old
 * option row accepted one and every call site duly filled it with a sentence
 * explaining the obvious. A label and a measurement are what a choice is; if
 * an option needs a paragraph to be understood, the option is wrong.
 */

import { StyleSheet, View } from 'react-native';

import { grade, radius, space, surface, surfaceFade } from '@/theme/tokens';
import { Press } from '@/ui/motion';
import { Figure, Heading } from '@/ui/text';

interface OptionProps {
  label: string;
  /** A measurement that qualifies the choice, e.g. `x1.35`. */
  meta?: string;
  selected: boolean;
  onPress: () => void;
}

export function Option({ label, meta, selected, onPress }: OptionProps) {
  return (
    <Press
      onPress={onPress}
      selected={selected}
      accessibilityRole="radio"
      accessibilityLabel={label}
      style={[styles.root, selected && styles.selected]}
    >
      <View style={styles.body}>
        <Heading color={selected ? grade[96] : grade[80]}>{label}</Heading>
        {meta ? <Figure color={selected ? grade[80] : grade[60]}>{meta}</Figure> : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: surface.row,
    experimental_backgroundImage: surfaceFade.row,
    borderRadius: radius.md,
    marginBottom: space.xs,
  },
  selected: {
    backgroundColor: surface.raised,
    experimental_backgroundImage: surfaceFade.raised,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingLeft: space.md,
    gap: space.md,
  },
});
