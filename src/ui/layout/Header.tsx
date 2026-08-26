/**
 * Screen header.
 *
 * A title over a rule, and optionally the one button in the app that is not
 * about food: [ REF ]. Every number this app shows comes from somewhere, and
 * one persistent route to the sources is what makes that checkable rather
 * than merely claimed.
 *
 * The title has to share its line with a count and that button, and the
 * longest one in the app - "Indispensable amino acids" - is nearly twice the
 * length of the next. So a long title steps down a register and the row is
 * built so the title yields rather than the numbers beside it: a truncated
 * heading is legible, an overlapped one is not.
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

/** Beyond this, a title cannot share its line at full size. */
const LONG_TITLE = 16;

export function Header({ title, refButton = false, right }: HeaderProps) {
  const compact = title.length > LONG_TITLE;

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={styles.titleWrap}>
          <Title compact={compact} numberOfLines={2}>
            {title}
          </Title>
        </View>
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
    gap: space.sm,
  },
  // The title yields; the count and the ref button keep their width.
  titleWrap: {
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
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
