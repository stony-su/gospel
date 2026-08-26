/**
 * A compact, multi-select choice.
 *
 * Cuisines and other pulls, where the answer is a set rather than one of a
 * list. Bordered rather than ruled, because chips wrap and a left-edge rule
 * would land in the middle of a line.
 */

import { StyleSheet, View } from 'react-native';

import { grade, radius, space, stroke } from '@/theme/tokens';
import { Press } from '@/ui/motion';
import { Figure, Label } from '@/ui/text';

interface ChipProps {
  label: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, meta, selected, onPress }: ChipProps) {
  return (
    <Press
      onPress={onPress}
      plain
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      style={[styles.root, selected ? styles.on : styles.off]}
    >
      <View style={styles.body}>
        <Label color={selected ? grade[0] : grade[80]}>{label}</Label>
        {meta ? <Figure small color={selected ? grade[20] : grade[60]}>{meta}</Figure> : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: stroke.hair,
    borderRadius: radius.pill,
  },
  on: {
    backgroundColor: grade[96],
    borderColor: grade[96],
  },
  off: {
    backgroundColor: 'transparent',
    borderColor: grade[40],
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    gap: space.xs,
  },
});
