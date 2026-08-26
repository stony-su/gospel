/**
 * Typographic primitives.
 *
 * Three registers, used consistently: Newsreader italic for doctrine, Plex
 * Sans for interface, Plex Mono for anything measured. Numbers always arrive
 * in mono, so a figure never reads as prose.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { text as palette, type as typeScale } from '@/theme/tokens';

interface BaseProps extends TextProps {
  children: ReactNode;
  color?: string;
  style?: TextStyle | TextStyle[];
}

/** The motto, and section epigraphs. Set in italic serif. */
export function Doctrine({ children, color, style, large, ...rest }: BaseProps & { large?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        large ? typeScale.doctrineLarge : typeScale.doctrine,
        { color: color ?? palette.secondary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Title({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text {...rest} style={[typeScale.title, { color: color ?? palette.bright }, style]}>
      {children}
    </Text>
  );
}

export function Heading({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text {...rest} style={[typeScale.heading, { color: color ?? palette.primary }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, color, style, small, ...rest }: BaseProps & { small?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        small ? typeScale.bodySmall : typeScale.body,
        { color: color ?? palette.secondary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Uppercase mono label. Used for section headers and field names. */
export function Eyebrow({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text
      {...rest}
      style={[
        typeScale.eyebrow,
        styles.eyebrow,
        { color: color ?? palette.faint },
        style,
      ]}
    >
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
}

/** A large measured value. The app's headline numbers. */
export function Readout({ children, color, style, ...rest }: BaseProps) {
  return (
    <Text {...rest} style={[typeScale.readout, { color: color ?? palette.bright }, style]}>
      {children}
    </Text>
  );
}

/** An inline measured value, at body scale. */
export function Figure({ children, color, style, tiny, ...rest }: BaseProps & { tiny?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        tiny ? typeScale.figureTiny : typeScale.figure,
        { color: color ?? palette.tertiary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    // Plex Mono has generous sidebearings; the extra tracking is what makes
    // an uppercase label read as a rule rather than a word.
    textTransform: 'uppercase',
  },
});
