/**
 * References.
 *
 * Every target this app shows is derived from a published value, and this is
 * the page that says which one. It is reachable from anywhere the numbers
 * are, because a claim you cannot trace is just an assertion with a nice
 * typeface.
 *
 * The list is generated from the dataset, not written by hand, so it cannot
 * drift out of step with the values it backs.
 */

import { Linking, StyleSheet, View } from 'react-native';

import { dataset } from '@/data/nutrition';
import { grade, space } from '@/theme/tokens';
import { citationText, hostOf, referenceIndex } from '@/ui/data/citation';
import { Divider, Header, Screen } from '@/ui/layout';
import { Press, Reveal } from '@/ui/motion';
import { Figure, Label, Prose } from '@/ui/text';

const sources = [...dataset.sources].sort((a, b) => a.source_id.localeCompare(b.source_id));

export default function References() {
  return (
    <Screen>
      <Header title="References" right={<Label>{`${sources.length} sources`}</Label>} />

      {sources.map((source, position) => {
        const host = hostOf(source.url);
        const body = (
          <View style={styles.entry}>
            <View style={styles.head}>
              <Label color={grade[80]}>{referenceIndex(position)}</Label>
              {source.year ? <Figure small>{source.year}</Figure> : null}
            </View>
            <Prose style={styles.citation}>{citationText(source)}</Prose>
            {host ? (
              <Figure small color={grade[60]} style={styles.host}>
                {host}
              </Figure>
            ) : null}
          </View>
        );

        return (
          <Reveal key={source.source_id} index={position}>
            {/* A source without a resolvable URL is not a link. Rendering it
                as one would promise a destination that does not exist. */}
            {source.url && host ? (
              <Press
                onPress={() => {
                  Linking.openURL(source.url as string).catch(() => {});
                }}
                plain
                accessibilityRole="link"
                accessibilityLabel={`${referenceIndex(position)} ${host}`}
              >
                {body}
              </Press>
            ) : (
              body
            )}
            <Divider />
          </Reveal>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  entry: {
    paddingVertical: space.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  citation: {
    color: grade[80],
  },
  host: {
    marginTop: space.xs,
  },
});
