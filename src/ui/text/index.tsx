/**
 * The type registers.
 *
 * Six components, one per register, and nothing else sets a font size. A call
 * site chooses what a piece of text *is* - a measured value, a label on an
 * axis, a screen title - and the register follows from that. When every
 * number in the app arrives in mono at one of two sizes, a number never has
 * to be read twice to know it is a number.
 *
 * Title, Heading and Label uppercase at the component rather than at the call
 * site, so the strings in the screens stay readable and a label can never be
 * shouted inconsistently.
 *
 * None of these is pure white. #FFFFFF is reserved for one thing - a nutrient
 * that has reached its target - so that white means something again. When
 * titles, numbers, fills and selected rows were all 100, a met target shouted
 * exactly as loud as a screen heading, which is to say it did not shout.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { grade, registers } from '@/theme/tokens';

interface BaseProps extends TextProps {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}

const upper = (children: ReactNode) =>
  typeof children === 'string' ? children.toUpperCase() : children;

/** The app's headline numbers. */
export function Display({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text {...rest} style={[registers.display, { color: color ?? grade[96] }, style]}>
      {children}
    </Text>
  );
}

export function Title({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text {...rest} style={[registers.title, { color: color ?? grade[92] }, style]}>
      {upper(children)}
    </Text>
  );
}

export function Heading({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text {...rest} style={[registers.heading, { color: color ?? grade[85] }, style]}>
      {upper(children)}
    </Text>
  );
}

/** Axis labels, field names, section rules. The smallest thing that speaks. */
export function Label({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text {...rest} style={[registers.label, styles.label, { color: color ?? grade[60] }, style]}>
      {upper(children)}
    </Text>
  );
}

/** An inline measured value. */
export function Figure({
  children,
  color,
  style,
  small,
  ...rest
}: BaseProps & { small?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        small ? registers.figureSmall : registers.figure,
        { color: color ?? grade[70] },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** The only non-mono register, and the only one that carries a sentence. */
export function Prose({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text {...rest} style={[registers.prose, { color: color ?? grade[80] }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    // Mono already has generous sidebearings; the extra tracking in the
    // register is what makes an uppercase label read as a rule, not a word.
    textTransform: 'uppercase',
  },
});
