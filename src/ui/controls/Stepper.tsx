/**
 * Increment and decrement, for small integer counts.
 *
 * Where a slider would be overkill - meals per day, cycle length - two rules
 * and a readout. The bounds are enforced here rather than by the caller, so a
 * disabled arrow is visibly disabled.
 */

import { StyleSheet, View } from 'react-native';

import { grade, space, stroke } from '@/theme/tokens';
import { AnimatedNumber, Press } from '@/ui/motion';
import { Label } from '@/ui/text';

interface StepperProps {
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function Stepper({ value, min, max, unit, onChange }: StepperProps) {
  const canDown = value > min;
  const canUp = value < max;

  return (
    <View style={styles.root}>
      <Press
        onPress={() => canDown && onChange(value - 1)}
        plain
        disabled={!canDown}
        accessibilityLabel="Decrease"
        style={styles.button}
      >
        <Label color={canDown ? grade[90] : grade[40]}>—</Label>
      </Press>

      <View style={styles.readout}>
        <AnimatedNumber value={value} suffix={unit ? ` ${unit}` : ''} color={grade[100]} />
      </View>

      <Press
        onPress={() => canUp && onChange(value + 1)}
        plain
        disabled={!canUp}
        accessibilityLabel="Increase"
        style={styles.button}
      >
        <Label color={canUp ? grade[90] : grade[40]}>+</Label>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: stroke.hair,
    borderColor: grade[40],
    alignSelf: 'flex-start',
  },
  button: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  readout: {
    paddingHorizontal: space.md,
    borderLeftWidth: stroke.hair,
    borderRightWidth: stroke.hair,
    borderColor: grade[40],
  },
});
