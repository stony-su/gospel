/**
 * A hairline rule.
 *
 * The only separator in the app. Weight, not colour, says how hard a break
 * it is.
 */

import { StyleSheet, View } from 'react-native';

import { grade, stroke } from '@/theme/tokens';

export function Divider({ weight = stroke.hair }: { weight?: number }) {
  return <View style={[styles.rule, { height: weight }]} />;
}

const styles = StyleSheet.create({
  rule: {
    backgroundColor: grade[40],
    alignSelf: 'stretch',
  },
});
