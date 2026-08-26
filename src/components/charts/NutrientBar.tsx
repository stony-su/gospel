/**
 * The titration bar.
 *
 * One row per nutrient. The fill is grey while intake is short of target and
 * turns phenolphthalein magenta the moment it arrives - the indicator changing
 * at the endpoint. Past 80% of the tolerable upper limit it goes amber, and
 * over the limit, red. Colour therefore always reports a verdict; nothing on
 * this screen is coloured for decoration.
 *
 * Nutrients the recipe data cannot measure show their computed target against
 * an empty, dashed track labelled "awaiting FDC". The app would rather show a
 * gap than a guess.
 */

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Eyebrow, Figure } from '@/components/primitives/Text';
import type { NutrientCoverage } from '@/domain/planner/coverage';
import { glow, ink, radius, signal, space, text } from '@/theme/tokens';

export interface NutrientBarProps {
  name: string;
  unit: string;
  /** The personalised daily target. */
  target: number;
  /** What the plan delivers, or null when unmeasurable. */
  achieved: number | null;
  coverage: NutrientCoverage;
  ulValue?: number | null;
  overUl?: boolean;
  approachingUl?: boolean;
  /** Show a lower-confidence marker, per the workbook's confidence column. */
  lowConfidence?: boolean;
  compact?: boolean;
}

/** Trim a value to a sensible number of digits for its magnitude. */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const magnitude = Math.abs(value);
  if (magnitude >= 1000) return Math.round(value).toLocaleString('en-GB');
  if (magnitude >= 100) return value.toFixed(0);
  if (magnitude >= 10) return value.toFixed(1);
  if (magnitude >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function NutrientBarComponent({
  name,
  unit,
  target,
  achieved,
  coverage,
  ulValue,
  overUl = false,
  approachingUl = false,
  lowConfidence = false,
  compact = false,
}: NutrientBarProps) {
  const unmeasured = achieved === null || coverage === 'awaiting_fdc';
  const ratio = !unmeasured && target > 0 ? achieved / target : 0;
  const reachedEndpoint = ratio >= 1;

  // The bar tops out at 150% of target so an extreme overshoot still renders.
  const fillPercent = Math.min(ratio, 1.5) / 1.5;
  const targetMarkPercent = 1 / 1.5;

  const fillColour = overUl
    ? signal.breach
    : approachingUl
      ? signal.caution
      : reachedEndpoint
        ? signal.endpoint
        : signal.inert;

  const valueColour = unmeasured
    ? text.faint
    : overUl
      ? signal.breach
      : approachingUl
        ? signal.caution
        : reachedEndpoint
          ? signal.endpoint
          : text.secondary;

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Body small color={text.primary} style={styles.name}>
            {name}
          </Body>
          {lowConfidence && <View style={styles.confidenceDot} />}
        </View>

        <View style={styles.values}>
          {unmeasured ? (
            <Eyebrow color={text.faint}>Awaiting FDC</Eyebrow>
          ) : (
            <Figure color={valueColour}>
              {formatValue(achieved)}
              <Figure color={text.faint}> / </Figure>
              {formatValue(target)} {unit}
            </Figure>
          )}
        </View>
      </View>

      <View style={styles.trackWrap}>
        <View style={[styles.track, unmeasured && styles.trackEmpty]}>
          {!unmeasured && (
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(fillPercent * 100, 1.5)}%`,
                  backgroundColor: fillColour,
                },
                reachedEndpoint && !overUl && styles.fillGlow,
              ]}
            />
          )}

          {/* The endpoint: where the indicator turns. */}
          <View style={[styles.targetMark, { left: `${targetMarkPercent * 100}%` }]} />
        </View>

        {!unmeasured && (
          <Figure tiny color={text.faint} style={styles.percent}>
            {Math.round(ratio * 100)}%
          </Figure>
        )}
      </View>

      {ulValue != null && !unmeasured && (overUl || approachingUl) && (
        <Figure tiny color={overUl ? signal.breach : signal.caution} style={styles.ulNote}>
          {overUl ? 'Over' : 'Approaching'} upper limit {formatValue(ulValue)} {unit}
        </Figure>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: space.sm,
  },
  rootCompact: {
    paddingVertical: space.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.xs,
    gap: space.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: space.xxs,
  },
  name: {
    flexShrink: 1,
  },
  confidenceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ink.muted,
  },
  values: {
    flexShrink: 0,
  },
  trackWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: ink.line,
    overflow: 'visible',
    position: 'relative',
  },
  trackEmpty: {
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderColor: ink.line,
    borderStyle: 'dashed',
    height: 1,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
  },
  fillGlow: {
    boxShadow: glow(5, 0.7),
  },
  targetMark: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 1,
    backgroundColor: ink.dim,
  },
  percent: {
    width: 40,
    textAlign: 'right',
  },
  ulNote: {
    marginTop: space.xxs,
  },
});

export const NutrientBar = memo(NutrientBarComponent);
