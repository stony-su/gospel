/**
 * References.
 *
 * Every target this app shows is derived from a published value, and this is
 * the page that says which one. It is reachable from anywhere the numbers
 * are, because a claim you cannot trace is just an assertion with a nice
 * typeface.
 *
 * The recipe library sits below the nutrition sources for a different reason.
 * Those are cited so the numbers can be checked; these are credited because
 * the licences require it. Almost every photograph in the app is CC BY-SA or
 * CC BY, and naming the photographer is a condition of using the picture.
 *
 * Both lists are generated from the data, not written by hand, so neither can
 * drift out of step with what it backs.
 */

import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { grade, space } from '@/theme/tokens';
import {
  librarySources,
  licenceSummary,
  photographCredits,
} from '@/ui/data/attribution';
import { citationText, hostOf, orderedSources, referenceIndex } from '@/ui/data/citation';
import { Divider, Header, Screen, Section } from '@/ui/layout';
import { Press, Reveal } from '@/ui/motion';
import { Figure, Label, Prose } from '@/ui/text';

export default function References() {
  const [creditsOpen, setCreditsOpen] = useState(false);

  return (
    <Screen>
      <Header title="References" right={<Label>{`${orderedSources.length} sources`}</Label>} />

      {orderedSources.map((source, position) => {
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

      <Section label="Recipe library" index={orderedSources.length}>
        {librarySources.map((source) => (
          <View key={source.id} style={styles.entry}>
            <View style={styles.head}>
              <Label color={grade[80]}>{source.name}</Label>
              <Figure small>{`${source.count}`}</Figure>
            </View>
            <Prose style={styles.citation}>{source.what}</Prose>
            <Figure small color={grade[60]} style={styles.host}>
              {source.url ? `${source.license} · ${hostOf(source.url)}` : source.license}
            </Figure>
          </View>
        ))}
      </Section>

      {/* Five hundred credits is a lot of page for something most readers will
          never open, and dropping it is not an option: the licences require
          it. Not a Disclosure, though - that lays its content out once to
          measure the height it animates to, which for five hundred rows is
          five hundred rows mounted on every visit to a page nobody came here
          for. This renders nothing until it is asked to. */}
      <Reveal index={orderedSources.length + 1}>
        <Press
          onPress={() => setCreditsOpen((wasOpen) => !wasOpen)}
          plain
          accessibilityLabel={`${photographCredits.length} photograph credits`}
          style={styles.creditsHead}
        >
          <Label color={grade[80]}>Photographs</Label>
          <Figure small color={grade[60]}>
            {creditsOpen
              ? licenceSummary.map((entry) => `${entry.count} ${entry.license}`).join(' · ')
              : `${photographCredits.length} · show`}
          </Figure>
        </Press>
      </Reveal>

      {creditsOpen &&
        photographCredits.map((credit) => (
          <Press
            key={credit.slug}
            onPress={() => {
              Linking.openURL(credit.sourceUrl).catch(() => {});
            }}
            plain
            accessibilityRole="link"
            accessibilityLabel={`${credit.dish}, photograph by ${credit.author}`}
            style={styles.credit}
          >
            <Figure color={grade[80]} numberOfLines={1} style={styles.creditDish}>
              {credit.dish}
            </Figure>
            <Figure small color={grade[60]} numberOfLines={1} style={styles.creditAuthor}>
              {`${credit.author} · ${credit.license}`}
            </Figure>
          </Press>
        ))}
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
  credit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  creditsHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  creditDish: {
    flexShrink: 1,
  },
  creditAuthor: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
