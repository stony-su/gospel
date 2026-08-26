/**
 * Nutrient detail.
 *
 * Where a number gets to explain itself: the base value, every rule that
 * fired to change it, the upper limit, and what backs all of it.
 *
 * This is the one screen where prose earns its place. Everywhere else the
 * app's job is to show a measurement; here it is to justify one, and a
 * justification is made of sentences. What is gone is the decoration around
 * them - the epigraph, the coloured callouts - and the full citations, which
 * now appear as bracketed numbers pointing at the references page rather than
 * as three lines of bibliography per rule.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { modifiers, nutrients } from '@/data/nutrition';
import { COVERAGE_LABEL, coverageFor } from '@/domain/planner/coverage';
import { useGospel, useTargets } from '@/store/useGospel';
import { grade, space, stroke } from '@/theme/tokens';
import { NutrientBar, formatAmount, markFor, referenceLabelFor } from '@/ui/data';
import { Divider, Header, Row, Screen, Section } from '@/ui/layout';
import { Press, Reveal } from '@/ui/motion';
import { Figure, Label, Prose } from '@/ui/text';

const BASIS_EXPLAIN: Record<string, string> = {
  RDA: 'Recommended Dietary Allowance: meets the needs of 97-98% of healthy people.',
  AI: 'Adequate Intake: used where the evidence is too thin to set an RDA.',
  EER: 'Estimated Energy Requirement: the intake that balances expenditure.',
  AMDR: 'Acceptable Macronutrient Distribution Range, as a share of energy.',
  UL: 'Tolerable Upper Intake Level.',
};

const CONFIDENCE_EXPLAIN: Record<string, string> = {
  high: 'Written into the DRI reference standard itself, or an equivalent national body.',
  medium: 'A major professional-society position stand.',
  low: 'Plausible mechanism, but thin or contested human evidence.',
};

export default function NutrientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const targets = useTargets();
  const plan = useGospel((state) => state.plan);

  const row = nutrients.find((entry) => entry.nutrient_id === id);
  const resolved = targets?.byId[String(id)];

  if (!row || !resolved) {
    return (
      <Screen>
        <Header title="Not found" />
        <Press onPress={() => router.back()} plain accessibilityLabel="Close">
          <Label color={grade[70]}>close</Label>
        </Press>
      </Screen>
    );
  }

  const appliedRules = modifiers.filter((rule) => resolved.rules_applied.includes(rule.rule_id));
  const flagRules = modifiers.filter(
    (rule) =>
      rule.nutrient_id === row.nutrient_id &&
      rule.flag_code !== null &&
      resolved.flags.includes(rule.flag_code),
  );

  const coverage = coverageFor(row.nutrient_id);
  const achieved =
    coverage !== 'awaiting_fdc' && plan ? (plan.averageNutrition[row.nutrient_id] ?? null) : null;

  // Every source behind this number: the nutrient's own, plus each rule that
  // fired. Rendered as the numbers they hold on the references page.
  const references = [
    ...new Set<string>([
      ...(row.source_ids ?? []),
      ...appliedRules.flatMap((rule) => rule.source_ids ?? []),
    ]),
  ]
    .map((sourceId) => referenceLabelFor(sourceId))
    .filter((label): label is string => label !== null)
    .sort();

  return (
    <Screen>
      <Press onPress={() => router.back()} plain accessibilityLabel="Close" style={styles.close}>
        <Label color={grade[70]}>close</Label>
      </Press>

      <Header
        title={row.nutrient_name}
        refButton
        right={<Label>{row.category.replace('_', ' ')}</Label>}
      />

      <Reveal index={0} style={styles.value}>
        <View style={styles.valueRow}>
          <Figure color={grade[96]} style={styles.big}>
            {formatAmount(resolved.value)}
          </Figure>
          <Figure color={grade[70]}>{`${row.unit} / day`}</Figure>
        </View>
        <Label color={grade[50]}>{`${row.basis} · ${COVERAGE_LABEL[coverage]}`}</Label>
        {BASIS_EXPLAIN[row.basis] ? (
          <Prose color={grade[70]} style={styles.explain}>
            {BASIS_EXPLAIN[row.basis]}
          </Prose>
        ) : null}
      </Reveal>

      {achieved !== null && (
        <Section label="Your plan delivers" index={1}>
          <NutrientBar
            name={row.nutrient_name}
            unit={row.unit}
            target={resolved.value}
            intake={achieved}
            mark={markFor(resolved, achieved)}
            ul={row.ul_value}
          />
        </Section>
      )}

      {appliedRules.length > 0 && (
        <Section label="Rules applied" index={2}>
          {appliedRules.map((rule) => (
            <View key={rule.rule_id}>
              <Row
                left={<Figure color={grade[90]}>{rule.rule_id}</Figure>}
                right={<Figure small color={grade[70]}>{rule.effect_type}</Figure>}
              />
              {rule.note ? (
                <Prose color={grade[70]} style={styles.explain}>
                  {rule.note}
                </Prose>
              ) : null}
              <Divider />
            </View>
          ))}
        </Section>
      )}

      {row.ul_value !== null && (
        <Section label="Upper limit" index={3}>
          <Row
            left={<Figure color={grade[96]}>{`${formatAmount(row.ul_value)} ${row.unit}`}</Figure>}
            right={
              resolved.pct_of_ul !== null ? (
                <Figure small color={grade[70]}>
                  {`${resolved.pct_of_ul.toFixed(0)}% of UL`}
                </Figure>
              ) : undefined
            }
          />
          {row.ul_applies_to ? (
            <Prose color={grade[70]} style={styles.explain}>
              {`Applies to ${row.ul_applies_to}.`}
            </Prose>
          ) : null}
        </Section>
      )}

      {flagRules.length > 0 && (
        <Section label="Flags" index={4}>
          {flagRules.map((rule) => (
            <View key={rule.rule_id}>
              <Label color={grade[90]}>{rule.flag_code ?? ''}</Label>
              {rule.note ? (
                <Prose color={grade[70]} style={styles.explain}>
                  {rule.note}
                </Prose>
              ) : null}
            </View>
          ))}
        </Section>
      )}

      {resolved.lowest_confidence && (
        <Section label="Confidence" index={5}>
          <Label color={grade[90]}>{resolved.lowest_confidence}</Label>
          <Prose color={grade[70]} style={styles.explain}>
            {CONFIDENCE_EXPLAIN[resolved.lowest_confidence]}
          </Prose>
        </Section>
      )}

      {references.length > 0 && (
        <Section label="Sources" index={6}>
          <Press
            onPress={() => router.push('/references')}
            plain
            accessibilityRole="link"
            accessibilityLabel="Open references"
          >
            <View style={styles.refs}>
              {references.map((label) => (
                <Label key={label} color={grade[90]} style={styles.ref}>
                  {label}
                </Label>
              ))}
            </View>
          </Press>
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: {
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
    marginBottom: space.xs,
  },
  value: {
    marginBottom: space.xl,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  big: {
    fontSize: 34,
    lineHeight: 40,
  },
  explain: {
    marginTop: space.xs,
  },
  refs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  ref: {
    borderWidth: stroke.hair,
    borderColor: grade[40],
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
  },
});
