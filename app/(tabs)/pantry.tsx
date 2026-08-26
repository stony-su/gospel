/**
 * The Pantry tab.
 *
 * The depletion model, made visible. Every ingredient the plan uses gets a
 * strip showing which of the next eight cycles it needs rebuying in, so the
 * rhythm behind the grocery list is inspectable rather than mysterious: this
 * is why sour cream skips two weeks and chicken never does.
 *
 * The strip is a plot, not a table of coloured cells. A filled cell is a
 * purchase and an outlined one is a cycle the pantry covers, which is the
 * same solid-versus-hollow distinction the nutrient bars use.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ingredientsById } from '@/data/recipes';
import { useGospel, usePantryProjection } from '@/store/useGospel';
import { grade, space, stroke } from '@/theme/tokens';
import { formatMass } from '@/ui/data';
import { Header, Row as LayoutRow, Screen } from '@/ui/layout';
import { AnimatedNumber, Reveal } from '@/ui/motion';
import { Figure, Label } from '@/ui/text';

interface PantryRow {
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

  const rows = useMemo<PantryRow[]>(() => {
    if (!projection) return [];

    const cycleCount = projection.cycles.length;
    const byIngredient = new Map<string, PantryRow>();

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
        <Header title="Pantry" refButton />
        <Label color={grade[50]}>build a plan to track what is left</Label>
      </Screen>
    );
  }

  const cycleCount = projection.cycles.length;
  const everyCycle = rows.filter((row) => row.purchases.every(Boolean)).length;
  const occasional = rows.length - everyCycle;

  return (
    <Screen bottomInset={70} gridOpacity={0.6}>
      <Header title="Pantry" refButton right={<Label>{`${cycleCount} cycles`}</Label>} />

      <Reveal index={0} style={styles.summary}>
        <LayoutRow
          left={<Label>every cycle</Label>}
          right={<AnimatedNumber value={everyCycle} color={grade[100]} />}
        />
        <LayoutRow
          left={<Label>occasional</Label>}
          right={<AnimatedNumber value={occasional} color={grade[100]} />}
        />
        <LayoutRow
          left={<Label>one-time</Label>}
          right={<AnimatedNumber value={projection.oneTimeItems.length} color={grade[100]} />}
        />
      </Reveal>

      <Reveal index={1} style={styles.axis}>
        <View style={styles.axisSpacer} />
        <View style={styles.axisTicks}>
          {Array.from({ length: cycleCount }, (_, index) => (
            <Label key={index} color={grade[50]} style={styles.axisTick}>
              {String(index + 1)}
            </Label>
          ))}
        </View>
      </Reveal>

      {rows.map((row, position) => (
        <Reveal key={row.id} index={2 + position} style={styles.row}>
          <View style={styles.rowHead}>
            <Figure color={grade[90]} numberOfLines={1} style={styles.name}>
              {row.name}
            </Figure>
            <Figure small color={grade[50]}>
              {`${row.shelfLifeDays}d · ${formatMass(row.packG)}`}
            </Figure>
          </View>

          <View style={styles.strip}>
            {row.purchases.map((buy, index) => (
              <View key={index} style={[styles.cell, buy ? styles.cellBuy : styles.cellHold]} />
            ))}
          </View>
        </Reveal>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    marginBottom: space.xl,
  },
  axis: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  axisSpacer: {
    flex: 1,
  },
  axisTicks: {
    flexDirection: 'row',
    width: 160,
    gap: 2,
  },
  axisTick: {
    flex: 1,
    textAlign: 'center',
  },
  row: {
    marginBottom: space.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.xxs,
  },
  name: {
    flex: 1,
  },
  strip: {
    flexDirection: 'row',
    gap: 2,
  },
  cell: {
    flex: 1,
    height: 8,
  },
  cellBuy: {
    backgroundColor: grade[100],
  },
  cellHold: {
    borderWidth: stroke.hair,
    borderColor: grade[40],
  },
});
