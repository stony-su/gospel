/**
 * A headline measurement.
 *
 * A label, a large animated number, and its unit. The number is the point,
 * so it gets the display register and everything else stays out of its way.
 */

import { StyleSheet, View } from 'react-native';

import { grade, space } from '@/theme/tokens';
import { AnimatedNumber } from '@/ui/motion';
import { Figure, Label } from '@/ui/text';

interface StatBlockProps {
  label: string;
  value: number;
  unit?: string;
  precision?: number;
  /** A derivation shown under the figure, e.g. `BMR 1810 x 1.35`. */
  note?: string;
}

export function StatBlock({ label, value, unit, precision = 0, note }: StatBlockProps) {
  return (
    <View style={styles.root}>
      <Label>{label}</Label>
      <View style={styles.figure}>
        <AnimatedNumber value={value} precision={precision} variant="display" color={grade[96]} />
        {unit ? <Figure color={grade[60]} style={styles.unit}>{unit}</Figure> : null}
      </View>
      {note ? <Figure small color={grade[60]}>{note}</Figure> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: space.sm,
  },
  figure: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
    marginVertical: space.xxs,
  },
  unit: {
    paddingBottom: space.xxs,
  },
});
