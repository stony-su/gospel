/**
 * The Grocery tab.
 *
 * The list for one cycle, grouped by aisle, with ticks. What appears here is
 * the difference between what the cycle needs and what the pantry still holds,
 * so it genuinely changes from cycle to cycle even though the meals do not.
 *
 * The one-time setup list is kept separate: spices, oil and equipment are a
 * first shop, not a weekly one, and mixing them in would make every list look
 * enormous.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CheckRow, Segmented } from '@/components/primitives/Choice';
import { Screen } from '@/components/primitives/Screen';
import {
  Body,
  Doctrine,
  Eyebrow,
  Figure,
  Title,
} from '@/components/primitives/Text';
import type { GroceryLine } from '@/domain/pantry/types';
import { ink, radius, signal, space, text } from '@/theme/tokens';
import { useGospel, usePantryProjection } from '@/store/useGospel';

/** Grams shown in the unit a shopper actually thinks in. */
function formatAmount(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)} kg`;
  return `${Math.round(grams)} g`;
}

function groupByAisle(lines: GroceryLine[]): [string, GroceryLine[]][] {
  const buckets = new Map<string, GroceryLine[]>();
  for (const line of lines) {
    const bucket = buckets.get(line.aisle);
    if (bucket) bucket.push(line);
    else buckets.set(line.aisle, [line]);
  }
  return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default function GroceryTab() {
  const plan = useGospel((state) => state.plan);
  const checked = useGospel((state) => state.checked);
  const toggleChecked = useGospel((state) => state.toggleChecked);
  const clearChecked = useGospel((state) => state.clearChecked);
  const activeCycle = useGospel((state) => state.activeCycle);
  const setActiveCycle = useGospel((state) => state.setActiveCycle);
  const projection = usePantryProjection();

  const cycle = projection?.cycles[activeCycle];
  const grouped = useMemo(() => groupByAisle(cycle?.lines ?? []), [cycle]);

  const oneTimeDone = activeCycle > 0;

  if (!plan || !projection || !cycle) {
    return (
      <Screen bottomInset={70}>
        <Title>Grocery</Title>
        <Body color={text.faint} style={styles.empty}>
          Build a plan and the shopping list follows from it.
        </Body>
      </Screen>
    );
  }

  const total = cycle.lines.length;
  const done = cycle.lines.filter(
    (line) => checked[`${activeCycle}:${line.ingredientId}`],
  ).length;

  return (
    <Screen bottomInset={70}>
      <View style={styles.header}>
        <Eyebrow color={signal.endpoint}>Cycle {activeCycle + 1}</Eyebrow>
        <Title>Grocery</Title>
        <Doctrine color={text.tertiary} style={styles.subtitle}>
          {cycle.coveredByPantry.length > 0
            ? `${cycle.coveredByPantry.length} items already in the pantry.`
            : 'Everything this cycle needs.'}
        </Doctrine>
      </View>

      <View style={styles.cycleRow}>
        <Segmented
          options={projection.cycles.slice(0, 5).map((entry) => ({
            value: entry.cycleIndex,
            label: `C${entry.cycleIndex + 1}`,
          }))}
          value={activeCycle}
          onChange={setActiveCycle}
        />
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Figure color={text.bright} style={styles.summaryValue}>
            £{cycle.totalCost.toFixed(2)}
          </Figure>
          <Eyebrow>estimated</Eyebrow>
        </View>
        <View style={styles.summaryItem}>
          <Figure
            color={done === total && total > 0 ? signal.endpoint : text.bright}
            style={styles.summaryValue}
          >
            {done}/{total}
          </Figure>
          <Eyebrow>ticked</Eyebrow>
        </View>
        {cycle.expiredGrams > 0 && (
          <View style={styles.summaryItem}>
            <Figure color={signal.caution} style={styles.summaryValue}>
              {formatAmount(cycle.expiredGrams)}
            </Figure>
            <Eyebrow>expired</Eyebrow>
          </View>
        )}
      </View>

      {activeCycle === 0 && projection.oneTimeItems.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            label="One-time setup"
            meta={`£${projection.oneTimeItems.reduce((sum, item) => sum + item.cost, 0).toFixed(2)}`}
          />
          <Body small color={text.faint} style={styles.sectionNote}>
            Long-life staples. Bought once, then assumed to be in the cupboard.
          </Body>
          {projection.oneTimeItems.map((line) => (
            <CheckRow
              key={line.ingredientId}
              label={line.name}
              meta={`${formatAmount(line.gramsToBuy)} · £${line.cost.toFixed(2)}`}
              checked={Boolean(checked[`setup:${line.ingredientId}`])}
              onPress={() => toggleChecked('setup', line.ingredientId)}
            />
          ))}
        </View>
      )}

      {activeCycle === 0 && projection.equipment.length > 0 && (
        <View style={styles.section}>
          <SectionHeader label="Equipment" meta={`${projection.equipment.length}`} />
          <Body small color={text.faint} style={styles.sectionNote}>
            Called for by recipes in this plan. Check before you shop.
          </Body>
          {projection.equipment.map((item) => (
            <CheckRow
              key={item}
              label={item.charAt(0).toUpperCase() + item.slice(1)}
              checked={Boolean(checked[`equipment:${item}`])}
              onPress={() => toggleChecked('equipment', item)}
            />
          ))}
        </View>
      )}

      {oneTimeDone && (
        <Body small color={ink.dim} style={styles.setupNote}>
          Setup items and equipment were bought in cycle 1.
        </Body>
      )}

      {grouped.length === 0 ? (
        <View style={styles.section}>
          <Body color={signal.endpoint} style={styles.nothing}>
            Nothing to buy this cycle.
          </Body>
          <Body small color={text.faint} style={styles.sectionNote}>
            The pantry covers every ingredient the schedule needs.
          </Body>
        </View>
      ) : (
        grouped.map(([aisle, lines]) => (
          <View key={aisle} style={styles.section}>
            <SectionHeader
              label={aisle}
              meta={`£${lines.reduce((sum, line) => sum + line.cost, 0).toFixed(2)}`}
            />
            {lines.map((line) => {
              const key = `${activeCycle}:${line.ingredientId}`;
              return (
                <CheckRow
                  key={line.ingredientId}
                  label={line.name}
                  meta={`£${line.cost.toFixed(2)}`}
                  checked={Boolean(checked[key])}
                  onPress={() => toggleChecked(activeCycle, line.ingredientId)}
                >
                  <View style={styles.lineMeta}>
                    <Figure tiny color={text.faint}>
                      {line.packsToBuy > 1 ? `${line.packsToBuy} × ` : ''}
                      {formatAmount(line.gramsToBuy / line.packsToBuy)}
                    </Figure>
                    <Figure tiny color={ink.dim}>
                      need {formatAmount(line.requiredGrams)}
                    </Figure>
                    {line.partiallyCovered && (
                      <Figure tiny color={signal.endpoint}>
                        {formatAmount(line.availableGrams)} in pantry
                      </Figure>
                    )}
                  </View>
                </CheckRow>
              );
            })}
          </View>
        ))
      )}

      {total > 0 && (
        <Pressable
          onPress={() => clearChecked(activeCycle)}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Eyebrow color={text.faint}>Clear ticks</Eyebrow>
        </Pressable>
      )}
    </Screen>
  );
}

function SectionHeader({ label, meta }: { label: string; meta?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Eyebrow color={text.tertiary}>{label}</Eyebrow>
      <View style={styles.sectionRule} />
      {meta && <Figure tiny color={ink.dim}>{meta}</Figure>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xxs },
  subtitle: { marginTop: space.xxs },
  empty: { marginTop: space.md, lineHeight: 21 },
  cycleRow: { marginTop: space.lg },
  summary: { flexDirection: 'row', gap: space.xl, marginTop: space.lg },
  summaryItem: { gap: 2 },
  summaryValue: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 20 },
  section: { marginTop: space.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: ink.line },
  sectionNote: { lineHeight: 18, marginBottom: space.xs },
  setupNote: { marginTop: space.lg, lineHeight: 18 },
  lineMeta: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  nothing: { marginTop: space.xs },
  clear: {
    marginTop: space.xl,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ink.line,
  },
  pressed: { opacity: 0.6 },
});
