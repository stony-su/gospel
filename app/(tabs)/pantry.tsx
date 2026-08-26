/**
 * The Pantry tab.
 *
 * The depletion model, made visible. Every ingredient the plan uses gets a
 * strip showing which of the next eight cycles it needs rebuying in, so the
 * rhythm behind the grocery list is inspectable rather than mysterious: this
 * is why sour cream skips two weeks and chicken never does.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/primitives/Screen';
import {
  Body,
  Doctrine,
  Eyebrow,
  Figure,
  Title,
} from '@/components/primitives/Text';
import { ingredientsById } from '@/data/recipes';
import { ink, radius, signal, space, text } from '@/theme/tokens';
import { useGospel, usePantryProjection } from '@/store/useGospel';

interface Row {
  id: string;
  name: string;
  aisle: string;
  shelfLifeDays: number;
  packG: number;
  /** True where this cycle requires a purchase. */
  purchases: boolean[];
  totalCost: number;
  perCycleGrams: number;
}

export default function PantryTab() {
  const plan = useGospel((state) => state.plan);
  const projection = usePantryProjection();

  const rows = useMemo<Row[]>(() => {
    if (!projection) return [];

    const cycleCount = projection.cycles.length;
    const byIngredient = new Map<string, Row>();

    for (const cycle of projection.cycles) {
      for (const line of cycle.lines) {
        let row = byIngredient.get(line.ingredientId);
        if (!row) {
          const ingredient = ingredientsById[line.ingredientId];
          row = {
            id: line.ingredientId,
            name: line.name,
            aisle: line.aisle,
            shelfLifeDays: ingredient?.shelf_life_days ?? 0,
            packG: ingredient?.pack_g ?? 0,
            purchases: new Array(cycleCount).fill(false),
            totalCost: 0,
            perCycleGrams: line.requiredGrams,
          };
          byIngredient.set(line.ingredientId, row);
        }
        row.purchases[cycle.cycleIndex] = true;
        row.totalCost += line.cost;
      }
    }

    return [...byIngredient.values()].sort((a, b) => {
      const aCount = a.purchases.filter(Boolean).length;
      const bCount = b.purchases.filter(Boolean).length;
      return aCount - bCount || a.name.localeCompare(b.name);
    });
  }, [projection]);

  if (!plan || !projection) {
    return (
      <Screen bottomInset={70}>
        <Title>Pantry</Title>
        <Body color={text.faint} style={styles.empty}>
          Build a plan and Gospel starts tracking what you have left.
        </Body>
      </Screen>
    );
  }

  const cycleCount = projection.cycles.length;
  const everyCycle = rows.filter((row) => row.purchases.every(Boolean)).length;
  const occasional = rows.length - everyCycle;

  return (
    <Screen bottomInset={70}>
      <View style={styles.header}>
        <Eyebrow color={signal.endpoint}>What lasts, and what does not</Eyebrow>
        <Title>Pantry</Title>
        <Doctrine color={text.tertiary} style={styles.subtitle}>
          Shelf life decides the shopping, not the schedule.
        </Doctrine>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Figure color={text.bright} style={styles.summaryValue}>
            {everyCycle}
          </Figure>
          <Eyebrow>every cycle</Eyebrow>
        </View>
        <View style={styles.summaryItem}>
          <Figure color={signal.endpoint} style={styles.summaryValue}>
            {occasional}
          </Figure>
          <Eyebrow>occasional</Eyebrow>
        </View>
        <View style={styles.summaryItem}>
          <Figure color={text.bright} style={styles.summaryValue}>
            {projection.oneTimeItems.length}
          </Figure>
          <Eyebrow>one-time</Eyebrow>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.cell, styles.cellBuy]} />
          <Figure tiny color={text.faint}>
            buy
          </Figure>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.cell, styles.cellHold]} />
          <Figure tiny color={text.faint}>
            covered by stock
          </Figure>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.tableHead}>
          <Eyebrow color={text.tertiary} style={styles.nameColumn}>
            Ingredient
          </Eyebrow>
          <View style={styles.strip}>
            {Array.from({ length: cycleCount }).map((_, index) => (
              <Figure key={index} tiny color={ink.dim} style={styles.cellLabel}>
                {index + 1}
              </Figure>
            ))}
          </View>
        </View>

        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={styles.nameColumn}>
              <Body small color={text.primary} numberOfLines={1}>
                {row.name}
              </Body>
              <Figure tiny color={ink.dim}>
                {row.shelfLifeDays >= 365
                  ? `${Math.round(row.shelfLifeDays / 365)}y`
                  : `${row.shelfLifeDays}d`}{' '}
                life · {row.packG >= 1000 ? `${row.packG / 1000}kg` : `${row.packG}g`} pack
              </Figure>
            </View>

            <View style={styles.strip}>
              {row.purchases.map((buy, index) => (
                <View
                  key={index}
                  style={[styles.cell, buy ? styles.cellBuy : styles.cellHold]}
                />
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Eyebrow color={text.tertiary}>How this works</Eyebrow>
          <View style={styles.sectionRule} />
        </View>
        <Body small color={text.faint} style={styles.explain}>
          Each cycle the plan consumes a fixed amount of every ingredient. What
          is left carries forward until either the quantity runs out or the
          shelf life does, whichever comes first. A 300 g tub of sour cream
          against 60 g a week is covered on quantity for five weeks, but its
          21-day life expires first, so it returns to the list in cycle four.
        </Body>
        <Body small color={text.faint} style={styles.explain}>
          Prices, shelf lives and pack sizes are estimates for common
          supermarket items, not measured data.
        </Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xxs },
  subtitle: { marginTop: space.xxs },
  empty: { marginTop: space.md, lineHeight: 21 },
  summary: { flexDirection: 'row', gap: space.xl, marginTop: space.lg },
  summaryItem: { gap: 2 },
  summaryValue: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 20 },
  legend: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  section: { marginTop: space.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: ink.line },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: ink.raised,
  },
  nameColumn: { flex: 1, gap: 1 },
  strip: { flexDirection: 'row', gap: 3 },
  cell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  cellBuy: {
    backgroundColor: signal.endpoint,
  },
  cellHold: {
    backgroundColor: ink.elevated,
    borderWidth: 1,
    borderColor: ink.line,
  },
  cellLabel: { width: 12, textAlign: 'center' },
  explain: { lineHeight: 19, marginTop: space.xs },
});
