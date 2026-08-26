/**
 * Nutrient detail.
 *
 * Where a number gets to explain itself: the base value, every rule that fired
 * to change it, the upper limit, and the citations behind all of it. The motto
 * is only earned if the sources are one tap away.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { formatValue } from '@/components/charts/NutrientBar';
import { Screen } from '@/components/primitives/Screen';
import {
  Body,
  Doctrine,
  Eyebrow,
  Figure,
  Title,
} from '@/components/primitives/Text';
import { nutrients, sourcesById } from '@/data/nutrition';
import { modifiers } from '@/data/nutrition';
import { COVERAGE_LABEL, coverageFor } from '@/domain/planner/coverage';
import { ink, radius, signal, space, text } from '@/theme/tokens';
import { useGospel, useTargets } from '@/store/useGospel';

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
        <Title>Nutrient not found</Title>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Eyebrow color={text.faint}>Close</Eyebrow>
        </Pressable>
      </Screen>
    );
  }

  const appliedRules = modifiers.filter((rule) =>
    resolved.rules_applied.includes(rule.rule_id),
  );
  const flagRules = modifiers.filter(
    (rule) =>
      rule.nutrient_id === row.nutrient_id &&
      rule.flag_code !== null &&
      resolved.flags.includes(rule.flag_code),
  );

  const coverage = coverageFor(row.nutrient_id);
  const achieved =
    coverage !== 'awaiting_fdc' && plan
      ? plan.averageNutrition[row.nutrient_id]
      : null;

  const sourceIds = new Set<string>([
    ...(row.source_ids ?? []),
    ...appliedRules.flatMap((rule) => rule.source_ids ?? []),
  ]);

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.close} hitSlop={12}>
        <Eyebrow color={text.faint}>Close</Eyebrow>
      </Pressable>

      <View style={styles.header}>
        <Eyebrow color={signal.endpoint}>{row.category.replace('_', ' ')}</Eyebrow>
        <Title style={styles.title}>{row.nutrient_name}</Title>
      </View>

      <View style={styles.valueBlock}>
        <View style={styles.valueRow}>
          <Figure color={signal.endpoint} style={styles.bigValue}>
            {formatValue(resolved.value)}
          </Figure>
          <Figure color={text.tertiary} style={styles.unit}>
            {row.unit} / day
          </Figure>
        </View>
        <Figure tiny color={text.faint}>
          {row.basis} · {COVERAGE_LABEL[coverage]}
        </Figure>
      </View>

      {achieved !== null && achieved !== undefined && (
        <View style={styles.achievedBlock}>
          <Eyebrow>Your plan delivers</Eyebrow>
          <View style={styles.valueRow}>
            <Figure color={text.bright} style={styles.mediumValue}>
              {formatValue(achieved)}
            </Figure>
            <Figure tiny color={text.faint}>
              {row.unit} · {Math.round((achieved / resolved.value) * 100)}% of target
            </Figure>
          </View>
        </View>
      )}

      {coverage === 'awaiting_fdc' && (
        <View style={styles.callout}>
          <Body small color={text.faint} style={styles.calloutText}>
            The recipe dataset does not publish this nutrient. Populating it
            needs per-ingredient values from FoodData Central, which is not part
            of this build. The target above is fully resolved; only the intake
            side is missing.
          </Body>
        </View>
      )}

      {BASIS_EXPLAIN[row.basis] && (
        <Section label="Basis">
          <Body small color={text.secondary} style={styles.prose}>
            {BASIS_EXPLAIN[row.basis]}
          </Body>
        </Section>
      )}

      <Section label="How this was derived">
        <View style={styles.derivation}>
          <DerivationStep
            label="Base"
            detail={
              row.nutrient_id === 'energy_kcal'
                ? `Schofield BMR ${formatValue(targets.bmr_kcal)} kcal × PAL ${targets.pal_multiplier}`
                : row.derived_from
                  ? `${row.derived_coef_per_1000kcal} ${row.unit} per 1000 kcal of energy intake`
                  : row.scales_with_bodyweight
                    ? 'Per kilogram of body weight'
                    : 'Fixed reference value for your sex'
            }
          />
          {appliedRules.map((rule) => (
            <DerivationStep
              key={rule.rule_id}
              label={rule.rule_id}
              detail={rule.note ?? `${rule.effect_type} ${rule.effect_value ?? ''}`}
              confidence={rule.confidence}
            />
          ))}
          {appliedRules.length === 0 && (
            <Body small color={text.faint} style={styles.prose}>
              No modifiers applied. This is the baseline value.
            </Body>
          )}
        </View>
      </Section>

      {row.ul_value !== null && (
        <Section label="Upper limit">
          <View style={styles.ulRow}>
            <Figure color={resolved.over_ul ? signal.breach : text.primary}>
              {formatValue(row.ul_value)} {row.unit}
            </Figure>
            {resolved.pct_of_ul !== null && (
              <Figure
                tiny
                color={
                  resolved.over_ul
                    ? signal.breach
                    : resolved.approaching_ul
                      ? signal.caution
                      : text.faint
                }
              >
                your target is {Math.round(resolved.pct_of_ul)}% of it
              </Figure>
            )}
          </View>
          {row.ul_applies_to && (
            <Body small color={text.faint} style={styles.prose}>
              Applies to {row.ul_applies_to}.
            </Body>
          )}
          {resolved.over_ul && (
            <View style={[styles.callout, styles.calloutBreach]}>
              <Body small color={signal.breach} style={styles.calloutText}>
                Your modifiers compound above the upper limit. The workbook
                treats this as a prompt to seek clinical advice, not as a
                target to shop for.
              </Body>
            </View>
          )}
        </Section>
      )}

      {flagRules.length > 0 && (
        <Section label="Flags">
          {flagRules.map((rule) => (
            <View key={rule.rule_id} style={styles.flag}>
              <Figure tiny color={signal.caution}>
                {rule.flag_code}
              </Figure>
              {rule.note && (
                <Body small color={text.faint} style={styles.prose}>
                  {rule.note}
                </Body>
              )}
            </View>
          ))}
        </Section>
      )}

      {row.notes && (
        <Section label="Note">
          <Body small color={text.secondary} style={styles.prose}>
            {row.notes}
          </Body>
        </Section>
      )}

      {resolved.lowest_confidence && (
        <Section label="Confidence">
          <Body small color={text.secondary} style={styles.prose}>
            {CONFIDENCE_EXPLAIN[resolved.lowest_confidence]}
          </Body>
        </Section>
      )}

      <Section label="Sources" meta={`${sourceIds.size}`}>
        {[...sourceIds].map((sourceId) => {
          const source = sourcesById[sourceId];
          if (!source) return null;
          return (
            <Pressable
              key={sourceId}
              onPress={() => source.url && Linking.openURL(source.url).catch(() => {})}
              style={({ pressed }) => [styles.source, pressed && styles.pressed]}
              accessibilityRole="link"
            >
              <Figure tiny color={signal.endpoint}>
                {sourceId}
              </Figure>
              <Body small color={text.secondary} style={styles.citation}>
                {source.full_citation ?? source.citation}
              </Body>
              {source.url && (
                <Figure tiny color={ink.dim} numberOfLines={1}>
                  {source.url}
                </Figure>
              )}
            </Pressable>
          );
        })}
      </Section>

      <Doctrine color={ink.dim} style={styles.motto}>
        Let science be my gospel and life be my creed.
      </Doctrine>
    </Screen>
  );
}

function DerivationStep({
  label,
  detail,
  confidence,
}: {
  label: string;
  detail: string;
  confidence?: string;
}) {
  return (
    <View style={styles.derivationStep}>
      <View style={styles.derivationMarker} />
      <View style={styles.derivationBody}>
        <View style={styles.derivationHead}>
          <Figure tiny color={text.tertiary}>
            {label}
          </Figure>
          {confidence && confidence !== 'high' && (
            <Figure tiny color={confidence === 'low' ? signal.caution : ink.dim}>
              {confidence} confidence
            </Figure>
          )}
        </View>
        <Body small color={text.secondary} style={styles.prose}>
          {detail}
        </Body>
      </View>
    </View>
  );
}

function Section({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Eyebrow color={text.tertiary}>{label}</Eyebrow>
        <View style={styles.sectionRule} />
        {meta && <Figure tiny color={ink.dim}>{meta}</Figure>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  close: { alignSelf: 'flex-start', paddingVertical: space.xs },
  header: { gap: space.xxs, marginTop: space.sm },
  title: { marginTop: space.xxs },
  valueBlock: { marginTop: space.lg, gap: space.xxs },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  bigValue: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 40, letterSpacing: -1.5 },
  mediumValue: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 22 },
  unit: { marginBottom: 4 },
  achievedBlock: { marginTop: space.lg, gap: space.xxs },
  section: { marginTop: space.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: ink.line },
  prose: { lineHeight: 19 },
  derivation: { gap: space.sm },
  derivationStep: { flexDirection: 'row', gap: space.sm },
  derivationMarker: {
    width: 2,
    alignSelf: 'stretch',
    backgroundColor: ink.lineHot,
    borderRadius: radius.pill,
  },
  derivationBody: { flex: 1, gap: 2 },
  derivationHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  ulRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  callout: {
    marginTop: space.md,
    borderLeftWidth: 2,
    borderLeftColor: ink.lineHot,
    paddingLeft: space.sm,
    paddingVertical: space.xs,
  },
  calloutBreach: { borderLeftColor: signal.breach },
  calloutText: { lineHeight: 19 },
  flag: { marginBottom: space.sm, gap: 2 },
  source: {
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: ink.raised,
    gap: 3,
  },
  citation: { lineHeight: 18 },
  pressed: { opacity: 0.6 },
  motto: { marginTop: space.xxl, textAlign: 'center' },
});
