/**
 * Screen header.
 *
 * A title over a rule, and optionally the one button in the app that is not
 * about food: [ REF ]. Every number this app shows comes from somewhere, and
 * one persistent route to the sources is what makes that checkable rather
 * than merely claimed.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { grade, space, stroke } from '@/theme/tokens';
import { Label, Title } from '@/ui/text';

interface HeaderProps {
  title: string;
  /** Shows the references button. Tabs and nutrient detail carry it. */
  refButton?: boolean;
  /** Anything else that belongs on the title row. */
  right?: ReactNode;
}

export function Header({ title, refButton = false, right }: HeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Title>{title}</Title>
        <View style={styles.right}>
          {right}
          {refButton && (
            <Link href="/references" accessibilityLabel="References" style={styles.ref}>
              <Label color={grade[70]}>[ ref ]</Label>
            </Link>
          )}
        </View>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  ref: {
    paddingVertical: space.xxs,
    paddingLeft: space.sm,
  },
  rule: {
    height: stroke.hair,
    backgroundColor: grade[40],
    marginTop: space.xs,
  },
});
